import { backend, isBackendConfigured } from '../backend'
import { IntelligenceProviderError } from './providers'
import { MAX_EMBEDDING_DIMENSIONS } from './semantic'

export const AI_ASSISTANT_PROVIDER_ID = 'openai-assistant-v1'
export const AI_EMBEDDING_PROVIDER_ID = 'openai-embedding-v1'
export const AI_TEXT_MODEL_ID = 'gpt-5-mini'
export const AI_EMBEDDING_MODEL_ID = 'text-embedding-3-small'
export const AI_MODEL_VERSION = 'provider-managed-alias'
export const MAX_AI_SOURCES = 24
export const MAX_AI_SOURCE_CHARACTERS = 60_000

const unavailable = (reason = 'External writing assistance and semantic search are not configured for this deployment.') => ({
  available: false,
  assistant: false,
  embeddings: false,
  providerId: AI_ASSISTANT_PROVIDER_ID,
  embeddingProviderId: AI_EMBEDDING_PROVIDER_ID,
  modelId: AI_TEXT_MODEL_ID,
  embeddingModelId: AI_EMBEDDING_MODEL_ID,
  modelVersion: AI_MODEL_VERSION,
  processingLocation: 'external',
  reason,
})

const cleanId = (value) => {
  const id = String(value || '').trim()
  return id && id.length <= 128 ? id : null
}

const cleanText = (value, maximum) => [...String(value || '')]
  .filter((character) => character.charCodeAt(0) !== 0)
  .join('')
  .trim()
  .slice(0, maximum)

const normalizeSources = (values) => {
  if (!Array.isArray(values) || values.length < 1 || values.length > MAX_AI_SOURCES) {
    throw new IntelligenceProviderError('Choose a bounded note scope for this operation.', 'input')
  }
  let characterCount = 0
  const sources = values.map((value, index) => {
    const noteId = cleanId(value?.noteId)
    const text = cleanText(value?.text, 20_000)
    characterCount += text.length
    if (!noteId || !text || characterCount > MAX_AI_SOURCE_CHARACTERS) {
      throw new IntelligenceProviderError('The selected context is invalid or too large.', 'input')
    }
    return {
      id: cleanId(value.id) || `${noteId}:${index}`,
      noteId,
      anchorId: cleanId(value.anchorId),
      title: cleanText(value.title || 'Untitled note', 500),
      text,
      sourceFingerprint: cleanText(value.sourceFingerprint, 512),
    }
  })
  return sources
}

const functionError = async (error) => {
  try {
    const payload = await error?.context?.json?.()
    const code = payload?.error
    if (code === 'rate_limited') return new IntelligenceProviderError('The intelligence usage limit has been reached. Try again later.', 'rate_limit')
    if (code === 'scope_denied') return new IntelligenceProviderError('One or more selected notes are not available for external processing.', 'permission')
    if (code === 'provider_unavailable') return new IntelligenceProviderError('External intelligence is not configured for this deployment.', 'unavailable')
    if (code === 'provider_timeout') return new IntelligenceProviderError('The provider timed out. You can retry this operation.', 'timeout')
    if (code === 'input_too_large') return new IntelligenceProviderError('The selected context is too large. Choose fewer notes or a smaller selection.', 'input')
    if (code === 'policy_refusal') return new IntelligenceProviderError('The provider could not complete this request under its content policy.', 'policy')
  } catch {
    // Network and function-client failures do not always expose JSON details.
  }
  return new IntelligenceProviderError('The external intelligence request failed. No note content was changed.', 'provider')
}

const validateCapability = (data) => {
  if (!data || data.providerId !== AI_ASSISTANT_PROVIDER_ID || data.embeddingProviderId !== AI_EMBEDDING_PROVIDER_ID) return unavailable()
  const assistant = data.assistant === true
  const embeddings = data.embeddings === true
  return {
    available: assistant || embeddings,
    assistant,
    embeddings,
    providerId: AI_ASSISTANT_PROVIDER_ID,
    embeddingProviderId: AI_EMBEDDING_PROVIDER_ID,
    modelId: cleanText(data.modelId || AI_TEXT_MODEL_ID, 160),
    embeddingModelId: cleanText(data.embeddingModelId || AI_EMBEDDING_MODEL_ID, 160),
    modelVersion: cleanText(data.modelVersion || AI_MODEL_VERSION, 160),
    processingLocation: 'external',
    reason: assistant || embeddings ? null : cleanText(data.reason || unavailable().reason, 300),
  }
}

export async function getExternalAiAvailability(options = {}) {
  const client = options.client || backend
  if (!isBackendConfigured() && !options.client) return unavailable('Connect a QuickNotes cloud account to use external intelligence.')
  const { data: userData, error: userError } = await client.auth.getUser()
  if (userError || !userData?.user) return unavailable('Sign in to a QuickNotes cloud account to use external intelligence.')
  const { data, error } = await client.functions.invoke('ai-intelligence', {
    body: { action: 'capability' },
    signal: options.signal,
  })
  if (error) return unavailable()
  return validateCapability(data)
}

const normalizeAssistantResult = (data, allowedNoteIds) => {
  if (data?.providerId !== AI_ASSISTANT_PROVIDER_ID || data.processingLocation !== 'external') {
    throw new IntelligenceProviderError('The provider returned an invalid assistance result.', 'provider')
  }
  const text = cleanText(data.text, 40_000)
  if (!text) throw new IntelligenceProviderError('The provider returned no usable text.', 'provider')
  const citations = (Array.isArray(data.citations) ? data.citations : []).slice(0, 24).map((citation) => ({
    noteId: cleanId(citation?.noteId),
    anchorId: cleanId(citation?.anchorId),
    label: cleanText(citation?.label, 500),
  })).filter((citation) => citation.noteId && allowedNoteIds.has(citation.noteId))
  const suggestions = data.suggestions && typeof data.suggestions === 'object' ? data.suggestions : {}
  return {
    text,
    title: cleanText(data.title, 500) || null,
    citations,
    suggestions: {
      tasks: (Array.isArray(suggestions.tasks) ? suggestions.tasks : []).slice(0, 20)
        .map((value) => cleanText(value?.text ?? value, 1_000)).filter(Boolean),
      tags: (Array.isArray(suggestions.tags) ? suggestions.tags : []).slice(0, 20)
        .map((value) => cleanText(value?.name ?? value, 100).toLocaleLowerCase()).filter(Boolean),
      links: (Array.isArray(suggestions.links) ? suggestions.links : []).slice(0, 20)
        .map((value) => ({ noteId: cleanId(value?.noteId), rationale: cleanText(value?.rationale, 500) }))
        .filter((value) => value.noteId && allowedNoteIds.has(value.noteId)),
    },
    providerId: AI_ASSISTANT_PROVIDER_ID,
    modelId: cleanText(data.modelId, 160),
    modelVersion: cleanText(data.modelVersion, 160),
    processingLocation: 'external',
  }
}

const normalizeEmbeddingResult = (data, expected) => {
  if (data?.providerId !== AI_EMBEDDING_PROVIDER_ID || data.processingLocation !== 'external' || !Array.isArray(data.embeddings)) {
    throw new IntelligenceProviderError('The provider returned an invalid embedding result.', 'provider')
  }
  if (data.embeddings.length !== expected.length) throw new IntelligenceProviderError('The provider returned an incomplete embedding result.', 'provider')
  return data.embeddings.map((row, index) => {
    const vector = Array.isArray(row?.vector) ? row.vector.map(Number) : []
    if (row?.id !== expected[index].id || vector.length < 2 || vector.length > MAX_EMBEDDING_DIMENSIONS || !vector.every(Number.isFinite)) {
      throw new IntelligenceProviderError('The provider returned malformed embedding data.', 'provider')
    }
    return { id: row.id, vector }
  })
}

export function createExternalAssistantProvider(options = {}) {
  return {
    id: AI_ASSISTANT_PROVIDER_ID,
    displayName: 'QuickNotes external writing assistance',
    capability: 'assistant',
    processingLocation: 'external',
    offline: false,
    requiresExplicitTransfer: true,
    modelId: AI_TEXT_MODEL_ID,
    modelVersion: AI_MODEL_VERSION,
    async generate(input, context = {}) {
      const sources = normalizeSources(input?.sources)
      const client = options.client || backend
      const { data, error } = await client.functions.invoke('ai-intelligence', {
        body: {
          action: 'assistant',
          operation: cleanText(input?.operation, 40),
          question: cleanText(input?.question, 2_000),
          scopeLabel: cleanText(input?.scopeLabel, 300),
          sources,
        },
        signal: context.signal,
      })
      if (context.signal?.aborted) throw new DOMException('Cancelled', 'AbortError')
      if (error) throw await functionError(error)
      return normalizeAssistantResult(data, new Set(sources.map((source) => source.noteId)))
    },
  }
}

export function createExternalEmbeddingProvider(options = {}) {
  return {
    id: AI_EMBEDDING_PROVIDER_ID,
    displayName: 'QuickNotes external semantic indexing',
    capability: 'embedding',
    processingLocation: 'external',
    offline: false,
    requiresExplicitTransfer: true,
    modelId: AI_EMBEDDING_MODEL_ID,
    modelVersion: AI_MODEL_VERSION,
    async embed(input, context = {}) {
      const client = options.client || backend
      const kind = input?.kind === 'query' ? 'query' : 'sources'
      const values = kind === 'query'
        ? [{ id: 'query', text: cleanText(input?.query, 2_000) }]
        : normalizeSources(input?.sources).map((source) => ({ ...source, title: undefined }))
      if (!values[0]?.text) throw new IntelligenceProviderError('Enter text to search semantically.', 'input')
      const { data, error } = await client.functions.invoke('ai-intelligence', {
        body: { action: 'embedding', kind, inputs: values },
        signal: context.signal,
      })
      if (context.signal?.aborted) throw new DOMException('Cancelled', 'AbortError')
      if (error) throw await functionError(error)
      return {
        embeddings: normalizeEmbeddingResult(data, values),
        providerId: AI_EMBEDDING_PROVIDER_ID,
        modelId: cleanText(data.modelId, 160),
        modelVersion: cleanText(data.modelVersion, 160),
      }
    },
  }
}
