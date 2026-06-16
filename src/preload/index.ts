import { contextBridge, ipcRenderer } from 'electron'
import type { RequestData, AppStore } from '../shared/types'

contextBridge.exposeInMainWorld('api', {
  execute: (req: RequestData) => ipcRenderer.invoke('curl:execute', req),
  readStore: () => ipcRenderer.invoke('store:read'),
  writeStore: (store: AppStore) => ipcRenderer.invoke('store:write', store)
})
