import { useMemo, useState } from 'react'
import { Bell, CalendarClock, Check, Circle, Clock3, FileText, TimerReset } from 'lucide-react'
import toast from 'react-hot-toast'
import { useNotesStore, useUIStore } from '../../store'
import { collectTodayAgenda } from '../../lib/today'
import { completeReminder, normalizeReminder, reminderSourceToKnowledgeTarget, snoozeReminder } from '../../lib/reminders'
import { toggleWorkspaceTask } from '../../lib/workspaceTasks'
import { EmptyState } from '../ui'

const formatTime = (value) => new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(value))

function AgendaSection({ title, children }) {
  return (
    <section className="border-b border-subtle last:border-b-0">
      <h3 className="bg-surface-sunken px-4 py-2 text-ui-xs font-semibold uppercase tracking-wide text-content-muted">{title}</h3>
      {children}
    </section>
  )
}

export default function TodayAgenda({ currentNoteId }) {
  const notes = useNotesStore((state) => state.notes)
  const updateNote = useNotesStore((state) => state.updateNote)
  const navigateToKnowledgeTarget = useNotesStore((state) => state.navigateToKnowledgeTarget)
  const setMobileView = useUIStore((state) => state.setMobileView)
  const [updating, setUpdating] = useState(null)
  const agenda = useMemo(() => collectTodayAgenda(notes, { currentNoteId }), [currentNoteId, notes])

  const openTarget = (target) => {
    if (!target || !navigateToKnowledgeTarget(target)) {
      toast.error('This Today item is no longer accessible')
      return
    }
    setMobileView('editor')
  }

  const toggleTask = async (task) => {
    const source = notes.find((note) => note.id === task.noteId)
    const patch = toggleWorkspaceTask(source, task)
    if (!patch) return
    setUpdating(task.key)
    try {
      await updateNote(task.noteId, patch)
    } catch {
      toast.error('The task could not be updated')
    } finally {
      setUpdating(null)
    }
  }

  const changeReminder = async (descriptor, transition) => {
    const source = notes.find((note) => note.id === descriptor.noteId)
    if (!source) return
    setUpdating(`reminder:${descriptor.id}`)
    const reminders = (source.reminders || []).map((value) => {
      const reminder = normalizeReminder(value, source.id)
      return reminder?.id === descriptor.id ? transition(reminder) : reminder || value
    })
    try {
      await updateNote(source.id, { reminders })
    } catch {
      toast.error('The reminder could not be updated')
    } finally {
      setUpdating(null)
    }
  }

  const empty = !agenda.dueTasks.length && !agenda.reminders.length && !agenda.meetings.length && !agenda.recentNotes.length
  if (empty) return <EmptyState icon={CalendarClock} title="A clear day" description="Due tasks, reminders, meetings, and recently active notes will appear here." size="sm" />

  return (
    <div className="qn-workspace-panel mx-auto max-w-3xl overflow-hidden" aria-label="Today agenda">
      {agenda.dueTasks.length > 0 && (
        <AgendaSection title="Tasks due">
          <ul className="divide-y divide-[var(--qn-border-subtle)]">
            {agenda.dueTasks.map((task) => (
              <li key={task.key} className="flex items-center gap-2 px-3 py-2.5">
                <button type="button" disabled={updating === task.key} onClick={() => void toggleTask(task)} aria-label={`Complete ${task.title}`} className="qn-square-control flex h-9 w-9 items-center justify-center rounded-control text-content-subtle hover:bg-accent-soft hover:text-accent-text disabled:opacity-50">
                  <Circle className="h-4 w-4" aria-hidden="true" />
                </button>
                <button type="button" onClick={() => openTarget({ noteId: task.noteId })} className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-ui-md font-medium text-content">{task.title}</span>
                  <span className="block truncate text-ui-xs text-content-muted">{task.noteTitle}{task.dueDate < agenda.today ? ' · Overdue' : ' · Due today'}</span>
                </button>
              </li>
            ))}
          </ul>
        </AgendaSection>
      )}
      {agenda.reminders.length > 0 && (
        <AgendaSection title="Reminders">
          <ul className="divide-y divide-[var(--qn-border-subtle)]">
            {agenda.reminders.map((reminder) => (
              <li key={`${reminder.noteId}:${reminder.id}`} className="flex items-center gap-2 px-3 py-2.5">
                <Bell className="mx-2 h-4 w-4 shrink-0 text-accent-text" aria-hidden="true" />
                <button type="button" onClick={() => openTarget(reminderSourceToKnowledgeTarget(reminder.source))} className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-ui-md font-medium text-content">{reminder.title || reminder.sourceLabel}</span>
                  <span className="block truncate text-ui-xs text-content-muted">{reminder.noteTitle} · {formatTime(reminder.datetime)}</span>
                </button>
                <button type="button" disabled={updating === `reminder:${reminder.id}`} onClick={() => void changeReminder(reminder, (value) => snoozeReminder(value, 10))} aria-label={`Snooze ${reminder.title || reminder.sourceLabel} for 10 minutes`} className="qn-square-control flex h-9 w-9 items-center justify-center rounded-control text-content-muted hover:bg-surface-hover disabled:opacity-50"><TimerReset className="h-4 w-4" aria-hidden="true" /></button>
                <button type="button" disabled={updating === `reminder:${reminder.id}`} onClick={() => void changeReminder(reminder, (value) => completeReminder(value))} aria-label={`Complete ${reminder.title || reminder.sourceLabel}`} className="qn-square-control flex h-9 w-9 items-center justify-center rounded-control text-success-text hover:bg-success-soft disabled:opacity-50"><Check className="h-4 w-4" aria-hidden="true" /></button>
              </li>
            ))}
          </ul>
        </AgendaSection>
      )}
      {agenda.meetings.length > 0 && (
        <AgendaSection title="Meetings">
          <ul className="divide-y divide-[var(--qn-border-subtle)]">
            {agenda.meetings.map((meeting) => (
              <li key={meeting.id}>
                <button type="button" onClick={() => openTarget({ noteId: meeting.id })} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-hover">
                  <Clock3 className="h-4 w-4 shrink-0 text-content-subtle" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate text-ui-md font-medium text-content">{meeting.title || 'Untitled meeting'}</span>
                  <span className="text-ui-xs tabular-nums text-content-muted">{meeting.noteData?.startTime || 'Time not set'}</span>
                </button>
              </li>
            ))}
          </ul>
        </AgendaSection>
      )}
      {agenda.recentNotes.length > 0 && (
        <AgendaSection title="Recently active">
          <ul className="divide-y divide-[var(--qn-border-subtle)]">
            {agenda.recentNotes.map((note) => (
              <li key={note.id}>
                <button type="button" onClick={() => openTarget({ noteId: note.id })} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-hover">
                  <FileText className="h-4 w-4 shrink-0 text-content-subtle" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate text-ui-md text-content">{note.title || 'Untitled note'}</span>
                </button>
              </li>
            ))}
          </ul>
        </AgendaSection>
      )}
    </div>
  )
}
