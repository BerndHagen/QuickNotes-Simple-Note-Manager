import { describe, expect, it } from 'vitest'
import {
  assertSpatialPayload,
  createBoundedObject,
  createImageObject,
  createPaperPage,
  createShapeObject,
  createSpatialDocument,
  createStrokeObject,
} from './model'

describe('spatial serialization contract', () => {
  it('round-trips every editable object kind without changing geometry or styling', () => {
    const document = createSpatialDocument('canvas-note', 'canvas', 'local')
    const objects = [
      createStrokeObject({ noteId: document.noteId, points: [[1, 2, 0.4, 3, 4, 5], [8, 13, 0.8, 0, 0, 12]], brush: 'pen', color: '#18352a', width: 3, opacity: 1, zIndex: 1 }),
      ...['line', 'arrow', 'rectangle', 'ellipse'].map((shape, index) => createShapeObject({ noteId: document.noteId, shape, start: { x: index * 20, y: 30 }, end: { x: 80, y: 90 }, color: '#234f40', width: 2, zIndex: index + 2 })),
      ...['text', 'sticky', 'indexCard', 'noteLink'].map((kind, index) => createBoundedObject({ noteId: document.noteId, kind, point: { x: index * 40, y: 140 }, text: `${kind} text`, targetNoteId: kind === 'noteLink' ? 'target-note' : null, zIndex: index + 7 })),
      createImageObject({ noteId: document.noteId, point: { x: 20, y: 360 }, zIndex: 11, resourceId: 'image-resource', width: 320, height: 180 }),
    ]
    const resources = [{
      id: 'image-resource', ownerId: 'local', kind: 'image', mimeType: 'image/png', name: 'pixel.png', byteSize: 4,
      data: 'data:image/png;base64,iVBORw==', thumbnailData: null, pixelWidth: 1, pixelHeight: 1,
    }]
    const serialized = JSON.stringify({ document, pages: [], objects, resources })
    const reloaded = JSON.parse(serialized)
    expect(assertSpatialPayload(reloaded)).toBe(true)
    expect(reloaded.objects).toEqual(objects)
  })

  it('rejects future schemas, invalid page references, and executable image payloads', () => {
    const document = createSpatialDocument('paper-note', 'paper')
    const page = createPaperPage(document.noteId)
    const stroke = createStrokeObject({ noteId: document.noteId, pageId: page.id, points: [[2, 3, 0.5, 0, 0, 0]], brush: 'pen', color: '#000000', width: 2, opacity: 1, zIndex: 1 })
    expect(() => assertSpatialPayload({ document: { ...document, schemaVersion: 2 }, pages: [page], objects: [stroke] })).toThrow('newer')
    expect(() => assertSpatialPayload({ document, pages: [], objects: [stroke] })).toThrow('missing page')
    expect(() => assertSpatialPayload({
      document: createSpatialDocument('canvas-image', 'canvas'),
      pages: [],
      objects: [createImageObject({ noteId: 'canvas-image', point: { x: 0, y: 0 }, zIndex: 1, resourceId: 'bad' })],
      resources: [{ id: 'bad', kind: 'image', mimeType: 'image/png', byteSize: 12, data: 'javascript:alert(1)' }],
    })).toThrow('invalid image data')
  })
})
