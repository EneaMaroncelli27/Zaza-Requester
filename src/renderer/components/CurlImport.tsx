import React, { useState } from 'react'
import { Download } from 'lucide-react'
import { parseCurl } from '../lib/curlParser'
import { useStore } from '../store/useStore'

export default function CurlImport() {
  const [input, setInput] = useState('')
  const [error, setError] = useState('')
  const importRequest = useStore((s) => s.importRequest)

  const handleImport = () => {
    setError('')
    try {
      const parsed = parseCurl(input.trim())
      importRequest(parsed)
      setInput('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse curl command')
    }
  }

  return (
    <div className="flex flex-col h-full p-3 gap-3">
      <p className="text-slate-400 text-sm">
        Paste a curl command copied from browser DevTools (Network tab → right-click request → Copy as cURL).
      </p>
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={`curl 'https://api.example.com/v1/data' \\\n  -H 'Content-Type: application/json' \\\n  --data-raw '{"key":"value"}'`}
        className="flex-1 bg-slate-700/50 border border-slate-600 rounded p-3 text-sm text-slate-200 placeholder-slate-500 font-mono resize-none outline-none focus:border-indigo-500 transition-colors"
        spellCheck={false}
      />
      {error && (
        <p className="text-red-400 text-sm">{error}</p>
      )}
      <button
        onClick={handleImport}
        disabled={!input.trim()}
        className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded font-medium text-sm transition-colors"
      >
        <Download size={15} />
        Import
      </button>
    </div>
  )
}
