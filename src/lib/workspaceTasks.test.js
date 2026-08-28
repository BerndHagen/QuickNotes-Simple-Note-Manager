import { describe, expect, it } from 'vitest'
import {
  collectWorkspaceTasks,
  getTaskSummary,
  sortWorkspaceTasks,
  toggleWorkspaceTask,
} from './workspaceTasks'

const note = (overrides) => ({
  id: 'note-1',
  title: 'Work',
  noteType: 'todo',
  content: '',
  noteData: {},
  updatedAt: '2026-08-24T10:00:00.000Z',
  ...overrides,
})

describe('workspace task aggregation', () => {
  it('collects rich text and focused-workspace tasks without archived notes', () => {
    const tasks = collectWorkspaceTasks([
      note({
        noteType: 'standard',
        content: '<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>Inline task</p></li></ul>',
      }),
      note({
        id: 'meeting',
        noteType: 'meeting',
        noteData: { actionItems: [{ id: 'a1', task: 'Send recap', dueDate: '2026-08-24' }] },
      }),
      note({ id: 'archived', archived: true, noteData: { tasks: [{ id: 'x', text: 'Hidden' }] } }),
    ])

    expect(tasks.map((task) => task.title)).toEqual(['Inline task', 'Send recap'])
    expect(getTaskSummary(tasks, '2026-08-24')).toMatchObject({ open: 2, today: 1 })
  })

  it('toggles a nested task without changing its parent', () => {
    const source = note({
      noteData: {
        tasks: [{ id: 'parent', text: 'Parent', completed: false, subtasks: [{ id: 'child', text: 'Child', completed: false }] }],
      },
    })
    const child = collectWorkspaceTasks([source]).find((task) => task.kind === 'todo-subtask')
    const patch = toggleWorkspaceTask(source, child)

    expect(patch.noteData.tasks[0].completed).toBe(false)
    expect(patch.noteData.tasks[0].subtasks[0].completed).toBe(true)
  })

  it('moves project tasks to done and restores their previous column', () => {
    const source = note({
      noteType: 'project',
      noteData: {
        columns: [
          { id: 'todo', name: 'To do', tasks: [{ id: 'p1', title: 'Ship it' }] },
          { id: 'done', name: 'Done', tasks: [] },
        ],
      },
    })
    const descriptor = collectWorkspaceTasks([source])[0]
    const completed = toggleWorkspaceTask(source, descriptor)
    const completedNote = { ...source, noteData: completed.noteData }
    const completedDescriptor = collectWorkspaceTasks([completedNote])[0]
    const reopened = toggleWorkspaceTask(completedNote, completedDescriptor)

    expect(completed.noteData.columns[1].tasks[0]).toMatchObject({ id: 'p1', previousColumnId: 'todo' })
    expect(reopened.noteData.columns[0].tasks[0]).toMatchObject({ id: 'p1', previousColumnId: null })
  })

  it('sorts open dated work before undated and completed tasks', () => {
    const sorted = sortWorkspaceTasks([
      { title: 'Complete', completed: true, dueDate: '2026-08-20', priority: 'high' },
      { title: 'No date', completed: false, dueDate: null, priority: 'high' },
      { title: 'Soon', completed: false, dueDate: '2026-08-25', priority: 'low' },
    ])
    expect(sorted.map((task) => task.title)).toEqual(['Soon', 'No date', 'Complete'])
  })

  it('exposes a validated capture source without creating another task kind', () => {
    const [task] = collectWorkspaceTasks([note({
      noteData: {
        tasks: [{
          id: 'captured',
          text: 'Send proposal',
          source: {
            schemaVersion: 1,
            kind: 'recognizedContent',
            noteId: 'paper-note',
            recognitionId: 'recognition-1',
            recognitionType: 'handwriting',
            sourceKind: 'ink',
            objectId: 'stroke-1',
            pageId: 'page-1',
          },
        }],
      },
    })])

    expect(task.kind).toBe('todo')
    expect(task.sourceReference).toMatchObject({ noteId: 'paper-note', objectId: 'stroke-1' })
  })
})
