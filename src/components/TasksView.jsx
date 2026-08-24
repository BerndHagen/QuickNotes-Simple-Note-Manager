import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  ListChecks,
  Plus,
  Search,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useNotesStore, useUIStore } from '../store'
import {
  collectWorkspaceTasks,
  getTaskSummary,
  getTodayKey,
  sortWorkspaceTasks,
  toggleWorkspaceTask,
} from '../lib/workspaceTasks'
import { getDefaultData, NOTE_TYPES } from './editors/noteTypes'
import { Button, EmptyState, Input, Modal } from './ui'

const FILTERS = [
  { id: 'open', label: 'Open' },
  { id: 'today', label: 'Today' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'completed', label: 'Completed' },
  { id: 'all', label: 'All' },
]

const PRIORITY_LABELS = {
  high: 'High priority',
  medium: 'Medium priority',
  low: 'Low priority',
}

const TYPE_LABELS = {
  standard: 'Document',
  todo: 'Task list',
  project: 'Project',
  meeting: 'Meeting',
  journal: 'Journal',
  weekly: 'Weekly plan',
}

const parseDateKey = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''))
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null
}

const formatDueDate = (dateKey, today) => {
  if (!dateKey) return ''
  if (dateKey === today) return 'Today'
  const date = parseDateKey(dateKey)
  if (!date) return dateKey
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(date)
}

const matchesFilter = (task, filter, today) => {
  if (filter === 'open') return !task.completed
  if (filter === 'today') return !task.completed && task.dueDate === today
  if (filter === 'upcoming') return !task.completed && task.dueDate > today
  if (filter === 'overdue') return !task.completed && task.dueDate && task.dueDate < today
  if (filter === 'completed') return task.completed
  return true
}

function SummaryItem({ label, value, tone = 'neutral' }) {
  const toneClass = tone === 'danger'
    ? 'text-danger-text'
    : tone === 'accent'
      ? 'text-accent-text'
      : 'text-content'
  return (
    <div className="min-w-[6.25rem] border-r border-subtle pr-4 last:border-r-0">
      <strong className={`block text-xl font-semibold tabular-nums ${toneClass}`}>{value}</strong>
      <span className="block text-ui-xs font-medium text-content-muted">{label}</span>
    </div>
  )
}

export default function TasksView() {
  const tasksViewOpen = useUIStore((state) => state.tasksViewOpen)
  const setTasksViewOpen = useUIStore((state) => state.setTasksViewOpen)
  const setMobileView = useUIStore((state) => state.setMobileView)
  const notes = useNotesStore((state) => state.notes)
  const updateNote = useNotesStore((state) => state.updateNote)
  const setSelectedNote = useNotesStore((state) => state.setSelectedNote)
  const createNote = useNotesStore((state) => state.createNote)
  const [filter, setFilter] = useState('open')
  const [query, setQuery] = useState('')
  const [updatingKey, setUpdatingKey] = useState(null)
  const today = getTodayKey()

  const allTasks = useMemo(() => sortWorkspaceTasks(collectWorkspaceTasks(notes)), [notes])
  const summary = useMemo(() => getTaskSummary(allTasks, today), [allTasks, today])
  const visibleTasks = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return allTasks.filter((task) => {
      if (!matchesFilter(task, filter, today)) return false
      if (!normalizedQuery) return true
      return [task.title, task.noteTitle, task.context, TYPE_LABELS[task.noteType]]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalizedQuery))
    })
  }, [allTasks, filter, query, today])

  const close = () => setTasksViewOpen(false)
  const openSource = (task) => {
    setSelectedNote(task.noteId)
    setMobileView('editor')
    close()
  }

  const toggleTask = async (task) => {
    if (!task.canToggle || updatingKey) return
    const source = notes.find((note) => note.id === task.noteId)
    const patch = toggleWorkspaceTask(source, task)
    if (!patch) {
      toast.error('This task could not be updated from the task center')
      return
    }
    setUpdatingKey(task.key)
    try {
      await updateNote(task.noteId, patch)
    } catch {
      toast.error('The task could not be updated')
    } finally {
      setUpdatingKey(null)
    }
  }

  const createTaskList = () => {
    createNote({
      title: 'Task list',
      noteType: NOTE_TYPES.TODO_LIST,
      noteData: getDefaultData(NOTE_TYPES.TODO_LIST),
    })
    setMobileView('editor')
    close()
  }

  return (
    <Modal
      open={tasksViewOpen}
      onClose={close}
      title="My Tasks"
      description="One place for commitments across your workspace"
      icon={ListChecks}
      size="3xl"
      contentClassName="h-[92dvh] sm:h-auto"
      bodyPadding="none"
      bodyClassName="!overflow-hidden"
      footer={(
        <>
          <span className="mr-auto hidden text-ui-sm text-content-muted sm:block" role="status" aria-live="polite">
            {visibleTasks.length} task{visibleTasks.length === 1 ? '' : 's'} shown
          </span>
          <Button variant="ghost" className="hidden sm:inline-flex" onClick={close}>Close</Button>
          <Button variant="primary" icon={Plus} className="w-full sm:w-auto" onClick={createTaskList}>New task list</Button>
        </>
      )}
    >
      <div className="flex h-full min-h-0 flex-col bg-surface sm:h-[min(72dvh,700px)]">
        <section aria-label="Task summary" className="shrink-0 border-b border-subtle bg-surface-brand-tint px-5 py-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <SummaryItem label="Open" value={summary.open} tone="accent" />
            <SummaryItem label="Due today" value={summary.today} />
            <SummaryItem label="Overdue" value={summary.overdue} tone={summary.overdue ? 'danger' : 'neutral'} />
            <SummaryItem label="Completed" value={summary.completed} />
          </div>
        </section>

        <div className="shrink-0 space-y-3 border-b border-subtle bg-surface-raised px-4 py-3 sm:px-5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-subtle" aria-hidden="true" />
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Search tasks"
              placeholder="Search tasks, projects, and source notes"
              className="pl-9"
            />
          </div>
          <div role="group" aria-label="Task filters" className="flex gap-1 overflow-x-auto pb-0.5">
            {FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={filter === item.id}
                onClick={() => setFilter(item.id)}
                className={`qn-touch-target h-8 shrink-0 rounded-control px-3 text-ui-sm font-medium transition-colors ${
                  filter === item.id
                    ? 'bg-accent-soft text-accent-text'
                    : 'text-content-muted hover:bg-surface-hover hover:text-content'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {visibleTasks.length === 0 ? (
            <EmptyState
              icon={filter === 'completed' ? CheckCircle2 : ListChecks}
              title={query ? 'No matching tasks' : filter === 'open' ? 'You are caught up' : `No ${filter} tasks`}
              description={query ? 'Try another search or filter.' : 'Tasks from documents and focused workspaces appear here automatically.'}
              action={filter !== 'open' || query ? (
                <Button size="sm" variant="secondary" onClick={() => { setFilter('open'); setQuery('') }}>
                  Show open tasks
                </Button>
              ) : null}
            />
          ) : (
            <ul className="divide-y divide-[var(--qn-border-subtle)]" aria-label="Workspace tasks">
              {visibleTasks.map((task) => {
                const overdue = !task.completed && task.dueDate && task.dueDate < today
                const dueToday = !task.completed && task.dueDate === today
                const ToggleIcon = task.completed ? Check : Circle
                return (
                  <li key={task.key} className="group flex items-start gap-3 px-4 py-3 hover:bg-surface-hover sm:px-5">
                    <button
                      type="button"
                      disabled={!task.canToggle || updatingKey === task.key}
                      aria-label={task.completed ? `Mark ${task.title} incomplete` : `Complete ${task.title}`}
                      onClick={() => toggleTask(task)}
                      className={`qn-touch-target -m-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-control transition-colors ${
                        task.completed
                          ? 'text-success-text hover:bg-success-soft'
                          : 'text-content-subtle hover:bg-accent-soft hover:text-accent-text'
                      } disabled:cursor-not-allowed disabled:opacity-45`}
                    >
                      <ToggleIcon className="h-[18px] w-[18px]" aria-hidden="true" />
                    </button>

                    <button
                      type="button"
                      onClick={() => openSource(task)}
                      className="min-w-0 flex-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--qn-focus-ring)]"
                    >
                      <span className={`block text-ui-lg font-medium ${task.completed ? 'text-content-subtle line-through' : 'text-content'}`}>
                        {task.title}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-ui-xs text-content-muted">
                        <span className="font-medium">{task.noteTitle}</span>
                        <span aria-hidden="true">·</span>
                        <span>{TYPE_LABELS[task.noteType] || 'Note'}</span>
                        {task.context && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="truncate">{task.context}</span>
                          </>
                        )}
                      </span>
                      <span className="mt-1.5 flex flex-wrap items-center gap-2">
                        {task.dueDate && (
                          <span className={`inline-flex items-center gap-1 text-ui-xs font-medium ${
                            overdue ? 'text-danger-text' : dueToday ? 'text-accent-text' : 'text-content-muted'
                          }`}>
                            {overdue ? <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> : <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />}
                            {overdue ? 'Overdue · ' : ''}{formatDueDate(task.dueDate, today)}
                          </span>
                        )}
                        {PRIORITY_LABELS[task.priority] && (
                          <span className={`text-ui-xs font-medium ${task.priority === 'high' ? 'text-danger-text' : 'text-content-muted'}`}>
                            {PRIORITY_LABELS[task.priority]}
                          </span>
                        )}
                      </span>
                    </button>

                    <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-content-subtle transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  )
}
