import React, { useState, useMemo, useEffect } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { json } from '@codemirror/lang-json'
import { html as htmlLang } from '@codemirror/lang-html'
import { oneDark } from '@codemirror/theme-one-dark'
import { Copy, Check, Code2, ShieldCheck } from 'lucide-react'
import { useStore } from '../store/useStore'
import { isHtmlResponse, buildPreviewDoc } from '../lib/previewDoc'

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
  const url = useStore((s) => s.currentRequest.url)
  const [tab, setTab] = useState<Tab>('body')
  const [copied, setCopied] = useState(false)
  // Static render by default (no scripts): the unhide CSS in buildPreviewDoc
  // reveals server-rendered content that frameworks gate behind visibility:hidden.
  // Toggle on for client-only SPAs with empty SSR; scripts then run in an
  // isolated sandbox (no allow-same-origin → no access to this app or its data).
  const [runScripts, setRunScripts] = useState(false)

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

  const previewDoc = useMemo(
    () => (isHtml && response ? buildPreviewDoc(response.body, url) : ''),
    [isHtml, response, url]
  )

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
            {tab === 'preview' && (
              <div className="flex flex-col h-full">
                <div className="flex items-center gap-2 px-3 py-1.5 border-b border-hair bg-surface shrink-0">
                  <button
                    onClick={() => setRunScripts((v) => !v)}
                    className={`flex items-center gap-1.5 px-2 py-0.5 text-xs rounded border transition-colors ${
                      runScripts
                        ? 'text-amber-300 border-amber-500/40 hover:border-amber-400'
                        : 'text-emerald-300 border-emerald-500/40 hover:border-emerald-400'
                    }`}
                    title={
                      runScripts
                        ? 'Scripts run in an isolated sandbox (no access to this app). Click for safe static mode.'
                        : 'Static render — no scripts. JS-gated pages may appear blank. Click to run scripts.'
                    }
                  >
                    {runScripts ? <Code2 size={12} /> : <ShieldCheck size={12} />}
                    {runScripts ? 'Scripts: on' : 'Scripts: off'}
                  </button>
                  <span className="text-xs text-slate-500">
                    {runScripts ? 'isolated sandbox' : 'static, no scripts'}
                  </span>
                </div>
                <iframe
                  key={`preview-${runScripts}`}
                  title="Response preview"
                  sandbox={runScripts ? 'allow-scripts allow-popups allow-forms' : ''}
                  srcDoc={previewDoc}
                  className="w-full flex-1 border-0 bg-white"
                />
              </div>
            )}
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
