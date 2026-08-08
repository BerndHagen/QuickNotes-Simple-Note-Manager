export const DEFAULT_EDITOR_FONT =
  'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

/**
 * Curated stacks whose fallback is in the same visual category on Windows,
 * macOS, iOS, Android, and Linux. Stored note HTML may still render any
 * previously chosen font; this list only controls new selections.
 */
export const EDITOR_FONT_FAMILIES = [
  { name: 'System sans', value: DEFAULT_EDITOR_FONT },
  { name: 'Arial / Helvetica', value: 'Arial, Helvetica, sans-serif' },
  { name: 'Trebuchet', value: '"Trebuchet MS", Trebuchet, sans-serif' },
  { name: 'Verdana / Geneva', value: 'Verdana, Geneva, sans-serif' },
  { name: 'Georgia', value: 'Georgia, "Times New Roman", serif' },
  { name: 'Times', value: '"Times New Roman", Times, serif' },
  {
    name: 'System monospace',
    value: 'ui-monospace, "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
  },
]
