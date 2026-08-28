import { useCallback, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { loadSpatialWorkspace, saveSpatialChanges } from '../../lib/spatial/repository'
import {
  createSpatialHistory,
  invertSpatialChanges,
  pushSpatialHistory,
  takeSpatialRedo,
  takeSpatialUndo,
} from '../../lib/spatial/history'
import { compareSpatialZOrder } from '../../lib/spatial/geometry'
import { resolveSpatialConflict } from '../../lib/spatial/cloud'

export const applySpatialChanges = (current, changes) => {
  const deleteObjectIds = new Set(changes.deleteObjectIds || [])
  const deletePageIds = new Set(changes.deletePageIds || [])
  const objectUpdates = new Map((changes.putObjects || []).map((object) => [object.id, object]))
  const pageUpdates = new Map((changes.putPages || []).map((page) => [page.id, page]))
  const deleteResourceIds = new Set(changes.deleteResourceIds || [])
  const resourceUpdates = new Map((changes.putResources || []).map((resource) => [resource.id, resource]))

  const objects = current.objects
    .filter((object) => !deleteObjectIds.has(object.id) && !deletePageIds.has(object.pageId))
    .map((object) => objectUpdates.get(object.id) || object)
  for (const object of objectUpdates.values()) {
    if (!current.objects.some((candidate) => candidate.id === object.id)) objects.push(object)
  }
  objects.sort(compareSpatialZOrder)

  const pages = current.pages
    .filter((page) => !deletePageIds.has(page.id))
    .map((page) => pageUpdates.get(page.id) || page)
  for (const page of pageUpdates.values()) {
    if (!current.pages.some((candidate) => candidate.id === page.id)) pages.push(page)
  }
  pages.sort((a, b) => (a.order || 0) - (b.order || 0))
  const resources = (current.resources || [])
    .filter((resource) => !deleteResourceIds.has(resource.id))
    .map((resource) => resourceUpdates.get(resource.id) || resource)
  for (const resource of resourceUpdates.values()) {
    if (!(current.resources || []).some((candidate) => candidate.id === resource.id)) resources.push(resource)
  }

  return {
    ...current,
    document: changes.documentPatch
      ? { ...current.document, ...changes.documentPatch }
      : current.document,
    objects,
    pages,
    resources,
  }
}

export default function useSpatialWorkspace(note, kind) {
  const [workspace, setWorkspace] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [saveStatus, setSaveStatus] = useState('saved')
  const [spatialConflict, setSpatialConflict] = useState(null)
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false })
  const workspaceRef = useRef(null)
  const historyRef = useRef(createSpatialHistory())
  const writeChainRef = useRef(Promise.resolve())
  const failedChangesRef = useRef([])
  const loadTokenRef = useRef(0)

  const replaceWorkspace = useCallback((value) => {
    workspaceRef.current = value
    setWorkspace(value)
  }, [])

  useEffect(() => {
    let active = true
    const token = ++loadTokenRef.current
    setWorkspace(null)
    workspaceRef.current = null
    setLoadError(null)
    setSaveStatus('saved')
    setSpatialConflict(null)
    historyRef.current = createSpatialHistory()
    setHistoryState({ canUndo: false, canRedo: false })

    loadSpatialWorkspace(note.id, kind, note.userId)
      .then(async (loaded) => {
        if (!active || token !== loadTokenRef.current) return
        const preset = note.noteData?.spatialPreset
        if (kind === 'paper' && preset && loaded.pages.length === 1 && loaded.objects.length === 0) {
          const page = loaded.pages[0]
          loaded.pages = [{
            ...page,
            pattern: preset.pattern || page.pattern,
            surface: preset.surface || page.surface,
            size: preset.size || page.size,
          }]
          loaded.document = await saveSpatialChanges(note.id, { putPages: loaded.pages })
        }
        if (!active || token !== loadTokenRef.current) return
        setSpatialConflict(loaded.conflict || null)
        replaceWorkspace(loaded)
      })
      .catch((error) => {
        if (!active || token !== loadTokenRef.current) return
        setLoadError(error)
      })
    return () => { active = false }
  }, [kind, note.id, note.noteData?.spatialPreset, note.userId, replaceWorkspace])

  const refreshHistoryState = useCallback(() => {
    setHistoryState({
      canUndo: historyRef.current.undo.length > 0,
      canRedo: historyRef.current.redo.length > 0,
    })
  }, [])

  const persist = useCallback((changes) => {
    if (spatialConflict) return Promise.resolve()
    setSaveStatus('saving')
    writeChainRef.current = writeChainRef.current
      .catch(() => undefined)
      .then(() => saveSpatialChanges(note.id, changes))
      .then((document) => {
        failedChangesRef.current = failedChangesRef.current.filter((item) => item !== changes)
        setWorkspace((current) => {
          if (!current) return current
          const next = { ...current, document: { ...current.document, ...document } }
          workspaceRef.current = next
          return next
        })
        setSaveStatus(failedChangesRef.current.length > 0 ? 'error' : 'saved')
      })
      .catch((error) => {
        failedChangesRef.current.push(changes)
        setSaveStatus('error')
        toast.error(error?.message || 'Could not save this spatial note')
      })
    return writeChainRef.current
  }, [note.id, spatialConflict])

  const commit = useCallback((changes, options = {}) => {
    const current = workspaceRef.current
    if (!current || spatialConflict) return
    const inverse = options.inverse || invertSpatialChanges(changes, current.objects, current.pages, current.resources)
    const next = applySpatialChanges(current, changes)
    replaceWorkspace(next)
    if (options.recordHistory !== false) {
      historyRef.current = pushSpatialHistory(historyRef.current, {
        label: options.label || 'Edit spatial note',
        forward: structuredClone(changes),
        inverse: structuredClone(inverse),
      })
      refreshHistoryState()
    }
    void persist(changes)
  }, [persist, refreshHistoryState, replaceWorkspace, spatialConflict])

  const undo = useCallback(() => {
    if (spatialConflict) return
    const result = takeSpatialUndo(historyRef.current)
    if (!result.entry || !workspaceRef.current) return
    historyRef.current = result.history
    replaceWorkspace(applySpatialChanges(workspaceRef.current, result.entry.inverse))
    refreshHistoryState()
    void persist(result.entry.inverse)
  }, [persist, refreshHistoryState, replaceWorkspace, spatialConflict])

  const redo = useCallback(() => {
    if (spatialConflict) return
    const result = takeSpatialRedo(historyRef.current)
    if (!result.entry || !workspaceRef.current) return
    historyRef.current = result.history
    replaceWorkspace(applySpatialChanges(workspaceRef.current, result.entry.forward))
    refreshHistoryState()
    void persist(result.entry.forward)
  }, [persist, refreshHistoryState, replaceWorkspace, spatialConflict])

  const updateDraftObject = useCallback((object) => {
    if (spatialConflict) return
    const current = workspaceRef.current
    if (!current) return
    replaceWorkspace(applySpatialChanges(current, { putObjects: [object] }))
  }, [replaceWorkspace, spatialConflict])

  const retrySave = useCallback(() => {
    const failed = failedChangesRef.current.splice(0)
    if (failed.length === 0) return
    for (const changes of failed) void persist(changes)
  }, [persist])

  const resolveConflict = useCallback(async (choice) => {
    if (!spatialConflict) return false
    try {
      const result = await resolveSpatialConflict(note.id, choice)
      setSpatialConflict(null)
      if (!result.remoteExists && choice === 'incoming') {
        setLoadError(new Error(`This ${kind} was removed on another device.`))
        replaceWorkspace(null)
        return true
      }
      const loaded = await loadSpatialWorkspace(note.id, kind, note.userId)
      setSpatialConflict(loaded.conflict || null)
      replaceWorkspace(loaded)
      historyRef.current = createSpatialHistory()
      setHistoryState({ canUndo: false, canRedo: false })
      return true
    } catch (error) {
      toast.error(error?.message || 'The spatial conflict could not be resolved.')
      return false
    }
  }, [kind, note.id, note.userId, replaceWorkspace, spatialConflict])

  return {
    workspace,
    loading: !workspace && !loadError,
    loadError,
    saveStatus,
    spatialConflict,
    ...historyState,
    commit,
    undo,
    redo,
    retrySave,
    updateDraftObject,
    resolveConflict,
  }
}
