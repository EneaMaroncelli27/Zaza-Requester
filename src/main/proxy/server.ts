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
import { isNoiseRequest } from './noiseHosts'

export interface ProxyOptions {
  ca: CaMaterial
  engine: InterceptEngine
  timeoutMs: number
}

// Fix #2: reject on stream error so callers get a clean rejection
function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (c) => (data += c))
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}

function headerPairs(req: http.IncomingMessage): [string, string][] {
  const out: [string, string][] = []
  const raw = req.rawHeaders
  for (let i = 0; i < raw.length; i += 2) out.push([raw[i], raw[i + 1]])
  return out
}

// Only pause (block for editing) the requests worth modifying: top-level
// navigations and XHR/fetch. Static subresources (script/style/image/font/...)
// are still captured but auto-forwarded so pages render. Chromium sends
// Sec-Fetch-Dest on every request; absent (non-browser clients) -> pausable.
function isPausable(req: http.IncomingMessage): boolean {
  const dest = (req.headers['sec-fetch-dest'] as string | undefined)?.toLowerCase()
  if (!dest) return true
  return dest === 'document' || dest === 'iframe' || dest === 'frame' || dest === 'empty'
}

export class MitmProxy {
  readonly engine: InterceptEngine
  private ca: CaMaterial
  private timeoutMs: number
  private server: http.Server
  private tlsServers = new Map<string, tls.Server>()
  // Fix #3: one persistent http parser per host, tracked for clean shutdown
  private parsers = new Map<string, http.Server>()

  constructor(opts: ProxyOptions) {
    this.ca = opts.ca
    this.engine = opts.engine
    this.timeoutMs = opts.timeoutMs
    // Fix #6: wrap onHttp promise so unhandled rejections never escape
    this.server = http.createServer((req, res) =>
      this.onHttp(req, res, 'http').catch(() => {
        if (!res.headersSent) res.writeHead(502)
        res.end('Proxy error')
      })
    )
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
    // Fix #1: await all TLS server closures AND all per-host parser closures
    await Promise.all([
      ...Array.from(this.tlsServers.values()).map(
        (s) => new Promise<void>((r) => s.close(() => r()))
      ),
      ...Array.from(this.parsers.values()).map(
        (s) => new Promise<void>((r) => s.close(() => r()))
      ),
      new Promise<void>((r) => this.server.close(() => r()))
    ])
    this.tlsServers.clear()
    this.parsers.clear()
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

    // Analytics/telemetry noise: forward silently — never captured, never
    // paused — so pages still load but the table stays signal.
    if (isNoiseRequest(host, path)) {
      this.forward(intercepted, res)
      return
    }

    const resolution = await this.engine.handle(intercepted, this.timeoutMs, isPausable(req))
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
      // Fix #5: strip content-length unconditionally; recompute only when hasBody
      if (k.toLowerCase() === 'content-length') continue
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

    // Fix #7: issue cert before sending 200; destroy socket on failure
    let tlsServer = this.tlsServers.get(host)
    if (!tlsServer) {
      let leaf
      try {
        leaf = issueLeaf(this.ca, host)
      } catch {
        clientSocket.destroy()
        return
      }
      tlsServer = tls.createServer({ key: leaf.keyPem, cert: leaf.certPem })
      this.tlsServers.set(host, tlsServer)

      // Fix #3: one persistent http parser per host, reused across connections
      const parser = http.createServer()
      parser.on('request', (r, s) =>
        // Fix #6: wrap per-host parser handler too
        this.onHttp(r, s, 'https', `${host}:${port}`).catch(() => {
          if (!s.headersSent) s.writeHead(502)
          s.end('Proxy error')
        })
      )
      this.parsers.set(host, parser)

      tlsServer.on('secureConnection', (tlsSocket) => {
        parser.emit('connection', tlsSocket)
      })
    }

    clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n')
    tlsServer.emit('connection', clientSocket)
  }
}
