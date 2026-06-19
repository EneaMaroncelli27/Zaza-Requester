// src/shared/intercept.ts
import type { RequestData } from './types'

// Wire shape of a captured request sent to the intercept renderer.
export interface CapturedRequestDto {
  id: string
  method: string
  url: string
  headers: [string, string][]
  body: string
  paused: boolean
}

// Edits the user can apply to a parked request before forwarding.
export interface RequestEdit {
  method: string
  url: string
  headers: [string, string][]
  body: string
}

export type ResolveCommand =
  | { id: string; action: 'forward'; edit?: RequestEdit }
  | { id: string; action: 'drop' }

export const IPC = {
  // renderer → main: switch the single window to the intercept view (attaches
  // + shows the embedded browser overlay) or back to the builder view (hides it)
  SHOW_INTERCEPT: 'intercept:show',
  SHOW_BUILDER: 'intercept:showBuilder',
  // intercept renderer → main: arm/disarm + navigate + resolve
  SET_ARMED: 'intercept:setArmed',
  NAVIGATE: 'intercept:navigate',
  RESOLVE: 'intercept:resolve',
  SEND_TO_BUILDER: 'intercept:sendToBuilder',
  // main → intercept renderer
  ON_CAPTURE: 'intercept:onCapture',
  ON_PAUSE: 'intercept:onPause',
  // main → main window: load a request into the curl builder
  ON_LOAD_REQUEST: 'intercept:onLoadRequest'
} as const

export type LoadRequestPayload = RequestData
