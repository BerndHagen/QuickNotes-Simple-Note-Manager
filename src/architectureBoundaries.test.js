import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const read = (relativePath) => readFileSync(
  fileURLToPath(new URL(relativePath, import.meta.url)),
  'utf8',
)

const lineCount = (source) => source.split(/\r?\n/).length

describe('release architecture boundaries', () => {
  it('keeps workspace editors behind a lazy registry', () => {
    const barrel = read('./components/editors/index.js')
    const registry = read('./components/editors/editorRegistry.jsx')

    expect(barrel).not.toMatch(/from ['"].*Editor\.jsx['"]/)
    expect(registry.match(/lazy\(\(\) => import\(/g)).toHaveLength(9)
  })

  it('keeps optional editor fonts out of the startup stylesheet graph', () => {
    const main = read('./main.jsx')
    const loader = read('./lib/editorFontLoader.js')

    expect(main).not.toMatch(/@fontsource\/(?!manrope)/)
    expect(loader).toContain("import('@fontsource/inter/latin-400.css')")
  })

  it('keeps large responsibilities out of former monolith entry files', () => {
    const editor = read('./components/RichTextEditor.jsx')
    const store = read('./store/index.js')
    const i18n = read('./lib/i18n.js')
    const baseStyles = read('./index.css')

    expect(lineCount(editor)).toBeLessThan(1_500)
    expect(lineCount(store)).toBeLessThan(2_600)
    expect(lineCount(i18n)).toBeLessThan(150)
    expect(lineCount(baseStyles)).toBeLessThan(3_000)
    expect(store).toContain('createSyncActions')
    expect(store).not.toContain('syncWithBackend: async')
  })

  it('locks the approved shell palette and safe editor dependency groups', () => {
    const tokens = read('./styles/tokens.css')
    const vite = read('../vite.config.js')
    const packageManifest = JSON.parse(read('../package.json'))

    expect(tokens).toContain('--qn-banner: #162327;')
    expect(tokens).toContain('--qn-nav-bg: #121c20;')
    expect(packageManifest.dependencies['@tiptap/core']).toBe('^3.31.3')
    expect(packageManifest.dependencies['@tiptap/react']).toBe('^3.31.3')
    expect(vite).toContain("name: 'editor-foundation'")
    expect(vite).toContain("name: 'editor-extensions'")
    expect(vite).not.toContain('maxSize:')
  })
})
