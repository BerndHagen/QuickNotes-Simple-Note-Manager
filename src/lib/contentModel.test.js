import { describe, expect, it } from 'vitest'
import {
  CONTENT_KINDS,
  extractContentDescriptorFromNoteData,
  migrateNoteContentMetadata,
  normalizeContentDescriptor,
} from './contentModel'

describe('canonical note content descriptors', () => {
  it('migrates legacy note types deterministically without inspecting content', () => {
    expect(normalizeContentDescriptor({ noteType: 'standard', content: '<canvas>not a canvas</canvas>' })).toEqual({
      contentKind: CONTENT_KINDS.DOCUMENT,
      contentSchemaVersion: 1,
    })
    expect(migrateNoteContentMetadata({ id: 'paper', noteType: 'paper' })).toMatchObject({
      contentKind: CONTENT_KINDS.PAPER,
      contentSchemaVersion: 1,
    })
    expect(migrateNoteContentMetadata({ id: 'tasks', noteType: 'todo' })).toMatchObject({
      contentKind: CONTENT_KINDS.STRUCTURED,
    })
    expect(migrateNoteContentMetadata({ id: 'ideas', noteType: 'brainstorm', contentKind: 'structured' })).toMatchObject({
      contentKind: CONTENT_KINDS.CANVAS,
    })
  })

  it('keeps spatial payloads out of cloud note_data metadata', () => {
    expect(extractContentDescriptorFromNoteData('canvas', {
      __quicknotes: { contentKind: 'canvas', contentSchemaVersion: 1 },
      spatialPreset: { background: 'neutral' },
    })).toEqual({
      contentKind: 'canvas',
      contentSchemaVersion: 1,
      noteData: { spatialPreset: { background: 'neutral' } },
    })
  })
})
