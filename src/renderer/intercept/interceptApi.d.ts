import type { CapturedRequestDto, ResolveCommand } from '../../shared/intercept'

declare global {
  interface Window {
    intercept: {
      setArmed: (armed: boolean) => void
      navigate: (url: string) => void
      resolve: (cmd: ResolveCommand) => void
      sendToBuilder: (req: { method: string; url: string; headers: [string, string][]; body: string }) => void
      onCapture: (cb: (dto: CapturedRequestDto) => void) => () => void
      onPause: (cb: (dto: CapturedRequestDto) => void) => () => void
    }
  }
}
export {}
