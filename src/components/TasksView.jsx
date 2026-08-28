import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  Bell,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  ExternalLink,
  ListChecks,
  Plus,
  Search,
  TimerReset,
  X,
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
import { taskSourceToKnowledgeTarget } from '../lib/taskSources'
import {
  collectWorkspaceReminders,
  completeReminder,
  dismissReminder,
  normalizeReminder,
  REMINDER_STATUSES,
  reminderSourceForTask,
  reminderSourceToKnowledgeTarget,
  snoozeReminder,
} from '../lib/reminders'
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

const dateTimeKey = (value) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const matchesReminderFilter = (reminder, filter, today, now) => {
  const active = [REMINDER_STATUSES.SCHEDULED, REMINDER_STATUSES.TRIGGERED].includes(reminder.status)
  const dueKey = dateTimeKey(reminder.datetime)
  const dueTime = Date.parse(reminder.datetime)
  if (filter === 'open') return active
  if (filter === 'today') return active && dueKey === today
  if (filter === 'upcoming') return active && dueKey > today
  if (filter === 'overdue') return active && Number.isFinite(dueTime) && dueTime < now && dueKey < today
  if (filter === 'completed') return [REMINDER_STATUSES.COMPLETED, REMINDER_STATUSES.DISMISSED].includes(reminder.status)
  return true
}

const formatReminderDate = (value) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Invalid date'
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
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
  const setReminderModalOpen = useUIStore((state) => state.setReminderModalOpen)
  const notes = useNotesStore((state) => state.notes)
  const updateNote = useNotesStore((state) => state.updateNote)
  const setSelectedNote = useNotesStore((state) => state.setSelectedNote)
  const navigateToKnowledgeTarget = useNotesStore((state) => state.navigateToKnowledgeTarget)
  const createNote = useNotesStore((state) => state.createNote)
  const [filter, setFilter] = useState('open')
  const [query, setQuery] = useState('')
  const [updatingKey, setUpdatingKey] = useState(null)
  const today = getTodayKey()

  const allTasks = useMemo(() => sortWorkspaceTasks(collectWorkspaceTasks(notes)), [notes])
  const allReminders = useMemo(() => collectWorkspaceReminders(notes), [notes])
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
  const visibleReminders = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    const now = Date.now()
    return allReminders.filter((reminder) => {
      if (!matchesReminderFilter(reminder, filter, today, now)) return false
      if (!normalizedQuery) return true
      return [reminder.title, reminder.noteTitle, reminder.sourceLabel]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalizedQuery))
    })
  }, [allReminders, filter, query, today])
  const dueReminderCount = allReminders.filter((reminder) =>
    [REMINDER_STATUSES.SCHEDULED, REMINDER_STATUSES.TRIGGERED].includes(reminder.status) &&
    Date.parse(reminder.datetime) <= Date.now()
  ).length

  const close = () => setTasksViewOpen(false)
  const openSource = (task) => {
    setSelectedNote(task.noteId)
    setMobileView('editor')
    close()
  }

  const openCaptureSource = (task) => {
    const target = taskSourceToKnowledgeTarget(task.sourceReference)
    const sourceNote = target && notes.find((note) => note.id === target.noteId)
    if (!target || !sourceNote || sourceNote.deleted) {
      toast.error('The original capture is no longer available in this workspace')
      return
    }
    if (!navigateToKnowledgeTarget(target)) {
      toast.error('The original capture is no longer accessible')
      return
    }
    setMobileView('editor')
    close()
  }

  const openReminderSource = (reminder) => {
    const target = reminderSourceToKnowledgeTarget(reminder.source)
    if (!target || !navigateToKnowledgeTarget(target)) {
      toast.error('The reminder source is no longer accessible')
      return
    }
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

  const transitionReminder = async (descriptor, transition) => {
    const sourceNote = notes.find((note) => note.id === descriptor.noteId)
    if (!sourceNote) return
    const values = Array.isArray(sourceNote.reminders) ? sourceNote.reminders : []
    const reminders = values.map((value) => {
      const reminder = normalizeReminder(value, sourceNote.id)
      return reminder?.id === descriptor.id ? transition(reminder) : reminder || value
    })
    try {
      await updateNote(sourceNote.id, { reminders })
    } catch {
      toast.error('The reminder could not be updated')
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
            {visibleTasks.length} task{visibleTasks.length === 1 ? '' : 's'} and {visibleReminders.length} reminder{visibleReminders.length === 1 ? '' : 's'} shown
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
            <SummaryItem label="Reminders due" value={dueReminderCount} tone={dueReminderCount ? 'danger' : 'neutral'} />
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
          {visibleTasks.length === 0 && visibleReminders.length === 0 ? (
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
            <>
            {visibleReminders.length > 0 && (
              <section aria-labelledby="qn-task-center-reminders" className="border-b border-subtle bg-surface-raised">
                <h2 id="qn-task-center-reminders" className="border-b border-subtle px-5 py-2 text-ui-xs font-semibold uppercase tracking-wide text-content-muted">Reminders</h2>
                <ul className="divide-y divide-[var(--qn-border-subtle)]">
                  {visibleReminders.map((reminder) => {
                    const active = [REMINDER_STATUSES.SCHEDULED, REMINDER_STATUSES.TRIGGERED].includes(reminder.status)
                    return (
                      <li key={`${reminder.noteId}:${reminder.id}`} className="flex items-start gap-3 px-4 py-3 hover:bg-surface-hover sm:px-5">
                        <Bell className={`mt-1 h-4 w-4 shrink-0 ${reminder.status === REMINDER_STATUSES.TRIGGERED ? 'text-danger-text' : 'text-accent-text'}`} aria-hidden="true" />
                        <button type="button" className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--qn-focus-ring)]" onClick={() => openReminderSource(reminder)}>
                          <span className="block text-ui-md font-medium text-content">{reminder.title || reminder.sourceLabel}</span>
                          <span className="mt-1 block text-ui-xs text-content-muted">{reminder.noteTitle} · {formatReminderDate(reminder.datetime)}{reminder.repeat !== 'none' ? ` · Repeats ${reminder.repeat}` : ''}</span>
                        </button>
                        {active && (
                          <div className="flex shrink-0 items-center gap-1">
                            <button type="button" className="qn-touch-target flex h-9 w-9 items-center justify-center rounded-control text-content-muted hover:bg-surface-hover" aria-label={`Snooze ${reminder.title || reminder.sourceLabel} for 10 minutes`} onClick={() => void transitionReminder(reminder, (value) => snoozeReminder(value, 10))}>
                              <TimerReset className="h-4 w-4" aria-hidden="true" />
                            </button>
                            <button type="button" className="qn-touch-target flex h-9 w-9 items-center justify-center rounded-control text-success-text hover:bg-success-soft" aria-label={`Complete ${reminder.title || reminder.sourceLabel}`} onClick={() => void transitionReminder(reminder, (value) => completeReminder(value))}>
                              <Check className="h-4 w-4" aria-hidden="true" />
                            </button>
                            <button type="button" className="qn-touch-target flex h-9 w-9 items-center justify-center rounded-control text-content-muted hover:bg-surface-hover" aria-label={`Dismiss ${reminder.title || reminder.sourceLabel}`} onClick={() => void transitionReminder(reminder, (value) => dismissReminder(value))}>
                              <X className="h-4 w-4" aria-hidden="true" />
                            </button>
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </section>
            )}
            {visibleTasks.length > 0 && <ul className="divide-y divide-[var(--qn-border-subtle)]" aria-label="Workspace tasks">
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

                    {task.sourceReference && (
                      <button
                        type="button"
                        onClick={() => openCaptureSource(task)}
                        className="qn-touch-target -my-1 inline-flex h-9 shrink-0 items-center gap-1.5 rounded-control px-2 text-ui-xs font-medium text-accent-text hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--qn-focus-ring)]"
                        aria-label={`Open original capture for ${task.title}`}
                        title="Open original capture"
                      >
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                        <span className="hidden lg:inline">Source</span>
                      </button>
                    )}
                    {!task.completed && (
                      <button
                        type="button"
                        onClick={() => setReminderModalOpen(true, task.noteId, reminderSourceForTask(task))}
                        className="qn-touch-target -my-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-control text-content-muted hover:bg-surface-hover hover:text-content focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--qn-focus-ring)]"
                        aria-label={`Set reminder for ${task.title}`}
                        title="Set reminder"
                      >
                        <Bell className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    )}
                    <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-content-subtle transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                  </li>
                )
              })}
            </ul>}
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}
