import { db, getActiveWorkspaceOwner, notifyCanonicalContentPersisted } from '../db'
import { generateId } from '../utils'
import {
  assertSpatialObject,
  createPaperPage,
  createSpatialDocument,
  SPATIAL_LIMITS,
} from './model'
import { queueAnnotationChangeInTransaction } from './annotationCloud'

const requireOwner = (ownerId = getActiveWorkspaceOwner()) => {
  if (!ownerId) throw new Error('An active workspace owner is required.')
  return ownerId
}

const safeDimension = (value) => Math.min(4096, Math.max(320, Math.round(Number(value) || 320)))

export async function loadAnnotationWorkspace({ noteId, resourceId, pageNumber = 1, width, height, ownerId: requestedOwner, createIfMissing = true }) {
  if (!noteId || !resourceId) throw new Error('An annotation source is required.')
  const ownerId = requireOwner(requestedOwner)
  const safePageNumber = Math.min(100_000, Math.max(1, Math.round(Number(pageNumber) || 1)))
  return db.transaction('rw', db.resources, db.spatialAnnotations, db.spatialAnnotationPages, db.spatialAnnotationObjects, db.syncQueue, async () => {
    let document = await db.spatialAnnotations
      .where('[ownerId+resourceId]')
      .equals([ownerId, resourceId])
      .filter((row) => row.noteId === noteId)
      .first()
    if (!document) {
      if (!createIfMissing) return { document: null, pages: [], page: null, objects: [], resources: [] }
      const resource = await db.resources.get(resourceId)
      document = {
        ...createSpatialDocument(noteId, 'paper', ownerId),
        id: generateId(),
        resourceId,
        resourceOwnerId: resource?.ownerId || ownerId,
        scope: 'annotation',
        settings: { sourceKind: 'attachment' },
      }
      await db.spatialAnnotations.put(document)
      await queueAnnotationChangeInTransaction('spatial_annotations', 'insert', document, ownerId)
    }
    let pages = await db.spatialAnnotationPages.where('[ownerId+annotationId]').equals([ownerId, document.id]).sortBy('pageNumber')
    let page = pages.find((candidate) => candidate.pageNumber === safePageNumber)
    if (!page) {
      if (!createIfMissing) return { document, pages, page: null, objects: [], resources: [] }
      page = {
        ...createPaperPage(noteId, ownerId, pages.length, {
          size: 'free',
          width: safeDimension(width),
          height: safeDimension(height),
          name: `Source page ${safePageNumber}`,
          pattern: 'blank',
          surface: 'white',
        }),
        annotationId: document.id,
        resourceId,
        pageNumber: safePageNumber,
      }
      await db.spatialAnnotationPages.put(page)
      await queueAnnotationChangeInTransaction('spatial_annotation_pages', 'insert', page, ownerId)
      pages = [...pages, page].sort((left, right) => left.pageNumber - right.pageNumber)
    }
    const objects = await db.spatialAnnotationObjects
      .where('[ownerId+annotationId]')
      .equals([ownerId, document.id])
      .filter((object) => object.pageId === page.id)
      .sortBy('zIndex')
    return { document, pages, page, objects, resources: [] }
  })
}

export async function saveAnnotationChanges(annotationId, changes = {}) {
  if (!annotationId) throw new Error('An annotation identity is required.')
  const ownerId = requireOwner()
  const putObjects = changes.putObjects || []
  const deleteObjectIds = [...new Set(changes.deleteObjectIds || [])]
  const saved = await db.transaction(
    'rw',
    db.spatialAnnotations,
    db.spatialAnnotationPages,
    db.spatialAnnotationObjects,
    db.notes,
    db.syncQueue,
    async () => {
      const document = await db.spatialAnnotations.get(annotationId)
      if (!document || document.ownerId !== ownerId) throw new Error('This annotation layer is no longer available.')
      const pages = await db.spatialAnnotationPages.where('[ownerId+annotationId]').equals([ownerId, annotationId]).toArray()
      const pageIds = new Set(pages.map((page) => page.id))
      putObjects.forEach((object) => assertSpatialObject(object, document, pageIds))
      const existingCount = await db.spatialAnnotationObjects.where('[ownerId+annotationId]').equals([ownerId, annotationId]).count()
      const existing = putObjects.length ? await db.spatialAnnotationObjects.bulkGet(putObjects.map((object) => object.id)) : []
      const newCount = existing.filter((object) => !object).length
      if (existingCount + newCount - deleteObjectIds.length > SPATIAL_LIMITS.MAX_OBJECTS_PER_NOTE) {
        throw new Error('This annotation layer has reached the object limit.')
      }
      const now = new Date().toISOString()
      if (putObjects.length) {
        const storedObjects = putObjects.map((object) => ({
          ...object,
          ownerId,
          noteId: document.noteId,
          resourceId: document.resourceId,
          annotationId,
          updatedAt: object.updatedAt || now,
        }))
        await db.spatialAnnotationObjects.bulkPut(storedObjects)
        for (const object of storedObjects) {
          await queueAnnotationChangeInTransaction('spatial_annotation_objects', 'update', object, ownerId)
        }
      }
      if (deleteObjectIds.length) {
        await db.spatialAnnotationObjects.bulkDelete(deleteObjectIds)
        for (const id of deleteObjectIds) {
          await queueAnnotationChangeInTransaction('spatial_annotation_objects', 'delete', { id, annotationId }, ownerId)
        }
      }
      const next = { ...document, revision: document.revision + 1, updatedAt: now }
      await db.spatialAnnotations.put(next)
      await queueAnnotationChangeInTransaction('spatial_annotations', 'update', next, ownerId)
      if (await db.notes.get(document.noteId)) await db.notes.update(document.noteId, { updatedAt: now })
      return next
    }
  )
  notifyCanonicalContentPersisted(saved.noteId)
  return saved
}

export async function deleteNoteAnnotations(noteId, ownerId = requireOwner()) {
  const documents = await db.spatialAnnotations.where('[ownerId+noteId]').equals([ownerId, noteId]).toArray()
  if (!documents.length) return 0
  const ids = documents.map((document) => document.id)
  await db.transaction('rw', db.spatialAnnotations, db.spatialAnnotationPages, db.spatialAnnotationObjects, db.syncQueue, async () => {
    for (const document of documents) {
      await queueAnnotationChangeInTransaction('spatial_annotations', 'delete', document, ownerId)
    }
    await Promise.all([
      db.spatialAnnotations.bulkDelete(ids),
      db.spatialAnnotationPages.where('annotationId').anyOf(ids).delete(),
      db.spatialAnnotationObjects.where('annotationId').anyOf(ids).delete(),
    ])
  })
  return ids.length
}

export async function duplicateNoteAnnotations(sourceNoteId, targetNoteId, requestedOwner = getActiveWorkspaceOwner()) {
  const ownerId = requireOwner(requestedOwner)
  const documents = await db.spatialAnnotations.where('[ownerId+noteId]').equals([ownerId, sourceNoteId]).toArray()
  if (!documents.length) return []
  const sourceIds = documents.map((document) => document.id)
  const [sourcePages, sourceObjects] = await Promise.all([
    db.spatialAnnotationPages.where('annotationId').anyOf(sourceIds).toArray(),
    db.spatialAnnotationObjects.where('annotationId').anyOf(sourceIds).toArray(),
  ])
  const now = new Date().toISOString()
  const documentIdMap = new Map(documents.map((document) => [document.id, generateId()]))
  const pageIdMap = new Map(sourcePages.map((page) => [page.id, generateId()]))
  const objectIdMap = new Map(sourceObjects.map((object) => [object.id, generateId()]))
  const copies = documents.map((document) => ({
    ...structuredClone(document),
    id: documentIdMap.get(document.id),
    noteId: targetNoteId,
    ownerId,
    revision: 0,
    createdAt: now,
    updatedAt: now,
  }))
  const pages = sourcePages.map((page) => ({
    ...structuredClone(page),
    id: pageIdMap.get(page.id),
    annotationId: documentIdMap.get(page.annotationId),
    noteId: targetNoteId,
    ownerId,
    createdAt: now,
    updatedAt: now,
  }))
  const objects = sourceObjects.map((object) => {
    const data = structuredClone(object.data || {})
    if (Array.isArray(data.sourceStrokeIds)) data.sourceStrokeIds = data.sourceStrokeIds.map((id) => objectIdMap.get(id)).filter(Boolean)
    if (data.convertedToShapeId) data.convertedToShapeId = objectIdMap.get(data.convertedToShapeId) || null
    return {
      ...structuredClone(object),
      id: objectIdMap.get(object.id),
      annotationId: documentIdMap.get(object.annotationId),
      noteId: targetNoteId,
      pageId: pageIdMap.get(object.pageId),
      ownerId,
      data,
      createdAt: now,
      updatedAt: now,
    }
  })
  await db.transaction('rw', db.spatialAnnotations, db.spatialAnnotationPages, db.spatialAnnotationObjects, db.syncQueue, async () => {
    await db.spatialAnnotations.bulkPut(copies)
    if (pages.length) await db.spatialAnnotationPages.bulkPut(pages)
    if (objects.length) await db.spatialAnnotationObjects.bulkPut(objects)
    for (const document of copies) await queueAnnotationChangeInTransaction('spatial_annotations', 'insert', document, ownerId)
    for (const page of pages) await queueAnnotationChangeInTransaction('spatial_annotation_pages', 'insert', page, ownerId)
    for (const object of objects) await queueAnnotationChangeInTransaction('spatial_annotation_objects', 'insert', object, ownerId)
  })
  return copies
}

export async function getAnnotationBackupData(noteIds = null, requestedOwner = getActiveWorkspaceOwner()) {
  const ownerId = requireOwner(requestedOwner)
  const allowed = noteIds ? new Set(noteIds) : null
  const documents = (await db.spatialAnnotations.where('ownerId').equals(ownerId).toArray())
    .filter((document) => !allowed || allowed.has(document.noteId))
  const documentIds = new Set(documents.map((document) => document.id))
  if (!documentIds.size) {
    return { spatialAnnotations: [], spatialAnnotationPages: [], spatialAnnotationObjects: [] }
  }
  const [pages, objects] = await Promise.all([
    db.spatialAnnotationPages.where('ownerId').equals(ownerId).filter((page) => documentIds.has(page.annotationId)).toArray(),
    db.spatialAnnotationObjects.where('ownerId').equals(ownerId).filter((object) => documentIds.has(object.annotationId)).toArray(),
  ])
  return {
    spatialAnnotations: documents,
    spatialAnnotationPages: pages,
    spatialAnnotationObjects: objects,
  }
}
