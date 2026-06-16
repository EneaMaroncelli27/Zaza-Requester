import type React from 'react'

// Minimal typing for Electron's <webview> tag so it can be used in JSX.
declare global {
  namespace JSX {
    interface IntrinsicElements {
      webview: React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          src?: string
          partition?: string
          allowpopups?: string
          useragent?: string
        },
        HTMLElement
      >
    }
  }
}

export {}
