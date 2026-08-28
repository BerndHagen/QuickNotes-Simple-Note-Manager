import { evaluateProcessingPolicy } from './policy'
import { PROCESSING_LOCATIONS } from './model'

export const INTELLIGENCE_CAPABILITIES = Object.freeze([
  'handwriting',
  'ocr',
  'math',
  'transcription',
  'embedding',
  'assistant',
  'translation',
  'pdfText',
])

const CAPABILITY_METHODS = Object.freeze({
  handwriting: 'recognizeInk',
  ocr: 'recognizeImage',
  math: 'recognizeMath',
  transcription: 'transcribe',
  embedding: 'embed',
  assistant: 'generate',
  translation: 'translate',
  pdfText: 'extractText',
})

export class IntelligenceProviderError extends Error {
  constructor(message, code = 'provider', options = {}) {
    super(message, options)
    this.name = 'IntelligenceProviderError'
    this.code = code
  }
}

const validateProvider = (provider) => {
  if (!provider?.id || !INTELLIGENCE_CAPABILITIES.includes(provider.capability)) {
    throw new Error('An intelligence provider needs a stable ID and supported capability.')
  }
  if (!PROCESSING_LOCATIONS.includes(provider.processingLocation)) {
    throw new Error('An intelligence provider must declare where processing occurs.')
  }
  const method = CAPABILITY_METHODS[provider.capability]
  if (typeof provider[method] !== 'function') {
    throw new Error(`The ${provider.capability} provider does not implement ${method}().`)
  }
  return true
}

export function createIntelligenceProviderRegistry() {
  const providers = new Map()

  const register = (provider) => {
    validateProvider(provider)
    if (providers.has(provider.id)) throw new Error(`An intelligence provider named ${provider.id} is already registered.`)
    providers.set(provider.id, Object.freeze({
      displayName: provider.id,
      offline: provider.processingLocation === 'local',
      requiresExplicitTransfer: provider.processingLocation !== 'local',
      supportedLanguages: [],
      ...provider,
    }))
    return () => providers.delete(provider.id)
  }

  const list = (capability = null) => [...providers.values()]
    .filter((provider) => !capability || provider.capability === capability)
    .map((provider) => ({
      id: provider.id,
      capability: provider.capability,
      displayName: provider.displayName,
      processingLocation: provider.processingLocation,
      offline: Boolean(provider.offline),
      requiresExplicitTransfer: Boolean(provider.requiresExplicitTransfer),
      supportedLanguages: [...(provider.supportedLanguages || [])],
      modelId: provider.modelId || null,
      modelVersion: provider.modelVersion || null,
    }))

  const resolve = (capability, options = {}) => {
    if (!INTELLIGENCE_CAPABILITIES.includes(capability)) {
      throw new IntelligenceProviderError('This intelligence capability is not supported.', 'unsupported')
    }
    const candidates = [...providers.values()].filter((provider) =>
      provider.capability === capability && (!options.providerId || provider.id === options.providerId)
    )
    if (candidates.length === 0) {
      throw new IntelligenceProviderError('No provider is configured for this capability.', 'unavailable')
    }
    const ordered = candidates.sort((left, right) => {
      if (left.processingLocation === right.processingLocation) return left.id.localeCompare(right.id)
      return left.processingLocation === 'local' ? -1 : 1
    })
    let confirmationRequired = null
    for (const provider of ordered) {
      const policy = evaluateProcessingPolicy(options.settings, provider.processingLocation, options)
      if (policy.allowed) return provider
      if (policy.requiresConfirmation) confirmationRequired = policy
    }
    throw new IntelligenceProviderError(
      confirmationRequired?.reason || 'No configured provider is allowed by the current privacy policy.',
      confirmationRequired ? 'permission' : 'unavailable'
    )
  }

  const invoke = async (capability, input, options = {}) => {
    const provider = resolve(capability, options)
    const method = CAPABILITY_METHODS[capability]
    try {
      return await provider[method](input, {
        signal: options.signal,
        language: options.language,
        reportProgress: options.reportProgress,
      })
    } catch (error) {
      if (error?.name === 'AbortError' || options.signal?.aborted) {
        throw new IntelligenceProviderError('The operation was cancelled.', 'cancelled', { cause: error })
      }
      if (error instanceof IntelligenceProviderError) throw error
      const detail = error?.message || (typeof error === 'string' ? error : '')
      throw new IntelligenceProviderError(detail || 'The intelligence provider failed.', 'provider', { cause: error })
    }
  }

  return { register, list, resolve, invoke }
}
