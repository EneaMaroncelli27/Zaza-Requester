import { app, BrowserWindow, WebContentsView, nativeImage, shell, ipcMain, screen } from 'electron'
import { join } from 'path'
import iconPath from '../../resources/icon.png?asset'
import { registerIpcHandlers } from './ipc'
import { startInterceptProxy, createInterceptView } from './interceptWindow'
import { IPC, type ResolveCommand } from '../shared/intercept'
import { toRequestData } from './proxy/requestModel'

// Load the window icon as a nativeImage. On Linux X11 a bare string path from
// inside the asar archive does not reliably populate _NET_WM_ICON, so we
// decode the bytes ourselves and hand Electron a real image.
const appIcon = nativeImage.createFromPath(iconPath)

// Fixes black/blank window on many Linux GPU/compositor setups.
// Must be called before app is ready.
app.disableHardwareAcceleration()

// Optional CDP remote-debugging port for automated verification. Off unless
// ZR_DEBUG_PORT is set, so production builds are never affected.
if (process.env['ZR_DEBUG_PORT']) {
  app.commandLine.appendSwitch('remote-debugging-port', process.env['ZR_DEBUG_PORT'])
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'ZazaRequester',
    icon: appIcon,
    backgroundColor: '#0f172a',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      // Enables the <webview> tag used by the response HTML preview to render
      // real pages (runs their JS, loads chunks, bypasses X-Frame-Options).
      webviewTag: true
    }
  })

  // Belt-and-suspenders for Linux: also set the icon explicitly after the
  // window exists, in case the constructor option is ignored on this platform.
  if (process.platform === 'linux' && !appIcon.isEmpty()) win.setIcon(appIcon)

  // Show only once the renderer has painted — avoids a blank/black flash.
  // Open maximized so the app always fills the screen on launch. On Linux the
  // WM frequently ignores maximize() issued before the window is mapped, so we
  // show first and then maximize.
  win.once('ready-to-show', () => {
    win.show()
    win.maximize()
    // Some Linux WMs ignore maximize(); fall back to filling the display's work
    // area directly so the app reliably opens at full size.
    const { workArea } = screen.getPrimaryDisplay()
    if (win.getBounds().width < workArea.width) win.setBounds(workArea)
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) {
    win.loadURL(devUrl)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
  return win
}

app.whenReady().then(async () => {
  const { proxy, port } = await startInterceptProxy()
  registerIpcHandlers()

  let mainWin: BrowserWindow
  // The embedded intercept browser. Created lazily on first intercept open, then
  // toggled in/out of the single window as the user switches pages.
  let interceptView: WebContentsView | null = null
  let interceptVisible = false

  // Position the intercept browser over the top 60% of the window; the bottom
  // 40% is the intercept React UI (which pads its top to match).
  const layoutInterceptView = (): void => {
    if (!interceptView || !interceptVisible) return
    const { width, height } = mainWin.getContentBounds()
    interceptView.setBounds({ x: 0, y: 0, width, height: Math.round(height * 0.6) })
  }

  ipcMain.on(IPC.SHOW_INTERCEPT, () => {
    if (!interceptView) interceptView = createInterceptView(mainWin, port, proxy)
    if (!interceptVisible) {
      mainWin.contentView.addChildView(interceptView)
      interceptVisible = true
    }
    layoutInterceptView()
  })

  ipcMain.on(IPC.SHOW_BUILDER, () => {
    if (interceptView && interceptVisible) {
      mainWin.contentView.removeChildView(interceptView)
      interceptVisible = false
    }
  })

  ipcMain.on(IPC.SET_ARMED, (_e, armed: boolean) => { proxy.engine.armed = armed })

  ipcMain.on(IPC.NAVIGATE, (_e, url: string) => {
    interceptView?.webContents.loadURL(url)
  })

  ipcMain.on(IPC.RESOLVE, (_e, cmd: ResolveCommand) => {
    if (cmd.action === 'drop') { proxy.engine.resolve(cmd.id, { action: 'drop' }); return }
    if (!cmd.edit) { proxy.engine.resolve(cmd.id, { action: 'forward' }); return }
    let u: URL
    try {
      u = new URL(cmd.edit.url)
    } catch {
      proxy.engine.resolve(cmd.id, { action: 'drop' })
      return
    }
    proxy.engine.resolve(cmd.id, {
      action: 'forward',
      edited: {
        id: cmd.id,
        method: cmd.edit.method,
        url: cmd.edit.url,
        host: u.hostname,
        port: u.port ? Number(u.port) : (u.protocol === 'https:' ? 443 : 80),
        protocol: u.protocol === 'https:' ? 'https' : 'http',
        path: u.pathname + u.search,
        headers: cmd.edit.headers,
        body: cmd.edit.body
      }
    })
  })

  ipcMain.on(IPC.SEND_TO_BUILDER, (_e, req: { method: string; url: string; headers: [string,string][]; body: string }) => {
    const rd = toRequestData({ id: '', method: req.method, url: req.url, host: '', port: 0, protocol: 'http', path: '', headers: req.headers, body: req.body })
    // Same window now — the renderer switches itself back to the builder view.
    mainWin?.webContents.send(IPC.ON_LOAD_REQUEST, rd)
  })

  mainWin = createWindow()
  mainWin.on('resize', layoutInterceptView)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) mainWin = createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
