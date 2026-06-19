# Browser HTTP Interception — Design Spec

**Date:** 2026-06-18
**Status:** Approved (design), pending implementation plan
**Project:** ZazaRequester (Electron + React + TypeScript curl GUI)

## Problem

ZazaRequester is a curl GUI: compose a request, send it via the system `curl`
binary, inspect the response. Today the only way to get a real-world request
into the tool is the manual "Import cURL" paste from a browser's Network tab.

We want to capture the HTTP requests a browser actually makes — live — and
optionally pause and modify them in-flight before they leave, then hand any
captured request to the existing curl builder for replay. A Burp-style intercept
proxy, scoped to a dedicated in-app browser, surfaced in its own window.

## Vision

A second app window holds an embedded browser plus an intercept panel. Every
request the embedded browser fires streams into a live list (passive capture,
always on). A global `Intercept` toggle, when armed, parks each outgoing request
so the user can edit its method, URL, headers, or body, then forward, drop, or
send it to the curl builder. The user's real everyday browser and OS trust store
are never touched. Default users who only want the curl GUI see one new button
("Open Intercept") and can ignore the entire feature.

## Out of Scope (v1)

- Intercepting the user's **real** browser (Chrome/Firefox) or OS proxy/trust.
- **Response** modification — responses are captured read-only; only requests
  are pausable/editable.
- WebSocket / HTTP2-specific intercept semantics beyond what the proxy passes
  through.
- A new persistence layer for captured traffic — persistence happens only via
  "Send to builder" → the existing save/history/projects flow.
- Replaying captured traffic in bulk, scripting, or match/replace rules.

## Principles

- **Additive.** Today's curl GUI code path stays untouched; intercept is a
  parallel pipeline, not a rewrite of `curl.ts`.
- **Reuse.** The intercept UI reuses existing components (`HeadersEditor`,
  `BodyEditor`, `methodTheme`, `buildCurlCommand`, `curlParser`).
- **Self-contained & install-free.** No system CA install, no OS proxy config.
  The CA is trusted by only the embedded Electron session.
- **Never hang the browser silently.** Drops return a clean reset; parked
  requests auto-forward on timeout; errors surface as rows, not freezes.

## Constraints

- Electron 32, electron-vite, React 18, TypeScript, Tailwind, Zustand,
  CodeMirror 6. Bun as package manager.
- Main-process proxy must run on a random free localhost port.
- CA material stored under Electron `userData`, generated once and cached.

## Goal

Add a "C + A + requests-only" intercept feature: passive capture of all embedded
browser traffic, with an optional armed mode that pauses outgoing requests for
header/body modification, drop, or hand-off to the curl builder — delivered in a
separate window that leaves the existing app and the user's system untouched.

## Decisions (from brainstorming)

1. **Behavior = C:** both passive capture (always) and optional active
   intercept (pause + modify), via a global toggle.
2. **Browser scope = B:** a dedicated browser the app launches, not the user's
   real browser.
3. **Browser engine = A:** an embedded Electron `WebContentsView`, not an
   external Chrome/Firefox. Enables programmatic CA trust via
   `setCertificateVerifyProc` — no system cert install.
4. **Intercept scope = requests only.** Responses captured read-only.
5. **Window model = A:** two windows. Main app unchanged; "Open Intercept"
   launches a second window holding the embedded browser + intercept panel.
6. **Mechanism = Approach 2:** a local MITM proxy in the main process. The only
   option that captures and modifies full request bodies. (`webRequest`-only
   rejected — cannot modify request bodies. Hybrid rejected — premature.)

## Architecture & Components

All new pieces are additive.

### Main process (`src/main/`)
- **`proxy/server.ts`** — local HTTP/HTTPS MITM proxy on a random localhost
  port. Accepts `CONNECT`, terminates TLS with a per-host leaf cert signed by
  our CA, parses the full request (method, url, headers, body), forwards
  upstream, streams the response back.
- **`proxy/ca.ts`** — generates a root CA keypair once, caches it under
  `userData`. Issues per-host leaf certs on demand.
- **`proxy/intercept.ts`** — the queue/state engine. Holds paused requests,
  exposes resolve / modify / drop, bridges proxy ↔ renderer over IPC.
- **`interceptWindow.ts`** — creates the second `BrowserWindow`: a
  `WebContentsView` (embedded browser) on top, the intercept-UI React app
  below. The embedded view's `session` gets `setProxy(ourPort)` +
  `setCertificateVerifyProc(trust our CA)`.

### Renderer (`src/renderer/`)
- **`intercept/InterceptApp.tsx`** — root for the second window: address bar +
  captured-request table + pause toggle + the modify editor (reusing
  `HeadersEditor`, `BodyEditor`).
- **`Sidebar.tsx`** — gains one new control: an **"Open Intercept"** button.

### IPC (`src/preload`, `src/main/ipc.ts`)
New channels:
- `intercept:capture` (proxy → UI) — a new request was seen.
- `intercept:pause` (proxy → UI) — a request is parked, waiting.
- `intercept:resolve` (UI → proxy) — forward / modify+forward / drop.
- `intercept:toBuilder` (UI → main window) — load a captured request into the
  curl builder.

## Data Flow

**Capture:** browser → proxy → emit `intercept:capture` → append to live table →
forward upstream → response streamed back to browser (read-only copy shown).

**Modify:** if pause armed → proxy parks the request, emits `intercept:pause` →
UI shows it in the editor → user edits / forwards → `intercept:resolve` → proxy
rebuilds the raw request from edited fields and sends.

## Intercept Lifecycle & Pause State Machine

**Global toggle:** `Intercept: OFF | ON`.
- **OFF:** proxy still runs and captures everything passively — requests stream
  into the table, never parked.
- **ON:** every outgoing request parks until the user acts.

Per-request state:

```
   browser fires request
            │
            ▼
      [CAPTURED]  ──(intercept OFF)──> forward upstream ──> [DONE]
            │
       (intercept ON)
            ▼
       [PAUSED] ── user edits method/URL/headers/body (optional)
            │
   ┌────────┼─────────┐
   ▼        ▼         ▼
[FORWARD] [DROP]   [SEND TO BUILDER]
   │        │         │
 upstream  killed   hands request to main window's curl panel,
   │        │       then auto-forwards (browser keeps working)
   ▼        ▼
 [DONE]   [DONE]
```

**Rules:**
- Parked requests queue in order; the table shows a badge count of how many wait.
- Each paused row offers: `Forward` (as-is or as-edited), `Drop` (kill it —
  browser gets a connection error), `Send to builder` (copy into curl GUI, then
  forward so the page does not hang).
- **Timeout guard:** a parked request auto-forwards after N seconds (default 30,
  configurable), marked "auto-forwarded (timeout)".
- Editing is bounded to method, URL, headers, body. The proxy rebuilds the raw
  request from edited fields; nothing is re-signed.
- Responses are never parked — they stream straight back; a read-only copy is
  shown next to the request.

## Integration With Existing App

- Reuse `HeadersEditor`, `BodyEditor`, `methodTheme`, `buildCurlCommand`,
  `curlParser` as-is.
- `intercept:toBuilder` maps a captured request → the existing request store
  shape in `useStore.ts`, loads it in the main window, and switches focus there.
  The current Send / Save / history / projects flow then takes over unchanged.
- The captured list is **ephemeral per intercept session** (cleared when the
  window closes). Persistence = "Send to builder" → existing save/projects.
- Existing `curl.ts` send path untouched.

## Error Handling

- CA generation fails / port busy → intercept window opens with a clear banner,
  proxy disabled, rest of the app fine.
- Upstream connection error (DNS, refused, TLS) → failed row in the table +
  error shown; the browser gets a real error, not a hang.
- Dropped request → browser receives a clean connection reset.
- Parked-request timeout (30s) → auto-forward + row marked accordingly.
- Malformed edit (e.g. broken JSON body) → block Forward, show validity inline
  (reusing `BodyEditor`'s JSON validity).
- Proxy crash → embedded browser shows network errors; main curl GUI unaffected.

## Security Framing

The root CA lives only in Electron `userData`, is trusted by **only** the
embedded session via `setCertificateVerifyProc`, and never enters the OS or
real-browser trust store. Closing the app leaves no lingering trust. The README
gets a short note explaining what the CA is and why it exists.

## Test Strategy

- **Proxy unit tests:** parse/rebuild round-trip (headers + body preserved),
  `CONNECT`/TLS terminate, drop = reset, timeout = forward.
- **CA tests:** leaf issued per host, chains to root, embedded session accepts.
- **Intercept-state tests:** OFF passes through; ON parks; forward / drop /
  timeout transitions behave.
- **Manual E2E:** browse an HTTPS site in the embedded window → confirm capture;
  arm intercept, edit a header + JSON body, forward → verify upstream received
  the edit; "Send to builder" → lands in the curl panel.

## Verification

The feature is done when: (1) browsing in the embedded window populates the
captured list over HTTPS with no cert errors and no system trust changes;
(2) arming intercept parks requests and edits to headers/body reach the upstream
server verbatim; (3) drop, forward, and timeout all behave per the state
machine; (4) "Send to builder" loads a captured request into the existing curl
panel and the normal send/save flow works; (5) closing the intercept window
returns the app to its current behavior with nothing left running or trusted.
