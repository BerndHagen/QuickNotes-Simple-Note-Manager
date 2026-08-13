import { afterEach, describe, expect, it } from 'vitest'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import ParagraphLayoutExtension from './ParagraphLayoutExtension'
import TabStopExtension from './TabStopExtension'
import StyledTaskItem from './StyledTaskItem'

const editors = []
const createEditor = (options) => {
  const editor = new Editor(options)
  editors.push(editor)
  return editor
}

afterEach(() => {
  editors.splice(0).forEach((editor) => editor.destroy())
})

describe('document layout extensions', () => {
  it('supports repeated paragraph indents and persists ruler geometry', () => {
    const editor = createEditor({
      extensions: [StarterKit, ParagraphLayoutExtension, TabStopExtension],
      content: '<p>Quarterly plan</p>',
    })

    editor.commands.setTextSelection(3)
    editor.commands.increaseParagraphIndent()
    editor.commands.increaseParagraphIndent()
    editor.commands.increaseParagraphIndent()
    expect(editor.getAttributes('paragraph').leftIndent).toBe(120)

    editor.commands.decreaseParagraphIndent()
    editor.commands.setParagraphLayout({ rightIndent: 24, firstLineIndent: -16, tabStops: [240, 96, 240] })
    expect(editor.getAttributes('paragraph')).toMatchObject({
      leftIndent: 80,
      rightIndent: 24,
      firstLineIndent: -16,
      tabStops: [96, 240],
    })

    const html = editor.getHTML()
    expect(html).toContain('data-left-indent="80"')
    expect(html).toContain('data-right-indent="24"')
    expect(html).toContain('data-first-line-indent="-16"')
    expect(html).toContain('data-tab-stops="[96,240]"')

    const restored = createEditor({
      extensions: [StarterKit, ParagraphLayoutExtension, TabStopExtension],
      content: html,
    })
    restored.commands.setTextSelection(3)
    expect(restored.getAttributes('paragraph')).toMatchObject({
      leftIndent: 80,
      rightIndent: 24,
      firstLineIndent: -16,
      tabStops: [96, 240],
    })
  })

  it('inserts a durable tab advance at the next ruler stop', () => {
    const editor = createEditor({
      extensions: [StarterKit, ParagraphLayoutExtension, TabStopExtension],
      content: '<p>Label</p>',
    })
    editor.commands.setTextSelection(6)
    editor.commands.insertTabStop({ width: 72, stop: 120 })

    expect(editor.getHTML()).toContain('data-type="tabStop"')
    expect(editor.getHTML()).toContain('data-width="72"')
    expect(editor.getJSON().content[0].content.at(-1)).toMatchObject({
      type: 'tabStop',
      attrs: { width: 72, stop: 120 },
    })
  })

  it('round-trips selectable checklist appearances', () => {
    const editor = createEditor({
      extensions: [StarterKit, TaskList, StyledTaskItem.configure({ nested: true })],
      content: {
        type: 'doc',
        content: [{
          type: 'taskList',
          content: [{
            type: 'taskItem',
            attrs: { checked: false, checkboxStyle: 'circle' },
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Review' }] }],
          }],
        }],
      },
    })
    const html = editor.getHTML()
    expect(html).toContain('data-checkbox-style="circle"')

    const restored = createEditor({
      extensions: [StarterKit, TaskList, StyledTaskItem.configure({ nested: true })],
      content: html,
    })
    expect(restored.getJSON().content[0].content[0].attrs.checkboxStyle).toBe('circle')
  })
})
