import { app, BrowserWindow, nativeImage, shell, ipcMain } from 'electron'
import { join } from 'path'
import iconPath from '../../resources/icon.png?asset'
import { registerIpcHandlers } from './ipc'
import { startInterceptProxy, openInterceptWindow } from './interceptWindow'
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
  win.once('ready-to-show', () => {
    win.show()
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

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
