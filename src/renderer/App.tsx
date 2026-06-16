import React, { useEffect } from 'react'
import Sidebar from './components/Sidebar'
import RequestPanel from './components/RequestPanel'
import ResponsePanel from './components/ResponsePanel'
import { useStore } from './store/useStore'

export default function App() {
  const initStore = useStore((s) => s.initStore)
  const initialized = useStore((s) => s.initialized)

  useEffect(() => {
    initStore()
  }, [initStore])

  if (!initialized) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900 text-slate-400">
        Loading…
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-slate-900 overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <RequestPanel />
        </div>
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <ResponsePanel />
        </div>
      </div>
    </div>
  )
}
