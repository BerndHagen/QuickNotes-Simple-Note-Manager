import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { clearLocalData, db, setActiveWorkspaceOwner } from '../db'
import { purgeSharedNoteCache } from './cache'

describe('shared collaboration cache lifecycle', () => {
  beforeEach(async () => {
    await clearLocalData()
    setActiveWorkspaceOwner('viewer')
  })

  afterEach(async () => {
    await clearLocalData()
    setActiveWorkspaceOwner(null)
  })

  it('purges revoked foreign rows without collecting a source still referenced by another note', async () => {
    const sourceOwnerId = 'owner'
    await db.resources.bulkPut([
      { id: 'orphan-resource', ownerId: sourceOwnerId, kind: 'pdf', updatedAt: '2026-08-28T00:00:00.000Z' },
      { id: 'retained-resource', ownerId: sourceOwnerId, kind: 'audio', updatedAt: '2026-08-28T00:00:00.000Z' },
    ])
    await db.resourceBlobs.bulkPut([
      { resourceId: 'orphan-resource', ownerId: sourceOwnerId, data: new Blob(['pdf']), updatedAt: '2026-08-28T00:00:00.000Z' },
      { resourceId: 'retained-resource', ownerId: sourceOwnerId, data: new Blob(['audio']), updatedAt: '2026-08-28T00:00:00.000Z' },
    ])
    await db.spatialDocuments.put({ noteId: 'revoked-note', ownerId: sourceOwnerId, kind: 'canvas' })
    await db.spatialPages.put({ id: 'page', noteId: 'revoked-note', ownerId: sourceOwnerId, order: 0 })
    await db.spatialObjects.put({
      id: 'placement', noteId: 'revoked-note', pageId: 'page', ownerId: sourceOwnerId,
      kind: 'image', zIndex: 1, data: { resourceId: 'orphan-resource' },
    })
    await db.noteResources.bulkPut([
      { id: 'revoked-link', noteId: 'revoked-note', resourceId: 'retained-resource', ownerId: sourceOwnerId },
      { id: 'remaining-link', noteId: 'other-note', resourceId: 'retained-resource', ownerId: sourceOwnerId },
    ])
    await db.recognizedContent.put({
      id: 'recognition', noteId: 'revoked-note', sourceResourceId: 'orphan-resource',
      ownerId: sourceOwnerId, type: 'pdf-text', status: 'current',
    })
    await db.spatialAnnotations.put({
      id: 'annotation', noteId: 'revoked-note', resourceId: 'orphan-resource', ownerId: sourceOwnerId,
    })
    await db.spatialAnnotationPages.put({
      id: 'annotation-page', annotationId: 'annotation', noteId: 'revoked-note',
      resourceId: 'orphan-resource', ownerId: sourceOwnerId, pageNumber: 1,
    })
    await db.spatialAnnotationObjects.put({
      id: 'annotation-object', annotationId: 'annotation', pageId: 'annotation-page',
      noteId: 'revoked-note', resourceId: 'orphan-resource', ownerId: sourceOwnerId,
      kind: 'stroke', zIndex: 1,
    })
    await db.searchDocuments.put({ ownerId: 'viewer', noteId: 'revoked-note' })
    await db.knowledgeLinks.put({
      id: 'derived-link', ownerId: 'viewer', sourceNoteId: 'revoked-note', targetNoteId: 'other-note',
    })

    await expect(purgeSharedNoteCache('revoked-note', sourceOwnerId, 'viewer')).resolves.toBe(true)

    expect(await db.spatialDocuments.get('revoked-note')).toBeUndefined()
    expect(await db.spatialPages.where('noteId').equals('revoked-note').count()).toBe(0)
    expect(await db.spatialObjects.where('noteId').equals('revoked-note').count()).toBe(0)
    expect(await db.spatialAnnotations.where('noteId').equals('revoked-note').count()).toBe(0)
    expect(await db.noteResources.where('noteId').equals('revoked-note').count()).toBe(0)
    expect(await db.recognizedContent.where('noteId').equals('revoked-note').count()).toBe(0)
    expect(await db.searchDocuments.get(['viewer', 'revoked-note'])).toBeUndefined()
    expect(await db.knowledgeLinks.get('derived-link')).toBeUndefined()
    expect(await db.resources.get('orphan-resource')).toBeUndefined()
    expect(await db.resourceBlobs.get('orphan-resource')).toBeUndefined()
    expect(await db.resources.get('retained-resource')).toBeTruthy()
    expect(await db.resourceBlobs.get('retained-resource')).toBeTruthy()
  })
})
