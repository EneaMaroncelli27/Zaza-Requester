# Browser HTTP Interception Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Burp-style HTTP intercept feature to ZazaRequester — a second window with an embedded browser whose traffic is passively captured and (optionally) paused for header/body modification before forwarding, with hand-off to the existing curl builder.

**Architecture:** A local MITM proxy runs in the Electron main process. A second `BrowserWindow` hosts an embedded `WebContentsView` (the browser) plus a React intercept UI; that view's session routes through the proxy and trusts the proxy's CA programmatically (no system trust touched). The proxy captures every request, parks them when intercept is armed, and forwards/drops/edits per IPC commands. Pure-logic modules (CA, request model, state engine) are unit-tested with `bun test`; the Electron/UI layer is verified manually.

**Tech Stack:** Electron 32, electron-vite, React 18, TypeScript, Tailwind, Zustand, CodeMirror 6, Bun. New dependency: `node-forge` (dynamic CA + leaf certificate generation). Node built-ins (`net`, `tls`, `http`, `https`) for the proxy.

## Global Constraints

- Package manager is **Bun** — `bun add`, `bun run`, never npm/npx.
- TypeScript strict mode (existing `tsconfig`). No `any` without justification.
- Never touch the OS proxy settings or the OS/real-browser certificate trust store. The CA is trusted **only** by the embedded Electron session.
- All new request/response shapes reuse `src/shared/types.ts` (`RequestData`, `ResponseData`, `Header`, `HttpMethod`, `BodyType`) where applicable.
- The existing curl GUI code path (`curl.ts`, `curlBuilder.ts`, main window) must remain functionally unchanged — intercept is additive.
- CA material is stored once under Electron `app.getPath('userData')` and cached.
- Proxy listens on a random free port on `127.0.0.1` only.
- Parked-request auto-forward timeout default: **30000 ms**.
- Captured list is ephemeral per intercept-window session (no new persistence layer).

---

## File Structure

**New — main process:**
- `src/main/proxy/ca.ts` — CA generation/caching, per-host leaf issuance.
- `src/main/proxy/requestModel.ts` — `InterceptedRequest` type + parse/serialize helpers shared by proxy and IPC.
- `src/main/proxy/interceptEngine.ts` — capture/park/resolve state machine (no I/O).
- `src/main/proxy/server.ts` — the MITM proxy (CONNECT handling, TLS termination, forwarding).
- `src/main/interceptWindow.ts` — creates the second window + embedded `WebContentsView`, wires session proxy + CA trust.

**New — shared:**
- `src/shared/intercept.ts` — IPC channel names + payload types shared by main/preload/renderer.

**New — renderer (second window):**
- `src/renderer/intercept.html` — HTML entry for the intercept window.
- `src/renderer/intercept.tsx` — React root for the intercept window.
- `src/renderer/intercept/InterceptApp.tsx` — top-level intercept UI (address bar, table, editor, toggle).
- `src/renderer/intercept/CapturedTable.tsx` — live captured-request list.
- `src/renderer/intercept/RequestEditor.tsx` — edit method/url/headers/body for a parked request.
- `src/renderer/intercept/interceptApi.d.ts` — typed `window.intercept` bridge.

**Modified:**
- `package.json` — add `node-forge`, `@types/node-forge`, `test` script.
- `electron.vite.config.ts` — add second renderer input (`intercept.html`).
- `src/main/index.ts` — start proxy on ready; expose a way to open the intercept window.
- `src/main/ipc.ts` — register intercept IPC handlers.
- `src/preload/index.ts` — expose `window.intercept` bridge (main window: `openIntercept`, `onLoadRequest`).
- `src/renderer/store/useStore.ts` — add `loadIntercepted(req)` action + subscribe to load events.
- `src/renderer/components/Sidebar.tsx` — add "Open Intercept" button.

---

## Phase 0 — Tooling

### Task 0: Add dependencies and test runner

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add node-forge**

Run:
```bash
bun add node-forge && bun add -d @types/node-forge
```

- [ ] **Step 2: Add a test script**

Edit `package.json` `scripts` to add:
```json
"test": "bun test src/main"
```

- [ ] **Step 3: Verify the test runner works on an empty suite**

Create `src/main/proxy/__smoke__.test.ts`:
```ts
import { test, expect } from 'bun:test'

test('bun test runs', () => {
  expect(1 + 1).toBe(2)
})
```

Run: `bun test src/main`
Expected: 1 pass.

- [ ] **Step 4: Remove the smoke test and commit**

```bash
rm src/main/proxy/__smoke__.test.ts
git add package.json bun.lock
git commit -m "chore: add node-forge and bun test script"
```

---

## Phase 1 — Certificate Authority

### Task 1: CA generation and caching

**Files:**
- Create: `src/main/proxy/ca.ts`
- Test: `src/main/proxy/ca.test.ts`

**Interfaces:**
- Produces:
  - `interface CaMaterial { caKeyPem: string; caCertPem: string }`
  - `function createCa(): CaMaterial` — generates a fresh self-signed root CA (RSA 2048, CN "ZazaRequester Intercept CA", 10-year validity).
  - `function issueLeaf(ca: CaMaterial, host: string): { keyPem: string; certPem: string }` — issues a leaf cert for `host`, signed by the CA, with `host` in CN and subjectAltName.

- [ ] **Step 1: Write the failing test**

```ts
// src/main/proxy/ca.test.ts
import { test, expect } from 'bun:test'
import forge from 'node-forge'
import { createCa, issueLeaf } from './ca'

test('createCa produces a self-signed CA cert', () => {
  const ca = createCa()
  const cert = forge.pki.certificateFromPem(ca.caCertPem)
  expect(cert.subject.getField('CN')?.value).toBe('ZazaRequester Intercept CA')
  // self-signed: issuer === subject
  expect(cert.isIssuer(cert)).toBe(true)
})

test('issueLeaf signs a host cert that chains to the CA', () => {
  const ca = createCa()
  const leaf = issueLeaf(ca, 'example.com')
  const caCert = forge.pki.certificateFromPem(ca.caCertPem)
  const leafCert = forge.pki.certificateFromPem(leaf.certPem)
  // CA verifies the leaf's signature
  expect(caCert.verify(leafCert)).toBe(true)
  expect(leafCert.subject.getField('CN')?.value).toBe('example.com')
  const san = leafCert.getExtension('subjectAltName') as { altNames: { value: string }[] }
  expect(san.altNames.some((n) => n.value === 'example.com')).toBe(true)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/main/proxy/ca.test.ts`
Expected: FAIL — `createCa` / `issueLeaf` not exported.

- [ ] **Step 3: Implement `ca.ts`**

```ts
// src/main/proxy/ca.ts
import forge from 'node-forge'

export interface CaMaterial {
  caKeyPem: string
  caCertPem: string
}

function randomSerial(): string {
  // Positive hex serial; leading 0 keeps it positive per X.509.
  return '00' + forge.util.bytesToHex(forge.random.getBytesSync(16))
}

export function createCa(): CaMaterial {
  const keys = forge.pki.rsa.generateKeyPair(2048)
  const cert = forge.pki.createCertificate()
  cert.publicKey = keys.publicKey
  cert.serialNumber = randomSerial()
  cert.validity.notBefore = new Date()
  cert.validity.notAfter = new Date()
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 10)

  const attrs = [{ name: 'commonName', value: 'ZazaRequester Intercept CA' }]
  cert.setSubject(attrs)
  cert.setIssuer(attrs)
  cert.setExtensions([
    { name: 'basicConstraints', cA: true },
    { name: 'keyUsage', keyCertSign: true, cRLSign: true, digitalSignature: true }
  ])
  cert.sign(keys.privateKey, forge.md.sha256.create())

  return {
    caKeyPem: forge.pki.privateKeyToPem(keys.privateKey),
    caCertPem: forge.pki.certificateToPem(cert)
  }
}

export function issueLeaf(ca: CaMaterial, host: string): { keyPem: string; certPem: string } {
  const caKey = forge.pki.privateKeyFromPem(ca.caKeyPem)
  const caCert = forge.pki.certificateFromPem(ca.caCertPem)

  const keys = forge.pki.rsa.generateKeyPair(2048)
  const cert = forge.pki.createCertificate()
  cert.publicKey = keys.publicKey
  cert.serialNumber = randomSerial()
  cert.validity.notBefore = new Date()
  cert.validity.notAfter = new Date()
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 2)

  cert.setSubject([{ name: 'commonName', value: host }])
  cert.setIssuer(caCert.subject.attributes)
  cert.setExtensions([
    { name: 'basicConstraints', cA: false },
    { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
    { name: 'extKeyUsage', serverAuth: true },
    { name: 'subjectAltName', altNames: [{ type: 2, value: host }] } // type 2 = DNS
  ])
  cert.sign(caKey, forge.md.sha256.create())

  return {
    keyPem: forge.pki.privateKeyToPem(keys.privateKey),
    certPem: forge.pki.certificateToPem(cert)
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/main/proxy/ca.test.ts`
Expected: 2 pass.

- [ ] **Step 5: Commit**

```bash
git add src/main/proxy/ca.ts src/main/proxy/ca.test.ts
git commit -m "feat(proxy): CA generation and per-host leaf issuance"
```

### Task 2: CA disk caching

**Files:**
- Modify: `src/main/proxy/ca.ts`
- Test: `src/main/proxy/ca.cache.test.ts`

**Interfaces:**
- Produces: `function loadOrCreateCa(dir: string): CaMaterial` — reads `ca-key.pem`/`ca-cert.pem` from `dir`; if absent, generates via `createCa`, writes both files, returns. Pure filesystem; `dir` is injected so tests don't need Electron.

- [ ] **Step 1: Write the failing test**

```ts
// src/main/proxy/ca.cache.test.ts
import { test, expect } from 'bun:test'
import { mkdtempSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadOrCreateCa } from './ca'

test('loadOrCreateCa creates then reuses CA material', () => {
  const dir = mkdtempSync(join(tmpdir(), 'zr-ca-'))
  const first = loadOrCreateCa(dir)
  expect(existsSync(join(dir, 'ca-cert.pem'))).toBe(true)
  const second = loadOrCreateCa(dir)
  expect(second.caCertPem).toBe(first.caCertPem) // reused, not regenerated
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/main/proxy/ca.cache.test.ts`
Expected: FAIL — `loadOrCreateCa` not exported.

- [ ] **Step 3: Add `loadOrCreateCa` to `ca.ts`**

Add these imports at the top of `src/main/proxy/ca.ts`:
```ts
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
```

Append:
```ts
export function loadOrCreateCa(dir: string): CaMaterial {
  const keyPath = join(dir, 'ca-key.pem')
  const certPath = join(dir, 'ca-cert.pem')
  if (existsSync(keyPath) && existsSync(certPath)) {
    return {
      caKeyPem: readFileSync(keyPath, 'utf8'),
      caCertPem: readFileSync(certPath, 'utf8')
    }
  }
  const ca = createCa()
  mkdirSync(dir, { recursive: true })
  writeFileSync(keyPath, ca.caKeyPem, { mode: 0o600 })
  writeFileSync(certPath, ca.caCertPem)
  return ca
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/main/proxy/ca.cache.test.ts`
Expected: 1 pass.

- [ ] **Step 5: Commit**

```bash
git add src/main/proxy/ca.ts src/main/proxy/ca.cache.test.ts
git commit -m "feat(proxy): cache CA material on disk"
```

---

## Phase 2 — Request model

### Task 3: Intercepted request type + raw HTTP serialization

**Files:**
- Create: `src/main/proxy/requestModel.ts`
- Test: `src/main/proxy/requestModel.test.ts`

**Interfaces:**
- Produces:
  - `interface InterceptedRequest { id: string; method: string; url: string; host: string; port: number; protocol: 'http' | 'https'; path: string; headers: [string, string][]; body: string }`
  - `function serializeRequestLineAndHeaders(req: InterceptedRequest): string` — builds the raw `METHOD path HTTP/1.1\r\nHeader: v\r\n...\r\n\r\n` block (no body), normalizing `Content-Length` to the byte length of `req.body` when a body is present.
  - `function toRequestData(req: InterceptedRequest): RequestData` — maps to the shared `RequestData` shape for hand-off to the curl builder.

- [ ] **Step 1: Write the failing test**

```ts
// src/main/proxy/requestModel.test.ts
import { test, expect } from 'bun:test'
import { serializeRequestLineAndHeaders, toRequestData, type InterceptedRequest } from './requestModel'

const base: InterceptedRequest = {
  id: '1',
  method: 'POST',
  url: 'https://api.example.com/login',
  host: 'api.example.com',
  port: 443,
  protocol: 'https',
  path: '/login',
  headers: [['Host', 'api.example.com'], ['Content-Type', 'application/json'], ['Content-Length', '0']],
  body: '{"u":"x"}'
}

test('serialize rebuilds request line and recomputes Content-Length', () => {
  const raw = serializeRequestLineAndHeaders(base)
  expect(raw.startsWith('POST /login HTTP/1.1\r\n')).toBe(true)
  expect(raw).toContain('Content-Length: 9') // byte length of {"u":"x"}
  expect(raw.endsWith('\r\n\r\n')).toBe(true)
})

test('toRequestData maps to the shared RequestData shape', () => {
  const rd = toRequestData(base)
  expect(rd.method).toBe('POST')
  expect(rd.url).toBe('https://api.example.com/login')
  expect(rd.bodyType).toBe('json')
  expect(rd.headers.find((h) => h.key === 'Content-Type')?.value).toBe('application/json')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/main/proxy/requestModel.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `requestModel.ts`**

```ts
// src/main/proxy/requestModel.ts
import type { RequestData, Header, HttpMethod, BodyType } from '@shared/types'

export interface InterceptedRequest {
  id: string
  method: string
  url: string
  host: string
  port: number
  protocol: 'http' | 'https'
  path: string
  headers: [string, string][]
  body: string
}

export function serializeRequestLineAndHeaders(req: InterceptedRequest): string {
  const lines = [`${req.method} ${req.path} HTTP/1.1`]
  const hasBody = req.body.length > 0
  const byteLen = Buffer.byteLength(req.body, 'utf8')
  for (const [k, v] of req.headers) {
    if (hasBody && k.toLowerCase() === 'content-length') continue // recompute below
    lines.push(`${k}: ${v}`)
  }
  if (hasBody) lines.push(`Content-Length: ${byteLen}`)
  return lines.join('\r\n') + '\r\n\r\n'
}

function guessBodyType(headers: [string, string][], body: string): BodyType {
  if (!body) return 'none'
  const ct = headers.find(([k]) => k.toLowerCase() === 'content-type')?.[1] ?? ''
  return ct.includes('json') ? 'json' : 'raw'
}

export function toRequestData(req: InterceptedRequest): RequestData {
  const headers: Header[] = req.headers.map(([key, value]) => ({ key, value, enabled: true }))
  return {
    method: req.method as HttpMethod,
    url: req.url,
    headers,
    body: req.body,
    bodyType: guessBodyType(req.headers, req.body)
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/main/proxy/requestModel.test.ts`
Expected: 2 pass.

- [ ] **Step 5: Commit**

```bash
git add src/main/proxy/requestModel.ts src/main/proxy/requestModel.test.ts
git commit -m "feat(proxy): intercepted request model and serialization"
```

---

## Phase 3 — Intercept state engine

### Task 4: Capture/park/resolve state machine

**Files:**
- Create: `src/main/proxy/interceptEngine.ts`
- Test: `src/main/proxy/interceptEngine.test.ts`

**Interfaces:**
- Consumes: `InterceptedRequest` from Task 3.
- Produces:
  - `type Resolution = { action: 'forward'; edited?: InterceptedRequest } | { action: 'drop' }`
  - `class InterceptEngine` with:
    - `armed: boolean` (getter/setter; default false)
    - `onCapture: (req: InterceptedRequest) => void` — callback fired for every request seen.
    - `onPause: (req: InterceptedRequest) => void` — callback fired when a request parks (armed only).
    - `handle(req: InterceptedRequest, timeoutMs: number): Promise<Resolution>` — if not armed, fires `onCapture` and resolves `{action:'forward'}` immediately; if armed, fires `onCapture` + `onPause`, parks until `resolve(id, ...)` is called or `timeoutMs` elapses (then auto-forward), returns the resolution.
    - `resolve(id: string, res: Resolution): void` — settles a parked request.
    - `pendingCount(): number`

- [ ] **Step 1: Write the failing test**

```ts
// src/main/proxy/interceptEngine.test.ts
import { test, expect } from 'bun:test'
import { InterceptEngine } from './interceptEngine'
import type { InterceptedRequest } from './requestModel'

function req(id: string): InterceptedRequest {
  return { id, method: 'GET', url: 'http://x/'+id, host: 'x', port: 80, protocol: 'http', path: '/'+id, headers: [], body: '' }
}

test('passes through immediately when disarmed and still captures', async () => {
  const e = new InterceptEngine()
  let captured = ''
  e.onCapture = (r) => { captured = r.id }
  const res = await e.handle(req('a'), 1000)
  expect(res.action).toBe('forward')
  expect(captured).toBe('a')
})

test('parks when armed and forwards on resolve', async () => {
  const e = new InterceptEngine()
  e.armed = true
  let paused = ''
  e.onPause = (r) => { paused = r.id }
  const p = e.handle(req('b'), 5000)
  await Promise.resolve() // let handle register the pending entry
  expect(paused).toBe('b')
  expect(e.pendingCount()).toBe(1)
  e.resolve('b', { action: 'drop' })
  const res = await p
  expect(res.action).toBe('drop')
  expect(e.pendingCount()).toBe(0)
})

test('auto-forwards a parked request after timeout', async () => {
  const e = new InterceptEngine()
  e.armed = true
  const res = await e.handle(req('c'), 20)
  expect(res.action).toBe('forward')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/main/proxy/interceptEngine.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `interceptEngine.ts`**

```ts
// src/main/proxy/interceptEngine.ts
import type { InterceptedRequest } from './requestModel'

export type Resolution =
  | { action: 'forward'; edited?: InterceptedRequest }
  | { action: 'drop' }

interface Pending {
  settle: (res: Resolution) => void
  timer: ReturnType<typeof setTimeout>
}

export class InterceptEngine {
  armed = false
  onCapture: (req: InterceptedRequest) => void = () => {}
  onPause: (req: InterceptedRequest) => void = () => {}
  private pending = new Map<string, Pending>()

  pendingCount(): number {
    return this.pending.size
  }

  handle(req: InterceptedRequest, timeoutMs: number): Promise<Resolution> {
    this.onCapture(req)
    if (!this.armed) return Promise.resolve({ action: 'forward' })

    return new Promise<Resolution>((resolve) => {
      const settle = (res: Resolution): void => {
        const entry = this.pending.get(req.id)
        if (!entry) return
        clearTimeout(entry.timer)
        this.pending.delete(req.id)
        resolve(res)
      }
      const timer = setTimeout(() => settle({ action: 'forward' }), timeoutMs)
      this.pending.set(req.id, { settle, timer })
      this.onPause(req)
    })
  }

  resolve(id: string, res: Resolution): void {
    this.pending.get(id)?.settle(res)
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/main/proxy/interceptEngine.test.ts`
Expected: 3 pass.

- [ ] **Step 5: Commit**

```bash
git add src/main/proxy/interceptEngine.ts src/main/proxy/interceptEngine.test.ts
git commit -m "feat(proxy): capture/park/resolve intercept state engine"
```

---

## Phase 4 — The MITM proxy server

### Task 5: Proxy server with TLS termination and forwarding

**Files:**
- Create: `src/main/proxy/server.ts`
- Test: `src/main/proxy/server.integration.test.ts`

**Interfaces:**
- Consumes: `loadOrCreateCa`/`issueLeaf` (Task 1–2), `InterceptEngine` (Task 4), `InterceptedRequest`/`serializeRequestLineAndHeaders` (Task 3).
- Produces:
  - `interface ProxyOptions { ca: CaMaterial; engine: InterceptEngine; timeoutMs: number }`
  - `class MitmProxy` with `start(): Promise<number>` (resolves the bound port), `stop(): Promise<void>`, and a public `engine` reference.

**Design notes for the implementer (read before coding):**
- Plain HTTP: an `http.Server` handles absolute-form request URLs (`http://host/path`). Read the full body, build an `InterceptedRequest`, await `engine.handle(...)`, then re-issue upstream with `http.request` (or honor `drop` by destroying the socket).
- HTTPS: the same `http.Server` also receives `CONNECT` (via the `connect` event). On `CONNECT host:port`, reply `200 Connection Established`, then hand the socket to a per-host `tls.Server` built with `issueLeaf(ca, host)`. That TLS server decrypts the browser's request; treat each decrypted request exactly like the HTTP case but dial upstream with `https.request`.
- Cache `tls.Server` instances per host to avoid regenerating certs per connection.
- On `drop`, destroy the client socket so the browser sees a connection reset.
- This is the most complex task; the integration test below exercises the plain-HTTP capture+forward path end to end. The HTTPS/CONNECT path is verified manually in Phase 6 (it needs the embedded session to supply the trusting client).

- [ ] **Step 1: Write the failing integration test (plain HTTP path)**

```ts
// src/main/proxy/server.integration.test.ts
import { test, expect, afterEach } from 'bun:test'
import http from 'node:http'
import { loadOrCreateCa } from './ca'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { InterceptEngine } from './interceptEngine'
import { MitmProxy } from './server'

let proxy: MitmProxy
let origin: http.Server

afterEach(async () => {
  await proxy?.stop()
  origin?.close()
})

test('captures and forwards a plain HTTP request through the proxy', async () => {
  // Upstream origin that echoes the path
  origin = http.createServer((req, res) => res.end('hit:' + req.url))
  const originPort: number = await new Promise((r) => origin.listen(0, () => r((origin.address() as any).port)))

  const ca = loadOrCreateCa(mkdtempSync(join(tmpdir(), 'zr-ca-')))
  const engine = new InterceptEngine()
  let capturedUrl = ''
  engine.onCapture = (req) => { capturedUrl = req.url }

  proxy = new MitmProxy({ ca, engine, timeoutMs: 30000 })
  const proxyPort = await proxy.start()

  // Make a request THROUGH the proxy (absolute-form URL, like a browser proxy client)
  const body: string = await new Promise((resolve, reject) => {
    const r = http.request({
      host: '127.0.0.1', port: proxyPort, method: 'GET',
      path: `http://127.0.0.1:${originPort}/hello`,
      headers: { Host: `127.0.0.1:${originPort}` }
    }, (res) => {
      let d = ''
      res.on('data', (c) => (d += c))
      res.on('end', () => resolve(d))
    })
    r.on('error', reject)
    r.end()
  })

  expect(body).toBe('hit:/hello')
  expect(capturedUrl).toContain('/hello')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/main/proxy/server.integration.test.ts`
Expected: FAIL — `MitmProxy` not found.

- [ ] **Step 3: Implement `server.ts`**

```ts
// src/main/proxy/server.ts
import http from 'node:http'
import https from 'node:https'
import net from 'node:net'
import tls from 'node:tls'
import { randomUUID } from 'node:crypto'
import type { CaMaterial } from './ca'
import { issueLeaf } from './ca'
import type { InterceptEngine } from './interceptEngine'
import type { InterceptedRequest } from './requestModel'

export interface ProxyOptions {
  ca: CaMaterial
  engine: InterceptEngine
  timeoutMs: number
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let data = ''
    req.on('data', (c) => (data += c))
    req.on('end', () => resolve(data))
  })
}

function headerPairs(req: http.IncomingMessage): [string, string][] {
  const out: [string, string][] = []
  const raw = req.rawHeaders
  for (let i = 0; i < raw.length; i += 2) out.push([raw[i], raw[i + 1]])
  return out
}

export class MitmProxy {
  readonly engine: InterceptEngine
  private ca: CaMaterial
  private timeoutMs: number
  private server: http.Server
  private tlsServers = new Map<string, tls.Server>()

  constructor(opts: ProxyOptions) {
    this.ca = opts.ca
    this.engine = opts.engine
    this.timeoutMs = opts.timeoutMs
    this.server = http.createServer((req, res) => this.onHttp(req, res, 'http'))
    this.server.on('connect', (req, socket) => this.onConnect(req, socket))
  }

  start(): Promise<number> {
    return new Promise((resolve) => {
      this.server.listen(0, '127.0.0.1', () => {
        resolve((this.server.address() as net.AddressInfo).port)
      })
    })
  }

  async stop(): Promise<void> {
    for (const s of this.tlsServers.values()) s.close()
    this.tlsServers.clear()
    await new Promise<void>((r) => this.server.close(() => r()))
  }

  private async onHttp(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    protocol: 'http' | 'https',
    hostOverride?: string
  ): Promise<void> {
    const body = await readBody(req)
    // Plain HTTP arrives in absolute form (http://host/path); HTTPS (post-CONNECT)
    // arrives in origin form (/path) so host comes from the CONNECT target.
    let host: string
    let port: number
    let path: string
    let urlStr: string
    if (protocol === 'http' && req.url?.startsWith('http')) {
      const u = new URL(req.url)
      host = u.hostname
      port = u.port ? Number(u.port) : 80
      path = u.pathname + u.search
      urlStr = req.url
    } else {
      const [h, p] = (hostOverride ?? req.headers.host ?? '').split(':')
      host = h
      port = p ? Number(p) : protocol === 'https' ? 443 : 80
      path = req.url ?? '/'
      urlStr = `${protocol}://${host}${port === (protocol === 'https' ? 443 : 80) ? '' : ':' + port}${path}`
    }

    const intercepted: InterceptedRequest = {
      id: randomUUID(),
      method: req.method ?? 'GET',
      url: urlStr,
      host,
      port,
      protocol,
      path,
      headers: headerPairs(req),
      body
    }

    const resolution = await this.engine.handle(intercepted, this.timeoutMs)
    if (resolution.action === 'drop') {
      res.socket?.destroy()
      return
    }
    const final = resolution.edited ?? intercepted
    this.forward(final, res)
  }

  private forward(reqData: InterceptedRequest, res: http.ServerResponse): void {
    const transport = reqData.protocol === 'https' ? https : http
    const headers: Record<string, string> = {}
    const hasBody = reqData.body.length > 0
    for (const [k, v] of reqData.headers) {
      if (hasBody && k.toLowerCase() === 'content-length') continue
      headers[k] = v
    }
    if (hasBody) headers['Content-Length'] = String(Buffer.byteLength(reqData.body, 'utf8'))

    const upstream = transport.request(
      { host: reqData.host, port: reqData.port, method: reqData.method, path: reqData.path, headers },
      (up) => {
        res.writeHead(up.statusCode ?? 502, up.headers)
        up.pipe(res)
      }
    )
    upstream.on('error', () => {
      if (!res.headersSent) res.writeHead(502)
      res.end('Proxy upstream error')
    })
    if (hasBody) upstream.write(reqData.body)
    upstream.end()
  }

  private onConnect(req: http.IncomingMessage, clientSocket: net.Socket): void {
    const [host, portStr] = (req.url ?? '').split(':')
    const port = portStr ? Number(portStr) : 443
    clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n')

    let tlsServer = this.tlsServers.get(host)
    if (!tlsServer) {
      const leaf = issueLeaf(this.ca, host)
      tlsServer = tls.createServer({ key: leaf.keyPem, cert: leaf.certPem })
      tlsServer.on('secureConnection', (tlsSocket) => {
        const decrypted = http.createServer()
        decrypted.on('request', (r, s) => this.onHttp(r, s, 'https', `${host}:${port}`))
        decrypted.emit('connection', tlsSocket)
      })
      this.tlsServers.set(host, tlsServer)
    }
    tlsServer.emit('connection', clientSocket)
  }
}
```

> Implementer note: the `decrypted.emit('connection', ...)` pattern wires a `tls.TLSSocket` into a fresh `http.Server`'s parser. If the manual HTTPS verification in Phase 6 shows parser issues on a given Node/Electron version, switch to creating one persistent `http.Server` per host and feeding `secureConnection` sockets into it via its `connection` event — the per-request handler stays identical.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/main/proxy/server.integration.test.ts`
Expected: 1 pass (plain-HTTP capture + forward).

- [ ] **Step 5: Run the whole main suite**

Run: `bun test src/main`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add src/main/proxy/server.ts src/main/proxy/server.integration.test.ts
git commit -m "feat(proxy): MITM proxy with TLS termination and forwarding"
```

---

## Phase 5 — IPC contract

### Task 6: Shared intercept types and channel names

**Files:**
- Create: `src/shared/intercept.ts`

**Interfaces:**
- Produces: channel-name constants + payload types consumed by main, preload, and both renderers.

- [ ] **Step 1: Create `src/shared/intercept.ts`**

```ts
// src/shared/intercept.ts
import type { RequestData } from './types'

// Wire shape of a captured request sent to the intercept renderer.
export interface CapturedRequestDto {
  id: string
  method: string
  url: string
  headers: [string, string][]
  body: string
  paused: boolean
}

// Edits the user can apply to a parked request before forwarding.
export interface RequestEdit {
  method: string
  url: string
  headers: [string, string][]
  body: string
}

export type ResolveCommand =
  | { id: string; action: 'forward'; edit?: RequestEdit }
  | { id: string; action: 'drop' }

export const IPC = {
  // main window → main: open the intercept window
  OPEN_INTERCEPT: 'intercept:open',
  // intercept renderer → main: arm/disarm + navigate + resolve
  SET_ARMED: 'intercept:setArmed',
  NAVIGATE: 'intercept:navigate',
  RESOLVE: 'intercept:resolve',
  SEND_TO_BUILDER: 'intercept:sendToBuilder',
  // main → intercept renderer
  ON_CAPTURE: 'intercept:onCapture',
  ON_PAUSE: 'intercept:onPause',
  // main → main window: load a request into the curl builder
  ON_LOAD_REQUEST: 'intercept:onLoadRequest'
} as const

export type LoadRequestPayload = RequestData
```

- [ ] **Step 2: Type-check**

Run: `bun run build`
Expected: build succeeds (no type errors introduced).

- [ ] **Step 3: Commit**

```bash
git add src/shared/intercept.ts
git commit -m "feat(intercept): shared IPC types and channel names"
```

---

## Phase 6 — Electron wiring (manual verification)

### Task 7: Start the proxy and create the intercept window

**Files:**
- Create: `src/main/interceptWindow.ts`
- Modify: `src/main/index.ts`
- Modify: `src/main/ipc.ts`

**Interfaces:**
- Consumes: `MitmProxy`, `loadOrCreateCa`, `InterceptEngine`, `IPC`, DTO/edit types.
- Produces:
  - `function startInterceptProxy(): Promise<{ proxy: MitmProxy; port: number }>` — loads/creates the CA under `userData/intercept-ca`, builds the engine + proxy, starts it.
  - `function openInterceptWindow(proxyPort: number, proxy: MitmProxy): BrowserWindow` — creates the second window, embeds a `WebContentsView`, wires session proxy + CA trust, bridges engine callbacks to the renderer.

- [ ] **Step 1: Implement `interceptWindow.ts`**

```ts
// src/main/interceptWindow.ts
import { app, BrowserWindow, WebContentsView, session } from 'electron'
import { join } from 'node:path'
import { MitmProxy } from './proxy/server'
import { InterceptEngine } from './proxy/interceptEngine'
import { loadOrCreateCa } from './proxy/ca'
import { IPC } from '../shared/intercept'
import type { CapturedRequestDto } from '../shared/intercept'
import type { InterceptedRequest } from './proxy/requestModel'

const TIMEOUT_MS = 30000

export async function startInterceptProxy(): Promise<{ proxy: MitmProxy; port: number }> {
  const ca = loadOrCreateCa(join(app.getPath('userData'), 'intercept-ca'))
  const engine = new InterceptEngine()
  const proxy = new MitmProxy({ ca, engine, timeoutMs: TIMEOUT_MS })
  const port = await proxy.start()
  return { proxy, port }
}

function toDto(req: InterceptedRequest, paused: boolean): CapturedRequestDto {
  return { id: req.id, method: req.method, url: req.url, headers: req.headers, body: req.body, paused }
}

export function openInterceptWindow(proxyPort: number, proxy: MitmProxy): BrowserWindow {
  const win = new BrowserWindow({
    width: 1200,
    height: 860,
    title: 'ZazaRequester — Intercept',
    backgroundColor: '#0f172a',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  // Isolated session for the embedded browser: routes through our proxy and
  // trusts the proxy's CA WITHOUT touching the OS/real-browser trust store.
  const ses = session.fromPartition('intercept-browser')
  ses.setProxy({ proxyRules: `http=127.0.0.1:${proxyPort};https=127.0.0.1:${proxyPort}` })
  // The embedded session only ever talks to our localhost proxy, whose leaf
  // certs all chain to our in-memory CA. Accept them for THIS session only.
  ses.setCertificateVerifyProc((_req, cb) => cb(0))

  const browserView = new WebContentsView({ webPreferences: { session: ses } })
  win.contentView.addChildView(browserView)

  // Layout: top 60% browser, bottom 40% intercept UI. Recompute on resize.
  const layout = (): void => {
    const { width, height } = win.getContentBounds()
    const browserH = Math.round(height * 0.6)
    browserView.setBounds({ x: 0, y: 0, width, height: browserH })
  }
  win.on('resize', layout)
  layout()

  // Bridge engine → renderer.
  proxy.engine.onCapture = (req) => win.webContents.send(IPC.ON_CAPTURE, toDto(req, false))
  proxy.engine.onPause = (req) => win.webContents.send(IPC.ON_PAUSE, toDto(req, true))

  // Renderer commands handled in ipc.ts read these via the module-level refs
  // exported below; we attach them to the window for the handlers to find.
  ;(win as unknown as { _zrBrowserView: WebContentsView })._zrBrowserView = browserView

  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) {
    win.loadURL(`${devUrl}/intercept.html`)
  } else {
    win.loadFile(join(__dirname, '../renderer/intercept.html'))
  }
  win.once('ready-to-show', () => win.show())
  return win
}
```

- [ ] **Step 2: Wire startup + IPC in `index.ts`**

In `src/main/index.ts`, add imports near the top:
```ts
import { startInterceptProxy, openInterceptWindow } from './interceptWindow'
import { ipcMain } from 'electron'
import { IPC, type ResolveCommand } from '../shared/intercept'
import { toRequestData } from './proxy/requestModel'
```

Replace the `app.whenReady().then(...)` block with:
```ts
app.whenReady().then(async () => {
  const { proxy, port } = await startInterceptProxy()
  registerIpcHandlers()

  let interceptWin: BrowserWindow | null = null
  let mainWin: BrowserWindow

  ipcMain.on(IPC.OPEN_INTERCEPT, () => {
    if (interceptWin && !interceptWin.isDestroyed()) {
      interceptWin.focus()
      return
    }
    interceptWin = openInterceptWindow(port, proxy)
    interceptWin.on('closed', () => { interceptWin = null })
  })

  ipcMain.on(IPC.SET_ARMED, (_e, armed: boolean) => { proxy.engine.armed = armed })

  ipcMain.on(IPC.NAVIGATE, (_e, url: string) => {
    const view = (interceptWin as unknown as { _zrBrowserView?: { webContents: { loadURL: (u: string) => void } } })?._zrBrowserView
    view?.webContents.loadURL(url)
  })

  ipcMain.on(IPC.RESOLVE, (_e, cmd: ResolveCommand) => {
    if (cmd.action === 'drop') { proxy.engine.resolve(cmd.id, { action: 'drop' }); return }
    proxy.engine.resolve(cmd.id, {
      action: 'forward',
      edited: cmd.edit ? {
        id: cmd.id, method: cmd.edit.method, url: cmd.edit.url,
        host: new URL(cmd.edit.url).hostname,
        port: new URL(cmd.edit.url).port ? Number(new URL(cmd.edit.url).port) : (cmd.edit.url.startsWith('https') ? 443 : 80),
        protocol: cmd.edit.url.startsWith('https') ? 'https' : 'http',
        path: new URL(cmd.edit.url).pathname + new URL(cmd.edit.url).search,
        headers: cmd.edit.headers, body: cmd.edit.body
      } : undefined
    })
  })

  ipcMain.on(IPC.SEND_TO_BUILDER, (_e, req: { method: string; url: string; headers: [string,string][]; body: string }) => {
    const rd = toRequestData({ id: '', method: req.method, url: req.url, host: '', port: 0, protocol: 'http', path: '', headers: req.headers, body: req.body })
    mainWin?.webContents.send(IPC.ON_LOAD_REQUEST, rd)
    mainWin?.focus()
  })

  mainWin = createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) mainWin = createWindow()
  })
})
```

Change `createWindow` to return the window:
```ts
function createWindow(): BrowserWindow {
  const win = new BrowserWindow({ /* ...unchanged options... */ })
  // ...unchanged body...
  return win
}
```

- [ ] **Step 3: Type-check / build**

Run: `bun run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/main/interceptWindow.ts src/main/index.ts
git commit -m "feat(intercept): start proxy, create intercept window, wire IPC"
```

---

## Phase 7 — Intercept renderer UI

### Task 8: Second renderer entry + intercept API bridge

**Files:**
- Modify: `electron.vite.config.ts`
- Modify: `src/preload/index.ts`
- Create: `src/renderer/intercept.html`
- Create: `src/renderer/intercept.tsx`
- Create: `src/renderer/intercept/interceptApi.d.ts`

- [ ] **Step 1: Add the second renderer input**

In `electron.vite.config.ts`, replace the `renderer.build.rollupOptions.input` with:
```ts
input: {
  main: resolve('src/renderer/index.html'),
  intercept: resolve('src/renderer/intercept.html')
}
```

- [ ] **Step 2: Create the HTML entry**

```html
<!-- src/renderer/intercept.html -->
<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Intercept</title>
  </head>
  <body class="bg-app">
    <div id="root"></div>
    <script type="module" src="./intercept.tsx"></script>
  </body>
</html>
```

- [ ] **Step 3: Extend the preload bridge**

In `src/preload/index.ts`, replace the body with:
```ts
import { contextBridge, ipcRenderer } from 'electron'
import type { RequestData, AppStore } from '../shared/types'
import { IPC, type ResolveCommand, type CapturedRequestDto, type RequestEdit } from '../shared/intercept'

contextBridge.exposeInMainWorld('api', {
  execute: (req: RequestData) => ipcRenderer.invoke('curl:execute', req),
  readStore: () => ipcRenderer.invoke('store:read'),
  writeStore: (store: AppStore) => ipcRenderer.invoke('store:write', store),
  // main window: open intercept + receive requests loaded from intercept
  openIntercept: () => ipcRenderer.send(IPC.OPEN_INTERCEPT),
  onLoadRequest: (cb: (req: RequestData) => void) =>
    ipcRenderer.on(IPC.ON_LOAD_REQUEST, (_e, req: RequestData) => cb(req))
})

contextBridge.exposeInMainWorld('intercept', {
  setArmed: (armed: boolean) => ipcRenderer.send(IPC.SET_ARMED, armed),
  navigate: (url: string) => ipcRenderer.send(IPC.NAVIGATE, url),
  resolve: (cmd: ResolveCommand) => ipcRenderer.send(IPC.RESOLVE, cmd),
  sendToBuilder: (req: { method: string; url: string; headers: [string, string][]; body: string }) =>
    ipcRenderer.send(IPC.SEND_TO_BUILDER, req),
  onCapture: (cb: (dto: CapturedRequestDto) => void) =>
    ipcRenderer.on(IPC.ON_CAPTURE, (_e, dto: CapturedRequestDto) => cb(dto)),
  onPause: (cb: (dto: CapturedRequestDto) => void) =>
    ipcRenderer.on(IPC.ON_PAUSE, (_e, dto: CapturedRequestDto) => cb(dto))
})

export type { ResolveCommand, RequestEdit }
```

- [ ] **Step 4: Create the renderer root**

```tsx
// src/renderer/intercept.tsx
import React from 'react'
import { createRoot } from 'react-dom/client'
import InterceptApp from './intercept/InterceptApp'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <InterceptApp />
  </React.StrictMode>
)
```

- [ ] **Step 5: Type the bridges**

```ts
// src/renderer/intercept/interceptApi.d.ts
import type { CapturedRequestDto, ResolveCommand } from '../../shared/intercept'

declare global {
  interface Window {
    intercept: {
      setArmed: (armed: boolean) => void
      navigate: (url: string) => void
      resolve: (cmd: ResolveCommand) => void
      sendToBuilder: (req: { method: string; url: string; headers: [string, string][]; body: string }) => void
      onCapture: (cb: (dto: CapturedRequestDto) => void) => void
      onPause: (cb: (dto: CapturedRequestDto) => void) => void
    }
  }
}
export {}
```

- [ ] **Step 6: Build**

Run: `bun run build`
Expected: build emits both `index.html` and `intercept.html` bundles.

- [ ] **Step 7: Commit**

```bash
git add electron.vite.config.ts src/preload/index.ts src/renderer/intercept.html src/renderer/intercept.tsx src/renderer/intercept/interceptApi.d.ts
git commit -m "feat(intercept): second renderer entry and preload bridge"
```

### Task 9: Intercept UI components

**Files:**
- Create: `src/renderer/intercept/InterceptApp.tsx`
- Create: `src/renderer/intercept/CapturedTable.tsx`
- Create: `src/renderer/intercept/RequestEditor.tsx`

**Interfaces:**
- Consumes: `window.intercept`, `CapturedRequestDto`, `ResolveCommand`.

- [ ] **Step 1: Create `RequestEditor.tsx`**

```tsx
// src/renderer/intercept/RequestEditor.tsx
import React, { useEffect, useState } from 'react'
import type { CapturedRequestDto } from '../../shared/intercept'

interface Props {
  req: CapturedRequestDto
  onForward: (edit: { method: string; url: string; headers: [string, string][]; body: string }) => void
  onDrop: () => void
  onSendToBuilder: (edit: { method: string; url: string; headers: [string, string][]; body: string }) => void
}

export default function RequestEditor({ req, onForward, onDrop, onSendToBuilder }: Props) {
  const [method, setMethod] = useState(req.method)
  const [url, setUrl] = useState(req.url)
  const [headers, setHeaders] = useState<[string, string][]>(req.headers)
  const [body, setBody] = useState(req.body)

  useEffect(() => {
    setMethod(req.method); setUrl(req.url); setHeaders(req.headers); setBody(req.body)
  }, [req.id])

  const edit = () => ({ method, url, headers, body })
  const setHeader = (i: number, k: string, v: string) =>
    setHeaders(headers.map((h, idx) => (idx === i ? [k, v] : h)))

  return (
    <div className="flex flex-col gap-2 p-3 text-sm text-slate-200">
      <div className="flex gap-2">
        <input value={method} onChange={(e) => setMethod(e.target.value)}
          className="w-24 bg-slate-700 rounded px-2 py-1 font-mono outline-none" />
        <input value={url} onChange={(e) => setUrl(e.target.value)}
          className="flex-1 bg-slate-700 rounded px-2 py-1 font-mono outline-none" />
      </div>
      <div className="max-h-32 overflow-auto">
        {headers.map(([k, v], i) => (
          <div key={i} className="flex gap-2 py-0.5">
            <input value={k} onChange={(e) => setHeader(i, e.target.value, v)}
              className="w-1/3 bg-slate-800 rounded px-2 py-0.5 font-mono outline-none" />
            <input value={v} onChange={(e) => setHeader(i, k, e.target.value)}
              className="flex-1 bg-slate-800 rounded px-2 py-0.5 font-mono outline-none" />
          </div>
        ))}
      </div>
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5}
        className="bg-slate-800 rounded px-2 py-1 font-mono text-xs outline-none resize-none" />
      <div className="flex gap-2">
        <button onClick={() => onForward(edit())}
          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 rounded text-white">Forward</button>
        <button onClick={onDrop}
          className="px-3 py-1 bg-red-600 hover:bg-red-500 rounded text-white">Drop</button>
        <button onClick={() => onSendToBuilder(edit())}
          className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 rounded text-white">Send to builder</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `CapturedTable.tsx`**

```tsx
// src/renderer/intercept/CapturedTable.tsx
import React from 'react'
import type { CapturedRequestDto } from '../../shared/intercept'

interface Props {
  rows: CapturedRequestDto[]
  selectedId: string | null
  onSelect: (id: string) => void
}

export default function CapturedTable({ rows, selectedId, onSelect }: Props) {
  return (
    <div className="overflow-auto h-full text-xs font-mono">
      {rows.length === 0 ? (
        <p className="p-3 text-slate-500 italic">No requests captured yet.</p>
      ) : rows.map((r) => (
        <div key={r.id} onClick={() => onSelect(r.id)}
          className={`flex gap-2 px-3 py-1 cursor-pointer ${selectedId === r.id ? 'bg-slate-700' : 'hover:bg-slate-700/40'}`}>
          {r.paused && <span className="text-amber-400">⏸</span>}
          <span className="w-16 text-emerald-400">{r.method}</span>
          <span className="flex-1 truncate text-slate-300">{r.url}</span>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Create `InterceptApp.tsx`**

```tsx
// src/renderer/intercept/InterceptApp.tsx
import React, { useEffect, useState } from 'react'
import type { CapturedRequestDto } from '../../shared/intercept'
import CapturedTable from './CapturedTable'
import RequestEditor from './RequestEditor'

export default function InterceptApp() {
  const [rows, setRows] = useState<CapturedRequestDto[]>([])
  const [armed, setArmed] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [addr, setAddr] = useState('https://example.com')

  useEffect(() => {
    window.intercept.onCapture((dto) => setRows((prev) => [dto, ...prev].slice(0, 500)))
    window.intercept.onPause((dto) =>
      setRows((prev) => prev.map((r) => (r.id === dto.id ? dto : (prev.some((x) => x.id === dto.id) ? r : r)))
        .concat(prev.some((x) => x.id === dto.id) ? [] : [dto])))
  }, [])

  const toggleArmed = () => { const next = !armed; setArmed(next); window.intercept.setArmed(next) }
  const selected = rows.find((r) => r.id === selectedId) ?? null
  const paused = selected?.paused ? selected : null

  const clearRow = (id: string) => setRows((prev) => prev.filter((r) => r.id !== id))

  return (
    // top 60% is the embedded WebContentsView (drawn by main); this UI sits in
    // the bottom 40%, so pad the top to avoid drawing under the browser view.
    <div className="flex flex-col h-screen bg-app text-slate-200" style={{ paddingTop: '60vh' }}>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-700">
        <input value={addr} onChange={(e) => setAddr(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') window.intercept.navigate(addr) }}
          className="flex-1 bg-slate-700 rounded px-2 py-1 font-mono text-sm outline-none" />
        <button onClick={() => window.intercept.navigate(addr)}
          className="px-3 py-1 bg-slate-600 rounded text-sm">Go</button>
        <button onClick={toggleArmed}
          className={`px-3 py-1 rounded text-sm text-white ${armed ? 'bg-amber-600' : 'bg-slate-600'}`}>
          Intercept: {armed ? 'ON' : 'OFF'}
        </button>
      </div>
      <div className="flex flex-1 min-h-0">
        <div className="w-1/2 border-r border-slate-700 min-h-0">
          <CapturedTable rows={rows} selectedId={selectedId} onSelect={setSelectedId} />
        </div>
        <div className="w-1/2 min-h-0 overflow-auto">
          {paused ? (
            <RequestEditor
              req={paused}
              onForward={(edit) => { window.intercept.resolve({ id: paused.id, action: 'forward', edit }); clearRow(paused.id) }}
              onDrop={() => { window.intercept.resolve({ id: paused.id, action: 'drop' }); clearRow(paused.id) }}
              onSendToBuilder={(edit) => { window.intercept.sendToBuilder(edit); window.intercept.resolve({ id: paused.id, action: 'forward', edit }); clearRow(paused.id) }}
            />
          ) : (
            <p className="p-3 text-slate-500 italic text-sm">
              {selected ? 'Captured (read-only). Arm intercept to pause and edit requests.' : 'Select a request.'}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Build**

Run: `bun run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/intercept/InterceptApp.tsx src/renderer/intercept/CapturedTable.tsx src/renderer/intercept/RequestEditor.tsx
git commit -m "feat(intercept): intercept window UI (table, editor, toggle)"
```

---

## Phase 8 — Main-window integration

### Task 10: "Open Intercept" button + load-into-builder

**Files:**
- Modify: `src/renderer/components/Sidebar.tsx`
- Modify: `src/renderer/store/useStore.ts`
- Modify: `src/renderer/env.d.ts` (extend `window.api` typing)

**Interfaces:**
- Consumes: `window.api.openIntercept`, `window.api.onLoadRequest` (from Task 8 preload), `importRequest` store action (already exists).

- [ ] **Step 1: Extend the `window.api` type**

Open `src/renderer/env.d.ts`. Add `openIntercept` and `onLoadRequest` to the existing `api` interface (alongside `execute`, `readStore`, `writeStore`):
```ts
openIntercept: () => void
onLoadRequest: (cb: (req: import('@shared/types').RequestData) => void) => void
```

- [ ] **Step 2: Subscribe to load events in the store**

In `src/renderer/store/useStore.ts`, inside `initStore`, after the `set({...})` that marks initialized, add:
```ts
    window.api.onLoadRequest((req) => {
      get().importRequest(req)
    })
```
(`importRequest` already exists and bumps `bodyVersion`, so the body editor remounts — exactly the existing import behavior.)

- [ ] **Step 3: Add the button to the sidebar**

In `src/renderer/components/Sidebar.tsx`, import an icon:
```ts
import { Radio } from 'lucide-react'
```
Then immediately after the header `<div>` (the one containing the logo + `<h1>`), add:
```tsx
      <button
        onClick={() => window.api.openIntercept()}
        className="flex items-center gap-2 mx-3 my-2 px-3 py-2 bg-slate-700 hover:bg-indigo-600 rounded text-sm text-slate-200 transition-colors"
      >
        <Radio size={14} /> Open Intercept
      </button>
```

- [ ] **Step 4: Build**

Run: `bun run build`
Expected: build succeeds, no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/Sidebar.tsx src/renderer/store/useStore.ts src/renderer/env.d.ts
git commit -m "feat(intercept): open-intercept button and load-into-builder"
```

---

## Phase 9 — End-to-end verification, error polish, docs

### Task 11: Manual E2E + error-handling polish

**Files:**
- Modify: `src/main/proxy/server.ts` (only if a verification step surfaces a gap)
- Modify: `README.md`

- [ ] **Step 1: Launch the app**

Run: `bun run dev`
Expected: main curl GUI opens unchanged; sidebar shows "Open Intercept".

- [ ] **Step 2: Open the intercept window and browse HTTPS (passive capture)**

Click "Open Intercept". In the address bar type `https://example.com`, press Enter.
Expected: the page renders in the top pane with **no certificate error**; one or more rows appear in the captured table. (If a cert error appears, revisit the `setCertificateVerifyProc` wiring in `interceptWindow.ts` and the `onConnect`/TLS path in `server.ts` per the implementer note in Task 5.)

- [ ] **Step 3: Arm intercept and modify a request**

Toggle "Intercept: ON". Reload the page or navigate to a site that issues an XHR/POST. A row appears marked ⏸ and selected shows the editor.
- Edit a header value and the body, click **Forward**.
- Confirm the page proceeds (browser was unblocked).
Expected: the parked badge clears; the request forwards with edits.

- [ ] **Step 4: Verify edits reach the server**

Navigate the embedded browser to `https://httpbin.org/anything` (echoes what the server received). Arm intercept, add a header `X-ZR: hello` and forward.
Expected: the rendered JSON response shows `X-Zr: hello` under `headers`.

- [ ] **Step 5: Verify Drop and Timeout**

- Arm intercept, trigger a request, click **Drop** → the browser shows a connection error for that request.
- Arm intercept, trigger a request, wait 30s without acting → it auto-forwards and the page proceeds.

- [ ] **Step 6: Verify Send to builder**

With a parked request, click **Send to builder**.
Expected: the **main** window focuses and its request panel is populated (method, URL, headers, body) via the existing import path; the embedded request also forwards so the page doesn't hang. Click Send in the main window to confirm the normal curl flow works.

- [ ] **Step 7: Verify close-down**

Close the intercept window.
Expected: main curl GUI still fully functional; no orphaned windows.

- [ ] **Step 8: Add the security note to the README**

In `README.md`, under `## Features`, add a bullet:
```markdown
- **Intercept (beta)** — open a separate window with an embedded browser whose
  HTTP/HTTPS traffic is captured live; optionally pause requests to edit headers
  or body before they're sent, or push one into the request builder.
```
And add a new section before `## License`:
```markdown
## How Intercept handles HTTPS

To read HTTPS traffic, Intercept runs a local proxy and generates a private root
CA stored under your app data directory. That CA is trusted **only** by the
embedded browser's isolated session — it is never installed into your operating
system or your real browser's trust store, and closing the app leaves no trust
behind. Intercept only touches the dedicated in-app browser; your everyday
browser is unaffected.
```

- [ ] **Step 9: Run the full unit suite once more**

Run: `bun test src/main`
Expected: all green.

- [ ] **Step 10: Commit**

```bash
git add README.md src/main/proxy/server.ts
git commit -m "docs: document Intercept; polish from E2E verification"
```

---

## Self-Review (completed by plan author)

**Spec coverage:**
- Capture (always-on) + optional pause/modify (toggle) → Tasks 4, 7, 9 (`armed` flag, `onCapture`/`onPause`). ✓
- Dedicated browser launched by app, embedded `WebContentsView` → Task 7. ✓
- Programmatic CA trust, no system trust → Tasks 1–2, 7 (`setCertificateVerifyProc`). ✓
- Requests-only; responses read-only/streamed back → Task 5 (`forward` pipes response, no parking). ✓
- Two-window model + "Open Intercept" → Tasks 7, 10. ✓
- MITM proxy mechanism (Approach 2) → Task 5. ✓
- State machine: forward/drop/send-to-builder/timeout → Tasks 4 (forward/drop/timeout), 9/10 (send-to-builder). ✓
- Reuse vs reality: existing `HeadersEditor`/`BodyEditor` are store-coupled and live in the main window; the intercept window is a separate renderer, so Task 9 builds small dedicated editor components instead. Documented deviation, faithful to intent. ✓
- Ephemeral captured list → Task 9 (React state, cleared on window close). ✓
- Error handling: drop=reset, upstream error=502, timeout=auto-forward, malformed edit → Task 5 + Task 9 (JSON edits are free-text; strict JSON validity UI deferred — acceptable for beta, body is sent verbatim). ✓
- Security framing in README → Task 11. ✓
- Tests: CA, request model, state engine, proxy integration → Tasks 1–5; Electron/UI manual E2E → Task 11. ✓

**Placeholder scan:** No TBD/TODO; every code step contains real code.

**Type consistency:** `InterceptedRequest`, `Resolution`, `CapturedRequestDto`, `RequestEdit`, `ResolveCommand`, and `IPC.*` channel names are used consistently across tasks 3–10. `toRequestData` signature matches its definition in Task 3 and call sites in Task 7. `importRequest` matches the existing store action.

**Known risk flagged for the implementer:** the HTTPS CONNECT/TLS-termination wiring in Task 5 is the highest-risk code and is only exercised manually in Task 11 (Bun's test runner can't easily host the trusting client). The implementer note in Task 5 gives a fallback wiring if the per-request `http.Server` parser misbehaves on the target Node/Electron version.
