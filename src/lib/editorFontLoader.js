import { DEFAULT_EDITOR_FONT, EDITOR_FONT_FAMILIES } from './editorFonts'

const FONT_LOADERS = new Map([
  ['Atkinson Hyperlegible', () => Promise.all([import('@fontsource/atkinson-hyperlegible/latin-400.css'), import('@fontsource/atkinson-hyperlegible/latin-700.css')])],
  ['Bitter', () => Promise.all([import('@fontsource/bitter/latin-400.css'), import('@fontsource/bitter/latin-700.css')])],
  ['Cabin', () => Promise.all([import('@fontsource/cabin/latin-400.css'), import('@fontsource/cabin/latin-700.css')])],
  ['Crimson Pro', () => Promise.all([import('@fontsource/crimson-pro/latin-400.css'), import('@fontsource/crimson-pro/latin-700.css')])],
  ['DM Sans', () => Promise.all([import('@fontsource/dm-sans/latin-400.css'), import('@fontsource/dm-sans/latin-700.css')])],
  ['Fira Code', () => Promise.all([import('@fontsource/fira-code/latin-400.css'), import('@fontsource/fira-code/latin-700.css')])],
  ['Fira Sans', () => Promise.all([import('@fontsource/fira-sans/latin-400.css'), import('@fontsource/fira-sans/latin-700.css')])],
  ['IBM Plex Mono', () => Promise.all([import('@fontsource/ibm-plex-mono/latin-400.css'), import('@fontsource/ibm-plex-mono/latin-700.css')])],
  ['IBM Plex Sans', () => Promise.all([import('@fontsource/ibm-plex-sans/latin-400.css'), import('@fontsource/ibm-plex-sans/latin-700.css')])],
  ['IBM Plex Serif', () => Promise.all([import('@fontsource/ibm-plex-serif/latin-400.css'), import('@fontsource/ibm-plex-serif/latin-700.css')])],
  ['Inter', () => Promise.all([import('@fontsource/inter/latin-400.css'), import('@fontsource/inter/latin-700.css')])],
  ['JetBrains Mono', () => Promise.all([import('@fontsource/jetbrains-mono/latin-400.css'), import('@fontsource/jetbrains-mono/latin-700.css')])],
  ['Karla', () => Promise.all([import('@fontsource/karla/latin-400.css'), import('@fontsource/karla/latin-700.css')])],
  ['Lato', () => Promise.all([import('@fontsource/lato/latin-400.css'), import('@fontsource/lato/latin-700.css')])],
  ['Lexend', () => Promise.all([import('@fontsource/lexend/latin-400.css'), import('@fontsource/lexend/latin-700.css')])],
  ['Libre Baskerville', () => Promise.all([import('@fontsource/libre-baskerville/latin-400.css'), import('@fontsource/libre-baskerville/latin-700.css')])],
  ['Lora', () => Promise.all([import('@fontsource/lora/latin-400.css'), import('@fontsource/lora/latin-700.css')])],
  ['Manrope', () => Promise.all([import('@fontsource/manrope/latin-400.css'), import('@fontsource/manrope/latin-700.css')])],
  ['Merriweather', () => Promise.all([import('@fontsource/merriweather/latin-400.css'), import('@fontsource/merriweather/latin-700.css')])],
  ['Montserrat', () => Promise.all([import('@fontsource/montserrat/latin-400.css'), import('@fontsource/montserrat/latin-700.css')])],
  ['Noto Sans', () => Promise.all([import('@fontsource/noto-sans/latin-400.css'), import('@fontsource/noto-sans/latin-700.css')])],
  ['Noto Serif', () => Promise.all([import('@fontsource/noto-serif/latin-400.css'), import('@fontsource/noto-serif/latin-700.css')])],
  ['Nunito Sans', () => Promise.all([import('@fontsource/nunito-sans/latin-400.css'), import('@fontsource/nunito-sans/latin-700.css')])],
  ['Open Sans', () => Promise.all([import('@fontsource/open-sans/latin-400.css'), import('@fontsource/open-sans/latin-700.css')])],
  ['Playfair Display', () => Promise.all([import('@fontsource/playfair-display/latin-400.css'), import('@fontsource/playfair-display/latin-700.css')])],
  ['Poppins', () => Promise.all([import('@fontsource/poppins/latin-400.css'), import('@fontsource/poppins/latin-700.css')])],
  ['PT Sans', () => Promise.all([import('@fontsource/pt-sans/latin-400.css'), import('@fontsource/pt-sans/latin-700.css')])],
  ['PT Serif', () => Promise.all([import('@fontsource/pt-serif/latin-400.css'), import('@fontsource/pt-serif/latin-700.css')])],
  ['Raleway', () => Promise.all([import('@fontsource/raleway/latin-400.css'), import('@fontsource/raleway/latin-700.css')])],
  ['Roboto', () => Promise.all([import('@fontsource/roboto/latin-400.css'), import('@fontsource/roboto/latin-700.css')])],
  ['Roboto Mono', () => Promise.all([import('@fontsource/roboto-mono/latin-400.css'), import('@fontsource/roboto-mono/latin-700.css')])],
  ['Roboto Slab', () => Promise.all([import('@fontsource/roboto-slab/latin-400.css'), import('@fontsource/roboto-slab/latin-700.css')])],
  ['Source Code Pro', () => Promise.all([import('@fontsource/source-code-pro/latin-400.css'), import('@fontsource/source-code-pro/latin-700.css')])],
  ['Source Sans 3', () => Promise.all([import('@fontsource/source-sans-3/latin-400.css'), import('@fontsource/source-sans-3/latin-700.css')])],
  ['Source Serif 4', () => Promise.all([import('@fontsource/source-serif-4/latin-400.css'), import('@fontsource/source-serif-4/latin-700.css')])],
  ['Space Mono', () => Promise.all([import('@fontsource/space-mono/latin-400.css'), import('@fontsource/space-mono/latin-700.css')])],
  ['Ubuntu', () => Promise.all([import('@fontsource/ubuntu/latin-400.css'), import('@fontsource/ubuntu/latin-700.css')])],
  ['Work Sans', () => Promise.all([import('@fontsource/work-sans/latin-400.css'), import('@fontsource/work-sans/latin-700.css')])],
])

const FONT_BY_VALUE = new Map(
  EDITOR_FONT_FAMILIES.map((font) => [font.value, font.name])
)
const loadPromises = new Map()

export function getBundledEditorFontNamesInHtml(html) {
  if (typeof html !== 'string' || html.length === 0) return []
  const source = html.toLocaleLowerCase('en-US')
  return [...FONT_LOADERS.keys()].filter((name) => source.includes(name.toLocaleLowerCase('en-US')))
}

export function ensureEditorFontLoaded(fontValueOrName) {
  if (!fontValueOrName || fontValueOrName === DEFAULT_EDITOR_FONT) return Promise.resolve(false)
  const name = FONT_BY_VALUE.get(fontValueOrName) || fontValueOrName
  const loader = FONT_LOADERS.get(name)
  if (!loader) return Promise.resolve(false)
  if (!loadPromises.has(name)) loadPromises.set(name, loader().then(() => true))
  return loadPromises.get(name)
}

export function ensureEditorFontsForHtml(html) {
  return Promise.all(getBundledEditorFontNamesInHtml(html).map(ensureEditorFontLoaded))
}
