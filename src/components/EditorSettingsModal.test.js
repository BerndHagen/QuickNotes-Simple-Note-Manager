import { describe, expect, it } from 'vitest'
import { normalizeEditorSettings } from './EditorSettingsModal'

describe('editor ribbon settings', () => {
  it('migrates removed ribbon tabs to their consolidated destinations', () => {
    expect(normalizeEditorSettings({ defaultRibbonTab: 'format' }).defaultRibbonTab).toBe('home')
    expect(normalizeEditorSettings({ defaultRibbonTab: 'tools' }).defaultRibbonTab).toBe('view')
  })

  it('keeps every supported substantial ribbon tab', () => {
    for (const tab of ['home', 'insert', 'layout', 'review', 'view']) {
      expect(normalizeEditorSettings({ defaultRibbonTab: tab }).defaultRibbonTab).toBe(tab)
    }
  })
})
