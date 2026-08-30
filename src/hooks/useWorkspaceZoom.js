import { useCallback, useEffect, useRef, useState } from 'react'

export const WORKSPACE_ZOOM_MIN = 0.5
export const WORKSPACE_ZOOM_MAX = 2
export const WORKSPACE_ZOOM_STEP = 0.1

const STORAGE_KEY = 'quicknotes-workspace-zoom'
const CHANGE_EVENT = 'quicknotes:workspace-zoom'

const viewportClass = () => (
  typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches ? 'compact' : 'desktop'
)

const storageKey = (mode = viewportClass(), scope = 'workspace') => `${STORAGE_KEY}:${mode}:${scope}`

export const clampWorkspaceZoom = (value) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return 1
  return Math.min(WORKSPACE_ZOOM_MAX, Math.max(WORKSPACE_ZOOM_MIN, Math.round(numeric * 10) / 10))
}

const readStoredZoom = (scope = 'workspace') => {
  if (typeof window === 'undefined') return 1
  try {
    const mode = viewportClass()
    const stored = window.localStorage.getItem(storageKey(mode, scope))
    // Preserve the historic desktop preference but never force a desktop
    // magnification onto a phone on first use.
    const legacy = mode === 'desktop' && ['workspace', 'document'].includes(scope)
      ? window.localStorage.getItem(STORAGE_KEY)
      : null
    return clampWorkspaceZoom(stored || legacy || 1)
  } catch {
    return 1
  }
}

export function useWorkspaceZoom(rootRef, { enabled = true, scope = 'workspace' } = {}) {
  const [zoom, setZoomState] = useState(() => readStoredZoom(scope))
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
      window.localStorage.setItem(storageKey(viewportClass(), scope), String(nextValue))
    } catch {
      // Zoom remains available for this session when storage is unavailable.
    }
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, {
      detail: { zoom: nextValue, viewport: viewportClass(), scope },
    }))
  }, [scope])

  const zoomIn = useCallback(() => setZoom((current) => current + WORKSPACE_ZOOM_STEP), [setZoom])
  const zoomOut = useCallback(() => setZoom((current) => current - WORKSPACE_ZOOM_STEP), [setZoom])
  const resetZoom = useCallback(() => setZoom(1), [setZoom])

  useEffect(() => {
    const syncZoom = (event) => {
      const detail = typeof event.detail === 'object' ? event.detail : { zoom: event.detail, viewport: viewportClass() }
      if (detail.viewport !== viewportClass() || (detail.scope || 'workspace') !== scope) return
      const nextValue = clampWorkspaceZoom(detail.zoom)
      zoomRef.current = nextValue
      setZoomState(nextValue)
    }
    const media = window.matchMedia('(max-width: 767px)')
    const syncViewportZoom = () => {
      const nextValue = readStoredZoom(scope)
      zoomRef.current = nextValue
      setZoomState(nextValue)
    }
    window.addEventListener(CHANGE_EVENT, syncZoom)
    media.addEventListener?.('change', syncViewportZoom)
    return () => {
      window.removeEventListener(CHANGE_EVENT, syncZoom)
      media.removeEventListener?.('change', syncViewportZoom)
    }
  }, [scope])

  useEffect(() => {
    const nextValue = readStoredZoom(scope)
    zoomRef.current = nextValue
    setZoomState(nextValue)
  }, [scope])

  useEffect(() => {
    const root = rootRef?.current
    if (!enabled || !root) return undefined

    let lastWheelChange = 0
    const touchPoints = new Map()
    let pinch = null
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

    const distanceBetweenTouches = () => {
      const [first, second] = [...touchPoints.values()]
      return first && second ? Math.hypot(second.x - first.x, second.y - first.y) : 0
    }

    const handlePointerDown = (event) => {
      if (event.pointerType !== 'touch') return
      touchPoints.set(event.pointerId, { x: event.clientX, y: event.clientY })
      if (touchPoints.size !== 2) return
      const distance = distanceBetweenTouches()
      if (distance < 8) return
      pinch = { distance, zoom: zoomRef.current }
      event.preventDefault()
    }

    const handlePointerMove = (event) => {
      if (event.pointerType !== 'touch' || !touchPoints.has(event.pointerId)) return
      touchPoints.set(event.pointerId, { x: event.clientX, y: event.clientY })
      if (!pinch || touchPoints.size < 2) return
      const distance = distanceBetweenTouches()
      if (distance < 8) return
      event.preventDefault()
      event.stopPropagation()
      setZoom(pinch.zoom * (distance / pinch.distance))
    }

    const handlePointerEnd = (event) => {
      if (event.pointerType !== 'touch') return
      touchPoints.delete(event.pointerId)
      if (touchPoints.size < 2) pinch = null
    }

    root.addEventListener('wheel', handleWheel, { passive: false, capture: true })
    root.addEventListener('keydown', handleKeyDown, { capture: true })
    root.addEventListener('pointerdown', handlePointerDown, { passive: false, capture: true })
    root.addEventListener('pointermove', handlePointerMove, { passive: false, capture: true })
    root.addEventListener('pointerup', handlePointerEnd, { capture: true })
    root.addEventListener('pointercancel', handlePointerEnd, { capture: true })
    return () => {
      root.removeEventListener('wheel', handleWheel, { capture: true })
      root.removeEventListener('keydown', handleKeyDown, { capture: true })
      root.removeEventListener('pointerdown', handlePointerDown, { capture: true })
      root.removeEventListener('pointermove', handlePointerMove, { capture: true })
      root.removeEventListener('pointerup', handlePointerEnd, { capture: true })
      root.removeEventListener('pointercancel', handlePointerEnd, { capture: true })
    }
  }, [enabled, resetZoom, rootRef, setZoom, zoomIn, zoomOut])

  return { zoom, setZoom, zoomIn, zoomOut, resetZoom }
}
