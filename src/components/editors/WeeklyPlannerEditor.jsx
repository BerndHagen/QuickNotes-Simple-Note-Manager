import { useState, useEffect, useRef } from 'react'
import { EmptyState, buttonClasses } from '../ui'
import {
  Calendar,
  Plus,
  Trash2,
  X,
  ChevronLeft,
  ChevronRight,
  Target,
  Star,
  Clock,
  Sun,
  Moon,
  Sunset,
  CheckCircle2,
  Circle,
  CalendarDays,
  BarChart3,
  Flame
} from 'lucide-react'
import { formatDateKey, generateId, parseDateKey } from './noteTypes'
import { useLatestValue } from './useLatestValue'
import { useEditorDataSync } from './useEditorDataSync'
import FocusedNoteTitle from './FocusedNoteTitle'
import WorkspaceMetrics from './WorkspaceMetrics'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const SHORT_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const TIME_BLOCKS = [
  { id: 'morning', label: 'Morning', icon: Sun, color: '#f59e0b' },
  { id: 'afternoon', label: 'Afternoon', icon: Sunset, color: '#f97316' },
  { id: 'evening', label: 'Evening', icon: Moon, color: '#6366f1' },
]

export default function WeeklyPlannerEditor({ data, onChange, noteTitle, onTitleChange, readOnly }) {
  const getWeekStart = (date = new Date()) => {
    const d = new Date(date)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    d.setDate(diff)
    d.setHours(0, 0, 0, 0)
    return formatDateKey(d)
  }

  const [plannerData, setPlannerData] = useState({
    weekStart: data?.weekStart || getWeekStart(),
    weeklyGoals: data?.weeklyGoals || [],
    days: data?.days || DAYS.reduce((acc, day) => {
      acc[day.toLowerCase()] = {
        tasks: [],
        events: [],
        note: '',
        rating: null,
      }
      return acc
    }, {}),
    review: data?.review || {
      accomplishments: '',
      challenges: '',
      lessons: '',
      nextWeekFocus: '',
    },
  })

  const [activeView, setActiveView] = useState(data?.preferredView || 'week')
  const [selectedDay, setSelectedDay] = useState(DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1].toLowerCase())
  const [newGoal, setNewGoal] = useState('')
  const [newTask, setNewTask] = useState('')
  const [newTaskTime, setNewTaskTime] = useState('morning')
  const [newEvent, setNewEvent] = useState('')
  const [newEventTime, setNewEventTime] = useState('')
  const onChangeRef = useLatestValue(onChange)
  const skipChangeRef = useEditorDataSync(data, plannerData, (incoming) => {
    setPlannerData(incoming)
    setActiveView(incoming?.preferredView || 'week')
  })
  const isInitialMount = useRef(true)
  useEffect(() => {
    if (isInitialMount.current) { isInitialMount.current = false; return }
    if (skipChangeRef.current) { skipChangeRef.current = false; return }
    onChangeRef.current?.(plannerData)
  }, [onChangeRef, plannerData, skipChangeRef])

  const update = (field, value) => {
    setPlannerData(prev => ({ ...prev, [field]: value }))
  }
  const navigateWeek = (direction) => {
    const current = parseDateKey(plannerData.weekStart)
    current.setDate(current.getDate() + (direction * 7))
    update('weekStart', formatDateKey(current))
  }

  const goToCurrentWeek = () => {
    update('weekStart', getWeekStart())
  }
  const addGoal = () => {
    if (!newGoal.trim()) return
    update('weeklyGoals', [...plannerData.weeklyGoals, {
      id: generateId(),
      text: newGoal.trim(),
      completed: false,
      priority: false,
    }])
    setNewGoal('')
  }

  const toggleGoal = (id) => {
    update('weeklyGoals', plannerData.weeklyGoals.map(g =>
      g.id === id ? { ...g, completed: !g.completed } : g
    ))
  }

  const toggleGoalPriority = (id) => {
    update('weeklyGoals', plannerData.weeklyGoals.map(g =>
      g.id === id ? { ...g, priority: !g.priority } : g
    ))
  }

  const removeGoal = (id) => {
    update('weeklyGoals', plannerData.weeklyGoals.filter(g => g.id !== id))
  }
  const updateDay = (day, field, value) => {
    update('days', {
      ...plannerData.days,
      [day]: {
        ...plannerData.days[day],
        [field]: value,
      },
    })
  }

  const addTask = (day) => {
    if (!newTask.trim()) return
    const task = {
      id: generateId(),
      text: newTask.trim(),
      timeBlock: newTaskTime,
      completed: false,
    }
    updateDay(day, 'tasks', [...plannerData.days[day].tasks, task])
    setNewTask('')
  }

  const toggleTask = (day, taskId) => {
    updateDay(day, 'tasks', plannerData.days[day].tasks.map(t =>
      t.id === taskId ? { ...t, completed: !t.completed } : t
    ))
  }

  const removeTask = (day, taskId) => {
    updateDay(day, 'tasks', plannerData.days[day].tasks.filter(t => t.id !== taskId))
  }

  const addEvent = (day) => {
    if (!newEvent.trim()) return
    const event = {
      id: generateId(),
      text: newEvent.trim(),
      time: newEventTime,
    }
    updateDay(day, 'events', [...plannerData.days[day].events, event])
    setNewEvent('')
    setNewEventTime('')
  }

  const removeEvent = (day, eventId) => {
    updateDay(day, 'events', plannerData.days[day].events.filter(e => e.id !== eventId))
  }
  const updateReview = (field, value) => {
    update('review', { ...plannerData.review, [field]: value })
  }
  const getDateForDay = (dayIndex) => {
    const start = parseDateKey(plannerData.weekStart)
    start.setDate(start.getDate() + dayIndex)
    return start
  }
  const getStats = () => {
    let totalTasks = 0
    let completedTasks = 0
    DAYS.forEach((_, i) => {
      const day = DAYS[i].toLowerCase()
      const dayData = plannerData.days[day]
      if (dayData) {
        totalTasks += dayData.tasks.length
        completedTasks += dayData.tasks.filter(t => t.completed).length
      }
    })
    const completedGoals = plannerData.weeklyGoals.filter(g => g.completed).length
    return { totalTasks, completedTasks, completedGoals, totalGoals: plannerData.weeklyGoals.length }
  }

  const stats = getStats()
  const completionPercent = stats.totalTasks > 0 ? Math.round((stats.completedTasks / stats.totalTasks) * 100) : 0
  const weekStartDate = parseDateKey(plannerData.weekStart)
  const weekEndDate = new Date(weekStartDate)
  weekEndDate.setDate(weekEndDate.getDate() + 6)
  const weekLabel = `${weekStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEndDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`

  const views = [
    { id: 'week', label: 'Week View', icon: CalendarDays },
    { id: 'goals', label: 'Goals', icon: Target },
    { id: 'review', label: 'Weekly Review', icon: BarChart3 },
  ]

  return (
    <div className="qn-type-editor qn-type-weekly flex h-full flex-col">
      <header className="qn-type-hero qn-workspace-header flex-shrink-0 border-b border-subtle">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <FocusedNoteTitle
              icon={Calendar}
              typeLabel="Planning workspace"
              title={noteTitle}
              fallback="Weekly plan"
              onChange={onTitleChange}
              readOnly={readOnly}
            />
            <div className="flex items-center gap-3 mt-2">
              <button
                onClick={() => navigateWeek(-1)}
                aria-label="Previous week"
                className="p-1 rounded-lg bg-surface-sunken dark:bg-surface-sunken hover:bg-surface-active dark:hover:bg-surface-active text-content-muted"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-content font-medium">{weekLabel}</span>
              <button
                onClick={() => navigateWeek(1)}
                aria-label="Next week"
                className="p-1 rounded-lg bg-surface-sunken dark:bg-surface-sunken hover:bg-surface-active dark:hover:bg-surface-active text-content-muted"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              {plannerData.weekStart !== getWeekStart() && (
                <button
                  onClick={goToCurrentWeek}
                  className="px-3 py-1 rounded-lg bg-surface-sunken dark:bg-surface-sunken hover:bg-surface-active dark:hover:bg-surface-active text-content-muted text-sm"
                >
                  Today
                </button>
              )}
            </div>
          </div>
        </div>
        <WorkspaceMetrics
          items={[
            { label: 'Tasks done', value: `${stats.completedTasks}/${stats.totalTasks}` },
            { label: 'Goals met', value: `${stats.completedGoals}/${stats.totalGoals}` },
            { label: 'Complete', value: `${completionPercent}%`, tone: completionPercent === 100 ? 'success' : 'neutral' },
          ]}
        />
      </header>
      <div className="qn-type-tabs flex-shrink-0 flex gap-1 p-2 border-b border-subtle bg-surface-sunken">
        {views.map((view) => (
          <button
            key={view.id}
            onClick={() => {
              setActiveView(view.id)
              update('preferredView', view.id)
            }}
            aria-pressed={activeView === view.id}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
 activeView === view.id
 ? 'bg-accent-soft text-accent-text'
                : 'text-content-muted hover:bg-surface-hover'
            }`}
          >
            <view.icon className="w-4 h-4" />
            {view.label}
          </button>
        ))}
      </div>
      <div className="qn-workspace-canvas flex-1 overflow-y-auto">
        {activeView === 'week' && (
          <div className="flex h-full">
            <div className="w-20 flex-shrink-0 border-r border-subtle bg-surface-sunken">
              {DAYS.map((day, index) => {
                const dayKey = day.toLowerCase()
                const dayData = plannerData.days[dayKey]
                const date = getDateForDay(index)
                const isToday = date.toDateString() === new Date().toDateString()
                const completedTasks = dayData?.tasks.filter(t => t.completed).length || 0
                const totalTasks = dayData?.tasks.length || 0

                return (
                  <button
                    key={day}
                    onClick={() => setSelectedDay(dayKey)}
                    aria-label={`Plan ${day}, ${date.toLocaleDateString('en-US')}`}
                    aria-pressed={selectedDay === dayKey}
                    className={`w-full p-3 flex flex-col items-center transition-colors ${
 selectedDay === dayKey
 ? 'bg-accent-soft border-r-2 border-accent'
                        : 'hover:bg-surface-hover'
                    }`}
                  >
                    <span className={`text-xs font-medium ${
 isToday || selectedDay === dayKey ? 'text-accent-text' : 'text-content-muted'
 }`}>
                      {SHORT_DAYS[index]}
                    </span>
                    <span className={`text-lg font-bold ${
 isToday 
 ? 'w-8 h-8 bg-accent text-accent-on rounded-full flex items-center justify-center'
                        : 'text-content'
                    }`}>
                      {date.getDate()}
                    </span>
                    {totalTasks > 0 && (
                      <div className="flex gap-0.5 mt-1">
                        {[...Array(Math.min(totalTasks, 5))].map((_, i) => (
                          <div
                            key={i}
                            className={`w-1.5 h-1.5 rounded-full ${
 i < completedTasks ? 'bg-green-500' : 'bg-surface-active'
 }`}
                          />
                        ))}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
            <div className="flex-1 p-4 overflow-y-auto">
              <div className="qn-workspace-panel mx-auto max-w-2xl p-5">
                <div className="qn-weekly-day-heading flex items-start justify-between gap-4 mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-content capitalize">
                      {selectedDay}
                    </h2>
                    <p className="text-content-muted">
                      {getDateForDay(DAYS.findIndex(d => d.toLowerCase() === selectedDay))
                        .toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                  <div className="qn-weekly-rating flex flex-shrink-0 gap-1">
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <button
                        key={rating}
                        onClick={() => updateDay(selectedDay, 'rating', rating)}
                        aria-label={`Rate ${selectedDay} ${rating} out of 5`}
                        aria-pressed={(plannerData.days[selectedDay]?.rating || 0) === rating}
                        className={`p-1 transition-colors ${
 (plannerData.days[selectedDay]?.rating || 0) >= rating
 ? 'text-accent-text'
                            : 'text-content-subtle hover:text-yellow-400'
                        }`}
                      >
                        <Star className={`w-6 h-6 ${
 (plannerData.days[selectedDay]?.rating || 0) >= rating ? 'fill-current' : ''
 }`} />
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-content-muted mb-2 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Events & Appointments
                  </h3>
                  <div className="space-y-2 mb-3">
                    {plannerData.days[selectedDay]?.events.map((event) => (
                      <div
                        key={event.id}
                        className="qn-domain-card flex items-center gap-3 rounded-card border border-[var(--qn-info-border)] bg-info-soft p-2"
                      >
                        {event.time && (
                          <span className="text-sm font-medium text-accent-text">
                            {event.time}
                          </span>
                        )}
                        <span className="flex-1 text-content">{event.text}</span>
                        <button
                          onClick={() => removeEvent(selectedDay, event.id)}
                          aria-label={`Delete ${event.text}`}
                          className="p-1 text-content-subtle hover:text-red-500"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      type="time"
                      aria-label={`Time for new ${selectedDay} event`}
                      value={newEventTime}
                      onChange={(e) => setNewEventTime(e.target.value)}
                      className="px-3 py-2 rounded-lg bg-surface-sunken border border-subtle outline-none text-content"
                    />
                    <input
                      type="text"
                      aria-label={`New ${selectedDay} event`}
                      value={newEvent}
                      onChange={(e) => setNewEvent(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addEvent(selectedDay)}
                      placeholder="Add event..."
                      className="flex-1 px-3 py-2 rounded-lg bg-surface-sunken border border-subtle outline-none text-content"
                    />
                    <button
                      onClick={() => addEvent(selectedDay)}
                      aria-label={`Add event to ${selectedDay}`}
                      className="px-3 py-2 rounded-lg bg-accent hover:bg-accent-hover text-accent-on"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-content-muted mb-2 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    Tasks
                  </h3>
                  {TIME_BLOCKS.map((block) => {
                    const BlockIcon = block.icon
                    const tasks = plannerData.days[selectedDay]?.tasks.filter(t => t.timeBlock === block.id) || []
                    
                    return (
                      <div key={block.id} className="mb-4">
                        <div className="flex items-center gap-2 mb-2">
                          <BlockIcon className="w-4 h-4" style={{ color: block.color }} />
                          <span className="text-sm font-medium text-content-muted">
                            {block.label}
                          </span>
                          <span className="text-xs text-content-subtle">
                            ({tasks.filter(t => t.completed).length}/{tasks.length})
                          </span>
                        </div>
                        <div className="space-y-1 ml-6">
                          {tasks.map((task) => (
                            <div
                              key={task.id}
                              className={`qn-domain-card flex items-center gap-2 rounded-card border p-2 ${
 task.completed
 ? 'border-[var(--qn-success-border)] bg-success-soft'
                                  : 'border-subtle bg-surface-raised shadow-xs'
                              }`}
                            >
                              <button
                                onClick={() => toggleTask(selectedDay, task.id)}
                                aria-label={task.completed ? `Mark ${task.text} incomplete` : `Complete ${task.text}`}
                              >
                                {task.completed ? (
                                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                                ) : (
                                  <Circle className="w-5 h-5 text-content-subtle" />
                                )}
                              </button>
                              <span className={`flex-1 ${
 task.completed ? 'text-content-subtle line-through' : 'text-content'
 }`}>
                                {task.text}
                              </span>
                              <button
                                onClick={() => removeTask(selectedDay, task.id)}
                                aria-label={`Delete ${task.text}`}
                                className="p-1 text-content-subtle hover:text-red-500"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                  <div className="flex flex-col gap-2 mt-3 sm:flex-row">
                    <select
                      aria-label={`Time block for new ${selectedDay} task`}
                      value={newTaskTime}
                      onChange={(e) => setNewTaskTime(e.target.value)}
                      className="px-3 py-2 rounded-lg bg-surface-sunken border border-subtle outline-none text-content"
                    >
                      {TIME_BLOCKS.map((block) => (
                        <option key={block.id} value={block.id}>{block.label}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      aria-label={`New ${selectedDay} task`}
                      value={newTask}
                      onChange={(e) => setNewTask(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addTask(selectedDay)}
                      placeholder="Add task..."
                      className="flex-1 px-3 py-2 rounded-lg bg-surface-sunken border border-subtle outline-none text-content"
                    />
                    <button
                      onClick={() => addTask(selectedDay)}
                      aria-label={`Add task to ${selectedDay}`}
                      className="px-3 py-2 rounded-lg bg-accent hover:bg-accent-hover text-accent-on"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-content-muted mb-2">Notes</h3>
                  <textarea
                    aria-label={`Notes for ${selectedDay}`}
                    value={plannerData.days[selectedDay]?.note || ''}
                    onChange={(e) => updateDay(selectedDay, 'note', e.target.value)}
                    placeholder="Add notes for this day..."
                    className="w-full px-4 py-3 rounded-lg bg-surface-sunken border border-subtle outline-none text-content resize-none"
                    rows={4}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
        {activeView === 'goals' && (
          <div className="qn-workspace-panel mx-auto max-w-2xl p-5">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-content mb-1 flex items-center gap-2">
                <Target className="w-6 h-6 text-accent-text" />
                Weekly Goals
              </h2>
              <p className="text-content-muted">What do you want to accomplish this week?</p>
            </div>
            <div className="flex flex-col gap-2 mb-6 sm:flex-row">
              <input
                type="text"
                aria-label="New weekly goal"
                value={newGoal}
                onChange={(e) => setNewGoal(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addGoal()}
                placeholder="Add a weekly goal..."
                className="flex-1 px-4 py-3 rounded-xl bg-surface-sunken border border-subtle outline-none text-content"
              />
              <button
                onClick={addGoal}
                className={buttonClasses({ variant: 'primary' })}
              >
                Add Goal
              </button>
            </div>
            <div className="space-y-3">
              {plannerData.weeklyGoals.length === 0 ? (
                <EmptyState
                  icon={Target}
                  title="No goals set for this week"
                  description="Add a goal above to keep the week focused."
                  size="sm"
                />
              ) : (
                [...plannerData.weeklyGoals]
                  .sort((a, b) => (b.priority ? 1 : 0) - (a.priority ? 1 : 0))
                  .map((goal) => (
                    <div
                      key={goal.id}
                      className={`qn-domain-card flex items-center gap-4 rounded-card border p-4 ${
 goal.completed
 ? 'border-[var(--qn-success-border)] bg-success-soft'
                          : goal.priority
                          ? 'border-[var(--qn-accent-border)] bg-accent-soft'
                          : 'border-subtle bg-surface-raised shadow-xs'
                      }`}
                    >
                      <button
                        onClick={() => toggleGoal(goal.id)}
                        aria-label={goal.completed ? `Mark ${goal.text} incomplete` : `Complete ${goal.text}`}
                      >
                        {goal.completed ? (
                          <CheckCircle2 className="w-6 h-6 text-green-500" />
                        ) : (
                          <Circle className="w-6 h-6 text-content-subtle" />
                        )}
                      </button>
                      <span className={`flex-1 text-lg ${
 goal.completed ? 'text-content-subtle line-through' : 'text-content'
 }`}>
                        {goal.text}
                      </span>
                      <button
                        onClick={() => toggleGoalPriority(goal.id)}
                        aria-label={goal.priority ? `Remove priority from ${goal.text}` : `Prioritize ${goal.text}`}
                        aria-pressed={goal.priority}
                        className={`p-2 rounded ${goal.priority ? 'text-accent-text' : 'text-content-subtle'}`}
                      >
                        <Flame className={`w-5 h-5 ${goal.priority ? 'fill-current' : ''}`} />
                      </button>
                      <button
                        onClick={() => removeGoal(goal.id)}
                        aria-label={`Delete ${goal.text}`}
                        className="p-2 text-content-subtle hover:text-red-500"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  ))
              )}
            </div>
            {plannerData.weeklyGoals.length > 0 && (
              <div className="mt-6 rounded-card border border-subtle bg-[var(--qn-surface-brand-tint)] p-4">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-ui-sm font-medium uppercase tracking-wide text-content-muted">Weekly goal progress</p>
                    <p className="mt-1 text-title-md font-semibold text-content">
                      {stats.completedGoals} of {stats.totalGoals} completed
                    </p>
                  </div>
                  <div className="text-title-lg font-semibold tabular-nums text-content">
                    {stats.totalGoals > 0 ? Math.round((stats.completedGoals / stats.totalGoals) * 100) : 0}%
                  </div>
                </div>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface-active">
                  <div
                    className="h-full rounded-full bg-accent transition-[width]"
                    style={{ width: `${stats.totalGoals > 0 ? (stats.completedGoals / stats.totalGoals) * 100 : 0}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}
        {activeView === 'review' && (
          <div className="qn-workspace-panel mx-auto max-w-2xl p-5">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-content mb-1 flex items-center gap-2">
                <BarChart3 className="w-6 h-6 text-accent-text" />
                Weekly Review
              </h2>
              <p className="text-content-muted">Reflect on your week and plan for the next</p>
            </div>
            <div className="mb-8">
              <WorkspaceMetrics
                items={[
                  { label: 'Tasks completed', value: stats.completedTasks, tone: stats.completedTasks ? 'success' : 'neutral' },
                  { label: 'Goals achieved', value: stats.completedGoals, tone: stats.completedGoals ? 'success' : 'neutral' },
                  { label: 'Days rated', value: Object.values(plannerData.days).filter((day) => day.rating).length },
                ]}
              />
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-content-muted mb-2">
                  What did I accomplish this week?
                </label>
                <textarea
                  aria-label="Weekly accomplishments"
                  value={plannerData.review.accomplishments}
                  onChange={(e) => updateReview('accomplishments', e.target.value)}
                  placeholder="List your wins and achievements..."
                  className="w-full px-4 py-3 rounded-xl bg-surface-sunken border border-subtle outline-none text-content resize-none"
                  rows={4}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-content-muted mb-2">
                  What challenges did I face?
                </label>
                <textarea
                  aria-label="Weekly challenges"
                  value={plannerData.review.challenges}
                  onChange={(e) => updateReview('challenges', e.target.value)}
                  placeholder="What obstacles or difficulties came up?"
                  className="w-full px-4 py-3 rounded-xl bg-surface-sunken border border-subtle outline-none text-content resize-none"
                  rows={4}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-content-muted mb-2">
                  What did I learn?
                </label>
                <textarea
                  aria-label="Weekly lessons"
                  value={plannerData.review.lessons}
                  onChange={(e) => updateReview('lessons', e.target.value)}
                  placeholder="Key insights and lessons from this week..."
                  className="w-full px-4 py-3 rounded-xl bg-surface-sunken border border-subtle outline-none text-content resize-none"
                  rows={4}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-content-muted mb-2">
                  Focus for next week
                </label>
                <textarea
                  aria-label="Focus for next week"
                  value={plannerData.review.nextWeekFocus}
                  onChange={(e) => updateReview('nextWeekFocus', e.target.value)}
                  placeholder="What's the priority for next week?"
                  className="w-full px-4 py-3 rounded-xl bg-surface-sunken border border-subtle outline-none text-content resize-none"
                  rows={4}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
