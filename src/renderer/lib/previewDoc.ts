/**
 * Decide whether a response body should be treated as a renderable HTML page.
 * Prefers the Content-Type header; falls back to sniffing the body.
 */
export function isHtmlResponse(contentType: string | undefined, body: string): boolean {
  if (contentType && contentType.toLowerCase().includes('html')) return true
  const head = body.slice(0, 200).trimStart().toLowerCase()
  return head.startsWith('<!doctype html') || head.startsWith('<html')
}
