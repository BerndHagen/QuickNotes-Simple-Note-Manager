import React, { useState, useEffect, useRef } from 'react'
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
  Trophy,
  Flame
} from 'lucide-react'
import { generateId } from './noteTypes'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const SHORT_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const TIME_BLOCKS = [
  { id: 'morning', label: 'Morning', icon: Sun, color: '#f59e0b' },
  { id: 'afternoon', label: 'Afternoon', icon: Sunset, color: '#f97316' },
  { id: 'evening', label: 'Evening', icon: Moon, color: '#6366f1' },
]

export default function WeeklyPlannerEditor({ data, onChange, noteTitle }) {
  const getWeekStart = (date = new Date()) => {
    const d = new Date(date)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    d.setDate(diff)
    d.setHours(0, 0, 0, 0)
    return d.toISOString().split('T')[0]
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

  const [activeView, setActiveView] = useState('week')
  const [selectedDay, setSelectedDay] = useState(DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1].toLowerCase())
  const [newGoal, setNewGoal] = useState('')
  const [newTask, setNewTask] = useState('')
  const [newTaskTime, setNewTaskTime] = useState('morning')
  const [newEvent, setNewEvent] = useState('')
  const [newEventTime, setNewEventTime] = useState('')
  const isInitialMount = useRef(true)
  useEffect(() => {
    if (isInitialMount.current) { isInitialMount.current = false; return }
    onChange?.(plannerData)
  }, [plannerData])

  const update = (field, value) => {
    setPlannerData(prev => ({ ...prev, [field]: value }))
  }
  const navigateWeek = (direction) => {
    const current = new Date(plannerData.weekStart)
    current.setDate(current.getDate() + (direction * 7))
    update('weekStart', current.toISOString().split('T')[0])
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
    const start = new Date(plannerData.weekStart)
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
  const weekStartDate = new Date(plannerData.weekStart)
  const weekEndDate = new Date(weekStartDate)
  weekEndDate.setDate(weekEndDate.getDate() + 6)
  const weekLabel = `${weekStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEndDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`

  const views = [
    { id: 'week', label: 'Week View', icon: CalendarDays },
    { id: 'goals', label: 'Goals', icon: Target },
    { id: 'review', label: 'Weekly Review', icon: BarChart3 },
  ]

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      <div className="flex-shrink-0 p-4 border-b border-[#cbd1db] dark:border-gray-700 bg-[#e5eaf0] dark:bg-gray-800">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Calendar className="w-7 h-7" />
              {noteTitle || 'Weekly Planner'}
            </h1>
            <div className="flex items-center gap-3 mt-2">
              <button
                onClick={() => navigateWeek(-1)}
                className="p-1 rounded-lg bg-gray-200/50 dark:bg-gray-700 hover:bg-gray-300/50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-gray-900 dark:text-white font-medium">{weekLabel}</span>
              <button
                onClick={() => navigateWeek(1)}
                className="p-1 rounded-lg bg-gray-200/50 dark:bg-gray-700 hover:bg-gray-300/50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              {plannerData.weekStart !== getWeekStart() && (
                <button
                  onClick={goToCurrentWeek}
                  className="px-3 py-1 rounded-lg bg-gray-200/50 dark:bg-gray-700 hover:bg-gray-300/50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-sm"
                >
                  Today
                </button>
              )}
            </div>
          </div>
          <div className="flex gap-6 text-gray-900 dark:text-white">
            <div className="text-center">
              <div className="text-3xl font-bold">{stats.completedTasks}/{stats.totalTasks}</div>
              <div className="text-gray-500 dark:text-gray-400 text-sm">Tasks Done</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold">{stats.completedGoals}/{stats.totalGoals}</div>
              <div className="text-gray-500 dark:text-gray-400 text-sm">Goals Met</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold">{completionPercent}%</div>
              <div className="text-gray-500 dark:text-gray-400 text-sm">Complete</div>
            </div>
          </div>
        </div>
        <div className="w-full h-2 rounded-full bg-gray-300 dark:bg-gray-600 overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all"
            style={{ width: `${completionPercent}%` }}
          />
        </div>
      </div>
      <div className="flex-shrink-0 flex gap-1 p-2 border-b border-[#cbd1db] dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        {views.map((view) => (
          <button
            key={view.id}
            onClick={() => setActiveView(view.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeView === view.id
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <view.icon className="w-4 h-4" />
            {view.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto">
        {activeView === 'week' && (
          <div className="flex h-full">
            <div className="w-20 flex-shrink-0 border-r border-[#cbd1db] dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
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
                    className={`w-full p-3 flex flex-col items-center transition-colors ${
                      selectedDay === dayKey
                        ? 'bg-blue-100 dark:bg-blue-900/30 border-r-2 border-blue-500'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <span className={`text-xs font-medium ${
                      isToday ? 'text-blue-500' : 'text-gray-500'
                    }`}>
                      {SHORT_DAYS[index]}
                    </span>
                    <span className={`text-lg font-bold ${
                      isToday 
                        ? 'w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center'
                        : 'text-gray-900 dark:text-white'
                    }`}>
                      {date.getDate()}
                    </span>
                    {totalTasks > 0 && (
                      <div className="flex gap-0.5 mt-1">
                        {[...Array(Math.min(totalTasks, 5))].map((_, i) => (
                          <div
                            key={i}
                            className={`w-1.5 h-1.5 rounded-full ${
                              i < completedTasks ? 'bg-green-500' : 'bg-gray-300'
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
              <div className="max-w-2xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white capitalize">
                      {selectedDay}
                    </h2>
                    <p className="text-gray-500">
                      {getDateForDay(DAYS.findIndex(d => d.toLowerCase() === selectedDay))
                        .toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <button
                        key={rating}
                        onClick={() => updateDay(selectedDay, 'rating', rating)}
                        className={`p-1 transition-colors ${
                          (plannerData.days[selectedDay]?.rating || 0) >= rating
                            ? 'text-yellow-500'
                            : 'text-gray-300 hover:text-yellow-400'
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
                  <h3 className="text-sm font-semibold text-gray-500 mb-2 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Events & Appointments
                  </h3>
                  <div className="space-y-2 mb-3">
                    {plannerData.days[selectedDay]?.events.map((event) => (
                      <div
                        key={event.id}
                        className="flex items-center gap-3 p-2 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800"
                      >
                        {event.time && (
                          <span className="text-sm font-medium text-purple-600 dark:text-purple-400">
                            {event.time}
                          </span>
                        )}
                        <span className="flex-1 text-gray-900 dark:text-white">{event.text}</span>
                        <button
                          onClick={() => removeEvent(selectedDay, event.id)}
                          className="p-1 text-gray-400 hover:text-red-500"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="time"
                      value={newEventTime}
                      onChange={(e) => setNewEventTime(e.target.value)}
                      className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 border border-[#cbd1db] dark:border-gray-600 outline-none text-gray-900 dark:text-white"
                    />
                    <input
                      type="text"
                      value={newEvent}
                      onChange={(e) => setNewEvent(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addEvent(selectedDay)}
                      placeholder="Add event..."
                      className="flex-1 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 border border-[#cbd1db] dark:border-gray-600 outline-none text-gray-900 dark:text-white"
                    />
                    <button
                      onClick={() => addEvent(selectedDay)}
                      className="px-3 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 text-white"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-gray-500 mb-2 flex items-center gap-2">
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
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {block.label}
                          </span>
                          <span className="text-xs text-gray-400">
                            ({tasks.filter(t => t.completed).length}/{tasks.length})
                          </span>
                        </div>
                        <div className="space-y-1 ml-6">
                          {tasks.map((task) => (
                            <div
                              key={task.id}
                              className={`flex items-center gap-2 p-2 rounded-lg ${
                                task.completed
                                  ? 'bg-green-50 dark:bg-green-900/20'
                                  : 'bg-gray-50 dark:bg-gray-800'
                              }`}
                            >
                              <button onClick={() => toggleTask(selectedDay, task.id)}>
                                {task.completed ? (
                                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                                ) : (
                                  <Circle className="w-5 h-5 text-gray-400" />
                                )}
                              </button>
                              <span className={`flex-1 ${
                                task.completed ? 'text-gray-400 line-through' : 'text-gray-900 dark:text-white'
                              }`}>
                                {task.text}
                              </span>
                              <button
                                onClick={() => removeTask(selectedDay, task.id)}
                                className="p-1 text-gray-400 hover:text-red-500"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                  <div className="flex gap-2 mt-3">
                    <select
                      value={newTaskTime}
                      onChange={(e) => setNewTaskTime(e.target.value)}
                      className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 border border-[#cbd1db] dark:border-gray-600 outline-none text-gray-900 dark:text-white"
                    >
                      {TIME_BLOCKS.map((block) => (
                        <option key={block.id} value={block.id}>{block.label}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={newTask}
                      onChange={(e) => setNewTask(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addTask(selectedDay)}
                      placeholder="Add task..."
                      className="flex-1 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 border border-[#cbd1db] dark:border-gray-600 outline-none text-gray-900 dark:text-white"
                    />
                    <button
                      onClick={() => addTask(selectedDay)}
                      className="px-3 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 mb-2">Notes</h3>
                  <textarea
                    value={plannerData.days[selectedDay]?.note || ''}
                    onChange={(e) => updateDay(selectedDay, 'note', e.target.value)}
                    placeholder="Add notes for this day..."
                    className="w-full px-4 py-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-[#cbd1db] dark:border-gray-700 outline-none text-gray-900 dark:text-white resize-none"
                    rows={4}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
        {activeView === 'goals' && (
          <div className="p-6 max-w-2xl mx-auto">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
                <Target className="w-6 h-6 text-blue-500" />
                Weekly Goals
              </h2>
              <p className="text-gray-500">What do you want to accomplish this week?</p>
            </div>
            <div className="flex gap-2 mb-6">
              <input
                type="text"
                value={newGoal}
                onChange={(e) => setNewGoal(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addGoal()}
                placeholder="Add a weekly goal..."
                className="flex-1 px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 border border-[#cbd1db] dark:border-gray-600 outline-none text-gray-900 dark:text-white"
              />
              <button
                onClick={addGoal}
                className="px-6 py-3 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-medium"
              >
                Add Goal
              </button>
            </div>
            <div className="space-y-3">
              {plannerData.weeklyGoals.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <Target className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No goals set for this week yet</p>
                </div>
              ) : (
                plannerData.weeklyGoals
                  .sort((a, b) => (b.priority ? 1 : 0) - (a.priority ? 1 : 0))
                  .map((goal) => (
                    <div
                      key={goal.id}
                      className={`flex items-center gap-4 p-4 rounded-xl ${
                        goal.completed
                          ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                          : goal.priority
                          ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                          : 'bg-gray-50 dark:bg-gray-800 border border-[#cbd1db] dark:border-gray-700'
                      }`}
                    >
                      <button onClick={() => toggleGoal(goal.id)}>
                        {goal.completed ? (
                          <CheckCircle2 className="w-6 h-6 text-green-500" />
                        ) : (
                          <Circle className="w-6 h-6 text-gray-400" />
                        )}
                      </button>
                      <span className={`flex-1 text-lg ${
                        goal.completed ? 'text-gray-400 line-through' : 'text-gray-900 dark:text-white'
                      }`}>
                        {goal.text}
                      </span>
                      <button
                        onClick={() => toggleGoalPriority(goal.id)}
                        className={`p-2 rounded ${goal.priority ? 'text-blue-500' : 'text-gray-400'}`}
                      >
                        <Flame className={`w-5 h-5 ${goal.priority ? 'fill-current' : ''}`} />
                      </button>
                      <button
                        onClick={() => removeGoal(goal.id)}
                        className="p-2 text-gray-400 hover:text-red-500"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  ))
              )}
            </div>
            {plannerData.weeklyGoals.length > 0 && (
              <div className="mt-8 p-6 rounded-xl bg-[#e5eaf0] dark:bg-gray-800 border border-[#cbd1db] dark:border-gray-700">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Weekly Goal Progress</p>
                    <p className="text-3xl font-bold mt-1 text-gray-900 dark:text-white">
                      {stats.completedGoals} of {stats.totalGoals} completed
                    </p>
                  </div>
                  <div className="text-6xl font-bold text-gray-900 dark:text-white">
                    {stats.totalGoals > 0 ? Math.round((stats.completedGoals / stats.totalGoals) * 100) : 0}%
                  </div>
                </div>
                <div className="mt-4 w-full h-3 rounded-full bg-white/30 overflow-hidden">
                  <div
                    className="h-full bg-white rounded-full transition-all"
                    style={{ width: `${stats.totalGoals > 0 ? (stats.completedGoals / stats.totalGoals) * 100 : 0}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}
        {activeView === 'review' && (
          <div className="p-6 max-w-2xl mx-auto">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
                <BarChart3 className="w-6 h-6 text-blue-500" />
                Weekly Review
              </h2>
              <p className="text-gray-500">Reflect on your week and plan for the next</p>
            </div>
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-center">
                <Trophy className="w-8 h-8 text-green-500 mx-auto mb-2" />
                <div className="text-2xl font-bold text-green-600">{stats.completedTasks}</div>
                <div className="text-sm text-green-500">Tasks Completed</div>
              </div>
              <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-center">
                <Target className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                <div className="text-2xl font-bold text-blue-600">{stats.completedGoals}</div>
                <div className="text-sm text-blue-500">Goals Achieved</div>
              </div>
              <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 text-center">
                <Star className="w-8 h-8 text-purple-500 mx-auto mb-2" />
                <div className="text-2xl font-bold text-purple-600">
                  {Object.values(plannerData.days).filter(d => d.rating).length}
                </div>
                <div className="text-sm text-purple-500">Days Rated</div>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  What did I accomplish this week?
                </label>
                <textarea
                  value={plannerData.review.accomplishments}
                  onChange={(e) => updateReview('accomplishments', e.target.value)}
                  placeholder="List your wins and achievements..."
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-[#cbd1db] dark:border-gray-700 outline-none text-gray-900 dark:text-white resize-none"
                  rows={4}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  What challenges did I face?
                </label>
                <textarea
                  value={plannerData.review.challenges}
                  onChange={(e) => updateReview('challenges', e.target.value)}
                  placeholder="What obstacles or difficulties came up?"
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-[#cbd1db] dark:border-gray-700 outline-none text-gray-900 dark:text-white resize-none"
                  rows={4}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  What did I learn?
                </label>
                <textarea
                  value={plannerData.review.lessons}
                  onChange={(e) => updateReview('lessons', e.target.value)}
                  placeholder="Key insights and lessons from this week..."
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-[#cbd1db] dark:border-gray-700 outline-none text-gray-900 dark:text-white resize-none"
                  rows={4}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Focus for next week
                </label>
                <textarea
                  value={plannerData.review.nextWeekFocus}
                  onChange={(e) => updateReview('nextWeekFocus', e.target.value)}
                  placeholder="What's the priority for next week?"
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-[#cbd1db] dark:border-gray-700 outline-none text-gray-900 dark:text-white resize-none"
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
