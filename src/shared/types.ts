export interface Header {
  key: string
  value: string
  enabled: boolean
}

export type BodyType = 'none' | 'raw' | 'json' | 'urlencoded'
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'

export interface RequestData {
  method: HttpMethod
  url: string
  headers: Header[]
  body: string
  bodyType: BodyType
}

export interface ResponseData {
  status: number
  statusText: string
  headers: Header[]
  body: string
  durationMs: number
  sizeBytes: number
  // Full raw HTTP response exactly as received: status line + headers + a blank
  // line + the (decompressed) body. Optional because history entries persisted
  // before this field existed won't have it — consumers reconstruct as fallback.
  raw?: string
}

export interface HistoryEntry {
  id: string
  timestamp: number
  request: RequestData
  response: ResponseData
}

export interface SavedRequest {
  id: string
  name: string
  request: RequestData
}

export interface Project {
  id: string
  name: string
  requests: SavedRequest[]
}

export interface AppStore {
  history: HistoryEntry[]
  projects: Project[]
}
