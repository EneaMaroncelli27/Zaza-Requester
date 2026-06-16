import React, { useState, useEffect } from 'react'
import { Send, Save, Terminal, Check } from 'lucide-react'
import { useStore } from '../store/useStore'
import HeadersEditor from './HeadersEditor'
import BodyEditor from './BodyEditor'
import CurlImport from './CurlImport'
import SaveModal from './SaveModal'
import { METHOD_THEME } from '../lib/methodTheme'
import { buildCurlCommand } from '../lib/buildCurlCommand'
import type { HttpMethod } from '@shared/types'

const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']

type Tab = 'headers' | 'body' | 'import'

export default function RequestPanel() {
  const method = useStore((s) => s.currentRequest.method)
  const url = useStore((s) => s.currentRequest.url)
  const headers = useStore((s) => s.currentRequest.headers)
  const request = useStore((s) => s.currentRequest)
  const isLoading = useStore((s) => s.isLoading)
  const showSaveModal = useStore((s) => s.showSaveModal)
  const setMethod = useStore((s) => s.setMethod)
  const setUrl = useStore((s) => s.setUrl)
  const send = useStore((s) => s.send)
  const setShowSaveModal = useStore((s) => s.setShowSaveModal)

  const [tab, setTab] = useState<Tab>('headers')
  const [copiedCurl, setCopiedCurl] = useState(false)

  const theme = METHOD_THEME[method]

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        send()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [send])

  const handleCopyCurl = async () => {
    await navigator.clipboard.writeText(buildCurlCommand(request))
    setCopiedCurl(true)
    setTimeout(() => setCopiedCurl(false), 1500)
  }

  const activeHeaderCount = headers.filter((h) => h.enabled && h.key.trim()).length

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* URL bar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-hair bg-surface shrink-0">
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value as HttpMethod)}
          className={`bg-surface-2 border border-hair rounded px-2 py-1.5 text-sm font-bold font-mono outline-none focus:border-slate-500 transition-colors cursor-pointer ${theme.text}`}
        >
          {METHODS.map((m) => (
            <option key={m} value={m} className="text-slate-100 bg-surface-2">{m}</option>
          ))}
        </select>

        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="https://api.example.com/endpoint"
          className={`flex-1 bg-surface-2 border border-hair rounded px-3 py-1.5 text-sm text-ink placeholder-slate-500 outline-none transition-colors font-mono ${theme.ring}`}
          spellCheck={false}
        />

        <button
          onClick={send}
          disabled={isLoading || !url.trim()}
          className={`flex items-center gap-2 px-4 py-1.5 text-white rounded font-medium text-sm transition-colors shrink-0 disabled:bg-surface-2 disabled:text-slate-500 ${theme.btn}`}
          title="Send (Ctrl+Enter)"
        >
          <Send size={14} />
          {isLoading ? 'Sending…' : 'Send'}
        </button>

        <button
          onClick={handleCopyCurl}
          disabled={!url.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 text-ink-dim hover:text-ink disabled:text-slate-600 border border-hair hover:border-slate-500 rounded text-sm transition-colors shrink-0"
          title="Copy as cURL"
        >
          {copiedCurl ? <Check size={14} className="text-emerald-400" /> : <Terminal size={14} />}
        </button>

        <button
          onClick={() => setShowSaveModal(true)}
          disabled={!url.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 text-ink-dim hover:text-ink disabled:text-slate-600 border border-hair hover:border-slate-500 rounded text-sm transition-colors shrink-0"
          title="Save to project"
        >
          <Save size={14} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-4 py-2 border-b border-slate-700 bg-slate-800/20 shrink-0">
        {([
          { key: 'headers', label: `Headers${activeHeaderCount > 0 ? ` (${activeHeaderCount})` : ''}` },
          { key: 'body', label: 'Body' },
          { key: 'import', label: 'Import cURL' }
        ] as { key: Tab; label: string }[]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              tab === key
                ? 'text-slate-100 bg-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {tab === 'headers' && <HeadersEditor />}
        {tab === 'body' && <BodyEditor />}
        {tab === 'import' && <CurlImport />}
      </div>

      {showSaveModal && <SaveModal />}
    </div>
  )
}
