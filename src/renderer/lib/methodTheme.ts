import type { HttpMethod } from '@shared/types'

/**
 * Single source of truth for the method-color identity.
 *
 * The HTTP verb is the spine of the UI: the active method tints the URL focus
 * ring and the Send button so a GET reads green and a DELETE reads red. Class
 * strings are written in full (no interpolation) so Tailwind's purge keeps them.
 */
export interface MethodTheme {
  text: string // labels in sidebar / history / method select
  ring: string // URL input focus border
  btn: string // Send button background
  dot: string // small identity / status dot
}

export const METHOD_THEME: Record<HttpMethod, MethodTheme> = {
  GET: {
    text: 'text-emerald-400',
    ring: 'focus:border-emerald-500',
    btn: 'bg-emerald-600 hover:bg-emerald-500',
    dot: 'bg-emerald-400'
  },
  POST: {
    text: 'text-blue-400',
    ring: 'focus:border-blue-500',
    btn: 'bg-blue-600 hover:bg-blue-500',
    dot: 'bg-blue-400'
  },
  PUT: {
    text: 'text-amber-400',
    ring: 'focus:border-amber-500',
    btn: 'bg-amber-600 hover:bg-amber-500',
    dot: 'bg-amber-400'
  },
  PATCH: {
    text: 'text-orange-400',
    ring: 'focus:border-orange-500',
    btn: 'bg-orange-600 hover:bg-orange-500',
    dot: 'bg-orange-400'
  },
  DELETE: {
    text: 'text-red-400',
    ring: 'focus:border-red-500',
    btn: 'bg-red-600 hover:bg-red-500',
    dot: 'bg-red-400'
  },
  HEAD: {
    text: 'text-purple-400',
    ring: 'focus:border-purple-500',
    btn: 'bg-purple-600 hover:bg-purple-500',
    dot: 'bg-purple-400'
  },
  OPTIONS: {
    text: 'text-slate-400',
    ring: 'focus:border-slate-500',
    btn: 'bg-slate-600 hover:bg-slate-500',
    dot: 'bg-slate-400'
  }
}

/** Convenience: just the text color, with a safe fallback for unknown methods. */
export function methodText(method: string): string {
  return METHOD_THEME[method as HttpMethod]?.text ?? 'text-slate-400'
}
