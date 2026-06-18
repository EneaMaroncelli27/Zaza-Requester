import React, { useEffect, useState } from 'react'
import type { CapturedRequestDto } from '../../shared/intercept'
import CapturedTable from './CapturedTable'
import RequestEditor from './RequestEditor'

export default function InterceptApp() {
  const [rows, setRows] = useState<CapturedRequestDto[]>([])
  const [armed, setArmed] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [addr, setAddr] = useState('https://example.com')

  useEffect(() => {
    window.intercept.onCapture((dto) => setRows((prev) => [dto, ...prev].slice(0, 500)))
    window.intercept.onPause((dto) =>
      setRows((prev) => prev.map((r) => (r.id === dto.id ? dto : (prev.some((x) => x.id === dto.id) ? r : r)))
        .concat(prev.some((x) => x.id === dto.id) ? [] : [dto])))
  }, [])

  const toggleArmed = () => { const next = !armed; setArmed(next); window.intercept.setArmed(next) }
  const selected = rows.find((r) => r.id === selectedId) ?? null
  const paused = selected?.paused ? selected : null

  const clearRow = (id: string) => setRows((prev) => prev.filter((r) => r.id !== id))

  return (
    // top 60% is the embedded WebContentsView (drawn by main); this UI sits in
    // the bottom 40%, so pad the top to avoid drawing under the browser view.
    <div className="flex flex-col h-screen bg-app text-slate-200" style={{ paddingTop: '60vh' }}>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-700">
        <input value={addr} onChange={(e) => setAddr(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') window.intercept.navigate(addr) }}
          className="flex-1 bg-slate-700 rounded px-2 py-1 font-mono text-sm outline-none" />
        <button onClick={() => window.intercept.navigate(addr)}
          className="px-3 py-1 bg-slate-600 rounded text-sm">Go</button>
        <button onClick={toggleArmed}
          className={`px-3 py-1 rounded text-sm text-white ${armed ? 'bg-amber-600' : 'bg-slate-600'}`}>
          Intercept: {armed ? 'ON' : 'OFF'}
        </button>
      </div>
      <div className="flex flex-1 min-h-0">
        <div className="w-1/2 border-r border-slate-700 min-h-0">
          <CapturedTable rows={rows} selectedId={selectedId} onSelect={setSelectedId} />
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
