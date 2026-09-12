import { describe, expect, it } from 'vitest'
import { getBundledEditorFontNamesInHtml } from './editorFontLoader'

describe('editor font loading', () => {
  it('detects only bundled families referenced by persisted document HTML', () => {
    expect(getBundledEditorFontNamesInHtml(
      '<p style="font-family: &quot;IBM Plex Serif&quot;, serif">Serif</p><p style="font-family: Lato, sans-serif">Sans</p>'
    )).toEqual(['IBM Plex Serif', 'Lato'])
  })

  it('does not request a bundled font for ordinary content', () => {
    expect(getBundledEditorFontNamesInHtml('<p>System font content</p>')).toEqual([])
  })
})
