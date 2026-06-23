import { StreamLanguage } from '@codemirror/language'

/**
 * Minimal CodeMirror language for application/x-www-form-urlencoded bodies:
 * `key=value&key2=value2`. Keys, values, the `=` and `&` separators, and
 * percent-escapes (%20) each get distinct tokens so the oneDark theme colors
 * them. No grammar/AST — a tiny hand-rolled stream tokenizer is enough and
 * stays robust on malformed input (missing `=`, trailing `&`, etc.).
 */
interface UrlEncState {
  inValue: boolean
}

function isHex(c: string): boolean {
  return /[0-9a-fA-F]/.test(c)
}

export const urlencodedLanguage = StreamLanguage.define<UrlEncState>({
  startState: () => ({ inValue: false }),
  token(stream, state) {
    const c = stream.peek()

    if (c === '&') {
      stream.next()
      state.inValue = false
      return 'punctuation'
    }
    if (c === '=') {
      stream.next()
      state.inValue = true
      return 'operator'
    }
    // Percent-escape: %XX where XX are hex digits.
    if (c === '%' && isHex(stream.string.charAt(stream.pos + 1)) && isHex(stream.string.charAt(stream.pos + 2))) {
      stream.next()
      stream.next()
      stream.next()
      return 'escape'
    }

    // Otherwise consume a run of ordinary characters up to the next delimiter.
    let advanced = false
    while (!stream.eol()) {
      const n = stream.peek()
      if (n === '=' || n === '&' || n === '%') break
      stream.next()
      advanced = true
    }
    if (!advanced) stream.next() // guard against zero-width loops

    return state.inValue ? 'string' : 'propertyName'
  }
})
