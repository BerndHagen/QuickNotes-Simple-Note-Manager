import { describe, expect, it } from 'vitest'
import { buildPdfExportElement, escapePdfFilename, getPdfPageHeight } from './pdfExport'

describe('PDF export document', () => {
  it('reuses the note paper and rich content presentation without executable HTML', () => {
    const root = buildPdfExportElement([{
      title: 'Release brief',
      content: '<h2>Summary</h2><img src="data:image/png;base64,AA==" onerror="alert(1)"><p>Ready</p>',
      tags: ['work'],
      noteData: { paperType: 'grid' },
      createdAt: '2026-08-20T08:00:00.000Z',
      updatedAt: '2026-08-20T09:00:00.000Z',
    }])

    const page = root.querySelector('.qn-pdf-note')
    expect(page).toHaveClass('paper-grid')
    expect(page).toHaveAttribute('data-paper-type', 'grid')
    expect(page.style.backgroundImage).toContain('linear-gradient')
    expect(root.querySelector('h1')).toHaveTextContent('Release brief')
    expect(root.querySelector('.ProseMirror h2')).toHaveTextContent('Summary')
    expect(root.querySelector('img')).not.toHaveAttribute('onerror')
    expect(root.querySelector('.qn-pdf-note__tags')).toHaveTextContent('#work')
  })

  it('creates a safe downloadable PDF filename', () => {
    expect(escapePdfFilename('Q3 plan / review')).toBe('Q3_plan_review.pdf')
    expect(escapePdfFilename('')).toBe('QuickNotes_note.pdf')
  })

  it('keeps a rendered single A4 page on one PDF page', () => {
    expect(getPdfPageHeight(794)).toBe(1123)
    expect(getPdfPageHeight(1588)).toBe(2246)
  })
})
