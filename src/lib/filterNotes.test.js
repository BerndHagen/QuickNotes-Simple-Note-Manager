import { describe, it, expect, beforeEach } from 'vitest'
import { filterNotes, STARRED_FILTER, clearSearchCache } from './filterNotes'

const note = (overrides) => ({
  id: Math.random().toString(36).slice(2),
  title: 'Untitled',
  content: '',
  tags: [],
  folderId: null,
  starred: false,
  deleted: false,
  archived: false,
  updatedAt: new Date().toISOString(),
  ...overrides,
})

describe('filterNotes', () => {
  beforeEach(() => clearSearchCache())

  it('excludes deleted and archived notes from the active scope', () => {
    const notes = [
      note({ title: 'live' }),
      note({ title: 'binned', deleted: true }),
      note({ title: 'filed', archived: true }),
    ]
    expect(filterNotes(notes).map((n) => n.title)).toEqual(['live'])
  })

  it('returns only trashed notes for the trash scope', () => {
    const notes = [note({ title: 'live' }), note({ title: 'binned', deleted: true })]
    expect(filterNotes(notes, { scope: 'trash' }).map((n) => n.title)).toEqual(['binned'])
  })

  // The favourites sentinel must not fall through to a literal tag match.
  it('treats __starred__ as a favourites filter, not a tag name', () => {
    const notes = [
      note({ title: 'fav', starred: true }),
      note({ title: 'plain' }),
      note({ title: 'mislabelled', tags: [STARRED_FILTER] }),
    ]
    const result = filterNotes(notes, { tagFilter: STARRED_FILTER })
    expect(result.map((n) => n.title)).toEqual(['fav'])
  })

  it('filters by tag and by folder', () => {
    const notes = [
      note({ title: 'a', tags: ['work'], folderId: 'f1' }),
      note({ title: 'b', tags: ['home'], folderId: 'f1' }),
      note({ title: 'c', tags: ['work'], folderId: 'f2' }),
    ]
    expect(filterNotes(notes, { tagFilter: 'work' }).map((n) => n.title)).toEqual(['a', 'c'])
    expect(filterNotes(notes, { folderId: 'f1' }).map((n) => n.title)).toEqual(['a', 'b'])
    expect(filterNotes(notes, { tagFilter: 'work', folderId: 'f1' }).map((n) => n.title)).toEqual(['a'])
  })

  // Searching the stored HTML would make queries like "div" match every
  // formatted note.
  it('searches rendered text, not the underlying HTML', () => {
    const notes = [
      note({ title: 'Recipe', content: '<div class="span"><p>Tomato soup</p></div>' }),
      note({ title: 'Other', content: '<p>Nothing here</p>' }),
    ]
    expect(filterNotes(notes, { query: 'div' })).toHaveLength(0)
    expect(filterNotes(notes, { query: 'class' })).toHaveLength(0)
    expect(filterNotes(notes, { query: 'tomato' }).map((n) => n.title)).toEqual(['Recipe'])
  })

  it('searches text stored by structured note editors', () => {
    const target = note({
      id: 'structured',
      title: 'Saturday',
      noteType: 'todo',
      noteData: {
        tasks: [{ text: 'Buy ZebraNeedle42 supplies', subtasks: [{ text: 'Call Sam' }] }],
      },
    })

    expect(filterNotes([target], { query: 'zebraneedle42' })).toEqual([target])
    expect(filterNotes([target], { query: 'call sam' })).toEqual([target])
  })

  it('matches on title and tags case-insensitively', () => {
    const notes = [note({ title: 'Quarterly Report', tags: ['Finance'] })]
    expect(filterNotes(notes, { query: 'quarterly' })).toHaveLength(1)
    expect(filterNotes(notes, { query: 'finance' })).toHaveLength(1)
    expect(filterNotes(notes, { query: '  QUARTERLY  ' })).toHaveLength(1)
  })

  it('returns everything for a blank query', () => {
    const notes = [note({ title: 'a' }), note({ title: 'b' })]
    expect(filterNotes(notes, { query: '   ' })).toHaveLength(2)
  })

  it('re-reads a note whose content changed after being cached', () => {
    const target = note({ id: 'n1', title: 'T', content: '<p>before</p>' })
    expect(filterNotes([target], { query: 'before' })).toHaveLength(1)
    const updated = { ...target, content: '<p>after</p>' }
    expect(filterNotes([updated], { query: 'before' })).toHaveLength(0)
    expect(filterNotes([updated], { query: 'after' })).toHaveLength(1)
  })

  it('re-reads structured content when note data changes', () => {
    const target = note({ id: 'n1', noteData: { tasks: [{ text: 'before' }] } })
    expect(filterNotes([target], { query: 'before' })).toHaveLength(1)
    const updated = { ...target, noteData: { tasks: [{ text: 'after' }] } }
    expect(filterNotes([updated], { query: 'before' })).toHaveLength(0)
    expect(filterNotes([updated], { query: 'after' })).toHaveLength(1)
  })
})
