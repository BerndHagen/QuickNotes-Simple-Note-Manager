import { IntelligenceProviderError } from './providers'

const MAX_RENDER_DIMENSION = 2_400
const MIN_NATIVE_TEXT_CHARACTERS = 8

let pdfModulePromise = null

const loadPdfModule = async () => {
  if (!pdfModulePromise) {
    pdfModulePromise = Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ]).then(([pdfjs, worker]) => {
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default
      return pdfjs
    })
  }
  return pdfModulePromise
}

const defaultDocumentLoader = async (blob) => {
  const pdfjs = await loadPdfModule()
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const task = pdfjs.getDocument({
    data: bytes,
    isEvalSupported: false,
    useWorkerFetch: false,
  })
  return task.promise
}

const defaultCanvasFactory = (width, height) => {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

const throwIfCancelled = (signal) => {
  if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError')
}

const normalizePageNumbers = (values, pageCount) => {
  if (values == null) return Array.from({ length: pageCount }, (_value, index) => index + 1)
  if (!Array.isArray(values) || values.length === 0) throw new IntelligenceProviderError('Select at least one PDF page.', 'input')
  const numbers = [...new Set(values.map(Number))].sort((left, right) => left - right)
  if (numbers.some((page) => !Number.isInteger(page) || page < 1 || page > pageCount)) {
    throw new IntelligenceProviderError('The selected PDF page range is invalid.', 'input')
  }
  return numbers
}

export const textFromPdfItems = (items = []) => {
  const parts = []
  for (const item of items) {
    if (typeof item?.str !== 'string') continue
    const value = item.str.replace(/\s+/gu, ' ').trim()
    if (value) parts.push(value)
    if (item.hasEOL && parts.at(-1) !== '\n') parts.push('\n')
  }
  return parts.join(' ')
    .replace(/\s*\n\s*/gu, '\n')
    .replace(/[ \t]+/gu, ' ')
    .trim()
}

const renderPageForOcr = async (page, { signal, canvasFactory }) => {
  const baseViewport = page.getViewport({ scale: 1 })
  const scale = Math.min(2, MAX_RENDER_DIMENSION / Math.max(baseViewport.width, baseViewport.height))
  const viewport = page.getViewport({ scale: Math.max(1, scale) })
  const width = Math.max(1, Math.ceil(viewport.width))
  const height = Math.max(1, Math.ceil(viewport.height))
  const canvas = canvasFactory(width, height)
  const context = canvas.getContext('2d', { alpha: false })
  if (!context) throw new IntelligenceProviderError('This browser cannot render PDF pages for OCR.', 'unavailable')
  const renderTask = page.render({ canvasContext: context, viewport })
  const cancel = () => renderTask.cancel()
  signal?.addEventListener('abort', cancel, { once: true })
  try {
    await renderTask.promise
    throwIfCancelled(signal)
    return canvas
  } finally {
    signal?.removeEventListener('abort', cancel)
  }
}

export const createPdfTextProvider = ({
  documentLoader = defaultDocumentLoader,
  canvasFactory = defaultCanvasFactory,
} = {}) => ({
  id: 'pdfjs-local-text',
  displayName: 'PDF.js local text extraction',
  capability: 'pdfText',
  processingLocation: 'local',
  offline: true,
  requiresExplicitTransfer: false,
  modelId: 'pdfjs',
  modelVersion: '5',

  async extractText(input, { signal, reportProgress } = {}) {
    const blob = input?.blob
    if (!(blob instanceof Blob) || blob.type !== 'application/pdf') {
      throw new IntelligenceProviderError('A valid PDF source is required.', 'input')
    }
    throwIfCancelled(signal)
    let pdf = null
    try {
      pdf = await documentLoader(blob)
      throwIfCancelled(signal)
      const pageNumbers = normalizePageNumbers(input.pageNumbers, pdf.numPages)
      const pages = []
      for (let index = 0; index < pageNumbers.length; index += 1) {
        throwIfCancelled(signal)
        const pageNumber = pageNumbers[index]
        const page = await pdf.getPage(pageNumber)
        const textContent = await page.getTextContent()
        const nativeText = textFromPdfItems(textContent.items)
        const hasNativeText = nativeText.replace(/\s/gu, '').length >= MIN_NATIVE_TEXT_CHARACTERS
        let result = {
          pageNumber,
          text: nativeText,
          recognitionType: 'pdfText',
          confidence: hasNativeText ? 1 : null,
          language: null,
        }
        if (!hasNativeText && input.ocrScannedPages && typeof input.recognizeScannedPage === 'function') {
          const canvas = await renderPageForOcr(page, { signal, canvasFactory })
          const ocr = await input.recognizeScannedPage(canvas, pageNumber, (progress) => (
            reportProgress?.((index + Math.max(0, Math.min(1, Number(progress) || 0))) / pageNumbers.length)
          ))
          result = {
            pageNumber,
            text: String(ocr?.text || '').trim(),
            recognitionType: 'ocr',
            confidence: Number.isFinite(ocr?.confidence) ? ocr.confidence : null,
            language: ocr?.language || null,
          }
        }
        if (result.text) pages.push(result)
        page.cleanup?.()
        await reportProgress?.((index + 1) / pageNumbers.length)
      }
      return {
        pageCount: pdf.numPages,
        pages,
        nativePageCount: pages.filter((page) => page.recognitionType === 'pdfText').length,
        ocrPageCount: pages.filter((page) => page.recognitionType === 'ocr').length,
      }
    } catch (error) {
      if (error?.name === 'AbortError' || signal?.aborted) throw error
      if (error instanceof IntelligenceProviderError) throw error
      if (error?.name === 'PasswordException') {
        throw new IntelligenceProviderError('Password-protected PDFs are not supported yet.', 'unsupported', { cause: error })
      }
      throw new IntelligenceProviderError(error?.message || 'The PDF could not be read.', 'provider', { cause: error })
    } finally {
      await pdf?.destroy?.()
    }
  },
})

export async function openPdfPreview(blob) {
  if (!(blob instanceof Blob) || blob.type !== 'application/pdf') throw new Error('A valid PDF is required.')
  return defaultDocumentLoader(blob)
}

export async function renderPdfPreviewPage(pdf, pageNumber, canvas, maximumWidth = 900, signal = null) {
  const page = await pdf.getPage(pageNumber)
  const base = page.getViewport({ scale: 1 })
  const scale = Math.min(2, Math.max(0.5, maximumWidth / base.width))
  const viewport = page.getViewport({ scale })
  const ratio = Math.min(2, globalThis.devicePixelRatio || 1)
  const rendered = document.createElement('canvas')
  rendered.width = Math.ceil(viewport.width * ratio)
  rendered.height = Math.ceil(viewport.height * ratio)
  const context = rendered.getContext('2d', { alpha: false })
  const renderTask = page.render({ canvasContext: context, viewport, transform: ratio === 1 ? null : [ratio, 0, 0, ratio, 0, 0] })
  const cancel = () => renderTask.cancel()
  signal?.addEventListener('abort', cancel, { once: true })
  try {
    await renderTask.promise
    if (signal?.aborted) throw new DOMException('PDF preview rendering was cancelled.', 'AbortError')
    canvas.width = rendered.width
    canvas.height = rendered.height
    canvas.style.width = `${Math.ceil(viewport.width)}px`
    canvas.style.height = `${Math.ceil(viewport.height)}px`
    canvas.getContext('2d', { alpha: false }).drawImage(rendered, 0, 0)
  } catch (error) {
    if (signal?.aborted) throw new DOMException('PDF preview rendering was cancelled.', 'AbortError')
    throw error
  } finally {
    signal?.removeEventListener('abort', cancel)
    page.cleanup?.()
  }
  return {
    logicalWidth: base.width,
    logicalHeight: base.height,
    displayWidth: Math.ceil(viewport.width),
    displayHeight: Math.ceil(viewport.height),
  }
}
