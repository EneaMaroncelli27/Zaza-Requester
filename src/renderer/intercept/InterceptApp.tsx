import React, { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import type { CapturedRequestDto } from '../../shared/intercept'
import CapturedTable from './CapturedTable'
import RequestEditor from './RequestEditor'

export default function InterceptApp({ onBack }: { onBack: () => void }) {
  const [rows, setRows] = useState<CapturedRequestDto[]>([])
  const [armed, setArmed] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [addr, setAddr] = useState('https://example.com')

  useEffect(() => {
    // Dispose listeners on unmount so StrictMode's double-mount (and any
    // remount) does not leave duplicate IPC handlers that render each request
    // more than once.
    const offCapture = window.intercept.onCapture((dto) => setRows((prev) => [dto, ...prev].slice(0, 500)))
    const offPause = window.intercept.onPause((dto) =>
      setRows((prev) => prev.map((r) => (r.id === dto.id ? dto : (prev.some((x) => x.id === dto.id) ? r : r)))
        .concat(prev.some((x) => x.id === dto.id) ? [] : [dto])))
    return () => { offCapture(); offPause() }
  }, [])

  const toggleArmed = () => { const next = !armed; setArmed(next); window.intercept.setArmed(next) }
  const selected = rows.find((r) => r.id === selectedId) ?? null
  const paused = selected?.paused ? selected : null

  const clearRow = (id: string) => setRows((prev) => prev.filter((r) => r.id !== id))
  const clearAll = () => { setRows([]); setSelectedId(null) }
  // Inline resolve straight from the row — forward unchanged or drop, no editor.
  const forwardRow = (id: string) => { window.intercept.resolve({ id, action: 'forward' }); clearRow(id) }
  const dropRow = (id: string) => { window.intercept.resolve({ id, action: 'drop' }); clearRow(id) }

  return (
    // top 60% is the embedded WebContentsView (drawn by main); this UI sits in
    // the bottom 40%, so pad the top to avoid drawing under the browser view.
    <div className="flex flex-col h-screen bg-app text-slate-200" style={{ paddingTop: '60vh' }}>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-700">
        <button onClick={onBack} title="Back to builder"
          className="flex items-center gap-1 px-2 py-1 bg-slate-700 hover:bg-indigo-600 rounded text-sm text-slate-200 transition-colors">
          <ArrowLeft size={14} /> Builder
        </button>
        <input value={addr} onChange={(e) => setAddr(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') window.intercept.navigate(addr) }}
          className="flex-1 bg-slate-700 rounded px-2 py-1 font-mono text-sm outline-none" />
        <button onClick={() => window.intercept.navigate(addr)}
          className="px-3 py-1 bg-slate-600 rounded text-sm">Go</button>
        <button onClick={toggleArmed}
          className={`px-3 py-1 rounded text-sm text-white ${armed ? 'bg-amber-600' : 'bg-slate-600'}`}>
          Intercept: {armed ? 'ON' : 'OFF'}
        </button>
        <button onClick={clearAll} disabled={rows.length === 0} title="Clear captured list"
          className="px-3 py-1 bg-slate-700 hover:bg-rose-600 disabled:opacity-40 disabled:hover:bg-slate-700 rounded text-sm text-slate-200 transition-colors">
          Clear
        </button>
      </div>
      <div className="flex flex-1 min-h-0">
        <div className="w-1/2 border-r border-slate-700 min-h-0">
          <CapturedTable rows={rows} selectedId={selectedId} onSelect={setSelectedId}
            onForward={forwardRow} onDrop={dropRow} />
        </div>
        <div className="w-1/2 min-h-0 overflow-auto">
          {paused ? (
            <RequestEditor
              req={paused}
              onForward={(edit) => { window.intercept.resolve({ id: paused.id, action: 'forward', edit }); clearRow(paused.id) }}
              onDrop={() => { window.intercept.resolve({ id: paused.id, action: 'drop' }); clearRow(paused.id) }}
              onSendToBuilder={(edit) => { window.intercept.sendToBuilder(edit); window.intercept.resolve({ id: paused.id, action: 'forward', edit }); clearRow(paused.id) }}
            />
          ) : (
            <p className="p-3 text-slate-500 italic text-sm">
              {selected ? 'Captured (read-only). Arm intercept to pause and edit requests.' : 'Select a request.'}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
