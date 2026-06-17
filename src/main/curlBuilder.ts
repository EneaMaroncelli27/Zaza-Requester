import type { RequestData } from '../shared/types'

export function buildCurlArgs(req: RequestData): string[] {
  const args = [
    '-s',
    '-i',
    // Decompress the response (gzip/deflate/br/zstd) so the stored body is the
    // decoded bytes the browser renders — not raw compressed garbage. Curl does
    // NOT auto-decompress without this, even if the request advertises encodings.
    '--compressed',
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
