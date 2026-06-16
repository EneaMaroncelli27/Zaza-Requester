import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/renderer/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace']
      },
      colors: {
        // Named palette — refined dark base, slightly warmer than pure slate.
        app: '#0E141B',
        surface: '#161E27',
        'surface-2': '#1E2832',
        hair: '#2A3641',
        ink: '#E6EDF3',
        'ink-dim': '#8B98A5'
      }
    }
  },
  plugins: []
}

export default config
