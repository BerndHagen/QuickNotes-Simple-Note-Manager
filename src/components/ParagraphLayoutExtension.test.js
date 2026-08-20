import { afterEach, describe, expect, it } from 'vitest'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import ParagraphLayoutExtension from './ParagraphLayoutExtension'
import TabStopExtension from './TabStopExtension'
import StyledTaskItem from './StyledTaskItem'
import CalloutExtension from './CalloutExtension'
import PageBreakExtension from './PageBreakExtension'
import PaginationExtension from './PaginationExtension'

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
    editor.commands.setParagraphLayout({ rightIndent: 24, firstLineIndent: -16, tabStops: [{ position: 240, type: 'right' }, 96, { position: 240, type: 'right' }], spaceBefore: 8, spaceAfter: 16 })
    expect(editor.getAttributes('paragraph')).toMatchObject({
      leftIndent: 80,
      rightIndent: 24,
      firstLineIndent: -16,
      tabStops: [{ position: 96, type: 'left' }, { position: 240, type: 'right' }],
      spaceBefore: 8,
      spaceAfter: 16,
    })

    const html = editor.getHTML()
    expect(html).toContain('data-left-indent="80"')
    expect(html).toContain('data-right-indent="24"')
    expect(html).toContain('data-first-line-indent="-16"')
    const tabStops = JSON.parse(new DOMParser().parseFromString(html, 'text/html').querySelector('p').dataset.tabStops)
    expect(tabStops).toEqual([{ position: 96, type: 'left' }, { position: 240, type: 'right' }])
    expect(html).toContain('data-space-before="8"')
    expect(html).toContain('data-space-after="16"')

    const restored = createEditor({
      extensions: [StarterKit, ParagraphLayoutExtension, TabStopExtension],
      content: html,
    })
    restored.commands.setTextSelection(3)
    expect(restored.getAttributes('paragraph')).toMatchObject({
      leftIndent: 80,
      rightIndent: 24,
      firstLineIndent: -16,
      tabStops: [{ position: 96, type: 'left' }, { position: 240, type: 'right' }],
      spaceBefore: 8,
      spaceAfter: 16,
    })
  })

  it('inserts a durable tab advance at the next ruler stop', () => {
    const editor = createEditor({
      extensions: [StarterKit, ParagraphLayoutExtension, TabStopExtension],
      content: '<p>Label</p>',
    })
    editor.commands.setTextSelection(6)
    editor.commands.insertTabStop({ width: 72, stop: 120, type: 'decimal' })

    expect(editor.getHTML()).toContain('data-type="tabStop"')
    expect(editor.getHTML()).toContain('data-width="72"')
    expect(editor.getJSON().content[0].content.at(-1)).toMatchObject({
      type: 'tabStop',
      attrs: { width: 72, stop: 120, type: 'decimal' },
    })
  })

  it('stores manual page breaks as document structure', () => {
    const editor = createEditor({
      extensions: [StarterKit, PageBreakExtension, PaginationExtension],
      content: '<p>Page one</p><p>Page two</p>',
    })
    editor.commands.setTextSelection(9)
    expect(editor.commands.insertPageBreak()).toBe(true)
    expect(editor.getJSON().content.some((node) => node.type === 'pageBreak')).toBe(true)
    expect(editor.getHTML()).toContain('data-type="pageBreak"')
  })

  it('maps Ctrl+Enter to a page break instead of a hard line break', () => {
    const editor = createEditor({
      extensions: [StarterKit, PageBreakExtension],
      content: '<p>Page one</p>',
    })
    editor.commands.setTextSelection(9)
    editor.view.dom.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    }))
    expect(editor.getJSON().content.some((node) => node.type === 'pageBreak')).toBe(true)
    expect(editor.getJSON().content[0].content?.some((node) => node.type === 'hardBreak')).not.toBe(true)
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
            attrs: {
              checked: true,
              checkboxStyle: 'circle',
              checkboxColor: 'purple',
              checkboxSize: 'large',
              checkedStyle: 'fade',
            },
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Review' }] }],
          }],
        }],
      },
    })
    const html = editor.getHTML()
    expect(html).toContain('data-checkbox-style="circle"')
    expect(html).toContain('data-checkbox-color="purple"')
    expect(html).toContain('data-checkbox-size="large"')
    expect(html).toContain('data-checked-style="fade"')

    const restored = createEditor({
      extensions: [StarterKit, TaskList, StyledTaskItem.configure({ nested: true })],
      content: html,
    })
    expect(restored.getJSON().content[0].content[0].attrs).toMatchObject({
      checked: true,
      checkboxStyle: 'circle',
      checkboxColor: 'purple',
      checkboxSize: 'large',
      checkedStyle: 'fade',
    })

    restored.commands.setTextSelection(3)
    restored.commands.updateAttributes('taskItem', {
      checkboxStyle: 'square',
      checkboxColor: 'amber',
      checkboxSize: 'compact',
      checkedStyle: 'keep',
    })
    const liveItem = restored.view.dom.querySelector('li[data-type="taskItem"]')
    expect(liveItem.dataset).toMatchObject({
      checkboxStyle: 'square',
      checkboxColor: 'amber',
      checkboxSize: 'compact',
      checkedStyle: 'keep',
    })
  })

  it('creates semantic callouts and retains their tone', () => {
    const editor = createEditor({
      extensions: [StarterKit, CalloutExtension],
      content: '<p>Verify the deployment window.</p>',
    })

    editor.commands.setTextSelection(4)
    expect(editor.commands.toggleCallout({ tone: 'warning' })).toBe(true)
    expect(editor.isActive('callout', { tone: 'warning' })).toBe(true)
    expect(editor.commands.setCalloutTone('important')).toBe(true)

    const html = editor.getHTML()
    expect(html).toContain('<aside')
    expect(html).toContain('data-type="callout"')
    expect(html).toContain('data-tone="important"')

    const restored = createEditor({ extensions: [StarterKit, CalloutExtension], content: html })
    restored.commands.setTextSelection(4)
    expect(restored.isActive('callout', { tone: 'important' })).toBe(true)
  })
})
