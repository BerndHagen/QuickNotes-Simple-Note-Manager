import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { afterEach, describe, expect, it } from 'vitest'
import InvisibleCharactersExtension, {
  getInvisibleCharacterDecorations,
} from './InvisibleCharactersExtension'

describe('InvisibleCharactersExtension', () => {
  let editor

  afterEach(() => editor?.destroy())

  it('marks exact spaces, tabs, hard breaks, and paragraph boundaries without changing content', () => {
    editor = new Editor({
      extensions: [StarterKit, InvisibleCharactersExtension],
      content: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'one two\tthree' },
              { type: 'hardBreak' },
              { type: 'text', text: 'four' },
            ],
          },
          { type: 'paragraph' },
        ],
      },
    })
    const originalHtml = editor.getHTML()

    editor.commands.setInvisibleCharacters(true)

    const decorations = getInvisibleCharacterDecorations(editor.state)
    const classes = decorations.map((decoration) =>
      decoration.type.attrs?.class || decoration.type.toDOM?.().className || ''
    )
    expect(classes.filter((name) => name.includes('qn-invisible-space'))).toHaveLength(1)
    expect(classes.filter((name) => name.includes('qn-invisible-tab'))).toHaveLength(1)
    expect(classes.filter((name) => name.includes('qn-invisible-hard-break'))).toHaveLength(1)
    expect(classes.filter((name) => name.includes('qn-invisible-paragraph'))).toHaveLength(2)
    expect(editor.getHTML()).toBe(originalHtml)

    editor.commands.setInvisibleCharacters(false)
    expect(getInvisibleCharacterDecorations(editor.state)).toHaveLength(0)
    expect(editor.getHTML()).toBe(originalHtml)
  })
})
