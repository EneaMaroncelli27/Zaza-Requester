import type { RequestData, Header, HttpMethod, BodyType } from '@shared/types'

export interface InterceptedRequest {
  id: string
  method: string
  url: string
  host: string
  port: number
  protocol: 'http' | 'https'
  path: string
  headers: [string, string][]
  body: string
}

export function serializeRequestLineAndHeaders(req: InterceptedRequest): string {
  const lines = [`${req.method} ${req.path} HTTP/1.1`]
  const hasBody = req.body.length > 0
  const byteLen = Buffer.byteLength(req.body, 'utf8')
  for (const [k, v] of req.headers) {
    if (hasBody && k.toLowerCase() === 'content-length') continue // recompute below
    lines.push(`${k}: ${v}`)
  }
  if (hasBody) lines.push(`Content-Length: ${byteLen}`)
  return lines.join('\r\n') + '\r\n\r\n'
}

function guessBodyType(headers: [string, string][], body: string): BodyType {
  if (!body) return 'none'
  const ct = headers.find(([k]) => k.toLowerCase() === 'content-type')?.[1] ?? ''
  return ct.includes('json') ? 'json' : 'raw'
}

export function toRequestData(req: InterceptedRequest): RequestData {
  const headers: Header[] = req.headers.map(([key, value]) => ({ key, value, enabled: true }))
  return {
    method: req.method as HttpMethod,
    url: req.url,
    headers,
    body: req.body,
    bodyType: guessBodyType(req.headers, req.body)
  }
}
