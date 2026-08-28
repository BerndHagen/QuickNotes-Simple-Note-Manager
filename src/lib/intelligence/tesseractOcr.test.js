import { describe, expect, it, vi } from 'vitest'
import { createTesseractOcrProvider } from './tesseractOcr'

describe('Tesseract local OCR provider', () => {
  it('normalizes text/confidence and always terminates its worker', async () => {
    const terminate = vi.fn(async () => {})
    const recognize = vi.fn(async () => ({ data: { text: ' Printed text\r\n', confidence: 87 } }))
    const workerFactory = vi.fn(async (_language, options) => {
      options.logger({ status: 'recognizing text', progress: 0.4 })
      return { recognize, terminate }
    })
    const reportProgress = vi.fn()
    const provider = createTesseractOcrProvider({ workerFactory })

    await expect(provider.recognizeImage('data:image/png;base64,AAAA', {
      language: 'eng',
      reportProgress,
    })).resolves.toEqual({ text: 'Printed text', confidence: 0.87, language: 'en' })
    expect(reportProgress).toHaveBeenCalledWith(0.4)
    expect(terminate).toHaveBeenCalledOnce()
  })

  it('terminates active recognition when cancelled', async () => {
    const controller = new AbortController()
    let rejectRecognition
    const terminate = vi.fn(async () => rejectRecognition?.(new DOMException('Cancelled', 'AbortError')))
    const workerFactory = vi.fn(async () => ({
      recognize: () => new Promise((_resolve, reject) => { rejectRecognition = reject }),
      terminate,
    }))
    const provider = createTesseractOcrProvider({ workerFactory })
    const pending = provider.recognizeImage('data:image/png;base64,AAAA', {
      language: 'eng',
      signal: controller.signal,
    })
    await Promise.resolve()
    controller.abort()

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    await vi.waitFor(() => expect(terminate).toHaveBeenCalledOnce())
  })

  it('fails a stalled worker startup and terminates it if it eventually arrives', async () => {
    vi.useFakeTimers()
    const terminate = vi.fn()
    let finishStartup
    const provider = createTesseractOcrProvider({
      timeoutMs: 25,
      workerFactory: () => new Promise((resolve) => { finishStartup = () => resolve({ terminate }) }),
    })

    try {
      const recognition = provider.recognizeImage('data:image/png;base64,AAAA')
      const expectation = expect(recognition).rejects.toMatchObject({ code: 'timeout' })
      await vi.advanceTimersByTimeAsync(25)
      await expectation

      finishStartup()
      await Promise.resolve()
      expect(terminate).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })
})
