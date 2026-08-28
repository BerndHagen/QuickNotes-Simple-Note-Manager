import { backend, isBackendConfigured } from '../backend'
import {
  coalesceSyncQueueItem,
  acknowledgeSyncItem,
  db,
  getActiveWorkspaceOwner,
  notifyCanonicalContentPersisted,
} from '../db'
import { assertSpatialPayload } from './model'

export const ANNOTATION_SYNC_TABLES = new Set([
  'spatial_annotations',
  'spatial_annotation_pages',
  'spatial_annotation_objects',
])

const isCloudOwner = (ownerId) => Boolean(
  ownerId && ownerId !== 'local' && ownerId === getActiveWorkspaceOwner() && isBackendConfigured()
)

const timeValue = (value) => Number.isFinite(Date.parse(value)) ? Date.parse(value) : 0

const documentToRemote = (row, ownerId) => ({
  id: row.id,
  user_id: row.ownerId || ownerId,
  note_id: row.noteId,
  resource_id: row.resourceId,
  resource_user_id: row.resourceOwnerId || row.ownerId || ownerId,
  schema_version: row.schemaVersion || 1,
  revision: row.revision || 0,
  settings: row.settings || {},
  viewport: row.viewport || {},
  created_at: row.createdAt,
  updated_at: row.updatedAt,
})

const pageToRemote = (row, ownerId) => ({
  id: row.id,
  annotation_id: row.annotationId,
  user_id: row.ownerId || ownerId,
  note_id: row.noteId,
  resource_id: row.resourceId,
  schema_version: row.schemaVersion || 1,
  page_number: row.pageNumber,
  sort_order: row.order || 0,
  name: row.name || '',
  size: row.size,
  width: row.width,
  height: row.height,
  pattern: row.pattern,
  surface: row.surface,
  created_at: row.createdAt,
  updated_at: row.updatedAt,
})

const objectToRemote = (row, ownerId) => ({
  id: row.id,
  annotation_id: row.annotationId,
  user_id: row.ownerId || ownerId,
  note_id: row.noteId,
  resource_id: row.resourceId,
  page_id: row.pageId,
  schema_version: row.schemaVersion || 1,
  kind: row.kind,
  z_index: row.zIndex || 0,
  bounds: row.bounds,
  data: row.data,
  created_at: row.createdAt,
  updated_at: row.updatedAt,
})

const toRemote = (table, row, ownerId) => {
  if (table === 'spatial_annotations') return documentToRemote(row, ownerId)
  if (table === 'spatial_annotation_pages') return pageToRemote(row, ownerId)
  return objectToRemote(row, ownerId)
}

const documentFromRemote = (row) => ({
  id: row.id,
  ownerId: row.user_id,
  noteId: row.note_id,
  resourceId: row.resource_id,
  resourceOwnerId: row.resource_user_id,
  scope: 'annotation',
  kind: 'paper',
  schemaVersion: row.schema_version,
  revision: row.revision,
  settings: row.settings || {},
  viewport: row.viewport || {},
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

const pageFromRemote = (row) => ({
  id: row.id,
  annotationId: row.annotation_id,
  ownerId: row.user_id,
  noteId: row.note_id,
  resourceId: row.resource_id,
  schemaVersion: row.schema_version,
  pageNumber: row.page_number,
  order: row.sort_order,
  name: row.name,
  size: row.size,
  width: row.width,
  height: row.height,
  pattern: row.pattern,
  surface: row.surface,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

const objectFromRemote = (row) => ({
  id: row.id,
  annotationId: row.annotation_id,
  ownerId: row.user_id,
  noteId: row.note_id,
  resourceId: row.resource_id,
  pageId: row.page_id,
  schemaVersion: row.schema_version,
  kind: row.kind,
  zIndex: row.z_index,
  bounds: row.bounds,
  data: row.data,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

export async function queueAnnotationChangeInTransaction(table, operation, row, ownerId = getActiveWorkspaceOwner()) {
  if (!ANNOTATION_SYNC_TABLES.has(table) || !isCloudOwner(ownerId)) return null
  return coalesceSyncQueueItem(table, operation, row, ownerId)
}

const queuePriority = (item) => {
  if (item.operation === 'delete') {
    if (item.table === 'spatial_annotation_objects') return 0
    if (item.table === 'spatial_annotation_pages') return 1
    return 2
  }
  if (item.table === 'spatial_annotations') return 3
  if (item.table === 'spatial_annotation_pages') return 4
  return 5
}

const syncMarker = (document, timestamp = new Date().toISOString()) => ({
  ownerId: document.ownerId,
  annotationId: document.id,
  noteId: document.noteId,
  resourceId: document.resourceId,
  lastSyncedAt: timestamp,
  revision: Number(document.revision) || 0,
})

const annotationIdForItem = (item) => item.table === 'spatial_annotations'
  ? item.data?.id
  : item.data?.annotationId

const fetchRemoteAnnotationDocumentById = async (annotationId, ownerId) => {
  const { data, error } = await backend
    .from('spatial_annotations')
    .select('*')
    .eq('id', annotationId)
    .eq('user_id', ownerId)
    .limit(1)
  if (error) throw error
  return data?.[0] ? documentFromRemote(data[0]) : null
}

const annotationRemoteChanged = (marker, remote) => {
  if (!remote) return false
  if (Number.isFinite(marker?.revision)) {
    return Number(remote.revision) > marker.revision
  }
  return timeValue(remote.updatedAt) > timeValue(marker?.lastSyncedAt)
}

const recordAnnotationConflict = async (ownerId, annotationId, local, remote, kind) => {
  const marker = await db.annotationSyncState.get([ownerId, annotationId])
  const conflict = {
    id: `annotation:${annotationId}`,
    kind,
    annotationId,
    noteId: local?.noteId || marker?.noteId || remote?.noteId,
    resourceId: local?.resourceId || marker?.resourceId || remote?.resourceId,
    localRevision: local?.revision ?? marker?.revision ?? null,
    remoteRevision: remote?.revision ?? null,
    remoteUpdatedAt: remote?.updatedAt || null,
    detectedAt: new Date().toISOString(),
  }
  await db.annotationSyncState.put({
    ...(marker || {}),
    ownerId,
    annotationId,
    noteId: conflict.noteId,
    resourceId: conflict.resourceId,
    conflict,
  })
  return conflict
}

export async function getAnnotationConflict(annotationId, ownerId = getActiveWorkspaceOwner()) {
  if (!annotationId || !ownerId) return null
  return (await db.annotationSyncState.get([ownerId, annotationId]))?.conflict || null
}

const queueLocalGraph = async (document, operation = 'update') => {
  if (!document || !isCloudOwner(document.ownerId)) return false
  await db.transaction('rw', db.spatialAnnotationPages, db.spatialAnnotationObjects, db.syncQueue, async () => {
    const [pages, objects] = await Promise.all([
      db.spatialAnnotationPages.where('annotationId').equals(document.id).toArray(),
      db.spatialAnnotationObjects.where('annotationId').equals(document.id).toArray(),
    ])
    await queueAnnotationChangeInTransaction('spatial_annotations', operation, document, document.ownerId)
    for (const page of pages) await queueAnnotationChangeInTransaction('spatial_annotation_pages', operation, page, document.ownerId)
    for (const object of objects) await queueAnnotationChangeInTransaction('spatial_annotation_objects', operation, object, document.ownerId)
  })
  return true
}

export async function syncAnnotationQueue(ownerId = getActiveWorkspaceOwner()) {
  if (!isCloudOwner(ownerId) || globalThis.navigator?.onLine === false) return 0
  const items = (await db.syncQueue.where('ownerId').equals(ownerId).toArray())
    .filter((item) => ANNOTATION_SYNC_TABLES.has(item.table))
    .sort((left, right) => queuePriority(left) - queuePriority(right) || left.id - right.id)
  const conflictedAnnotationIds = new Set()
  const annotationIds = [...new Set(items.map(annotationIdForItem).filter(Boolean))]
  for (const annotationId of annotationIds) {
    const graphItems = items.filter((item) => annotationIdForItem(item) === annotationId)
    const marker = await db.annotationSyncState.get([ownerId, annotationId])
    if (marker?.conflict) {
      conflictedAnnotationIds.add(annotationId)
      continue
    }
    const [local, remote] = await Promise.all([
      db.spatialAnnotations.get(annotationId),
      fetchRemoteAnnotationDocumentById(annotationId, ownerId),
    ])
    const onlyDeletes = graphItems.every((item) => item.operation === 'delete')
    const conflictKind = remote
      ? (!marker || annotationRemoteChanged(marker, remote) ? 'concurrent-update' : null)
      : (marker && !marker.remoteDeleteAccepted && !onlyDeletes ? 'remote-delete' : null)
    if (conflictKind) {
      await recordAnnotationConflict(ownerId, annotationId, local, remote, conflictKind)
      conflictedAnnotationIds.add(annotationId)
    }
  }
  let completed = 0
  for (const item of items) {
    if (conflictedAnnotationIds.has(annotationIdForItem(item))) continue
    if (item.operation === 'delete') {
      const { error } = await backend.from(item.table).delete().eq('id', item.data.id).eq('user_id', ownerId)
      if (error) throw error
    } else {
      const table = item.table === 'spatial_annotations'
        ? db.spatialAnnotations
        : item.table === 'spatial_annotation_pages'
          ? db.spatialAnnotationPages
          : db.spatialAnnotationObjects
      const current = await table.get(item.data.id)
      if (!current) throw new Error('A queued annotation row no longer exists locally.')
      const { error } = await backend.from(item.table).upsert(toRemote(item.table, current, ownerId))
      if (error) throw error
    }
    if (await acknowledgeSyncItem(item)) {
      completed += 1
      if (item.table === 'spatial_annotations') {
        if (item.operation === 'delete') {
          await db.annotationSyncState.delete([ownerId, item.data.id])
        } else {
          const current = await db.spatialAnnotations.get(item.data.id)
          if (current) await db.annotationSyncState.put(syncMarker(current))
        }
      }
    }
  }
  return completed
}

export async function fetchRemoteAnnotationWorkspace({ noteId, resourceId, ownerId }) {
  if (!noteId || !resourceId || !ownerId || ownerId === 'local' || !isBackendConfigured() || globalThis.navigator?.onLine === false) return null
  const { data: documents, error: documentError } = await backend
    .from('spatial_annotations')
    .select('*')
    .eq('note_id', noteId)
    .eq('resource_id', resourceId)
    .eq('user_id', ownerId)
    .limit(1)
  if (documentError) throw documentError
  if (!documents?.length) return null
  const document = documentFromRemote(documents[0])
  const [{ data: pageRows, error: pageError }, { data: objectRows, error: objectError }] = await Promise.all([
    backend.from('spatial_annotation_pages').select('*').eq('annotation_id', document.id).order('page_number'),
    backend.from('spatial_annotation_objects').select('*').eq('annotation_id', document.id).order('z_index'),
  ])
  if (pageError) throw pageError
  if (objectError) throw objectError
  const pages = (pageRows || []).map(pageFromRemote)
  const objects = (objectRows || []).map(objectFromRemote)
  assertSpatialPayload({ document, pages, objects })
  return { document, pages, objects, resources: [] }
}

export async function hydrateRemoteAnnotationWorkspace(source) {
  const remote = await fetchRemoteAnnotationWorkspace(source)
  const local = await db.spatialAnnotations
    .where('[ownerId+resourceId]')
    .equals([source.ownerId, source.resourceId])
    .filter((row) => row.noteId === source.noteId)
    .first()
  const marker = local
    ? await db.annotationSyncState.get([local.ownerId, local.id])
    : null
  const pending = local
    ? await db.syncQueue.where('ownerId').equals(local.ownerId).filter((item) =>
        ANNOTATION_SYNC_TABLES.has(item.table) && annotationIdForItem(item) === local.id
      ).first()
    : null
  if (marker?.conflict) return { conflict: marker.conflict, local: true }
  if (!remote) {
    if (!local) return null
    if (pending && marker && !marker.remoteDeleteAccepted) {
      const conflict = await recordAnnotationConflict(
        local.ownerId, local.id, local, null, 'remote-delete'
      )
      return { conflict, local: true }
    }
    if (local.ownerId === getActiveWorkspaceOwner() && !marker) {
      await queueLocalGraph(local, 'insert')
      return null
    }
    if (local.ownerId !== getActiveWorkspaceOwner() || marker) {
      await db.transaction('rw', db.spatialAnnotations, db.spatialAnnotationPages, db.spatialAnnotationObjects, db.annotationSyncState, async () => {
        await db.spatialAnnotations.delete(local.id)
        await db.spatialAnnotationPages.where('annotationId').equals(local.id).delete()
        await db.spatialAnnotationObjects.where('annotationId').equals(local.id).delete()
        await db.annotationSyncState.delete([local.ownerId, local.id])
      })
      notifyCanonicalContentPersisted(local.noteId)
    }
    return null
  }
  const { document, pages, objects } = remote
  const matchingLocal = local?.id === document.id ? local : await db.spatialAnnotations.get(document.id)
  const matchingMarker = matchingLocal
    ? await db.annotationSyncState.get([document.ownerId, document.id])
    : null
  const matchingPending = await db.syncQueue.where('ownerId').equals(document.ownerId).filter((item) =>
    ANNOTATION_SYNC_TABLES.has(item.table) && annotationIdForItem(item) === document.id
  ).first()
  if (matchingPending && document.ownerId === getActiveWorkspaceOwner()) {
    if (!matchingMarker || annotationRemoteChanged(matchingMarker, document)) {
      const conflict = await recordAnnotationConflict(
        document.ownerId, document.id, matchingLocal, document, 'concurrent-update'
      )
      return { conflict, local: true }
    }
    return { local: true }
  }
  if (
    matchingLocal &&
    document.ownerId === getActiveWorkspaceOwner() &&
    new Date(matchingLocal.updatedAt || 0) > new Date(document.updatedAt || 0)
  ) {
    await queueLocalGraph(matchingLocal)
    return { local: true }
  }
  await db.transaction('rw', db.spatialAnnotations, db.spatialAnnotationPages, db.spatialAnnotationObjects, db.annotationSyncState, async () => {
    await db.spatialAnnotations.put(document)
    await db.spatialAnnotationPages.where('annotationId').equals(document.id).delete()
    await db.spatialAnnotationObjects.where('annotationId').equals(document.id).delete()
    if (pages.length) await db.spatialAnnotationPages.bulkPut(pages)
    if (objects.length) await db.spatialAnnotationObjects.bulkPut(objects)
    await db.annotationSyncState.put(syncMarker(document, document.updatedAt))
  })
  notifyCanonicalContentPersisted(document.noteId)
  return remote
}

export async function resolveAnnotationConflict(
  annotationId,
  choice,
  ownerId = getActiveWorkspaceOwner()
) {
  if (!annotationId || !ownerId || !['incoming', 'local'].includes(choice)) {
    throw new Error('Choose either the local or incoming annotation version.')
  }
  const marker = await db.annotationSyncState.get([ownerId, annotationId])
  if (!marker?.conflict) throw new Error('This annotation conflict is no longer available.')
  const remote = await fetchRemoteAnnotationWorkspace({
    noteId: marker.noteId,
    resourceId: marker.resourceId,
    ownerId,
  })
  const queued = await db.syncQueue.where('ownerId').equals(ownerId).filter((item) =>
    ANNOTATION_SYNC_TABLES.has(item.table) && annotationIdForItem(item) === annotationId
  ).toArray()

  if (choice === 'incoming') {
    await db.transaction(
      'rw',
      db.spatialAnnotations,
      db.spatialAnnotationPages,
      db.spatialAnnotationObjects,
      db.annotationSyncState,
      db.syncQueue,
      async () => {
        await db.spatialAnnotations.delete(annotationId)
        await db.spatialAnnotationPages.where('annotationId').equals(annotationId).delete()
        await db.spatialAnnotationObjects.where('annotationId').equals(annotationId).delete()
        if (queued.length) await db.syncQueue.bulkDelete(queued.map((item) => item.id))
        if (remote) {
          await db.spatialAnnotations.put(remote.document)
          if (remote.pages.length) await db.spatialAnnotationPages.bulkPut(remote.pages)
          if (remote.objects.length) await db.spatialAnnotationObjects.bulkPut(remote.objects)
          await db.annotationSyncState.put(syncMarker(remote.document, remote.document.updatedAt))
        } else {
          await db.annotationSyncState.delete([ownerId, annotationId])
        }
      }
    )
  } else {
    const local = await db.spatialAnnotations.get(annotationId)
    await db.annotationSyncState.put({
      ...marker,
      conflict: null,
      revision: remote?.document.revision ?? marker.revision,
      lastSyncedAt: remote?.document.updatedAt || new Date().toISOString(),
      remoteDeleteAccepted: !remote,
    })
    if (local && queued.length === 0) await queueLocalGraph(local, remote ? 'update' : 'insert')
  }
  notifyCanonicalContentPersisted(marker.noteId)
  return { resolved: true, remoteExists: Boolean(remote) }
}

export function subscribeToAnnotationWorkspace(noteId, callback) {
  if (!noteId || !isBackendConfigured()) return { unsubscribe: () => {} }
  const channel = backend
    .channel(`spatial-annotations-${noteId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'spatial_annotations', filter: `note_id=eq.${noteId}` }, callback)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'spatial_annotation_pages', filter: `note_id=eq.${noteId}` }, callback)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'spatial_annotation_objects', filter: `note_id=eq.${noteId}` }, callback)
    .subscribe()
  return { unsubscribe: () => { void backend.removeChannel(channel) } }
}
