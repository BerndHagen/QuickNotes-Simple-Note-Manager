import { db, getActiveWorkspaceOwner, notifyCanonicalContentPersisted } from '../db'
import { isCanonicalResourceReferenced } from '../resources/references'

export async function purgeSharedNoteCache(noteId, sourceOwnerId, viewerOwnerId = getActiveWorkspaceOwner()) {
  if (!noteId || !sourceOwnerId || sourceOwnerId === viewerOwnerId) return false
  const [objects, links, recognized, annotations] = await Promise.all([
    db.spatialObjects.where('[ownerId+noteId]').equals([sourceOwnerId, noteId]).toArray(),
    db.noteResources.where('[ownerId+noteId]').equals([sourceOwnerId, noteId]).toArray(),
    db.recognizedContent.where('[ownerId+noteId]').equals([sourceOwnerId, noteId]).toArray(),
    db.spatialAnnotations.where('[ownerId+noteId]').equals([sourceOwnerId, noteId]).toArray(),
  ])
  const annotationIds = annotations.map((document) => document.id)
  const resourceIds = new Set([
    ...objects.map((object) => object.data?.resourceId),
    ...links.map((link) => link.resourceId),
    ...recognized.map((row) => row.sourceResourceId),
    ...annotations.map((document) => document.resourceId),
  ].filter(Boolean))
  await db.transaction(
    'rw',
    db.spatialDocuments,
    db.spatialPages,
    db.spatialObjects,
    db.spatialAnnotations,
    db.spatialAnnotationPages,
    db.spatialAnnotationObjects,
    db.annotationSyncState,
    db.noteResources,
    db.recognizedContent,
    db.searchDocuments,
    db.knowledgeLinks,
    db.semanticEmbeddings,
    async () => {
      const document = await db.spatialDocuments.get(noteId)
      if (document?.ownerId === sourceOwnerId) await db.spatialDocuments.delete(noteId)
      await Promise.all([
        db.spatialPages.where('[ownerId+noteId]').equals([sourceOwnerId, noteId]).delete(),
        db.spatialObjects.where('[ownerId+noteId]').equals([sourceOwnerId, noteId]).delete(),
        annotationIds.length ? db.spatialAnnotations.bulkDelete(annotationIds) : undefined,
        annotationIds.length ? db.spatialAnnotationPages.where('annotationId').anyOf(annotationIds).delete() : undefined,
        annotationIds.length ? db.spatialAnnotationObjects.where('annotationId').anyOf(annotationIds).delete() : undefined,
        annotationIds.length ? db.annotationSyncState.where('annotationId').anyOf(annotationIds).delete() : undefined,
        db.noteResources.where('[ownerId+noteId]').equals([sourceOwnerId, noteId]).delete(),
        db.recognizedContent.where('[ownerId+noteId]').equals([sourceOwnerId, noteId]).delete(),
        viewerOwnerId ? db.searchDocuments.delete([viewerOwnerId, noteId]) : undefined,
        viewerOwnerId ? db.knowledgeLinks.where('[ownerId+sourceNoteId]').equals([viewerOwnerId, noteId]).delete() : undefined,
        viewerOwnerId ? db.semanticEmbeddings.where('[ownerId+noteId]').equals([viewerOwnerId, noteId]).delete() : undefined,
      ])
    }
  )
  for (const resourceId of resourceIds) {
    if (!await isCanonicalResourceReferenced(resourceId)) {
      await Promise.all([db.resources.delete(resourceId), db.resourceBlobs.delete(resourceId)])
    }
  }
  notifyCanonicalContentPersisted(noteId, viewerOwnerId)
  return true
}

export async function purgeSharedNoteCaches(shares, viewerOwnerId = getActiveWorkspaceOwner()) {
  for (const share of shares || []) {
    const noteId = share?.note_id || share?.notes?.id
    const sourceOwnerId = share?.owner_id || share?.notes?.userId || share?.notes?.user_id
    await purgeSharedNoteCache(noteId, sourceOwnerId, viewerOwnerId)
  }
}
