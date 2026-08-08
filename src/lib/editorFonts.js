export const DEFAULT_EDITOR_FONT =
  'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

/**
 * Bundled families render consistently across operating systems. Labels name
 * one family only; fallback categories stay internal and never masquerade as
 * a second selectable font.
 */
export const EDITOR_FONT_GROUPS = [
  {
    name: 'System',
    fonts: [
      { name: 'System Sans', value: DEFAULT_EDITOR_FONT },
    ],
  },
  {
    name: 'Sans Serif',
    fonts: [
      { name: 'Atkinson Hyperlegible', value: '"Atkinson Hyperlegible", sans-serif' },
      { name: 'Cabin', value: 'Cabin, sans-serif' },
      { name: 'DM Sans', value: '"DM Sans", sans-serif' },
      { name: 'Fira Sans', value: '"Fira Sans", sans-serif' },
      { name: 'IBM Plex Sans', value: '"IBM Plex Sans", sans-serif' },
      { name: 'Inter', value: 'Inter, sans-serif' },
      { name: 'Karla', value: 'Karla, sans-serif' },
      { name: 'Lato', value: 'Lato, sans-serif' },
      { name: 'Lexend', value: 'Lexend, sans-serif' },
      { name: 'Manrope', value: 'Manrope, sans-serif' },
      { name: 'Montserrat', value: 'Montserrat, sans-serif' },
      { name: 'Noto Sans', value: '"Noto Sans", sans-serif' },
      { name: 'Nunito Sans', value: '"Nunito Sans", sans-serif' },
      { name: 'Open Sans', value: '"Open Sans", sans-serif' },
      { name: 'Poppins', value: 'Poppins, sans-serif' },
      { name: 'PT Sans', value: '"PT Sans", sans-serif' },
      { name: 'Raleway', value: 'Raleway, sans-serif' },
      { name: 'Roboto', value: 'Roboto, sans-serif' },
      { name: 'Source Sans 3', value: '"Source Sans 3", sans-serif' },
      { name: 'Ubuntu', value: 'Ubuntu, sans-serif' },
      { name: 'Work Sans', value: '"Work Sans", sans-serif' },
    ],
  },
  {
    name: 'Serif',
    fonts: [
      { name: 'Bitter', value: 'Bitter, serif' },
      { name: 'Crimson Pro', value: '"Crimson Pro", serif' },
      { name: 'IBM Plex Serif', value: '"IBM Plex Serif", serif' },
      { name: 'Libre Baskerville', value: '"Libre Baskerville", serif' },
      { name: 'Lora', value: 'Lora, serif' },
      { name: 'Merriweather', value: 'Merriweather, serif' },
      { name: 'Noto Serif', value: '"Noto Serif", serif' },
      { name: 'Playfair Display', value: '"Playfair Display", serif' },
      { name: 'PT Serif', value: '"PT Serif", serif' },
      { name: 'Roboto Slab', value: '"Roboto Slab", serif' },
      { name: 'Source Serif 4', value: '"Source Serif 4", serif' },
    ],
  },
  {
    name: 'Monospace',
    fonts: [
      { name: 'Fira Code', value: '"Fira Code", monospace' },
      { name: 'IBM Plex Mono', value: '"IBM Plex Mono", monospace' },
      { name: 'JetBrains Mono', value: '"JetBrains Mono", monospace' },
      { name: 'Roboto Mono', value: '"Roboto Mono", monospace' },
      { name: 'Source Code Pro', value: '"Source Code Pro", monospace' },
      { name: 'Space Mono', value: '"Space Mono", monospace' },
    ],
  },
]

export const EDITOR_FONT_FAMILIES = EDITOR_FONT_GROUPS.flatMap((group) =>
  group.fonts.map((font) => ({ ...font, category: group.name }))
)
