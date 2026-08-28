import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { clearLocalData, db } from '../db'
import { createRecognizedContent } from '../intelligence/model'
import { correctRecognition } from '../intelligence/repository'
import { getBacklinks, getForwardLinks, rebuildKnowledgeIndex, reconcileKnowledgeIndex } from './repository'

const note = (id, overrides = {}) => ({
  id,
  title: id,
  noteType: 'standard',
  contentKind: 'document',
  content: '',
  tags: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
})

describe('derived knowledge repository', () => {
  beforeEach(clearLocalData)

  it('incrementally replaces links and rebuilds deterministically from canonical content', async () => {
    const target = note('target')
    const source = note('source', {
      content: '<p>Review <a class="note-link" data-note-id="target" href="#note/target">the plan</a>.</p>',
    })
    const first = await reconcileKnowledgeIndex({ ownerId: 'owner-a', notes: [source, target] })
    expect(first.changedNoteIds).toEqual(['source', 'target'])
    expect(await getBacklinks('owner-a', 'target', [source, target])).toHaveLength(1)

    const changed = { ...source, content: '<p>No link now.</p>', updatedAt: '2026-01-02T00:00:00.000Z' }
    const incremental = await reconcileKnowledgeIndex({ ownerId: 'owner-a', notes: [changed, target] })
    expect(incremental.changedNoteIds).toEqual(['source'])
    expect(await getBacklinks('owner-a', 'target', [changed, target])).toHaveLength(0)

    await db.searchDocuments.where('ownerId').equals('owner-a').delete()
    const rebuilt = await rebuildKnowledgeIndex({ ownerId: 'owner-a', notes: [changed, target] })
    expect(rebuilt.documents.map((document) => document.noteId).sort()).toEqual(['source', 'target'])
  })

  it('isolates owners and preserves a safe diagnostic for missing targets', async () => {
    const source = note('source', {
      content: '<p><a class="note-link" data-note-id="missing" href="#note/missing">Missing</a></p>',
    })
    await reconcileKnowledgeIndex({ ownerId: 'owner-a', notes: [source] })
    await reconcileKnowledgeIndex({ ownerId: 'owner-b', notes: [note('private-b', { title: 'Private B' })] })

    expect((await db.searchDocuments.where('ownerId').equals('owner-a').toArray()).map((row) => row.noteId)).toEqual(['source'])
    expect((await db.searchDocuments.where('ownerId').equals('owner-b').toArray()).map((row) => row.noteId)).toEqual(['private-b'])
    expect(await getForwardLinks('owner-a', 'source', [source])).toMatchObject([
      { targetNoteId: 'missing', targetBroken: true, targetTitle: 'Missing note' },
    ])
  })

  it('incrementally projects recognition and user corrections into the canonical search document', async () => {
    const source = note('recognized-note')
    const recognition = createRecognizedContent({
      ownerId: 'owner-a',
      noteId: source.id,
      type: 'ocr',
      sourceKind: 'image',
      sourceResourceId: 'image-a',
      text: 'Invoice number 4287',
      providerId: 'local-ocr',
      processingLocation: 'local',
      sourceFingerprint: 'sha256:image',
    })
    await db.recognizedContent.put(recognition)

    const first = await reconcileKnowledgeIndex({ ownerId: 'owner-a', notes: [source] })
    expect(first.documents[0].recognizedText).toBe('Invoice number 4287')
    await correctRecognition(recognition.id, 'Invoice number 4287 verified', { ownerId: 'owner-a' })
    const second = await reconcileKnowledgeIndex({ ownerId: 'owner-a', notes: [source] })

    expect(second.changedNoteIds).toEqual([source.id])
    expect(second.documents[0].recognizedText).toBe('Invoice number 4287 verified')
  })

  it('detects a corrupted derived link count and recovers without touching notes', async () => {
    const target = note('target')
    const source = note('source', {
      content: '<p><a class="note-link" data-note-id="target" href="#note/target">Target</a></p>',
    })
    await reconcileKnowledgeIndex({ ownerId: 'owner-a', notes: [source, target] })
    await db.knowledgeLinks.where('ownerId').equals('owner-a').delete()

    const recovered = await reconcileKnowledgeIndex({ ownerId: 'owner-a', notes: [source, target] })
    expect(recovered.changedNoteIds.sort()).toEqual(['source', 'target'])
    expect(await getBacklinks('owner-a', 'target', [source, target])).toHaveLength(1)
    expect(await db.notes.count()).toBe(0)
  })

  it('rebuilds a malformed derived search document without changing canonical notes', async () => {
    const canonical = note('canonical', { content: '<p>Irreplaceable source</p>' })
    await db.notes.put(canonical)
    await reconcileKnowledgeIndex({ ownerId: 'owner-a', notes: [canonical] })
    const stored = await db.searchDocuments.get(['owner-a', canonical.id])
    await db.searchDocuments.put({
      ...stored,
      searchableText: { malformed: true },
      locations: null,
    })

    const recovered = await reconcileKnowledgeIndex({ ownerId: 'owner-a', notes: [canonical] })

    expect(recovered.changedNoteIds).toEqual([canonical.id])
    expect(await db.searchDocuments.get(['owner-a', canonical.id])).toMatchObject({
      searchableText: expect.stringContaining('Irreplaceable source'),
      locations: expect.any(Array),
    })
    expect(await db.notes.get(canonical.id)).toEqual(canonical)
  })
})
