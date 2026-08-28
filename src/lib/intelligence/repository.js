import { coalesceSyncQueueItem, db, getActiveWorkspaceOwner, notifyCanonicalContentPersisted } from '../db'
import {
  assertRecognizedContent,
  correctRecognizedContent,
  markRecognizedContentStale,
  mergeRecognitionRerun,
} from './model'
import {
  createDefaultIntelligenceSettings,
  normalizeIntelligenceSettings,
} from './policy'
import {
  CAPTURE_RESOURCE_QUEUE_TABLE,
  queueCaptureChangeInTransaction,
} from '../capture/cloud'
import { isCanonicalResourceReferenced } from '../resources/references'

const requireOwner = (ownerId = getActiveWorkspaceOwner()) => {
  if (!ownerId) throw new Error('An active workspace owner is required.')
  return ownerId
}

const assertOwner = (record, ownerId) => {
  if (record.ownerId !== ownerId) throw new Error('Recognition belongs to another workspace.')
}

export async function getRecognizedContent(id, ownerId = getActiveWorkspaceOwner()) {
  const resolvedOwner = requireOwner(ownerId)
  const record = await db.recognizedContent.get(id)
  return record?.ownerId === resolvedOwner ? record : null
}

export async function listRecognizedContentForNote(noteId, options = {}) {
  const ownerId = requireOwner(options.ownerId)
  if (!noteId) return []
  const rows = await db.recognizedContent
    .where('[ownerId+noteId]')
    .equals([ownerId, noteId])
    .toArray()
  const statuses = options.statuses || ['current', 'stale']
  return rows
    .filter((row) => statuses.includes(row.status))
    .sort((left, right) => {
      const leftPage = left.sourcePageNumber ?? Number.MAX_SAFE_INTEGER
      const rightPage = right.sourcePageNumber ?? Number.MAX_SAFE_INTEGER
      const leftTime = left.sourceTimeRange?.startMs ?? Number.MAX_SAFE_INTEGER
      const rightTime = right.sourceTimeRange?.startMs ?? Number.MAX_SAFE_INTEGER
      return leftPage - rightPage || leftTime - rightTime || left.id.localeCompare(right.id)
    })
}

export async function listRecognizedContentForNotes(noteIds, options = {}) {
  const ownerId = requireOwner(options.ownerId)
  const uniqueIds = [...new Set((noteIds || []).filter(Boolean))]
  if (uniqueIds.length === 0) return []
  const rows = await db.recognizedContent
    .where('[ownerId+noteId]')
    .anyOf(uniqueIds.map((noteId) => [ownerId, noteId]))
    .toArray()
  const statuses = options.statuses || ['current']
  return rows.filter((row) => statuses.includes(row.status))
}

export async function saveRecognizedContent(record, options = {}) {
  const ownerId = requireOwner(options.ownerId)
  assertRecognizedContent(record)
  assertOwner(record, ownerId)
  let saved
  await db.transaction('rw', db.recognizedContent, db.syncQueue, async () => {
    const existing = await db.recognizedContent.get(record.id)
    if (existing && existing.ownerId !== ownerId) throw new Error('Recognition identity belongs to another workspace.')
    saved = existing && options.rerun ? mergeRecognitionRerun(existing, record) : record
    await db.recognizedContent.put(saved)
    await queueCaptureChangeInTransaction(
      'recognized_content',
      existing ? 'update' : 'insert',
      saved,
      ownerId
    )
  })
  notifyCanonicalContentPersisted(saved.noteId, ownerId)
  return saved
}

export async function saveRecognizedContentBatch(records, options = {}) {
  const ownerId = requireOwner(options.ownerId)
  const rows = records || []
  if (rows.length > 2_000) throw new Error('A recognition result contains too many records.')
  rows.forEach((record) => {
    assertRecognizedContent(record)
    assertOwner(record, ownerId)
  })
  const noteIds = new Set(rows.map((row) => row.noteId))
  await db.transaction('rw', db.recognizedContent, db.syncQueue, async () => {
    const identities = new Set()
    for (const row of rows) {
      if (identities.has(row.id)) throw new Error('A recognition result contains duplicate identities.')
      identities.add(row.id)
      const existing = await db.recognizedContent.get(row.id)
      if (existing && existing.ownerId !== ownerId) throw new Error('Recognition identity belongs to another workspace.')
      const saved = existing && options.rerun ? mergeRecognitionRerun(existing, row) : row
      await db.recognizedContent.put(saved)
      await queueCaptureChangeInTransaction(
        'recognized_content',
        existing ? 'update' : 'insert',
        saved,
        ownerId
      )
    }
  })
  noteIds.forEach((noteId) => notifyCanonicalContentPersisted(noteId, ownerId))
  return rows.length
}

export async function replaceAudioTranscript(records, options = {}) {
  const ownerId = requireOwner(options.ownerId)
  const noteId = options.noteId
  const resourceId = options.resourceId
  const providerId = options.providerId
  const rows = records || []
  if (!noteId || !resourceId || !providerId || rows.length === 0 || rows.length > 2_000) {
    throw new Error('A bounded audio transcript and canonical source are required.')
  }
  rows.forEach((row) => {
    assertRecognizedContent(row)
    assertOwner(row, ownerId)
    if (
      row.noteId !== noteId ||
      row.sourceKind !== 'audio' ||
      row.sourceResourceId !== resourceId ||
      row.type !== 'transcript' ||
      row.providerId !== providerId
    ) throw new Error('A transcript row does not match its canonical source.')
  })

  let savedRows = []
  await db.transaction('rw', db.recognizedContent, db.syncQueue, async () => {
    const existing = await db.recognizedContent
      .where('[ownerId+noteId]')
      .equals([ownerId, noteId])
      .filter((row) =>
        row.type === 'transcript' &&
        row.sourceResourceId === resourceId &&
        row.status !== 'superseded'
      )
      .toArray()
    const existingById = new Map(existing.map((row) => [row.id, row]))
    const incomingIds = new Set()
    savedRows = []
    for (const row of rows) {
      if (incomingIds.has(row.id)) throw new Error('A transcript contains duplicate segment identities.')
      incomingIds.add(row.id)
      const previous = existingById.get(row.id)
      const saved = previous ? mergeRecognitionRerun(previous, row) : row
      await db.recognizedContent.put(saved)
      await queueCaptureChangeInTransaction('recognized_content', previous ? 'update' : 'insert', saved, ownerId)
      savedRows.push(saved)
    }
    for (const previous of existing) {
      if (incomingIds.has(previous.id)) continue
      const superseded = { ...previous, status: 'superseded', updatedAt: new Date().toISOString() }
      assertRecognizedContent(superseded)
      await db.recognizedContent.put(superseded)
      await queueCaptureChangeInTransaction('recognized_content', 'update', superseded, ownerId)
    }
  })
  notifyCanonicalContentPersisted(noteId, ownerId)
  return savedRows
}

export async function correctRecognition(id, text, options = {}) {
  const ownerId = requireOwner(options.ownerId)
  let corrected
  await db.transaction('rw', db.recognizedContent, db.syncQueue, async () => {
    const existing = await db.recognizedContent.get(id)
    if (!existing || existing.ownerId !== ownerId) throw new Error('Recognition result was not found.')
    corrected = correctRecognizedContent(existing, text)
    await db.recognizedContent.put(corrected)
    await queueCaptureChangeInTransaction('recognized_content', 'update', corrected, ownerId)
  })
  notifyCanonicalContentPersisted(corrected.noteId, ownerId)
  return corrected
}

export async function invalidateRecognizedContent(source, options = {}) {
  const ownerId = requireOwner(options.ownerId)
  if (!source?.noteId) throw new Error('A note source is required to invalidate recognition.')
  const objectIds = new Set(source.sourceObjectIds || [])
  let changed = []
  await db.transaction('rw', db.recognizedContent, db.syncQueue, async () => {
    const rows = await db.recognizedContent
      .where('[ownerId+noteId]')
      .equals([ownerId, source.noteId])
      .toArray()
    changed = rows.filter((row) => {
      if (row.status !== 'current') return false
      if (source.sourceResourceId && row.sourceResourceId !== source.sourceResourceId) return false
      if (source.sourcePageId && row.sourcePageId !== source.sourcePageId) return false
      if (objectIds.size > 0 && !row.sourceObjectIds.some((id) => objectIds.has(id))) return false
      return true
    }).map((row) => markRecognizedContentStale(row))
    if (changed.length > 0) {
      await db.recognizedContent.bulkPut(changed)
      for (const row of changed) {
        await queueCaptureChangeInTransaction('recognized_content', 'update', row, ownerId)
      }
    }
  })
  if (changed.length > 0) notifyCanonicalContentPersisted(source.noteId, ownerId)
  return changed.length
}

export async function deleteIntelligenceNoteData(noteId, options = {}) {
  const ownerId = requireOwner(options.ownerId)
  if (!noteId) return
  await db.transaction(
    'rw',
    db.resources,
    db.resourceBlobs,
    db.noteResources,
    db.spatialObjects,
    db.spatialAnnotations,
    db.recognizedContent,
    db.intelligenceJobs,
    db.semanticEmbeddings,
    db.syncQueue,
    async () => {
    const recognized = await db.recognizedContent
      .where('[ownerId+noteId]')
      .equals([ownerId, noteId])
      .toArray()
    const sourceResourceIds = [...new Set(recognized.map((row) => row.sourceResourceId).filter(Boolean))]
    await Promise.all([
      db.recognizedContent.where('[ownerId+noteId]').equals([ownerId, noteId]).delete(),
      db.intelligenceJobs.where('[ownerId+noteId]').equals([ownerId, noteId]).delete(),
      db.semanticEmbeddings.where('[ownerId+noteId]').equals([ownerId, noteId]).delete(),
    ])
    for (const row of recognized) {
      await queueCaptureChangeInTransaction('recognized_content', 'delete', row, ownerId)
    }
    for (const resourceId of sourceResourceIds) {
      if (await isCanonicalResourceReferenced(resourceId)) continue
      const resource = await db.resources.get(resourceId)
      if (!resource) continue
      await Promise.all([
        db.resources.delete(resourceId),
        db.resourceBlobs.delete(resourceId),
      ])
      if (ownerId !== 'local') {
        const table = ['pdf', 'audio'].includes(resource.kind)
          ? CAPTURE_RESOURCE_QUEUE_TABLE
          : 'resources'
        await coalesceSyncQueueItem(table, 'delete', resource, ownerId)
      }
    }
  })
  notifyCanonicalContentPersisted(noteId, ownerId)
}

export async function getRecognizedContentBackupData(noteIds = null, options = {}) {
  const ownerId = requireOwner(options.ownerId)
  const allowed = noteIds ? new Set(noteIds) : null
  const rows = await db.recognizedContent.where('ownerId').equals(ownerId).toArray()
  return rows
    .filter((row) => !allowed || allowed.has(row.noteId))
    .map((value) => {
      const row = { ...value }
      delete row.ownerId
      return row
    })
}

export async function getIntelligenceSettings(ownerId = getActiveWorkspaceOwner()) {
  const resolvedOwner = requireOwner(ownerId)
  const stored = await db.intelligenceSettings.get(resolvedOwner)
  return normalizeIntelligenceSettings(stored || createDefaultIntelligenceSettings(resolvedOwner), resolvedOwner)
}

export async function saveIntelligenceSettings(settings, ownerId = getActiveWorkspaceOwner()) {
  const resolvedOwner = requireOwner(ownerId)
  if (settings?.ownerId && settings.ownerId !== resolvedOwner) throw new Error('Intelligence settings belong to another workspace.')
  const normalized = normalizeIntelligenceSettings({
    ...settings,
    ownerId: resolvedOwner,
    updatedAt: new Date().toISOString(),
  }, resolvedOwner)
  await db.intelligenceSettings.put(normalized)
  return normalized
}
