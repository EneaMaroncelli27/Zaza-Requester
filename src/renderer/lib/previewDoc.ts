/**
 * Decide whether a response body should be treated as a renderable HTML page.
 * Prefers the Content-Type header; falls back to sniffing the body.
 */
export function isHtmlResponse(contentType: string | undefined, body: string): boolean {
  if (contentType && contentType.toLowerCase().includes('html')) return true
  const head = body.slice(0, 200).trimStart().toLowerCase()
  return head.startsWith('<!doctype html') || head.startsWith('<html')
}

/**
 * Prepare HTML for a sandboxed preview iframe. Injects a <base href> so the
 * page's relative URLs (images, stylesheets) resolve against the original
 * request URL — otherwise a curl-fetched page renders unstyled.
 *
 * The iframe itself is sandboxed with no allow-scripts, so no remote JS runs;
 * this only resolves passive subresources for a faithful static render.
 */
export function buildPreviewDoc(html: string, baseUrl: string): string {
  if (!baseUrl) return html
  const baseTag = `<base href="${baseUrl.replace(/"/g, '&quot;')}">`

  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (m) => `${m}${baseTag}`)
  }
  if (/<html[^>]*>/i.test(html)) {
    return html.replace(/<html[^>]*>/i, (m) => `${m}<head>${baseTag}</head>`)
  }
  return `${baseTag}${html}`
}
