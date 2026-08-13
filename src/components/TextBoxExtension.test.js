import { afterEach, describe, expect, it } from 'vitest'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import TextBoxExtension from './TextBoxExtension'

let editor

afterEach(() => editor?.destroy())

describe('TextBoxExtension', () => {
  it('persists free geometry, fill, border, and editable block content', () => {
    editor = new Editor({ extensions: [StarterKit, TextBoxExtension] })
    editor.commands.insertTextBox({
      x: 84,
      y: 132,
      width: 360,
      height: 170,
      background: '#eff6ff',
      borderColor: '#2563eb',
      borderWidth: 3,
      borderStyle: 'dashed',
    })

    const html = editor.getHTML()
    expect(html).toContain('data-wrap="absolute"')
    expect(html).toContain('data-x="84"')
    expect(html).toContain('data-y="132"')
    expect(html).toContain('data-bg="#eff6ff"')
    expect(html).toContain('data-border-color="#2563eb"')
    expect(html).toContain('data-border-width="3"')

    const restored = new Editor({ extensions: [StarterKit, TextBoxExtension], content: html })
    editor.destroy()
    editor = restored
    expect(editor.getJSON().content[0].attrs).toMatchObject({
      wrap: 'absolute',
      x: 84,
      y: 132,
      width: 360,
      height: 170,
      background: '#eff6ff',
      borderColor: '#2563eb',
      borderWidth: 3,
      borderStyle: 'dashed',
    })
  })
})
