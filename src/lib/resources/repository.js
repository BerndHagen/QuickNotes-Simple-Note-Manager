import { db, getActiveWorkspaceOwner, notifyCanonicalContentPersisted } from '../db'
import { generateId } from '../utils'
import {
  assertCanonicalResource,
  assertNoteResourceLink,
  assertResourceBlob,
  createCanonicalResource,
  createNoteResourceLink,
  resourceKindForMimeType,
  RESOURCE_LIMITS,
} from './model'
import { checksumBlob } from './checksum'
import {
  CAPTURE_RESOURCE_QUEUE_TABLE,
  queueCaptureChangeInTransaction,
} from '../capture/cloud'
import { isCanonicalResourceReferenced } from './references'
import { queueAnnotationChangeInTransaction } from '../spatial/annotationCloud'

export { checksumBlob } from './checksum'

const requireOwner = (ownerId = getActiveWorkspaceOwner()) => {
  if (!ownerId) throw new Error('An active workspace owner is required.')
  return ownerId
}

export async function attachResourceToNote({
  noteId,
  blob,
  fileName,
  kind,
  role = 'attachment',
  durationMs = null,
  pageCount = null,
  source = null,
}, options = {}) {
  const ownerId = requireOwner(options.ownerId)
  if (!noteId) throw new Error('A note is required for this resource.')
  if (!(blob instanceof Blob)) throw new Error('A PDF or audio file is required.')
  const resolvedKind = kind || resourceKindForMimeType(blob.type)
  const timestamp = new Date().toISOString()
  const resource = createCanonicalResource({
    id: generateId(),
    ownerId,
    kind: resolvedKind,
    mimeType: blob.type,
    fileName,
    byteSize: blob.size,
    checksum: await checksumBlob(blob),
    durationMs,
    pageCount,
    source,
    createdAt: timestamp,
  })
  const link = createNoteResourceLink({ ownerId, noteId, resourceId: resource.id, role, createdAt: timestamp })
  const payload = {
    resourceId: resource.id,
    ownerId,
    data: blob,
    byteSize: blob.size,
    mimeType: blob.type,
    updatedAt: timestamp,
  }
  assertResourceBlob(payload, resource)

  await db.transaction('rw', db.notes, db.resources, db.resourceBlobs, db.noteResources, db.syncQueue, async () => {
    const note = await db.notes.get(noteId)
    if (!note) throw new Error('The note is no longer available.')
    await db.resources.add(resource)
    await db.resourceBlobs.add(payload)
    await db.noteResources.add(link)
    await queueCaptureChangeInTransaction(CAPTURE_RESOURCE_QUEUE_TABLE, 'insert', resource, ownerId)
    await queueCaptureChangeInTransaction('note_resources', 'insert', link, ownerId)
    await db.notes.update(noteId, { updatedAt: timestamp })
  })
  notifyCanonicalContentPersisted(noteId)
  return { link, resource }
}

export async function listNoteResources(noteId, options = {}) {
  const ownerId = requireOwner(options.ownerId)
  if (!noteId) return []
  const links = await db.noteResources.where('[ownerId+noteId]').equals([ownerId, noteId]).sortBy('createdAt')
  const resources = links.length ? await db.resources.bulkGet(links.map((link) => link.resourceId)) : []
  // Keep damaged references visible. Silently filtering a link whose metadata
  // is missing hides recovery evidence while the raw link remains in IndexedDB.
  return links.map((link, index) => ({
    link,
    resource: resources[index] || null,
    status: resources[index] ? 'metadataAvailable' : 'missingMetadata',
  }))
}

export async function inspectLinkedResource(resourceId, noteId, options = {}) {
  const ownerId = requireOwner(options.ownerId)
  const [resource, link] = await Promise.all([
    db.resources.get(resourceId),
    db.noteResources
      .where('[ownerId+noteId]')
      .equals([ownerId, noteId])
      .filter((row) => row.resourceId === resourceId)
      .first(),
  ])
  if (!link) return { status: 'unlinked', link: null, resource: resource || null, blob: null }
  if (!resource) return { status: 'missingMetadata', link, resource: null, blob: null }
  const payload = await db.resourceBlobs.get(resourceId)
  if (!payload || payload.ownerId !== ownerId) {
    return { status: 'missingPayload', link, resource, blob: null }
  }
  try {
    assertCanonicalResource(resource)
    assertNoteResourceLink(link)
    assertResourceBlob(payload, resource)
  } catch (error) {
    return {
      status: 'invalid',
      link,
      resource,
      blob: null,
      error: error?.message || 'The attachment is damaged.',
    }
  }
  return { status: 'available', link, resource, blob: payload.data }
}

export async function getLinkedResource(resourceId, noteId, options = {}) {
  const inspected = await inspectLinkedResource(resourceId, noteId, options)
  return inspected.status === 'available'
    ? { link: inspected.link, resource: inspected.resource, blob: inspected.blob }
    : null
}

export async function updateCanonicalResourceMetadata(resourceId, updates, options = {}) {
  const ownerId = requireOwner(options.ownerId)
  let saved
  await db.transaction('rw', db.resources, db.syncQueue, async () => {
    const existing = await db.resources.get(resourceId)
    if (!existing || existing.ownerId !== ownerId || !['pdf', 'audio'].includes(existing.kind)) {
      throw new Error('The capture resource was not found.')
    }
    const allowed = Object.fromEntries(
      Object.entries(updates || {}).filter(([key]) => ['pageCount', 'durationMs', 'fileName'].includes(key))
    )
    saved = {
      ...createCanonicalResource({
        ...existing,
        ...allowed,
        id: existing.id,
        ownerId,
        createdAt: existing.createdAt,
        updatedAt: new Date().toISOString(),
      }),
      ...(existing.storagePath ? { storagePath: existing.storagePath } : {}),
    }
    await db.resources.put(saved)
    await queueCaptureChangeInTransaction(CAPTURE_RESOURCE_QUEUE_TABLE, 'update', saved, ownerId)
  })
  return saved
}

export async function removeNoteResource(linkId, options = {}) {
  const ownerId = requireOwner(options.ownerId)
  let removed = null
  await db.transaction(
    'rw',
    db.notes,
    db.resources,
    db.resourceBlobs,
    db.noteResources,
    db.spatialObjects,
    db.spatialAnnotations,
    db.spatialAnnotationPages,
    db.spatialAnnotationObjects,
    db.recognizedContent,
    db.intelligenceJobs,
    db.syncQueue,
    async () => {
      const link = await db.noteResources.get(linkId)
      if (!link || link.ownerId !== ownerId) return
      const recognitionRows = await db.recognizedContent
        .where('[ownerId+noteId]')
        .equals([ownerId, link.noteId])
        .filter((row) => row.sourceResourceId === link.resourceId)
        .toArray()
      const resource = await db.resources.get(link.resourceId)
      const annotations = await db.spatialAnnotations
        .where('[ownerId+resourceId]')
        .equals([ownerId, link.resourceId])
        .filter((document) => document.noteId === link.noteId)
        .toArray()
      const annotationIds = annotations.map((document) => document.id)
      for (const document of annotations) {
        await queueAnnotationChangeInTransaction('spatial_annotations', 'delete', document, ownerId)
      }
      await db.noteResources.delete(linkId)
      await Promise.all([
        annotationIds.length ? db.spatialAnnotations.bulkDelete(annotationIds) : undefined,
        annotationIds.length ? db.spatialAnnotationPages.where('annotationId').anyOf(annotationIds).delete() : undefined,
        annotationIds.length ? db.spatialAnnotationObjects.where('annotationId').anyOf(annotationIds).delete() : undefined,
        db.recognizedContent
          .where('[ownerId+noteId]')
          .equals([ownerId, link.noteId])
          .filter((row) => row.sourceResourceId === link.resourceId)
          .delete(),
        db.intelligenceJobs
          .where('[ownerId+noteId]')
          .equals([ownerId, link.noteId])
          .filter((job) => job.resourceId === link.resourceId)
          .delete(),
      ])
      const orphaned = !await isCanonicalResourceReferenced(link.resourceId)
      if (orphaned) {
        await Promise.all([
          db.resources.delete(link.resourceId),
          db.resourceBlobs.delete(link.resourceId),
        ])
      }
      for (const recognition of recognitionRows) {
        await queueCaptureChangeInTransaction('recognized_content', 'delete', recognition, ownerId)
      }
      await queueCaptureChangeInTransaction('note_resources', 'delete', link, ownerId)
      if (orphaned && resource && ['pdf', 'audio'].includes(resource.kind)) {
        await queueCaptureChangeInTransaction(CAPTURE_RESOURCE_QUEUE_TABLE, 'delete', resource, ownerId)
      }
      const timestamp = new Date().toISOString()
      if (await db.notes.get(link.noteId)) await db.notes.update(link.noteId, { updatedAt: timestamp })
      removed = link
    }
  )
  if (removed) notifyCanonicalContentPersisted(removed.noteId)
  return Boolean(removed)
}

export async function deleteNoteResourceLinks(noteId, options = {}) {
  const ownerId = requireOwner(options.ownerId)
  const links = await db.noteResources.where('[ownerId+noteId]').equals([ownerId, noteId]).toArray()
  for (const link of links) await removeNoteResource(link.id, { ownerId })
  const sessions = await db.recordingSessions.where('[ownerId+noteId]').equals([ownerId, noteId]).toArray()
  for (const session of sessions) await discardRecordingSession(session.id, { ownerId })
  return links.length
}

export async function duplicateNoteResourceLinks(sourceNoteId, targetNoteId, options = {}) {
  const ownerId = requireOwner(options.ownerId)
  const sourceLinks = await db.noteResources.where('[ownerId+noteId]').equals([ownerId, sourceNoteId]).toArray()
  const timestamp = new Date().toISOString()
  const links = sourceLinks.map((link) => createNoteResourceLink({
    ...link,
    id: generateId(),
    noteId: targetNoteId,
    createdAt: timestamp,
    updatedAt: timestamp,
  }))
  if (links.length > 0) {
    await db.transaction('rw', db.noteResources, db.syncQueue, async () => {
      await db.noteResources.bulkAdd(links)
      for (const link of links) {
        await queueCaptureChangeInTransaction('note_resources', 'insert', link, ownerId)
      }
    })
  }
  return links
}

export async function getWorkspaceResourceData(noteIds = null, options = {}) {
  const ownerId = requireOwner(options.ownerId)
  const allowed = noteIds ? new Set(noteIds) : null
  const links = await db.noteResources.where('ownerId').equals(ownerId).toArray()
  const filteredLinks = links.filter((link) => !allowed || allowed.has(link.noteId))
  const resourceIds = [...new Set(filteredLinks.map((link) => link.resourceId))]
  const [resources, resourceBlobs] = resourceIds.length
    ? await Promise.all([db.resources.bulkGet(resourceIds), db.resourceBlobs.bulkGet(resourceIds)])
    : [[], []]
  return {
    noteResources: filteredLinks,
    canonicalResources: resources.filter(Boolean),
    resourceBlobs: resourceBlobs.filter(Boolean),
  }
}

const blobToDataUrl = async (blob, mimeType) => {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const chunks = []
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + chunkSize)))
  }
  return `data:${mimeType};base64,${btoa(chunks.join(''))}`
}

export async function getWorkspaceResourceBackupData(noteIds = null, options = {}) {
  const data = await getWorkspaceResourceData(noteIds, options)
  const metadataById = new Map(data.canonicalResources.map((resource) => [resource.id, resource]))
  const resourcePayloads = []
  for (const row of data.resourceBlobs) {
    const metadata = metadataById.get(row.resourceId)
    if (!metadata) throw new Error('An attachment is missing its metadata and cannot be backed up.')
    assertResourceBlob(row, metadata)
    const checksum = await checksumBlob(row.data)
    if (metadata.checksum && checksum !== metadata.checksum) {
      throw new Error(`The attachment "${metadata.fileName}" is corrupt and cannot be backed up safely.`)
    }
    resourcePayloads.push({
      resourceId: row.resourceId,
      byteSize: row.byteSize,
      mimeType: row.mimeType,
      data: await blobToDataUrl(row.data, row.mimeType),
    })
  }
  if (resourcePayloads.length !== data.canonicalResources.length) {
    throw new Error('An attachment is missing its original binary payload and cannot be backed up.')
  }
  const withoutOwner = (value) => {
    const record = { ...value }
    delete record.ownerId
    delete record.storagePath
    return record
  }
  return {
    canonicalResources: data.canonicalResources.map(withoutOwner),
    noteResources: data.noteResources.map(withoutOwner),
    resourcePayloads,
  }
}

export async function getWorkspaceResourceArchiveData(noteIds = null, options = {}) {
  const data = await getWorkspaceResourceData(noteIds, options)
  const metadataById = new Map(data.canonicalResources.map((resource) => [resource.id, resource]))
  const resourcePayloads = []
  for (const row of data.resourceBlobs) {
    const metadata = metadataById.get(row.resourceId)
    if (!metadata) throw new Error('An attachment is missing its metadata and cannot be backed up.')
    assertResourceBlob(row, metadata)
    resourcePayloads.push({
      resourceId: row.resourceId,
      byteSize: row.byteSize,
      mimeType: row.mimeType,
      checksum: metadata.checksum || null,
      data: row.data,
    })
  }
  if (resourcePayloads.length !== data.canonicalResources.length) {
    throw new Error('An attachment is missing its original binary payload and cannot be backed up.')
  }
  const withoutOwner = (value) => {
    const record = { ...value }
    delete record.ownerId
    delete record.storagePath
    return record
  }
  return {
    canonicalResources: data.canonicalResources.map(withoutOwner),
    noteResources: data.noteResources.map(withoutOwner),
    resourcePayloads,
  }
}

export async function beginRecordingSession(noteId, mimeType, options = {}) {
  const ownerId = requireOwner(options.ownerId)
  if (!noteId || resourceKindForMimeType(mimeType) !== 'audio') {
    throw new Error('A note and supported recording format are required.')
  }
  if (!await db.notes.get(noteId)) throw new Error('The note is no longer available.')
  const timestamp = new Date().toISOString()
  const session = {
    id: generateId(),
    ownerId,
    noteId,
    mimeType,
    status: 'recording',
    byteSize: 0,
    nextSequence: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  await db.recordingSessions.add(session)
  return session
}

export async function appendRecordingChunk(sessionId, chunk, options = {}) {
  const ownerId = requireOwner(options.ownerId)
  if (!(chunk instanceof Blob) || chunk.size <= 0) return null
  return db.transaction('rw', db.recordingSessions, db.resourceChunks, async () => {
    const session = await db.recordingSessions.get(sessionId)
    if (!session || session.ownerId !== ownerId || session.status !== 'recording') {
      throw new Error('The recording session is no longer active.')
    }
    const byteSize = session.byteSize + chunk.size
    if (byteSize > RESOURCE_LIMITS.MAX_AUDIO_BYTES) {
      throw new Error('This recording has reached the 500 MB browser storage limit.')
    }
    const timestamp = new Date().toISOString()
    const row = {
      ownerId,
      recordingId: session.id,
      sequence: session.nextSequence,
      data: chunk,
      byteSize: chunk.size,
      mimeType: chunk.type || session.mimeType,
      createdAt: timestamp,
    }
    const id = await db.resourceChunks.add(row)
    await db.recordingSessions.update(session.id, {
      byteSize,
      nextSequence: session.nextSequence + 1,
      durationMs: Number.isFinite(options.durationMs)
        ? Math.max(0, Math.min(RESOURCE_LIMITS.MAX_AUDIO_DURATION_MS, options.durationMs))
        : session.durationMs || 0,
      updatedAt: timestamp,
    })
    return { ...row, id }
  })
}

const recordingExtension = (mimeType) => {
  const base = String(mimeType).split(';', 1)[0]
  return ({
    'audio/webm': 'webm',
    'audio/ogg': 'ogg',
    'audio/mp4': 'm4a',
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
  })[base] || 'audio'
}

export async function finalizeRecordingSession(sessionId, durationMs, options = {}) {
  const ownerId = requireOwner(options.ownerId)
  const session = await db.recordingSessions.get(sessionId)
  if (!session || session.ownerId !== ownerId) throw new Error('The recording session was not found.')
  const chunks = await db.resourceChunks.where('[ownerId+recordingId]').equals([ownerId, sessionId]).sortBy('sequence')
  if (chunks.length === 0) throw new Error('The recording did not contain any audio.')
  const blob = new Blob(chunks.map((chunk) => chunk.data), { type: session.mimeType })
  const timestamp = new Date().toISOString()
  const resource = createCanonicalResource({
    id: generateId(),
    ownerId,
    kind: 'audio',
    mimeType: session.mimeType,
    fileName: `Recording ${timestamp.replace(/[:.]/gu, '-')}.${recordingExtension(session.mimeType)}`,
    byteSize: blob.size,
    checksum: await checksumBlob(blob),
    durationMs: Number.isFinite(durationMs) ? durationMs : session.durationMs || null,
    source: 'recording',
    createdAt: session.createdAt,
    updatedAt: timestamp,
  })
  const link = createNoteResourceLink({
    ownerId,
    noteId: session.noteId,
    resourceId: resource.id,
    role: 'recording',
    createdAt: session.createdAt,
    updatedAt: timestamp,
  })
  const payload = {
    resourceId: resource.id,
    ownerId,
    data: blob,
    byteSize: blob.size,
    mimeType: session.mimeType,
    updatedAt: timestamp,
  }
  assertResourceBlob(payload, resource)
  await db.transaction(
    'rw',
    db.notes,
    db.resources,
    db.resourceBlobs,
    db.noteResources,
    db.recordingSessions,
    db.resourceChunks,
    db.syncQueue,
    async () => {
      if (!await db.notes.get(session.noteId)) throw new Error('The recording note is no longer available.')
      await db.resources.add(resource)
      await db.resourceBlobs.add(payload)
      await db.noteResources.add(link)
      await db.resourceChunks.where('[ownerId+recordingId]').equals([ownerId, sessionId]).delete()
      await db.recordingSessions.delete(sessionId)
      await queueCaptureChangeInTransaction(CAPTURE_RESOURCE_QUEUE_TABLE, 'insert', resource, ownerId)
      await queueCaptureChangeInTransaction('note_resources', 'insert', link, ownerId)
      await db.notes.update(session.noteId, { updatedAt: timestamp })
    }
  )
  notifyCanonicalContentPersisted(session.noteId)
  return { resource, link }
}

export async function discardRecordingSession(sessionId, options = {}) {
  const ownerId = requireOwner(options.ownerId)
  const session = await db.recordingSessions.get(sessionId)
  if (!session || session.ownerId !== ownerId) return false
  await db.transaction('rw', db.recordingSessions, db.resourceChunks, async () => {
    await db.resourceChunks.where('[ownerId+recordingId]').equals([ownerId, sessionId]).delete()
    await db.recordingSessions.delete(sessionId)
  })
  return true
}

export async function listRecoverableRecordings(noteId, options = {}) {
  const ownerId = requireOwner(options.ownerId)
  return db.recordingSessions.where('[ownerId+noteId]').equals([ownerId, noteId]).sortBy('createdAt')
}
