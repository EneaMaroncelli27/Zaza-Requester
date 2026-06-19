// src/main/proxy/noiseHosts.ts
// Telemetry / analytics / ad hosts that clutter the captured table without
// being worth inspecting. Matched requests are forwarded silently: never
// captured, never paused. Pages still load; the table stays signal.
const NOISE_SUFFIXES = [
  // analytics / telemetry / ads
  'google-analytics.com',
  'analytics.google.com',
  'googletagmanager.com',
  'googletagservices.com',
  'googlesyndication.com',
  'google-analytics.l.google.com',
  'doubleclick.net',
  'googleadservices.com',
  'g.doubleclick.net',
  'app-measurement.com',
  'crashlytics.com',
  'firebase-settings.crashlytics.com',
  'clients2.google.com',
  'clients4.google.com',
  'play.google.com/log',
  'adservice.google.com',
  // fonts / static CDNs — noise, not worth inspecting
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'gstatic.com',
  'ajax.googleapis.com',
  'apis.google.com',
  'www.gstatic.com',
  'ssl.gstatic.com'
]

// Pure-beacon path prefixes that are Google-specific no-content pings. Kept
// tight on purpose: a bare '/collect' would also hide a user's own API, so we
// only list paths that are unambiguously Google telemetry.
const NOISE_PATH_FRAGMENTS = [
  '/gen_204',
  '/generate_204',
  '/pagead/'
]

export function isNoiseRequest(host: string, path: string): boolean {
  const h = host.toLowerCase()
  for (const suffix of NOISE_SUFFIXES) {
    // suffix may include a path fragment (host/path); split and test both
    const slash = suffix.indexOf('/')
    if (slash === -1) {
      if (h === suffix || h.endsWith('.' + suffix)) return true
    } else {
      const hostPart = suffix.slice(0, slash)
      const pathPart = suffix.slice(slash)
      if ((h === hostPart || h.endsWith('.' + hostPart)) && path.startsWith(pathPart)) return true
    }
  }
  for (const frag of NOISE_PATH_FRAGMENTS) {
    if (path.startsWith(frag)) return true
  }
  return false
}
