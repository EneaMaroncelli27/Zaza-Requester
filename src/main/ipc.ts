import { ipcMain } from 'electron'
import { executeCurl } from './curl'
import { readStore, writeStore } from './store'
import type { RequestData, AppStore } from '../shared/types'

export function registerIpcHandlers(): void {
  ipcMain.handle('curl:execute', async (_event, req: RequestData) => {
    return executeCurl(req)
  })

  ipcMain.handle('store:read', async () => {
    return readStore()
  })

  ipcMain.handle('store:write', async (_event, store: AppStore) => {
    writeStore(store)
  })
}
