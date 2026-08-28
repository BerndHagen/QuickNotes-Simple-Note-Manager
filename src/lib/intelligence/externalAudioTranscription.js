import { backend, isBackendConfigured } from '../backend'
import { syncCaptureCloud } from '../capture/cloud'
import { IntelligenceProviderError } from './providers'

export const AUDIO_FILE_TRANSCRIPTION_PROVIDER_ID = 'openai-whisper-file-v1'
export const AUDIO_FILE_TRANSCRIPTION_MODEL_ID = 'whisper-1'
export const AUDIO_FILE_TRANSCRIPTION_MODEL_VERSION = 'provider-managed-alias'
export const AUDIO_FILE_TRANSCRIPTION_MAX_BYTES = 24 * 1024 * 1024

const unavailable = (reason = 'Audio-file transcription is not configured for this deployment.') => ({
  available: false,
  providerId: AUDIO_FILE_TRANSCRIPTION_PROVIDER_ID,
  modelId: AUDIO_FILE_TRANSCRIPTION_MODEL_ID,
  modelVersion: AUDIO_FILE_TRANSCRIPTION_MODEL_VERSION,
  processingLocation: 'external',
  maxBytes: AUDIO_FILE_TRANSCRIPTION_MAX_BYTES,
  reason,
})

const safeFunctionError = async (error) => {
  try {
    const payload = await error?.context?.json?.()
    const code = payload?.error
    if (code === 'rate_limited') return new IntelligenceProviderError('The transcription limit has been reached. Try again later.', 'rate_limit')
    if (code === 'source_too_large') return new IntelligenceProviderError('This audio file exceeds the configured 24 MB transcription limit.', 'input')
    if (code === 'source_unavailable') return new IntelligenceProviderError('The synced source audio is no longer available.', 'input')
    if (code === 'source_changed') return new IntelligenceProviderError('The source audio changed before transcription completed.', 'stale')
    if (code === 'provider_timeout') return new IntelligenceProviderError('The transcription provider timed out. The job can be retried.', 'timeout')
    if (code === 'provider_unavailable') return new IntelligenceProviderError('Audio-file transcription is not currently configured.', 'unavailable')
  } catch {
    // The function client may not expose a structured response for network failures.
  }
  return new IntelligenceProviderError('Audio-file transcription failed. The source audio was not changed.', 'provider')
}

const validateCapability = (data) => {
  if (!data || data.providerId !== AUDIO_FILE_TRANSCRIPTION_PROVIDER_ID || data.modelId !== AUDIO_FILE_TRANSCRIPTION_MODEL_ID) {
    return unavailable()
  }
  const maxBytes = Math.min(AUDIO_FILE_TRANSCRIPTION_MAX_BYTES, Math.max(1, Number(data.maxBytes) || AUDIO_FILE_TRANSCRIPTION_MAX_BYTES))
  return {
    available: data.available === true,
    providerId: AUDIO_FILE_TRANSCRIPTION_PROVIDER_ID,
    modelId: AUDIO_FILE_TRANSCRIPTION_MODEL_ID,
    modelVersion: String(data.modelVersion || AUDIO_FILE_TRANSCRIPTION_MODEL_VERSION).slice(0, 160),
    processingLocation: 'external',
    maxBytes,
    reason: data.available === true ? null : String(data.reason || unavailable().reason).slice(0, 240),
  }
}

export async function getAudioFileTranscriptionAvailability(options = {}) {
  const client = options.client || backend
  if (!isBackendConfigured() && !options.client) return unavailable('Connect a QuickNotes cloud account to use audio-file transcription.')
  const { data: userData, error: userError } = await client.auth.getUser()
  if (userError || !userData?.user) return unavailable('Sign in to a QuickNotes cloud account to use audio-file transcription.')
  const { data, error } = await client.functions.invoke('transcribe-audio', {
    body: { action: 'capability' },
    signal: options.signal,
  })
  if (error) return unavailable()
  return validateCapability(data)
}

const normalizeSegments = (values) => {
  if (!Array.isArray(values) || values.length === 0 || values.length > 2_000) {
    throw new IntelligenceProviderError('The transcription provider returned an invalid segment list.', 'provider')
  }
  let characterCount = 0
  return values.map((value) => {
    const text = String(value?.text || '').trim()
    characterCount += text.length
    const startMs = Math.max(0, Math.round(Number(value?.startMs)))
    const endMs = Math.max(startMs, Math.round(Number(value?.endMs)))
    if (!text || characterCount > 200_000 || !Number.isFinite(startMs) || !Number.isFinite(endMs)) {
      throw new IntelligenceProviderError('The transcription provider returned invalid timestamped text.', 'provider')
    }
    return { text, startMs, endMs }
  })
}

export function createExternalAudioTranscriptionProvider(options = {}) {
  const syncCapture = options.syncCapture || syncCaptureCloud
  return {
    id: AUDIO_FILE_TRANSCRIPTION_PROVIDER_ID,
    displayName: 'QuickNotes audio-file transcription',
    capability: 'transcription',
    processingLocation: 'external',
    offline: false,
    requiresExplicitTransfer: true,
    modelId: AUDIO_FILE_TRANSCRIPTION_MODEL_ID,
    modelVersion: AUDIO_FILE_TRANSCRIPTION_MODEL_VERSION,
    async transcribe(input, context = {}) {
      const client = options.client || backend
      if (!input?.ownerId || !input.noteId || !input.resourceId || !input.sourceFingerprint) {
        throw new IntelligenceProviderError('The transcription request is missing its canonical source identity.', 'input')
      }
      context.reportProgress?.(0.08)
      await syncCapture(input.ownerId)
      if (context.signal?.aborted) throw new DOMException('Cancelled', 'AbortError')
      context.reportProgress?.(0.18)
      const { data, error } = await client.functions.invoke('transcribe-audio', {
        body: {
          action: 'transcribe',
          noteId: input.noteId,
          resourceId: input.resourceId,
          language: context.language || null,
        },
        signal: context.signal,
      })
      if (context.signal?.aborted) throw new DOMException('Cancelled', 'AbortError')
      if (error) throw await safeFunctionError(error)
      if (
        data?.providerId !== AUDIO_FILE_TRANSCRIPTION_PROVIDER_ID ||
        data?.modelId !== AUDIO_FILE_TRANSCRIPTION_MODEL_ID ||
        data?.processingLocation !== 'external' ||
        data?.sourceFingerprint !== input.sourceFingerprint
      ) {
        throw new IntelligenceProviderError('The transcription result does not match the canonical source.', 'stale')
      }
      const segments = normalizeSegments(data.segments)
      context.reportProgress?.(0.92)
      return {
        segments,
        language: typeof data.language === 'string' ? data.language.slice(0, 35) : null,
        durationMs: data.durationMs == null ? null : Math.max(0, Number(data.durationMs) || 0),
      }
    },
  }
}
