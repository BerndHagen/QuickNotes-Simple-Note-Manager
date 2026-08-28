import { IntelligenceProviderError } from './providers'

const alreadyRunning = (error) => error?.name === 'InvalidStateError'

export const isBrowserSpeechRecognitionSupported = () => (
  typeof window !== 'undefined' &&
  typeof (window.SpeechRecognition || window.webkitSpeechRecognition) === 'function'
)

export function createBrowserSpeechSession(input = {}, context = {}) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!SpeechRecognition) {
    throw new IntelligenceProviderError('Browser speech recognition is not available on this device.', 'unsupported')
  }
  const recognition = new SpeechRecognition()
  recognition.continuous = true
  recognition.interimResults = true
  recognition.lang = context.language || navigator.language || 'en'
  let active = true
  let paused = false
  let listening = false
  let failed = false
  let segmentStartMs = Math.max(0, Number(input.getElapsedMs?.()) || 0)
  let stopResolver = null

  const startRecognizer = () => {
    if (!active || paused || listening) return
    try {
      recognition.start()
    } catch (error) {
      if (!alreadyRunning(error)) throw error
    }
  }

  recognition.onstart = () => {
    listening = true
    failed = false
    input.onStatus?.('listening')
  }
  recognition.onresult = (event) => {
    let interim = ''
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const result = event.results[index]
      const text = String(result?.[0]?.transcript || '').trim()
      if (!text) continue
      if (result.isFinal) {
        const endMs = Math.max(segmentStartMs, Number(input.getElapsedMs?.()) || segmentStartMs)
        input.onSegment?.({
          text,
          startMs: segmentStartMs,
          endMs,
          confidence: Number.isFinite(result[0].confidence) ? result[0].confidence : null,
        })
        segmentStartMs = endMs
      } else {
        interim += `${interim ? ' ' : ''}${text}`
      }
    }
    input.onInterim?.(interim)
  }
  recognition.onerror = (event) => {
    if (event.error === 'aborted' || event.error === 'no-speech') return
    failed = true
    paused = true
    input.onError?.(new IntelligenceProviderError(
      event.error === 'not-allowed' || event.error === 'service-not-allowed'
        ? 'Browser speech recognition permission was denied.'
        : `Browser speech recognition failed: ${event.error || 'unknown error'}`,
      event.error === 'not-allowed' || event.error === 'service-not-allowed' ? 'permission' : 'provider'
    ))
  }
  recognition.onend = () => {
    listening = false
    input.onInterim?.('')
    if (active && !paused && !failed) {
      startRecognizer()
      return
    }
    stopResolver?.()
    stopResolver = null
    input.onStatus?.(paused ? 'paused' : 'stopped')
  }

  const onAbort = () => {
    active = false
    paused = true
    try { recognition.abort() } catch { /* Session already ended. */ }
  }
  context.signal?.addEventListener('abort', onAbort, { once: true })
  startRecognizer()

  return {
    language: recognition.lang,
    pause() {
      if (!active || paused) return
      paused = true
      try { recognition.stop() } catch (error) { if (!alreadyRunning(error)) throw error }
    },
    resume() {
      if (!active || !paused) return
      paused = false
      failed = false
      segmentStartMs = Math.max(segmentStartMs, Number(input.getElapsedMs?.()) || segmentStartMs)
      startRecognizer()
    },
    stop() {
      if (!active) return Promise.resolve()
      active = false
      paused = false
      context.signal?.removeEventListener('abort', onAbort)
      if (!listening) return Promise.resolve()
      return new Promise((resolve) => {
        stopResolver = resolve
        try {
          recognition.stop()
        } catch (error) {
          stopResolver = null
          if (!alreadyRunning(error)) input.onError?.(error)
          resolve()
        }
      })
    },
    abort: onAbort,
  }
}

export const createBrowserSpeechProvider = () => ({
  id: 'browser-speech-live-v1',
  displayName: 'Browser live speech recognition',
  capability: 'transcription',
  processingLocation: 'browserManaged',
  offline: false,
  requiresExplicitTransfer: true,
  modelId: 'browser-speech-recognition',
  modelVersion: 'platform-managed',
  transcribe: createBrowserSpeechSession,
})
