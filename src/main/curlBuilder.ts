import type { RequestData } from '../shared/types'

export function buildCurlArgs(req: RequestData): string[] {
  const args = [
    '-s',
    '-i',
    '-X', req.method,
    req.url
  ]

  for (const header of req.headers) {
    if (header.enabled && header.key.trim()) {
      args.push('-H', `${header.key}: ${header.value}`)
    }
  }

  if (req.body && req.bodyType !== 'none') {
    args.push('--data-raw', req.body)
  }

  return args
}
