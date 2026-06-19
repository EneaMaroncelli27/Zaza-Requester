import React, { useEffect } from 'react'
import Sidebar from './components/Sidebar'
import RequestPanel from './components/RequestPanel'
import ResponsePanel from './components/ResponsePanel'
import InterceptApp from './intercept/InterceptApp'
import { useStore } from './store/useStore'
import { useResizableSplit } from './hooks/useResizableSplit'

function BuilderView() {
  const { containerRef, ratio, dragging, onMouseDown } = useResizableSplit()

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

export default function App() {
  const initStore = useStore((s) => s.initStore)
  const initialized = useStore((s) => s.initialized)
  const view = useStore((s) => s.view)
  const setView = useStore((s) => s.setView)

  useEffect(() => {
    initStore()
    // Subscribe here (not in initStore) with a disposer so StrictMode's
    // double-invoke doesn't leave two handlers loading each request twice.
    // A request sent from intercept also pulls the window back to the builder.
    const off = window.api.onLoadRequest((req) => {
      useStore.getState().importRequest(req)
      useStore.getState().setView('builder')
    })
    return off
  }, [initStore])

  // Keep the native intercept browser overlay (owned by the main process) in
  // sync with the current view. Switching to 'intercept' attaches + shows it;
  // any other view hides it so the builder is fully visible.
  useEffect(() => {
    if (view === 'intercept') window.api.showIntercept()
    else window.api.showBuilder()
  }, [view])

  if (!initialized) {
    return (
      <div className="flex items-center justify-center h-screen bg-app text-ink-dim">
        Loading…
      </div>
    )
  }

  if (view === 'intercept') {
    return <InterceptApp onBack={() => setView('builder')} />
  }

  return <BuilderView />
}
