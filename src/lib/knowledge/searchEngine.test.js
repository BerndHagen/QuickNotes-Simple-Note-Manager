import { describe, expect, it } from 'vitest'
import { createKnowledgeSearchEngine } from './searchEngine'

const searchDocument = (id, overrides = {}) => ({
  id,
  noteId: id,
  ownerId: 'owner-a',
  title: `Note ${id}`,
  titleNormalized: `note ${id}`,
  headings: [],
  headingsText: '',
  tags: [],
  tagsText: '',
  folderName: '',
  bodyText: '',
  objectText: '',
  resourceText: '',
  metadataText: '',
  searchableText: '',
  noteType: 'standard',
  contentKind: 'document',
  deleted: false,
  archived: false,
  pinned: false,
  starred: false,
  shared: false,
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
})

describe('knowledge search engine', () => {
  it('weights title and headings above body matches with deterministic ordering', () => {
    const engine = createKnowledgeSearchEngine([
      searchDocument('body', { bodyText: 'launch plan', searchableText: 'launch plan' }),
      searchDocument('heading', { headingsText: 'Launch plan', searchableText: 'Launch plan' }),
      searchDocument('title', { title: 'Launch plan', titleNormalized: 'launch plan', searchableText: 'Launch plan' }),
    ])
    expect(engine.search('launch plan').map((result) => result.noteId)).toEqual(['title', 'heading', 'body'])
  })

  it('supports useful prefix, restrained fuzzy, phrase, filter, and Unicode matching', () => {
    const engine = createKnowledgeSearchEngine([
      searchDocument('unicode', {
        title: 'Café 東京 planning',
        titleNormalized: 'café 東京 planning',
        tags: ['travel'],
        tagsText: 'travel',
        folderName: 'Trips',
        searchableText: 'Café 東京 planning travel Trips',
      }),
      searchDocument('phrase-miss', {
        bodyText: 'planning for another quarterly cycle',
        searchableText: 'planning for another quarterly cycle',
      }),
    ])

    expect(engine.search('cafe')[0].noteId).toBe('unicode')
    expect(engine.search('東京')[0].noteId).toBe('unicode')
    expect(engine.search('plann')[0].noteId).toBe('unicode')
    expect(engine.search('planing')[0].noteId).toBe('unicode')
    expect(engine.search('"東京 planning" tag:travel folder:trips').map((result) => result.noteId)).toEqual(['unicode'])
  })

  it('reports accent-folded body matches with the correct context', () => {
    const engine = createKnowledgeSearchEngine([
      searchDocument('accented-body', {
        bodyText: 'Zürich façade planning',
        searchableText: 'Zürich façade planning',
      }),
    ])

    expect(engine.search('zurich facade')[0]).toMatchObject({
      noteId: 'accented-body',
      matchField: 'content',
      snippet: 'Zürich façade planning',
    })
  })

  it('keeps Trash and Archive out of ordinary results but makes explicit state filters honest', () => {
    const engine = createKnowledgeSearchEngine([
      searchDocument('active', { title: 'Budget', titleNormalized: 'budget', searchableText: 'Budget' }),
      searchDocument('trash', { title: 'Budget old', titleNormalized: 'budget old', searchableText: 'Budget old', deleted: true }),
      searchDocument('archive', { title: 'Budget 2025', titleNormalized: 'budget 2025', searchableText: 'Budget 2025', archived: true }),
    ])
    expect(engine.search('budget').map((result) => result.noteId)).toEqual(['active'])
    expect(engine.search('budget is:trash').map((result) => result.noteId)).toEqual(['trash'])
    expect(engine.search('budget is:archived').map((result) => result.noteId)).toEqual(['archive'])
  })

  it('returns stable heading and spatial object navigation targets', () => {
    const engine = createKnowledgeSearchEngine([
      searchDocument('document-target', {
        headings: [{ anchorId: 'heading-1', text: 'Release gates', level: 2 }],
        locations: [{ kind: 'heading', anchorId: 'heading-1', text: 'Release gates' }],
        headingsText: 'Release gates',
        searchableText: 'Release gates',
      }),
      searchDocument('canvas-target', {
        contentKind: 'canvas',
        noteType: 'canvas',
        objectText: 'Supplier follow-up',
        locations: [{ kind: 'object', objectId: 'sticky-1', text: 'Supplier follow-up' }],
        searchableText: 'Supplier follow-up',
      }),
    ])
    expect(engine.search('release gates')[0].target).toEqual({ noteId: 'document-target', anchorId: 'heading-1' })
    expect(engine.search('supplier follow')[0].target).toEqual({ noteId: 'canvas-target', objectId: 'sticky-1' })
  })

  it('returns the canonical source target for recognized text', () => {
    const engine = createKnowledgeSearchEngine([
      searchDocument('recognized-target', {
        recognizedText: 'Invoice total forty two — euros',
        searchableText: 'Invoice total forty two — euros',
        locations: [{
          kind: 'recognition',
          recognitionId: 'recognition-a',
          resourceId: 'pdf-a',
          pageNumber: 4,
          text: 'Invoice total forty two — euros',
        }],
      }),
    ])

    expect(engine.search('forty two')[0]).toMatchObject({
      matchField: 'recognized',
      target: {
        noteId: 'recognized-target',
        recognitionId: 'recognition-a',
        resourceId: 'pdf-a',
        pageNumber: 4,
      },
    })
  })

  it('indexes and queries a 10,000-note corpus within a bounded regression budget', () => {
    const documents = Array.from({ length: 10_000 }, (_, index) => searchDocument(`note-${index}`, {
      title: `Project record ${index}`,
      titleNormalized: `project record ${index}`,
      bodyText: `Operational planning record ${index} with reusable context`,
      searchableText: `Project record ${index} Operational planning with reusable context`,
      updatedAt: new Date(1_700_000_000_000 + index).toISOString(),
    }))
    documents[9_876] = searchDocument('needle', {
      title: 'Zephyr launch checklist',
      titleNormalized: 'zephyr launch checklist',
      searchableText: 'Zephyr launch checklist',
    })
    const buildStarted = performance.now()
    const engine = createKnowledgeSearchEngine(documents)
    const buildDuration = performance.now() - buildStarted
    const searchStarted = performance.now()
    const results = engine.search('zephyr launch')
    const searchDuration = performance.now() - searchStarted

    expect(results[0].noteId).toBe('needle')
    expect(buildDuration).toBeLessThan(10_000)
    expect(searchDuration).toBeLessThan(1_000)
  }, 20_000)
})
