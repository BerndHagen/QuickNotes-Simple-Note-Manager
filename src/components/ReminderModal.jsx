import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, Bell, Calendar, Check, Clock, Plus, Trash2 } from 'lucide-react'
import { useNotesStore, useUIStore } from '../store'
import { useTranslation } from '../lib/useTranslation'
import { getNextReminderDate } from '../lib/reminders'
import { Badge, Button, Field, IconButton, Input, Modal, Select } from './ui'

const toDateInputValue = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const getDefaultReminderDate = () => {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  return toDateInputValue(tomorrow)
}

const getReminderStatus = (reminder) => {
  const now = new Date()
  const reminderTime = new Date(reminder.datetime)
  if (reminder.notified) return 'sent'
  if (reminderTime <= now) return 'overdue'

  const hoursUntilReminder = (reminderTime - now) / (1000 * 60 * 60)
  if (hoursUntilReminder < 1) return 'soon'
  if (hoursUntilReminder < 24) return 'today'
  return 'upcoming'
}

const STATUS_PRESENTATION = {
  sent: { tone: 'success', icon: Check, fallback: 'Sent' },
  overdue: { tone: 'danger', icon: AlertCircle, fallback: 'Overdue' },
  soon: { tone: 'warning', icon: Bell, fallback: 'Due soon' },
  today: { tone: 'warning', icon: Bell, fallback: 'Today' },
  upcoming: { tone: 'info', icon: Bell, fallback: 'Upcoming' },
}

export default function ReminderModal() {
  const { reminderModalOpen, setReminderModalOpen, reminderNoteId } = useUIStore()
  const { notes, updateNote, getSelectedNote } = useNotesStore()
  const { t, language } = useTranslation()
  const [date, setDate] = useState(getDefaultReminderDate)
  const [time, setTime] = useState('09:00')
  const [repeat, setRepeat] = useState('none')
  const [reminders, setReminders] = useState([])
  const [validationError, setValidationError] = useState('')
  const [notificationWarning, setNotificationWarning] = useState('')

  const note = reminderNoteId
    ? notes.find((candidate) => candidate.id === reminderNoteId)
    : getSelectedNote()

  const resetForm = useCallback(() => {
    setDate(getDefaultReminderDate())
    setTime('09:00')
    setRepeat('none')
    setValidationError('')
    setNotificationWarning('')
  }, [])

  const closeModal = useCallback(() => {
    setReminderModalOpen(false)
    resetForm()
  }, [resetForm, setReminderModalOpen])

  useEffect(() => {
    setReminders(note?.reminders || [])
  }, [note?.id, note?.reminders])

  useEffect(() => {
    if (reminderModalOpen) resetForm()
  }, [note?.id, reminderModalOpen, resetForm])

  useEffect(() => {
    const checkReminders = () => {
      const now = new Date()

      notes.forEach((candidate) => {
        if (!candidate.reminders?.length) return

        let changed = false
        const updatedReminders = candidate.reminders.map((reminder) => {
          if (reminder.notified) return reminder

          const reminderTime = new Date(reminder.datetime)
          if (reminderTime > now) return reminder

          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('QuickNotes Reminder', {
              body: `📝 ${candidate.title}`,
              icon: `${import.meta.env.BASE_URL}favicon.png`,
              tag: reminder.id,
            })
          }

          changed = true
          const nextDate = getNextReminderDate(
            reminder.datetime,
            reminder.repeat,
            now,
            reminder.repeatDay
          )
          return nextDate
            ? {
                ...reminder,
                datetime: nextDate.toISOString(),
                notified: false,
                lastTriggeredAt: now.toISOString(),
              }
            : { ...reminder, notified: true, lastTriggeredAt: now.toISOString() }
        })

        if (changed) void updateNote(candidate.id, { reminders: updatedReminders })
      })
    }

    checkReminders()
    const interval = window.setInterval(checkReminders, 60_000)
    return () => window.clearInterval(interval)
  }, [notes, updateNote])

  const formatReminderDate = useCallback(
    (datetime) => {
      const reminderDate = new Date(datetime)
      const now = new Date()
      const tomorrow = new Date(now)
      tomorrow.setDate(tomorrow.getDate() + 1)

      const timeLabel = new Intl.DateTimeFormat(language, {
        hour: '2-digit',
        minute: '2-digit',
      }).format(reminderDate)

      if (reminderDate.toDateString() === now.toDateString()) {
        return `${t('reminders.today')}, ${timeLabel}`
      }
      if (reminderDate.toDateString() === tomorrow.toDateString()) {
        return `${t('reminders.tomorrow')}, ${timeLabel}`
      }

      return new Intl.DateTimeFormat(language, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(reminderDate)
    },
    [language, t]
  )

  const getRepeatLabel = (value) => {
    if (value === 'daily') return t('reminders.daily')
    if (value === 'weekly') return t('reminders.weekly')
    if (value === 'monthly') return t('reminders.monthly')
    return ''
  }

  const handleAddReminder = async (event) => {
    event.preventDefault()
    if (!date || !time || !note) return

    const datetime = new Date(`${date}T${time}`)
    if (Number.isNaN(datetime.getTime()) || datetime <= new Date()) {
      setValidationError(t('reminders.selectFutureDate'))
      return
    }

    setValidationError('')
    setNotificationWarning('')

    if (!('Notification' in window)) {
      setNotificationWarning(
        t(
          'reminders.notificationsUnavailable',
          'System notifications are not available in this browser. The reminder will remain visible here.'
        )
      )
    } else if (Notification.permission === 'default') {
      try {
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') {
          setNotificationWarning(t('reminders.enableNotifications'))
        }
      } catch {
        setNotificationWarning(
          t(
            'reminders.notificationPermissionFailed',
            'Notification permission could not be requested. Check your browser settings.'
          )
        )
      }
    }

    const newReminder = {
      id: `reminder_${Date.now()}`,
      datetime: datetime.toISOString(),
      repeat,
      ...(repeat === 'monthly' ? { repeatDay: datetime.getDate() } : {}),
      notified: false,
      createdAt: new Date().toISOString(),
    }

    const updatedReminders = [...reminders, newReminder]
    setReminders(updatedReminders)
    void updateNote(note.id, { reminders: updatedReminders })
    setDate(getDefaultReminderDate())
    setTime('09:00')
    setRepeat('none')
  }

  const handleDeleteReminder = (reminderId) => {
    const updatedReminders = reminders.filter((reminder) => reminder.id !== reminderId)
    setReminders(updatedReminders)
    if (note) void updateNote(note.id, { reminders: updatedReminders })
  }

  const notificationsDenied =
    typeof window !== 'undefined' &&
    'Notification' in window &&
    Notification.permission === 'denied'

  return (
    <Modal
      open={reminderModalOpen}
      onClose={closeModal}
      title={t('reminders.title')}
      description={t('reminders.subtitle', 'Set reminders for your notes')}
      icon={Bell}
      size="md"
    >
      <div className="space-y-5">
        {note ? (
          <div className="rounded-card border border-subtle bg-surface-sunken px-3 py-2.5">
            <p className="text-ui-sm text-content-muted">{t('reminders.remindersFor')}</p>
            <p className="truncate text-ui-lg font-medium text-content">{note.title}</p>
          </div>
        ) : (
          <div role="alert" className="rounded-card border border-danger-border bg-danger-soft p-3 text-ui-md text-danger-text">
            {t('reminders.noNoteSelected', 'Select a note before adding a reminder.')}
          </div>
        )}

        <form
          onSubmit={handleAddReminder}
          className="space-y-4 rounded-card border border-subtle bg-surface-sunken p-4"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={t('reminders.date')} htmlFor="qn-reminder-date">
              <div className="relative">
                <Calendar
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-subtle"
                  aria-hidden="true"
                />
                <Input
                  id="qn-reminder-date"
                  type="date"
                  value={date}
                  min={toDateInputValue(new Date())}
                  onChange={(event) => {
                    setDate(event.target.value)
                    setValidationError('')
                  }}
                  className="pl-9"
                  data-autofocus
                />
              </div>
            </Field>

            <Field label={t('reminders.time')} htmlFor="qn-reminder-time">
              <div className="relative">
                <Clock
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-subtle"
                  aria-hidden="true"
                />
                <Input
                  id="qn-reminder-time"
                  type="time"
                  value={time}
                  onChange={(event) => {
                    setTime(event.target.value)
                    setValidationError('')
                  }}
                  className="pl-9"
                />
              </div>
            </Field>
          </div>

          <Field label={t('reminders.repeat')} htmlFor="qn-reminder-repeat">
            <Select
              id="qn-reminder-repeat"
              value={repeat}
              onChange={(event) => setRepeat(event.target.value)}
            >
              <option value="none">{t('reminders.dontRepeat')}</option>
              <option value="daily">{t('reminders.daily')}</option>
              <option value="weekly">{t('reminders.weekly')}</option>
              <option value="monthly">{t('reminders.monthly')}</option>
            </Select>
          </Field>

          {validationError && (
            <p role="alert" className="text-ui-sm font-medium text-danger-text">
              {validationError}
            </p>
          )}

          <Button type="submit" variant="primary" icon={Plus} fullWidth disabled={!note}>
            {t('reminders.addReminder')}
          </Button>
        </form>

        <section aria-labelledby="qn-reminders-list-heading">
          <h3 id="qn-reminders-list-heading" className="mb-2 text-ui-sm font-semibold text-content-muted">
            {t('reminders.scheduled', 'Scheduled reminders')}
          </h3>

          {reminders.length === 0 ? (
            <div className="rounded-card border border-dashed border-subtle py-7 text-center text-content-muted">
              <Bell className="mx-auto mb-2 h-9 w-9 opacity-35" aria-hidden="true" />
              <p className="text-ui-md font-medium">{t('reminders.noReminders')}</p>
              <p className="mt-1 text-ui-sm">{t('reminders.addReminderHint')}</p>
            </div>
          ) : (
            <ul className="max-h-64 space-y-2 overflow-y-auto overscroll-contain pr-1" aria-live="polite">
              {[...reminders]
                .sort((first, second) => new Date(first.datetime) - new Date(second.datetime))
                .map((reminder) => {
                  const status = getReminderStatus(reminder)
                  const presentation = STATUS_PRESENTATION[status]
                  const StatusIcon = presentation.icon
                  const formattedDate = formatReminderDate(reminder.datetime)
                  return (
                    <li
                      key={reminder.id}
                      className="flex items-center gap-3 rounded-card border border-subtle bg-surface-raised p-3"
                    >
                      <StatusIcon className="h-5 w-5 shrink-0 text-content-muted" aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-ui-md font-medium text-content">{formattedDate}</p>
                          <Badge tone={presentation.tone}>
                            {t(`reminders.status.${status}`, presentation.fallback)}
                          </Badge>
                        </div>
                        {reminder.repeat !== 'none' && (
                          <p className="mt-0.5 text-ui-sm text-content-muted">
                            {t('reminders.repeats')} {getRepeatLabel(reminder.repeat)}
                          </p>
                        )}
                      </div>
                      <IconButton
                        icon={Trash2}
                        size="sm"
                        variant="danger-ghost"
                        label={t('reminders.deleteReminder', `Delete reminder for ${formattedDate}`)}
                        onClick={() => handleDeleteReminder(reminder.id)}
                      />
                    </li>
                  )
                })}
            </ul>
          )}
        </section>

        {(notificationsDenied || notificationWarning) && (
          <div
            role="status"
            className="flex items-start gap-2 rounded-card border border-warning-border bg-warning-soft p-3 text-content"
          >
            <AlertCircle
              className="mt-0.5 h-5 w-5 shrink-0 text-warning-text"
              aria-hidden="true"
            />
            <div>
              <p className="text-ui-md font-medium">{t('reminders.notificationsBlocked')}</p>
              <p className="mt-0.5 text-ui-sm">
                {notificationWarning || t('reminders.enableNotifications')}
              </p>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
