import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import Image from '@tiptap/extension-image'
import { describe, expect, it } from 'vitest'
import { inspectEditorAccessibility } from './editorAccessibility'

const ResizableImage = Image.extend({ name: 'resizableImage' }).configure({ allowBase64: true })

const createDocument = (content) => new Editor({
  extensions: [StarterKit, Link, Table, TableRow, TableCell, TableHeader, ResizableImage],
  content,
})

describe('editor accessibility inspection', () => {
  it('reports document structure, image, table, and link problems with positions', () => {
    const editor = createDocument(`
      <h2>Overview</h2>
      <h4>Skipped level</h4>
      <p><a href="https://example.com">Click here</a></p>
      <img src="data:image/png;base64,AA==">
      <table><tbody><tr><td>Value</td></tr></tbody></table>
    `)

    const issues = inspectEditorAccessibility(editor.state.doc)
    expect(issues.map(({ id }) => id.split('-').slice(0, 2).join('-'))).toEqual(
      expect.arrayContaining(['heading-order', 'link-label', 'image-alt', 'table-header'])
    )
    expect(issues.every(({ position }) => Number.isInteger(position))).toBe(true)
    editor.destroy()
  })

  it('accepts a sequential outline, descriptive links, alt text, and table headers', () => {
    const editor = createDocument(`
      <h2>Overview</h2>
      <h3>Details</h3>
      <p><a href="https://example.com">Read the release notes</a></p>
      <img src="data:image/png;base64,AA==" alt="Release chart">
      <table><tbody><tr><th>Metric</th></tr><tr><td>Value</td></tr></tbody></table>
    `)

    expect(inspectEditorAccessibility(editor.state.doc)).toEqual([])
    editor.destroy()
  })
})
