import React, { useEffect } from 'react'
import Sidebar from './components/Sidebar'
import RequestPanel from './components/RequestPanel'
import ResponsePanel from './components/ResponsePanel'
import { useStore } from './store/useStore'
import { useResizableSplit } from './hooks/useResizableSplit'

export default function App() {
  const initStore = useStore((s) => s.initStore)
  const initialized = useStore((s) => s.initialized)
  const { containerRef, ratio, dragging, onMouseDown } = useResizableSplit()

  useEffect(() => {
    initStore()
    // Subscribe here (not in initStore) with a disposer so StrictMode's
    // double-invoke doesn't leave two handlers loading each request twice.
    const off = window.api.onLoadRequest((req) => useStore.getState().importRequest(req))
    return off
  }, [initStore])

  if (!initialized) {
    return (
      <div className="flex items-center justify-center h-screen bg-app text-ink-dim">
        Loading…
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-app overflow-hidden">
      <Sidebar />
      <div ref={containerRef} className="flex flex-col flex-1 overflow-hidden">
        <div
          className="flex flex-col min-h-0 overflow-hidden"
          style={{ flexBasis: `${ratio * 100}%`, flexGrow: 0, flexShrink: 0 }}
        >
          <RequestPanel />
        </div>

        {/* Draggable divider */}
        <div
          onMouseDown={onMouseDown}
          className={`group relative h-1 shrink-0 cursor-row-resize bg-hair transition-colors ${
            dragging ? 'bg-slate-500' : 'hover:bg-slate-600'
          }`}
        >
          <div className="absolute inset-x-0 -top-1 -bottom-1" />
        </div>

        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <ResponsePanel />
        </div>
      </div>
    </div>
  )
}
