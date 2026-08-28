import { db, getActiveWorkspaceOwner, notifyCanonicalContentPersisted } from '../db'
import {
  assertSpatialPayload,
  assertSpatialObject,
  assertSpatialResource,
  createPaperPage,
  createSpatialDocument,
  SPATIAL_LIMITS,
  SPATIAL_SCHEMA_VERSION,
} from './model'
import {
  fetchRemoteSpatialWorkspace,
  queueNewSpatialDocumentInTransaction,
  queueSpatialChangesInTransaction,
  queueSpatialWorkspaceDeletionInTransaction,
} from './cloud'
import { compareSpatialZOrder } from './geometry'
import { markRecognizedContentStale } from '../intelligence/model'
import { queueCaptureChangeInTransaction } from '../capture/cloud'
import { isCanonicalResourceReferenced } from '../resources/references'
import { queueAnnotationChangeInTransaction } from './annotationCloud'

const byOrder = (a, b) => (a.order || 0) - (b.order || 0)
const byZIndex = compareSpatialZOrder

export async function loadSpatialWorkspace(noteId, kind, ownerIdHint = null) {
  if (!noteId || !['paper', 'canvas'].includes(kind)) throw new Error('A valid spatial note is required.')
  const ownerId = getActiveWorkspaceOwner()
  const remote = await fetchRemoteSpatialWorkspace(noteId)

  const loaded = await db.transaction(
    'rw',
    db.spatialDocuments,
    db.spatialPages,
    db.spatialObjects,
    db.resources,
    db.spatialSyncState,
    db.syncQueue,
    async () => {
      let document = await db.spatialDocuments.get(noteId)
      let pages = await db.spatialPages.where('noteId').equals(noteId).toArray()
      let objects = await db.spatialObjects.where('noteId').equals(noteId).toArray()
      let resources = []
      let createdDocument = false
      let conflict = null
      const marker = ownerId ? await db.spatialSyncState.get([ownerId, noteId]) : null
      const pendingDocumentMutation = ownerId
        ? await db.syncQueue
            .where('ownerId')
            .equals(ownerId)
            .filter((item) => item.table === 'spatial_documents' && (item.data?.noteId || item.data?.id) === noteId)
            .first()
        : null

      if (marker?.conflict) {
        conflict = marker.conflict
      } else if (remote && pendingDocumentMutation && (
        !marker || Number(remote.document.revision) > Number(marker.revision)
      )) {
        conflict = {
          id: `spatial:${noteId}`,
          kind: 'concurrent-update',
          noteId,
          localRevision: document?.revision ?? null,
          remoteRevision: remote.document.revision ?? null,
          remoteUpdatedAt: remote.document.updatedAt || null,
          detectedAt: new Date().toISOString(),
        }
        await db.spatialSyncState.put({
          ...(marker || {}),
          ownerId,
          noteId,
          conflict,
        })
      } else if (remote && !pendingDocumentMutation) {
        if (!document || new Date(remote.document.updatedAt) > new Date(document.updatedAt)) {
          document = remote.document
          pages = remote.pages
          objects = remote.objects
          await db.spatialDocuments.put(document)
          await db.spatialPages.where('noteId').equals(noteId).delete()
          await db.spatialObjects.where('noteId').equals(noteId).delete()
          if (pages.length > 0) await db.spatialPages.bulkPut(pages)
          if (objects.length > 0) await db.spatialObjects.bulkPut(objects)
          if (remote.resources.length > 0) await db.resources.bulkPut(remote.resources)
        }
        await db.spatialSyncState.put({
          ownerId,
          noteId,
          revision: Number(remote.document.revision) || 0,
          lastSyncedAt: remote.document.updatedAt,
          conflict: null,
          remoteDeleteAccepted: false,
        })
      } else if (
        !remote &&
        marker &&
        ownerId !== 'local' &&
        globalThis.navigator?.onLine !== false
      ) {
        conflict = {
          id: `spatial:${noteId}`,
          kind: 'remote-delete',
          noteId,
          localRevision: document?.revision ?? null,
          remoteRevision: null,
          remoteUpdatedAt: null,
          detectedAt: new Date().toISOString(),
        }
        await db.spatialSyncState.put({ ...marker, conflict })
      }

      if (!document) {
        document = createSpatialDocument(noteId, kind, ownerIdHint || ownerId)
        await db.spatialDocuments.put(document)
        createdDocument = true
      }
      if (document.kind !== kind) throw new Error('The stored spatial surface does not match this note.')
      if (document.schemaVersion > SPATIAL_SCHEMA_VERSION) {
        throw new Error('This spatial note was created by a newer QuickNotes version.')
      }
      if (kind === 'paper' && pages.length === 0) {
        pages = [createPaperPage(noteId, document.ownerId || ownerId, 0, document.settings)]
        await db.spatialPages.put(pages[0])
      }
      pages.sort(byOrder)
      objects.sort(byZIndex)
      const resourceIds = [...new Set(objects.map((object) => object.data?.resourceId).filter(Boolean))]
      resources = resourceIds.length > 0 ? (await db.resources.bulkGet(resourceIds)).filter(Boolean) : []
      assertSpatialPayload({ document, pages, objects, resources })
      if (createdDocument) await queueNewSpatialDocumentInTransaction(document, pages)
      return {
        document,
        pages,
        objects,
        resources,
        conflict,
      }
    }
  )
  return { document: loaded.document, pages: loaded.pages, objects: loaded.objects, resources: loaded.resources, conflict: loaded.conflict }
}

export async function saveSpatialChanges(noteId, changes = {}) {
  const putObjects = changes.putObjects || []
  const deleteObjectIds = changes.deleteObjectIds || []
  const putPages = changes.putPages || []
  const deletePageIds = changes.deletePageIds || []
  const putResources = changes.putResources || []
  const deleteResourceIds = changes.deleteResourceIds || []
  const documentPatch = changes.documentPatch || null
  const ownerId = getActiveWorkspaceOwner()

  const saved = await db.transaction(
    'rw',
    db.spatialDocuments,
    db.spatialPages,
    db.spatialObjects,
    db.spatialAnnotations,
    db.spatialAnnotationPages,
    db.spatialAnnotationObjects,
    db.resources,
    db.noteResources,
    db.notes,
    db.recognizedContent,
    db.spatialSyncState,
    db.syncQueue,
    db.spatialSyncState,
    async () => {
      const current = await db.spatialDocuments.get(noteId)
      if (!current) throw new Error('The spatial document is not initialized.')
      const syncState = current.ownerId
        ? await db.spatialSyncState.get([current.ownerId, noteId])
        : null
      if (syncState?.conflict) {
        throw new Error('Review the Paper or Canvas sync conflict before editing.')
      }
      const now = new Date().toISOString()
      const persistedObjects = putObjects.map((object) => ({
        ...object,
        noteId,
        ownerId: current.ownerId || ownerId,
        updatedAt: object.updatedAt || now,
      }))
      const persistedPages = putPages.map((page) => ({
        ...page,
        noteId,
        ownerId: current.ownerId || ownerId,
        updatedAt: page.updatedAt || now,
      }))
      const persistedResources = putResources.map((resource) => ({
        ...resource,
        // A collaborator may attach a resource to another user's shared
        // note. The resource remains owned by its uploader.
        ownerId: resource.ownerId || ownerId,
        updatedAt: resource.updatedAt || now,
      }))
      const document = {
        ...current,
        ...(documentPatch || {}),
        noteId,
        ownerId: current.ownerId || ownerId,
        schemaVersion: SPATIAL_SCHEMA_VERSION,
        revision: (current.revision || 0) + 1,
        updatedAt: now,
      }
      if (document.kind !== current.kind) throw new Error('A spatial document kind cannot be changed in place.')
      const storedPages = await db.spatialPages.where('noteId').equals(noteId).toArray()
      const deletedPageIds = new Set(deletePageIds)
      const pageUpdates = new Map(putPages.map((page) => [page.id, page]))
      const effectivePages = storedPages
        .filter((page) => !deletedPageIds.has(page.id))
        .map((page) => pageUpdates.get(page.id) || page)
      for (const page of putPages) {
        if (!storedPages.some((candidate) => candidate.id === page.id)) effectivePages.push(page)
      }
      assertSpatialPayload({ document, pages: effectivePages, objects: [] })
      const pageIds = new Set(effectivePages.map((page) => page.id))
      const candidateResourceIds = new Set(deleteResourceIds)
      const invalidatedSourceObjectIds = new Set()
      putObjects.forEach((object) => assertSpatialObject(object, document, pageIds))
      putResources.forEach(assertSpatialResource)

      if (putObjects.length > 0) {
        const uniqueIds = [...new Set(putObjects.map((object) => object.id))]
        if (uniqueIds.length !== putObjects.length) throw new Error('A spatial edit contains duplicate object identities.')
        const [currentCount, existing] = await Promise.all([
          db.spatialObjects.where('noteId').equals(noteId).count(),
          db.spatialObjects.bulkGet(uniqueIds),
        ])
        const newCount = existing.filter((object) => !object).length
        existing.forEach((object, index) => {
          if (object) invalidatedSourceObjectIds.add(object.id)
          const previousResourceId = object?.kind === 'image' ? object.data?.resourceId : null
          const nextResourceId = putObjects[index]?.kind === 'image' ? putObjects[index].data?.resourceId : null
          if (previousResourceId && previousResourceId !== nextResourceId) candidateResourceIds.add(previousResourceId)
        })
        if (currentCount + newCount > SPATIAL_LIMITS.MAX_OBJECTS_PER_NOTE) throw new Error('This spatial note has reached the object limit.')
        const newResourceIds = new Set(putResources.map((resource) => resource.id))
        const referencedResourceIds = [...new Set(putObjects
          .filter((object) => object.kind === 'image')
          .map((object) => object.data.resourceId)
          .filter((id) => !newResourceIds.has(id)))]
        if (referencedResourceIds.length > 0) {
          const existingResources = await db.resources.bulkGet(referencedResourceIds)
          if (existingResources.some((resource) => !resource)) throw new Error('An image placement references a missing resource.')
        }
      }
      if (deleteObjectIds.length > 0) {
        const deletedObjects = (await db.spatialObjects.bulkGet(deleteObjectIds)).filter(Boolean)
        deletedObjects.forEach((object) => {
          invalidatedSourceObjectIds.add(object.id)
          if (object.kind === 'image' && object.data?.resourceId) candidateResourceIds.add(object.data.resourceId)
        })
      }
      if (deletePageIds.length > 0) {
        const deletedPageObjects = await db.spatialObjects.where('pageId').anyOf(deletePageIds).toArray()
        deletedPageObjects.forEach((object) => {
          invalidatedSourceObjectIds.add(object.id)
          if (object.kind === 'image' && object.data?.resourceId) candidateResourceIds.add(object.data.resourceId)
        })
      }
      if (putObjects.length > 0) {
        await db.spatialObjects.bulkPut(persistedObjects)
      }
      if (deleteObjectIds.length > 0) await db.spatialObjects.bulkDelete(deleteObjectIds)
      if (putPages.length > 0) {
        await db.spatialPages.bulkPut(persistedPages)
      }
      if (deletePageIds.length > 0) {
        await db.spatialPages.bulkDelete(deletePageIds)
        await db.spatialObjects.where('pageId').anyOf(deletePageIds).delete()
      }
      if (putResources.length > 0) {
        await db.resources.bulkPut(persistedResources)
      }
      const orphanedResourceIds = []
      for (const resourceId of candidateResourceIds) {
        const remainingPlacement = await db.spatialObjects
          .where('noteId')
          .equals(noteId)
          .filter((object) => object.kind === 'image' && object.data?.resourceId === resourceId)
          .first()
        if (!remainingPlacement) {
          const annotations = await db.spatialAnnotations
            .where('[ownerId+resourceId]')
            .equals([current.ownerId || ownerId, resourceId])
            .filter((document) => document.noteId === noteId)
            .toArray()
          const annotationIds = annotations.map((document) => document.id)
          if (annotationIds.length) {
            for (const annotation of annotations) {
              await queueAnnotationChangeInTransaction('spatial_annotations', 'delete', annotation, current.ownerId || ownerId)
            }
            await Promise.all([
              db.spatialAnnotations.bulkDelete(annotationIds),
              db.spatialAnnotationPages.where('annotationId').anyOf(annotationIds).delete(),
              db.spatialAnnotationObjects.where('annotationId').anyOf(annotationIds).delete(),
            ])
          }
        }
        if (!await isCanonicalResourceReferenced(resourceId)) orphanedResourceIds.push(resourceId)
      }
      if (orphanedResourceIds.length > 0) await db.resources.bulkDelete(orphanedResourceIds)
      if (invalidatedSourceObjectIds.size > 0) {
        const recognitionRows = await db.recognizedContent
          .where('[ownerId+noteId]')
          .equals([current.ownerId || ownerId, noteId])
          .filter((row) => row.status === 'current' && row.sourceObjectIds?.some((id) => invalidatedSourceObjectIds.has(id)))
          .toArray()
        if (recognitionRows.length > 0) {
          const staleRows = recognitionRows.map((row) => markRecognizedContentStale(row, now))
          await db.recognizedContent.bulkPut(staleRows)
          for (const row of staleRows) {
            await queueCaptureChangeInTransaction('recognized_content', 'update', row, row.ownerId)
          }
        }
      }
      await db.spatialDocuments.put(document)
      if (await db.notes.get(noteId)) await db.notes.update(noteId, { updatedAt: now })
      const queuedChanges = {
        ...changes,
        putObjects: persistedObjects,
        putPages: persistedPages,
        putResources: persistedResources,
        deleteResourceIds: orphanedResourceIds,
      }
      await queueSpatialChangesInTransaction(document, queuedChanges)
      return { document }
    }
  )
  notifyCanonicalContentPersisted(noteId)
  return saved.document
}

export async function deleteSpatialWorkspace(noteId) {
  if (!noteId) return
  const deletedResourceIds = await db.transaction('rw', db.spatialDocuments, db.spatialPages, db.spatialObjects, db.spatialAnnotations, db.spatialAnnotationPages, db.spatialAnnotationObjects, db.resources, db.noteResources, db.recognizedContent, db.spatialSyncState, db.syncQueue, async () => {
    const document = await db.spatialDocuments.get(noteId)
    const objects = await db.spatialObjects.where('noteId').equals(noteId).toArray()
    const candidateResourceIds = [...new Set(objects.map((object) => object.data?.resourceId).filter(Boolean))]
    const annotations = await db.spatialAnnotations.where('noteId').equals(noteId).toArray()
    const annotationIds = annotations.map((document) => document.id)
    for (const annotation of annotations) {
      await queueAnnotationChangeInTransaction('spatial_annotations', 'delete', annotation, annotation.ownerId)
    }
    await Promise.all([
      db.spatialDocuments.delete(noteId),
      db.spatialPages.where('noteId').equals(noteId).delete(),
      db.spatialObjects.where('noteId').equals(noteId).delete(),
      document?.ownerId ? db.spatialSyncState.delete([document.ownerId, noteId]) : undefined,
      annotationIds.length ? db.spatialAnnotations.bulkDelete(annotationIds) : undefined,
      annotationIds.length ? db.spatialAnnotationPages.where('annotationId').anyOf(annotationIds).delete() : undefined,
      annotationIds.length ? db.spatialAnnotationObjects.where('annotationId').anyOf(annotationIds).delete() : undefined,
    ])
    const orphaned = []
    for (const resourceId of candidateResourceIds) {
      if (!await isCanonicalResourceReferenced(resourceId)) orphaned.push(resourceId)
    }
    if (orphaned.length > 0) await db.resources.bulkDelete(orphaned)
    await queueSpatialWorkspaceDeletionInTransaction(noteId, orphaned)
    return orphaned
  })
  return deletedResourceIds
}

export async function duplicateSpatialWorkspace(sourceNoteId, targetNoteId) {
  const ownerId = getActiveWorkspaceOwner()
  const source = await db.spatialDocuments.get(sourceNoteId)
  if (!source) return null
  const sourcePages = await db.spatialPages.where('noteId').equals(sourceNoteId).sortBy('order')
  const sourceObjects = await db.spatialObjects.where('noteId').equals(sourceNoteId).toArray()
  const pageIdMap = new Map(sourcePages.map((page) => [page.id, crypto.randomUUID()]))
  const now = new Date().toISOString()
  const document = { ...source, noteId: targetNoteId, ownerId, revision: 0, createdAt: now, updatedAt: now }
  const pages = sourcePages.map((page) => ({
    ...structuredClone(page),
    id: pageIdMap.get(page.id),
    noteId: targetNoteId,
    ownerId,
    createdAt: now,
    updatedAt: now,
  }))
  const objectIdMap = new Map(sourceObjects.map((object) => [object.id, crypto.randomUUID()]))
  const objects = sourceObjects.map((object) => {
    const data = structuredClone(object.data || {})
    if (Array.isArray(data.sourceStrokeIds)) data.sourceStrokeIds = data.sourceStrokeIds.map((id) => objectIdMap.get(id)).filter(Boolean)
    if (data.convertedToShapeId) data.convertedToShapeId = objectIdMap.get(data.convertedToShapeId) || null
    return {
      ...structuredClone(object),
      id: objectIdMap.get(object.id),
      noteId: targetNoteId,
      pageId: object.pageId ? pageIdMap.get(object.pageId) || null : null,
      ownerId,
      data,
      createdAt: now,
      updatedAt: now,
    }
  })
  const resourceIds = [...new Set(objects.map((object) => object.data?.resourceId).filter(Boolean))]
  const resources = resourceIds.length > 0 ? (await db.resources.bulkGet(resourceIds)).filter(Boolean) : []
  assertSpatialPayload({ document, pages, objects, resources })
  await db.transaction('rw', db.spatialDocuments, db.spatialPages, db.spatialObjects, db.syncQueue, async () => {
    await db.spatialDocuments.put(document)
    if (pages.length > 0) await db.spatialPages.bulkPut(pages)
    if (objects.length > 0) await db.spatialObjects.bulkPut(objects)
    await queueNewSpatialDocumentInTransaction(document, pages)
    await queueSpatialChangesInTransaction(document, { putObjects: objects })
  })
  return { document, pages, objects }
}

export async function getSpatialBackupData(noteIds = null) {
  const ownerId = getActiveWorkspaceOwner()
  const allowedNoteIds = noteIds ? new Set(noteIds) : null
  const [documents, pages, objects] = await Promise.all([
    ownerId
      ? db.spatialDocuments.where('ownerId').equals(ownerId).toArray()
      : db.spatialDocuments.filter((record) => !record.ownerId).toArray(),
    ownerId
      ? db.spatialPages.where('ownerId').equals(ownerId).toArray()
      : db.spatialPages.filter((record) => !record.ownerId).toArray(),
    ownerId
      ? db.spatialObjects.where('ownerId').equals(ownerId).toArray()
      : db.spatialObjects.filter((record) => !record.ownerId).toArray(),
  ])
  const filteredDocuments = documents.filter((record) => !allowedNoteIds || allowedNoteIds.has(record.noteId))
  const spatialNoteIds = new Set(filteredDocuments.map((record) => record.noteId))
  const filteredPages = pages.filter((record) => spatialNoteIds.has(record.noteId))
  const filteredObjects = objects.filter((record) => spatialNoteIds.has(record.noteId))
  const resourceIds = [...new Set(filteredObjects.map((record) => record.data?.resourceId).filter(Boolean))]
  const resources = resourceIds.length > 0 ? (await db.resources.bulkGet(resourceIds)).filter(Boolean) : []
  return {
    spatialDocuments: filteredDocuments,
    spatialPages: filteredPages,
    spatialObjects: filteredObjects,
    resources,
  }
}
