import type { RequestData, Header, BodyType, HttpMethod } from '@shared/types'

function tokenize(input: string): string[] {
  // Join backslash-newline continuations
  const flat = input.replace(/\\\r?\n/g, ' ').trim()
  const tokens: string[] = []
  let i = 0

  while (i < flat.length) {
    // Skip whitespace
    while (i < flat.length && /\s/.test(flat[i])) i++
    if (i >= flat.length) break

    const ch = flat[i]

    if (ch === "'" || ch === '"') {
      const quote = ch
      i++
      let str = ''
      while (i < flat.length && flat[i] !== quote) {
        if (flat[i] === '\\' && quote === '"' && i + 1 < flat.length) {
          i++
          str += flat[i]
        } else {
          str += flat[i]
        }
        i++
      }
      i++ // closing quote
      tokens.push(str)
    } else {
      let str = ''
      while (i < flat.length && !/\s/.test(flat[i])) {
        str += flat[i]
        i++
      }
      if (str) tokens.push(str)
    }
  }

  return tokens
}

export function parseCurl(input: string): RequestData {
  const trimmed = input.trim()
  if (!trimmed.startsWith('curl ') && !trimmed.startsWith('curl\t')) {
    throw new Error('Input must start with "curl"')
  }

  const tokens = tokenize(trimmed.slice(4).trim())

  let url = ''
  let method = ''
  const headers: Header[] = []
  let body = ''

  const FLAGS_NO_VALUE = new Set([
    '--compressed', '--no-compressed', '-G', '--get', '-L', '--location',
    '-s', '--silent', '-v', '--verbose', '-k', '--insecure',
    '-g', '--globoff', '--http1.1', '--http2', '--http3',
    '-I', '--head', '-f', '--fail', '--fail-with-body'
  ])

  const addHeader = (raw: string) => {
    const colonIdx = raw.indexOf(':')
    if (colonIdx === -1) return
    headers.push({
      key: raw.substring(0, colonIdx).trim(),
      value: raw.substring(colonIdx + 1).trim(),
      enabled: true
    })
  }

  let i = 0
  while (i < tokens.length) {
    const token = tokens[i]

    if (token === '-X' || token === '--request') {
      method = tokens[++i] || ''
    } else if (token === '-H' || token === '--header') {
      addHeader(tokens[++i] || '')
    } else if (
      token === '-d' || token === '--data' ||
      token === '--data-raw' || token === '--data-binary' ||
      token === '--data-urlencode' || token === '--data-ascii'
    ) {
      body = tokens[++i] || ''
    } else if (token === '--url') {
      url = tokens[++i] || ''
    } else if (token === '-A' || token === '--user-agent') {
      addHeader(`User-Agent: ${tokens[++i] || ''}`)
    } else if (token === '-e' || token === '--referer') {
      addHeader(`Referer: ${tokens[++i] || ''}`)
    } else if (token === '-u' || token === '--user') {
      const userpass = tokens[++i] || ''
      addHeader(`Authorization: Basic ${btoa(userpass)}`)
    } else if (token === '-b' || token === '--cookie') {
      addHeader(`Cookie: ${tokens[++i] || ''}`)
    } else if (FLAGS_NO_VALUE.has(token)) {
      // flags with no value — skip
    } else if (token.startsWith('--')) {
      // Unknown long flag — assume it takes a value and skip both
      i++
    } else if (token.startsWith('-') && token.length === 2) {
      // Unknown short flag — assume value follows
      i++
    } else if (!token.startsWith('-')) {
      // Positional argument = URL
      if (!url) url = token
    }

    i++
  }

  // Infer method
  if (!method) {
    method = body ? 'POST' : 'GET'
  }

  // Detect body type
  let bodyType: BodyType = 'none'
  if (body) {
    const ctHeader = headers.find((h) => h.key.toLowerCase() === 'content-type')
    if (ctHeader?.value.includes('application/json')) {
      bodyType = 'json'
      try {
        body = JSON.stringify(JSON.parse(body), null, 2)
      } catch {
        bodyType = 'raw'
      }
    } else if (ctHeader?.value.includes('application/x-www-form-urlencoded')) {
      bodyType = 'urlencoded'
    } else {
      bodyType = 'raw'
    }
  }

  return {
    method: method.toUpperCase() as HttpMethod,
    url,
    headers,
    body,
    bodyType
  }
}
