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

  // Give the embedded browser a real starting page so the top pane isn't blank
  // on open. Matches the address-bar default in the intercept UI.
  browserView.webContents.loadURL('https://example.com')

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
