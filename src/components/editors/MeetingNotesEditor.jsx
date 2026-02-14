import React, { useState, useEffect, useRef } from 'react'
import {
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
  User
} from 'lucide-react'
import { generateId } from './noteTypes'

export default function MeetingNotesEditor({ data, onChange, noteTitle }) {
  const [meetingData, setMeetingData] = useState({
    title: data?.title || '',
    date: data?.date || new Date().toISOString().split('T')[0],
    startTime: data?.startTime || '',
    endTime: data?.endTime || '',
    location: data?.location || '',
    attendees: data?.attendees || [],
    agenda: data?.agenda || [],
    notes: data?.notes || '',
    actionItems: data?.actionItems || [],
    decisions: data?.decisions || [],
  })
  
  const [activeSection, setActiveSection] = useState('details')
  const [timerRunning, setTimerRunning] = useState(false)
  const [timerSeconds, setTimerSeconds] = useState(0)
  const [currentAgendaItem, setCurrentAgendaItem] = useState(null)
  const [newAttendee, setNewAttendee] = useState('')
  const [newAgendaItem, setNewAgendaItem] = useState({ topic: '', duration: 5, presenter: '' })
  const [newActionItem, setNewActionItem] = useState({ task: '', owner: '', dueDate: '' })
  const [newDecision, setNewDecision] = useState('')
  
  const timerRef = useRef(null)
  const isInitialMount = useRef(true)
  useEffect(() => {
    if (isInitialMount.current) { isInitialMount.current = false; return }
    onChange?.(meetingData)
  }, [meetingData])
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
  const exportMeetingNotes = () => {
    const markdown = `# ${meetingData.title || 'Meeting Notes'}

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
${meetingData.actionItems.map(item => `- [ ] ${item.task}${item.owner ? ` @${item.owner}` : ''}${item.dueDate ? ` (Due: ${item.dueDate})` : ''}`).join('\n')}

## Notes
${meetingData.notes}
`
    navigator.clipboard.writeText(markdown)
    alert('Meeting notes copied to clipboard!')
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
    { id: 'actions', label: 'Action Items', icon: CheckCircle2, badge: stats.actionItems },
    { id: 'decisions', label: 'Decisions', icon: Target, badge: stats.decisions },
  ]

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      <div className="flex-shrink-0 p-4 border-b border-[#cbd1db] dark:border-gray-700 bg-[#e5eaf0] dark:bg-gray-800">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Users className="w-7 h-7" />
              {noteTitle || 'Meeting Notes'}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
              {meetingData.date} {"\u2022"} {stats.attendees} attendees {"\u2022"} {stats.agendaItems} agenda items
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-center">
              <div className="text-3xl font-mono font-bold text-gray-900 dark:text-white">
                {formatTime(timerSeconds)}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {currentAgendaItem ? 'Active Timer' : 'Meeting Timer'}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <button
                onClick={() => timerRunning ? setTimerRunning(false) : setTimerRunning(true)}
                className="p-2 rounded-lg bg-gray-200/50 dark:bg-gray-700 hover:bg-gray-300/50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300"
              >
                {timerRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>
              <button
                onClick={() => { setTimerSeconds(0); setTimerRunning(false); setCurrentAgendaItem(null) }}
                className="p-2 rounded-lg bg-gray-200/50 dark:bg-gray-700 hover:bg-gray-300/50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-white dark:bg-gray-700 rounded-lg p-2 text-center border border-[#cbd1db] dark:border-gray-600">
            <div className="text-xl font-bold text-gray-900 dark:text-white">{stats.present}/{stats.attendees}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Present</div>
          </div>
          <div className="bg-white dark:bg-gray-700 rounded-lg p-2 text-center border border-[#cbd1db] dark:border-gray-600">
            <div className="text-xl font-bold text-gray-900 dark:text-white">{stats.completedAgenda}/{stats.agendaItems}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Agenda Done</div>
          </div>
          <div className="bg-white dark:bg-gray-700 rounded-lg p-2 text-center border border-[#cbd1db] dark:border-gray-600">
            <div className="text-xl font-bold text-gray-900 dark:text-white">{stats.actionItems}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Actions</div>
          </div>
          <div className="bg-white dark:bg-gray-700 rounded-lg p-2 text-center border border-[#cbd1db] dark:border-gray-600">
            <div className="text-xl font-bold text-gray-900 dark:text-white">{stats.decisions}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Decisions</div>
          </div>
        </div>
      </div>
      <div className="flex-shrink-0 flex gap-1 p-2 border-b border-[#cbd1db] dark:border-gray-700 bg-gray-50 dark:bg-gray-800 overflow-x-auto">
        {sections.map(section => (
          <button
            key={section.id}
            onClick={() => setActiveSection(section.id)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              activeSection === section.id
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <section.icon className="w-4 h-4" />
            {section.label}
            {section.badge !== undefined && (
              <span className="px-1.5 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-xs">
                {section.badge}
              </span>
            )}
          </button>
        ))}
        
        <div className="flex-1" />
        
        <button
          onClick={exportMeetingNotes}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30"
        >
          <Copy className="w-4 h-4" />
          Export
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {activeSection === 'details' && (
          <div className="max-w-2xl mx-auto space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Meeting Title</label>
              <input
                type="text"
                value={meetingData.title}
                onChange={(e) => update('title', e.target.value)}
                placeholder="Enter meeting title..."
                className="w-full px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 border-2 border-[#cbd1db] dark:border-gray-600 focus:border-blue-500 outline-none text-gray-900 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <Calendar className="w-4 h-4 inline mr-1" /> Date
                </label>
                <input
                  type="date"
                  value={meetingData.date}
                  onChange={(e) => update('date', e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 border-2 border-[#cbd1db] dark:border-gray-600 focus:border-blue-500 outline-none text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <MapPin className="w-4 h-4 inline mr-1" /> Location
                </label>
                <input
                  type="text"
                  value={meetingData.location}
                  onChange={(e) => update('location', e.target.value)}
                  placeholder="Room / Zoom link..."
                  className="w-full px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 border-2 border-[#cbd1db] dark:border-gray-600 focus:border-blue-500 outline-none text-gray-900 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <Clock className="w-4 h-4 inline mr-1" /> Start Time
                </label>
                <input
                  type="time"
                  value={meetingData.startTime}
                  onChange={(e) => update('startTime', e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 border-2 border-[#cbd1db] dark:border-gray-600 focus:border-blue-500 outline-none text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <Clock className="w-4 h-4 inline mr-1" /> End Time
                </label>
                <input
                  type="time"
                  value={meetingData.endTime}
                  onChange={(e) => update('endTime', e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 border-2 border-[#cbd1db] dark:border-gray-600 focus:border-blue-500 outline-none text-gray-900 dark:text-white"
                />
              </div>
            </div>
          </div>
        )}
        {activeSection === 'attendees' && (
          <div className="max-w-2xl mx-auto">
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={newAttendee}
                onChange={(e) => setNewAttendee(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addAttendee()}
                placeholder="Add attendee..."
                className="flex-1 px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 border-2 border-[#cbd1db] dark:border-gray-600 focus:border-blue-500 outline-none text-gray-900 dark:text-white"
              />
              <button
                onClick={addAttendee}
                className="px-4 py-3 rounded-xl bg-blue-500 hover:bg-blue-600 text-white flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Add
              </button>
            </div>

            <div className="space-y-2">
              {meetingData.attendees.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  No attendees added yet
                </div>
              ) : (
                meetingData.attendees.map((attendee) => (
                  <div
                    key={attendee.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-colors ${
                      attendee.present
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                        : 'bg-gray-50 dark:bg-gray-800 border-[#cbd1db] dark:border-gray-700'
                    }`}
                  >
                    <button
                      onClick={() => updateAttendee(attendee.id, { present: !attendee.present })}
                      className="flex-shrink-0"
                    >
                      {attendee.present ? (
                        <CheckCircle2 className="w-6 h-6 text-green-500" />
                      ) : (
                        <Circle className="w-6 h-6 text-gray-300" />
                      )}
                    </button>
                    
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 flex items-center justify-center font-medium">
                      {attendee.name.charAt(0).toUpperCase()}
                    </div>
                    
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 dark:text-white">{attendee.name}</div>
                      <input
                        type="text"
                        value={attendee.role}
                        onChange={(e) => updateAttendee(attendee.id, { role: e.target.value })}
                        placeholder="Role (optional)..."
                        className="text-sm text-gray-500 bg-transparent outline-none w-full"
                      />
                    </div>
                    
                    <button
                      onClick={() => removeAttendee(attendee.id)}
                      className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-red-500"
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
          <div className="max-w-2xl mx-auto">
            <div className="mb-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-800 border border-[#cbd1db] dark:border-gray-700">
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="col-span-2">
                  <input
                    type="text"
                    value={newAgendaItem.topic}
                    onChange={(e) => setNewAgendaItem({ ...newAgendaItem, topic: e.target.value })}
                    placeholder="Agenda topic..."
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-700 border border-[#cbd1db] dark:border-gray-600 outline-none text-sm"
                  />
                </div>
                <div>
                  <select
                    value={newAgendaItem.duration}
                    onChange={(e) => setNewAgendaItem({ ...newAgendaItem, duration: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-700 border border-[#cbd1db] dark:border-gray-600 outline-none text-sm"
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
              <div className="flex gap-3">
                <input
                  type="text"
                  value={newAgendaItem.presenter}
                  onChange={(e) => setNewAgendaItem({ ...newAgendaItem, presenter: e.target.value })}
                  placeholder="Presenter (optional)..."
                  className="flex-1 px-3 py-2 rounded-lg bg-white dark:bg-gray-700 border border-[#cbd1db] dark:border-gray-600 outline-none text-sm"
                />
                <button
                  onClick={addAgendaItem}
                  className="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {meetingData.agenda.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  No agenda items yet
                </div>
              ) : (
                meetingData.agenda.map((item, index) => (
                  <div
                    key={item.id}
                    className={`p-4 rounded-xl border-2 transition-colors ${
                      item.completed
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                        : currentAgendaItem === item.id
                          ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700'
                          : 'bg-white dark:bg-gray-800 border-[#cbd1db] dark:border-gray-700'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => updateAgendaItem(item.id, { completed: !item.completed })}
                        className="flex-shrink-0 mt-1"
                      >
                        {item.completed ? (
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                        ) : (
                          <Circle className="w-5 h-5 text-gray-300" />
                        )}
                      </button>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-gray-500">#{index + 1}</span>
                          <span className={`font-medium ${item.completed ? 'line-through text-gray-400' : 'text-gray-900 dark:text-white'}`}>
                            {item.topic}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-500 mb-2">
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
                          value={item.notes}
                          onChange={(e) => updateAgendaItem(item.id, { notes: e.target.value })}
                          placeholder="Add notes for this topic..."
                          className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-700 border border-[#cbd1db] dark:border-gray-600 outline-none text-sm resize-none"
                          rows={2}
                        />
                      </div>
                      
                      <div className="flex flex-col gap-1">
                        {!item.completed && (
                          <button
                            onClick={() => currentAgendaItem === item.id ? stopAgendaTimer() : startAgendaTimer(item.id)}
                            className={`p-2 rounded-lg ${
                              currentAgendaItem === item.id
                                ? 'bg-red-100 text-red-600 hover:bg-red-200'
                                : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                            }`}
                          >
                            {currentAgendaItem === item.id ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                          </button>
                        )}
                        <button
                          onClick={() => removeAgendaItem(item.id)}
                          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-red-500"
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
          <div className="max-w-2xl mx-auto">
            <textarea
              value={meetingData.notes}
              onChange={(e) => update('notes', e.target.value)}
              placeholder="Take meeting notes here..."
              className="w-full h-[400px] px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border-2 border-[#cbd1db] dark:border-gray-700 focus:border-blue-500 outline-none text-gray-900 dark:text-white resize-none"
            />
          </div>
        )}
        {activeSection === 'actions' && (
          <div className="max-w-2xl mx-auto">
            <div className="mb-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-800 border border-[#cbd1db] dark:border-gray-700">
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="col-span-2">
                  <input
                    type="text"
                    value={newActionItem.task}
                    onChange={(e) => setNewActionItem({ ...newActionItem, task: e.target.value })}
                    placeholder="Action item..."
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-700 border border-[#cbd1db] dark:border-gray-600 outline-none text-sm"
                  />
                </div>
                <div>
                  <input
                    type="date"
                    value={newActionItem.dueDate}
                    onChange={(e) => setNewActionItem({ ...newActionItem, dueDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-700 border border-[#cbd1db] dark:border-gray-600 outline-none text-sm"
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <select
                  value={newActionItem.owner}
                  onChange={(e) => setNewActionItem({ ...newActionItem, owner: e.target.value })}
                  className="flex-1 px-3 py-2 rounded-lg bg-white dark:bg-gray-700 border border-[#cbd1db] dark:border-gray-600 outline-none text-sm"
                >
                  <option value="">Assign to...</option>
                  {meetingData.attendees.map(a => (
                    <option key={a.id} value={a.name}>{a.name}</option>
                  ))}
                </select>
                <button
                  onClick={addActionItem}
                  className="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {meetingData.actionItems.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  No action items yet
                </div>
              ) : (
                meetingData.actionItems.map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 ${
                      item.completed
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                        : 'bg-white dark:bg-gray-800 border-[#cbd1db] dark:border-gray-700'
                    }`}
                  >
                    <button
                      onClick={() => updateActionItem(item.id, { completed: !item.completed })}
                    >
                      {item.completed ? (
                        <CheckCircle2 className="w-6 h-6 text-green-500" />
                      ) : (
                        <Circle className="w-6 h-6 text-gray-300" />
                      )}
                    </button>
                    
                    <div className="flex-1">
                      <div className={item.completed ? 'line-through text-gray-400' : 'text-gray-900 dark:text-white'}>
                        {item.task}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                        {item.owner && (
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {item.owner}
                          </span>
                        )}
                        {item.dueDate && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(item.dueDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <button
                      onClick={() => removeActionItem(item.id)}
                      className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-red-500"
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
          <div className="max-w-2xl mx-auto">
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={newDecision}
                onChange={(e) => setNewDecision(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addDecision()}
                placeholder="Record a decision made..."
                className="flex-1 px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 border-2 border-[#cbd1db] dark:border-gray-600 focus:border-blue-500 outline-none text-gray-900 dark:text-white"
              />
              <button
                onClick={addDecision}
                className="px-4 py-3 rounded-xl bg-blue-500 hover:bg-blue-600 text-white flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Add
              </button>
            </div>

            <div className="space-y-2">
              {meetingData.decisions.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  No decisions recorded yet
                </div>
              ) : (
                meetingData.decisions.map((decision, index) => (
                  <div
                    key={decision.id}
                    className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-200 dark:border-amber-800"
                  >
                    <div className="w-8 h-8 rounded-full bg-amber-200 dark:bg-amber-800 text-amber-700 dark:text-amber-300 flex items-center justify-center font-bold text-sm">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="text-gray-900 dark:text-white">{decision.text}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(decision.timestamp).toLocaleString()}
                      </div>
                    </div>
                    <button
                      onClick={() => removeDecision(decision.id)}
                      className="p-2 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-800/50 text-amber-500 hover:text-red-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
