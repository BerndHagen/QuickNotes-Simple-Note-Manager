import { backend, isBackendConfigured } from '../backend'
import {
  acknowledgeSyncItem,
  coalesceSyncQueueItem,
  db,
  getActiveWorkspaceOwner,
  getPendingSyncItems,
  notifyCanonicalContentPersisted,
} from '../db'
import { assertSpatialPayload } from './model'

export const SPATIAL_SYNC_TABLES = new Set([
  'spatial_documents',
  'spatial_pages',
  'spatial_objects',
  'resources',
])

const isCloudWorkspace = () => {
  const ownerId = getActiveWorkspaceOwner()
  return Boolean(ownerId && ownerId !== 'local' && isBackendConfigured())
}

const documentToRemote = (record, userId) => ({
  note_id: record.noteId,
  user_id: record.ownerId || userId,
  kind: record.kind,
  schema_version: record.schemaVersion,
  revision: record.revision || 0,
  settings: record.settings || {},
  viewport: record.viewport || {},
  created_at: record.createdAt,
  updated_at: record.updatedAt,
})

const pageToRemote = (record, userId) => ({
  id: record.id,
  note_id: record.noteId,
  user_id: record.ownerId || userId,
  schema_version: record.schemaVersion,
  sort_order: record.order || 0,
  name: record.name || '',
  size: record.size,
  width: record.width,
  height: record.height,
  pattern: record.pattern,
  surface: record.surface,
  created_at: record.createdAt,
  updated_at: record.updatedAt,
})

const objectToRemote = (record, userId) => ({
  id: record.id,
  note_id: record.noteId,
  page_id: record.pageId || null,
  user_id: record.ownerId || userId,
  schema_version: record.schemaVersion,
  kind: record.kind,
  z_index: record.zIndex || 0,
  bounds: record.bounds,
  data: record.data,
  created_at: record.createdAt,
  updated_at: record.updatedAt,
})

const resourceToRemote = (record, userId) => ({
  id: record.id,
  user_id: record.ownerId || userId,
  kind: record.kind,
  mime_type: record.mimeType,
  name: record.name || '',
  byte_size: record.byteSize || 0,
  data: record.data,
  thumbnail_data: record.thumbnailData || null,
  pixel_width: record.pixelWidth || null,
  pixel_height: record.pixelHeight || null,
  created_at: record.createdAt,
  updated_at: record.updatedAt,
})

const toRemote = (table, record, userId) => {
  if (table === 'spatial_documents') return documentToRemote(record, userId)
  if (table === 'spatial_pages') return pageToRemote(record, userId)
  if (table === 'spatial_objects') return objectToRemote(record, userId)
  return resourceToRemote(record, userId)
}

const fromRemoteDocument = (record) => ({
  noteId: record.note_id,
  ownerId: record.user_id,
  kind: record.kind,
  schemaVersion: record.schema_version,
  revision: record.revision,
  settings: record.settings || {},
  viewport: record.viewport || {},
  createdAt: record.created_at,
  updatedAt: record.updated_at,
})

const fromRemotePage = (record) => ({
  id: record.id,
  noteId: record.note_id,
  ownerId: record.user_id,
  schemaVersion: record.schema_version,
  order: record.sort_order,
  name: record.name,
  size: record.size,
  width: record.width,
  height: record.height,
  pattern: record.pattern,
  surface: record.surface,
  createdAt: record.created_at,
  updatedAt: record.updated_at,
})

const fromRemoteObject = (record) => ({
  id: record.id,
  noteId: record.note_id,
  pageId: record.page_id,
  ownerId: record.user_id,
  schemaVersion: record.schema_version,
  kind: record.kind,
  zIndex: record.z_index,
  bounds: record.bounds,
  data: record.data,
  createdAt: record.created_at,
  updatedAt: record.updated_at,
})

const fromRemoteResource = (record) => ({
  id: record.id,
  ownerId: record.user_id,
  kind: record.kind,
  mimeType: record.mime_type,
  name: record.name,
  byteSize: record.byte_size,
  data: record.data,
  thumbnailData: record.thumbnail_data || null,
  pixelWidth: record.pixel_width || 0,
  pixelHeight: record.pixel_height || 0,
  createdAt: record.created_at,
  updatedAt: record.updated_at,
})

export async function queueSpatialChangesInTransaction(document, changes) {
  if (!isCloudWorkspace()) return
  const ownerId = getActiveWorkspaceOwner()
  await coalesceSyncQueueItem('spatial_documents', 'update', { ...document, id: document.noteId }, ownerId)
  if (document.ownerId === getActiveWorkspaceOwner()) {
    await coalesceSyncQueueItem('notes', 'update', { id: document.noteId, updatedAt: document.updatedAt }, ownerId)
  }
  for (const page of changes.putPages || []) await coalesceSyncQueueItem('spatial_pages', 'update', page, ownerId)
  for (const id of changes.deletePageIds || []) await coalesceSyncQueueItem('spatial_pages', 'delete', { id, noteId: document.noteId }, ownerId)
  for (const object of changes.putObjects || []) await coalesceSyncQueueItem('spatial_objects', 'update', object, ownerId)
  for (const id of changes.deleteObjectIds || []) await coalesceSyncQueueItem('spatial_objects', 'delete', { id, noteId: document.noteId }, ownerId)
  for (const resource of changes.putResources || []) await coalesceSyncQueueItem('resources', 'update', resource, ownerId)
  for (const id of changes.deleteResourceIds || []) await coalesceSyncQueueItem('resources', 'delete', { id }, ownerId)
}

export async function queueSpatialChanges(document, changes) {
  return db.transaction('rw', db.syncQueue, () => queueSpatialChangesInTransaction(document, changes))
}

export async function queueNewSpatialDocumentInTransaction(document, pages = []) {
  if (!isCloudWorkspace()) return
  const ownerId = getActiveWorkspaceOwner()
  await coalesceSyncQueueItem('spatial_documents', 'insert', { ...document, id: document.noteId }, ownerId)
  for (const page of pages) await coalesceSyncQueueItem('spatial_pages', 'insert', page, ownerId)
}

export async function queueNewSpatialDocument(document, pages = []) {
  return db.transaction('rw', db.syncQueue, () => queueNewSpatialDocumentInTransaction(document, pages))
}

export async function queueSpatialWorkspaceDeletionInTransaction(noteId, resourceIds = []) {
  if (!isCloudWorkspace()) return
  const ownerId = getActiveWorkspaceOwner()
  await coalesceSyncQueueItem('spatial_documents', 'delete', { id: noteId }, ownerId)
  for (const id of resourceIds) await coalesceSyncQueueItem('resources', 'delete', { id }, ownerId)
}

export async function queueSpatialWorkspaceDeletion(noteId, resourceIds = []) {
  return db.transaction('rw', db.syncQueue, () => queueSpatialWorkspaceDeletionInTransaction(noteId, resourceIds))
}

const spatialNoteIdForItem = (item) => {
  if (item.table === 'spatial_documents') return item.data?.noteId || item.data?.id || null
  if (item.table === 'spatial_pages' || item.table === 'spatial_objects') return item.data?.noteId || null
  return null
}

const spatialQueuePriority = (item) => {
  if (item.operation === 'delete') {
    if (item.table === 'spatial_objects') return 0
    if (item.table === 'spatial_pages') return 1
    if (item.table === 'spatial_documents') return 2
    return 3
  }
  if (item.table === 'spatial_documents' && item.operation === 'insert') return 4
  if (item.table === 'resources') return 5
  if (item.table === 'spatial_pages') return 6
  if (item.table === 'spatial_objects') return 7
  // The document revision is the graph commit marker and is published last.
  return 8
}

const spatialSyncMarker = (document, timestamp = new Date().toISOString()) => ({
  ownerId: document.ownerId,
  noteId: document.noteId,
  revision: Number(document.revision) || 0,
  lastSyncedAt: timestamp,
  conflict: null,
  remoteDeleteAccepted: false,
})

export async function getSpatialConflict(noteId, ownerId = getActiveWorkspaceOwner()) {
  if (!noteId || !ownerId) return null
  return (await db.spatialSyncState.get([ownerId, noteId]))?.conflict || null
}

const recordSpatialConflict = async (ownerId, noteId, local, remote, kind) => {
  const marker = await db.spatialSyncState.get([ownerId, noteId])
  const conflict = {
    id: `spatial:${noteId}`,
    kind,
    noteId,
    localRevision: local?.revision ?? null,
    remoteRevision: remote?.revision ?? null,
    remoteUpdatedAt: remote?.updatedAt || null,
    detectedAt: new Date().toISOString(),
  }
  await db.spatialSyncState.put({
    ...(marker || {}),
    ownerId,
    noteId,
    conflict,
  })
  return conflict
}

export async function fetchRemoteSpatialDocument(noteId, ownerId = getActiveWorkspaceOwner()) {
  if (!noteId || !ownerId || ownerId === 'local' || !isBackendConfigured() || globalThis.navigator?.onLine === false) return null
  const { data, error } = await backend
    .from('spatial_documents')
    .select('*')
    .eq('note_id', noteId)
    .eq('user_id', ownerId)
    .limit(1)
  if (error) throw error
  return data?.[0] ? fromRemoteDocument(data[0]) : null
}

export async function syncSpatialQueue(userId) {
  if (!isCloudWorkspace() || !userId) return 0
  const items = (await getPendingSyncItems())
    .filter((item) => SPATIAL_SYNC_TABLES.has(item.table))
    .sort((left, right) => spatialQueuePriority(left) - spatialQueuePriority(right) || left.id - right.id)
  const conflictedNoteIds = new Set()
  const noteIds = [...new Set(items.map(spatialNoteIdForItem).filter(Boolean))]
  for (const noteId of noteIds) {
    const graphItems = items.filter((item) => spatialNoteIdForItem(item) === noteId)
    const marker = await db.spatialSyncState.get([userId, noteId])
    if (marker?.conflict) {
      conflictedNoteIds.add(noteId)
      continue
    }
    const [local, remote] = await Promise.all([
      db.spatialDocuments.get(noteId),
      fetchRemoteSpatialDocument(noteId, userId),
    ])
    const documentItems = graphItems.filter((item) => item.table === 'spatial_documents')
    const onlyDocumentDelete = documentItems.length > 0 && documentItems.every((item) => item.operation === 'delete')
    const conflictKind = remote
      ? (!onlyDocumentDelete && (!marker || Number(remote.revision) > Number(marker.revision)) ? 'concurrent-update' : null)
      : (marker && !marker.remoteDeleteAccepted && !onlyDocumentDelete ? 'remote-delete' : null)
    if (conflictKind) {
      await recordSpatialConflict(userId, noteId, local, remote, conflictKind)
      conflictedNoteIds.add(noteId)
    }
  }
  let count = 0
  for (const item of items) {
    const itemNoteId = spatialNoteIdForItem(item)
    if (
      (itemNoteId && conflictedNoteIds.has(itemNoteId)) ||
      (!itemNoteId && conflictedNoteIds.size > 0 && ['spatial_pages', 'spatial_objects'].includes(item.table))
    ) continue
    if (item.operation === 'delete') {
      const key = item.table === 'spatial_documents' ? 'note_id' : 'id'
      const { error } = await backend.from(item.table).delete().eq(key, item.data.id).eq('user_id', userId)
      if (error) throw error
    } else {
      const table = item.table === 'spatial_documents'
        ? db.spatialDocuments
        : item.table === 'spatial_pages'
          ? db.spatialPages
          : item.table === 'spatial_objects'
            ? db.spatialObjects
            : db.resources
      const current = await table.get(item.data.id || item.data.noteId)
      if (!current) throw new Error('A queued spatial row no longer exists locally.')
      const { error } = await backend.from(item.table).upsert(toRemote(item.table, current, userId))
      if (error) throw error
    }
    if (await acknowledgeSyncItem(item)) {
      count += 1
      if (item.table === 'spatial_documents') {
        const noteId = spatialNoteIdForItem(item)
        if (item.operation === 'delete') {
          await db.spatialSyncState.delete([userId, noteId])
        } else {
          const current = await db.spatialDocuments.get(noteId)
          if (current) await db.spatialSyncState.put(spatialSyncMarker(current))
        }
      }
    }
  }
  return count
}

export async function resolveSpatialConflict(noteId, choice, ownerId = getActiveWorkspaceOwner()) {
  if (!noteId || !ownerId || !['incoming', 'local'].includes(choice)) {
    throw new Error('Choose either the local or incoming spatial version.')
  }
  const marker = await db.spatialSyncState.get([ownerId, noteId])
  if (!marker?.conflict) throw new Error('This spatial conflict is no longer available.')
  const remote = await fetchRemoteSpatialWorkspace(noteId)
  if (remote) assertSpatialPayload(remote)
  const queued = await db.syncQueue.where('ownerId').equals(ownerId).filter((item) => (
    SPATIAL_SYNC_TABLES.has(item.table) && spatialNoteIdForItem(item) === noteId
  )).toArray()

  if (choice === 'incoming') {
    await db.transaction(
      'rw',
      db.spatialDocuments,
      db.spatialPages,
      db.spatialObjects,
      db.resources,
      db.spatialSyncState,
      db.syncQueue,
      async () => {
        await db.spatialDocuments.delete(noteId)
        await db.spatialPages.where('noteId').equals(noteId).delete()
        await db.spatialObjects.where('noteId').equals(noteId).delete()
        if (queued.length) await db.syncQueue.bulkDelete(queued.map((item) => item.id))
        if (remote) {
          await db.spatialDocuments.put(remote.document)
          if (remote.pages.length) await db.spatialPages.bulkPut(remote.pages)
          if (remote.objects.length) await db.spatialObjects.bulkPut(remote.objects)
          if (remote.resources.length) await db.resources.bulkPut(remote.resources)
          await db.spatialSyncState.put(spatialSyncMarker(remote.document, remote.document.updatedAt))
        } else {
          await db.spatialSyncState.delete([ownerId, noteId])
        }
      }
    )
  } else {
    await db.transaction(
      'rw',
      db.spatialDocuments,
      db.spatialPages,
      db.spatialObjects,
      db.resources,
      db.spatialSyncState,
      db.syncQueue,
      async () => {
        const local = await db.spatialDocuments.get(noteId)
        if (!local) throw new Error('The local spatial version is no longer available.')
        if (remote) {
          const pendingPageIds = new Set(queued.filter((item) => item.table === 'spatial_pages').map((item) => item.data.id))
          const pendingObjectIds = new Set(queued.filter((item) => item.table === 'spatial_objects').map((item) => item.data.id))
          const untouchedPages = remote.pages.filter((page) => !pendingPageIds.has(page.id))
          const untouchedObjects = remote.objects.filter((object) => !pendingObjectIds.has(object.id))
          if (untouchedPages.length) await db.spatialPages.bulkPut(untouchedPages)
          if (untouchedObjects.length) await db.spatialObjects.bulkPut(untouchedObjects)
          if (remote.resources.length) await db.resources.bulkPut(remote.resources)
        }
        const now = new Date().toISOString()
        const rebased = {
          ...local,
          revision: Math.max(Number(local.revision) || 0, Number(remote?.document.revision) || 0) + 1,
          updatedAt: now,
        }
        await db.spatialDocuments.put(rebased)
        await coalesceSyncQueueItem(
          'spatial_documents',
          remote ? 'update' : 'insert',
          { ...rebased, id: noteId },
          ownerId
        )
        if (!remote) {
          const [pages, objects] = await Promise.all([
            db.spatialPages.where('noteId').equals(noteId).toArray(),
            db.spatialObjects.where('noteId').equals(noteId).toArray(),
          ])
          for (const page of pages) await coalesceSyncQueueItem('spatial_pages', 'insert', page, ownerId)
          for (const object of objects) await coalesceSyncQueueItem('spatial_objects', 'insert', object, ownerId)
        }
        await db.spatialSyncState.put({
          ...marker,
          conflict: null,
          revision: Number(remote?.document.revision) || 0,
          lastSyncedAt: remote?.document.updatedAt || now,
          remoteDeleteAccepted: !remote,
        })
      }
    )
  }
  notifyCanonicalContentPersisted(noteId, ownerId)
  return { resolved: true, remoteExists: Boolean(remote) }
}

export async function fetchRemoteSpatialWorkspace(noteId) {
  if (!isCloudWorkspace() || globalThis.navigator?.onLine === false) return null
  const { data: documentRows, error: documentError } = await backend
    .from('spatial_documents')
    .select('*')
    .eq('note_id', noteId)
    .eq('user_id', getActiveWorkspaceOwner())
    .limit(1)
  if (documentError) throw documentError
  const remoteDocument = documentRows?.[0]
  if (!remoteDocument) return null

  const [{ data: pageRows, error: pageError }, { data: objectRows, error: objectError }] = await Promise.all([
    backend.from('spatial_pages').select('*').eq('note_id', noteId).order('sort_order'),
    backend.from('spatial_objects').select('*').eq('note_id', noteId).order('z_index'),
  ])
  if (pageError) throw pageError
  if (objectError) throw objectError
  const resourceIds = [...new Set((objectRows || []).map((record) => record.data?.resourceId).filter(Boolean))]
  let resourceRows = []
  if (resourceIds.length > 0) {
    const { data, error } = await backend.from('resources').select('*').in('id', resourceIds)
    if (error) throw error
    resourceRows = data || []
  }
  return {
    document: fromRemoteDocument(remoteDocument),
    pages: (pageRows || []).map(fromRemotePage),
    objects: (objectRows || []).map(fromRemoteObject),
    resources: resourceRows.map(fromRemoteResource),
  }
}
