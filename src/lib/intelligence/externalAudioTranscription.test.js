import { describe, expect, it, vi } from 'vitest'
import {
  AUDIO_FILE_TRANSCRIPTION_PROVIDER_ID,
  createExternalAudioTranscriptionProvider,
  getAudioFileTranscriptionAvailability,
} from './externalAudioTranscription'

const client = (responses) => ({
  auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'owner-a' } }, error: null })) },
  functions: { invoke: vi.fn(async () => responses.shift()) },
})

describe('external audio-file transcription provider', () => {
  it('exposes only a provider capability validated by the authenticated server', async () => {
    const fake = client([{ data: {
      available: true,
      providerId: AUDIO_FILE_TRANSCRIPTION_PROVIDER_ID,
      modelId: 'whisper-1',
      modelVersion: 'provider-managed-alias',
      processingLocation: 'external',
      maxBytes: 24 * 1024 * 1024,
    }, error: null }])

    await expect(getAudioFileTranscriptionAvailability({ client: fake })).resolves.toMatchObject({
      available: true,
      processingLocation: 'external',
      maxBytes: 24 * 1024 * 1024,
    })
    expect(fake.functions.invoke).toHaveBeenCalledWith('transcribe-audio', expect.objectContaining({
      body: { action: 'capability' },
    }))
  })

  it('syncs the canonical resource before sending only its identity to the Edge Function', async () => {
    const fake = client([{ data: {
      providerId: AUDIO_FILE_TRANSCRIPTION_PROVIDER_ID,
      modelId: 'whisper-1',
      modelVersion: 'provider-managed-alias',
      processingLocation: 'external',
      sourceFingerprint: 'sha256:source',
      language: 'en',
      durationMs: 4_000,
      segments: [{ text: 'Release on Friday', startMs: 500, endMs: 2_500 }],
    }, error: null }])
    const syncCapture = vi.fn(async () => ({ skipped: false }))
    const provider = createExternalAudioTranscriptionProvider({ client: fake, syncCapture })
    const progress = vi.fn()

    const result = await provider.transcribe({
      ownerId: 'owner-a',
      noteId: 'note-a',
      resourceId: 'audio-a',
      sourceFingerprint: 'sha256:source',
    }, { language: 'en', reportProgress: progress })

    expect(syncCapture).toHaveBeenCalledWith('owner-a')
    expect(fake.functions.invoke).toHaveBeenCalledWith('transcribe-audio', expect.objectContaining({
      body: { action: 'transcribe', noteId: 'note-a', resourceId: 'audio-a', language: 'en' },
    }))
    expect(fake.functions.invoke.mock.calls[0][1].body).not.toHaveProperty('blob')
    expect(result).toMatchObject({
      durationMs: 4_000,
      segments: [{ text: 'Release on Friday', startMs: 500, endMs: 2_500 }],
    })
    expect(progress.mock.calls.map(([value]) => value)).toEqual([0.08, 0.18, 0.92])
  })

  it('rejects a result whose source fingerprint no longer matches', async () => {
    const fake = client([{ data: {
      providerId: AUDIO_FILE_TRANSCRIPTION_PROVIDER_ID,
      modelId: 'whisper-1',
      processingLocation: 'external',
      sourceFingerprint: 'sha256:different',
      segments: [{ text: 'Wrong source', startMs: 0, endMs: 1_000 }],
    }, error: null }])
    const provider = createExternalAudioTranscriptionProvider({ client: fake, syncCapture: vi.fn() })
    await expect(provider.transcribe({
      ownerId: 'owner-a', noteId: 'note-a', resourceId: 'audio-a', sourceFingerprint: 'sha256:source',
    })).rejects.toMatchObject({ code: 'stale' })
  })
})
