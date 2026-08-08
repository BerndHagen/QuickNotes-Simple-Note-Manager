import { describe, expect, it } from 'vitest'
import { EDITOR_FONT_FAMILIES, EDITOR_FONT_GROUPS } from './editorFonts'

describe('editor font catalogue', () => {
  it('provides a broad, grouped, unambiguous set of bundled families', () => {
    expect(EDITOR_FONT_FAMILIES).toHaveLength(39)
    expect(EDITOR_FONT_GROUPS.map((group) => group.name)).toEqual([
      'System',
      'Sans Serif',
      'Serif',
      'Monospace',
    ])
    expect(new Set(EDITOR_FONT_FAMILIES.map((font) => font.name)).size).toBe(39)
    expect(new Set(EDITOR_FONT_FAMILIES.map((font) => font.value)).size).toBe(39)
    expect(EDITOR_FONT_FAMILIES.every((font) => !font.name.includes('/'))).toBe(true)
  })
})
