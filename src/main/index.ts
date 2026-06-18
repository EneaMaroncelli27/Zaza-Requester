import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import icon from '../../resources/icon.png?asset'
import { registerIpcHandlers } from './ipc'

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
    icon,
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
