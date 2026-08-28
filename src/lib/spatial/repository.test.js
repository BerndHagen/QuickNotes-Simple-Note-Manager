import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { clearLocalData, db, setActiveWorkspaceOwner } from '../db'
import { createRecognizedContent } from '../intelligence/model'
import { deleteIntelligenceNoteData } from '../intelligence/repository'
import { createImageObject, createSpatialDocument, createStrokeObject } from './model'
import {
  deleteSpatialWorkspace,
  duplicateSpatialWorkspace,
  getSpatialBackupData,
  loadSpatialWorkspace,
  saveSpatialChanges,
} from './repository'

describe('spatial IndexedDB repository', () => {
  beforeEach(async () => {
    await clearLocalData()
    setActiveWorkspaceOwner('local')
  })

  it('initializes Paper once and persists individual objects transactionally', async () => {
    const initial = await loadSpatialWorkspace('paper-note', 'paper')
    expect(initial.pages).toHaveLength(1)
    expect(initial.document).toMatchObject({ noteId: 'paper-note', kind: 'paper', schemaVersion: 1 })

    const stroke = createStrokeObject({
      noteId: 'paper-note',
      pageId: initial.pages[0].id,
      points: [[10, 10, 0.5, 0, 0, 0], [20, 20, 0.75, 2, 1, 8]],
      brush: 'pen',
      color: '#18352a',
      width: 2.5,
      opacity: 1,
      zIndex: 1,
    })
    await saveSpatialChanges('paper-note', { putObjects: [stroke] })

    expect(await db.spatialObjects.get(stroke.id)).toMatchObject({ noteId: 'paper-note', pageId: initial.pages[0].id })
    expect((await loadSpatialWorkspace('paper-note', 'paper')).objects).toHaveLength(1)
    expect((await db.workspaceSnapshots.toArray())).toHaveLength(0)
  })

  it('marks recognition stale in the same transaction when source ink changes', async () => {
    const workspace = await loadSpatialWorkspace('recognized-canvas', 'canvas')
    const stroke = createStrokeObject({
      noteId: workspace.document.noteId,
      points: [[10, 10, 0.5, 0, 0, 0], [20, 20, 0.5, 0, 0, 10]],
      brush: 'pen',
      color: '#18352a',
      width: 2.5,
      opacity: 1,
      zIndex: 1,
    })
    await saveSpatialChanges(workspace.document.noteId, { putObjects: [stroke] })
    const recognition = createRecognizedContent({
      ownerId: 'local',
      noteId: workspace.document.noteId,
      type: 'handwriting',
      sourceKind: 'ink',
      sourceObjectIds: [stroke.id],
      sourceRegion: stroke.bounds,
      text: 'hello',
      providerId: 'browser-handwriting-v1',
      modelId: 'browser-operating-system-handwriting',
      modelVersion: 'platform-managed',
      processingLocation: 'browserManaged',
      language: 'en',
      sourceFingerprint: 'sha256:source',
    })
    await db.recognizedContent.put(recognition)

    await saveSpatialChanges(workspace.document.noteId, {
      putObjects: [{ ...stroke, bounds: { ...stroke.bounds, x: stroke.bounds.x + 20 }, updatedAt: new Date().toISOString() }],
    })

    expect(await db.recognizedContent.get(recognition.id)).toMatchObject({ status: 'stale', text: 'hello' })
  })

  it('rejects opening a stored surface as the wrong kind', async () => {
    await loadSpatialWorkspace('canvas-note', 'canvas')
    await expect(loadSpatialWorkspace('canvas-note', 'paper')).rejects.toThrow('does not match')
  })

  it('keeps an initial Paper page owned by the note owner in a shared workspace', async () => {
    const workspace = await loadSpatialWorkspace('shared-paper', 'paper', 'note-owner-id')

    expect(workspace.document.ownerId).toBe('note-owner-id')
    expect(workspace.pages[0].ownerId).toBe('note-owner-id')
  })

  it('persists and reopens 10,000 strokes without a monolithic snapshot', async () => {
    await loadSpatialWorkspace('large-canvas', 'canvas')
    const strokes = Array.from({ length: 10_000 }, (_, index) => createStrokeObject({
      noteId: 'large-canvas',
      points: [[index, index % 300, 0.5, 0, 0, index], [index + 8, index % 300 + 4, 0.5, 0, 0, index + 1]],
      brush: index % 5 === 0 ? 'highlighter' : 'pen',
      color: '#18352a',
      width: 2.5,
      opacity: index % 5 === 0 ? 0.28 : 1,
      zIndex: index,
    }))
    await saveSpatialChanges('large-canvas', { putObjects: strokes })
    const reopened = await loadSpatialWorkspace('large-canvas', 'canvas')
    expect(reopened.objects).toHaveLength(10_000)
    expect(await db.workspaceSnapshots.count()).toBe(0)
  }, 30_000)

  it('shares resource identity across duplicates and removes it only after the final note is deleted', async () => {
    await loadSpatialWorkspace('source-canvas', 'canvas')
    const resource = {
      id: 'shared-image', ownerId: 'local', kind: 'image', mimeType: 'image/png', name: 'pixel.png', byteSize: 4,
      data: 'data:image/png;base64,iVBORw==', thumbnailData: null, pixelWidth: 1, pixelHeight: 1,
    }
    const image = createImageObject({ noteId: 'source-canvas', point: { x: 0, y: 0 }, zIndex: 1, resourceId: resource.id })
    await saveSpatialChanges('source-canvas', { putResources: [resource], putObjects: [image] })
    await duplicateSpatialWorkspace('source-canvas', 'duplicate-canvas')

    await deleteSpatialWorkspace('source-canvas')
    expect(await db.resources.get(resource.id)).toBeTruthy()
    await deleteSpatialWorkspace('duplicate-canvas')
    expect(await db.resources.get(resource.id)).toBeUndefined()
  })

  it('treats explicit resource deletion as collection only after all note references disappear', async () => {
    await loadSpatialWorkspace('source-with-undo', 'canvas')
    const resource = {
      id: 'undo-shared-image', ownerId: 'local', kind: 'image', mimeType: 'image/png', name: 'pixel.png', byteSize: 4,
      data: 'data:image/png;base64,iVBORw==', thumbnailData: null, pixelWidth: 1, pixelHeight: 1,
    }
    const image = createImageObject({ noteId: 'source-with-undo', point: { x: 0, y: 0 }, zIndex: 1, resourceId: resource.id })
    await saveSpatialChanges('source-with-undo', { putResources: [resource], putObjects: [image] })
    await duplicateSpatialWorkspace('source-with-undo', 'duplicate-keeps-resource')

    await saveSpatialChanges('source-with-undo', {
      deleteObjectIds: [image.id],
      deleteResourceIds: [resource.id],
    })

    expect(await db.resources.get(resource.id)).toBeTruthy()
    expect((await loadSpatialWorkspace('duplicate-keeps-resource', 'canvas')).resources).toEqual([
      expect.objectContaining({ id: resource.id }),
    ])
  })

  it('collects a resource only when its final image placement is removed', async () => {
    await loadSpatialWorkspace('image-canvas', 'canvas')
    const resource = {
      id: 'orphan-image', ownerId: 'local', kind: 'image', mimeType: 'image/png', name: 'pixel.png', byteSize: 4,
      data: 'data:image/png;base64,iVBORw==', thumbnailData: null, pixelWidth: 1, pixelHeight: 1,
    }
    const image = createImageObject({ noteId: 'image-canvas', point: { x: 0, y: 0 }, zIndex: 1, resourceId: resource.id })
    const secondImage = createImageObject({ noteId: 'image-canvas', point: { x: 400, y: 0 }, zIndex: 2, resourceId: resource.id })
    await saveSpatialChanges('image-canvas', { putResources: [resource], putObjects: [image, secondImage] })

    await saveSpatialChanges('image-canvas', { deleteObjectIds: [image.id] })
    expect(await db.resources.get(resource.id)).toBeTruthy()
    await saveSpatialChanges('image-canvas', { deleteObjectIds: [secondImage.id] })

    expect(await db.resources.get(resource.id)).toBeUndefined()
  })

  it('retains an OCR source after its placement is removed and collects it with the final recognition', async () => {
    await loadSpatialWorkspace('recognized-image-canvas', 'canvas')
    const resource = {
      id: 'recognized-image', ownerId: 'local', kind: 'image', mimeType: 'image/png', name: 'scan.png', byteSize: 4,
      data: 'data:image/png;base64,iVBORw==', thumbnailData: null, pixelWidth: 1, pixelHeight: 1,
    }
    const image = createImageObject({
      noteId: 'recognized-image-canvas',
      point: { x: 0, y: 0 },
      zIndex: 1,
      resourceId: resource.id,
    })
    await saveSpatialChanges('recognized-image-canvas', { putResources: [resource], putObjects: [image] })
    const recognition = createRecognizedContent({
      ownerId: 'local',
      noteId: 'recognized-image-canvas',
      type: 'ocr',
      sourceKind: 'image',
      sourceResourceId: resource.id,
      sourceObjectIds: [image.id],
      sourceRegion: image.bounds,
      text: 'Scanned source',
      providerId: 'tesseract-local-v1',
      modelId: 'tesseract',
      modelVersion: '6',
      processingLocation: 'local',
      sourceFingerprint: 'sha256:recognized-image',
    })
    await db.recognizedContent.put(recognition)

    await saveSpatialChanges('recognized-image-canvas', { deleteObjectIds: [image.id] })

    expect(await db.resources.get(resource.id)).toBeTruthy()
    expect(await db.recognizedContent.get(recognition.id)).toMatchObject({ status: 'stale' })

    await deleteIntelligenceNoteData('recognized-image-canvas')

    expect(await db.recognizedContent.get(recognition.id)).toBeUndefined()
    expect(await db.resources.get(resource.id)).toBeUndefined()
  })

  it('backs up referenced resources even when a collaborator uploaded them', async () => {
    const document = createSpatialDocument('owned-canvas', 'canvas', 'note-owner')
    const image = { ...createImageObject({
      noteId: document.noteId,
      point: { x: 0, y: 0 },
      zIndex: 1,
      resourceId: 'collaborator-image',
    }), ownerId: 'note-owner' }
    const resource = {
      id: 'collaborator-image', ownerId: 'collaborator', kind: 'image', mimeType: 'image/png', name: 'shared.png', byteSize: 4,
      data: 'data:image/png;base64,iVBORw==', thumbnailData: null, pixelWidth: 1, pixelHeight: 1,
    }
    await db.spatialDocuments.put(document)
    await db.spatialObjects.put(image)
    await db.resources.put(resource)
    setActiveWorkspaceOwner('note-owner')

    const backup = await getSpatialBackupData(['owned-canvas'])

    expect(backup.resources).toEqual([resource])
  })
})
