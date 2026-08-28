import { backend, isBackendConfigured } from '../backend'
import {
  coalesceSyncQueueItem,
  acknowledgeSyncItem,
  db,
  getActiveWorkspaceOwner,
  notifyCanonicalContentPersisted,
} from '../db'
import { checksumBlob } from '../resources/checksum'
import {
  assertCanonicalResource,
  assertNoteResourceLink,
  assertResourceBlob,
  createCanonicalResource,
  createNoteResourceLink,
  RESOURCE_SCHEMA_VERSION,
} from '../resources/model'
import {
  assertRecognizedContent,
  createRecognizedContent,
  INTELLIGENCE_SCHEMA_VERSION,
} from '../intelligence/model'
import {
  CAPTURE_RESUMABLE_THRESHOLD_BYTES,
  uploadCaptureResourceResumably,
} from './resumableUpload'

export const CAPTURE_SYNC_SCHEMA_VERSION = 1
export const CAPTURE_STORAGE_BUCKET = 'quicknotes-resources'
export const CAPTURE_RESOURCE_QUEUE_TABLE = 'capture_resources'
export const CAPTURE_SYNC_TABLES = new Set([
  CAPTURE_RESOURCE_QUEUE_TABLE,
  'note_resources',
  'recognized_content',
])

const PAGE_SIZE = 500
const MAX_REMOTE_ROWS = 50_000
const syncPromises = new Map()

const isCloudOwner = (ownerId) => Boolean(ownerId && ownerId !== 'local')
const timestamp = (value) => Number.isFinite(Date.parse(value)) ? Date.parse(value) : 0
const isRemoteNewer = (local, remote) => timestamp(remote?.updatedAt) > timestamp(local?.updatedAt)

export const captureStoragePath = (ownerId, resourceId) => {
  const owner = String(ownerId || '')
  const resource = String(resourceId || '')
  if (!owner || !resource || owner.includes('/') || resource.includes('/')) {
    throw new Error('A capture resource has an invalid cloud identity.')
  }
  return `${owner}/${resource}`
}

const assertRemoteStoragePath = (value, ownerId, resourceId) => {
  if (value !== captureStoragePath(ownerId, resourceId)) {
    throw new Error('A remote capture resource has an unexpected Storage path.')
  }
  return value
}

export const captureResourceToRemote = (record, userId) => {
  assertCanonicalResource(record)
  if (record.ownerId !== userId) throw new Error('A capture resource belongs to another workspace.')
  return {
    id: record.id,
    user_id: userId,
    kind: record.kind,
    mime_type: record.mimeType,
    name: record.fileName,
    byte_size: record.byteSize,
    data: null,
    thumbnail_data: null,
    pixel_width: null,
    pixel_height: null,
    schema_version: record.schemaVersion,
    file_name: record.fileName,
    checksum: record.checksum || '',
    source: record.source || null,
    duration_ms: record.durationMs,
    page_count: record.pageCount,
    storage_path: captureStoragePath(userId, record.id),
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  }
}

export const captureResourceFromRemote = (record, ownerId) => {
  if (record.user_id !== ownerId || Number(record.schema_version) !== RESOURCE_SCHEMA_VERSION) {
    throw new Error('A remote capture resource has an invalid owner or schema version.')
  }
  return {
    ...createCanonicalResource({
    id: record.id,
    ownerId,
    kind: record.kind,
    mimeType: record.mime_type,
    fileName: record.file_name,
    byteSize: Number(record.byte_size),
    checksum: record.checksum,
    source: record.source,
    durationMs: record.duration_ms == null ? null : Number(record.duration_ms),
    pageCount: record.page_count == null ? null : Number(record.page_count),
    createdAt: record.created_at,
    updatedAt: record.updated_at,
    }),
    storagePath: assertRemoteStoragePath(record.storage_path, ownerId, record.id),
  }
}

export const noteResourceToRemote = (record, userId) => {
  assertNoteResourceLink(record)
  if (record.ownerId !== userId) throw new Error('A resource link belongs to another workspace.')
  return {
    id: record.id,
    note_id: record.noteId,
    user_id: userId,
    resource_id: record.resourceId,
    resource_user_id: userId,
    role: record.role,
    label: record.label,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  }
}

export const noteResourceFromRemote = (record, ownerId) => {
  if (record.user_id !== ownerId || record.resource_user_id !== ownerId) {
    throw new Error('A remote resource link has an invalid owner.')
  }
  return createNoteResourceLink({
    id: record.id,
    ownerId,
    noteId: record.note_id,
    resourceId: record.resource_id,
    role: record.role,
    label: record.label,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  })
}

export const recognizedContentToRemote = (record, userId) => {
  assertRecognizedContent(record)
  if (record.ownerId !== userId) throw new Error('Recognition belongs to another workspace.')
  return {
    id: record.id,
    user_id: userId,
    note_id: record.noteId,
    schema_version: record.schemaVersion,
    source_kind: record.sourceKind,
    source_resource_id: record.sourceResourceId,
    source_resource_user_id: record.sourceResourceId ? userId : null,
    source_object_ids: record.sourceObjectIds,
    source_page_id: record.sourcePageId,
    source_page_number: record.sourcePageNumber,
    source_region: record.sourceRegion,
    source_time_range: record.sourceTimeRange,
    recognition_type: record.type,
    machine_text: record.machineText,
    text: record.text,
    confidence: record.confidence,
    provider_id: record.providerId,
    model_id: record.modelId,
    model_version: record.modelVersion,
    processing_location: record.processingLocation,
    language: record.language,
    source_fingerprint: record.sourceFingerprint,
    status: record.status,
    user_edited: record.userEdited,
    edited_at: record.editedAt,
    created_at: record.createdAt,
    generated_at: record.generatedAt,
    updated_at: record.updatedAt,
  }
}

export const recognizedContentFromRemote = (record, ownerId) => {
  if (
    record.user_id !== ownerId ||
    Number(record.schema_version) !== INTELLIGENCE_SCHEMA_VERSION ||
    (record.source_resource_id && record.source_resource_user_id !== ownerId)
  ) throw new Error('Remote recognition has an invalid owner or schema version.')
  return createRecognizedContent({
    id: record.id,
    ownerId,
    noteId: record.note_id,
    sourceKind: record.source_kind,
    sourceResourceId: record.source_resource_id,
    sourceObjectIds: record.source_object_ids,
    sourcePageId: record.source_page_id,
    sourcePageNumber: record.source_page_number,
    sourceRegion: record.source_region,
    sourceTimeRange: record.source_time_range,
    type: record.recognition_type,
    machineText: record.machine_text,
    text: record.text,
    confidence: record.confidence,
    providerId: record.provider_id,
    modelId: record.model_id,
    modelVersion: record.model_version,
    processingLocation: record.processing_location,
    language: record.language,
    sourceFingerprint: record.source_fingerprint,
    status: record.status,
    userEdited: record.user_edited,
    editedAt: record.edited_at,
    createdAt: record.created_at,
    generatedAt: record.generated_at,
    updatedAt: record.updated_at,
  })
}

export const queueCaptureChangeInTransaction = async (
  table,
  operation,
  data,
  ownerId = getActiveWorkspaceOwner()
) => {
  if (!CAPTURE_SYNC_TABLES.has(table)) throw new Error('The capture sync table is invalid.')
  if (!isCloudOwner(ownerId)) return null
  return coalesceSyncQueueItem(table, operation, data, ownerId)
}

export const queueCaptureChange = async (table, operation, data, ownerId = getActiveWorkspaceOwner()) => {
  if (!isCloudOwner(ownerId)) return null
  return db.transaction('rw', db.syncQueue, () =>
    queueCaptureChangeInTransaction(table, operation, data, ownerId)
  )
}

const fetchPaged = async (table, configure) => {
  const rows = []
  for (let offset = 0; offset < MAX_REMOTE_ROWS; offset += PAGE_SIZE) {
    let query = backend.from(table).select('*')
    query = configure(query).order('id', { ascending: true }).range(offset, offset + PAGE_SIZE - 1)
    const { data, error } = await query
    if (error) throw error
    const page = data || []
    rows.push(...page)
    if (page.length < PAGE_SIZE) return rows
  }
  throw new Error(`Task 4 synchronization exceeded the ${MAX_REMOTE_ROWS.toLocaleString()} row safety limit for ${table}.`)
}

const fetchRemoteSnapshot = async (ownerId) => {
  const [resourceRows, linkRows, recognitionRows] = await Promise.all([
    fetchPaged('resources', (query) => query.eq('user_id', ownerId).in('kind', ['pdf', 'audio'])),
    fetchPaged('note_resources', (query) => query.eq('user_id', ownerId)),
    fetchPaged('recognized_content', (query) => query.eq('user_id', ownerId)),
  ])
  const resources = resourceRows.map((row) => captureResourceFromRemote(row, ownerId))
  const links = linkRows.map((row) => noteResourceFromRemote(row, ownerId))
  const recognized = recognitionRows.map((row) => recognizedContentFromRemote(row, ownerId))
  return {
    resources,
    links,
    recognized,
    resourceById: new Map(resources.map((row) => [row.id, row])),
    linkById: new Map(links.map((row) => [row.id, row])),
    recognitionById: new Map(recognized.map((row) => [row.id, row])),
  }
}

const preferLocalRecognition = (local, remote) => {
  if (Boolean(local.userEdited) !== Boolean(remote.userEdited)) return Boolean(local.userEdited)
  return !isRemoteNewer(local, remote)
}

const captureConflictId = (table, recordId) => `${table}:${recordId}`

const isCorrectionConflict = (local, remote) => Boolean(
  local?.userEdited &&
  remote?.userEdited &&
  local.text !== remote.text
)

const recordCaptureConflict = async (ownerId, table, local, remote) => {
  const state = await db.captureSyncState.get(ownerId)
  const conflict = {
    id: captureConflictId(table, local.id),
    table,
    recordId: local.id,
    noteId: local.noteId,
    resourceId: local.sourceResourceId || null,
    localUpdatedAt: local.updatedAt,
    remote: structuredClone(remote),
    detectedAt: new Date().toISOString(),
  }
  await db.captureSyncState.put({
    ...(state || {}),
    ownerId,
    schemaVersion: CAPTURE_SYNC_SCHEMA_VERSION,
    conflicts: [
      ...(state?.conflicts || []).filter((current) => current.id !== conflict.id),
      conflict,
    ],
  })
  return conflict
}

export async function listCaptureConflicts(
  ownerId = getActiveWorkspaceOwner(),
  { noteId = null, resourceId = null } = {}
) {
  if (!ownerId) return []
  const state = await db.captureSyncState.get(ownerId)
  return (state?.conflicts || []).filter((conflict) =>
    (!noteId || conflict.noteId === noteId) &&
    (!resourceId || conflict.resourceId === resourceId)
  )
}

export async function resolveCaptureConflict(
  conflictId,
  choice,
  ownerId = getActiveWorkspaceOwner()
) {
  if (!ownerId || !['incoming', 'local'].includes(choice)) {
    throw new Error('Choose either the local or incoming correction.')
  }
  const state = await db.captureSyncState.get(ownerId)
  const conflict = state?.conflicts?.find((candidate) => candidate.id === conflictId)
  if (!conflict || conflict.table !== 'recognized_content') {
    throw new Error('This capture conflict is no longer available.')
  }
  const current = await db.recognizedContent.get(conflict.recordId)
  if (!current || current.ownerId !== ownerId || current.updatedAt !== conflict.localUpdatedAt) {
    throw new Error('The local correction changed after this conflict was detected. Synchronize again to review the current versions.')
  }
  const remaining = state.conflicts.filter((candidate) => candidate.id !== conflict.id)
  await db.transaction('rw', db.recognizedContent, db.captureSyncState, db.syncQueue, async () => {
    if (choice === 'incoming') {
      await db.recognizedContent.put(conflict.remote)
      const queued = await db.syncQueue.where('ownerId').equals(ownerId).filter(
        (item) => item.table === conflict.table && item.data?.id === conflict.recordId
      ).toArray()
      if (queued.length) await db.syncQueue.bulkDelete(queued.map((item) => item.id))
    } else {
      const remoteTime = timestamp(conflict.remote.updatedAt)
      const chosen = {
        ...current,
        updatedAt: new Date(Math.max(Date.now(), remoteTime + 3000)).toISOString(),
      }
      await db.recognizedContent.put(chosen)
      await coalesceSyncQueueItem('recognized_content', 'update', chosen, ownerId)
    }
    await db.captureSyncState.put({ ...state, conflicts: remaining })
  })
  notifyCanonicalContentPersisted(conflict.noteId)
  return true
}

const queueBootstrapRows = async (ownerId, remote) => {
  const [resources, links, recognized] = await Promise.all([
    db.resources.where('ownerId').equals(ownerId).filter((row) => ['pdf', 'audio'].includes(row.kind)).toArray(),
    db.noteResources.where('ownerId').equals(ownerId).toArray(),
    db.recognizedContent.where('ownerId').equals(ownerId).toArray(),
  ])
  await db.transaction('rw', db.syncQueue, async () => {
    for (const row of resources) {
      const remoteRow = remote.resourceById.get(row.id)
      if (!remoteRow || !isRemoteNewer(row, remoteRow)) {
        await queueCaptureChangeInTransaction(
          CAPTURE_RESOURCE_QUEUE_TABLE,
          remoteRow ? 'update' : 'insert',
          row,
          ownerId
        )
      }
    }
    for (const row of links) {
      const remoteRow = remote.linkById.get(row.id)
      if (!remoteRow || !isRemoteNewer(row, remoteRow)) {
        await queueCaptureChangeInTransaction('note_resources', remoteRow ? 'update' : 'insert', row, ownerId)
      }
    }
    for (const row of recognized) {
      const remoteRow = remote.recognitionById.get(row.id)
      if (!remoteRow || preferLocalRecognition(row, remoteRow)) {
        await queueCaptureChangeInTransaction('recognized_content', remoteRow ? 'update' : 'insert', row, ownerId)
      }
    }
  })
}

const storageErrorIsMissing = (error) => error?.statusCode === '404' || error?.status === 404

const deleteRemoteResource = async (item, ownerId) => {
  const { data, error } = await backend
    .from('resources')
    .delete()
    .eq('id', item.data.id)
    .eq('user_id', ownerId)
    .select('storage_path')
  if (error) throw error
  const deleted = data?.[0] || null
  if (!deleted) {
    const { data: remaining, error: remainingError } = await backend
      .from('resources')
      .select('id')
      .eq('id', item.data.id)
      .eq('user_id', ownerId)
      .limit(1)
    if (remainingError) throw remainingError
    // The database deletion guard retained a still-referenced source.
    if (remaining?.length) return
  }
  const path = deleted?.storage_path || item.data.storagePath || captureStoragePath(ownerId, item.data.id)
  const { error: storageError } = await backend.storage.from(CAPTURE_STORAGE_BUCKET).remove([path])
  if (storageError && !storageErrorIsMissing(storageError)) throw storageError
}

const remotePayloadMatches = (local, remote) => Boolean(
  remote &&
  local.checksum &&
  local.checksum === remote.checksum &&
  local.byteSize === remote.byteSize &&
  local.mimeType === remote.mimeType &&
  remote.storagePath === captureStoragePath(local.ownerId, local.id)
)

const uploadRemoteResource = async (record, ownerId, remoteRecord = null) => {
  const payload = await db.resourceBlobs.get(record.id)
  if (!payload || payload.ownerId !== ownerId) {
    throw new Error(`The original payload for “${record.fileName}” is unavailable, so it cannot be synchronized.`)
  }
  assertResourceBlob(payload, record)
  const path = captureStoragePath(ownerId, record.id)
  if (remotePayloadMatches(record, remoteRecord)) {
    // Duration, page count, and labels can change without uploading immutable source bytes again.
  } else if (payload.data.size > CAPTURE_RESUMABLE_THRESHOLD_BYTES) {
    await uploadCaptureResourceResumably({
      blob: payload.data,
      bucket: CAPTURE_STORAGE_BUCKET,
      path,
      mimeType: record.mimeType,
      fingerprint: [CAPTURE_STORAGE_BUCKET, ownerId, record.id, record.checksum, record.byteSize].join(':'),
    })
  } else {
    const { error: uploadError } = await backend.storage.from(CAPTURE_STORAGE_BUCKET).upload(path, payload.data, {
      cacheControl: '3600',
      contentType: record.mimeType,
      upsert: true,
    })
    if (uploadError) throw uploadError
  }
  const { error } = await backend.from('resources').upsert(captureResourceToRemote(record, ownerId))
  if (error) throw error
}

const queuePriority = (item) => {
  if (item.operation === 'delete') {
    if (item.table === 'recognized_content') return 0
    if (item.table === 'note_resources') return 1
    return 2
  }
  if (item.table === CAPTURE_RESOURCE_QUEUE_TABLE) return 3
  if (item.table === 'note_resources') return 4
  return 5
}

const flushCaptureQueue = async (ownerId, remote) => {
  const items = (await db.syncQueue.where('ownerId').equals(ownerId).toArray())
    .filter((item) => CAPTURE_SYNC_TABLES.has(item.table))
    .sort((left, right) => queuePriority(left) - queuePriority(right) || left.id - right.id)
  let completed = 0
  for (const item of items) {
    if (item.operation !== 'delete') {
      const remoteRow = item.table === CAPTURE_RESOURCE_QUEUE_TABLE
        ? remote.resourceById.get(item.data.id)
        : item.table === 'note_resources'
          ? remote.linkById.get(item.data.id)
          : remote.recognitionById.get(item.data.id)
      const remoteWins = remoteRow && (
        item.table === 'recognized_content'
          ? !preferLocalRecognition(item.data, remoteRow)
          : isRemoteNewer(item.data, remoteRow)
      )
      if (remoteWins) {
        if (
          item.table === 'recognized_content' &&
          isCorrectionConflict(item.data, remoteRow)
        ) {
          await recordCaptureConflict(ownerId, item.table, item.data, remoteRow)
          continue
        }
        await acknowledgeSyncItem(item)
        continue
      }
    }

    if (item.operation === 'delete') {
      if (item.table === CAPTURE_RESOURCE_QUEUE_TABLE) {
        await deleteRemoteResource(item, ownerId)
      } else {
        const remoteTable = item.table
        const { error } = await backend.from(remoteTable).delete().eq('id', item.data.id).eq('user_id', ownerId)
        if (error) throw error
      }
    } else if (item.table === CAPTURE_RESOURCE_QUEUE_TABLE) {
      const current = await db.resources.get(item.data.id)
      if (!current) throw new Error('A queued capture resource no longer exists locally.')
      await uploadRemoteResource(current, ownerId, remote.resourceById.get(current.id))
    } else if (item.table === 'note_resources') {
      const current = await db.noteResources.get(item.data.id)
      if (!current) throw new Error('A queued resource link no longer exists locally.')
      const { error } = await backend.from('note_resources').upsert(noteResourceToRemote(current, ownerId))
      if (error) throw error
    } else {
      const current = await db.recognizedContent.get(item.data.id)
      if (!current) throw new Error('A queued recognition result no longer exists locally.')
      const { error } = await backend.from('recognized_content').upsert(recognizedContentToRemote(current, ownerId))
      if (error) throw error
    }
    if (await acknowledgeSyncItem(item)) completed += 1
  }
  return completed
}

const downloadResourcePayloads = async (ownerId, resources) => {
  const payloads = []
  for (const resource of resources) {
    const [existing, existingMetadata] = await Promise.all([
      db.resourceBlobs.get(resource.id),
      db.resources.get(resource.id),
    ])
    if (existing && existing.ownerId === ownerId) {
      try {
        assertResourceBlob(existing, resource)
        if (
          !resource.checksum ||
          existingMetadata?.checksum === resource.checksum ||
          await checksumBlob(existing.data) === resource.checksum
        ) {
          payloads.push(existing)
          continue
        }
      } catch {
        // The remote payload below replaces an incomplete or corrupt local cache.
      }
    }
    const { data, error } = await backend.storage.from(CAPTURE_STORAGE_BUCKET).download(resource.storagePath)
    if (error) throw error
    if (!(data instanceof Blob)) throw new Error('Supabase Storage returned an invalid capture payload.')
    const blob = data.type === resource.mimeType ? data : new Blob([data], { type: resource.mimeType })
    const payload = {
      resourceId: resource.id,
      ownerId,
      data: blob,
      byteSize: blob.size,
      mimeType: resource.mimeType,
      updatedAt: resource.updatedAt,
    }
    assertResourceBlob(payload, resource)
    if (resource.checksum && await checksumBlob(blob) !== resource.checksum) {
      throw new Error(`The downloaded payload for “${resource.fileName}” failed its checksum.`)
    }
    payloads.push(payload)
  }
  return payloads
}

export async function hydrateSharedCaptureGraph(noteId, sourceOwnerId) {
  if (!noteId || !isCloudOwner(sourceOwnerId) || !isBackendConfigured() || globalThis.navigator?.onLine === false) {
    return { resources: 0, links: 0, recognized: 0, skipped: true }
  }
  const [linkRows, recognitionRows] = await Promise.all([
    fetchPaged('note_resources', (query) => query.eq('note_id', noteId).eq('user_id', sourceOwnerId)),
    fetchPaged('recognized_content', (query) => query.eq('note_id', noteId).eq('user_id', sourceOwnerId)),
  ])
  const resourceIds = [...new Set([
    ...linkRows.map((row) => row.resource_id),
    ...recognitionRows.map((row) => row.source_resource_id),
  ].filter(Boolean))]
  let resourceRows = []
  if (resourceIds.length) {
    const { data, error } = await backend.from('resources').select('*').eq('user_id', sourceOwnerId).in('id', resourceIds)
    if (error) throw error
    resourceRows = data || []
  }
  const resources = resourceRows.map((row) => captureResourceFromRemote(row, sourceOwnerId))
  const links = linkRows.map((row) => noteResourceFromRemote(row, sourceOwnerId))
  const recognized = recognitionRows.map((row) => recognizedContentFromRemote(row, sourceOwnerId))
  const payloads = await downloadResourcePayloads(sourceOwnerId, resources)
  const remoteLinkIds = new Set(links.map((row) => row.id))
  const remoteRecognitionIds = new Set(recognized.map((row) => row.id))
  const [localLinks, localRecognized] = await Promise.all([
    db.noteResources.where('[ownerId+noteId]').equals([sourceOwnerId, noteId]).toArray(),
    db.recognizedContent.where('[ownerId+noteId]').equals([sourceOwnerId, noteId]).toArray(),
  ])
  const staleLinks = localLinks.filter((row) => !remoteLinkIds.has(row.id))
  const staleRecognized = localRecognized.filter((row) => !remoteRecognitionIds.has(row.id))
  const candidateResourceIds = new Set([
    ...staleLinks.map((row) => row.resourceId),
    ...staleRecognized.map((row) => row.sourceResourceId),
  ].filter(Boolean))
  await db.transaction('rw', db.resources, db.resourceBlobs, db.noteResources, db.recognizedContent, async () => {
    if (staleRecognized.length) await db.recognizedContent.bulkDelete(staleRecognized.map((row) => row.id))
    if (staleLinks.length) await db.noteResources.bulkDelete(staleLinks.map((row) => row.id))
    if (resources.length) await db.resources.bulkPut(resources)
    if (payloads.length) await db.resourceBlobs.bulkPut(payloads)
    if (links.length) await db.noteResources.bulkPut(links)
    if (recognized.length) await db.recognizedContent.bulkPut(recognized)
  })
  const { isCanonicalResourceReferenced } = await import('../resources/references')
  for (const resourceId of candidateResourceIds) {
    if (!await isCanonicalResourceReferenced(resourceId)) {
      await Promise.all([db.resources.delete(resourceId), db.resourceBlobs.delete(resourceId)])
    }
  }
  notifyCanonicalContentPersisted(noteId)
  return { resources: resources.length, links: links.length, recognized: recognized.length, skipped: false }
}

const pendingIdsByTable = async (ownerId = getActiveWorkspaceOwner()) => {
  const result = new Map([...CAPTURE_SYNC_TABLES].map((table) => [table, new Set()]))
  const items = await db.syncQueue.where('ownerId').equals(ownerId).toArray()
  for (const item of items.filter((row) => CAPTURE_SYNC_TABLES.has(row.table))) {
    if (item.data?.id) result.get(item.table).add(item.data.id)
  }
  return result
}

const applyRemoteSnapshot = async (ownerId, remote) => {
  const payloads = await downloadResourcePayloads(ownerId, remote.resources)
  const payloadById = new Map(payloads.map((row) => [row.resourceId, row]))
  const remoteResourceIds = new Set(remote.resources.map((row) => row.id))
  const remoteLinkIds = new Set(remote.links.map((row) => row.id))
  const remoteRecognitionIds = new Set(remote.recognized.map((row) => row.id))
  const changedNoteIds = new Set([
    ...remote.links.map((row) => row.noteId),
    ...remote.recognized.map((row) => row.noteId),
  ])

  await db.transaction(
    'rw',
    db.resources,
    db.resourceBlobs,
    db.noteResources,
    db.recognizedContent,
    db.captureSyncState,
    db.syncQueue,
    async () => {
      const pending = await pendingIdsByTable(ownerId)
      const [localResources, localLinks, localRecognized] = await Promise.all([
        db.resources.where('ownerId').equals(ownerId).filter((row) => ['pdf', 'audio'].includes(row.kind)).toArray(),
        db.noteResources.where('ownerId').equals(ownerId).toArray(),
        db.recognizedContent.where('ownerId').equals(ownerId).toArray(),
      ])
      const staleResources = localResources
        .filter((row) => !remoteResourceIds.has(row.id) && !pending.get(CAPTURE_RESOURCE_QUEUE_TABLE).has(row.id))
      const staleLinks = localLinks
        .filter((row) => !remoteLinkIds.has(row.id) && !pending.get('note_resources').has(row.id))
      const staleRecognized = localRecognized
        .filter((row) => !remoteRecognitionIds.has(row.id) && !pending.get('recognized_content').has(row.id))
      const resourcesToApply = remote.resources
        .filter((row) => !pending.get(CAPTURE_RESOURCE_QUEUE_TABLE).has(row.id))
      const linksToApply = remote.links
        .filter((row) => !pending.get('note_resources').has(row.id))
      const recognizedToApply = remote.recognized
        .filter((row) => !pending.get('recognized_content').has(row.id))
      const payloadsToApply = resourcesToApply.map((row) => payloadById.get(row.id)).filter(Boolean)
      staleLinks.forEach((row) => changedNoteIds.add(row.noteId))
      staleRecognized.forEach((row) => changedNoteIds.add(row.noteId))

      if (staleRecognized.length) await db.recognizedContent.bulkDelete(staleRecognized.map((row) => row.id))
      if (staleLinks.length) await db.noteResources.bulkDelete(staleLinks.map((row) => row.id))
      if (staleResources.length) {
        const ids = staleResources.map((row) => row.id)
        await Promise.all([db.resources.bulkDelete(ids), db.resourceBlobs.bulkDelete(ids)])
      }
      if (resourcesToApply.length) await db.resources.bulkPut(resourcesToApply)
      if (payloadsToApply.length) await db.resourceBlobs.bulkPut(payloadsToApply)
      if (linksToApply.length) await db.noteResources.bulkPut(linksToApply)
      if (recognizedToApply.length) await db.recognizedContent.bulkPut(recognizedToApply)
      const currentSyncState = await db.captureSyncState.get(ownerId)
      await db.captureSyncState.put({
        ...(currentSyncState || {}),
        ownerId,
        schemaVersion: CAPTURE_SYNC_SCHEMA_VERSION,
        lastPulledAt: new Date().toISOString(),
      })
    }
  )
  changedNoteIds.forEach((noteId) => notifyCanonicalContentPersisted(noteId))
  return {
    resources: remote.resources.length,
    links: remote.links.length,
    recognized: remote.recognized.length,
  }
}

const performCaptureSync = async (ownerId) => {
  if (!isCloudOwner(ownerId) || !isBackendConfigured() || globalThis.navigator?.onLine === false) {
    return { uploaded: 0, resources: 0, links: 0, recognized: 0, skipped: true }
  }
  const initialRemote = await fetchRemoteSnapshot(ownerId)
  if (!await db.captureSyncState.get(ownerId)) await queueBootstrapRows(ownerId, initialRemote)
  const uploaded = await flushCaptureQueue(ownerId, initialRemote)
  const refreshed = await fetchRemoteSnapshot(ownerId)
  return { uploaded, ...await applyRemoteSnapshot(ownerId, refreshed), skipped: false }
}

export function syncCaptureCloud(ownerId = getActiveWorkspaceOwner()) {
  if (syncPromises.has(ownerId)) return syncPromises.get(ownerId)
  const promise = performCaptureSync(ownerId).finally(() => syncPromises.delete(ownerId))
  syncPromises.set(ownerId, promise)
  return promise
}

export function subscribeToCaptureCloud(ownerId, callback) {
  if (!isCloudOwner(ownerId) || !isBackendConfigured()) return { unsubscribe: () => {} }
  let channel = backend.channel(`capture-${ownerId}`)
  for (const table of ['resources', 'note_resources', 'recognized_content']) {
    channel = channel.on('postgres_changes', {
      event: '*',
      schema: 'public',
      table,
      filter: `user_id=eq.${ownerId}`,
    }, (payload) => callback(payload))
  }
  channel = channel.subscribe()
  return {
    unsubscribe: () => {
      void backend.removeChannel(channel)
    },
  }
}
