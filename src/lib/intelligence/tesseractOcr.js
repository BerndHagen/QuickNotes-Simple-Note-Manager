import { IntelligenceProviderError } from './providers'

export const TESSERACT_OCR_LANGUAGES = Object.freeze([
  { id: 'eng', language: 'en', label: 'English' },
  { id: 'deu', language: 'de', label: 'German' },
  { id: 'fra', language: 'fr', label: 'French' },
  { id: 'spa', language: 'es', label: 'Spanish' },
  { id: 'por', language: 'pt', label: 'Portuguese' },
  { id: 'ita', language: 'it', label: 'Italian' },
  { id: 'nld', language: 'nl', label: 'Dutch' },
])

const languageDescriptor = (id) => TESSERACT_OCR_LANGUAGES.find((candidate) => candidate.id === id)

const DEFAULT_OCR_TIMEOUT_MS = 2 * 60 * 1000

const waitWithDeadline = (promise, { signal, timeoutMs, message }) => new Promise((resolve, reject) => {
  let settled = false
  const finish = (callback, value) => {
    if (settled) return
    settled = true
    clearTimeout(timeoutId)
    signal?.removeEventListener('abort', abort)
    callback(value)
  }
  const abort = () => finish(reject, new DOMException('Cancelled', 'AbortError'))
  const timeoutId = setTimeout(
    () => finish(reject, new IntelligenceProviderError(message, 'timeout')),
    timeoutMs
  )
  signal?.addEventListener('abort', abort, { once: true })
  promise.then(
    (value) => finish(resolve, value),
    (error) => finish(reject, error)
  )
  if (signal?.aborted) abort()
})

const defaultWorkerFactory = async (language, options) => {
  const { createWorker, OEM } = await import('tesseract.js')
  const runtimeRoot = new URL(`${import.meta.env.BASE_URL}vendor/tesseract/`, globalThis.location?.origin || 'http://localhost').href
  return createWorker(language, OEM.LSTM_ONLY, {
    workerPath: `${runtimeRoot}worker.min.js`,
    corePath: runtimeRoot,
    ...options,
  })
}

export const createTesseractOcrProvider = ({
  workerFactory = defaultWorkerFactory,
  timeoutMs = DEFAULT_OCR_TIMEOUT_MS,
} = {}) => ({
  id: 'tesseract-local-ocr',
  displayName: 'Tesseract local OCR',
  capability: 'ocr',
  processingLocation: 'local',
  offline: true,
  requiresExplicitTransfer: false,
  supportedLanguages: TESSERACT_OCR_LANGUAGES.map((language) => language.language),
  modelId: 'tesseract-lstm',
  modelVersion: '6',

  async recognizeImage(image, { signal, language = 'eng', reportProgress } = {}) {
    if (!image) throw new IntelligenceProviderError('A source image is required for OCR.', 'input')
    const selectedLanguage = languageDescriptor(language)
    if (!selectedLanguage) throw new IntelligenceProviderError('This OCR language is not supported.', 'unsupported')
    if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError')

    let worker = null
    let createdWorker = null
    let workerAbandoned = false
    let terminated = false
    const terminate = async () => {
      const activeWorker = worker || createdWorker
      if (!activeWorker || terminated) return
      terminated = true
      await activeWorker.terminate()
    }
    const abort = () => { void terminate() }
    signal?.addEventListener('abort', abort, { once: true })

    try {
      const workerPromise = Promise.resolve(workerFactory(language, {
        logger: (message) => {
          if (message?.status === 'recognizing text' && Number.isFinite(message.progress)) {
            void reportProgress?.(message.progress)
          }
        },
      })).then((candidate) => {
        createdWorker = candidate
        if (workerAbandoned) void terminate()
        return candidate
      })
      try {
        worker = await waitWithDeadline(workerPromise, {
          signal,
          timeoutMs,
          message: 'Local OCR could not start within two minutes. Try again after checking storage and network access for the language model.',
        })
      } catch (error) {
        workerAbandoned = true
        await terminate()
        throw error
      }
      if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError')
      const result = await waitWithDeadline(worker.recognize(image), {
        signal,
        timeoutMs,
        message: 'Local OCR did not finish within two minutes. Try a smaller or clearer image.',
      })
      if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError')
      const text = String(result?.data?.text || '').replace(/\r\n?/gu, '\n').trim()
      return {
        text,
        confidence: Number.isFinite(result?.data?.confidence)
          ? Math.max(0, Math.min(1, result.data.confidence / 100))
          : null,
        language: selectedLanguage.language,
      }
    } finally {
      signal?.removeEventListener('abort', abort)
      await terminate()
    }
  },
})
