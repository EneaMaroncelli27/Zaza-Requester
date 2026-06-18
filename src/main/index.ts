import { app, BrowserWindow, nativeImage, shell } from 'electron'
import { join } from 'path'
import iconPath from '../../resources/icon.png?asset'
import { registerIpcHandlers } from './ipc'

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

function createWindow(): void {
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
}

app.whenReady().then(() => {
  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
