import React from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { json } from '@codemirror/lang-json'
import { oneDark } from '@codemirror/theme-one-dark'
import { useStore } from '../store/useStore'
import type { BodyType } from '@shared/types'

const TABS: { label: string; value: BodyType }[] = [
  { label: 'None', value: 'none' },
  { label: 'Raw', value: 'raw' },
  { label: 'JSON', value: 'json' }
]

export default function BodyEditor() {
  const body = useStore((s) => s.currentRequest.body)
  const bodyType = useStore((s) => s.currentRequest.bodyType)
  const setBody = useStore((s) => s.setBody)
  const setBodyType = useStore((s) => s.setBodyType)

  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-1 px-3 pt-2 pb-1 border-b border-slate-700">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setBodyType(tab.value)}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              bodyType === tab.value
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {bodyType === 'none' ? (
        <div className="flex items-center justify-center flex-1 text-slate-500 text-sm">
          No body
        </div>
      ) : (
        <div className="flex-1 overflow-hidden">
          <CodeMirror
            value={body}
            onChange={setBody}
            theme={oneDark}
            extensions={bodyType === 'json' ? [json()] : []}
            basicSetup={{ lineNumbers: true, foldGutter: bodyType === 'json' }}
            style={{ height: '100%' }}
            className="h-full"
          />
        </div>
      )}
    </div>
  )
}
