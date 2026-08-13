import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { afterEach, describe, expect, it } from 'vitest'
import ShapeExtension from './ShapeExtension'

describe('ShapeExtension', () => {
  let editor
  let restored

  afterEach(() => {
    editor?.destroy()
    restored?.destroy()
  })

  it('persists shape geometry, transforms, presentation, and editable text through HTML', () => {
    editor = new Editor({ extensions: [StarterKit, ShapeExtension], content: '<p>Before</p>' })

    editor.commands.insertShape({
      shapeType: 'diamond',
      width: 310,
      height: 140,
      rotation: 45,
      flipH: true,
      align: 'right',
      fill: 'info',
      label: 'Decision',
    })

    const html = editor.getHTML()
    expect(html).toContain('data-type="shape"')
    expect(html).toContain('data-shape="diamond"')
    expect(html).toContain('data-width="310"')
    expect(html).toContain('data-height="140"')
    expect(html).toContain('data-rotation="45"')
    expect(html).toContain('data-flip-h="true"')
    expect(html).toContain('data-align="right"')
    expect(html).toContain('data-fill="info"')
    expect(html).toContain('Decision')

    restored = new Editor({ extensions: [StarterKit, ShapeExtension], content: html })
    const shape = restored.getJSON().content.find((node) => node.type === 'shape')
    expect(shape).toMatchObject({
      attrs: {
        shapeType: 'diamond',
        width: 310,
        height: 140,
        rotation: 45,
        flipH: true,
        flipV: false,
        align: 'right',
        fill: 'info',
      },
      content: [{ type: 'text', text: 'Decision' }],
    })
  })
})
