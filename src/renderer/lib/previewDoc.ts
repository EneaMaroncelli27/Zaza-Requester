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
/**
 * Many SSR frameworks (Next.js, etc.) ship the full content in the HTML but
 * hide it behind an inline `visibility:hidden` / `opacity:0` on the app root,
 * flipping it visible only after their JS hydrates. Since the preview blocks
 * scripts by default, inject a CSS override (stylesheet !important beats inline
 * non-important styles) so the server-rendered content is visible immediately.
 */
const UNHIDE_STYLE =
  '<style>[style*="visibility:hidden"],[style*="visibility: hidden"]{visibility:visible!important}' +
  '[style*="opacity:0"],[style*="opacity: 0"]{opacity:1!important}' +
  '#__next,#root,#app,[data-reactroot]{visibility:visible!important;opacity:1!important}</style>'

export function buildPreviewDoc(html: string, baseUrl: string): string {
  const baseTag = baseUrl ? `<base href="${baseUrl.replace(/"/g, '&quot;')}">` : ''
  const inject = baseTag + UNHIDE_STYLE

  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (m) => `${m}${inject}`)
  }
  if (/<html[^>]*>/i.test(html)) {
    return html.replace(/<html[^>]*>/i, (m) => `${m}<head>${inject}</head>`)
  }
  return `${inject}${html}`
}
