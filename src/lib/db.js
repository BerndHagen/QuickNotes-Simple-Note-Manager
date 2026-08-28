import Dexie from 'dexie'

export const db = new Dexie('QuickNotesDB')

const WORKSPACE_CHANNEL_NAME = 'quicknotes-workspace-v1'
const WORKSPACE_STORAGE_EVENT_KEY = 'quicknotes-workspace-mutation'
const workspaceSourceId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`
let workspaceChannel = null
let pendingDatabaseLifecycleEvent = null

const getWorkspaceChannel = () => {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return null
  if (!workspaceChannel) workspaceChannel = new BroadcastChannel(WORKSPACE_CHANNEL_NAME)
  return workspaceChannel
}

const emitDatabaseLifecycleEvent = (type, event) => {
  pendingDatabaseLifecycleEvent = {
    type,
    oldVersion: Number(event?.oldVersion || 0),
    newVersion: Number(event?.newVersion || 0),
  }
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent('quicknotes:database-lifecycle', {
      detail: pendingDatabaseLifecycleEvent,
    }))
  }
}

// An old tab must release its IndexedDB connection when a newer QuickNotes
// build needs to migrate. Keeping the editor open against a closed connection
// would make subsequent saves fail, so App presents a non-dismissable reload
// gate when this event is observed.
db.on('versionchange', (event) => {
  db.close()
  emitDatabaseLifecycleEvent('versionchange', event)
})
db.on('blocked', (event) => emitDatabaseLifecycleEvent('blocked', event))

// Dexie's built-in versionchange subscriber closes the connection first. In
// some browsers that close can prevent later Dexie subscribers from observing
// the same event. Attach a native listener to every opened connection as an
// independent safety signal so the editor always enters its non-dismissable
// reload gate after yielding to a newer schema.
db.on('ready', () => {
  const nativeDatabase = db.backendDB()
  if (!nativeDatabase) return
  nativeDatabase.addEventListener('versionchange', (event) => {
    db.close()
    emitDatabaseLifecycleEvent('versionchange', event)
  }, { once: true })
}, true)

export const getPendingDatabaseLifecycleEvent = () => pendingDatabaseLifecycleEvent

export const subscribeToDatabaseLifecycle = (listener) => {
  if (typeof window === 'undefined') return () => {}
  const handle = (event) => listener(event.detail)
  window.addEventListener('quicknotes:database-lifecycle', handle)
  if (pendingDatabaseLifecycleEvent) queueMicrotask(() => listener(pendingDatabaseLifecycleEvent))
  return () => window.removeEventListener('quicknotes:database-lifecycle', handle)
}

export const QUICKNOTES_DB_SCHEMA_V3 = {
  notes: 'id, title, content, folderId, userId, createdAt, updatedAt, syncStatus',
  folders: 'id, name, parentId, userId, createdAt, updatedAt, syncStatus',
  tags: 'id, name, color, userId, syncStatus',
  noteTags: '[noteId+tagId], noteId, tagId',
  noteVersions: '++id, ownerId, [ownerId+noteId], noteId, content, createdAt',
  syncQueue: '++id, ownerId, [ownerId+table], table, operation, data, timestamp',
  workspaceSnapshots: '&ownerId, updatedAt',
  spatialDocuments: '&noteId, ownerId, [ownerId+noteId], kind, updatedAt',
  spatialPages: 'id, ownerId, noteId, [ownerId+noteId], [noteId+order], order, updatedAt',
  spatialObjects: 'id, ownerId, noteId, pageId, [ownerId+noteId], [noteId+pageId], kind, zIndex, updatedAt',
  resources: 'id, ownerId, [ownerId+id], kind, updatedAt',
}

export const QUICKNOTES_DB_SCHEMA_V4 = {
  ...QUICKNOTES_DB_SCHEMA_V3,
  searchDocuments: '&[ownerId+noteId], ownerId, noteId, contentKind, noteType, deleted, archived, updatedAt',
  knowledgeLinks: '&id, ownerId, sourceNoteId, targetNoteId, [ownerId+sourceNoteId], [ownerId+targetNoteId], targetAnchorId, targetObjectId, updatedAt',
  knowledgeIndexState: '&ownerId, schemaVersion, status, updatedAt',
}

export const QUICKNOTES_DB_SCHEMA_V5 = {
  ...QUICKNOTES_DB_SCHEMA_V4,
  // Large Task-4 sources stay out of note JSON and out of the small metadata
  // row. `noteResources` makes sharing one immutable source across notes
  // explicit, while `resourceBlobs` keeps the binary payload in IndexedDB.
  noteResources: '&id, ownerId, noteId, resourceId, [ownerId+noteId], [ownerId+resourceId], role, createdAt',
  resourceBlobs: '&resourceId, ownerId, [ownerId+resourceId], updatedAt',
  recordingSessions: '&id, ownerId, noteId, [ownerId+noteId], status, createdAt',
  resourceChunks: '++id, ownerId, recordingId, [ownerId+recordingId], sequence, createdAt',
  recognizedContent: '&id, ownerId, noteId, [ownerId+noteId], sourceResourceId, sourcePageId, type, status, updatedAt',
  intelligenceJobs: '&id, ownerId, noteId, [ownerId+noteId], [ownerId+status], type, status, priority, updatedAt',
  intelligenceSettings: '&ownerId, updatedAt',
}

export const QUICKNOTES_DB_SCHEMA_V6 = {
  ...QUICKNOTES_DB_SCHEMA_V5,
  // Task-4 cloud hydration is independent from Task-2 spatial sync. This
  // owner marker distinguishes a first merge (where existing local capture
  // data must be adopted) from later remote deletions.
  captureSyncState: '&ownerId, schemaVersion, lastPulledAt',
}

export const QUICKNOTES_DB_SCHEMA_V7 = {
  ...QUICKNOTES_DB_SCHEMA_V6,
  // Attachment annotation rows reuse the Task-2 spatial object contract but
  // remain a separate overlay graph so ordinary notes and Paper/Canvas notes
  // cannot collide on the spatial document primary key.
  spatialAnnotations: '&id, ownerId, noteId, resourceId, [ownerId+noteId], [ownerId+resourceId], updatedAt',
  spatialAnnotationPages: '&id, ownerId, annotationId, noteId, resourceId, [ownerId+annotationId], [ownerId+resourceId], pageNumber, updatedAt',
  spatialAnnotationObjects: '&id, ownerId, annotationId, noteId, resourceId, pageId, [ownerId+annotationId], [ownerId+resourceId], kind, zIndex, updatedAt',
}

export const QUICKNOTES_DB_SCHEMA_V8 = {
  ...QUICKNOTES_DB_SCHEMA_V7,
  // Per-annotation remote markers distinguish a first local upload from an
  // authoritative remote deletion without storing canonical content twice.
  annotationSyncState: '&[ownerId+annotationId], ownerId, annotationId, noteId, resourceId, lastSyncedAt',
}

export const QUICKNOTES_DB_SCHEMA_V9 = {
  ...QUICKNOTES_DB_SCHEMA_V8,
  // Semantic vectors are owner-scoped, derived, and rebuildable. The source
  // fingerprint is part of the validity contract; canonical notes and Task-3
  // search documents remain authoritative.
  semanticEmbeddings: '&id, ownerId, noteId, [ownerId+noteId], [ownerId+status], sourceFingerprint, modelVersion, updatedAt',
  semanticIndexState: '&ownerId, status, modelVersion, updatedAt',
}

export const QUICKNOTES_DB_SCHEMA_V10 = {
  ...QUICKNOTES_DB_SCHEMA_V9,
  // Per-spatial-note remote baselines and durable review state prevent a
  // same-owner offline Paper/Canvas graph from silently overwriting (or being
  // overwritten by) another device's graph.
  spatialSyncState: '&[ownerId+noteId], ownerId, noteId, lastSyncedAt',
}

db.version(1).stores({
  notes: 'id, title, content, folderId, userId, createdAt, updatedAt, syncStatus',
  folders: 'id, name, parentId, userId, createdAt, updatedAt, syncStatus',
  tags: 'id, name, color, userId, syncStatus',
  noteTags: '[noteId+tagId], noteId, tagId',
  noteVersions: '++id, noteId, content, createdAt',
  syncQueue: '++id, table, operation, data, timestamp',
})

db.version(2).stores({
  notes: 'id, title, content, folderId, userId, createdAt, updatedAt, syncStatus',
  folders: 'id, name, parentId, userId, createdAt, updatedAt, syncStatus',
  tags: 'id, name, color, userId, syncStatus',
  noteTags: '[noteId+tagId], noteId, tagId',
  noteVersions: '++id, ownerId, [ownerId+noteId], noteId, content, createdAt',
  syncQueue: '++id, ownerId, [ownerId+table], table, operation, data, timestamp',
  workspaceSnapshots: '&ownerId, updatedAt',
})

db.version(3).stores(QUICKNOTES_DB_SCHEMA_V3)

// Knowledge rows are deliberately derived and owner-scoped. Notes, spatial
// objects, and resources remain authoritative; deleting these tables can only
// make search temporarily unavailable and a deterministic rebuild restores it.
db.version(4).stores(QUICKNOTES_DB_SCHEMA_V4)

// Recognition rows contain attributable machine output and user corrections.
// Jobs/settings are local orchestration state. This additive migration never
// rewrites canonical notes, spatial rows, resources, or Task 3 projections.
db.version(5).stores(QUICKNOTES_DB_SCHEMA_V5)

// Capture sync state is additive orchestration metadata. Source resources,
// note links, recognition, and user corrections remain in their v5 stores.
db.version(6).stores(QUICKNOTES_DB_SCHEMA_V6)

// Annotation overlays are canonical spatial edits over immutable image/PDF
// resources. The original payload remains untouched and independently usable.
db.version(7).stores(QUICKNOTES_DB_SCHEMA_V7)

// Annotation sync markers are orchestration-only. Canonical overlay rows stay
// unchanged and continue to work in local-only workspaces.
db.version(8).stores(QUICKNOTES_DB_SCHEMA_V8)

// Semantic state is disposable derived data. This additive migration does not
// rewrite or upload any canonical content and an empty store means lexical-only
// search, not a broken workspace.
db.version(9).stores(QUICKNOTES_DB_SCHEMA_V9)

// Spatial conflict markers are orchestration-only. Canonical pages, objects,
// resources, and ink remain in their existing stores and are not rewritten.
db.version(10).stores(QUICKNOTES_DB_SCHEMA_V10)

let activeWorkspaceOwnerId = null

export const setActiveWorkspaceOwner = (ownerId) => {
  activeWorkspaceOwnerId = ownerId || null
}

export const getActiveWorkspaceOwner = () => activeWorkspaceOwnerId

export const SyncStatus = {
  SYNCED: 'synced',
  PENDING: 'pending',
  CONFLICT: 'conflict',
  ERROR: 'error',
}

export const notifyCanonicalContentPersisted = (
  noteId = null,
  ownerId = activeWorkspaceOwnerId,
  record = undefined
) => {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return
  const detail = {
    version: 1,
    eventId: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
    sourceId: workspaceSourceId,
    ownerId,
    noteId,
    timestamp: new Date().toISOString(),
  }
  if (record !== undefined) detail.record = record === null ? null : structuredClone(record)
  window.dispatchEvent(new CustomEvent('quicknotes:canonical-content-persisted', {
    detail,
  }))
  try {
    getWorkspaceChannel()?.postMessage(detail)
  } catch {
    // The storage event below is an independent fallback for browsers where
    // BroadcastChannel is unavailable or temporarily fails.
  }
  try {
    // Keep the compatibility pulse small. BroadcastChannel carries the
    // immutable note snapshot; the fallback can still reconcile by ID.
    const fallbackDetail = { ...detail }
    delete fallbackDetail.record
    localStorage.setItem(WORKSPACE_STORAGE_EVENT_KEY, JSON.stringify(fallbackDetail))
    localStorage.removeItem(WORKSPACE_STORAGE_EVENT_KEY)
  } catch {
    // Persistence errors are reported by the store's normal save path. A
    // denied localStorage pulse must not turn a successful IndexedDB write
    // into a failed save.
  }
}

const validWorkspaceMutation = (detail) =>
  detail?.version === 1 &&
  typeof detail.eventId === 'string' &&
  detail.sourceId !== workspaceSourceId &&
  typeof detail.ownerId === 'string' &&
  (detail.noteId === null || typeof detail.noteId === 'string')

export const subscribeToWorkspaceMutations = (listener) => {
  if (typeof window === 'undefined') return () => {}
  const seenEventIds = new Set()
  const receive = (detail) => {
    if (!validWorkspaceMutation(detail)) return
    if (seenEventIds.has(detail.eventId)) return
    seenEventIds.add(detail.eventId)
    if (seenEventIds.size > 200) seenEventIds.delete(seenEventIds.values().next().value)
    // Derived indexes also need to observe writes made in another tab.
    window.dispatchEvent(new CustomEvent('quicknotes:canonical-content-persisted', {
      detail: { ...detail, external: true },
    }))
    listener(detail)
  }
  const handleChannel = (event) => receive(event.data)
  const handleStorage = (event) => {
    if (event.key !== WORKSPACE_STORAGE_EVENT_KEY || !event.newValue) return
    try {
      receive(JSON.parse(event.newValue))
    } catch {
      // Ignore malformed cross-tab pulses. They are not application data.
    }
  }
  const channel = getWorkspaceChannel()
  channel?.addEventListener('message', handleChannel)
  window.addEventListener('storage', handleStorage)
  return () => {
    channel?.removeEventListener('message', handleChannel)
    window.removeEventListener('storage', handleStorage)
  }
}

const noteWriteChains = new Map()
const catalogWriteChains = new Map()

const serializeNoteWrite = (noteId, write) => {
  const previous = noteWriteChains.get(noteId) || Promise.resolve()
  const next = previous.catch(() => undefined).then(write)
  noteWriteChains.set(noteId, next)
  void next.finally(() => {
    if (noteWriteChains.get(noteId) === next) noteWriteChains.delete(noteId)
  }).catch(() => undefined)
  return next
}

const serializeCatalogWrite = (key, write) => {
  const previous = catalogWriteChains.get(key) || Promise.resolve()
  const next = previous.catch(() => undefined).then(write)
  catalogWriteChains.set(key, next)
  void next.finally(() => {
    if (catalogWriteChains.get(key) === next) catalogWriteChains.delete(key)
  }).catch(() => undefined)
  return next
}

export const saveNoteOffline = (note, operation = 'update') => serializeNoteWrite(note.id, async () => {
  const ownerId = activeWorkspaceOwnerId
  const persisted = {
    ...note,
    syncStatus: SyncStatus.PENDING,
    updatedAt: note.updatedAt || new Date().toISOString(),
  }
  let result
  await db.transaction('rw', db.notes, db.syncQueue, async () => {
    result = await db.notes.put(persisted)
    await coalesceSyncQueueItem('notes', operation, persisted, ownerId)
  })
  notifyCanonicalContentPersisted(note.id, ownerId, persisted)
  return result
})

export const deleteNoteOffline = (noteId) => serializeNoteWrite(noteId, async () => {
  const ownerId = activeWorkspaceOwnerId
  await db.transaction('rw', db.notes, db.syncQueue, async () => {
    await db.notes.delete(noteId)
    await coalesceSyncQueueItem('notes', 'delete', { id: noteId }, ownerId)
  })
  notifyCanonicalContentPersisted(noteId, ownerId, null)
})

// Remote reconciliation shares the same per-note serialization lane as local
// edits. A local mutation invoked after a pull is therefore guaranteed to be
// the final durable write, even if IndexedDB completes transactions slowly.
export const saveNoteSyncSnapshot = (note) => serializeNoteWrite(note.id, async () => {
  const result = await db.notes.put(note)
  notifyCanonicalContentPersisted(note.id, activeWorkspaceOwnerId, note)
  return result
})

export const deleteNoteSyncSnapshot = (noteId) => serializeNoteWrite(noteId, async () => {
  await db.notes.delete(noteId)
  notifyCanonicalContentPersisted(noteId, activeWorkspaceOwnerId, null)
})

export const coalesceSyncQueueItem = async (
  table,
  operation,
  data,
  ownerId = activeWorkspaceOwnerId
) => {
  const recordId = data?.id
  const timestamp = new Date().toISOString()
  const mutationId = globalThis.crypto.randomUUID()
  if (!recordId) return db.syncQueue.add({ ownerId, table, operation, data, timestamp, mutationId })

  const existing = await db.syncQueue
    .filter(
      (item) =>
        item.ownerId === ownerId &&
        item.table === table &&
        item.data?.id === recordId
    )
    .toArray()
  const insert = existing.find((item) => item.operation === 'insert')
  const deletion = existing.find((item) => item.operation === 'delete')

  // An insert still covers later edits, but its full-record payload must move
  // forward. Updating it in place also lets a sync worker detect that the
  // snapshot changed while a request was in flight.
  if (operation === 'update' && insert) {
    await db.syncQueue.update(insert.id, { data, timestamp, mutationId })
    return insert.id
  }
  if (operation === 'update' && deletion) return deletion.id

  if (existing.length > 0) await db.syncQueue.bulkDelete(existing.map((item) => item.id))

  return db.syncQueue.add({ ownerId, table, operation, data, timestamp, mutationId })
}

export const permanentlyDeleteNoteOffline = (
  noteId,
  workspaceSnapshot = null
) => serializeNoteWrite(noteId, async () => {
  const ownerId = activeWorkspaceOwnerId
  if (!noteId || !ownerId) throw new Error('An active note workspace is required.')
  let deleted = false
  await db.transaction(
    'rw',
    db.notes,
    db.noteVersions,
    db.noteTags,
    db.syncQueue,
    db.workspaceSnapshots,
    db.spatialDocuments,
    db.spatialPages,
    db.spatialObjects,
    db.resources,
    db.noteResources,
    db.resourceBlobs,
    db.recordingSessions,
    db.resourceChunks,
    db.searchDocuments,
    db.knowledgeLinks,
    db.recognizedContent,
    db.intelligenceJobs,
    db.captureSyncState,
    db.spatialAnnotations,
    db.spatialAnnotationPages,
    db.spatialAnnotationObjects,
    db.annotationSyncState,
    db.spatialSyncState,
    db.semanticEmbeddings,
    async () => {
      const note = await db.notes.get(noteId)
      if (!note) return
      if (ownerId !== 'local' && note.userId && note.userId !== ownerId) {
        throw new Error('This note belongs to another workspace.')
      }

      const [
        spatialDocument,
        spatialObjects,
        links,
        recognized,
        annotations,
        recordingSessions,
      ] = await Promise.all([
        db.spatialDocuments.get(noteId),
        db.spatialObjects.where('[ownerId+noteId]').equals([ownerId, noteId]).toArray(),
        db.noteResources.where('[ownerId+noteId]').equals([ownerId, noteId]).toArray(),
        db.recognizedContent.where('[ownerId+noteId]').equals([ownerId, noteId]).toArray(),
        db.spatialAnnotations.where('[ownerId+noteId]').equals([ownerId, noteId]).toArray(),
        db.recordingSessions.where('[ownerId+noteId]').equals([ownerId, noteId]).toArray(),
      ])
      const annotationIds = annotations.map((annotation) => annotation.id)
      const recordingIds = recordingSessions.map((session) => session.id)
      const candidateResourceIds = [...new Set([
        ...spatialObjects.map((object) => object.data?.resourceId),
        ...links.map((link) => link.resourceId),
        ...recognized.map((row) => row.sourceResourceId),
        ...annotations.map((annotation) => annotation.resourceId),
      ].filter(Boolean))]

      await Promise.all([
        db.notes.delete(noteId),
        db.noteVersions.where('[ownerId+noteId]').equals([ownerId, noteId]).delete(),
        db.noteTags.where('noteId').equals(noteId).delete(),
        spatialDocument?.ownerId === ownerId ? db.spatialDocuments.delete(noteId) : undefined,
        db.spatialPages.where('[ownerId+noteId]').equals([ownerId, noteId]).delete(),
        db.spatialObjects.where('[ownerId+noteId]').equals([ownerId, noteId]).delete(),
        db.noteResources.where('[ownerId+noteId]').equals([ownerId, noteId]).delete(),
        db.recordingSessions.where('[ownerId+noteId]').equals([ownerId, noteId]).delete(),
        recordingIds.length ? db.resourceChunks.where('recordingId').anyOf(recordingIds).delete() : undefined,
        db.recognizedContent.where('[ownerId+noteId]').equals([ownerId, noteId]).delete(),
        db.intelligenceJobs.where('[ownerId+noteId]').equals([ownerId, noteId]).delete(),
        db.searchDocuments.delete([ownerId, noteId]),
        db.knowledgeLinks.where('[ownerId+sourceNoteId]').equals([ownerId, noteId]).delete(),
        db.knowledgeLinks.where('[ownerId+targetNoteId]').equals([ownerId, noteId]).delete(),
        db.semanticEmbeddings.where('[ownerId+noteId]').equals([ownerId, noteId]).delete(),
        annotationIds.length ? db.spatialAnnotations.bulkDelete(annotationIds) : undefined,
        annotationIds.length ? db.spatialAnnotationPages.where('annotationId').anyOf(annotationIds).delete() : undefined,
        annotationIds.length ? db.spatialAnnotationObjects.where('annotationId').anyOf(annotationIds).delete() : undefined,
        annotationIds.length ? db.annotationSyncState.where('annotationId').anyOf(annotationIds).delete() : undefined,
        db.spatialSyncState.delete([ownerId, noteId]),
      ])

      const captureState = await db.captureSyncState.get(ownerId)
      if (captureState?.conflicts?.some((conflict) => conflict.noteId === noteId)) {
        await db.captureSyncState.put({
          ...captureState,
          conflicts: captureState.conflicts.filter((conflict) => conflict.noteId !== noteId),
        })
      }

      if (ownerId !== 'local') {
        for (const annotation of annotations) {
          await coalesceSyncQueueItem('spatial_annotations', 'delete', annotation, ownerId)
        }
        for (const row of recognized) {
          await coalesceSyncQueueItem('recognized_content', 'delete', row, ownerId)
        }
        for (const link of links) {
          await coalesceSyncQueueItem('note_resources', 'delete', link, ownerId)
        }
        if (spatialDocument?.ownerId === ownerId) {
          await coalesceSyncQueueItem('spatial_documents', 'delete', { id: noteId }, ownerId)
        }
      }

      for (const resourceId of candidateResourceIds) {
        const [noteLinks, placements, recognitionSources, annotationSources] = await Promise.all([
          db.noteResources.where('resourceId').equals(resourceId).count(),
          db.spatialObjects.filter((object) => object.data?.resourceId === resourceId).count(),
          db.recognizedContent.where('sourceResourceId').equals(resourceId).count(),
          db.spatialAnnotations.where('resourceId').equals(resourceId).count(),
        ])
        if (noteLinks || placements || recognitionSources || annotationSources) continue
        const resource = await db.resources.get(resourceId)
        if (!resource) continue
        await Promise.all([
          db.resources.delete(resourceId),
          db.resourceBlobs.delete(resourceId),
        ])
        if (ownerId !== 'local' && resource.ownerId === ownerId) {
          const table = ['pdf', 'audio'].includes(resource.kind) ? 'capture_resources' : 'resources'
          await coalesceSyncQueueItem(table, 'delete', resource, ownerId)
        }
      }

      await coalesceSyncQueueItem('notes', 'delete', { id: noteId }, ownerId)
      if (workspaceSnapshot) {
        const requestedNotes = Array.isArray(workspaceSnapshot.notes) ? workspaceSnapshot.notes : []
        const durableNotes = requestedNotes.length
          ? (await db.notes.bulkGet(requestedNotes.map((candidate) => candidate.id))).filter(Boolean)
          : []
        const selectedNoteId = durableNotes.some((candidate) => candidate.id === workspaceSnapshot.selectedNoteId)
          ? workspaceSnapshot.selectedNoteId
          : durableNotes.find((candidate) => !candidate.deleted)?.id || null
        await db.workspaceSnapshots.put({
          ...workspaceSnapshot,
          notes: durableNotes,
          selectedNoteId,
          ownerId,
          updatedAt: new Date().toISOString(),
        })
      }
      deleted = true
    }
  )
  if (deleted) notifyCanonicalContentPersisted(noteId, ownerId)
  return deleted
})

export const addToSyncQueue = async (table, operation, data) => {
  return db.transaction('rw', db.syncQueue, () =>
    coalesceSyncQueueItem(table, operation, data, activeWorkspaceOwnerId)
  )
}

export const saveCatalogRecordOffline = (table, record, operation = 'update') => {
  const store = table === 'folders' ? db.folders : table === 'tags' ? db.tags : null
  if (!store) return Promise.reject(new Error(`Unsupported catalog table: ${table}`))
  const ownerId = activeWorkspaceOwnerId
  return serializeCatalogWrite(`${table}:${record.id}`, async () => {
    await db.transaction('rw', store, db.syncQueue, async () => {
      if (operation === 'delete') await store.delete(record.id)
      else await store.put(record)
      await coalesceSyncQueueItem(table, operation, record, ownerId)
    })
    notifyCanonicalContentPersisted(null, ownerId)
  })
}

export const deleteFolderOffline = (
  folderId,
  updatedNotes = [],
  updatedChildFolders = []
) => serializeCatalogWrite(`folders:${folderId}`, async () => {
  const ownerId = activeWorkspaceOwnerId
  await db.transaction('rw', db.notes, db.folders, db.syncQueue, async () => {
    if (updatedNotes.length > 0) await db.notes.bulkPut(updatedNotes)
    if (updatedChildFolders.length > 0) await db.folders.bulkPut(updatedChildFolders)
    await db.folders.delete(folderId)
    for (const note of updatedNotes) {
      await coalesceSyncQueueItem('notes', 'update', note, ownerId)
    }
    for (const folder of updatedChildFolders) {
      await coalesceSyncQueueItem('folders', 'update', folder, ownerId)
    }
    await coalesceSyncQueueItem('folders', 'delete', { id: folderId }, ownerId)
  })
  notifyCanonicalContentPersisted(null, ownerId)
})

export const deleteTagOffline = (tagId, updatedNotes = []) =>
  serializeCatalogWrite(`tags:${tagId}`, async () => {
    const ownerId = activeWorkspaceOwnerId
    await db.transaction('rw', db.notes, db.tags, db.syncQueue, async () => {
      if (updatedNotes.length > 0) await db.notes.bulkPut(updatedNotes)
      await db.tags.delete(tagId)
      for (const note of updatedNotes) {
        await coalesceSyncQueueItem('notes', 'update', note, ownerId)
      }
      await coalesceSyncQueueItem('tags', 'delete', { id: tagId }, ownerId)
    })
    notifyCanonicalContentPersisted(null, ownerId)
  })

export const saveTagRenameOffline = (tag, updatedNotes = []) =>
  serializeCatalogWrite(`tags:${tag.id}`, async () => {
    const ownerId = activeWorkspaceOwnerId
    await db.transaction('rw', db.notes, db.tags, db.syncQueue, async () => {
      await db.tags.put(tag)
      if (updatedNotes.length > 0) await db.notes.bulkPut(updatedNotes)
      await coalesceSyncQueueItem('tags', 'update', tag, ownerId)
      for (const note of updatedNotes) {
        await coalesceSyncQueueItem('notes', 'update', note, ownerId)
      }
    })
    notifyCanonicalContentPersisted(null, ownerId)
  })

export const saveWorkspaceCatalogMutation = (
  ownerId,
  workspace,
  table,
  operation,
  data
) => {
  if (!ownerId) return Promise.reject(new Error('A workspace owner is required'))
  return serializeCatalogWrite(`workspace:${ownerId}`, async () => {
    await db.transaction('rw', db.workspaceSnapshots, db.syncQueue, async () => {
      await db.workspaceSnapshots.put({
        ...workspace,
        ownerId,
        updatedAt: new Date().toISOString(),
      })
      await coalesceSyncQueueItem(table, operation, data, ownerId)
    })
    notifyCanonicalContentPersisted(null, ownerId)
  })
}

export const getPendingSyncItems = async () => {
  if (!activeWorkspaceOwnerId) {
    return await db.syncQueue.filter((item) => !item.ownerId).toArray()
  }

  return await db.syncQueue.where('ownerId').equals(activeWorkspaceOwnerId).toArray()
}

export const removeSyncItem = async (id) => {
  return await db.syncQueue.delete(id)
}

const sameLegacyQueueSnapshot = (current, snapshot) => {
  if (current.timestamp !== snapshot.timestamp || current.operation !== snapshot.operation) return false
  try {
    return JSON.stringify(current.data) === JSON.stringify(snapshot.data)
  } catch {
    return false
  }
}

// A sync request may be in flight while the same logical row is edited again.
// Coalescing deliberately reuses the IndexedDB primary key, so acknowledging by
// numeric id alone can erase the newer mutation. Compare the immutable mutation
// token inside the same transaction before deleting. Older queue rows without a
// token use a strict payload snapshot comparison until they are next rewritten.
export const acknowledgeSyncItem = async (snapshot) => db.transaction('rw', db.syncQueue, async () => {
  const current = await db.syncQueue.get(snapshot.id)
  if (!current) return false
  const unchanged = current.mutationId || snapshot.mutationId
    ? Boolean(current.mutationId && snapshot.mutationId && current.mutationId === snapshot.mutationId)
    : sameLegacyQueueSnapshot(current, snapshot)
  if (!unchanged) return false
  await db.syncQueue.delete(snapshot.id)
  return true
})

export const saveNoteVersion = async (
  noteId,
  content,
  title,
  noteData = null,
  noteType = 'standard'
) => {
  const MAX_VERSIONS = 30
  const ownerId = activeWorkspaceOwnerId
  const versionEntry = {
    ownerId,
    noteId,
    title: title || '',
    content: content || '',
    noteType,
    createdAt: new Date().toISOString(),
  }
  
  if (noteData) {
    versionEntry.noteData = typeof noteData === 'string' ? noteData : JSON.stringify(noteData)
  }

  // Retention and insertion are one atomic unit. A quota or browser-storage
  // failure while adding the new checkpoint must not first erase older
  // recovery points.
  return db.transaction('rw', db.noteVersions, async () => {
    const versions = ownerId
      ? await db.noteVersions
          .where('[ownerId+noteId]')
          .equals([ownerId, noteId])
          .toArray()
      : await db.noteVersions
          .where('noteId')
          .equals(noteId)
          .filter((version) => !version.ownerId)
          .toArray()

    if (versions.length >= MAX_VERSIONS) {
      const sorted = versions.sort((a, b) => {
        const timeDifference = Date.parse(a.createdAt) - Date.parse(b.createdAt)
        return timeDifference || Number(a.id || 0) - Number(b.id || 0)
      })
      const toDelete = sorted.slice(0, versions.length - MAX_VERSIONS + 1)
      await db.noteVersions.bulkDelete(toDelete.map((version) => version.id))
    }
    return db.noteVersions.add(versionEntry)
  })
}

export const getNoteVersions = async (noteId) => {
  const ownerId = activeWorkspaceOwnerId
  const versions = ownerId
    ? await db.noteVersions
        .where('[ownerId+noteId]')
        .equals([ownerId, noteId])
        .toArray()
    : await db.noteVersions
        .where('noteId')
        .equals(noteId)
        .filter((version) => !version.ownerId)
        .toArray()

  return versions
    .sort((a, b) => {
      const timeDifference = Date.parse(b.createdAt) - Date.parse(a.createdAt)
      return timeDifference || Number(b.id || 0) - Number(a.id || 0)
    })
    .slice(0, 30)
}

export const getWorkspaceNoteVersionBackupData = async (noteIds = null) => {
  const ownerId = activeWorkspaceOwnerId
  const allowed = noteIds ? new Set(noteIds) : null
  const versions = ownerId
    ? await db.noteVersions.where('ownerId').equals(ownerId).toArray()
    : await db.noteVersions.filter((version) => !version.ownerId).toArray()
  return versions
    .filter((version) => !allowed || allowed.has(version.noteId))
    .map((version) => {
      const copy = { ...version }
      delete copy.id
      delete copy.ownerId
      return copy
    })
}

export const saveWorkspaceSnapshot = async (ownerId, workspace) => {
  if (!ownerId) throw new Error('A workspace owner is required')

  const snapshot = {
    ...workspace,
    ownerId,
    updatedAt: new Date().toISOString(),
  }
  await db.workspaceSnapshots.put(snapshot)
  return snapshot
}

export const getWorkspaceSnapshot = async (ownerId) => {
  if (!ownerId) return null
  return (await db.workspaceSnapshots.get(ownerId)) || null
}

export const getWorkspaceCache = async () => {
  const [notes, folders, tags] = await Promise.all([
    db.notes.toArray(),
    db.folders.toArray(),
    db.tags.toArray(),
  ])
  return { notes, folders, tags }
}

export const replaceWorkspaceCache = async ({
  notes = [],
  corruptedNotes = [],
  folders = [],
  tags = [],
} = {}) => {
  // Rows with a usable primary key can remain in the canonical notes store
  // even while the UI isolates them. Rows without a key are still preserved
  // in the owner workspace snapshot and raw recovery export.
  const activeNoteIds = new Set(notes.map((note) => note.id))
  const recoverableRows = corruptedNotes
    .map((record) => record?.raw)
    .filter((record) =>
      record &&
      typeof record.id === 'string' &&
      record.id &&
      !activeNoteIds.has(record.id)
    )
  await db.transaction('rw', db.notes, db.folders, db.tags, db.noteTags, async () => {
    await Promise.all([
      db.notes.clear(),
      db.folders.clear(),
      db.tags.clear(),
      db.noteTags.clear(),
    ])
    if (notes.length + recoverableRows.length > 0) {
      await db.notes.bulkPut([...notes, ...recoverableRows])
    }
    if (folders.length > 0) await db.folders.bulkPut(folders)
    if (tags.length > 0) await db.tags.bulkPut(tags)
  })
}

export const adoptLegacyWorkspaceRecords = async (ownerId) => {
  if (!ownerId) return

  await db.transaction('rw', db.syncQueue, db.noteVersions, async () => {
    const [legacyQueue, legacyVersions] = await Promise.all([
      db.syncQueue.filter((item) => !item.ownerId).toArray(),
      db.noteVersions.filter((version) => !version.ownerId).toArray(),
    ])

    if (legacyQueue.length > 0) {
      await db.syncQueue.bulkPut(
        legacyQueue.map((item) => ({ ...item, ownerId }))
      )
    }
    if (legacyVersions.length > 0) {
      await db.noteVersions.bulkPut(
        legacyVersions.map((version) => ({ ...version, ownerId }))
      )
    }
  })
}

export const deleteWorkspaceData = async (ownerId) => {
  if (!ownerId) return

  await db.transaction(
    'rw',
    db.workspaceSnapshots,
    db.syncQueue,
    db.noteVersions,
    db.notes,
    db.folders,
    db.tags,
    db.noteTags,
    db.spatialDocuments,
    db.spatialPages,
    db.spatialObjects,
    db.resources,
    db.noteResources,
    db.resourceBlobs,
    db.recordingSessions,
    db.resourceChunks,
    db.searchDocuments,
    db.knowledgeLinks,
    db.knowledgeIndexState,
    db.recognizedContent,
    db.intelligenceJobs,
    db.intelligenceSettings,
    db.captureSyncState,
    db.spatialAnnotations,
    db.spatialAnnotationPages,
    db.spatialAnnotationObjects,
    db.annotationSyncState,
    db.spatialSyncState,
    db.semanticEmbeddings,
    db.semanticIndexState,
    async () => {
      await Promise.all([
        db.workspaceSnapshots.delete(ownerId),
        db.syncQueue.where('ownerId').equals(ownerId).delete(),
        db.noteVersions.where('ownerId').equals(ownerId).delete(),
        db.spatialDocuments.where('ownerId').equals(ownerId).delete(),
        db.spatialPages.where('ownerId').equals(ownerId).delete(),
        db.spatialObjects.where('ownerId').equals(ownerId).delete(),
        db.resources.where('ownerId').equals(ownerId).delete(),
        db.noteResources.where('ownerId').equals(ownerId).delete(),
        db.resourceBlobs.where('ownerId').equals(ownerId).delete(),
        db.recordingSessions.where('ownerId').equals(ownerId).delete(),
        db.resourceChunks.where('ownerId').equals(ownerId).delete(),
        db.searchDocuments.where('ownerId').equals(ownerId).delete(),
        db.knowledgeLinks.where('ownerId').equals(ownerId).delete(),
        db.knowledgeIndexState.delete(ownerId),
        db.recognizedContent.where('ownerId').equals(ownerId).delete(),
        db.intelligenceJobs.where('ownerId').equals(ownerId).delete(),
        db.intelligenceSettings.delete(ownerId),
        db.captureSyncState.delete(ownerId),
        db.spatialAnnotations.where('ownerId').equals(ownerId).delete(),
        db.spatialAnnotationPages.where('ownerId').equals(ownerId).delete(),
        db.spatialAnnotationObjects.where('ownerId').equals(ownerId).delete(),
        db.annotationSyncState.where('ownerId').equals(ownerId).delete(),
        db.spatialSyncState.where('ownerId').equals(ownerId).delete(),
        db.semanticEmbeddings.where('ownerId').equals(ownerId).delete(),
        db.semanticIndexState.delete(ownerId),
      ])

      if (activeWorkspaceOwnerId === ownerId) {
        await Promise.all([
          db.notes.clear(),
          db.folders.clear(),
          db.tags.clear(),
          db.noteTags.clear(),
        ])
      }
    }
  )
}

export const clearLocalData = async () => {
  await db.notes.clear()
  await db.folders.clear()
  await db.tags.clear()
  await db.noteTags.clear()
  await db.noteVersions.clear()
  await db.syncQueue.clear()
  await db.workspaceSnapshots.clear()
  await db.spatialDocuments.clear()
  await db.spatialPages.clear()
  await db.spatialObjects.clear()
  await db.resources.clear()
  await db.noteResources.clear()
  await db.resourceBlobs.clear()
  await db.recordingSessions.clear()
  await db.resourceChunks.clear()
  await db.searchDocuments.clear()
  await db.knowledgeLinks.clear()
  await db.knowledgeIndexState.clear()
  await db.recognizedContent.clear()
  await db.intelligenceJobs.clear()
  await db.intelligenceSettings.clear()
  await db.captureSyncState.clear()
  await db.spatialAnnotations.clear()
  await db.spatialAnnotationPages.clear()
  await db.spatialAnnotationObjects.clear()
  await db.annotationSyncState.clear()
  await db.spatialSyncState.clear()
  await db.semanticEmbeddings.clear()
  await db.semanticIndexState.clear()
  activeWorkspaceOwnerId = null
}
