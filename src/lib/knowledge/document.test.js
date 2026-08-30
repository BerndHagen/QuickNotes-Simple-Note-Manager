import { describe, expect, it } from 'vitest'
import { createSearchDocument } from './document'

const baseNote = (overrides = {}) => ({
  id: 'note-1',
  title: 'Research note',
  noteType: 'standard',
  contentKind: 'document',
  content: '',
  tags: ['work'],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  ...overrides,
})

describe('canonical SearchDocument projection', () => {
  it('separates title, headings, tags, body, and metadata', () => {
    const document = createSearchDocument({
      ownerId: 'owner-a',
      note: baseNote({
        content: '<h2 data-anchor-id="heading-a">Quarterly Plan</h2><p>Ship the offline index.</p>',
      }),
      folder: { id: 'folder-1', name: 'Projects' },
    })

    expect(document).toMatchObject({
      noteId: 'note-1',
      title: 'Research note',
      headingsText: 'Quarterly Plan',
      bodyText: 'Quarterly Plan Ship the offline index.',
      tagsText: 'work',
      folderName: 'Projects',
    })
    expect(document.headings[0]).toMatchObject({ anchorId: 'heading-a', level: 2 })
  })

  it('indexes structured values without treating internal identities as prose', () => {
    const document = createSearchDocument({
      ownerId: 'owner-a',
      note: baseNote({
        noteType: 'meeting',
        contentKind: 'structured',
        noteData: {
          id: 'internal-row-id',
          location: 'Vienna office',
          agenda: [{ topic: 'Release readiness', completed: false }],
        },
      }),
    })

    expect(document.bodyText).toContain('Vienna office')
    expect(document.bodyText).toContain('Release readiness')
    expect(document.bodyText).not.toContain('internal-row-id')
  })

  it('indexes typed spatial objects and resource metadata but never raw ink points', () => {
    const document = createSearchDocument({
      ownerId: 'owner-a',
      note: baseNote({ noteType: 'paper', contentKind: 'paper' }),
      spatialObjects: [
        { id: 'stroke', kind: 'stroke', data: { points: [[928374, 129837, 0.5, 0, 0, 0]] } },
        { id: 'text', kind: 'sticky', data: { text: 'Call the supplier' } },
        { id: 'image', kind: 'image', data: { resourceId: 'resource-1' } },
      ],
      resources: [{ id: 'resource-1', name: 'signed-contract.pdf', mimeType: 'application/pdf' }],
    })

    expect(document.objectText).toContain('Call the supplier')
    expect(document.resourceText).toContain('signed-contract.pdf')
    expect(document.searchableText).not.toContain('928374')
    expect(document.locations).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'object', objectId: 'text', text: 'Call the supplier' }),
      expect.objectContaining({ kind: 'resource', objectId: 'image', resourceId: 'resource-1' }),
    ]))
  })

  it('indexes both the Canvas and retained idea register for Brainstorm', () => {
    const document = createSearchDocument({
      ownerId: 'owner-a',
      note: baseNote({
        noteType: 'brainstorm',
        contentKind: 'canvas',
        noteData: { topic: 'Reduce setup time', ideas: [{ id: 'idea-1', text: 'Guided import' }] },
      }),
      spatialObjects: [
        { id: 'sticky-1', kind: 'sticky', data: { text: 'Map the first-run path' } },
      ],
    })

    expect(document.bodyText).toContain('Reduce setup time')
    expect(document.bodyText).toContain('Guided import')
    expect(document.bodyText).not.toContain('idea-1')
    expect(document.objectText).toContain('Map the first-run path')
  })

  it('indexes attributed recognition separately from canonical content', () => {
    const document = createSearchDocument({
      ownerId: 'owner-a',
      note: baseNote({ id: 'paper-recognition', noteType: 'paper', contentKind: 'paper' }),
      recognizedContent: [{
        id: 'recognition-a',
        type: 'handwriting',
        status: 'current',
        text: 'Call the architect on Friday',
        sourceObjectIds: ['stroke-a', 'stroke-b'],
        sourcePageId: 'page-a',
        sourceRegion: { x: 10, y: 20, width: 200, height: 60 },
      }],
    })

    expect(document.recognizedText).toBe('Call the architect on Friday')
    expect(document.locations).toContainEqual(expect.objectContaining({
      kind: 'recognition',
      recognitionId: 'recognition-a',
      objectId: 'stroke-a',
      pageId: 'page-a',
    }))
  })
})
