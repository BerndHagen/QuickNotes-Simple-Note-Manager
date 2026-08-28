import { useCallback, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { createSpatialHistory, invertSpatialChanges, pushSpatialHistory, takeSpatialRedo, takeSpatialUndo } from '../../lib/spatial/history'
import { loadAnnotationWorkspace, saveAnnotationChanges } from '../../lib/spatial/annotations'
import {
  getAnnotationConflict,
  hydrateRemoteAnnotationWorkspace,
  resolveAnnotationConflict,
  subscribeToAnnotationWorkspace,
} from '../../lib/spatial/annotationCloud'
import { applySpatialChanges } from './useSpatialWorkspace'

export default function useAnnotationWorkspace(source) {
  const [workspace, setWorkspace] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [saveStatus, setSaveStatus] = useState('saved')
  const [cloudError, setCloudError] = useState(null)
  const [annotationConflict, setAnnotationConflict] = useState(null)
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false })
  const workspaceRef = useRef(null)
  const historyRef = useRef(createSpatialHistory())
  const writeChainRef = useRef(Promise.resolve())
  const failedRef = useRef([])

  const replaceWorkspace = useCallback((value) => {
    workspaceRef.current = value
    setWorkspace(value)
  }, [])

  useEffect(() => {
    let active = true
    setWorkspace(null)
    setLoadError(null)
    setCloudError(null)
    setAnnotationConflict(null)
    setSaveStatus('saved')
    historyRef.current = createSpatialHistory()
    setHistoryState({ canUndo: false, canRedo: false })
    const load = async () => {
      try {
        const hydration = await hydrateRemoteAnnotationWorkspace(source)
        if (active) {
          setCloudError(null)
          setAnnotationConflict(hydration?.conflict || null)
        }
      } catch (error) {
        if (active) setCloudError(error)
      }
      try {
        const loaded = await loadAnnotationWorkspace(source)
        if (active) {
          replaceWorkspace(loaded)
          if (loaded.document) {
            const durableConflict = await getAnnotationConflict(loaded.document.id, source.ownerId)
            if (active && durableConflict) setAnnotationConflict(durableConflict)
          }
        }
      } catch (error) {
        if (active) setLoadError(error)
      }
    }
    void load()
    const channel = subscribeToAnnotationWorkspace(source.noteId, () => { void load() })
    return () => {
      active = false
      channel.unsubscribe()
    }
  }, [replaceWorkspace, source])

  const refreshHistory = useCallback(() => setHistoryState({
    canUndo: historyRef.current.undo.length > 0,
    canRedo: historyRef.current.redo.length > 0,
  }), [])

  const persist = useCallback((changes) => {
    const annotationId = workspaceRef.current?.document.id
    if (!annotationId) return Promise.resolve()
    setSaveStatus('saving')
    writeChainRef.current = writeChainRef.current
      .catch(() => undefined)
      .then(() => saveAnnotationChanges(annotationId, changes))
      .then((document) => {
        failedRef.current = failedRef.current.filter((item) => item !== changes)
        setWorkspace((current) => {
          if (!current) return current
          const next = { ...current, document }
          workspaceRef.current = next
          return next
        })
        setSaveStatus(failedRef.current.length ? 'error' : 'saved')
      })
      .catch((error) => {
        failedRef.current.push(changes)
        setSaveStatus('error')
        toast.error(error?.message || 'The annotation could not be saved')
      })
    return writeChainRef.current
  }, [])

  const commit = useCallback((changes, options = {}) => {
    const current = workspaceRef.current
    if (!current) return
    const inverse = options.inverse || invertSpatialChanges(changes, current.objects, current.pages, [])
    replaceWorkspace(applySpatialChanges(current, changes))
    if (options.recordHistory !== false) {
      historyRef.current = pushSpatialHistory(historyRef.current, {
        label: options.label || 'Edit annotation',
        forward: structuredClone(changes),
        inverse: structuredClone(inverse),
      })
      refreshHistory()
    }
    void persist(changes)
  }, [persist, refreshHistory, replaceWorkspace])

  const undo = useCallback(() => {
    const result = takeSpatialUndo(historyRef.current)
    if (!result.entry || !workspaceRef.current) return
    historyRef.current = result.history
    replaceWorkspace(applySpatialChanges(workspaceRef.current, result.entry.inverse))
    refreshHistory()
    void persist(result.entry.inverse)
  }, [persist, refreshHistory, replaceWorkspace])

  const redo = useCallback(() => {
    const result = takeSpatialRedo(historyRef.current)
    if (!result.entry || !workspaceRef.current) return
    historyRef.current = result.history
    replaceWorkspace(applySpatialChanges(workspaceRef.current, result.entry.forward))
    refreshHistory()
    void persist(result.entry.forward)
  }, [persist, refreshHistory, replaceWorkspace])

  const updateDraftObject = useCallback((object) => {
    if (workspaceRef.current) replaceWorkspace(applySpatialChanges(workspaceRef.current, { putObjects: [object] }))
  }, [replaceWorkspace])

  const retrySave = useCallback(() => {
    const failed = failedRef.current.splice(0)
    for (const changes of failed) void persist(changes)
  }, [persist])

  const resolveConflict = useCallback(async (choice) => {
    if (!annotationConflict) return false
    try {
      const result = await resolveAnnotationConflict(annotationConflict.annotationId, choice, source.ownerId)
      setAnnotationConflict(null)
      if (choice === 'incoming') {
        if (!result.remoteExists) {
          setLoadError(new Error('The annotation layer was removed on another device. Close this view to start a new layer.'))
          replaceWorkspace(null)
          return true
        }
        const loaded = await loadAnnotationWorkspace(source)
        replaceWorkspace(loaded)
        historyRef.current = createSpatialHistory()
        setHistoryState({ canUndo: false, canRedo: false })
      }
      return true
    } catch (error) {
      setCloudError(error)
      toast.error(error?.message || 'The annotation conflict could not be resolved.')
      return false
    }
  }, [annotationConflict, replaceWorkspace, source])

  return { workspace, loading: !workspace && !loadError, loadError, cloudError, annotationConflict, saveStatus, ...historyState, commit, undo, redo, updateDraftObject, retrySave, resolveConflict }
}
