/// <reference types="vite/client" />
import type { RequestData, AppStore, ResponseData } from '@shared/types'

declare global {
  interface Window {
    api: {
      execute: (req: RequestData) => Promise<ResponseData>
      readStore: () => Promise<AppStore>
      writeStore: (store: AppStore) => Promise<void>
      showIntercept: () => void
      showBuilder: () => void
      onLoadRequest: (cb: (req: RequestData) => void) => () => void
    }
  }
}

export {}
