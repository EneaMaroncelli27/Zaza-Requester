import React, { useEffect, useState } from 'react'
import type { CapturedRequestDto } from '../../shared/intercept'

interface Props {
  req: CapturedRequestDto
  onForward: (edit: { method: string; url: string; headers: [string, string][]; body: string }) => void
  onDrop: () => void
  onSendToBuilder: (edit: { method: string; url: string; headers: [string, string][]; body: string }) => void
}

export default function RequestEditor({ req, onForward, onDrop, onSendToBuilder }: Props) {
  const [method, setMethod] = useState(req.method)
  const [url, setUrl] = useState(req.url)
  const [headers, setHeaders] = useState<[string, string][]>(req.headers)
  const [body, setBody] = useState(req.body)

  useEffect(() => {
    setMethod(req.method); setUrl(req.url); setHeaders(req.headers); setBody(req.body)
  }, [req.id])

  const edit = () => ({ method, url, headers, body })
  const setHeader = (i: number, k: string, v: string) =>
    setHeaders(headers.map((h, idx) => (idx === i ? [k, v] : h)))

  return (
    <div className="flex flex-col gap-2 p-3 text-sm text-slate-200">
      <div className="flex gap-2">
        <input value={method} onChange={(e) => setMethod(e.target.value)}
          className="w-24 bg-slate-700 rounded px-2 py-1 font-mono outline-none" />
        <input value={url} onChange={(e) => setUrl(e.target.value)}
          className="flex-1 bg-slate-700 rounded px-2 py-1 font-mono outline-none" />
      </div>
      <div className="max-h-32 overflow-auto">
        {headers.map(([k, v], i) => (
          <div key={i} className="flex gap-2 py-0.5">
            <input value={k} onChange={(e) => setHeader(i, e.target.value, v)}
              className="w-1/3 bg-slate-800 rounded px-2 py-0.5 font-mono outline-none" />
            <input value={v} onChange={(e) => setHeader(i, k, e.target.value)}
              className="flex-1 bg-slate-800 rounded px-2 py-0.5 font-mono outline-none" />
          </div>
        ))}
      </div>
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5}
        className="bg-slate-800 rounded px-2 py-1 font-mono text-xs outline-none resize-none" />
      <div className="flex gap-2">
        <button onClick={() => onForward(edit())}
          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 rounded text-white">Forward</button>
        <button onClick={onDrop}
          className="px-3 py-1 bg-red-600 hover:bg-red-500 rounded text-white">Drop</button>
        <button onClick={() => onSendToBuilder(edit())}
          className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 rounded text-white">Send to builder</button>
      </div>
    </div>
  )
}
