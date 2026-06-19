import React from 'react'
import { Check, X } from 'lucide-react'
import type { CapturedRequestDto } from '../../shared/intercept'

interface Props {
  rows: CapturedRequestDto[]
  selectedId: string | null
  onSelect: (id: string) => void
  onForward: (id: string) => void
  onDrop: (id: string) => void
}

export default function CapturedTable({ rows, selectedId, onSelect, onForward, onDrop }: Props) {
  return (
    <div className="overflow-auto h-full text-xs font-mono">
      {rows.length === 0 ? (
        <p className="p-3 text-slate-500 italic">No requests captured yet.</p>
      ) : rows.map((r) => (
        <div key={r.id} onClick={() => onSelect(r.id)}
          className={`group flex items-center gap-2 px-3 py-1 cursor-pointer ${selectedId === r.id ? 'bg-slate-700' : 'hover:bg-slate-700/40'}`}>
          {r.paused && <span className="text-amber-400">⏸</span>}
          <span className="w-16 text-emerald-400">{r.method}</span>
          <span className="flex-1 truncate text-slate-300">{r.url}</span>
          {/* Quick-resolve a parked request without opening the editor. */}
          {r.paused && (
            <span className="flex gap-1 shrink-0">
              <button title="Forward" onClick={(e) => { e.stopPropagation(); onForward(r.id) }}
                className="p-0.5 rounded text-emerald-400 hover:bg-emerald-600 hover:text-white transition-colors">
                <Check size={14} />
              </button>
              <button title="Drop" onClick={(e) => { e.stopPropagation(); onDrop(r.id) }}
                className="p-0.5 rounded text-red-400 hover:bg-red-600 hover:text-white transition-colors">
                <X size={14} />
              </button>
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
