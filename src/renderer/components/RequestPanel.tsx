import React, { useState, useEffect } from 'react'
import { Send, Save } from 'lucide-react'
import { useStore } from '../store/useStore'
import HeadersEditor from './HeadersEditor'
import BodyEditor from './BodyEditor'
import CurlImport from './CurlImport'
import SaveModal from './SaveModal'
import type { HttpMethod } from '@shared/types'

const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']

const METHOD_COLORS: Record<string, string> = {
  GET: 'text-emerald-400',
  POST: 'text-blue-400',
  PUT: 'text-yellow-400',
  PATCH: 'text-orange-400',
  DELETE: 'text-red-400',
  HEAD: 'text-purple-400',
  OPTIONS: 'text-slate-400'
}

type Tab = 'headers' | 'body' | 'import'

export default function RequestPanel() {
  const method = useStore((s) => s.currentRequest.method)
  const url = useStore((s) => s.currentRequest.url)
  const headers = useStore((s) => s.currentRequest.headers)
  const isLoading = useStore((s) => s.isLoading)
  const showSaveModal = useStore((s) => s.showSaveModal)
  const setMethod = useStore((s) => s.setMethod)
  const setUrl = useStore((s) => s.setUrl)
  const send = useStore((s) => s.send)
  const setShowSaveModal = useStore((s) => s.setShowSaveModal)
  const projects = useStore((s) => s.projects)

  const [tab, setTab] = useState<Tab>('headers')

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

  const activeHeaderCount = headers.filter((h) => h.enabled && h.key.trim()).length

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* URL bar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-700 bg-slate-800/30 shrink-0">
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value as HttpMethod)}
          className={`bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-sm font-bold outline-none focus:border-indigo-500 transition-colors cursor-pointer ${METHOD_COLORS[method]}`}
        >
          {METHODS.map((m) => (
            <option key={m} value={m} className="text-slate-100 bg-slate-700">{m}</option>
          ))}
        </select>

        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="https://api.example.com/endpoint"
          className="flex-1 bg-slate-700/50 border border-slate-600 rounded px-3 py-1.5 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-indigo-500 transition-colors font-mono"
          spellCheck={false}
        />

        <button
          onClick={send}
          disabled={isLoading || !url.trim()}
          className="flex items-center gap-2 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded font-medium text-sm transition-colors shrink-0"
          title="Send (Ctrl+Enter)"
        >
          <Send size={14} />
          {isLoading ? 'Sending…' : 'Send'}
        </button>

        <button
          onClick={() => setShowSaveModal(true)}
          disabled={!url.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 text-slate-400 hover:text-slate-200 disabled:text-slate-600 border border-slate-600 hover:border-slate-500 rounded text-sm transition-colors shrink-0"
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
