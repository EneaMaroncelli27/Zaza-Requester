// src/main/proxy/interceptEngine.ts
import type { InterceptedRequest } from './requestModel'

export type Resolution =
  | { action: 'forward'; edited?: InterceptedRequest }
  | { action: 'drop' }

interface Pending {
  settle: (res: Resolution) => void
  timer: ReturnType<typeof setTimeout>
}

export class InterceptEngine {
  armed = false
  onCapture: (req: InterceptedRequest) => void = () => {}
  onPause: (req: InterceptedRequest) => void = () => {}
  private pending = new Map<string, Pending>()

  pendingCount(): number {
    return this.pending.size
  }

  handle(req: InterceptedRequest, timeoutMs: number): Promise<Resolution> {
    this.onCapture(req)
    if (!this.armed) return Promise.resolve({ action: 'forward' })

    return new Promise<Resolution>((resolve) => {
      const settle = (res: Resolution): void => {
        const entry = this.pending.get(req.id)
        if (!entry) return
        clearTimeout(entry.timer)
        this.pending.delete(req.id)
        resolve(res)
      }
      const timer = setTimeout(() => settle({ action: 'forward' }), timeoutMs)
      this.pending.set(req.id, { settle, timer })
      this.onPause(req)
    })
  }

  resolve(id: string, res: Resolution): void {
    this.pending.get(id)?.settle(res)
  }
}
