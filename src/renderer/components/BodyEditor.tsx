import React, { useMemo, useRef } from 'react'
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror'
import { json } from '@codemirror/lang-json'
import { oneDark } from '@codemirror/theme-one-dark'
import { Wand2 } from 'lucide-react'
import { useStore } from '../store/useStore'
import { urlencodedLanguage } from '../lib/urlencodedLang'
import type { BodyType } from '@shared/types'

const TABS: { label: string; value: BodyType }[] = [
  { label: 'None', value: 'none' },
  { label: 'Raw', value: 'raw' },
  { label: 'JSON', value: 'json' },
  { label: 'URL Encoded', value: 'urlencoded' }
]

type JsonState = 'empty' | 'valid' | 'invalid'

export default function BodyEditor() {
  const body = useStore((s) => s.currentRequest.body)
  const bodyType = useStore((s) => s.currentRequest.bodyType)
  const setBody = useStore((s) => s.setBody)
  const setBodyType = useStore((s) => s.setBodyType)
  const bodyVersion = useStore((s) => s.bodyVersion)
  const cmRef = useRef<ReactCodeMirrorRef>(null)

  const jsonState: JsonState = useMemo(() => {
    if (bodyType !== 'json' || !body.trim()) return 'empty'
    try {
      JSON.parse(body)
      return 'valid'
    } catch {
      return 'invalid'
    }
  }, [body, bodyType])

  const format = () => {
    let pretty: string
    try {
      pretty = JSON.stringify(JSON.parse(body), null, 2)
    } catch {
      return // Format is disabled when invalid; guard anyway
    }
    // Drive the editor imperatively: an already-mounted editable CodeMirror
    // does not reflect external `value` prop changes (its onChange guard wins),
    // so replace the doc via a transaction. This also fires onChange → setBody.
    const view = cmRef.current?.view
    if (view) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: pretty } })
    } else {
      setBody(pretty)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1 px-3 pt-2 pb-1 border-b border-hair">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setBodyType(tab.value)}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              bodyType === tab.value
                ? 'bg-surface-2 text-ink'
                : 'text-ink-dim hover:text-ink'
            }`}
          >
            {tab.label}
          </button>
        ))}

        {bodyType === 'json' && (
          <div className="ml-auto flex items-center gap-3">
            {jsonState !== 'empty' && (
              <span className="flex items-center gap-1.5 text-xs">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    jsonState === 'valid' ? 'bg-emerald-400' : 'bg-red-400'
                  }`}
                />
                <span className={jsonState === 'valid' ? 'text-emerald-400' : 'text-red-400'}>
                  {jsonState === 'valid' ? 'valid' : 'invalid'}
                </span>
              </span>
            )}
            <button
              onClick={format}
              disabled={jsonState !== 'valid'}
              className="flex items-center gap-1.5 px-2 py-0.5 text-xs text-ink-dim hover:text-ink disabled:text-slate-600 border border-hair hover:border-slate-500 disabled:border-hair rounded transition-colors"
              title="Format JSON"
            >
              <Wand2 size={12} /> Format
            </button>
          </div>
        )}
      </div>

      {bodyType === 'none' ? (
        <div className="flex items-center justify-center flex-1 text-slate-500 text-sm">
          No body
        </div>
      ) : (
        <div className="flex-1 overflow-hidden">
          <CodeMirror
            key={`body-${bodyVersion}`}
            ref={cmRef}
            value={body}
            onChange={setBody}
            theme={oneDark}
            extensions={
              bodyType === 'json'
                ? [json()]
                : bodyType === 'urlencoded'
                  ? [urlencodedLanguage]
                  : []
            }
            basicSetup={{ lineNumbers: true, foldGutter: bodyType === 'json' }}
            style={{ height: '100%' }}
            className="h-full"
          />
        </div>
      )}
    </div>
  )
}
