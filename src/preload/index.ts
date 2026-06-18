import { contextBridge, ipcRenderer } from 'electron'
import type { RequestData, AppStore } from '../shared/types'
import { IPC, type ResolveCommand, type CapturedRequestDto, type RequestEdit } from '../shared/intercept'

contextBridge.exposeInMainWorld('api', {
  execute: (req: RequestData) => ipcRenderer.invoke('curl:execute', req),
  readStore: () => ipcRenderer.invoke('store:read'),
  writeStore: (store: AppStore) => ipcRenderer.invoke('store:write', store),
  // main window: open intercept + receive requests loaded from intercept
  openIntercept: () => ipcRenderer.send(IPC.OPEN_INTERCEPT),
  onLoadRequest: (cb: (req: RequestData) => void) =>
    ipcRenderer.on(IPC.ON_LOAD_REQUEST, (_e, req: RequestData) => cb(req))
})

contextBridge.exposeInMainWorld('intercept', {
  setArmed: (armed: boolean) => ipcRenderer.send(IPC.SET_ARMED, armed),
  navigate: (url: string) => ipcRenderer.send(IPC.NAVIGATE, url),
  resolve: (cmd: ResolveCommand) => ipcRenderer.send(IPC.RESOLVE, cmd),
  sendToBuilder: (req: { method: string; url: string; headers: [string, string][]; body: string }) =>
    ipcRenderer.send(IPC.SEND_TO_BUILDER, req),
  onCapture: (cb: (dto: CapturedRequestDto) => void) =>
    ipcRenderer.on(IPC.ON_CAPTURE, (_e, dto: CapturedRequestDto) => cb(dto)),
  onPause: (cb: (dto: CapturedRequestDto) => void) =>
    ipcRenderer.on(IPC.ON_PAUSE, (_e, dto: CapturedRequestDto) => cb(dto))
})

export type { ResolveCommand, RequestEdit }
