import { db } from '../db'
import { normalizeContentDescriptor } from '../contentModel'
import { createSearchDocument, isValidSearchDocument, KNOWLEDGE_SCHEMA_VERSION } from './document'
import { extractKnowledgeLinks } from './links'

const ownerRows = (table, ownerId) => table.where('ownerId').equals(ownerId)
const stateRow = (ownerId, status, details = {}) => ({
  ownerId,
  schemaVersion: KNOWLEDGE_SCHEMA_VERSION,
  status,
  ...details,
  updatedAt: new Date().toISOString(),
})

const normalizeAccessibleNotes = (notes) => {
  const byId = new Map()
  for (const note of notes || []) {
    if (!note?.id) continue
    byId.set(note.id, { ...note, ...normalizeContentDescriptor(note) })
  }
  return [...byId.values()]
}

const loadSpatialSources = async (noteIds) => {
  if (noteIds.size === 0) return { documents: [], objects: [], resources: [] }
  const [documents, objects] = await Promise.all([
    db.spatialDocuments.filter((row) => noteIds.has(row.noteId)).toArray(),
    db.spatialObjects.filter((row) => noteIds.has(row.noteId)).toArray(),
  ])
  const resourceIds = [...new Set(objects.map((object) => object.data?.resourceId).filter(Boolean))]
  const resources = resourceIds.length ? (await db.resources.bulkGet(resourceIds)).filter(Boolean) : []
  return { documents, objects, resources }
}

const loadRecognizedSources = async (noteIds) => {
  if (noteIds.size === 0) return []
  return db.recognizedContent
    .filter((row) => noteIds.has(row.noteId) && row.status === 'current')
    .toArray()
}

const groupBy = (rows, key) => rows.reduce((map, row) => {
  const value = row[key]
  const group = map.get(value) || []
  group.push(row)
  map.set(value, group)
  return map
}, new Map())

const recognitionFingerprint = (rows = []) => rows
  .map((row) => `${row.id}:${row.sourceFingerprint}:${row.updatedAt}:${row.userEdited ? 'edited' : 'machine'}`)
  .sort()
  .join('\u001e')

const sourceFingerprint = (note, folder, spatialDocument, recognizedContent = []) => [
  note.updatedAt || note.createdAt || '',
  note.deleted ? 'trash' : '',
  note.archived ? 'archive' : '',
  folder?.updatedAt || folder?.name || '',
  (note.tags || []).join('\u001f'),
  spatialDocument?.revision || 0,
  recognitionFingerprint(recognizedContent),
].join('|')

const yieldToBrowser = () => new Promise((resolve) => {
  if (typeof window === 'undefined') {
    resolve()
    return
  }
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(() => resolve(), { timeout: 24 })
    return
  }
  window.setTimeout(resolve, 0)
})

export const reconcileKnowledgeIndex = async ({ ownerId, notes, folders = [] }) => {
  if (!ownerId) throw new Error('A workspace owner is required to build the knowledge index.')
  const accessibleNotes = normalizeAccessibleNotes(notes)
  const noteIds = new Set(accessibleNotes.map((note) => note.id))
  const notesById = new Map(accessibleNotes.map((note) => [note.id, note]))
  const foldersById = new Map(folders.map((folder) => [folder.id, folder]))
  const [spatial, recognizedContent] = await Promise.all([
    loadSpatialSources(noteIds),
    loadRecognizedSources(noteIds),
  ])
  const spatialDocumentByNote = new Map(spatial.documents.map((document) => [document.noteId, document]))
  const objectsByNote = groupBy(spatial.objects, 'noteId')
  const recognizedByNote = groupBy(recognizedContent, 'noteId')
  const resourceIdsByNote = new Map()
  for (const [noteId, objects] of objectsByNote) {
    resourceIdsByNote.set(noteId, new Set(objects.map((object) => object.data?.resourceId).filter(Boolean)))
  }
  const [indexState, storedDocuments, storedLinkCount] = await Promise.all([
    db.knowledgeIndexState.get(ownerId),
    ownerRows(db.searchDocuments, ownerId).toArray(),
    ownerRows(db.knowledgeLinks, ownerId).count(),
  ])
  const hasInvalidDocuments = storedDocuments.some((document) => !isValidSearchDocument(document, ownerId))
  const resetDerived = hasInvalidDocuments || (!indexState && (storedDocuments.length > 0 || storedLinkCount > 0)) ||
    (Boolean(indexState) && (
      indexState.schemaVersion !== KNOWLEDGE_SCHEMA_VERSION ||
      indexState.status !== 'ready' ||
      indexState.documentCount !== storedDocuments.length ||
      indexState.linkCount !== storedLinkCount
    ))
  const existing = resetDerived ? [] : storedDocuments
  const existingById = new Map(existing.map((document) => [document.noteId, document]))
  const staleIds = existing.filter((document) => !noteIds.has(document.noteId)).map((document) => document.noteId)
  const changed = accessibleNotes.filter((note) => {
    const previous = existingById.get(note.id)
    return !previous || previous.schemaVersion !== KNOWLEDGE_SCHEMA_VERSION ||
      previous.sourceFingerprint !== sourceFingerprint(
        note,
        foldersById.get(note.folderId),
        spatialDocumentByNote.get(note.id),
        recognizedByNote.get(note.id) || []
      )
  })

  const documents = []
  const links = []
  for (let index = 0; index < changed.length; index += 1) {
    const note = changed[index]
    const objects = objectsByNote.get(note.id) || []
    const ids = resourceIdsByNote.get(note.id) || new Set()
    const resources = spatial.resources.filter((resource) => ids.has(resource.id))
    const document = createSearchDocument({
      ownerId,
      note,
      folder: foldersById.get(note.folderId),
      spatialObjects: objects,
      resources,
      recognizedContent: recognizedByNote.get(note.id) || [],
      notesById,
    })
    document.sourceFingerprint = sourceFingerprint(
      note,
      foldersById.get(note.folderId),
      spatialDocumentByNote.get(note.id),
      recognizedByNote.get(note.id) || []
    )
    documents.push(document)
    links.push(...extractKnowledgeLinks({ ownerId, note, spatialObjects: objects, notesById }))
    if ((index + 1) % 100 === 0) await yieldToBrowser()
  }

  await db.transaction(
    'rw',
    db.searchDocuments,
    db.knowledgeLinks,
    db.knowledgeIndexState,
    async () => {
      await db.knowledgeIndexState.put(stateRow(ownerId, 'building', { documentCount: existing.length }))
      if (resetDerived) {
        await ownerRows(db.searchDocuments, ownerId).delete()
        await ownerRows(db.knowledgeLinks, ownerId).delete()
      }
      for (const note of changed) {
        await db.knowledgeLinks.where('[ownerId+sourceNoteId]').equals([ownerId, note.id]).delete()
      }
      for (const noteId of staleIds) {
        await db.searchDocuments.delete([ownerId, noteId])
        await db.knowledgeLinks.where('[ownerId+sourceNoteId]').equals([ownerId, noteId]).delete()
      }
      if (documents.length) await db.searchDocuments.bulkPut(documents)
      if (links.length) await db.knowledgeLinks.bulkPut(links)
      await db.knowledgeIndexState.put(stateRow(ownerId, 'ready', {
        documentCount: accessibleNotes.length,
        linkCount: await ownerRows(db.knowledgeLinks, ownerId).count(),
      }))
    }
  )

  return {
    documents: await ownerRows(db.searchDocuments, ownerId).toArray(),
    changedNoteIds: changed.map((note) => note.id),
    removedNoteIds: staleIds,
  }
}

export const rebuildKnowledgeIndex = async ({ ownerId, notes, folders = [] }) => {
  if (!ownerId) throw new Error('A workspace owner is required to rebuild the knowledge index.')
  await db.transaction('rw', db.searchDocuments, db.knowledgeLinks, db.knowledgeIndexState, async () => {
    await ownerRows(db.searchDocuments, ownerId).delete()
    await ownerRows(db.knowledgeLinks, ownerId).delete()
    await db.knowledgeIndexState.put(stateRow(ownerId, 'building', { documentCount: 0, linkCount: 0 }))
  })
  return reconcileKnowledgeIndex({ ownerId, notes, folders })
}

export const removeKnowledgeIndex = async (ownerId) => {
  if (!ownerId) return
  await db.transaction('rw', db.searchDocuments, db.knowledgeLinks, db.knowledgeIndexState, async () => {
    await ownerRows(db.searchDocuments, ownerId).delete()
    await ownerRows(db.knowledgeLinks, ownerId).delete()
    await db.knowledgeIndexState.delete(ownerId)
  })
}

export const getKnowledgeDocuments = (ownerId) => ownerRows(db.searchDocuments, ownerId).toArray()

export const getKnowledgeIndexState = (ownerId) => db.knowledgeIndexState.get(ownerId)

export const getBacklinks = async (ownerId, targetNoteId, accessibleNotes = []) => {
  if (!ownerId || !targetNoteId) return []
  const [links, documents] = await Promise.all([
    db.knowledgeLinks.where('[ownerId+targetNoteId]').equals([ownerId, targetNoteId]).toArray(),
    ownerRows(db.searchDocuments, ownerId).toArray(),
  ])
  const noteById = new Map(accessibleNotes.map((note) => [note.id, note]))
  const documentById = new Map(documents.map((document) => [document.noteId, document]))
  return links.map((link) => {
    const source = noteById.get(link.sourceNoteId) || documentById.get(link.sourceNoteId)
    const target = noteById.get(link.targetNoteId) || documentById.get(link.targetNoteId)
    return {
      ...link,
      sourceTitle: source?.title || 'Missing note',
      sourceDeleted: Boolean(source?.deleted),
      targetBroken: !target,
      targetDeleted: Boolean(target?.deleted),
    }
  }).sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
}

export const getForwardLinks = async (ownerId, sourceNoteId, accessibleNotes = []) => {
  if (!ownerId || !sourceNoteId) return []
  const links = await db.knowledgeLinks.where('[ownerId+sourceNoteId]').equals([ownerId, sourceNoteId]).toArray()
  const noteById = new Map(accessibleNotes.map((note) => [note.id, note]))
  return links.map((link) => {
    const target = noteById.get(link.targetNoteId)
    return {
      ...link,
      targetTitle: target?.title || 'Missing note',
      targetBroken: !target,
      targetDeleted: Boolean(target?.deleted),
    }
  })
}
