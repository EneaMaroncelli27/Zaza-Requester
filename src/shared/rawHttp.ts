import type { RequestData } from './types'

/**
 * Render a RequestData as the raw HTTP/1.1 request text it represents — the
 * request line, a synthesized Host header (curl adds this automatically), the
 * user's enabled headers, a blank line, then the body. This is a faithful
 * textual view for display/copy, not the exact bytes on the wire (curl also
 * adds User-Agent, Accept, and Content-Length); it mirrors what the user
 * configured plus the Host that the URL implies.
 */
export function buildRawRequest(req: RequestData): string {
  let path = '/'
  let host = ''
  try {
    const u = new URL(req.url)
    path = `${u.pathname}${u.search}` || '/'
    host = u.host
  } catch {
    // URL not parseable yet (empty or mid-typing) — fall back to the raw string.
    path = req.url || '/'
  }

  const lines: string[] = [`${req.method} ${path} HTTP/1.1`]
  if (host) lines.push(`Host: ${host}`)

  for (const h of req.headers) {
    if (h.enabled && h.key.trim()) {
      lines.push(`${h.key}: ${h.value}`)
    }
  }

  const head = lines.join('\r\n')
  const hasBody = req.body && req.bodyType !== 'none'
  return hasBody ? `${head}\r\n\r\n${req.body}` : head
}
