import { toggleTaskWithRecurrence } from './taskRecurrence'

const DAY_KEYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]

const asArray = (value) => (Array.isArray(value) ? value : [])
const asObject = (value) =>
  value && typeof value === 'object' && !Array.isArray(value) ? value : {}

const cleanText = (value, fallback = 'Untitled task') => {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  return text || fallback
}

const toDateKey = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const addDays = (dateKey, days) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey || ''))
  if (!match) return null
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  if (Number.isNaN(date.getTime())) return null
  date.setDate(date.getDate() + days)
  return toDateKey(date)
}

const priorityValue = (value) => {
  if (value === true) return 'high'
  return ['high', 'medium', 'low', 'none'].includes(value) ? value : 'none'
}

const taskRecord = (note, task, details) => ({
  key: `${note.id}:${details.kind}:${details.taskId}`,
  noteId: note.id,
  noteTitle: note.title || 'Untitled note',
  noteType: note.noteType || 'standard',
  taskId: details.taskId,
  kind: details.kind,
  title: cleanText(details.title),
  completed: Boolean(details.completed),
  dueDate: details.dueDate || null,
  priority: priorityValue(details.priority),
  context: details.context || '',
  path: details.path,
  canToggle: details.canToggle !== false,
  sourceUpdatedAt: note.updatedAt || note.createdAt || '',
  starred: Boolean(task?.starred),
})

const getRichTextTasks = (note) => {
  if (!note.content || typeof DOMParser === 'undefined') return []
  const document = new DOMParser().parseFromString(note.content, 'text/html')
  return [...document.querySelectorAll('li[data-type="taskItem"]')].map((item, index) =>
    taskRecord(note, null, {
      kind: 'rich-text',
      taskId: String(index),
      title: item.textContent,
      completed: item.getAttribute('data-checked') === 'true',
      context: 'Document checklist',
      path: { index },
    })
  )
}

/**
 * Produces one normalized task stream from every task-bearing QuickNotes note.
 * Descriptors contain stable record ids where the source format provides them,
 * and a fresh document-order index for rich-text checkboxes that predate ids.
 */
export const collectWorkspaceTasks = (notes) => {
  const tasks = []

  for (const note of asArray(notes)) {
    if (!note || note.deleted || note.archived) continue
    const data = asObject(note.noteData)

    tasks.push(...getRichTextTasks(note))

    if (note.noteType === 'todo') {
      for (const task of asArray(data.tasks)) {
        const taskId = task?.id || `todo-${tasks.length}`
        tasks.push(taskRecord(note, task, {
          kind: 'todo',
          taskId,
          title: task?.text || task?.title,
          completed: task?.completed,
          dueDate: task?.dueDate,
          priority: task?.priority,
          context: 'Task list',
          path: { taskId },
        }))
        for (const subtask of asArray(task?.subtasks)) {
          const subtaskId = subtask?.id || `subtask-${tasks.length}`
          tasks.push(taskRecord(note, subtask, {
            kind: 'todo-subtask',
            taskId: subtaskId,
            title: subtask?.text || subtask?.title,
            completed: subtask?.completed,
            dueDate: task?.dueDate,
            priority: task?.priority,
            context: cleanText(task?.text || task?.title, 'Parent task'),
            path: { taskId, subtaskId },
          }))
        }
      }
    }

    if (note.noteType === 'project') {
      const columns = asArray(data.columns)
      const doneColumn = columns.find((column) =>
        /^(done|complete|completed)$/i.test(column?.id || column?.name || '')
      )
      for (const column of columns) {
        for (const task of asArray(column?.tasks)) {
          const taskId = task?.id || `project-${tasks.length}`
          tasks.push(taskRecord(note, task, {
            kind: 'project-task',
            taskId,
            title: task?.title || task?.text,
            completed: doneColumn ? column.id === doneColumn.id : task?.completed,
            dueDate: task?.dueDate,
            priority: task?.priority,
            context: column?.name || 'Project board',
            path: { taskId, columnId: column?.id, doneColumnId: doneColumn?.id || null },
            canToggle: Boolean(doneColumn) || Object.hasOwn(task || {}, 'completed'),
          }))
        }
      }
      for (const milestone of asArray(data.milestones)) {
        const taskId = milestone?.id || `milestone-${tasks.length}`
        tasks.push(taskRecord(note, milestone, {
          kind: 'project-milestone',
          taskId,
          title: milestone?.name || milestone?.title,
          completed: milestone?.completed,
          dueDate: milestone?.dueDate,
          priority: 'high',
          context: 'Milestone',
          path: { taskId },
        }))
      }
    }

    if (note.noteType === 'meeting') {
      for (const item of asArray(data.actionItems)) {
        const taskId = item?.id || `meeting-${tasks.length}`
        tasks.push(taskRecord(note, item, {
          kind: 'meeting-action',
          taskId,
          title: item?.task || item?.text || item?.title,
          completed: item?.completed,
          dueDate: item?.dueDate,
          context: item?.owner ? `Assigned to ${item.owner}` : 'Meeting action',
          path: { taskId },
        }))
      }
    }

    if (note.noteType === 'journal') {
      for (const goal of asArray(data.goals)) {
        const taskId = goal?.id || `journal-${tasks.length}`
        tasks.push(taskRecord(note, goal, {
          kind: 'journal-goal',
          taskId,
          title: goal?.text || goal?.title,
          completed: goal?.completed,
          dueDate: data.date,
          context: 'Daily goal',
          path: { taskId },
        }))
      }
    }

    if (note.noteType === 'weekly') {
      for (const goal of asArray(data.weeklyGoals || data.goals)) {
        const taskId = goal?.id || `weekly-goal-${tasks.length}`
        tasks.push(taskRecord(note, goal, {
          kind: 'weekly-goal',
          taskId,
          title: goal?.text || goal?.title,
          completed: goal?.completed,
          priority: goal?.priority,
          context: 'Weekly goal',
          path: { taskId },
        }))
      }
      DAY_KEYS.forEach((dayKey, dayIndex) => {
        for (const task of asArray(data.days?.[dayKey]?.tasks)) {
          const taskId = task?.id || `weekly-${dayKey}-${tasks.length}`
          tasks.push(taskRecord(note, task, {
            kind: 'weekly-day',
            taskId,
            title: task?.text || task?.title,
            completed: task?.completed,
            dueDate: addDays(data.weekStart, dayIndex),
            context: `${dayKey.charAt(0).toUpperCase()}${dayKey.slice(1)}`,
            path: { taskId, dayKey },
          }))
        }
      })
    }
  }

  return tasks
}

const toggleById = (items, id) =>
  asArray(items).map((item) =>
    item?.id === id ? { ...item, completed: !item.completed } : item
  )

const toggleRichTextTask = (content, index) => {
  if (typeof DOMParser === 'undefined') return content
  const document = new DOMParser().parseFromString(content || '', 'text/html')
  const item = document.querySelectorAll('li[data-type="taskItem"]')[index]
  if (!item) return content
  const checked = item.getAttribute('data-checked') === 'true'
  item.setAttribute('data-checked', String(!checked))
  const input = item.querySelector('input[type="checkbox"]')
  if (input) {
    if (checked) input.removeAttribute('checked')
    else input.setAttribute('checked', 'checked')
  }
  return document.body.innerHTML
}

/** Return the smallest note patch needed to toggle one normalized task. */
export const toggleWorkspaceTask = (note, descriptor) => {
  if (!note || !descriptor || descriptor.noteId !== note.id || !descriptor.canToggle) return null
  if (descriptor.kind === 'rich-text') {
    return { content: toggleRichTextTask(note.content, descriptor.path.index) }
  }

  const data = asObject(note.noteData)
  let noteData = data

  if (descriptor.kind === 'todo') {
    noteData = {
      ...data,
      tasks: toggleTaskWithRecurrence(data.tasks, descriptor.path.taskId),
    }
  } else if (descriptor.kind === 'todo-subtask') {
    noteData = {
      ...data,
      tasks: asArray(data.tasks).map((task) =>
        task?.id === descriptor.path.taskId
          ? { ...task, subtasks: toggleById(task.subtasks, descriptor.path.subtaskId) }
          : task
      ),
    }
  } else if (descriptor.kind === 'meeting-action') {
    noteData = { ...data, actionItems: toggleById(data.actionItems, descriptor.path.taskId) }
  } else if (descriptor.kind === 'journal-goal') {
    noteData = { ...data, goals: toggleById(data.goals, descriptor.path.taskId) }
  } else if (descriptor.kind === 'weekly-goal') {
    noteData = {
      ...data,
      weeklyGoals: toggleById(data.weeklyGoals || data.goals, descriptor.path.taskId),
    }
  } else if (descriptor.kind === 'weekly-day') {
    const day = asObject(data.days?.[descriptor.path.dayKey])
    noteData = {
      ...data,
      days: {
        ...asObject(data.days),
        [descriptor.path.dayKey]: {
          ...day,
          tasks: toggleById(day.tasks, descriptor.path.taskId),
        },
      },
    }
  } else if (descriptor.kind === 'project-milestone') {
    noteData = { ...data, milestones: toggleById(data.milestones, descriptor.path.taskId) }
  } else if (descriptor.kind === 'project-task') {
    const columns = asArray(data.columns)
    const currentColumn = columns.find((column) =>
      asArray(column?.tasks).some((task) => task?.id === descriptor.path.taskId)
    )
    const currentTask = asArray(currentColumn?.tasks).find(
      (task) => task?.id === descriptor.path.taskId
    )
    const doneColumnId = descriptor.path.doneColumnId
    if (!currentColumn || !currentTask) return null

    if (!doneColumnId) {
      noteData = {
        ...data,
        columns: columns.map((column) => ({
          ...column,
          tasks: asArray(column.tasks).map((task) =>
            task?.id === descriptor.path.taskId
              ? { ...task, completed: !task.completed }
              : task
          ),
        })),
      }
    } else {
      const completing = currentColumn.id !== doneColumnId
      const fallbackColumn = columns.find((column) => column.id === currentTask.previousColumnId)
        || columns.find((column) => /^(todo|to do)$/i.test(column?.id || column?.name || ''))
        || columns.find((column) => column.id !== doneColumnId)
      const targetColumnId = completing ? doneColumnId : fallbackColumn?.id
      if (!targetColumnId) return null
      const movedTask = completing
        ? { ...currentTask, previousColumnId: currentColumn.id }
        : { ...currentTask, previousColumnId: null }
      noteData = {
        ...data,
        columns: columns.map((column) => ({
          ...column,
          tasks: column.id === targetColumnId
            ? [...asArray(column.tasks).filter((task) => task?.id !== descriptor.path.taskId), movedTask]
            : asArray(column.tasks).filter((task) => task?.id !== descriptor.path.taskId),
        })),
      }
    }
  } else {
    return null
  }

  return { noteData }
}

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2, none: 3 }

export const sortWorkspaceTasks = (tasks) =>
  [...tasks].sort((first, second) => {
    if (first.completed !== second.completed) return first.completed ? 1 : -1
    if (Boolean(first.dueDate) !== Boolean(second.dueDate)) return first.dueDate ? -1 : 1
    if (first.dueDate !== second.dueDate) return String(first.dueDate).localeCompare(String(second.dueDate))
    const priorityDifference = PRIORITY_ORDER[first.priority] - PRIORITY_ORDER[second.priority]
    if (priorityDifference) return priorityDifference
    return first.title.localeCompare(second.title)
  })

export const getTaskSummary = (tasks, today = toDateKey(new Date())) => {
  const list = asArray(tasks)
  return {
    total: list.length,
    open: list.filter((task) => !task.completed).length,
    completed: list.filter((task) => task.completed).length,
    today: list.filter((task) => !task.completed && task.dueDate === today).length,
    overdue: list.filter((task) => !task.completed && task.dueDate && task.dueDate < today).length,
  }
}

export const getTodayKey = () => toDateKey(new Date())
