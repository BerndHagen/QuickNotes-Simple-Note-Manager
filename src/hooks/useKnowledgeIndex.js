import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { useNotesStore } from '../store'
import {
  activateKnowledgeIndex,
  getKnowledgeServiceSnapshot,
  subscribeKnowledgeService,
} from '../lib/knowledge/service'

const sharedNotesFromState = (sharedNotes) => (sharedNotes || [])
  .map((share) => share?.notes)
  .filter((note) => note?.id)

export const useKnowledgeIndexBridge = () => {
  const ownerId = useNotesStore((state) => state.hydratedWorkspaceOwnerId)
  const notes = useNotesStore((state) => state.notes)
  const sharedNotes = useNotesStore((state) => state.sharedNotes)
  const folders = useNotesStore((state) => state.folders)
  const accessibleNotes = useMemo(
    () => [...notes, ...sharedNotesFromState(sharedNotes)],
    [notes, sharedNotes]
  )
  const latestSources = useRef({ accessibleNotes, folders })
  latestSources.current = { accessibleNotes, folders }

  useEffect(() => {
    const reconcile = () => {
      const sources = latestSources.current
      void activateKnowledgeIndex({ ownerId, notes: sources.accessibleNotes, folders: sources.folders }).catch(() => {
        // The service publishes the actionable error. Search then uses the
        // last valid derived rows/fallback without concealing canonical data.
      })
    }
    const timeout = setTimeout(reconcile, ownerId ? 100 : 0)
    const persisted = (event) => {
      if (!event.detail?.ownerId || event.detail.ownerId === ownerId) reconcile()
    }
    window.addEventListener('quicknotes:canonical-content-persisted', persisted)
    return () => {
      clearTimeout(timeout)
      window.removeEventListener('quicknotes:canonical-content-persisted', persisted)
    }
  }, [ownerId])

  useEffect(() => {
    if (!ownerId) return undefined
    const timeout = setTimeout(() => {
      void activateKnowledgeIndex({ ownerId, notes: accessibleNotes, folders }).catch(() => {})
    }, 500)
    return () => clearTimeout(timeout)
  }, [folders, ownerId, sharedNotes]) // eslint-disable-line react-hooks/exhaustive-deps

  return useSyncExternalStore(
    subscribeKnowledgeService,
    getKnowledgeServiceSnapshot,
    getKnowledgeServiceSnapshot
  )
}

export const useKnowledgeIndexStatus = () => useSyncExternalStore(
  subscribeKnowledgeService,
  getKnowledgeServiceSnapshot,
  getKnowledgeServiceSnapshot
)
