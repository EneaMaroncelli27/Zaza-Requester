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

// Build the embedded browser view for the intercept page and wire the proxy
// engine to the host window's renderer. The view is created once and toggled
// (shown/hidden) by the main process as the single window switches between the
// builder and intercept pages — it no longer owns a window of its own.
export function createInterceptView(
  win: BrowserWindow,
  proxyPort: number,
  proxy: MitmProxy
): WebContentsView {
  // Isolated session for the embedded browser: routes through our proxy and
  // trusts the proxy's CA WITHOUT touching the OS/real-browser trust store.
  const ses = session.fromPartition('intercept-browser')
  ses.setProxy({ proxyRules: `http=127.0.0.1:${proxyPort};https=127.0.0.1:${proxyPort}` })
  // The embedded session only ever talks to our localhost proxy, whose leaf
  // certs all chain to our in-memory CA. Accept them for THIS session only.
  ses.setCertificateVerifyProc((_req, cb) => cb(0))

  const browserView = new WebContentsView({ webPreferences: { session: ses } })

  // Give the embedded browser a real starting page so the top pane isn't blank
  // on first show. Matches the address-bar default in the intercept UI.
  browserView.webContents.loadURL('https://example.com')

  // Bridge engine → host renderer (now the single main window).
  proxy.engine.onCapture = (req) => win.webContents.send(IPC.ON_CAPTURE, toDto(req, false))
  proxy.engine.onPause = (req) => win.webContents.send(IPC.ON_PAUSE, toDto(req, true))

  return browserView
}
