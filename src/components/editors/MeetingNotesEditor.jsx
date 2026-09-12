import { useState, useEffect, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Button, EmptyState, buttonClasses } from '../ui'
import {
  Bell,
  Users,
  Plus,
  Trash2,
  Calendar,
  Clock,
  MapPin,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  Circle,
  MessageSquare,
  Target,
  FileText,
  Copy,
  ExternalLink,
  FileAudio,
  User
} from 'lucide-react'
import toast from 'react-hot-toast'
import { formatDateKey, generateId, parseDateKey } from './noteTypes'
import { useLatestValue } from './useLatestValue'
import { useEditorDataSync } from './useEditorDataSync'
import StructuredWorkspaceShell, { WorkspaceTabs } from './StructuredWorkspaceShell'
import { db, getActiveWorkspaceOwner } from '../../lib/db'
import { listNoteResources } from '../../lib/resources/repository'

const formatCaptureDuration = (milliseconds) => {
  const seconds = Math.max(0, Math.floor(Number(milliseconds) / 1000) || 0)
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`
}

function MeetingCapturePanel({ note, onOpenResources, readOnly }) {
  const ownerId = getActiveWorkspaceOwner()
  const capture = useLiveQuery(async () => {
    if (!note?.id || !ownerId) return { recordings: [], transcriptCount: 0, correctedCount: 0 }
    const [entries, recognition] = await Promise.all([
      listNoteResources(note.id, { ownerId }),
      db.recognizedContent.where('[ownerId+noteId]').equals([ownerId, note.id]).toArray(),
    ])
    const recordings = entries.filter((entry) => entry.resource?.kind === 'audio')
    const resourceIds = new Set(recordings.map((entry) => entry.resource.id))
    const transcript = recognition.filter((row) =>
      row.type === 'transcript' &&
      row.status !== 'superseded' &&
      resourceIds.has(row.sourceResourceId)
    )
    return {
      recordings,
      transcriptCount: transcript.length,
      correctedCount: transcript.filter((row) => row.userEdited).length,
    }
  }, [note?.id, ownerId], { recordings: [], transcriptCount: 0, correctedCount: 0 })
  const totalDuration = capture.recordings.reduce((sum, entry) => sum + (entry.resource.durationMs || 0), 0)

  return (
    <div className="qn-workspace-panel mx-auto max-w-2xl">
      <div className="border-b border-subtle px-5 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-title-sm font-semibold text-content">Meeting capture</h2>
            <p className="mt-1 text-ui-sm text-content-muted">Record or attach audio, review its source-linked transcript, then add approved action items or decisions.</p>
          </div>
          <button type="button" onClick={onOpenResources} className={buttonClasses({ variant: 'primary' })}>
            <FileAudio className="h-4 w-4" aria-hidden="true" />
            {capture.recordings.length ? 'Open recordings' : readOnly ? 'View attachments' : 'Record or attach'}
          </button>
        </div>
      </div>
      <dl className="grid grid-cols-1 divide-y divide-[var(--qn-border-subtle)] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <div className="px-5 py-4">
          <dt className="text-ui-xs font-medium text-content-muted">Recordings</dt>
          <dd className="mt-1 text-title-sm font-semibold tabular-nums text-content">{capture.recordings.length}</dd>
        </div>
        <div className="px-5 py-4">
          <dt className="text-ui-xs font-medium text-content-muted">Recorded time</dt>
          <dd className="mt-1 text-title-sm font-semibold tabular-nums text-content">{formatCaptureDuration(totalDuration)}</dd>
        </div>
        <div className="px-5 py-4">
          <dt className="text-ui-xs font-medium text-content-muted">Transcript segments</dt>
          <dd className="mt-1 text-title-sm font-semibold tabular-nums text-content">{capture.transcriptCount}</dd>
          {capture.correctedCount > 0 && <dd className="mt-0.5 text-ui-xs text-content-subtle">{capture.correctedCount} corrected</dd>}
        </div>
      </dl>
      <div className="border-t border-subtle bg-surface-sunken px-5 py-3 text-ui-xs text-content-muted">
        Audio remains canonical. Transcript text is attributable derived content; adding an action or decision is always explicit.
      </div>
    </div>
  )
}

export default function MeetingNotesEditor({ data, onChange, note, noteTitle, onTitleChange, readOnly, onOpenResources, onSetReminder, onOpenCaptureSource }) {
  const [meetingData, setMeetingData] = useState({
    date: data?.date || formatDateKey(),
    startTime: data?.startTime || '',
    endTime: data?.endTime || '',
    location: data?.location || '',
    attendees: data?.attendees || [],
    agenda: data?.agenda || [],
    notes: data?.notes || '',
    actionItems: data?.actionItems || [],
    decisions: data?.decisions || [],
  })
  
  const [activeSection, setActiveSection] = useState(data?.agenda?.length ? 'agenda' : 'details')
  const [timerRunning, setTimerRunning] = useState(false)
  const [timerSeconds, setTimerSeconds] = useState(0)
  const [currentAgendaItem, setCurrentAgendaItem] = useState(null)
  const [newAttendee, setNewAttendee] = useState('')
  const [newAgendaItem, setNewAgendaItem] = useState({ topic: '', duration: 5, presenter: '' })
  const [newActionItem, setNewActionItem] = useState({ task: '', owner: '', dueDate: '' })
  const [newDecision, setNewDecision] = useState('')
  
  const timerRef = useRef(null)
  const activeNoteRef = useRef(note?.id)
  const onChangeRef = useLatestValue(onChange)
  const skipChangeRef = useEditorDataSync(data, meetingData, setMeetingData)
  const isInitialMount = useRef(true)
  useEffect(() => {
    if (isInitialMount.current) { isInitialMount.current = false; return }
    if (skipChangeRef.current) { skipChangeRef.current = false; return }
    onChangeRef.current?.(meetingData)
  }, [meetingData, onChangeRef, skipChangeRef])
  useEffect(() => {
    if (activeNoteRef.current === note?.id) return
    activeNoteRef.current = note?.id
    setActiveSection(data?.agenda?.length ? 'agenda' : 'details')
    setTimerRunning(false)
    setTimerSeconds(0)
    setCurrentAgendaItem(null)
  }, [data?.agenda?.length, note?.id])
  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => {
        setTimerSeconds(prev => prev + 1)
      }, 1000)
    } else {
      clearInterval(timerRef.current)
    }
    return () => clearInterval(timerRef.current)
  }, [timerRunning])

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const update = (field, value) => {
    setMeetingData(prev => ({ ...prev, [field]: value }))
  }
  const addAttendee = () => {
    if (!newAttendee.trim()) return
    const attendee = {
      id: generateId(),
      name: newAttendee.trim(),
      present: true,
      role: '',
    }
    update('attendees', [...meetingData.attendees, attendee])
    setNewAttendee('')
  }

  const updateAttendee = (id, updates) => {
    update('attendees', meetingData.attendees.map(a => 
      a.id === id ? { ...a, ...updates } : a
    ))
  }

  const removeAttendee = (id) => {
    update('attendees', meetingData.attendees.filter(a => a.id !== id))
  }
  const addAgendaItem = () => {
    if (!newAgendaItem.topic.trim()) return
    const item = {
      id: generateId(),
      topic: newAgendaItem.topic.trim(),
      duration: newAgendaItem.duration,
      presenter: newAgendaItem.presenter,
      notes: '',
      completed: false,
      actualDuration: 0,
    }
    update('agenda', [...meetingData.agenda, item])
    setNewAgendaItem({ topic: '', duration: 5, presenter: '' })
  }

  const updateAgendaItem = (id, updates) => {
    update('agenda', meetingData.agenda.map(item => 
      item.id === id ? { ...item, ...updates } : item
    ))
  }

  const removeAgendaItem = (id) => {
    update('agenda', meetingData.agenda.filter(item => item.id !== id))
  }

  const startAgendaTimer = (itemId) => {
    if (currentAgendaItem) {
      updateAgendaItem(currentAgendaItem, { actualDuration: timerSeconds })
    }
    setCurrentAgendaItem(itemId)
    setTimerSeconds(0)
    setTimerRunning(true)
  }

  const stopAgendaTimer = () => {
    if (currentAgendaItem) {
      updateAgendaItem(currentAgendaItem, { actualDuration: timerSeconds, completed: true })
    }
    setTimerRunning(false)
    setCurrentAgendaItem(null)
  }
  const addActionItem = () => {
    if (!newActionItem.task.trim()) return
    const item = {
      id: generateId(),
      task: newActionItem.task.trim(),
      owner: newActionItem.owner,
      dueDate: newActionItem.dueDate,
      completed: false,
    }
    update('actionItems', [...meetingData.actionItems, item])
    setNewActionItem({ task: '', owner: '', dueDate: '' })
  }

  const updateActionItem = (id, updates) => {
    update('actionItems', meetingData.actionItems.map(item => 
      item.id === id ? { ...item, ...updates } : item
    ))
  }

  const removeActionItem = (id) => {
    update('actionItems', meetingData.actionItems.filter(item => item.id !== id))
  }
  const addDecision = () => {
    if (!newDecision.trim()) return
    const decision = {
      id: generateId(),
      text: newDecision.trim(),
      timestamp: new Date().toISOString(),
    }
    update('decisions', [...meetingData.decisions, decision])
    setNewDecision('')
  }

  const removeDecision = (id) => {
    update('decisions', meetingData.decisions.filter(d => d.id !== id))
  }
  const copyMeetingSummary = async () => {
    const markdown = `# ${noteTitle || 'Meeting Notes'}

**Date:** ${meetingData.date}
**Time:** ${meetingData.startTime} - ${meetingData.endTime}
**Location:** ${meetingData.location}

## Attendees
${meetingData.attendees.map(a => `- ${a.name}${a.present ? '' : ' (absent)'}${a.role ? ` - ${a.role}` : ''}`).join('\n')}

## Agenda
${meetingData.agenda.map((item, i) => `${i + 1}. ${item.topic} (${item.duration} min)${item.presenter ? ` - ${item.presenter}` : ''}
   ${item.notes || 'No notes'}`).join('\n\n')}

## Key Decisions
${meetingData.decisions.map((d, i) => `${i + 1}. ${d.text}`).join('\n')}

## Action Items
${meetingData.actionItems.map(item => `- [${item.completed ? 'x' : ' '}] ${item.task}${item.owner ? ` @${item.owner}` : ''}${item.dueDate ? ` (Due: ${item.dueDate})` : ''}`).join('\n')}

## Notes
${meetingData.notes}
`
    try {
      await navigator.clipboard.writeText(markdown)
      toast.success('Meeting summary copied')
    } catch {
      toast.error('Could not copy the meeting summary')
    }
  }
  const stats = {
    attendees: meetingData.attendees.length,
    present: meetingData.attendees.filter(a => a.present).length,
    agendaItems: meetingData.agenda.length,
    completedAgenda: meetingData.agenda.filter(a => a.completed).length,
    actionItems: meetingData.actionItems.length,
    completedActions: meetingData.actionItems.filter(a => a.completed).length,
    decisions: meetingData.decisions.length,
  }

  const sections = [
    { id: 'details', label: 'Details', icon: FileText },
    { id: 'attendees', label: 'Attendees', icon: Users, badge: stats.attendees },
    { id: 'agenda', label: 'Agenda', icon: Target, badge: stats.agendaItems },
    { id: 'notes', label: 'Notes', icon: MessageSquare },
    { id: 'capture', label: 'Capture', icon: FileAudio },
    { id: 'actions', label: 'Action Items', icon: CheckCircle2, badge: stats.actionItems },
    { id: 'decisions', label: 'Decisions', icon: Target, badge: stats.decisions },
  ]

  return (
    <StructuredWorkspaceShell
      className="qn-type-editor qn-type-meeting"
      typeLabel="Meeting workspace"
      title={noteTitle}
      fallback="Meeting notes"
      onTitleChange={onTitleChange}
      readOnly={readOnly}
      summary={(
        <>
          <span>{meetingData.date}</span>
          <span>{stats.attendees} attendees</span>
          <span>{stats.actionItems - stats.completedActions} open actions</span>
          <span className="qn-meeting-timer">{formatTime(timerSeconds)}</span>
          <button type="button" className="qn-meeting-timer-button" onClick={() => setTimerRunning((running) => !running)} aria-label={timerRunning ? 'Pause meeting timer' : 'Start meeting timer'}>
            {timerRunning ? <Pause className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
          </button>
          <button type="button" className="qn-meeting-timer-button" onClick={() => { setTimerSeconds(0); setTimerRunning(false); setCurrentAgendaItem(null) }} aria-label="Reset meeting timer">
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
          </button>
        </>
      )}
      commands={(
        <>
          <WorkspaceTabs
            tabs={sections.map((section) => ({ ...section, count: section.badge }))}
            activeTab={activeSection}
            onChange={setActiveSection}
          />
          <Button size="sm" variant="secondary" icon={Copy} onClick={copyMeetingSummary}>Copy summary</Button>
        </>
      )}
    >
        {activeSection === 'details' && (
          <div className="qn-workspace-panel mx-auto max-w-2xl space-y-4 p-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-content-muted mb-1">
                  <Calendar className="w-4 h-4 inline mr-1" /> Date
                </label>
                <input
                  type="date"
                  aria-label="Meeting date"
                  value={meetingData.date}
                  onChange={(e) => update('date', e.target.value)}
                  className="w-full rounded-control border border-strong bg-surface-sunken px-4 py-3 text-content outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-content-muted mb-1">
                  <MapPin className="w-4 h-4 inline mr-1" /> Location
                </label>
                <input
                  type="text"
                  aria-label="Meeting location"
                  value={meetingData.location}
                  onChange={(e) => update('location', e.target.value)}
                  placeholder="Room / Zoom link..."
                  className="w-full rounded-control border border-strong bg-surface-sunken px-4 py-3 text-content outline-none focus:border-accent"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-content-muted mb-1">
                  <Clock className="w-4 h-4 inline mr-1" /> Start Time
                </label>
                <input
                  type="time"
                  aria-label="Meeting start time"
                  value={meetingData.startTime}
                  onChange={(e) => update('startTime', e.target.value)}
                  className="w-full rounded-control border border-strong bg-surface-sunken px-4 py-3 text-content outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-content-muted mb-1">
                  <Clock className="w-4 h-4 inline mr-1" /> End Time
                </label>
                <input
                  type="time"
                  aria-label="Meeting end time"
                  value={meetingData.endTime}
                  onChange={(e) => update('endTime', e.target.value)}
                  className="w-full rounded-control border border-strong bg-surface-sunken px-4 py-3 text-content outline-none focus:border-accent"
                />
              </div>
            </div>
          </div>
        )}
        {activeSection === 'attendees' && (
          <div className="qn-workspace-panel mx-auto max-w-2xl p-5">
            <div className="flex flex-col gap-2 mb-4 sm:flex-row">
              <input
                type="text"
                aria-label="New attendee name"
                value={newAttendee}
                onChange={(e) => setNewAttendee(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addAttendee()}
                placeholder="Add attendee..."
                className="flex-1 rounded-control border border-strong bg-surface-sunken px-4 py-3 text-content outline-none focus:border-accent"
              />
              <button
                onClick={addAttendee}
                className={buttonClasses({ variant: 'primary' })}
              >
                <Plus className="w-5 h-5" />
                Add
              </button>
            </div>

            <div className="space-y-2">
              {meetingData.attendees.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="No attendees yet"
                  description="Add participants above and mark who is present."
                  size="sm"
                />
              ) : (
                meetingData.attendees.map((attendee) => (
                  <div
                    key={attendee.id}
                    className={`qn-domain-card flex items-center gap-3 rounded-card border p-3 transition-colors ${
 attendee.present
 ? 'border-[var(--qn-success-border)] bg-success-soft'
                        : 'bg-surface-sunken border-subtle'
                    }`}
                  >
                    <button
                      onClick={() => updateAttendee(attendee.id, { present: !attendee.present })}
                      aria-label={attendee.present ? `Mark ${attendee.name} absent` : `Mark ${attendee.name} present`}
                      className="flex-shrink-0"
                    >
                      {attendee.present ? (
                        <CheckCircle2 className="h-6 w-6 text-success-text" />
                      ) : (
                        <Circle className="w-6 h-6 text-content-subtle" />
                      )}
                    </button>
                    
                    <div className="w-10 h-10 rounded-full bg-accent-soft text-accent-text flex items-center justify-center font-medium">
                      {attendee.name.charAt(0).toUpperCase()}
                    </div>
                    
                    <div className="flex-1">
                      <div className="font-medium text-content">{attendee.name}</div>
                      <input
                        type="text"
                        aria-label={`${attendee.name} role`}
                        value={attendee.role}
                        onChange={(e) => updateAttendee(attendee.id, { role: e.target.value })}
                        placeholder="Role (optional)..."
                        className="text-sm text-content-muted bg-transparent outline-none w-full"
                      />
                    </div>
                    
                    <button
                      onClick={() => removeAttendee(attendee.id)}
                      aria-label={`Remove ${attendee.name}`}
                      className="p-2 rounded-lg hover:bg-surface-sunken dark:hover:bg-surface-sunken text-content-subtle hover:text-red-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
        {activeSection === 'agenda' && (
          <div className="qn-workspace-panel mx-auto max-w-2xl p-5">
            <div className="mb-4 rounded-card border border-subtle bg-surface-sunken p-4">
              <div className="grid grid-cols-1 gap-3 mb-3 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <input
                    type="text"
                    aria-label="New agenda topic"
                    value={newAgendaItem.topic}
                    onChange={(e) => setNewAgendaItem({ ...newAgendaItem, topic: e.target.value })}
                    placeholder="Agenda topic..."
                    className="w-full rounded-lg border border-subtle bg-surface-raised px-3 py-2 text-sm outline-none"
                  />
                </div>
                <div>
                  <select
                    aria-label="Planned agenda duration"
                    value={newAgendaItem.duration}
                    onChange={(e) => setNewAgendaItem({ ...newAgendaItem, duration: parseInt(e.target.value) })}
                    className="w-full rounded-lg border border-subtle bg-surface-raised px-3 py-2 text-sm outline-none"
                  >
                    <option value={5}>5 min</option>
                    <option value={10}>10 min</option>
                    <option value={15}>15 min</option>
                    <option value={20}>20 min</option>
                    <option value={30}>30 min</option>
                    <option value={45}>45 min</option>
                    <option value={60}>60 min</option>
                  </select>
                </div>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  type="text"
                  aria-label="Agenda presenter"
                  value={newAgendaItem.presenter}
                  onChange={(e) => setNewAgendaItem({ ...newAgendaItem, presenter: e.target.value })}
                  placeholder="Presenter (optional)..."
                  className="flex-1 rounded-lg border border-subtle bg-surface-raised px-3 py-2 text-sm outline-none"
                />
                <button
                  onClick={addAgendaItem}
                  className={buttonClasses({ variant: 'primary' })}
                >
                  <Plus className="w-4 h-4" />
                  Add
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {meetingData.agenda.length === 0 ? (
                <EmptyState
                  icon={Target}
                  title="No agenda items yet"
                  description="Add the first topic and reserve time for it."
                  size="sm"
                />
              ) : (
                meetingData.agenda.map((item, index) => (
                  <div
                    key={item.id}
                    className={`qn-domain-card rounded-card border p-4 transition-colors ${
 item.completed
 ? 'border-[var(--qn-success-border)] bg-success-soft'
                        : currentAgendaItem === item.id
                          ? 'bg-accent-soft border-accent-border'
                          : 'bg-surface-raised border-subtle'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => updateAgendaItem(item.id, { completed: !item.completed })}
                        aria-label={item.completed ? `Mark ${item.topic} incomplete` : `Complete ${item.topic}`}
                        className="flex-shrink-0 mt-1"
                      >
                        {item.completed ? (
                          <CheckCircle2 className="h-5 w-5 text-success-text" />
                        ) : (
                          <Circle className="w-5 h-5 text-content-subtle" />
                        )}
                      </button>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-content-muted">#{index + 1}</span>
                          <span className={`font-medium ${item.completed ? 'line-through text-content-subtle' : 'text-content'}`}>
                            {item.topic}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-content-muted mb-2">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {item.duration} min {item.actualDuration > 0 && `(actual: ${Math.floor(item.actualDuration / 60)}m ${item.actualDuration % 60}s)`}
                          </span>
                          {item.presenter && (
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {item.presenter}
                            </span>
                          )}
                        </div>
                        
                        <textarea
                          aria-label={`Notes for ${item.topic}`}
                          value={item.notes}
                          onChange={(e) => updateAgendaItem(item.id, { notes: e.target.value })}
                          placeholder="Add notes for this topic..."
                          className="w-full px-3 py-2 rounded-lg bg-surface-sunken dark:bg-surface-sunken border border-subtle outline-none text-sm resize-none"
                          rows={2}
                        />
                      </div>
                      
                      <div className="flex flex-col gap-1">
                        {!item.completed && (
                          <button
                            onClick={() => currentAgendaItem === item.id ? stopAgendaTimer() : startAgendaTimer(item.id)}
                            aria-label={currentAgendaItem === item.id ? `Stop timer for ${item.topic}` : `Start timer for ${item.topic}`}
                            className={`p-2 rounded-lg ${
 currentAgendaItem === item.id
 ? 'bg-red-100 text-red-600 hover:bg-red-200'
                                : 'bg-accent-soft text-accent-text hover:bg-blue-200'
                            }`}
                          >
                            {currentAgendaItem === item.id ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                          </button>
                        )}
                        <button
                          onClick={() => removeAgendaItem(item.id)}
                          aria-label={`Delete ${item.topic}`}
                          className="p-2 rounded-lg hover:bg-surface-hover text-content-subtle hover:text-red-500"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
        {activeSection === 'notes' && (
          <div className="qn-workspace-panel mx-auto max-w-2xl p-5">
            <textarea
              aria-label="Meeting notes"
              value={meetingData.notes}
              onChange={(e) => update('notes', e.target.value)}
              placeholder="Take meeting notes here..."
              className="h-[400px] w-full resize-none rounded-control border border-strong bg-surface-sunken px-4 py-3 text-content outline-none focus:border-accent"
            />
          </div>
        )}
        {activeSection === 'capture' && (
          <MeetingCapturePanel note={note} onOpenResources={onOpenResources} readOnly={readOnly} />
        )}
        {activeSection === 'actions' && (
          <div className="qn-workspace-panel mx-auto max-w-2xl p-5">
            <div className="mb-4 rounded-card border border-subtle bg-surface-sunken p-4">
              <div className="grid grid-cols-1 gap-3 mb-3 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <input
                    type="text"
                    aria-label="New action item"
                    value={newActionItem.task}
                    onChange={(e) => setNewActionItem({ ...newActionItem, task: e.target.value })}
                    placeholder="Action item..."
                    className="w-full rounded-lg border border-subtle bg-surface-raised px-3 py-2 text-sm outline-none"
                  />
                </div>
                <div>
                  <input
                    type="date"
                    aria-label="Action item due date"
                    value={newActionItem.dueDate}
                    onChange={(e) => setNewActionItem({ ...newActionItem, dueDate: e.target.value })}
                    className="w-full rounded-lg border border-subtle bg-surface-raised px-3 py-2 text-sm outline-none"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <select
                  aria-label="Action item owner"
                  value={newActionItem.owner}
                  onChange={(e) => setNewActionItem({ ...newActionItem, owner: e.target.value })}
                  className="flex-1 rounded-lg border border-subtle bg-surface-raised px-3 py-2 text-sm outline-none"
                >
                  <option value="">Assign to...</option>
                  {meetingData.attendees.map(a => (
                    <option key={a.id} value={a.name}>{a.name}</option>
                  ))}
                </select>
                <button
                  onClick={addActionItem}
                  className={buttonClasses({ variant: 'primary' })}
                >
                  <Plus className="w-4 h-4" />
                  Add
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {meetingData.actionItems.length === 0 ? (
                <EmptyState
                  icon={CheckCircle2}
                  title="No action items yet"
                  description="Record a task, owner, and due date above."
                  size="sm"
                />
              ) : (
                meetingData.actionItems.map((item) => (
                  <div
                    key={item.id}
                    className={`qn-domain-card flex items-center gap-3 rounded-card border p-3 ${
 item.completed
 ? 'border-[var(--qn-success-border)] bg-success-soft'
                        : 'bg-surface-raised border-subtle'
                    }`}
                  >
                    <button
                      onClick={() => updateActionItem(item.id, { completed: !item.completed })}
                      aria-label={item.completed ? `Mark ${item.task} incomplete` : `Complete ${item.task}`}
                    >
                      {item.completed ? (
                        <CheckCircle2 className="h-6 w-6 text-success-text" />
                      ) : (
                        <Circle className="w-6 h-6 text-content-subtle" />
                      )}
                    </button>
                    
                    <div className="flex-1">
                      <div className={item.completed ? 'line-through text-content-subtle' : 'text-content'}>
                        {item.task}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-content-muted mt-1">
                        {item.owner && (
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {item.owner}
                          </span>
                        )}
                        {item.dueDate && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {parseDateKey(item.dueDate).toLocaleDateString('en-US')}
                          </span>
                        )}
                      </div>
                    </div>
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => onSetReminder?.({
                          type: 'task',
                          noteId: note?.id,
                          taskId: item.id,
                          taskKind: 'meeting-action',
                          label: item.task,
                        })}
                        aria-label={`Set reminder for ${item.task}`}
                        className="qn-square-control flex h-9 w-9 shrink-0 items-center justify-center rounded-control text-content-subtle hover:bg-surface-hover hover:text-content"
                      >
                        <Bell className="h-4 w-4" aria-hidden="true" />
                      </button>
                    )}
                    {item.source && (
                      <button
                        type="button"
                        onClick={() => onOpenCaptureSource?.(item.source)}
                        aria-label={`Open transcript source for ${item.task}`}
                        className="qn-square-control flex h-9 w-9 shrink-0 items-center justify-center rounded-control text-accent-text hover:bg-accent-soft"
                      >
                        <ExternalLink className="h-4 w-4" aria-hidden="true" />
                      </button>
                    )}
                    <button
                      onClick={() => removeActionItem(item.id)}
                      aria-label={`Delete ${item.task}`}
                      className="p-2 rounded-lg hover:bg-surface-hover text-content-subtle hover:text-red-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
        {activeSection === 'decisions' && (
          <div className="qn-workspace-panel mx-auto max-w-2xl p-5">
            <div className="flex flex-col gap-2 mb-4 sm:flex-row">
              <input
                type="text"
                aria-label="New decision"
                value={newDecision}
                onChange={(e) => setNewDecision(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addDecision()}
                placeholder="Record a decision made..."
                className="flex-1 rounded-control border border-strong bg-surface-sunken px-4 py-3 text-content outline-none focus:border-accent"
              />
              <button
                onClick={addDecision}
                className={buttonClasses({ variant: 'primary' })}
              >
                <Plus className="w-5 h-5" />
                Add
              </button>
            </div>

            <div className="space-y-2">
              {meetingData.decisions.length === 0 ? (
                <EmptyState
                  icon={Target}
                  title="No decisions recorded"
                  description="Capture an agreed decision so it remains visible after the meeting."
                  size="sm"
                />
              ) : (
                meetingData.decisions.map((decision, index) => (
                  <div
                    key={decision.id}
                    className="qn-domain-card flex items-start gap-3 rounded-card border border-[var(--qn-warning-border)] bg-warning-soft p-4"
                  >
                    <div className="w-8 h-8 rounded-full bg-amber-200 dark:bg-amber-800 text-accent-text flex items-center justify-center font-bold text-sm">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="text-content">{decision.text}</div>
                      <div className="text-xs text-content-muted mt-1">
                        {new Date(decision.timestamp).toLocaleString('en-US')}
                      </div>
                    </div>
                    {decision.source && (
                      <button
                        type="button"
                        onClick={() => onOpenCaptureSource?.(decision.source)}
                        aria-label={`Open transcript source for decision ${index + 1}`}
                        className="qn-square-control flex h-9 w-9 shrink-0 items-center justify-center rounded-control text-accent-text hover:bg-accent-soft"
                      >
                        <ExternalLink className="h-4 w-4" aria-hidden="true" />
                      </button>
                    )}
                    <button
                      onClick={() => removeDecision(decision.id)}
                      aria-label={`Delete decision ${index + 1}`}
                      className="p-2 rounded-lg hover:bg-accent-soft dark:hover:bg-amber-800/50 text-accent-text hover:text-red-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
    </StructuredWorkspaceShell>
  )
}
