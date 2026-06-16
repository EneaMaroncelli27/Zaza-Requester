import type { RequestData } from '@shared/types'

/**
 * Wrap a value in single quotes for a POSIX shell, escaping any embedded
 * single quotes via the '\'' idiom. Safe to paste into a terminal.
 */
function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

/**
 * Turn a built request back into a clean, human-pasteable curl command —
 * the inverse of the Import cURL feature. Multi-line with backslash
 * continuations so it reads like something copied from DevTools.
 *
 * Distinct from src/main/curlBuilder.ts, which builds internal `-s -i` spawn
 * args for execution. This one is for display / clipboard only.
 */
export function buildCurlCommand(req: RequestData): string {
  const parts: string[] = [`curl ${shellQuote(req.url || '')}`]

  if (req.method && req.method !== 'GET') {
    parts.push(`-X ${req.method}`)
  }

  for (const h of req.headers) {
    if (h.enabled && h.key.trim()) {
      parts.push(`-H ${shellQuote(`${h.key}: ${h.value}`)}`)
    }
  }

  if (req.bodyType !== 'none' && req.body.trim()) {
    parts.push(`--data-raw ${shellQuote(req.body)}`)
  }

  return parts.join(' \\\n  ')
}
