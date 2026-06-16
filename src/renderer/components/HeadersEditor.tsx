import React from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useStore } from '../store/useStore'
import type { Header } from '@shared/types'

export default function HeadersEditor() {
  const headers = useStore((s) => s.currentRequest.headers)
  const setHeaders = useStore((s) => s.setHeaders)

  const update = (index: number, patch: Partial<Header>) => {
    setHeaders(headers.map((h, i) => (i === index ? { ...h, ...patch } : h)))
  }

  const remove = (index: number) => {
    setHeaders(headers.filter((_, i) => i !== index))
  }

  const add = () => {
    setHeaders([...headers, { key: '', value: '', enabled: true }])
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto">
        {headers.length === 0 ? (
          <p className="text-slate-500 text-sm p-4">No headers. Click + to add one.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-700">
                <th className="w-8 py-2 px-3"></th>
                <th className="py-2 px-2">Key</th>
                <th className="py-2 px-2">Value</th>
                <th className="w-8 py-2 px-2"></th>
              </tr>
            </thead>
            <tbody>
              {headers.map((header, i) => (
                <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                  <td className="py-1 px-3">
                    <input
                      type="checkbox"
                      checked={header.enabled}
                      onChange={(e) => update(i, { enabled: e.target.checked })}
                      className="accent-indigo-500"
                    />
                  </td>
                  <td className="py-1 px-2">
                    <input
                      value={header.key}
                      onChange={(e) => update(i, { key: e.target.value })}
                      placeholder="Header name"
                      className="w-full bg-transparent text-slate-200 placeholder-slate-500 outline-none focus:text-white"
                    />
                  </td>
                  <td className="py-1 px-2">
                    <input
                      value={header.value}
                      onChange={(e) => update(i, { value: e.target.value })}
                      placeholder="Value"
                      className="w-full bg-transparent text-slate-200 placeholder-slate-500 outline-none focus:text-white"
                    />
                  </td>
                  <td className="py-1 px-2">
                    <button
                      onClick={() => remove(i)}
                      className="text-slate-500 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="p-3 border-t border-slate-700">
        <button
          onClick={add}
          className="flex items-center gap-1.5 text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          <Plus size={14} />
          Add header
        </button>
      </div>
    </div>
  )
}
