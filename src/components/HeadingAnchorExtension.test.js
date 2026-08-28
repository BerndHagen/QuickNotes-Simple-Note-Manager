import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { afterEach, describe, expect, it } from 'vitest'
import HeadingAnchorExtension from './HeadingAnchorExtension'

describe('HeadingAnchorExtension', () => {
  let editor
  afterEach(() => editor?.destroy())

  it('assigns a durable identity to headings and preserves it through edits', () => {
    editor = new Editor({
      extensions: [StarterKit, HeadingAnchorExtension],
      content: '<h2>Planning</h2><p>Text</p>',
    })
    editor.commands.ensureHeadingAnchors()
    const first = editor.getJSON().content[0].attrs.anchorId
    expect(first).toBeTruthy()
    expect(editor.getHTML()).toContain(`data-anchor-id="${first}"`)

    editor.commands.setTextSelection(2)
    editor.commands.insertContent('X')
    expect(editor.getJSON().content[0].attrs.anchorId).toBe(first)
  })
})

