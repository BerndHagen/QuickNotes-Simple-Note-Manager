import { useCallback, useEffect, useRef, useState } from 'react'

export const WORKSPACE_ZOOM_MIN = 0.5
export const WORKSPACE_ZOOM_MAX = 2
export const WORKSPACE_ZOOM_STEP = 0.1

const STORAGE_KEY = 'quicknotes-workspace-zoom'
const CHANGE_EVENT = 'quicknotes:workspace-zoom'

export const clampWorkspaceZoom = (value) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return 1
  return Math.min(WORKSPACE_ZOOM_MAX, Math.max(WORKSPACE_ZOOM_MIN, Math.round(numeric * 10) / 10))
}

const readStoredZoom = () => {
  if (typeof window === 'undefined') return 1
  try {
    return clampWorkspaceZoom(window.localStorage.getItem(STORAGE_KEY) || 1)
  } catch {
    return 1
  }
}

export function useWorkspaceZoom(rootRef, { enabled = true } = {}) {
  const [zoom, setZoomState] = useState(readStoredZoom)
  const zoomRef = useRef(zoom)

  useEffect(() => {
    zoomRef.current = zoom
  }, [zoom])

  const setZoom = useCallback((value) => {
    const nextValue = clampWorkspaceZoom(
      typeof value === 'function' ? value(zoomRef.current) : value
    )
    if (nextValue === zoomRef.current) return
    zoomRef.current = nextValue
    setZoomState(nextValue)
    try {
      window.localStorage.setItem(STORAGE_KEY, String(nextValue))
    } catch {
      // Zoom remains available for this session when storage is unavailable.
    }
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: nextValue }))
  }, [])

  const zoomIn = useCallback(() => setZoom((current) => current + WORKSPACE_ZOOM_STEP), [setZoom])
  const zoomOut = useCallback(() => setZoom((current) => current - WORKSPACE_ZOOM_STEP), [setZoom])
  const resetZoom = useCallback(() => setZoom(1), [setZoom])

  useEffect(() => {
    const syncZoom = (event) => {
      const nextValue = clampWorkspaceZoom(event.detail)
      zoomRef.current = nextValue
      setZoomState(nextValue)
    }
    window.addEventListener(CHANGE_EVENT, syncZoom)
    return () => window.removeEventListener(CHANGE_EVENT, syncZoom)
  }, [])

  useEffect(() => {
    const root = rootRef?.current
    if (!enabled || !root) return undefined

    let lastWheelChange = 0
    const handleWheel = (event) => {
      if (!event.ctrlKey && !event.metaKey) return
      event.preventDefault()
      event.stopPropagation()

      const now = performance.now()
      if (now - lastWheelChange < 45 || event.deltaY === 0) return
      lastWheelChange = now
      if (event.deltaY < 0) zoomIn()
      else zoomOut()
    }

    const handleKeyDown = (event) => {
      if (!event.ctrlKey && !event.metaKey) return
      const key = event.key
      if (!['+', '=', '-', '_', '0'].includes(key)) return
      event.preventDefault()
      event.stopPropagation()
      if (key === '0') resetZoom()
      else if (key === '+' || key === '=') zoomIn()
      else zoomOut()
    }

    root.addEventListener('wheel', handleWheel, { passive: false, capture: true })
    root.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => {
      root.removeEventListener('wheel', handleWheel, { capture: true })
      root.removeEventListener('keydown', handleKeyDown, { capture: true })
    }
  }, [enabled, resetZoom, rootRef, zoomIn, zoomOut])

  return { zoom, setZoom, zoomIn, zoomOut, resetZoom }
}
