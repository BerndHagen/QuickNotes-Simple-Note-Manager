import { describe, expect, it } from 'vitest'
import { collectTodayAgenda } from './today'

describe('Today agenda', () => {
  it('combines due canonical tasks, active reminders, meetings, and recent notes without duplicating data', () => {
    const result = collectTodayAgenda([
      {
        id: 'todo', title: 'Launch tasks', noteType: 'todo', updatedAt: '2026-08-27T08:00:00.000Z',
        noteData: { tasks: [
          { id: 'due', text: 'Send recap', dueDate: '2026-08-27', completed: false },
          { id: 'future', text: 'Archive notes', dueDate: '2026-08-28', completed: false },
        ] },
        reminders: [{ id: 'r1', datetime: '2026-08-27T09:00:00.000Z', source: { type: 'task', noteId: 'todo', taskId: 'due' } }],
      },
      { id: 'meeting', title: 'Review', noteType: 'meeting', updatedAt: '2026-08-27T09:00:00.000Z', noteData: { date: '2026-08-27', startTime: '10:00' } },
      { id: 'journal', title: 'Today', noteType: 'journal', updatedAt: '2026-08-27T10:00:00.000Z', noteData: { date: '2026-08-27' } },
    ], { today: '2026-08-27', currentNoteId: 'journal' })

    expect(result.dueTasks.map((task) => task.taskId)).toEqual(['due'])
    expect(result.reminders.map((reminder) => reminder.id)).toEqual(['r1'])
    expect(result.meetings.map((note) => note.id)).toEqual(['meeting'])
    expect(result.recentNotes.map((note) => note.id)).toEqual(['meeting', 'todo'])
  })
})
