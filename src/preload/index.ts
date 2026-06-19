import { contextBridge, ipcRenderer } from 'electron'
import type { RequestData, AppStore } from '../shared/types'
import { IPC, type ResolveCommand, type CapturedRequestDto, type RequestEdit } from '../shared/intercept'

contextBridge.exposeInMainWorld('api', {
  execute: (req: RequestData) => ipcRenderer.invoke('curl:execute', req),
  readStore: () => ipcRenderer.invoke('store:read'),
  writeStore: (store: AppStore) => ipcRenderer.invoke('store:write', store),
  // single-window view switching: show the intercept overlay or hide it (back
  // to the builder). Listener registrars return a disposer so subscribers can
  // clean up and avoid duplicate handlers (e.g. React StrictMode double-invoke).
  showIntercept: () => ipcRenderer.send(IPC.SHOW_INTERCEPT),
  showBuilder: () => ipcRenderer.send(IPC.SHOW_BUILDER),
  onLoadRequest: (cb: (req: RequestData) => void) => {
    const handler = (_e: unknown, req: RequestData): void => cb(req)
    ipcRenderer.on(IPC.ON_LOAD_REQUEST, handler)
    return () => ipcRenderer.removeListener(IPC.ON_LOAD_REQUEST, handler)
  }
})

contextBridge.exposeInMainWorld('intercept', {
  setArmed: (armed: boolean) => ipcRenderer.send(IPC.SET_ARMED, armed),
  navigate: (url: string) => ipcRenderer.send(IPC.NAVIGATE, url),
  resolve: (cmd: ResolveCommand) => ipcRenderer.send(IPC.RESOLVE, cmd),
  sendToBuilder: (req: { method: string; url: string; headers: [string, string][]; body: string }) =>
    ipcRenderer.send(IPC.SEND_TO_BUILDER, req),
  onCapture: (cb: (dto: CapturedRequestDto) => void) => {
    const handler = (_e: unknown, dto: CapturedRequestDto): void => cb(dto)
    ipcRenderer.on(IPC.ON_CAPTURE, handler)
    return () => ipcRenderer.removeListener(IPC.ON_CAPTURE, handler)
  },
  onPause: (cb: (dto: CapturedRequestDto) => void) => {
    const handler = (_e: unknown, dto: CapturedRequestDto): void => cb(dto)
    ipcRenderer.on(IPC.ON_PAUSE, handler)
    return () => ipcRenderer.removeListener(IPC.ON_PAUSE, handler)
  }
})

export type { ResolveCommand, RequestEdit }
