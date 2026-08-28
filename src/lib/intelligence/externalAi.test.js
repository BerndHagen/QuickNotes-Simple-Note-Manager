import { describe, expect, it, vi } from 'vitest'
import {
  AI_ASSISTANT_PROVIDER_ID,
  AI_EMBEDDING_PROVIDER_ID,
  createExternalAssistantProvider,
  createExternalEmbeddingProvider,
  getExternalAiAvailability,
} from './externalAi'

const client = (responses) => ({
  auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'owner-a' } }, error: null })) },
  functions: { invoke: vi.fn(async () => responses.shift()) },
})

const source = { id: 'note-a:0', noteId: 'note-a', title: 'Plan', text: 'Release on Friday.', sourceFingerprint: 'fp-a' }

describe('external AI provider boundary', () => {
  it('keeps the capability unavailable until the authenticated server validates both models', async () => {
    const fake = client([{ data: {
      assistant: false, embeddings: false, providerId: AI_ASSISTANT_PROVIDER_ID,
      embeddingProviderId: AI_EMBEDDING_PROVIDER_ID, reason: 'Not configured',
    }, error: null }])
    await expect(getExternalAiAvailability({ client: fake })).resolves.toMatchObject({ available: false, assistant: false, embeddings: false })
  })

  it('sends only the explicitly scoped source and rejects citations outside it', async () => {
    const fake = client([{ data: {
      providerId: AI_ASSISTANT_PROVIDER_ID, processingLocation: 'external', modelId: 'text-model', modelVersion: 'alias',
      text: 'According to the plan, release Friday.',
      citations: [{ noteId: 'note-a', label: 'Plan' }, { noteId: 'private-note', label: 'Not scoped' }],
      suggestions: { links: [{ noteId: 'private-note', rationale: 'No' }] },
    }, error: null }])
    const provider = createExternalAssistantProvider({ client: fake })
    const result = await provider.generate({ operation: 'answer', question: 'When?', sources: [source], scopeLabel: 'Current note' })
    expect(fake.functions.invoke).toHaveBeenCalledWith('ai-intelligence', expect.objectContaining({
      body: expect.objectContaining({ action: 'assistant', sources: [expect.objectContaining(source)] }),
    }))
    expect(result.citations).toEqual([{ noteId: 'note-a', anchorId: null, label: 'Plan' }])
    expect(result.suggestions.links).toEqual([])
  })

  it('validates vector identity, dimensions, and ordering', async () => {
    const fake = client([{ data: {
      providerId: AI_EMBEDDING_PROVIDER_ID, processingLocation: 'external', modelId: 'embedding-model', modelVersion: 'alias',
      embeddings: [{ id: 'note-a:0', vector: [0.1, 0.2, 0.3] }],
    }, error: null }])
    const provider = createExternalEmbeddingProvider({ client: fake })
    await expect(provider.embed({ kind: 'sources', sources: [source] })).resolves.toMatchObject({
      embeddings: [{ id: 'note-a:0', vector: [0.1, 0.2, 0.3] }],
    })
  })
})
