import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useNotesStore } from './index'

const original = useNotesStore.getState()

describe('knowledge navigation history', () => {
  beforeEach(() => {
    useNotesStore.setState({
      notes: [
        { id: 'document', title: 'Document' },
        { id: 'paper', title: 'Paper', noteType: 'paper' },
        { id: 'canvas', title: 'Canvas', noteType: 'canvas' },
      ],
      sharedNotes: [],
      selectedNoteId: 'document',
      knowledgeNavigation: {
        current: { noteId: 'document', anchorId: null, objectId: null },
        back: [],
        forward: [],
        pending: null,
        token: 0,
      },
    })
  })

  afterEach(() => useNotesStore.setState(original, true))

  it('navigates across surfaces and preserves precise targets through back/forward', () => {
    expect(useNotesStore.getState().navigateToKnowledgeTarget({ noteId: 'paper', objectId: 'paper-object' })).toBe(true)
    expect(useNotesStore.getState().navigateToKnowledgeTarget({ noteId: 'canvas', objectId: 'canvas-object' })).toBe(true)
    expect(useNotesStore.getState().knowledgeNavigation.back).toEqual([
      { noteId: 'document', anchorId: null, objectId: null },
      { noteId: 'paper', anchorId: null, objectId: 'paper-object' },
    ])

    expect(useNotesStore.getState().navigateKnowledgeBack()).toBe(true)
    expect(useNotesStore.getState()).toMatchObject({
      selectedNoteId: 'paper',
      knowledgeNavigation: {
        current: { noteId: 'paper', objectId: 'paper-object' },
        forward: [{ noteId: 'canvas', objectId: 'canvas-object' }],
      },
    })
    expect(useNotesStore.getState().navigateKnowledgeForward()).toBe(true)
    expect(useNotesStore.getState().selectedNoteId).toBe('canvas')
  })

  it('does not create history entries for missing note identities', () => {
    expect(useNotesStore.getState().navigateToKnowledgeTarget('missing')).toBe(false)
    expect(useNotesStore.getState().selectedNoteId).toBe('document')
    expect(useNotesStore.getState().knowledgeNavigation.back).toEqual([])
  })

  it('keeps history aligned when creating a note selects the new editor', () => {
    const created = useNotesStore.getState().createNote({ title: 'Created note' })
    expect(useNotesStore.getState().knowledgeNavigation).toMatchObject({
      current: { noteId: created.id },
      back: [{ noteId: 'document' }],
    })

    expect(useNotesStore.getState().navigateToKnowledgeTarget({ noteId: 'paper', objectId: 'object-1' })).toBe(true)
    expect(useNotesStore.getState().navigateKnowledgeBack()).toBe(true)
    expect(useNotesStore.getState().selectedNoteId).toBe(created.id)
  })
})
