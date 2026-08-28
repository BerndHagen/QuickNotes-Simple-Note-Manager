import { useCallback, useMemo, useRef, useState } from 'react'
import {
  ArrowUpRight,
  Circle,
  Eraser,
  Highlighter,
  Loader2,
  Minus,
  MousePointer2,
  Pencil,
  Redo2,
  RefreshCw,
  Square,
  Trash2,
  Type,
  Undo2,
} from 'lucide-react'
import { createSpatialBrushSettings } from '../../lib/spatial/brushes'
import { moveSpatialObject, normalizeBounds, objectAtPoint, resizeSpatialObject, screenToWorld } from '../../lib/spatial/geometry'
import { createBoundedObject, createShapeObject, createStrokeObject } from '../../lib/spatial/model'
import InkCanvas from './InkCanvas'
import SpatialObjectLayer from './SpatialObjectLayer'
import useAnnotationWorkspace from './useAnnotationWorkspace'

const tools = [
  ['select', MousePointer2, 'Select annotation'],
  ['pen', Pencil, 'Pen annotation'],
  ['highlighter', Highlighter, 'Highlight annotation'],
  ['eraser', Eraser, 'Erase annotation stroke'],
  ['line', Minus, 'Line annotation'],
  ['arrow', ArrowUpRight, 'Arrow annotation'],
  ['rectangle', Square, 'Rectangle annotation'],
  ['ellipse', Circle, 'Ellipse annotation'],
  ['text', Type, 'Text annotation'],
]

const pointerSamples = (event) => {
  const values = event.getCoalescedEvents?.()
  return values?.length ? values : [event]
}
const pressure = (event) => event.pressure > 0 ? event.pressure : 0.5
const emptyChanges = () => ({ putObjects: [], deleteObjectIds: [], putPages: [], deletePageIds: [] })

export default function SpatialAnnotationOverlay({
  noteId,
  resourceId,
  pageNumber,
  logicalWidth,
  logicalHeight,
  displayWidth,
  displayHeight,
  readOnly = false,
  ownerId = null,
}) {
  const source = useMemo(() => ({
    noteId,
    resourceId,
    pageNumber,
    width: logicalWidth,
    height: logicalHeight,
    ownerId,
    createIfMissing: !readOnly,
  }), [logicalHeight, logicalWidth, noteId, ownerId, pageNumber, readOnly, resourceId])
  const { workspace, loading, loadError, cloudError, annotationConflict, saveStatus, canUndo, canRedo, commit, undo, redo, updateDraftObject, retrySave, resolveConflict } = useAnnotationWorkspace(source)
  const [tool, setTool] = useState('pen')
  const [brush, setBrush] = useState({ color: '#b42318', width: 3 })
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [editingTextId, setEditingTextId] = useState(null)
  const [dragPreview, setDragPreview] = useState(null)
  const [lasso, setLasso] = useState(null)
  const [shapePreview, setShapePreview] = useState(null)
  const gestureRef = useRef(null)
  const inkRef = useRef(null)
  const originalsRef = useRef(new Map())
  const surfaceRef = useRef(null)
  const objects = useMemo(() => workspace?.objects || [], [workspace?.objects])
  const page = workspace?.page
  const zoom = page?.width ? displayWidth / page.width : 1
  const viewport = useMemo(() => ({ panX: 0, panY: 0, zoom }), [zoom])
  const editingBlocked = readOnly || Boolean(annotationConflict)
  const nextZIndex = useCallback(() => objects.reduce((maximum, object) => Math.max(maximum, object.zIndex || 0), 0) + 1, [objects])
  const pointForEvent = useCallback((event, surface) => screenToWorld(event.clientX, event.clientY, surface.getBoundingClientRect(), viewport), [viewport])

  const beginTextEditing = useCallback((id) => {
    if (editingBlocked) return
    setEditingTextId(id)
    setSelectedIds(new Set([id]))
    requestAnimationFrame(() => surfaceRef.current?.querySelector(`[data-spatial-object-id="${id}"] textarea`)?.focus())
  }, [editingBlocked])

  const beginGesture = useCallback((event) => {
    if (!page || editingBlocked || event.pointerType === 'touch' || event.target.closest?.('textarea, .qn-spatial-resize-handle')) return
    const surface = event.currentTarget
    const point = pointForEvent(event, surface)
    surface.setPointerCapture?.(event.pointerId)
    surface.focus({ preventScroll: true })
    setEditingTextId(null)
    if (tool === 'pen' || tool === 'highlighter') {
      const settings = createSpatialBrushSettings(tool, brush)
      const sample = [point.x, point.y, pressure(event), event.tiltX || 0, event.tiltY || 0, event.timeStamp || 0]
      inkRef.current?.clearActive()
      gestureRef.current = { type: 'stroke', pointerId: event.pointerId, surface, points: [sample], brush: settings }
      return
    }
    if (tool === 'eraser') {
      const hit = objectAtPoint(objects, point, 7 / zoom)
      gestureRef.current = { type: 'erase', pointerId: event.pointerId, surface, erased: new Set(hit?.kind === 'stroke' ? [hit.id] : []) }
      return
    }
    if (['line', 'arrow', 'rectangle', 'ellipse'].includes(tool)) {
      gestureRef.current = { type: 'shape', pointerId: event.pointerId, surface, start: point, current: point, shape: tool }
      return
    }
    if (tool === 'text') {
      const object = createBoundedObject({ noteId, pageId: page.id, kind: 'text', point, zIndex: nextZIndex(), text: 'Annotation' })
      commit({ putObjects: [object] }, { label: 'Add annotation text' })
      surface.releasePointerCapture?.(event.pointerId)
      setTool('select')
      beginTextEditing(object.id)
      return
    }
    const hit = objectAtPoint(objects, point, 6 / zoom)
    if (hit) {
      const selection = event.shiftKey ? new Set(selectedIds) : new Set()
      if (event.shiftKey && selection.has(hit.id)) selection.delete(hit.id)
      else selection.add(hit.id)
      setSelectedIds(selection)
      gestureRef.current = {
        type: 'drag', pointerId: event.pointerId, surface, start: point, current: point,
        originals: objects.filter((object) => selection.has(object.id)).map((object) => structuredClone(object)),
      }
    } else {
      if (!event.shiftKey) setSelectedIds(new Set())
      gestureRef.current = { type: 'lasso', pointerId: event.pointerId, surface, start: point, current: point, append: event.shiftKey }
      setLasso({ x: point.x, y: point.y, width: 0, height: 0 })
    }
  }, [beginTextEditing, brush, commit, editingBlocked, nextZIndex, noteId, objects, page, pointForEvent, selectedIds, tool, zoom])

  const moveGesture = useCallback((event) => {
    const gesture = gestureRef.current
    if (!gesture || gesture.pointerId !== event.pointerId) return
    if (gesture.type === 'stroke') {
      for (const sampleEvent of pointerSamples(event)) {
        const point = pointForEvent(sampleEvent, gesture.surface)
        const sample = [point.x, point.y, pressure(sampleEvent), sampleEvent.tiltX || 0, sampleEvent.tiltY || 0, sampleEvent.timeStamp || 0]
        const previous = gesture.points.at(-1)
        if (Math.hypot(sample[0] - previous[0], sample[1] - previous[1]) < 0.2) continue
        gesture.points.push(sample)
        inkRef.current?.drawSegment(previous, sample, gesture.brush)
      }
      return
    }
    const point = pointForEvent(event, gesture.surface)
    gesture.current = point
    if (gesture.type === 'erase') {
      const hit = objectAtPoint(objects, point, 7 / zoom)
      if (hit?.kind === 'stroke') gesture.erased.add(hit.id)
    } else if (gesture.type === 'shape') {
      const preview = createShapeObject({ noteId, pageId: page.id, shape: gesture.shape, start: gesture.start, end: point, color: brush.color, width: brush.width, zIndex: nextZIndex() })
      preview.id = 'annotation-shape-preview'
      setShapePreview(preview)
    } else if (gesture.type === 'drag') {
      setDragPreview({ dx: point.x - gesture.start.x, dy: point.y - gesture.start.y })
    } else if (gesture.type === 'lasso') {
      setLasso({ x: gesture.start.x, y: gesture.start.y, width: point.x - gesture.start.x, height: point.y - gesture.start.y })
    } else if (gesture.type === 'resize') {
      setDragPreview({ resizeWidth: gesture.original.bounds.width + point.x - gesture.start.x, resizeHeight: gesture.original.bounds.height + point.y - gesture.start.y })
    }
  }, [brush.color, brush.width, nextZIndex, noteId, objects, page?.id, pointForEvent, zoom])

  const finishGesture = useCallback((event, cancelled = false) => {
    const gesture = gestureRef.current
    if (!gesture || gesture.pointerId !== event.pointerId) return
    gestureRef.current = null
    gesture.surface.releasePointerCapture?.(event.pointerId)
    if (gesture.type === 'stroke') {
      inkRef.current?.clearActive()
      if (!cancelled && gesture.points.length > 1) {
        const object = createStrokeObject({ noteId, pageId: page.id, points: gesture.points, ...gesture.brush, zIndex: nextZIndex() })
        commit({ putObjects: [object] }, { label: gesture.brush.brush === 'highlighter' ? 'Highlight attachment' : 'Annotate attachment' })
      }
    } else if (gesture.type === 'erase' && !cancelled && gesture.erased.size) {
      commit({ deleteObjectIds: [...gesture.erased] }, { label: 'Erase annotation strokes' })
    } else if (gesture.type === 'shape') {
      setShapePreview(null)
      if (!cancelled && gesture.current && Math.hypot(gesture.current.x - gesture.start.x, gesture.current.y - gesture.start.y) > 3) {
        const object = createShapeObject({ noteId, pageId: page.id, shape: gesture.shape, start: gesture.start, end: gesture.current, color: brush.color, width: brush.width, zIndex: nextZIndex() })
        commit({ putObjects: [object] }, { label: `Add annotation ${gesture.shape}` })
        setSelectedIds(new Set([object.id]))
      }
    } else if (gesture.type === 'drag') {
      const delta = gesture.current ? { dx: gesture.current.x - gesture.start.x, dy: gesture.current.y - gesture.start.y } : null
      setDragPreview(null)
      if (!cancelled && delta && (delta.dx || delta.dy)) {
        const moved = gesture.originals.map((object) => moveSpatialObject(object, delta.dx, delta.dy))
        commit({ putObjects: moved }, { label: 'Move annotations', inverse: { ...emptyChanges(), putObjects: gesture.originals } })
      }
    } else if (gesture.type === 'lasso') {
      const bounds = gesture.current ? normalizeBounds({ x: gesture.start.x, y: gesture.start.y, width: gesture.current.x - gesture.start.x, height: gesture.current.y - gesture.start.y }) : null
      setLasso(null)
      if (!cancelled && bounds) {
        const ids = objects.filter((object) => {
          const box = normalizeBounds(object.bounds)
          return box.x <= bounds.x + bounds.width && box.x + box.width >= bounds.x && box.y <= bounds.y + bounds.height && box.y + box.height >= bounds.y
        }).map((object) => object.id)
        setSelectedIds((current) => new Set(gesture.append ? [...current, ...ids] : ids))
      }
    } else if (gesture.type === 'resize') {
      const preview = gesture.current ? { width: gesture.original.bounds.width + gesture.current.x - gesture.start.x, height: gesture.original.bounds.height + gesture.current.y - gesture.start.y } : null
      setDragPreview(null)
      if (!cancelled && preview) commit({ putObjects: [resizeSpatialObject(gesture.original, preview.width, preview.height)] }, { label: 'Resize annotation', inverse: { ...emptyChanges(), putObjects: [gesture.original] } })
    }
  }, [brush.color, brush.width, commit, nextZIndex, noteId, objects, page?.id])

  const resizePointerDown = useCallback((event, object) => {
    event.preventDefault()
    event.stopPropagation()
    const surface = surfaceRef.current
    if (!surface) return
    gestureRef.current = { type: 'resize', pointerId: event.pointerId, surface, start: pointForEvent(event, surface), current: null, original: structuredClone(object) }
  }, [pointForEvent])

  const deleteSelection = useCallback(() => {
    if (!selectedIds.size) return
    commit({ deleteObjectIds: [...selectedIds] }, { label: 'Delete annotations' })
    setSelectedIds(new Set())
  }, [commit, selectedIds])

  const textDraft = useCallback((object, text) => {
    if (!originalsRef.current.has(object.id)) originalsRef.current.set(object.id, structuredClone(object))
    updateDraftObject({ ...object, data: { ...object.data, text }, updatedAt: new Date().toISOString() })
  }, [updateDraftObject])
  const textBlur = useCallback((object) => {
    const original = originalsRef.current.get(object.id)
    const current = (workspace?.objects || []).find((candidate) => candidate.id === object.id)
    originalsRef.current.delete(object.id)
    setEditingTextId(null)
    if (original && current && original.data.text !== current.data.text) {
      commit({ putObjects: [current] }, { label: 'Edit annotation text', inverse: { ...emptyChanges(), putObjects: [original] } })
    }
  }, [commit, workspace?.objects])

  const handleKeyDown = (event) => {
    if (event.target.closest?.('textarea')) return
    const modifier = event.ctrlKey || event.metaKey
    if (modifier && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo() }
    else if (modifier && event.key.toLowerCase() === 'y') { event.preventDefault(); redo() }
    else if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); deleteSelection() }
    else if (event.key === 'Escape') { setSelectedIds(new Set()); setEditingTextId(null); setTool('select') }
  }

  if (loading) return <div className="absolute inset-0 flex items-center justify-center bg-black/5" role="status"><Loader2 className="h-5 w-5 animate-spin" /> <span className="qn-sr-only">Loading annotations</span></div>
  if (loadError) return <div className="absolute inset-x-3 top-3 z-20 border border-danger bg-danger-soft p-2 text-ui-sm text-danger-text" role="alert">{loadError.message}</div>

  return (
    <div className="absolute inset-0 z-10" style={{ width: displayWidth, height: displayHeight }}>
      {annotationConflict && (
        <div role="alert" className="absolute inset-x-2 top-12 z-40 border border-warning-border bg-warning-soft px-3 py-2 text-ui-sm text-warning-text shadow-sm">
          <p className="font-medium">This annotation changed on another device.</p>
          <p className="mt-1 text-ui-xs">Your local overlay remains saved. Choose a version before drawing again.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className="rounded-control border border-warning-border px-2 py-1 font-medium" onClick={() => void resolveConflict('incoming')}>Use incoming</button>
            <button type="button" className="rounded-control bg-warning-text px-2 py-1 font-medium text-surface" onClick={() => void resolveConflict('local')}>Keep mine</button>
          </div>
        </div>
      )}
      <div className="absolute left-2 top-2 z-30 flex max-w-[calc(100%-1rem)] items-center gap-1 overflow-x-auto rounded-control border border-strong bg-surface-raised/95 p-1 shadow-sm" role="toolbar" aria-label="Annotation tools">
        {tools.map(([id, Icon, label]) => (
          <button key={id} type="button" aria-label={label} title={label} aria-pressed={tool === id} onClick={() => setTool(id)} className={`qn-square-control flex h-8 w-8 shrink-0 items-center justify-center rounded-control ${tool === id ? 'bg-accent-soft text-accent-text' : 'text-content-muted hover:bg-surface-hover'}`} disabled={editingBlocked}>
            <Icon className="h-4 w-4" aria-hidden="true" />
          </button>
        ))}
        <span className="mx-0.5 h-5 border-l border-subtle" aria-hidden="true" />
        <label className="flex h-8 w-8 shrink-0 items-center justify-center" title="Annotation color"><span className="qn-sr-only">Annotation color</span><input type="color" value={brush.color} onChange={(event) => setBrush((value) => ({ ...value, color: event.target.value }))} className="h-5 w-5" /></label>
        <button type="button" aria-label="Undo annotation" title="Undo" onClick={undo} disabled={editingBlocked || !canUndo} className="qn-square-control flex h-8 w-8 shrink-0 items-center justify-center rounded-control text-content-muted hover:bg-surface-hover disabled:opacity-35"><Undo2 className="h-4 w-4" /></button>
        <button type="button" aria-label="Redo annotation" title="Redo" onClick={redo} disabled={editingBlocked || !canRedo} className="qn-square-control flex h-8 w-8 shrink-0 items-center justify-center rounded-control text-content-muted hover:bg-surface-hover disabled:opacity-35"><Redo2 className="h-4 w-4" /></button>
        <button type="button" aria-label="Delete selected annotations" title="Delete selection" onClick={deleteSelection} disabled={editingBlocked || !selectedIds.size} className="qn-square-control flex h-8 w-8 shrink-0 items-center justify-center rounded-control text-danger-text hover:bg-danger-soft disabled:opacity-35"><Trash2 className="h-4 w-4" /></button>
      </div>
      <div className="absolute bottom-2 right-2 z-30 rounded-control border border-subtle bg-surface-raised/95 px-2 py-1 text-ui-xs text-content-muted shadow-xs" role="status" aria-live="polite">
        {saveStatus === 'saving'
          ? 'Saving annotations…'
          : saveStatus === 'error'
            ? <button type="button" onClick={retrySave} className="flex items-center gap-1 text-danger-text"><RefreshCw className="h-3 w-3" /> Retry save</button>
            : cloudError
              ? <span className="text-warning-text" title={cloudError.message}>Saved on this device · Cloud retry pending</span>
              : `${objects.length} annotation${objects.length === 1 ? '' : 's'} · Saved`}
      </div>
      <div
        ref={surfaceRef}
        role="application"
        tabIndex={0}
        aria-label={`Annotations for source page ${pageNumber}`}
        className="qn-spatial-interaction-surface absolute inset-0 outline-none"
        style={{ width: displayWidth, height: displayHeight, touchAction: 'pan-x pan-y' }}
        onKeyDown={handleKeyDown}
        onPointerDown={beginGesture}
        onPointerMove={moveGesture}
        onPointerUp={finishGesture}
        onPointerCancel={(event) => finishGesture(event, true)}
        onLostPointerCapture={(event) => finishGesture(event, true)}
        onDoubleClick={(event) => {
          const object = objectAtPoint(objects, pointForEvent(event, event.currentTarget), 6 / zoom)
          if (object?.kind === 'text') beginTextEditing(object.id)
        }}
      >
        <InkCanvas ref={inkRef} objects={objects} viewport={viewport} />
        <SpatialObjectLayer
          objects={objects}
          selectedIds={selectedIds}
          editingTextId={editingTextId}
          viewport={viewport}
          viewportSize={{ width: displayWidth, height: displayHeight }}
          canvasMode
          dragPreview={dragPreview}
          lasso={lasso}
          shapePreview={shapePreview}
          resolveNoteTitle={() => ''}
          resolveResource={() => null}
          onDraft={textDraft}
          onTextFocus={(object) => { if (!originalsRef.current.has(object.id)) originalsRef.current.set(object.id, structuredClone(object)) }}
          onTextBlur={textBlur}
          onResizePointerDown={resizePointerDown}
          onOpenNote={() => {}}
        />
      </div>
    </div>
  )
}
