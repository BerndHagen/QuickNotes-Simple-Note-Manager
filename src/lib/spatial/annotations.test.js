import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db, setActiveWorkspaceOwner } from '../db'
import { createShapeObject } from './model'
import { deleteNoteAnnotations, duplicateNoteAnnotations, loadAnnotationWorkspace, saveAnnotationChanges } from './annotations'
import { getCanonicalResourceReferenceCounts } from '../resources/references'

describe('attachment annotation repository', () => {
  beforeEach(async () => {
    setActiveWorkspaceOwner('owner-annotation')
    await Promise.all([
      db.spatialAnnotations.clear(),
      db.spatialAnnotationPages.clear(),
      db.spatialAnnotationObjects.clear(),
    ])
  })

  afterEach(() => setActiveWorkspaceOwner(null))

  it('persists page-attributed Task-2 spatial objects without changing the source resource', async () => {
    const workspace = await loadAnnotationWorkspace({ noteId: 'note-a', resourceId: 'pdf-a', pageNumber: 2, width: 612, height: 792 })
    const object = createShapeObject({
      noteId: 'note-a', pageId: workspace.page.id, shape: 'rectangle',
      start: { x: 20, y: 30 }, end: { x: 220, y: 130 }, color: '#18352a', width: 2, zIndex: 1,
    })
    await saveAnnotationChanges(workspace.document.id, { putObjects: [object] })

    const reloaded = await loadAnnotationWorkspace({ noteId: 'note-a', resourceId: 'pdf-a', pageNumber: 2, width: 612, height: 792 })
    expect(reloaded.objects).toHaveLength(1)
    expect(reloaded.objects[0]).toMatchObject({
      annotationId: workspace.document.id,
      resourceId: 'pdf-a',
      pageId: workspace.page.id,
      kind: 'shape',
    })
    expect(await getCanonicalResourceReferenceCounts('pdf-a')).toMatchObject({ annotations: 1 })
  })

  it('deletes all page overlays with their note while leaving source cleanup to reference collection', async () => {
    await loadAnnotationWorkspace({ noteId: 'note-a', resourceId: 'pdf-a', pageNumber: 1, width: 612, height: 792 })
    await loadAnnotationWorkspace({ noteId: 'note-a', resourceId: 'pdf-a', pageNumber: 2, width: 612, height: 792 })
    expect(await deleteNoteAnnotations('note-a')).toBe(1)
    expect(await db.spatialAnnotations.count()).toBe(0)
    expect(await db.spatialAnnotationPages.count()).toBe(0)
  })

  it('duplicates overlays with new stable graph identities and the same immutable source', async () => {
    const workspace = await loadAnnotationWorkspace({ noteId: 'note-a', resourceId: 'pdf-a', pageNumber: 1, width: 612, height: 792 })
    const object = createShapeObject({
      noteId: 'note-a', pageId: workspace.page.id, shape: 'rectangle',
      start: { x: 20, y: 30 }, end: { x: 220, y: 130 }, color: '#18352a', width: 2, zIndex: 1,
    })
    await saveAnnotationChanges(workspace.document.id, { putObjects: [object] })

    const copies = await duplicateNoteAnnotations('note-a', 'note-b')
    const copiedPages = await db.spatialAnnotationPages.where('annotationId').equals(copies[0].id).toArray()
    const copiedObjects = await db.spatialAnnotationObjects.where('annotationId').equals(copies[0].id).toArray()

    expect(copies[0]).toMatchObject({ noteId: 'note-b', resourceId: 'pdf-a', revision: 0 })
    expect(copies[0].id).not.toBe(workspace.document.id)
    expect(copiedPages[0].id).not.toBe(workspace.page.id)
    expect(copiedObjects[0]).toMatchObject({ noteId: 'note-b', pageId: copiedPages[0].id })
    expect(copiedObjects[0].id).not.toBe(object.id)
  })
})
