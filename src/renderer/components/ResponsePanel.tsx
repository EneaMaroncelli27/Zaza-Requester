import { useState, useMemo, useEffect } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { json } from '@codemirror/lang-json'
import { html as htmlLang } from '@codemirror/lang-html'
import { oneDark } from '@codemirror/theme-one-dark'
import { Copy, Check, ExternalLink } from 'lucide-react'
import { useStore } from '../store/useStore'
import { isHtmlResponse } from '../lib/previewDoc'

/**
 * Renders the exact response body — the same bytes shown on the Body tab — in a
 * sandboxed iframe, matching what Chrome DevTools' Network → Preview pane shows.
 * A strict CSP guarantees zero extra network requests: external CSS/JS/images do
 * NOT load and scripts do NOT run, so the page renders its DOM/text and may look
 * unstyled. This deliberately does NOT re-fetch the URL — it shows the response
 * you actually received, not a fresh anonymous GET.
 */
function PagePreview({ body }: { body: string }) {
  if (!body) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-slate-500">
        Empty response body
      </div>
    )
  }
  // Inject a strict CSP so the sandboxed render makes zero network requests. The
  // raw bytes are unchanged on the Body tab; this wrapper only governs rendering.
  const csp = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">`
  const doc = `${csp}\n${body}`

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-hair bg-surface shrink-0">
        <span className="ml-auto flex items-center gap-1 text-xs text-slate-500">
          <ExternalLink size={11} /> rendered response — no network requests
        </span>
      </div>
      <div className="relative flex-1 bg-white overflow-hidden">
        <iframe
          srcDoc={doc}
          sandbox=""
          className="w-full h-full border-0"
          title="Response preview"
        />
      </div>
    </div>
  )
}

function statusColor(status: number): string {
  if (status >= 500) return 'bg-red-500/20 text-red-400 border-red-500/30'
  if (status >= 400) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
  if (status >= 300) return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
  if (status >= 200) return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
  return 'bg-slate-500/20 text-slate-400 border-slate-500/30'
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

type Tab = 'preview' | 'body' | 'headers'

export default function ResponsePanel() {
  const response = useStore((s) => s.response)
  const responseError = useStore((s) => s.responseError)
  const isLoading = useStore((s) => s.isLoading)
  const [tab, setTab] = useState<Tab>('body')
  const [copied, setCopied] = useState(false)

  const contentType = useMemo(
    () => response?.headers.find((h) => h.key.toLowerCase() === 'content-type')?.value,
    [response]
  )

  const isJson = useMemo(() => contentType?.includes('json') ?? false, [contentType])

  const isHtml = useMemo(
    () => (response ? isHtmlResponse(contentType, response.body) : false),
    [response, contentType]
  )

  const prettyBody = useMemo(() => {
    if (!response?.body) return ''
    try {
      return JSON.stringify(JSON.parse(response.body), null, 2)
    } catch {
      return response.body
    }
  }, [response?.body])

  // When a new response arrives, default HTML pages to the rendered Preview;
  // otherwise show the raw Body. Also bounce off Preview if it's no longer HTML.
  useEffect(() => {
    if (!response) return
    setTab(isHtml ? 'preview' : 'body')
  }, [response, isHtml])

  const handleCopy = async () => {
    if (!response) return
    await navigator.clipboard.writeText(prettyBody)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const tabs: Tab[] = isHtml ? ['preview', 'body', 'headers'] : ['body', 'headers']
  const tabLabel = (t: Tab): string =>
    t === 'preview' ? 'Preview' : t === 'body' ? 'Body' : `Headers (${response?.headers.length ?? 0})`

  return (
    <div className="flex flex-col h-full border-t border-hair">
      {/* Header bar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-hair bg-surface shrink-0">
        <span className="text-xs font-semibold text-ink-dim uppercase tracking-wider">Response</span>

        {isLoading && (
          <span className="text-sm text-ink-dim animate-pulse">Sending...</span>
        )}

        {response && !isLoading && (
          <>
            <span className={`px-2 py-0.5 rounded border text-xs font-bold ${statusColor(response.status)}`}>
              {response.status} {response.statusText}
            </span>
            <span className="text-xs text-slate-500 font-mono">{response.durationMs}ms</span>
            <span className="text-xs text-slate-500 font-mono">{formatSize(response.sizeBytes)}</span>
            <div className="ml-2 flex gap-1">
              {tabs.map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-3 py-0.5 rounded text-xs font-medium transition-colors ${
                    tab === t
                      ? 'bg-surface-2 text-ink'
                      : 'text-ink-dim hover:text-ink'
                  }`}
                >
                  {tabLabel(t)}
                </button>
              ))}
            </div>
            {tab === 'body' && (
              <button
                onClick={handleCopy}
                className="ml-auto flex items-center gap-1.5 px-2 py-0.5 text-xs text-ink-dim hover:text-ink border border-hair hover:border-slate-500 rounded transition-colors"
                title="Copy response body"
              >
                {copied ? (
                  <><Check size={12} className="text-emerald-400" /> Copied</>
                ) : (
                  <><Copy size={12} /> Copy</>
                )}
              </button>
            )}
          </>
        )}

        {responseError && !isLoading && (
          <span className="text-sm text-red-400">{responseError}</span>
        )}

        {!response && !isLoading && !responseError && (
          <span className="text-sm text-slate-600">No response yet</span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {response && !isLoading && (
          <>
            {tab === 'preview' && <PagePreview body={response.body} />}
            {tab === 'body' && (
              <CodeMirror
                value={prettyBody}
                theme={oneDark}
                extensions={isJson ? [json()] : isHtml ? [htmlLang()] : []}
                editable={false}
                basicSetup={{ lineNumbers: true, foldGutter: isJson || isHtml }}
                style={{ height: '100%' }}
                className="h-full"
              />
            )}
            {tab === 'headers' && (
              <div className="overflow-auto h-full p-2">
                <table className="w-full text-sm">
                  <tbody>
                    {response.headers.map((h, i) => (
                      <tr key={i} className="border-b border-slate-700/50">
                        <td className="py-1.5 px-3 text-slate-400 font-medium w-1/3 align-top">{h.key}</td>
                        <td className="py-1.5 px-3 text-slate-200 break-all">{h.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
