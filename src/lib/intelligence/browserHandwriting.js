import { IntelligenceProviderError } from './providers'

const MAX_STROKES = 5_000
const MAX_POINTS = 250_000

const abortError = () => new DOMException('Cancelled', 'AbortError')

const throwIfAborted = (signal) => {
  if (signal?.aborted) throw abortError()
}

const awaitWithAbort = (promise, signal) => {
  if (!signal) return promise
  throwIfAborted(signal)
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(abortError())
    signal.addEventListener('abort', onAbort, { once: true })
    Promise.resolve(promise).then(resolve, reject).finally(() => {
      signal.removeEventListener('abort', onAbort)
    })
  })
}

export const isBrowserHandwritingSupported = () => (
  typeof navigator !== 'undefined' &&
  typeof navigator.queryHandwritingRecognizer === 'function' &&
  typeof navigator.createHandwritingRecognizer === 'function' &&
  typeof globalThis.HandwritingStroke === 'function'
)

const orderedStrokes = (objects) => [...objects].sort((left, right) => (
  String(left.createdAt || '').localeCompare(String(right.createdAt || '')) ||
  Number(left.zIndex || 0) - Number(right.zIndex || 0) ||
  String(left.id).localeCompare(String(right.id))
))

const validateInk = (objects) => {
  if (!Array.isArray(objects) || objects.length === 0 || objects.length > MAX_STROKES) {
    throw new IntelligenceProviderError('Select between 1 and 5,000 ink strokes.', 'input')
  }
  let pointCount = 0
  for (const object of objects) {
    const points = object?.kind === 'stroke' ? object.data?.points : null
    if (!Array.isArray(points) || points.length < 2) {
      throw new IntelligenceProviderError('The selection contains invalid ink.', 'input')
    }
    pointCount += points.length
    if (pointCount > MAX_POINTS) {
      throw new IntelligenceProviderError('The selected ink contains too many points for one recognition operation.', 'input')
    }
  }
}

export async function recognizeWithBrowserHandwriting(objects, options = {}) {
  if (!isBrowserHandwritingSupported()) {
    throw new IntelligenceProviderError('Browser handwriting recognition is not available on this device.', 'unsupported')
  }
  validateInk(objects)
  const signal = options.signal
  const language = String(options.language || navigator.language || 'en').slice(0, 35)
  const constraints = { languages: [language] }
  let recognizer = null
  let drawing = null

  try {
    throwIfAborted(signal)
    const support = await awaitWithAbort(navigator.queryHandwritingRecognizer(constraints), signal)
    if (!support) {
      throw new IntelligenceProviderError(`Handwriting recognition is not available for ${language}.`, 'unsupported')
    }
    options.reportProgress?.(0.08)
    recognizer = await awaitWithAbort(navigator.createHandwritingRecognizer(constraints), signal)
    throwIfAborted(signal)
    drawing = recognizer.startDrawing({
      recognitionType: 'text',
      inputType: 'stylus',
      alternatives: 3,
    })

    const strokes = orderedStrokes(objects)
    let timelineOffset = 0
    for (let index = 0; index < strokes.length; index += 1) {
      throwIfAborted(signal)
      const sourcePoints = strokes[index].data.points
      const stroke = new globalThis.HandwritingStroke()
      const sourceStart = Number(sourcePoints[0][5]) || 0
      let lastTime = timelineOffset
      for (const sourcePoint of sourcePoints) {
        const x = Number(sourcePoint[0])
        const y = Number(sourcePoint[1])
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
          throw new IntelligenceProviderError('The selection contains invalid ink coordinates.', 'input')
        }
        const elapsed = Math.max(0, (Number(sourcePoint[5]) || sourceStart) - sourceStart)
        lastTime = Math.max(lastTime, timelineOffset + elapsed)
        stroke.addPoint({ x, y, t: lastTime })
      }
      drawing.addStroke(stroke)
      timelineOffset = lastTime + 40
      if (index % 10 === 0 || index === strokes.length - 1) {
        options.reportProgress?.(0.1 + 0.55 * ((index + 1) / strokes.length))
      }
    }

    const predictions = await awaitWithAbort(drawing.getPrediction(), signal)
    throwIfAborted(signal)
    const alternatives = (Array.isArray(predictions) ? predictions : [])
      .map((prediction) => String(prediction?.text || '').trim())
      .filter(Boolean)
      .slice(0, 3)
    if (alternatives.length === 0) {
      throw new IntelligenceProviderError('No handwriting could be recognized in the selected strokes.', 'input')
    }
    options.reportProgress?.(0.95)
    return { text: alternatives[0], alternatives, language }
  } finally {
    try {
      await drawing?.finish?.()
    } catch {
      // Cleanup failure must not replace a useful recognition result.
    }
    try {
      recognizer?.finish?.()
    } catch {
      // Cleanup failure must not replace a useful recognition result.
    }
  }
}

export const createBrowserHandwritingProvider = () => ({
  id: 'browser-handwriting-v1',
  displayName: 'Browser handwriting recognition',
  capability: 'handwriting',
  processingLocation: 'browserManaged',
  offline: false,
  requiresExplicitTransfer: true,
  modelId: 'browser-operating-system-handwriting',
  modelVersion: 'platform-managed',
  recognizeInk: recognizeWithBrowserHandwriting,
})
