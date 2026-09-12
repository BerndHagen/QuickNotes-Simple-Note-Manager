import { describe, expect, it } from 'vitest'
import {
  A4_RATIO,
  PAGE_GAP,
  getDocumentPageCount,
  getDocumentPageGeometry,
  getDocumentPageTop,
} from './pageGeometry'

describe('document page geometry', () => {
  it('uses one shared A4 height and page-gap calculation', () => {
    const geometry = getDocumentPageGeometry({ pageWidth: 794, pageCount: 3 })

    expect(geometry.pageHeight).toBe(794 * A4_RATIO)
    expect(geometry.pageGap).toBe(PAGE_GAP)
    expect(geometry.totalHeight).toBe((3 * geometry.pageHeight) + (2 * PAGE_GAP))
    expect(getDocumentPageTop(2, geometry)).toBe(2 * (geometry.pageHeight + PAGE_GAP))
  })

  it('accounts for both declared and rendered page boundaries', () => {
    const editor = document.createElement('div')
    editor.dataset.pageCount = '2'
    editor.innerHTML = '<span class="qn-page-gap"></span><span class="qn-page-gap"></span>'

    expect(getDocumentPageCount(editor)).toBe(3)
  })
})
