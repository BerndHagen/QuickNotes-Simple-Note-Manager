import { describe, expect, it, vi } from 'vitest'
import { createPdfTextProvider, textFromPdfItems } from './pdfText'

const pdfBlob = () => new Blob(['%PDF'], { type: 'application/pdf' })

describe('local PDF text extraction', () => {
  it('preserves line boundaries from native PDF text items', () => {
    expect(textFromPdfItems([
      { str: 'Project', hasEOL: false },
      { str: 'plan', hasEOL: true },
      { str: 'Ship Friday', hasEOL: false },
    ])).toBe('Project plan\nShip Friday')
  })

  it('extracts native text first and only OCRs pages without useful text', async () => {
    const pages = [
      { getTextContent: vi.fn(async () => ({ items: [{ str: 'Selectable contract text', hasEOL: false }] })), cleanup: vi.fn() },
      {
        getTextContent: vi.fn(async () => ({ items: [] })),
        getViewport: vi.fn(() => ({ width: 600, height: 800 })),
        render: vi.fn(() => ({ promise: Promise.resolve(), cancel: vi.fn() })),
        cleanup: vi.fn(),
      },
    ]
    const pdf = { numPages: 2, getPage: vi.fn(async (number) => pages[number - 1]), destroy: vi.fn() }
    const recognizeScannedPage = vi.fn(async () => ({ text: 'Scanned receipt 4287', confidence: 0.8, language: 'en' }))
    const provider = createPdfTextProvider({
      documentLoader: vi.fn(async () => pdf),
      canvasFactory: () => ({ getContext: () => ({}) }),
    })

    await expect(provider.extractText({
      blob: pdfBlob(),
      ocrScannedPages: true,
      recognizeScannedPage,
    })).resolves.toMatchObject({
      pageCount: 2,
      nativePageCount: 1,
      ocrPageCount: 1,
      pages: [
        { pageNumber: 1, recognitionType: 'pdfText', text: 'Selectable contract text' },
        { pageNumber: 2, recognitionType: 'ocr', text: 'Scanned receipt 4287' },
      ],
    })
    expect(recognizeScannedPage).toHaveBeenCalledOnce()
    expect(pdf.destroy).toHaveBeenCalledOnce()
  })
})

