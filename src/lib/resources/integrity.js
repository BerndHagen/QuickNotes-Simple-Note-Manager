import { db } from '../db'

const MAX_SAMPLED_IDS = 20

const issue = (ids) => {
  const unique = [...new Set(ids.filter(Boolean))]
  return { count: unique.length, sampleIds: unique.slice(0, MAX_SAMPLED_IDS) }
}

const resourceIdFromSpatialObject = (row) => row.kind === 'image' ? row.data?.resourceId : null

/**
 * Read-only inspection of the canonical local data graph. It deliberately
 * reports orphans instead of collecting them: an apparently unused resource
 * can still be recovery evidence after an interrupted write or restore.
 */
export async function auditLocalDataIntegrity(ownerId) {
  if (!ownerId || typeof ownerId !== 'string') throw new Error('A workspace owner is required for the integrity check.')

  const rows = await db.transaction(
    'r',
    db.notes,
    db.spatialDocuments,
    db.spatialPages,
    db.spatialObjects,
    db.resources,
    db.resourceBlobs,
    db.noteResources,
    db.recordingSessions,
    db.resourceChunks,
    db.recognizedContent,
    db.spatialAnnotations,
    db.spatialAnnotationPages,
    db.spatialAnnotationObjects,
    async () => {
      const [
        notes,
        spatialDocuments,
        spatialPages,
        spatialObjects,
        ownedResources,
        ownedResourceBlobs,
        noteResources,
        recordingSessions,
        resourceChunks,
        recognizedContent,
        annotations,
        annotationPages,
        annotationObjects,
        allResources,
        allResourceBlobs,
        allNoteResources,
        allSpatialObjects,
        allRecognizedContent,
        allAnnotations,
      ] = await Promise.all([
        db.notes.toArray(),
        db.spatialDocuments.where('ownerId').equals(ownerId).toArray(),
        db.spatialPages.where('ownerId').equals(ownerId).toArray(),
        db.spatialObjects.where('ownerId').equals(ownerId).toArray(),
        db.resources.where('ownerId').equals(ownerId).toArray(),
        db.resourceBlobs.where('ownerId').equals(ownerId).toArray(),
        db.noteResources.where('ownerId').equals(ownerId).toArray(),
        db.recordingSessions.where('ownerId').equals(ownerId).toArray(),
        db.resourceChunks.where('ownerId').equals(ownerId).toArray(),
        db.recognizedContent.where('ownerId').equals(ownerId).toArray(),
        db.spatialAnnotations.where('ownerId').equals(ownerId).toArray(),
        db.spatialAnnotationPages.where('ownerId').equals(ownerId).toArray(),
        db.spatialAnnotationObjects.where('ownerId').equals(ownerId).toArray(),
        db.resources.toArray(),
        db.resourceBlobs.toArray(),
        db.noteResources.toArray(),
        db.spatialObjects.toArray(),
        db.recognizedContent.toArray(),
        db.spatialAnnotations.toArray(),
      ])
      return {
        notes,
        spatialDocuments,
        spatialPages,
        spatialObjects,
        ownedResources,
        ownedResourceBlobs,
        noteResources,
        recordingSessions,
        resourceChunks,
        recognizedContent,
        annotations,
        annotationPages,
        annotationObjects,
        allResources,
        allResourceBlobs,
        allNoteResources,
        allSpatialObjects,
        allRecognizedContent,
        allAnnotations,
      }
    }
  )

  const noteIds = new Set(rows.notes.map((row) => row.id))
  const resourceById = new Map(rows.allResources.map((row) => [row.id, row]))
  const blobById = new Map(rows.allResourceBlobs.map((row) => [row.resourceId, row]))
  const documentIds = new Set(rows.spatialDocuments.map((row) => row.noteId))
  const pageIds = new Set(rows.spatialPages.map((row) => row.id))
  const sessionIds = new Set(rows.recordingSessions.map((row) => row.id))
  const annotationIds = new Set(rows.annotations.map((row) => row.id))
  const annotationPageIds = new Set(rows.annotationPages.map((row) => row.id))

  const ownerReferences = [
    ...rows.noteResources.map((row) => ({ id: row.id, resourceId: row.resourceId })),
    ...rows.spatialObjects.map((row) => ({ id: row.id, resourceId: resourceIdFromSpatialObject(row) })),
    ...rows.recognizedContent.map((row) => ({ id: row.id, resourceId: row.sourceResourceId })),
    ...rows.annotations.map((row) => ({ id: row.id, resourceId: row.resourceId })),
  ].filter((row) => row.resourceId)
  const referencedResourceIds = new Set([
    ...rows.allNoteResources.map((row) => row.resourceId),
    ...rows.allSpatialObjects.map(resourceIdFromSpatialObject),
    ...rows.allRecognizedContent.map((row) => row.sourceResourceId),
    ...rows.allAnnotations.map((row) => row.resourceId),
  ].filter(Boolean))
  const missingResourceIds = [...new Set(ownerReferences.map((row) => row.resourceId))]
    .filter((resourceId) => !resourceById.has(resourceId))
  const referencedCaptureResources = rows.ownedResources.filter((resource) =>
    ['pdf', 'audio'].includes(resource.kind) && referencedResourceIds.has(resource.id)
  )

  const issues = {
    missingResourceMetadata: issue(missingResourceIds),
    missingResourcePayloads: issue(referencedCaptureResources
      .filter((resource) => !blobById.has(resource.id))
      .map((resource) => resource.id)),
    payloadsWithoutMetadata: issue(rows.ownedResourceBlobs
      .filter((payload) => !resourceById.has(payload.resourceId))
      .map((payload) => payload.resourceId)),
    unreferencedResources: issue(rows.ownedResources
      .filter((resource) => !referencedResourceIds.has(resource.id))
      .map((resource) => resource.id)),
    referencesToMissingNotes: issue([
      ...rows.noteResources.filter((row) => !noteIds.has(row.noteId)).map((row) => row.id),
      ...rows.recordingSessions.filter((row) => !noteIds.has(row.noteId)).map((row) => row.id),
      ...rows.recognizedContent.filter((row) => !noteIds.has(row.noteId)).map((row) => row.id),
      ...rows.spatialDocuments.filter((row) => !noteIds.has(row.noteId)).map((row) => row.noteId),
      ...rows.annotations.filter((row) => !noteIds.has(row.noteId)).map((row) => row.id),
    ]),
    detachedSpatialRows: issue([
      ...rows.spatialPages.filter((row) => !documentIds.has(row.noteId)).map((row) => row.id),
      ...rows.spatialObjects.filter((row) => !documentIds.has(row.noteId) || (row.pageId && !pageIds.has(row.pageId))).map((row) => row.id),
      ...rows.annotationPages.filter((row) => !annotationIds.has(row.annotationId)).map((row) => row.id),
      ...rows.annotationObjects.filter((row) => !annotationIds.has(row.annotationId) || !annotationPageIds.has(row.pageId)).map((row) => row.id),
    ]),
    detachedRecordingChunks: issue(rows.resourceChunks
      .filter((row) => !sessionIds.has(row.recordingId))
      .map((row) => String(row.id))),
  }
  const issueCount = Object.values(issues).reduce((total, entry) => total + entry.count, 0)

  return {
    checkedAt: new Date().toISOString(),
    issueCount,
    issues,
    counts: {
      resources: rows.ownedResources.length,
      noteResourceLinks: rows.noteResources.length,
      recordingSessions: rows.recordingSessions.length,
      spatialDocuments: rows.spatialDocuments.length,
    },
  }
}
