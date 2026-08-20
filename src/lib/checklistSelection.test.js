import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import { afterEach, describe, expect, it } from 'vitest'
import StyledTaskItem from '../components/StyledTaskItem'
import { getSelectedTaskItems } from './checklistSelection'

const editors = []

const createEditor = (content) => {
  const editor = new Editor({
    extensions: [StarterKit, TaskList, StyledTaskItem.configure({ nested: true })],
    content,
  })
  editors.push(editor)
  return editor
}

afterEach(() => {
  editors.splice(0).forEach((editor) => editor.destroy())
})

describe('getSelectedTaskItems', () => {
  it('returns every checklist item covered by a document selection', () => {
    const editor = createEditor(`
      <ul data-type="taskList">
        <li data-type="taskItem" data-checked="false"><p>First task</p></li>
        <li data-type="taskItem" data-checked="false"><p>Second task</p></li>
      </ul>
    `)

    editor.commands.setTextSelection({ from: 1, to: editor.state.doc.content.size - 1 })

    expect(getSelectedTaskItems(editor.state).map(({ node }) => node.textContent)).toEqual([
      'First task',
      'Second task',
    ])
  })

  it('uses the deepest item when the cursor is inside a nested checklist', () => {
    const editor = createEditor(`
      <ul data-type="taskList">
        <li data-type="taskItem" data-checked="false">
          <p>Parent task</p>
          <ul data-type="taskList">
            <li data-type="taskItem" data-checked="false"><p>Nested task</p></li>
          </ul>
        </li>
      </ul>
    `)
    let nestedPosition = 0
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'taskItem' && node.textContent === 'Nested task') nestedPosition = pos + 2
    })
    editor.commands.setTextSelection(nestedPosition)

    expect(getSelectedTaskItems(editor.state)).toHaveLength(1)
    expect(getSelectedTaskItems(editor.state)[0].node.textContent).toBe('Nested task')
  })
})
