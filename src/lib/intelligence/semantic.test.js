import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db'
import {
  chunkKnowledgeDocument,
  createSemanticEmbedding,
  findSemanticMatches,
  markStaleSemanticEmbeddings,
  mergeHybridResults,
} from './semantic'

const document = (overrides = {}) => ({
  noteId: 'note-a',
  title: 'Release plan',
  bodyText: 'The launch checklist includes a staged rollout and rollback rehearsal.',
  headingsText: 'Deployment',
  objectText: '',
  metadataText: '',
  locations: [],
  sourceFingerprint: 'source-a',
  deleted: false,
  archived: false,
  shared: false,
  ...overrides,
})

beforeEach(async () => {
  await db.semanticEmbeddings.clear()
  await db.semanticIndexState.clear()
})

describe('semantic derived index', () => {
  it('chunks only owned current searchable documents and keeps stable targets', () => {
    expect(chunkKnowledgeDocument(document())).toEqual([
      expect.objectContaining({ id: 'note-a:semantic:0', noteId: 'note-a', sourceFingerprint: 'source-a', target: { noteId: 'note-a' } }),
    ])
    expect(chunkKnowledgeDocument(document({ shared: true }))).toEqual([])
    expect(chunkKnowledgeDocument(document({ deleted: true }))).toEqual([])
  })

  it('uses only current fingerprint-matching vectors and marks changed sources stale', async () => {
    await db.semanticEmbeddings.put(createSemanticEmbedding({
      id: 'note-a:semantic:0', ownerId: 'owner-a', noteId: 'note-a', sourceFingerprint: 'source-a',
      textPreview: 'staged rollout', target: { noteId: 'note-a' }, vector: [1, 0],
      providerId: 'provider', modelId: 'model', modelVersion: 'v1',
    }))
    await expect(findSemanticMatches({ ownerId: 'owner-a', queryVector: [0.99, 0.01], documents: [document()] }))
      .resolves.toEqual([expect.objectContaining({ noteId: 'note-a', semanticLabel: true, snippet: 'staged rollout' })])

    expect(await markStaleSemanticEmbeddings('owner-a', [document({ sourceFingerprint: 'source-b' })])).toBe(1)
    expect((await db.semanticEmbeddings.get('note-a:semantic:0')).status).toBe('stale')
    await expect(findSemanticMatches({ ownerId: 'owner-a', queryVector: [1, 0], documents: [document({ sourceFingerprint: 'source-b' })] }))
      .resolves.toEqual([])
  })

  it('never buries an exact title or lexical result beneath semantic-only matches', () => {
    const lexical = [
      { noteId: 'exact', title: 'Atlas', score: 21 },
      { noteId: 'lexical', title: 'Project notes', score: 4 },
    ]
    const semantic = [
      { noteId: 'semantic', title: 'Distributed map', semanticSimilarity: 0.99 },
      { noteId: 'lexical', title: 'Project notes', semanticSimilarity: 0.8 },
    ]
    expect(mergeHybridResults(lexical, semantic, 'Atlas').map((row) => row.noteId)).toEqual(['exact', 'lexical', 'semantic'])
  })
})
