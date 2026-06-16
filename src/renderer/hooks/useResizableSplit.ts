import { useCallback, useEffect, useRef, useState } from 'react'

const STORAGE_KEY = 'zr:split-ratio'
const MIN = 0.2
const MAX = 0.8

function clamp(n: number): number {
  return Math.min(MAX, Math.max(MIN, n))
}

function loadRatio(): number {
  const raw = localStorage.getItem(STORAGE_KEY)
  const n = raw ? Number(raw) : NaN
  return Number.isFinite(n) ? clamp(n) : 0.5
}

/**
 * Vertical drag-to-resize between two stacked panels. Returns the top panel's
 * ratio (0.2–0.8), a ref to attach to the containing column, and a mousedown
 * handler for the divider. Dependency-free; persists to localStorage.
 */
export function useResizableSplit() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [ratio, setRatio] = useState<number>(loadRatio)
  const [dragging, setDragging] = useState(false)

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setDragging(true)
  }, [])

  useEffect(() => {
    if (!dragging) return

    const onMove = (e: MouseEvent) => {
      const el = containerRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      if (rect.height === 0) return
      setRatio(clamp((e.clientY - rect.top) / rect.height))
    }

    const onUp = () => {
      setDragging(false)
      setRatio((r) => {
        localStorage.setItem(STORAGE_KEY, String(r))
        return r
      })
    }

    // Avoid text selection / iframe (CodeMirror) stealing the drag.
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'row-resize'
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [dragging])

  return { containerRef, ratio, dragging, onMouseDown }
}
