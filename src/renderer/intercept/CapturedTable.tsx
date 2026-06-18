import React from 'react'
import type { CapturedRequestDto } from '../../shared/intercept'

interface Props {
  rows: CapturedRequestDto[]
  selectedId: string | null
  onSelect: (id: string) => void
}

export default function CapturedTable({ rows, selectedId, onSelect }: Props) {
  return (
    <div className="overflow-auto h-full text-xs font-mono">
      {rows.length === 0 ? (
        <p className="p-3 text-slate-500 italic">No requests captured yet.</p>
      ) : rows.map((r) => (
        <div key={r.id} onClick={() => onSelect(r.id)}
          className={`flex gap-2 px-3 py-1 cursor-pointer ${selectedId === r.id ? 'bg-slate-700' : 'hover:bg-slate-700/40'}`}>
          {r.paused && <span className="text-amber-400">⏸</span>}
          <span className="w-16 text-emerald-400">{r.method}</span>
          <span className="flex-1 truncate text-slate-300">{r.url}</span>
        </div>
      ))}
    </div>
  )
}
