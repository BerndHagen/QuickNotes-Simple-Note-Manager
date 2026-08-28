import { describe, expect, it } from 'vitest'
import {
  createInternalNoteHref,
  extractDocumentLinks,
  extractSpatialLinks,
  parseInternalNoteHref,
} from './links'

describe('stable internal references', () => {
  it('round-trips Note, heading, and object identities without title coupling', () => {
    const href = createInternalNoteHref({ noteId: 'note/one', anchorId: 'heading-1', objectId: 'object-2' })
    expect(parseInternalNoteHref(href)).toEqual({
      noteId: 'note/one',
      anchorId: 'heading-1',
      objectId: 'object-2',
    })
    expect(parseInternalNoteHref(createInternalNoteHref({ noteId: 'paper', objectId: 'object-only' })))
      .toEqual({ noteId: 'paper', anchorId: null, objectId: 'object-only' })
  })

  it('extracts useful source context and heading identity from Document HTML', () => {
    const links = extractDocumentLinks({
      ownerId: 'owner-a',
      noteId: 'source',
      html: '<h2 data-anchor-id="source-heading">Decision</h2><p>See <a class="note-link" data-note-id="target" href="#note/target?anchor=target-heading">the launch plan</a> before Friday.</p>',
    })
    expect(links).toHaveLength(1)
    expect(links[0]).toMatchObject({
      sourceNoteId: 'source',
      sourceAnchorId: 'source-heading',
      targetNoteId: 'target',
      targetAnchorId: 'target-heading',
      label: 'the launch plan',
      context: 'See the launch plan before Friday.',
    })
  })

  it('uses stable spatial object identities as link sources and destinations', () => {
    const links = extractSpatialLinks({
      ownerId: 'owner-a',
      noteId: 'canvas',
      contentKind: 'canvas',
      objects: [{
        id: 'link-object',
        kind: 'noteLink',
        data: { targetNoteId: 'paper', targetObjectId: 'paper-object', label: 'Sketch detail' },
      }],
    })
    expect(links[0]).toMatchObject({
      sourceObjectId: 'link-object',
      targetNoteId: 'paper',
      targetObjectId: 'paper-object',
    })
  })
})
