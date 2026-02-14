import React, { useState, useEffect } from 'react'
import { X, Bell, Calendar, Clock, Trash2, Plus, Check, AlertCircle } from 'lucide-react'
import { useNotesStore, useUIStore } from '../store'
import { useTranslation } from '../lib/useTranslation'

export default function ReminderModal() {
  const { reminderModalOpen, setReminderModalOpen, reminderNoteId } = useUIStore()
  const { notes, updateNote, getSelectedNote } = useNotesStore()
  const { t } = useTranslation()
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [repeat, setRepeat] = useState('none')
  const [reminders, setReminders] = useState([])

  const note = reminderNoteId ? notes.find(n => n.id === reminderNoteId) : getSelectedNote()
  useEffect(() => {
    if (note?.reminders) {
      setReminders(note.reminders)
    } else {
      setReminders([])
    }
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    setDate(tomorrow.toISOString().split('T')[0])
    setTime('09:00')
  }, [note?.id, reminderModalOpen])
  useEffect(() => {
    const checkReminders = () => {
      const now = new Date()
      
      notes.forEach(n => {
        if (n.reminders && n.reminders.length > 0) {
          n.reminders.forEach(reminder => {
            if (reminder.notified) return
            
            const reminderTime = new Date(reminder.datetime)
            if (reminderTime <= now) {
              if (Notification.permission === 'granted') {
                new Notification('QuickNotes Reminder', {
                  body: `\u{1F4DD} ${n.title}`,
                  icon: '/favicon.ico',
                  tag: reminder.id,
                })
              }
              const updatedReminders = n.reminders.map(r => 
                r.id === reminder.id ? { ...r, notified: true } : r
              )
              updateNote(n.id, { reminders: updatedReminders })
            }
          })
        }
      })
    }
    checkReminders()
    const interval = setInterval(checkReminders, 60000)
    
    return () => clearInterval(interval)
  }, [notes])
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  if (!reminderModalOpen) return null

  const handleAddReminder = () => {
    if (!date || !time || !note) return

    const datetime = new Date(`${date}T${time}`)
    
    if (datetime <= new Date()) {
      alert(t('reminders.selectFutureDate'))
      return
    }

    const newReminder = {
      id: `reminder_${Date.now()}`,
      datetime: datetime.toISOString(),
      repeat,
      notified: false,
      createdAt: new Date().toISOString(),
    }

    const updatedReminders = [...reminders, newReminder]
    setReminders(updatedReminders)
    updateNote(note.id, { reminders: updatedReminders })
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    setDate(tomorrow.toISOString().split('T')[0])
    setTime('09:00')
    setRepeat('none')
  }

  const handleDeleteReminder = (reminderId) => {
    const updatedReminders = reminders.filter(r => r.id !== reminderId)
    setReminders(updatedReminders)
    if (note) {
      updateNote(note.id, { reminders: updatedReminders })
    }
  }

  const formatReminderDate = (datetime) => {
    const date = new Date(datetime)
    const now = new Date()
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    const isToday = date.toDateString() === now.toDateString()
    const isTomorrow = date.toDateString() === tomorrow.toDateString()
    
    const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    
    if (isToday) return `${t('reminders.today')} at ${timeStr}`
    if (isTomorrow) return `${t('reminders.tomorrow')} at ${timeStr}`
    
    return date.toLocaleDateString('en-US', { 
      weekday: 'short',
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getReminderStatus = (reminder) => {
    const now = new Date()
    const reminderTime = new Date(reminder.datetime)
    
    if (reminder.notified) return 'completed'
    if (reminderTime <= now) return 'overdue'
    
    const diffMs = reminderTime - now
    const diffHours = diffMs / (1000 * 60 * 60)
    
    if (diffHours < 1) return 'soon'
    if (diffHours < 24) return 'today'
    return 'upcoming'
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-50 dark:bg-green-900/20'
      case 'overdue': return 'text-red-600 bg-red-50 dark:bg-red-900/20'
      case 'soon': return 'text-orange-600 bg-orange-50 dark:bg-orange-900/20'
      case 'today': return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20'
      default: return 'text-blue-600 bg-blue-50 dark:bg-blue-900/20'
    }
  }

  const getRepeatLabel = (repeat) => {
    switch (repeat) {
      case 'daily': return t('reminders.daily')
      case 'weekly': return t('reminders.weekly')
      case 'monthly': return t('reminders.monthly')
      default: return ''
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center modal-backdrop-animate" onClick={() => setReminderModalOpen(false)}>
      <div 
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-[#cbd1db] dark:border-gray-700 max-w-md w-full mx-4 modal-animate overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
          <div className="flex items-center gap-3">
            <Bell className="w-6 h-6" />
            <div>
              <h2 className="text-lg font-bold">{t('reminders.title')}</h2>
              <p className="text-sm text-white/70">Set reminders for your notes</p>
            </div>
          </div>
          <button
            onClick={() => setReminderModalOpen(false)}
            className="p-2 rounded-full hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">
        {note && (
          <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-300 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('reminders.remindersFor')}</p>
            <p className="font-medium text-gray-900 dark:text-white truncate">{note.title}</p>
          </div>
        )}
        <div className="space-y-3 mb-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-300 dark:border-gray-700">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('reminders.date')}</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full pl-10 pr-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
                />
              </div>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('reminders.time')}</label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('reminders.repeat')}</label>
            <select
              value={repeat}
              onChange={(e) => setRepeat(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
            >
              <option value="none">{t('reminders.dontRepeat')}</option>
              <option value="daily">{t('reminders.daily')}</option>
              <option value="weekly">{t('reminders.weekly')}</option>
              <option value="monthly">{t('reminders.monthly')}</option>
            </select>
          </div>

          <button
            onClick={handleAddReminder}
            className="w-full py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            {t('reminders.addReminder')}
          </button>
        </div>
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {reminders.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <Bell className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p>{t('reminders.noReminders')}</p>
              <p className="text-xs mt-1">{t('reminders.addReminderHint')}</p>
            </div>
          ) : (
            reminders
              .sort((a, b) => new Date(a.datetime) - new Date(b.datetime))
              .map((reminder) => {
                const status = getReminderStatus(reminder)
                return (
                  <div
                    key={reminder.id}
                    className={`p-3 rounded-lg flex items-center justify-between gap-3 ${getStatusColor(status)}`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {status === 'completed' ? (
                        <Check className="w-5 h-5 flex-shrink-0" />
                      ) : status === 'overdue' ? (
                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                      ) : (
                        <Bell className="w-5 h-5 flex-shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="font-medium text-sm">
                          {formatReminderDate(reminder.datetime)}
                        </p>
                        {reminder.repeat !== 'none' && (
                          <p className="text-xs opacity-75">
                            {t('reminders.repeats')} {getRepeatLabel(reminder.repeat)}
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteReminder(reminder.id)}
                      className="p-1.5 hover:bg-black/10 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )
              })
          )}
        </div>
        {'Notification' in window && Notification.permission === 'denied' && (
          <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                {t('reminders.notificationsBlocked')}
              </p>
              <p className="text-xs text-yellow-700 dark:text-yellow-300">
                {t('reminders.enableNotifications')}
              </p>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  )
}
