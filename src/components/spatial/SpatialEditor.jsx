import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Copy,
  FilePlus2,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useNotesStore } from '../../store'
import { generateId } from '../../lib/utils'
import { MAX_NOTE_TITLE_LENGTH } from '../../lib/dataValidation'
import {
  boundsIntersect,
  clamp,
  moveSpatialObject,
  normalizeBounds,
  objectAtPoint,
  resizeSpatialObject,
  screenToWorld,
} from '../../lib/spatial/geometry'
import {
  createBoundedObject,
  createImageObject,
  createImageResource,
  createPaperPage,
  createShapeObject,
  createStrokeObject,
  normalizeViewport,
  PAPER_SIZES,
  SPATIAL_LIMITS,
} from '../../lib/spatial/model'
import { exportSpatialPdf, exportSpatialPng } from '../../lib/spatial/export'
import { createSpatialBrushSettings } from '../../lib/spatial/brushes'
import { buildInkReplay, inkObjectsAtReplayTime } from '../../lib/spatial/replay'
import { recognizeInkShape } from '../../lib/spatial/shapeRecognition'
import { isBrowserHandwritingSupported } from '../../lib/intelligence/browserHandwriting'
import HandwritingRecognitionModal from './HandwritingRecognitionModal'
import InkCanvas from './InkCanvas'
import ImageOcrModal from './ImageOcrModal'
import PaperPageThumbnail from './PaperPageThumbnail'
import SpatialObjectLayer from './SpatialObjectLayer'
import SpatialToolbar from './SpatialToolbar'
import AttachmentAnnotationModal from './AttachmentAnnotationModal'
import useSpatialWorkspace from './useSpatialWorkspace'

let spatialClipboard = null
const EMPTY_SPATIAL_OBJECTS = Object.freeze([])

const emptyChangeSet = () => ({
  putObjects: [],
  deleteObjectIds: [],
  putPages: [],
  deletePageIds: [],
})

const normalizePressure = (event) => {
  if (Number.isFinite(event.pressure) && event.pressure > 0) return event.pressure
  return event.buttons || event.pointerType === 'touch' || event.pointerType === 'pen' ? 0.5 : 0.5
}

const pointerSamples = (event) => {
  if (typeof event.getCoalescedEvents === 'function') {
    const coalesced = event.getCoalescedEvents()
    if (coalesced.length > 0) return coalesced
  }
  return [event]
}

const isTextTarget = (target) => target.closest?.('input, textarea, select, [contenteditable="true"]')

const createDisplayThumbnail = (image, mimeType) => {
  const maximumDimension = 1600
  const scale = Math.min(1, maximumDimension / Math.max(image.naturalWidth, image.naturalHeight))
  if (scale === 1) return null
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
  canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL(mimeType === 'image/jpeg' ? 'image/jpeg' : 'image/png', 0.86)
}

function PageRail({ pages, objectsForPage, activePageId, onSelect, onAdd, onDuplicate, onDelete, onMove, resolveNoteTitle, resolveResource, editingDisabled = false }) {
  return (
    <aside className="qn-paper-page-rail" aria-label="Paper pages">
      <div className="qn-paper-page-rail__header">
        <span>Pages</span>
        <button type="button" onClick={onAdd} aria-label="Add page" title="Add page" disabled={editingDisabled}><Plus className="h-3.5 w-3.5" /></button>
      </div>
      <ol>
        {pages.map((page, index) => (
          <li key={page.id} data-active={page.id === activePageId ? 'true' : 'false'}>
            <button type="button" className="qn-paper-page-entry" onClick={() => onSelect(page.id)}>
              <span className="qn-paper-page-preview">
                <PaperPageThumbnail
                  page={page}
                  objects={objectsForPage(page.id)}
                  resolveNoteTitle={resolveNoteTitle}
                  resolveResource={resolveResource}
                />
                <span className="qn-paper-page-index" aria-hidden="true">{index + 1}</span>
              </span>
              <span className="qn-sr-only">Page {index + 1}</span>
            </button>
            {page.id === activePageId && (
              <div className="qn-paper-page-actions">
                <button type="button" onClick={() => onMove(-1)} disabled={editingDisabled || index === 0} aria-label="Move page up"><ChevronUp className="h-3 w-3" /></button>
                <button type="button" onClick={() => onMove(1)} disabled={editingDisabled || index === pages.length - 1} aria-label="Move page down"><ChevronDown className="h-3 w-3" /></button>
                <button type="button" onClick={onDuplicate} aria-label="Duplicate page" disabled={editingDisabled}><Copy className="h-3 w-3" /></button>
                <button type="button" onClick={onDelete} disabled={editingDisabled || pages.length === 1} aria-label="Delete page"><Trash2 className="h-3 w-3" /></button>
              </div>
            )}
          </li>
        ))}
      </ol>
    </aside>
  )
}

export default function SpatialEditor({ note, kind, noteTitle, onTitleChange, readOnly = false, navigationTarget = null, onNavigationComplete }) {
  const {
    workspace,
    loading,
    loadError,
    saveStatus,
    spatialConflict,
    canUndo,
    canRedo,
    commit,
    undo,
    redo,
    retrySave,
    updateDraftObject,
    resolveConflict,
  } = useSpatialWorkspace(note, kind)
  const editingBlocked = readOnly || Boolean(spatialConflict)
  const notes = useNotesStore((state) => state.notes)
  const navigateToKnowledgeTarget = useNotesStore((state) => state.navigateToKnowledgeTarget)
  const markSpatialNotePersisted = useNotesStore((state) => state.markSpatialNotePersisted)
  const [tool, setTool] = useState('pen')
  const [brush, setBrush] = useState({ color: '#18352a', width: 2.5 })
  const [replay, setReplay] = useState({ active: false, playing: false, elapsed: 0 })
  const [viewport, setViewport] = useState(() => normalizeViewport(null, kind))
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [editingTextId, setEditingTextId] = useState(null)
  const [activePageId, setActivePageId] = useState(null)
  const [dragPreview, setDragPreview] = useState(null)
  const [lasso, setLasso] = useState(null)
  const [shapePreview, setShapePreview] = useState(null)
  const [noteLinkTarget, setNoteLinkTarget] = useState('')
  const [exporting, setExporting] = useState(false)
  const [imageOcrOpen, setImageOcrOpen] = useState(false)
  const [imageAnnotationOpen, setImageAnnotationOpen] = useState(false)
  const [handwritingRecognitionOpen, setHandwritingRecognitionOpen] = useState(false)
  const [surfaceSize, setSurfaceSize] = useState({ width: 0, height: 0 })
  const imageInputRef = useRef(null)
  const stageRef = useRef(null)
  const gestureRef = useRef(null)
  const inkRefs = useRef(new Map())
  const activePenPointerRef = useRef(null)
  const initializedNoteRef = useRef(null)
  const viewportSaveTimerRef = useRef(null)
  const textOriginalRef = useRef(new Map())
  const textSaveTimersRef = useRef(new Map())
  const flushTextDraftsRef = useRef(() => {})
  const brushColorExplicitRef = useRef(false)
  const latestWorkspaceRef = useRef(workspace)

  latestWorkspaceRef.current = workspace
  const pages = useMemo(() => workspace?.pages || [], [workspace?.pages])
  const objects = useMemo(() => workspace?.objects || [], [workspace?.objects])
  const visibleObjects = useMemo(() => objects.filter((object) => !object.data?.hidden), [objects])
  const objectsByPage = useMemo(() => {
    const grouped = new Map()
    for (const object of visibleObjects) {
      const current = grouped.get(object.pageId) || []
      current.push(object)
      grouped.set(object.pageId, current)
    }
    return grouped
  }, [visibleObjects])
  const replayTimeline = useMemo(() => buildInkReplay(objects), [objects])
  const replayInkObjects = useMemo(
    () => replay.active ? inkObjectsAtReplayTime(replayTimeline, replay.elapsed) : null,
    [replay.active, replay.elapsed, replayTimeline]
  )
  const activePage = pages.find((page) => page.id === activePageId) || pages[0] || null
  const resources = useMemo(() => workspace?.resources || [], [workspace?.resources])
  const selectedSticky = useMemo(() => {
    if (selectedIds.size !== 1) return null
    const object = objects.find((candidate) => selectedIds.has(candidate.id))
    return object?.kind === 'sticky' ? object : null
  }, [objects, selectedIds])
  const selectedImage = useMemo(() => {
    if (selectedIds.size !== 1) return null
    const object = objects.find((candidate) => selectedIds.has(candidate.id))
    if (object?.kind !== 'image') return null
    const resource = resources.find((candidate) => candidate.id === object.data?.resourceId)
    return resource ? { object, resource } : null
  }, [objects, resources, selectedIds])
  const selectedInk = useMemo(() => {
    if (selectedIds.size === 0) return []
    const selected = objects.filter((object) => selectedIds.has(object.id))
    if (selected.length !== selectedIds.size || selected.some((object) => object.kind !== 'stroke')) return []
    if (new Set(selected.map((object) => object.pageId || null)).size !== 1) return []
    return selected
  }, [objects, selectedIds])
  const shapeCandidate = useMemo(() => selectedInk.length === 1 ? recognizeInkShape(selectedInk[0]) : null, [selectedInk])
  const canRecognizeHandwriting = selectedInk.length > 0 && !editingBlocked && isBrowserHandwritingSupported()
  const objectSummary = useMemo(() => {
    const counts = new Map()
    for (const object of visibleObjects) counts.set(object.kind, (counts.get(object.kind) || 0) + 1)
    if (counts.size === 0) return 'No spatial objects yet.'
    return [...counts.entries()]
      .map(([objectKind, count]) => `${count} ${objectKind === 'stroke' ? 'ink stroke' : objectKind}${count === 1 ? '' : 's'}`)
      .join(', ') + '. Raw handwriting does not yet have a text transcription.'
  }, [visibleObjects])
  const pageObjects = useCallback((pageId) => objectsByPage.get(pageId) || EMPTY_SPATIAL_OBJECTS, [objectsByPage])
  const linkableNotes = useMemo(
    () => notes.filter((candidate) => candidate.id !== note.id && !candidate.deleted),
    [note.id, notes]
  )

  const resolveNoteTitle = useCallback((noteId) => (
    notes.find((candidate) => candidate.id === noteId)?.title || 'Missing note'
  ), [notes])
  const resolveResource = useCallback((resourceId) => (
    resources.find((resource) => resource.id === resourceId) || null
  ), [resources])

  useEffect(() => {
    if (!workspace || initializedNoteRef.current === note.id) return
    initializedNoteRef.current = note.id
    setViewport(normalizeViewport(workspace.document.viewport, kind))
    setActivePageId(workspace.pages[0]?.id || null)
    setSelectedIds(new Set())
    setEditingTextId(null)
  }, [kind, note.id, workspace])

  useEffect(() => {
    if (!workspace || !navigationTarget || navigationTarget.noteId !== note.id) return undefined
    const targetObject = navigationTarget.objectId
      ? workspace.objects.find((object) => object.id === navigationTarget.objectId)
      : null
    if (!targetObject && navigationTarget.pageId && workspace.pages.some((page) => page.id === navigationTarget.pageId)) {
      setActivePageId(navigationTarget.pageId)
    }
    if (targetObject) {
      if (targetObject.pageId) setActivePageId(targetObject.pageId)
      setSelectedIds(new Set([targetObject.id]))
      if (kind === 'canvas') {
        const centerX = targetObject.bounds.x + targetObject.bounds.width / 2
        const centerY = targetObject.bounds.y + targetObject.bounds.height / 2
        setViewport((current) => normalizeViewport({
          ...current,
          panX: surfaceSize.width / 2 - centerX * current.zoom,
          panY: surfaceSize.height / 2 - centerY * current.zoom,
        }, kind))
      }
    }
    const frame = requestAnimationFrame(() => {
      if (targetObject) {
        document.querySelector(`[data-spatial-object-id="${targetObject.id}"]`)
          ?.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' })
      }
      onNavigationComplete?.(navigationTarget.token)
    })
    return () => cancelAnimationFrame(frame)
  }, [kind, navigationTarget, note.id, onNavigationComplete, surfaceSize.height, surfaceSize.width, workspace])

  useEffect(() => {
    setReplay({ active: false, playing: false, elapsed: 0 })
  }, [note.id])

  useEffect(() => {
    if (!replay.active || !replay.playing || replayTimeline.duration <= 0) return undefined
    let frame = 0
    let previous = performance.now()
    const advance = (now) => {
      const delta = Math.max(0, now - previous)
      previous = now
      setReplay((current) => {
        if (!current.active || !current.playing) return current
        const elapsed = Math.min(replayTimeline.duration, current.elapsed + delta)
        return { ...current, elapsed, playing: elapsed < replayTimeline.duration }
      })
      frame = window.requestAnimationFrame(advance)
    }
    frame = window.requestAnimationFrame(advance)
    return () => window.cancelAnimationFrame(frame)
  }, [replay.active, replay.playing, replayTimeline.duration])

  useEffect(() => {
    if (!activePageId && pages[0]) setActivePageId(pages[0].id)
    if (activePageId && pages.length > 0 && !pages.some((page) => page.id === activePageId)) {
      setActivePageId(pages[0].id)
    }
  }, [activePageId, pages])

  useEffect(() => {
    if (workspace?.document?.revision > 0 && workspace.document.updatedAt) {
      markSpatialNotePersisted(note.id, workspace.document.updatedAt)
    }
  }, [markSpatialNotePersisted, note.id, workspace?.document?.revision, workspace?.document?.updatedAt])

  useEffect(() => {
    if (brushColorExplicitRef.current || !activePage) return
    setBrush((current) => ({
      ...current,
      color: activePage.surface === 'dark' ? '#e1ece5' : '#18352a',
    }))
  }, [activePage])

  useEffect(() => {
    if (kind !== 'canvas' || !stageRef.current) return undefined
    const stage = stageRef.current
    const updateSize = () => setSurfaceSize({ width: stage.clientWidth, height: stage.clientHeight })
    updateSize()
    const observer = new ResizeObserver(updateSize)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [kind, workspace?.document?.noteId])

  const stopInkReplay = useCallback(() => {
    setReplay({ active: false, playing: false, elapsed: 0 })
  }, [])

  const toggleInkReplay = useCallback(() => {
    if (replayTimeline.duration <= 0) return
    setSelectedIds(new Set())
    setEditingTextId(null)
    setReplay((current) => {
      if (!current.active || current.elapsed >= replayTimeline.duration) {
        return { active: true, playing: true, elapsed: 0 }
      }
      return { ...current, playing: !current.playing }
    })
  }, [replayTimeline.duration])

  const seekInkReplay = useCallback((progress) => {
    if (replayTimeline.duration <= 0) return
    setReplay({
      active: true,
      playing: false,
      elapsed: replayTimeline.duration * clamp(progress, 0, 1),
    })
  }, [replayTimeline.duration])

  const scheduleViewportSave = useCallback((nextViewport) => {
    window.clearTimeout(viewportSaveTimerRef.current)
    viewportSaveTimerRef.current = window.setTimeout(() => {
      commit({ documentPatch: { viewport: nextViewport } }, { recordHistory: false })
    }, 250)
  }, [commit])

  useEffect(() => () => {
    flushTextDraftsRef.current()
    window.clearTimeout(viewportSaveTimerRef.current)
    for (const timer of textSaveTimersRef.current.values()) window.clearTimeout(timer)
  }, [])

  const viewportForSurface = useCallback(() => (
    kind === 'canvas' ? viewport : { panX: 0, panY: 0, zoom: viewport.zoom }
  ), [kind, viewport])

  const pointForEvent = useCallback((event, surface, view = viewportForSurface()) => (
    screenToWorld(event.clientX, event.clientY, surface.getBoundingClientRect(), view)
  ), [viewportForSurface])

  const nextZIndex = useCallback(() => (
    objects.reduce((maximum, object) => Math.max(maximum, object.zIndex || 0), 0) + 1
  ), [objects])

  const brushForTool = useCallback((activeTool = tool) => (
    createSpatialBrushSettings(activeTool === 'highlighter' ? 'highlighter' : 'pen', brush)
  ), [brush, tool])

  const clearActiveInk = (surfaceKey) => inkRefs.current.get(surfaceKey)?.clearActive()

  const beginGesture = useCallback((event, pageId = null) => {
    if (replay.active) {
      stopInkReplay()
      return
    }
    if (isTextTarget(event.target) || event.target.closest?.('.qn-spatial-resize-handle')) return
    setEditingTextId(null)
    const surface = event.currentTarget
    const surfaceKey = pageId || 'canvas'
    const view = viewportForSurface()
    const point = pointForEvent(event, surface, view)
    const pointerTool = event.pointerType === 'touch' ? 'hand' : tool
    const effectiveTool = editingBlocked ? 'hand' : pointerTool

    if (event.pointerType === 'touch' && activePenPointerRef.current != null) return
    if (event.pointerType === 'pen') activePenPointerRef.current = event.pointerId
    surface.setPointerCapture?.(event.pointerId)
    surface.focus({ preventScroll: true })

    if (effectiveTool === 'pen' || effectiveTool === 'highlighter') {
      const sample = [point.x, point.y, normalizePressure(event), event.tiltX || 0, event.tiltY || 0, event.timeStamp || 0]
      clearActiveInk(surfaceKey)
      gestureRef.current = { type: 'stroke', pointerId: event.pointerId, pageId, surfaceKey, points: [sample], brush: brushForTool(effectiveTool), surface }
      return
    }

    if (effectiveTool === 'eraser') {
      const hit = objectAtPoint(pageObjects(pageId), point, 7 / view.zoom)
      gestureRef.current = { type: 'erase', pointerId: event.pointerId, pageId, erased: new Set(hit?.kind === 'stroke' ? [hit.id] : []), surface }
      return
    }

    if (['line', 'arrow', 'rectangle', 'ellipse'].includes(effectiveTool)) {
      gestureRef.current = { type: 'shape', pointerId: event.pointerId, pageId, start: point, current: point, shape: effectiveTool, surface }
      return
    }

    if (['text', 'sticky', 'indexCard', 'noteLink'].includes(effectiveTool)) {
      if (effectiveTool === 'noteLink' && !noteLinkTarget) {
        toast.error('Choose a note to link first')
        surface.releasePointerCapture?.(event.pointerId)
        return
      }
      const object = createBoundedObject({
        noteId: note.id,
        pageId,
        kind: effectiveTool,
        point,
        zIndex: nextZIndex(),
        text: effectiveTool === 'sticky' ? 'New sticky note' : effectiveTool === 'indexCard' ? 'Index card' : effectiveTool === 'text' ? 'Text' : '',
        targetNoteId: effectiveTool === 'noteLink' ? noteLinkTarget : null,
      })
      commit({ putObjects: [object] }, { label: `Add ${effectiveTool}` })
      setSelectedIds(new Set([object.id]))
      setTool('select')
      surface.releasePointerCapture?.(event.pointerId)
      return
    }

    if (effectiveTool === 'hand') {
      gestureRef.current = {
        type: 'pan',
        pointerId: event.pointerId,
        startClient: { x: event.clientX, y: event.clientY },
        startViewport: viewport,
        startScroll: stageRef.current ? { left: stageRef.current.scrollLeft, top: stageRef.current.scrollTop } : null,
        surface,
      }
      return
    }

    const hit = objectAtPoint(pageObjects(pageId), point, 6 / view.zoom)
    if (hit) {
      const nextSelection = new Set(selectedIds)
      if (event.shiftKey) {
        if (nextSelection.has(hit.id)) nextSelection.delete(hit.id)
        else nextSelection.add(hit.id)
      } else if (!nextSelection.has(hit.id)) {
        nextSelection.clear()
        nextSelection.add(hit.id)
      }
      setSelectedIds(nextSelection)
      const originals = objects.filter((object) => nextSelection.has(object.id)).map((object) => structuredClone(object))
      gestureRef.current = { type: 'drag', pointerId: event.pointerId, pageId, start: point, current: point, originals, surface }
    } else {
      if (!event.shiftKey) setSelectedIds(new Set())
      gestureRef.current = { type: 'lasso', pointerId: event.pointerId, pageId, start: point, current: point, append: event.shiftKey, surface }
      setLasso({ x: point.x, y: point.y, width: 0, height: 0 })
    }
  }, [brushForTool, commit, editingBlocked, nextZIndex, note.id, noteLinkTarget, objects, pageObjects, pointForEvent, replay.active, selectedIds, stopInkReplay, tool, viewport, viewportForSurface])

  const beginTextEditing = useCallback((objectId) => {
    if (editingBlocked) return
    setEditingTextId(objectId)
    setSelectedIds(new Set([objectId]))
    window.requestAnimationFrame(() => {
      const field = [...(stageRef.current?.querySelectorAll('[data-spatial-object-id] textarea') || [])]
        .find((element) => element.closest('[data-spatial-object-id]')?.dataset.spatialObjectId === objectId)
      field?.focus()
      field?.select()
    })
  }, [editingBlocked])

  const handleDoubleClick = useCallback((event, pageId = null) => {
    if (isTextTarget(event.target)) return
    const point = pointForEvent(event, event.currentTarget, viewportForSurface())
    const object = objectAtPoint(pageObjects(pageId), point, 6 / viewportForSurface().zoom)
    if (!object) return
    if (['text', 'sticky', 'indexCard'].includes(object.kind)) beginTextEditing(object.id)
    if (object.kind === 'noteLink' && object.data?.targetNoteId) navigateToKnowledgeTarget({
      noteId: object.data.targetNoteId,
      anchorId: object.data.targetAnchorId || null,
      objectId: object.data.targetObjectId || null,
    })
  }, [beginTextEditing, navigateToKnowledgeTarget, pageObjects, pointForEvent, viewportForSurface])

  const moveGesture = useCallback((event) => {
    const gesture = gestureRef.current
    if (!gesture || gesture.pointerId !== event.pointerId) return
    const surface = gesture.surface
    const view = viewportForSurface()

    if (gesture.type === 'stroke') {
      const ink = inkRefs.current.get(gesture.surfaceKey)
      for (const sampleEvent of pointerSamples(event)) {
        const point = pointForEvent(sampleEvent, surface, view)
        const sample = [point.x, point.y, normalizePressure(sampleEvent), sampleEvent.tiltX || 0, sampleEvent.tiltY || 0, sampleEvent.timeStamp || 0]
        const previous = gesture.points.at(-1)
        if (Math.hypot(sample[0] - previous[0], sample[1] - previous[1]) < 0.2) continue
        gesture.points.push(sample)
        ink?.drawSegment(previous, sample, gesture.brush)
      }
      return
    }

    const point = pointForEvent(event, surface, view)
    gesture.current = point
    if (gesture.type === 'erase') {
      const hit = objectAtPoint(pageObjects(gesture.pageId), point, 7 / view.zoom)
      if (hit?.kind === 'stroke') gesture.erased.add(hit.id)
    } else if (gesture.type === 'shape') {
      const preview = createShapeObject({
        noteId: note.id,
        pageId: gesture.pageId,
        shape: gesture.shape,
        start: gesture.start,
        end: point,
        color: brush.color,
        width: brush.width,
        zIndex: nextZIndex(),
      })
      preview.id = 'shape-preview'
      setShapePreview(preview)
    } else if (gesture.type === 'drag') {
      setDragPreview({ dx: point.x - gesture.start.x, dy: point.y - gesture.start.y })
    } else if (gesture.type === 'lasso') {
      setLasso({ x: gesture.start.x, y: gesture.start.y, width: point.x - gesture.start.x, height: point.y - gesture.start.y })
    } else if (gesture.type === 'resize') {
      setDragPreview({ resizeWidth: gesture.original.bounds.width + point.x - gesture.start.x, resizeHeight: gesture.original.bounds.height + point.y - gesture.start.y })
    } else if (gesture.type === 'pan') {
      const dx = event.clientX - gesture.startClient.x
      const dy = event.clientY - gesture.startClient.y
      if (kind === 'canvas') {
        gesture.currentViewport = { ...gesture.startViewport, panX: gesture.startViewport.panX + dx, panY: gesture.startViewport.panY + dy }
        setViewport(gesture.currentViewport)
      } else if (stageRef.current && gesture.startScroll) {
        stageRef.current.scrollLeft = gesture.startScroll.left - dx
        stageRef.current.scrollTop = gesture.startScroll.top - dy
      }
    }
  }, [brush, kind, nextZIndex, note.id, pageObjects, pointForEvent, viewportForSurface])

  const finishGesture = useCallback((event, cancelled = false) => {
    const gesture = gestureRef.current
    if (!gesture || gesture.pointerId !== event.pointerId) return
    gestureRef.current = null
    gesture.surface.releasePointerCapture?.(event.pointerId)
    if (event.pointerType === 'pen') activePenPointerRef.current = null

    if (gesture.type === 'stroke') {
      clearActiveInk(gesture.surfaceKey)
      if (!cancelled && gesture.points.length > 0) {
        const object = createStrokeObject({
          noteId: note.id,
          pageId: gesture.pageId,
          points: gesture.points,
          ...gesture.brush,
          zIndex: nextZIndex(),
        })
        commit({ putObjects: [object] }, { label: gesture.brush.brush === 'highlighter' ? 'Highlight' : 'Draw stroke' })
      }
    } else if (gesture.type === 'erase' && !cancelled && gesture.erased.size > 0) {
      commit({ deleteObjectIds: [...gesture.erased] }, { label: 'Erase strokes' })
      setSelectedIds((current) => new Set([...current].filter((id) => !gesture.erased.has(id))))
    } else if (gesture.type === 'shape') {
      setShapePreview(null)
      if (!cancelled && gesture.current && Math.hypot(gesture.current.x - gesture.start.x, gesture.current.y - gesture.start.y) > 2) {
        const object = createShapeObject({
          noteId: note.id,
          pageId: gesture.pageId,
          shape: gesture.shape,
          start: gesture.start,
          end: gesture.current,
          color: brush.color,
          width: brush.width,
          zIndex: nextZIndex(),
        })
        commit({ putObjects: [object] }, { label: `Add ${gesture.shape}` })
        setSelectedIds(new Set([object.id]))
      }
    } else if (gesture.type === 'drag') {
      const preview = gesture.current
        ? { dx: gesture.current.x - gesture.start.x, dy: gesture.current.y - gesture.start.y }
        : null
      setDragPreview(null)
      if (!cancelled && preview && (preview.dx !== 0 || preview.dy !== 0)) {
        const moved = gesture.originals.map((object) => moveSpatialObject(object, preview.dx, preview.dy))
        commit({ putObjects: moved }, {
          label: 'Move selection',
          inverse: { ...emptyChangeSet(), putObjects: gesture.originals },
        })
      }
    } else if (gesture.type === 'lasso') {
      const bounds = gesture.current && normalizeBounds({
        x: gesture.start.x,
        y: gesture.start.y,
        width: gesture.current.x - gesture.start.x,
        height: gesture.current.y - gesture.start.y,
      })
      setLasso(null)
      if (!cancelled && bounds) {
        const ids = pageObjects(gesture.pageId)
          .filter((object) => boundsIntersect(object.bounds, bounds))
          .map((object) => object.id)
        setSelectedIds((current) => new Set(gesture.append ? [...current, ...ids] : ids))
      }
    } else if (gesture.type === 'resize') {
      const preview = gesture.current
        ? {
            resizeWidth: gesture.original.bounds.width + gesture.current.x - gesture.start.x,
            resizeHeight: gesture.original.bounds.height + gesture.current.y - gesture.start.y,
          }
        : null
      setDragPreview(null)
      if (!cancelled && preview?.resizeWidth && preview?.resizeHeight) {
        const resized = resizeSpatialObject(gesture.original, preview.resizeWidth, preview.resizeHeight)
        commit({ putObjects: [resized] }, {
          label: 'Resize object',
          inverse: { ...emptyChangeSet(), putObjects: [gesture.original] },
        })
      }
    } else if (gesture.type === 'pan' && kind === 'canvas' && !cancelled) {
      scheduleViewportSave(gesture.currentViewport || gesture.startViewport)
    }
  }, [brush, commit, kind, nextZIndex, note.id, pageObjects, scheduleViewportSave])

  const resizePointerDown = useCallback((event, object) => {
    event.preventDefault()
    event.stopPropagation()
    const surface = event.currentTarget.closest('.qn-spatial-interaction-surface')
    if (!surface) return
    const point = pointForEvent(event, surface)
    event.currentTarget.setPointerCapture?.(event.pointerId)
    gestureRef.current = {
      type: 'resize',
      pointerId: event.pointerId,
      pageId: object.pageId,
      start: point,
      current: point,
      original: structuredClone(object),
      surface,
    }
  }, [pointForEvent])

  const deleteSelection = useCallback(() => {
    if (editingBlocked || selectedIds.size === 0) return
    const selected = objects.filter((object) => selectedIds.has(object.id))
    const sourceStrokeIds = new Set(selected.flatMap((object) => object.kind === 'shape' ? object.data?.sourceStrokeIds || [] : []))
    const restored = objects
      .filter((object) => sourceStrokeIds.has(object.id) && object.kind === 'stroke' && object.data?.hidden)
      .map((object) => ({
        ...object,
        data: { ...object.data, hidden: false, convertedToShapeId: null },
        updatedAt: new Date().toISOString(),
      }))
    commit({ deleteObjectIds: [...selectedIds], putObjects: restored }, { label: 'Delete selection' })
    setSelectedIds(new Set())
  }, [commit, editingBlocked, objects, selectedIds])

  const copySelection = useCallback(() => {
    const selected = objects.filter((object) => selectedIds.has(object.id))
    if (selected.length === 0) return
    spatialClipboard = structuredClone(selected)
    const serialized = `quicknotes-spatial:${JSON.stringify(selected)}`
    void navigator.clipboard?.writeText(serialized).catch(() => undefined)
  }, [objects, selectedIds])

  const pasteObjects = useCallback(async () => {
    if (editingBlocked) return
    let source = spatialClipboard
    if (!source && navigator.clipboard?.readText) {
      try {
        const value = await navigator.clipboard.readText()
        if (value.startsWith('quicknotes-spatial:')) source = JSON.parse(value.slice('quicknotes-spatial:'.length))
      } catch {
        // Clipboard permission is optional; the in-app clipboard remains available.
      }
    }
    if (!Array.isArray(source) || source.length === 0) return
    const now = new Date().toISOString()
    let zIndex = nextZIndex()
    const pasted = source.map((object) => {
      const moved = moveSpatialObject(structuredClone(object), 24, 24)
      if (moved.kind === 'shape' && moved.data?.sourceStrokeIds) {
        moved.data = { ...moved.data, sourceStrokeIds: [], recognitionKind: null, recognitionConfidence: null }
      }
      if (moved.kind === 'stroke' && moved.data?.hidden) {
        moved.data = { ...moved.data, hidden: false, convertedToShapeId: null }
      }
      return {
        ...moved,
        id: generateId(),
        noteId: note.id,
        pageId: kind === 'paper' ? activePage?.id || null : null,
        zIndex: zIndex++,
        createdAt: now,
        updatedAt: now,
      }
    })
    commit({ putObjects: pasted }, { label: 'Paste selection' })
    setSelectedIds(new Set(pasted.map((object) => object.id)))
  }, [activePage?.id, commit, editingBlocked, kind, nextZIndex, note.id])

  const convertSelectedInkToShape = useCallback(() => {
    if (editingBlocked || !shapeCandidate || selectedInk.length !== 1) return
    const source = selectedInk[0]
    const shape = createShapeObject({
      noteId: note.id,
      pageId: source.pageId,
      shape: shapeCandidate.shape,
      start: shapeCandidate.start,
      end: shapeCandidate.end,
      color: source.data.color,
      width: source.data.width,
      zIndex: nextZIndex(),
    })
    shape.data = {
      ...shape.data,
      sourceStrokeIds: [source.id],
      recognitionKind: 'ink-shape-v1',
      recognitionConfidence: shapeCandidate.confidence,
    }
    const retainedSource = {
      ...source,
      data: { ...source.data, hidden: true, convertedToShapeId: shape.id },
      updatedAt: new Date().toISOString(),
    }
    commit({ putObjects: [retainedSource, shape] }, { label: `Convert ink to ${shapeCandidate.shape}` })
    setSelectedIds(new Set([shape.id]))
    setTool('select')
    toast.success(`Converted to ${shapeCandidate.shape}. Original ink remains available to replay.`)
  }, [commit, editingBlocked, nextZIndex, note.id, selectedInk, shapeCandidate])

  const duplicateSelection = useCallback(() => {
    copySelection()
    void pasteObjects()
  }, [copySelection, pasteObjects])

  const nudgeSelection = useCallback((dx, dy) => {
    if (editingBlocked || selectedIds.size === 0) return
    const originals = objects.filter((object) => selectedIds.has(object.id)).map((object) => structuredClone(object))
    const moved = originals.map((object) => moveSpatialObject(object, dx, dy))
    commit({ putObjects: moved }, {
      label: 'Nudge selection',
      inverse: { ...emptyChangeSet(), putObjects: originals },
    })
  }, [commit, editingBlocked, objects, selectedIds])

  const changeZOrder = useCallback((direction) => {
    if (editingBlocked || selectedIds.size === 0) return
    const originals = objects.filter((object) => selectedIds.has(object.id)).map((object) => structuredClone(object))
    const edge = direction > 0
      ? objects.reduce((value, object) => Math.max(value, object.zIndex || 0), 0) + 1
      : objects.reduce((value, object) => Math.min(value, object.zIndex || 0), 0) - originals.length
    const updated = originals.map((object, index) => ({ ...object, zIndex: edge + index, updatedAt: new Date().toISOString() }))
    commit({ putObjects: updated }, {
      label: direction > 0 ? 'Bring to front' : 'Send to back',
      inverse: { ...emptyChangeSet(), putObjects: originals },
    })
  }, [commit, editingBlocked, objects, selectedIds])

  const changeStickySetting = useCallback((key, value) => {
    if (editingBlocked || !selectedSticky || selectedSticky.data?.[key] === value) return
    const original = structuredClone(selectedSticky)
    const updated = {
      ...selectedSticky,
      data: { ...selectedSticky.data, [key]: value },
      updatedAt: new Date().toISOString(),
    }
    commit({ putObjects: [updated] }, {
      label: 'Change sticky note colour',
      inverse: { ...emptyChangeSet(), putObjects: [original] },
    })
  }, [commit, editingBlocked, selectedSticky])

  const handleKeyDown = useCallback((event) => {
    if (isTextTarget(event.target)) return
    if (replay.active) {
      event.preventDefault()
      stopInkReplay()
      return
    }
    const modifier = event.ctrlKey || event.metaKey
    if (modifier && event.key.toLowerCase() === 'z') {
      event.preventDefault()
      if (event.shiftKey) redo()
      else undo()
    } else if (modifier && event.key.toLowerCase() === 'y') {
      event.preventDefault(); redo()
    } else if (modifier && event.key.toLowerCase() === 'c') {
      event.preventDefault(); copySelection()
    } else if (modifier && event.key.toLowerCase() === 'v') {
      event.preventDefault(); void pasteObjects()
    } else if (modifier && event.key.toLowerCase() === 'd') {
      event.preventDefault(); duplicateSelection()
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault(); deleteSelection()
    } else if (event.key === 'Escape') {
      setEditingTextId(null); setSelectedIds(new Set()); setTool('select')
    } else if (event.key === 'Enter' && selectedIds.size === 1) {
      const selected = objects.find((object) => selectedIds.has(object.id))
      if (selected && ['text', 'sticky', 'indexCard'].includes(selected.kind)) {
        event.preventDefault(); beginTextEditing(selected.id)
      }
    } else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault()
      const distance = event.shiftKey ? 10 : 1
      nudgeSelection(
        event.key === 'ArrowLeft' ? -distance : event.key === 'ArrowRight' ? distance : 0,
        event.key === 'ArrowUp' ? -distance : event.key === 'ArrowDown' ? distance : 0
      )
    } else if (!modifier && !event.altKey) {
      const keyTools = { v: 'select', p: 'pen', h: 'highlighter', e: 'eraser' }
      if (keyTools[event.key.toLowerCase()]) setTool(keyTools[event.key.toLowerCase()])
    }
  }, [beginTextEditing, copySelection, deleteSelection, duplicateSelection, nudgeSelection, objects, pasteObjects, redo, replay.active, selectedIds, stopInkReplay, undo])

  const changeZoom = useCallback((delta, anchor = null) => {
    setViewport((current) => {
      const zoom = clamp(current.zoom + delta, SPATIAL_LIMITS.MIN_ZOOM, SPATIAL_LIMITS.MAX_ZOOM)
      let next = { ...current, zoom }
      if (kind === 'canvas' && anchor) {
        const worldX = (anchor.x - current.panX) / current.zoom
        const worldY = (anchor.y - current.panY) / current.zoom
        next = { ...next, panX: anchor.x - worldX * zoom, panY: anchor.y - worldY * zoom }
      }
      scheduleViewportSave(next)
      return next
    })
  }, [kind, scheduleViewportSave])

  const handleWheel = useCallback((event) => {
    if (kind === 'paper') {
      if (!event.ctrlKey) return
      event.preventDefault()
      changeZoom(event.deltaY > 0 ? -0.1 : 0.1)
      return
    }
    event.preventDefault()
    if (event.ctrlKey) {
      const rect = event.currentTarget.getBoundingClientRect()
      changeZoom(event.deltaY > 0 ? -0.1 : 0.1, { x: event.clientX - rect.left, y: event.clientY - rect.top })
    } else {
      setViewport((current) => {
        const next = { ...current, panX: current.panX - event.deltaX, panY: current.panY - event.deltaY }
        scheduleViewportSave(next)
        return next
      })
    }
  }, [changeZoom, kind, scheduleViewportSave])

  const textFocus = useCallback((object) => {
    if (!textOriginalRef.current.has(object.id)) textOriginalRef.current.set(object.id, structuredClone(object))
  }, [])

  const persistText = useCallback((id) => {
    window.clearTimeout(textSaveTimersRef.current.get(id))
    textSaveTimersRef.current.delete(id)
    const original = textOriginalRef.current.get(id)
    const current = latestWorkspaceRef.current?.objects.find((object) => object.id === id)
    if (!original || !current || original.data?.text === current.data?.text) return
    commit({ putObjects: [current] }, {
      label: 'Edit object text',
      inverse: { ...emptyChangeSet(), putObjects: [original] },
    })
    textOriginalRef.current.set(id, structuredClone(current))
  }, [commit])

  flushTextDraftsRef.current = () => {
    for (const id of textOriginalRef.current.keys()) persistText(id)
  }

  const textDraft = useCallback((object, text) => {
    textFocus(object)
    const updated = { ...object, data: { ...object.data, text }, updatedAt: new Date().toISOString() }
    updateDraftObject(updated)
    window.clearTimeout(textSaveTimersRef.current.get(object.id))
    textSaveTimersRef.current.set(object.id, window.setTimeout(() => persistText(object.id), 600))
  }, [persistText, textFocus, updateDraftObject])

  const textBlur = useCallback((object) => {
    persistText(object.id)
    textOriginalRef.current.delete(object.id)
  }, [persistText])

  const addPage = useCallback(() => {
    if (pages.length >= SPATIAL_LIMITS.MAX_PAGES) return toast.error('This Paper note has reached the page limit')
    const nextOrder = pages.reduce((maximum, page) => Math.max(maximum, page.order), -1) + 1
    const page = createPaperPage(note.id, null, nextOrder, {
      size: activePage?.size,
      pattern: activePage?.pattern,
      surface: activePage?.surface,
      width: activePage?.width,
      height: activePage?.height,
      name: `Page ${nextOrder + 1}`,
    })
    commit({ putPages: [page] }, { label: 'Add page' })
    setActivePageId(page.id)
  }, [activePage, commit, note.id, pages])

  const duplicatePage = useCallback(() => {
    if (!activePage || pages.length >= SPATIAL_LIMITS.MAX_PAGES) return
    const nextOrder = pages.reduce((maximum, page) => Math.max(maximum, page.order), -1) + 1
    const page = { ...structuredClone(activePage), id: generateId(), order: nextOrder, name: `${activePage.name} copy`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    let zIndex = nextZIndex()
    const copies = pageObjects(activePage.id).map((object) => ({ ...structuredClone(object), id: generateId(), pageId: page.id, zIndex: zIndex++, createdAt: page.createdAt, updatedAt: page.updatedAt }))
    commit({ putPages: [page], putObjects: copies }, { label: 'Duplicate page' })
    setActivePageId(page.id)
  }, [activePage, commit, nextZIndex, pageObjects, pages])

  const deletePage = useCallback(() => {
    if (!activePage || pages.length <= 1) return
    const deletedObjects = pageObjects(activePage.id)
    commit({ deletePageIds: [activePage.id], deleteObjectIds: deletedObjects.map((object) => object.id) }, { label: 'Delete page' })
    const index = pages.findIndex((page) => page.id === activePage.id)
    setActivePageId(pages[Math.max(0, index - 1)]?.id || pages[0]?.id)
    setSelectedIds(new Set())
  }, [activePage, commit, pageObjects, pages])

  const movePage = useCallback((direction) => {
    if (!activePage) return
    const index = pages.findIndex((page) => page.id === activePage.id)
    const swapIndex = index + direction
    if (index < 0 || swapIndex < 0 || swapIndex >= pages.length) return
    const first = { ...pages[index], order: swapIndex, updatedAt: new Date().toISOString() }
    const second = { ...pages[swapIndex], order: index, updatedAt: new Date().toISOString() }
    commit({ putPages: [first, second] }, { label: 'Reorder pages' })
  }, [activePage, commit, pages])

  const changePageSetting = useCallback((key, value) => {
    if (!activePage) return
    const updated = { ...activePage, [key]: value, updatedAt: new Date().toISOString() }
    if (key === 'size' && PAPER_SIZES[value]) {
      updated.width = PAPER_SIZES[value].width
      updated.height = PAPER_SIZES[value].height
    }
    if (key === 'surface' && !brushColorExplicitRef.current) {
      setBrush((current) => ({ ...current, color: value === 'dark' ? '#e1ece5' : '#18352a' }))
    }
    commit({ putPages: [updated] }, { label: 'Change paper settings' })
  }, [activePage, commit])

  const handleImageFile = useCallback(async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || editingBlocked) return
    const supported = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
    if (!supported.includes(file.type)) return toast.error('Choose a PNG, JPEG, WebP, or GIF image')
    if (file.size <= 0 || file.size > 5 * 1024 * 1024) return toast.error('Spatial images must be 5 MB or smaller')
    try {
      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result || ''))
        reader.onerror = () => reject(new Error('Could not read this image'))
        reader.readAsDataURL(file)
      })
      const decoded = await new Promise((resolve, reject) => {
        const image = new Image()
        image.onload = () => resolve(image)
        image.onerror = () => reject(new Error('Could not decode this image'))
        image.src = data
      })
      const dimensions = { width: decoded.naturalWidth, height: decoded.naturalHeight }
      const maxWidth = 420
      const scale = Math.min(1, maxWidth / Math.max(1, dimensions.width))
      const width = Math.max(80, dimensions.width * scale)
      const height = Math.max(60, dimensions.height * scale)
      let point
      if (kind === 'paper') {
        point = {
          x: Math.max(24, ((activePage?.width || 794) - width) / 2),
          y: 72,
        }
      } else {
        const rect = stageRef.current?.getBoundingClientRect()
        point = {
          x: (((rect?.width || 800) / 2) - viewport.panX) / viewport.zoom - width / 2,
          y: (((rect?.height || 600) / 2) - viewport.panY) / viewport.zoom - height / 2,
        }
      }
      const resource = createImageResource(file, data, {
        thumbnailData: createDisplayThumbnail(decoded, file.type),
        pixelWidth: dimensions.width,
        pixelHeight: dimensions.height,
      })
      const object = createImageObject({
        noteId: note.id,
        pageId: kind === 'paper' ? activePage?.id || null : null,
        point,
        zIndex: nextZIndex(),
        resourceId: resource.id,
        width,
        height,
      })
      commit({ putResources: [resource], putObjects: [object] }, { label: 'Place image' })
      setSelectedIds(new Set([object.id]))
      setTool('select')
    } catch (error) {
      toast.error(error?.message || 'Could not place this image')
    }
  }, [activePage?.id, activePage?.width, commit, editingBlocked, kind, nextZIndex, note.id, viewport])

  const performExport = useCallback(async (format) => {
    if (!workspace || (kind === 'paper' && !activePage)) return
    setExporting(true)
    try {
      const input = {
        kind,
        noteTitle: noteTitle || note.title,
        page: activePage,
        pages,
        objects,
        resources,
        resolveNoteTitle,
      }
      if (format === 'png') await exportSpatialPng(input)
      else await exportSpatialPdf(input)
      toast.success(`${format.toUpperCase()} export created`)
    } catch (error) {
      toast.error(error?.message || `Could not export ${format.toUpperCase()}`)
    } finally {
      setExporting(false)
    }
  }, [activePage, kind, note.title, noteTitle, objects, pages, resolveNoteTitle, resources, workspace])

  const insertRecognizedText = useCallback((text, sourceRegion) => {
    if (editingBlocked || !text?.trim() || selectedInk.length === 0) return
    const fallbackBounds = selectedInk[0].bounds
    const region = sourceRegion || fallbackBounds
    const pageId = selectedInk[0].pageId || null
    const object = createBoundedObject({
      noteId: note.id,
      pageId,
      kind: 'text',
      point: {
        x: region.x,
        y: region.y + region.height + 12,
      },
      zIndex: nextZIndex(),
      text: text.trim(),
    })
    commit({ putObjects: [object] }, { label: 'Add recognized handwriting as text' })
    setSelectedIds(new Set([object.id]))
    setTool('select')
  }, [commit, editingBlocked, nextZIndex, note.id, selectedInk])

  if (loading) {
    return <div className="qn-spatial-state" role="status"><Loader2 className="h-5 w-5 animate-spin" /> Loading {kind}…</div>
  }
  if (loadError) {
    return (
      <div className="qn-spatial-state qn-spatial-state--error" role="alert">
        <AlertCircle className="h-5 w-5" />
        <strong>Could not open this {kind} note.</strong>
        <span>{loadError.message}</span>
      </div>
    )
  }

  const layerProps = {
    selectedIds,
    editingTextId,
    viewport: viewportForSurface(),
    viewportSize: surfaceSize,
    dragPreview,
    lasso,
    shapePreview,
    resolveNoteTitle,
    resolveResource,
    onDraft: textDraft,
    onTextFocus: textFocus,
    onTextBlur: (object) => { textBlur(object); setEditingTextId(null) },
    onResizePointerDown: resizePointerDown,
    onOpenNote: (target) => target?.noteId && navigateToKnowledgeTarget(target),
  }

  return (
    <section className="qn-spatial-editor" aria-label={`${kind === 'paper' ? 'Paper' : 'Canvas'} editor`}>
      <header className="qn-spatial-titlebar">
        <label htmlFor={`qn-spatial-title-${note.id}`}>{kind === 'paper' ? 'Paper' : 'Canvas'}</label>
        <input
          id={`qn-spatial-title-${note.id}`}
          type="text"
          maxLength={MAX_NOTE_TITLE_LENGTH}
          value={noteTitle ?? note.title ?? ''}
          onChange={onTitleChange}
          readOnly={editingBlocked}
          placeholder={kind === 'paper' ? 'Untitled paper' : 'Untitled canvas'}
        />
      </header>
      {spatialConflict && (
        <div role="alert" className="flex flex-wrap items-center gap-2 border-b border-warning-border bg-warning-soft px-3 py-2 text-ui-sm text-warning-text">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="min-w-[12rem] flex-1">
            {spatialConflict.kind === 'remote-delete'
              ? `This ${kind} was deleted on another device while a local graph remained.`
              : `This ${kind} changed on another device while local edits were pending.`}
            {' '}Editing is paused until you choose which graph to keep.
          </span>
          <button type="button" className="rounded-control border border-warning-border px-2 py-1 font-medium" onClick={() => void resolveConflict('incoming')}>
            {spatialConflict.kind === 'remote-delete' ? 'Accept deletion' : 'Use incoming'}
          </button>
          <button type="button" className="rounded-control border border-warning-border px-2 py-1 font-medium" onClick={() => void resolveConflict('local')}>Keep local</button>
        </div>
      )}
      <SpatialToolbar
        kind={kind}
        tool={tool}
        onToolChange={setTool}
        brush={brush}
        onBrushChange={(updates) => {
          if (updates.color) brushColorExplicitRef.current = true
          setBrush((current) => ({ ...current, ...updates }))
        }}
        viewport={viewport}
        onZoom={changeZoom}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        hasSelection={selectedIds.size > 0}
        selectedSticky={selectedSticky}
        onStickySetting={changeStickySetting}
        onDuplicate={duplicateSelection}
        onBringToFront={() => changeZOrder(1)}
        onSendToBack={() => changeZOrder(-1)}
        activePage={activePage}
        onPageSetting={changePageSetting}
        noteLinkTarget={noteLinkTarget}
        onNoteLinkTarget={setNoteLinkTarget}
        linkableNotes={linkableNotes}
        onExportPng={() => performExport('png')}
        onExportPdf={() => performExport('pdf')}
        onImageRequest={() => imageInputRef.current?.click()}
        hasInk={replayTimeline.entries.length > 0}
        replayActive={replay.active}
        replayPlaying={replay.playing}
        replayProgress={replayTimeline.duration > 0 ? replay.elapsed / replayTimeline.duration : 0}
        onReplayToggle={toggleInkReplay}
        onReplaySeek={seekInkReplay}
        onReplayStop={stopInkReplay}
        canRecognizeImage={Boolean(selectedImage && !editingBlocked)}
        onRecognizeImage={() => setImageOcrOpen(true)}
        canAnnotateImage={Boolean(selectedImage && !spatialConflict)}
        onAnnotateImage={() => setImageAnnotationOpen(true)}
        canRecognizeHandwriting={canRecognizeHandwriting}
        onRecognizeHandwriting={() => setHandwritingRecognitionOpen(true)}
        shapeCandidate={shapeCandidate}
        onConvertShape={convertSelectedInkToShape}
        editingDisabled={editingBlocked}
      />
      <input
        ref={imageInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        tabIndex={-1}
        onChange={handleImageFile}
      />
      {selectedImage && (
        <>
          <ImageOcrModal
            open={imageOcrOpen}
            onClose={() => setImageOcrOpen(false)}
            noteId={note.id}
            object={selectedImage.object}
            resource={selectedImage.resource}
          />
          <AttachmentAnnotationModal
            open={imageAnnotationOpen}
            onClose={() => setImageAnnotationOpen(false)}
            noteId={note.id}
            resource={selectedImage.resource}
            readOnly={editingBlocked}
            ownerId={workspace?.document.ownerId || null}
          />
        </>
      )}
      {selectedInk.length > 0 && (
        <HandwritingRecognitionModal
          open={handwritingRecognitionOpen}
          onClose={() => setHandwritingRecognitionOpen(false)}
          noteId={note.id}
          objects={selectedInk}
          onInsertText={insertRecognizedText}
        />
      )}
      <div className="qn-spatial-statusbar">
        <span className={`qn-spatial-save-status qn-spatial-save-status--${saveStatus}`} role="status" aria-live="polite">
          {saveStatus === 'saving' ? <><Loader2 className="h-3 w-3 animate-spin" /> Saving</> : saveStatus === 'error' ? <><AlertCircle className="h-3 w-3" /> Save failed</> : 'Saved on this device'}
        </span>
        {saveStatus === 'error' && <button type="button" onClick={retrySave}><RefreshCw className="h-3 w-3" /> Retry</button>}
        {readOnly && <span>Read-only</span>}
        {spatialConflict && <span>Conflict review required</span>}
        {replay.active && <span>{replay.playing ? 'Replaying ink' : 'Ink replay paused'}</span>}
        <span className="qn-spatial-statusbar__selection">{selectedIds.size > 0 ? `${selectedIds.size} selected` : tool === 'eraser' ? 'Whole-stroke eraser' : 'No selection'}</span>
        {exporting && <span><Loader2 className="h-3 w-3 animate-spin" /> Exporting</span>}
      </div>
      <p className="qn-sr-only" role="status">{objectSummary}</p>

      {kind === 'paper' ? (
        <div className="qn-paper-workspace">
          <PageRail
            pages={pages}
            objectsForPage={pageObjects}
            activePageId={activePage?.id}
            onSelect={(id) => { setActivePageId(id); setSelectedIds(new Set()) }}
            onAdd={addPage}
            onDuplicate={duplicatePage}
            onDelete={deletePage}
            onMove={movePage}
            resolveNoteTitle={resolveNoteTitle}
            resolveResource={resolveResource}
            editingDisabled={editingBlocked}
          />
          <div ref={stageRef} className="qn-paper-stage" onWheel={handleWheel}>
            {pages.map((page) => {
              // The Paper page element itself is scaled. Its canvases retain
              // page-local coordinates to avoid applying zoom twice.
              const pageViewport = { panX: 0, panY: 0, zoom: 1 }
              const currentObjects = pageObjects(page.id)
              const currentInkObjects = replayInkObjects
                ? replayInkObjects.filter((object) => object.pageId === page.id)
                : currentObjects
              return (
                <div
                  key={page.id}
                  className="qn-paper-page-frame"
                  data-active={page.id === activePage?.id ? 'true' : 'false'}
                  style={{ width: page.width * viewport.zoom, height: page.height * viewport.zoom }}
                  onPointerDown={() => setActivePageId(page.id)}
                >
                  <div
                    className="qn-spatial-interaction-surface qn-paper-page"
                    data-page-id={page.id}
                    data-pattern={page.pattern}
                    data-surface={page.surface}
                    style={{ width: page.width, height: page.height, transform: `scale(${viewport.zoom})` }}
                    role="application"
                    tabIndex={0}
                    aria-label={`${page.name}, ${page.pattern} ${page.surface} paper`}
                    onKeyDown={handleKeyDown}
                    onPointerDown={(event) => beginGesture(event, page.id)}
                    onDoubleClick={(event) => handleDoubleClick(event, page.id)}
                    onPointerMove={moveGesture}
                    onPointerUp={finishGesture}
                    onPointerCancel={(event) => finishGesture(event, true)}
                    onLostPointerCapture={(event) => finishGesture(event, true)}
                  >
                    <InkCanvas ref={(value) => value ? inkRefs.current.set(page.id, value) : inkRefs.current.delete(page.id)} objects={currentInkObjects} viewport={pageViewport} />
                    <SpatialObjectLayer {...layerProps} objects={currentObjects} viewport={pageViewport} canvasMode={false} shapePreview={shapePreview?.pageId === page.id ? shapePreview : null} lasso={gestureRef.current?.pageId === page.id ? lasso : null} />
                  </div>
                  <span className="qn-paper-page-number" aria-hidden="true">{page.order + 1}</span>
                </div>
              )
            })}
            <button type="button" className="qn-paper-add-page" onClick={addPage}><FilePlus2 className="h-4 w-4" /> Add page</button>
          </div>
        </div>
      ) : (
        <div
          ref={stageRef}
          className="qn-spatial-interaction-surface qn-canvas-workspace"
          role="application"
          tabIndex={0}
          aria-label="Infinite canvas workspace"
          style={{ '--qn-canvas-grid-size': `${24 * viewport.zoom}px`, '--qn-canvas-grid-x': `${viewport.panX}px`, '--qn-canvas-grid-y': `${viewport.panY}px` }}
          onKeyDown={handleKeyDown}
          onWheel={handleWheel}
          onPointerDown={(event) => beginGesture(event, null)}
          onDoubleClick={(event) => handleDoubleClick(event, null)}
          onPointerMove={moveGesture}
          onPointerUp={finishGesture}
          onPointerCancel={(event) => finishGesture(event, true)}
          onLostPointerCapture={(event) => finishGesture(event, true)}
        >
          <InkCanvas ref={(value) => value ? inkRefs.current.set('canvas', value) : inkRefs.current.delete('canvas')} objects={replayInkObjects || visibleObjects} viewport={viewport} />
          <SpatialObjectLayer {...layerProps} objects={visibleObjects} viewport={viewport} canvasMode />
        </div>
      )}
    </section>
  )
}
