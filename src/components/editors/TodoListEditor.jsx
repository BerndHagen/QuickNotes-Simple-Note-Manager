import React, { useState, useEffect, useRef } from 'react'
import {
  Plus,
  Trash2,
  Calendar,
  Flag,
  ChevronDown,
  ChevronRight,
  GripVertical,
  CheckCircle2,
  Circle,
  Clock,
  Filter,
  SortAsc,
  MoreHorizontal,
  Edit3,
  Copy,
  Star,
  AlertCircle,
  CheckCheck,
  ListTodo,
  X
} from 'lucide-react'
import { generateId } from './noteTypes'
const PRIORITIES = {
  high: { label: 'High', color: '#ef4444', bgColor: '#fef2f2', icon: '\u{1F534}' },
  medium: { label: 'Medium', color: '#f59e0b', bgColor: '#fffbeb', icon: '\u{1F7E1}' },
  low: { label: 'Low', color: '#22c55e', bgColor: '#f0fdf4', icon: '\u{1F7E2}' },
  none: { label: 'None', color: '#6b7280', bgColor: '#f9fafb', icon: '\u26AA' },
}
const FILTERS = [
  { id: 'all', label: 'All Tasks', icon: ListTodo },
  { id: 'active', label: 'Active', icon: Circle },
  { id: 'completed', label: 'Completed', icon: CheckCircle2 },
  { id: 'today', label: 'Due Today', icon: Clock },
  { id: 'overdue', label: 'Overdue', icon: AlertCircle },
  { id: 'starred', label: 'Starred', icon: Star },
]
const SORT_OPTIONS = [
  { id: 'priority', label: 'Priority' },
  { id: 'dueDate', label: 'Due Date' },
  { id: 'created', label: 'Created' },
  { id: 'alphabetical', label: 'A-Z' },
]

export default function TodoListEditor({ data, onChange, noteTitle }) {
  const [tasks, setTasks] = useState(data?.tasks || [])
  const [filter, setFilter] = useState(data?.filter || 'all')
  const [sortBy, setSortBy] = useState(data?.sortBy || 'priority')
  const [newTaskText, setNewTaskText] = useState('')
  const [editingTaskId, setEditingTaskId] = useState(null)
  const [expandedTaskId, setExpandedTaskId] = useState(null)
  const [showFilterMenu, setShowFilterMenu] = useState(false)
  const [showSortMenu, setShowSortMenu] = useState(false)
  const [draggedTask, setDraggedTask] = useState(null)
  
  const inputRef = useRef(null)
  const filterRef = useRef(null)
  const sortRef = useRef(null)
  const isInitialMount = useRef(true)
  useEffect(() => {
    if (isInitialMount.current) { isInitialMount.current = false; return }
    onChange?.({ tasks, filter, sortBy })
  }, [tasks, filter, sortBy])
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) {
        setShowFilterMenu(false)
      }
      if (sortRef.current && !sortRef.current.contains(e.target)) {
        setShowSortMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])
  const addTask = () => {
    if (!newTaskText.trim()) return
    
    const newTask = {
      id: generateId(),
      text: newTaskText.trim(),
      completed: false,
      priority: 'none',
      dueDate: null,
      starred: false,
      subtasks: [],
      notes: '',
      createdAt: new Date().toISOString(),
      completedAt: null,
    }
    
    setTasks([newTask, ...tasks])
    setNewTaskText('')
    inputRef.current?.focus()
  }
  const toggleTask = (taskId) => {
    setTasks(tasks.map(task => {
      if (task.id === taskId) {
        return {
          ...task,
          completed: !task.completed,
          completedAt: !task.completed ? new Date().toISOString() : null,
        }
      }
      return task
    }))
  }
  const updateTask = (taskId, updates) => {
    setTasks(tasks.map(task => 
      task.id === taskId ? { ...task, ...updates } : task
    ))
  }
  const deleteTask = (taskId) => {
    setTasks(tasks.filter(task => task.id !== taskId))
  }
  const duplicateTask = (task) => {
    const newTask = {
      ...task,
      id: generateId(),
      completed: false,
      completedAt: null,
      createdAt: new Date().toISOString(),
    }
    setTasks([newTask, ...tasks])
  }
  const addSubtask = (taskId, text) => {
    if (!text.trim()) return
    setTasks(tasks.map(task => {
      if (task.id === taskId) {
        return {
          ...task,
          subtasks: [
            ...task.subtasks,
            { id: generateId(), text: text.trim(), completed: false }
          ],
        }
      }
      return task
    }))
  }
  const toggleSubtask = (taskId, subtaskId) => {
    setTasks(tasks.map(task => {
      if (task.id === taskId) {
        return {
          ...task,
          subtasks: task.subtasks.map(st =>
            st.id === subtaskId ? { ...st, completed: !st.completed } : st
          ),
        }
      }
      return task
    }))
  }
  const deleteSubtask = (taskId, subtaskId) => {
    setTasks(tasks.map(task => {
      if (task.id === taskId) {
        return {
          ...task,
          subtasks: task.subtasks.filter(st => st.id !== subtaskId),
        }
      }
      return task
    }))
  }
  const getFilteredTasks = () => {
    let filtered = [...tasks]
    const today = new Date().toISOString().split('T')[0]
    switch (filter) {
      case 'active':
        filtered = filtered.filter(t => !t.completed)
        break
      case 'completed':
        filtered = filtered.filter(t => t.completed)
        break
      case 'today':
        filtered = filtered.filter(t => t.dueDate === today)
        break
      case 'overdue':
        filtered = filtered.filter(t => t.dueDate && t.dueDate < today && !t.completed)
        break
      case 'starred':
        filtered = filtered.filter(t => t.starred)
        break
    }
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'priority':
          const priorityOrder = { high: 0, medium: 1, low: 2, none: 3 }
          return priorityOrder[a.priority] - priorityOrder[b.priority]
        case 'dueDate':
          if (!a.dueDate) return 1
          if (!b.dueDate) return -1
          return new Date(a.dueDate) - new Date(b.dueDate)
        case 'created':
          return new Date(b.createdAt) - new Date(a.createdAt)
        case 'alphabetical':
          return a.text.localeCompare(b.text)
        default:
          return 0
      }
    })
    const active = filtered.filter(t => !t.completed)
    const completed = filtered.filter(t => t.completed)
    return [...active, ...completed]
  }
  const stats = {
    total: tasks.length,
    completed: tasks.filter(t => t.completed).length,
    active: tasks.filter(t => !t.completed).length,
    overdue: tasks.filter(t => t.dueDate && t.dueDate < new Date().toISOString().split('T')[0] && !t.completed).length,
    progress: tasks.length > 0 ? Math.round((tasks.filter(t => t.completed).length / tasks.length) * 100) : 0,
  }
  const handleDragStart = (e, task) => {
    setDraggedTask(task)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e, task) => {
    e.preventDefault()
    if (!draggedTask || draggedTask.id === task.id) return
  }

  const handleDrop = (e, targetTask) => {
    e.preventDefault()
    if (!draggedTask || draggedTask.id === targetTask.id) return

    const newTasks = [...tasks]
    const draggedIndex = newTasks.findIndex(t => t.id === draggedTask.id)
    const targetIndex = newTasks.findIndex(t => t.id === targetTask.id)

    newTasks.splice(draggedIndex, 1)
    newTasks.splice(targetIndex, 0, draggedTask)

    setTasks(newTasks)
    setDraggedTask(null)
  }

  const filteredTasks = getFilteredTasks()

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      <div className="flex-shrink-0 p-4 border-b border-gray-200 dark:border-gray-700 bg-[#e5eaf0] dark:bg-gray-800">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <CheckCircle2 className="w-7 h-7" />
              {noteTitle || 'To-Do List'}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
              {stats.active} tasks remaining {"\u2022"} {stats.completed} completed
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-16 h-16">
              <svg className="transform -rotate-90 w-16 h-16">
                <circle
                  cx="32" cy="32" r="28"
                  stroke="rgba(0,0,0,0.1)"
                  strokeWidth="8"
                  fill="none"
                />
                <circle
                  cx="32" cy="32" r="28"
                  stroke="#10b981"
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray={`${stats.progress * 1.76} 176`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-gray-900 dark:text-white font-bold text-sm">{stats.progress}%</span>
              </div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-white dark:bg-gray-700 rounded-lg p-2 text-center">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Total</div>
          </div>
          <div className="bg-white dark:bg-gray-700 rounded-lg p-2 text-center">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.active}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Active</div>
          </div>
          <div className="bg-white dark:bg-gray-700 rounded-lg p-2 text-center">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.completed}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Done</div>
          </div>
          <div className="bg-white dark:bg-gray-700 rounded-lg p-2 text-center">
            <div className="text-2xl font-bold text-red-500 dark:text-red-400">{stats.overdue}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Overdue</div>
          </div>
        </div>
      </div>
      <div className="flex-shrink-0 p-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2 bg-gray-50 dark:bg-gray-800">
        <div className="relative" ref={filterRef}>
          <button
            onClick={() => setShowFilterMenu(!showFilterMenu)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
          >
            <Filter className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {FILTERS.find(f => f.id === filter)?.label}
            </span>
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </button>
          
          {showFilterMenu && (
            <div className="absolute top-full left-0 mt-1.5 w-48 bg-white dark:bg-gray-900 rounded-2xl shadow-xl shadow-black/5 dark:shadow-black/20 border border-[#cbd1db] dark:border-gray-700 z-50 overflow-hidden backdrop-blur-xl py-1.5">
              {FILTERS.map((f) => {
                const Icon = f.icon
                return (
                  <button
                    key={f.id}
                    onClick={() => { setFilter(f.id); setShowFilterMenu(false) }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${
                      filter === f.id ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600' : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {f.label}
                  </button>
                )
              })}
            </div>
          )}
        </div>
        <div className="relative" ref={sortRef}>
          <button
            onClick={() => setShowSortMenu(!showSortMenu)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
          >
            <SortAsc className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {SORT_OPTIONS.find(s => s.id === sortBy)?.label}
            </span>
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </button>
          
          {showSortMenu && (
            <div className="absolute top-full left-0 mt-1.5 w-40 bg-white dark:bg-gray-900 rounded-2xl shadow-xl shadow-black/5 dark:shadow-black/20 border border-[#cbd1db] dark:border-gray-700 z-50 overflow-hidden backdrop-blur-xl py-1.5">
              {SORT_OPTIONS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => { setSortBy(s.id); setShowSortMenu(false) }}
                  className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${
                    sortBy === s.id ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600' : 'text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1" />
        <button
          onClick={() => {
            const completedTasks = tasks.filter(t => t.completed)
            if (completedTasks.length > 0 && confirm(`Delete ${completedTasks.length} completed tasks?`)) {
              setTasks(tasks.filter(t => !t.completed))
            }
          }}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-sm"
          disabled={!tasks.some(t => t.completed)}
        >
          <CheckCheck className="w-4 h-4" />
          Clear Done
        </button>
      </div>
      <div className="flex-shrink-0 p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={newTaskText}
            onChange={(e) => setNewTaskText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addTask()}
            placeholder="Add a new task..."
            className="flex-1 px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 focus:border-emerald-500 focus:bg-white dark:focus:bg-gray-700 outline-none text-gray-900 dark:text-white placeholder-gray-500 transition-all"
          />
          <button
            onClick={addTask}
            disabled={!newTaskText.trim()}
            className="px-4 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white font-medium transition-colors flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Add
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {filteredTasks.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-500 dark:text-gray-400 font-medium">
              {filter === 'all' ? 'No tasks yet' : `No ${FILTERS.find(f => f.id === filter)?.label.toLowerCase()}`}
            </p>
            <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
              {filter === 'all' ? 'Add your first task above' : 'Try a different filter'}
            </p>
          </div>
        ) : (
          filteredTasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              isExpanded={expandedTaskId === task.id}
              isEditing={editingTaskId === task.id}
              onToggle={() => toggleTask(task.id)}
              onExpand={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)}
              onEdit={() => setEditingTaskId(task.id)}
              onSaveEdit={(text) => { updateTask(task.id, { text }); setEditingTaskId(null) }}
              onCancelEdit={() => setEditingTaskId(null)}
              onUpdate={(updates) => updateTask(task.id, updates)}
              onDelete={() => deleteTask(task.id)}
              onDuplicate={() => duplicateTask(task)}
              onAddSubtask={(text) => addSubtask(task.id, text)}
              onToggleSubtask={(subtaskId) => toggleSubtask(task.id, subtaskId)}
              onDeleteSubtask={(subtaskId) => deleteSubtask(task.id, subtaskId)}
              onDragStart={(e) => handleDragStart(e, task)}
              onDragOver={(e) => handleDragOver(e, task)}
              onDrop={(e) => handleDrop(e, task)}
            />
          ))
        )}
      </div>
    </div>
  )
}
function TaskItem({
  task,
  isExpanded,
  isEditing,
  onToggle,
  onExpand,
  onEdit,
  onSaveEdit,
  onCancelEdit,
  onUpdate,
  onDelete,
  onDuplicate,
  onAddSubtask,
  onToggleSubtask,
  onDeleteSubtask,
  onDragStart,
  onDragOver,
  onDrop,
}) {
  const [editText, setEditText] = useState(task.text)
  const [newSubtaskText, setNewSubtaskText] = useState('')
  const [showPriorityMenu, setShowPriorityMenu] = useState(false)
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const editInputRef = useRef(null)
  const priorityRef = useRef(null)
  const moreRef = useRef(null)

  useEffect(() => {
    if (isEditing) {
      editInputRef.current?.focus()
      editInputRef.current?.select()
    }
  }, [isEditing])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (priorityRef.current && !priorityRef.current.contains(e.target)) {
        setShowPriorityMenu(false)
      }
      if (moreRef.current && !moreRef.current.contains(e.target)) {
        setShowMoreMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const priority = PRIORITIES[task.priority]
  const isOverdue = task.dueDate && task.dueDate < new Date().toISOString().split('T')[0] && !task.completed
  const subtaskProgress = task.subtasks.length > 0 
    ? Math.round((task.subtasks.filter(st => st.completed).length / task.subtasks.length) * 100)
    : null

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`group rounded-xl border-2 transition-all ${
        task.completed 
          ? 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 opacity-60' 
          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-emerald-300 dark:hover:border-emerald-700'
      }`}
    >
      <div className="flex items-center gap-3 p-3">
        <div className="cursor-grab opacity-0 group-hover:opacity-100 transition-opacity">
          <GripVertical className="w-4 h-4 text-gray-400" />
        </div>
        <button
          onClick={onToggle}
          className="flex-shrink-0 transition-transform hover:scale-110"
        >
          {task.completed ? (
            <CheckCircle2 className="w-6 h-6 text-emerald-500" />
          ) : (
            <Circle className="w-6 h-6 text-gray-300 hover:text-emerald-500" />
          )}
        </button>
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <input
              ref={editInputRef}
              type="text"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSaveEdit(editText)
                if (e.key === 'Escape') onCancelEdit()
              }}
              onBlur={() => onSaveEdit(editText)}
              className="w-full px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 border border-emerald-500 outline-none text-gray-900 dark:text-white"
            />
          ) : (
            <div 
              className={`font-medium cursor-pointer ${
                task.completed ? 'line-through text-gray-400' : 'text-gray-900 dark:text-white'
              }`}
              onDoubleClick={onEdit}
            >
              {task.text}
            </div>
          )}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {task.dueDate && (
              <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${
                isOverdue 
                  ? 'bg-red-100 dark:bg-red-900/30 text-red-600' 
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
              }`}>
                <Calendar className="w-3 h-3" />
                {new Date(task.dueDate).toLocaleDateString()}
              </span>
            )}
            {task.subtasks.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600">
                {task.subtasks.filter(st => st.completed).length}/{task.subtasks.length} subtasks
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => onUpdate({ starred: !task.starred })}
          className={`p-1 rounded transition-colors ${
            task.starred ? 'text-yellow-500' : 'text-gray-300 hover:text-yellow-500'
          }`}
        >
          <Star className={`w-5 h-5 ${task.starred ? 'fill-yellow-500' : ''}`} />
        </button>
        <div className="relative" ref={priorityRef}>
          <button
            onClick={() => setShowPriorityMenu(!showPriorityMenu)}
            className="p-1.5 rounded-lg transition-colors"
            style={{ backgroundColor: priority.bgColor, color: priority.color }}
            title={`Priority: ${priority.label}`}
          >
            <Flag className="w-4 h-4" />
          </button>
          
          {showPriorityMenu && (
            <div className="absolute right-0 top-full mt-1.5 w-32 bg-white dark:bg-gray-900 rounded-2xl shadow-xl shadow-black/5 dark:shadow-black/20 border border-[#cbd1db] dark:border-gray-700 z-50 overflow-hidden backdrop-blur-xl py-1.5">
              {Object.entries(PRIORITIES).map(([key, value]) => (
                <button
                  key={key}
                  onClick={() => { onUpdate({ priority: key }); setShowPriorityMenu(false) }}
                  className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-800 ${
                    task.priority === key ? 'bg-gray-100 dark:bg-gray-800' : ''
                  }`}
                >
                  <span>{value.icon}</span>
                  <span style={{ color: value.color }}>{value.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="relative group/date">
          <input
            type="date"
            value={task.dueDate || ''}
            onChange={(e) => onUpdate({ dueDate: e.target.value || null })}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            style={{ colorScheme: 'dark light' }}
          />
          <button 
            className={`p-1.5 rounded-lg transition-all hover:scale-110 ${
              task.dueDate 
                ? isOverdue 
                  ? 'bg-red-100 dark:bg-red-900/30 text-red-500 hover:bg-red-200 dark:hover:bg-red-900/50'
                  : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 hover:bg-emerald-200 dark:hover:bg-emerald-900/50'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
            title={task.dueDate ? `Due: ${new Date(task.dueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}` : "Set due date"}
          >
            <Calendar className="w-4 h-4" />
          </button>
        </div>
        <button
          onClick={onExpand}
          className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        <div className="relative" ref={moreRef}>
          <button
            onClick={() => setShowMoreMenu(!showMoreMenu)}
            className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors opacity-0 group-hover:opacity-100"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
          
          {showMoreMenu && (
            <div className="absolute right-0 top-full mt-1.5 w-40 bg-white dark:bg-gray-900 rounded-2xl shadow-xl shadow-black/5 dark:shadow-black/20 border border-[#cbd1db] dark:border-gray-700 z-50 overflow-hidden backdrop-blur-xl py-1.5">
              <button
                onClick={() => { onEdit(); setShowMoreMenu(false) }}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2 transition-colors"
              >
                <Edit3 className="w-4 h-4 text-gray-400" /> Edit
              </button>
              <button
                onClick={() => { onDuplicate(); setShowMoreMenu(false) }}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2 transition-colors"
              >
                <Copy className="w-4 h-4 text-gray-400" /> Duplicate
              </button>
              <button
                onClick={() => { onDelete(); setShowMoreMenu(false) }}
                className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 flex items-center gap-2 transition-colors"
              >
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            </div>
          )}
        </div>
      </div>
      {isExpanded && (
        <div className="px-4 pb-4 pt-2 border-t border-gray-100 dark:border-gray-700">
          <div className="mb-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Subtasks</span>
              {subtaskProgress !== null && (
                <span className="text-xs text-gray-500">({subtaskProgress}%)</span>
              )}
            </div>
            
            <div className="space-y-1 mb-2">
              {task.subtasks.map((subtask) => (
                <div key={subtask.id} className="flex items-center gap-2 group/subtask">
                  <button
                    onClick={() => onToggleSubtask(subtask.id)}
                    className="flex-shrink-0"
                  >
                    {subtask.completed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <Circle className="w-4 h-4 text-gray-300 hover:text-emerald-500" />
                    )}
                  </button>
                  <span className={`flex-1 text-sm ${subtask.completed ? 'line-through text-gray-400' : 'text-gray-700 dark:text-gray-300'}`}>
                    {subtask.text}
                  </span>
                  <button
                    onClick={() => onDeleteSubtask(subtask.id)}
                    className="p-1 opacity-0 group-hover/subtask:opacity-100 text-gray-400 hover:text-red-500"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={newSubtaskText}
                onChange={(e) => setNewSubtaskText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newSubtaskText.trim()) {
                    onAddSubtask(newSubtaskText)
                    setNewSubtaskText('')
                  }
                }}
                placeholder="Add subtask..."
                className="flex-1 px-3 py-1.5 text-sm rounded-lg bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 focus:border-emerald-500 outline-none text-gray-900 dark:text-white"
              />
              <button
                onClick={() => {
                  if (newSubtaskText.trim()) {
                    onAddSubtask(newSubtaskText)
                    setNewSubtaskText('')
                  }
                }}
                className="px-3 py-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 hover:bg-emerald-200 dark:hover:bg-emerald-800/30 text-sm"
              >
                Add
              </button>
            </div>
          </div>
          <div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">Notes</span>
            <textarea
              value={task.notes}
              onChange={(e) => onUpdate({ notes: e.target.value })}
              placeholder="Add notes..."
              className="w-full px-3 py-2 text-sm rounded-lg bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 focus:border-emerald-500 outline-none text-gray-900 dark:text-white resize-none"
              rows={3}
            />
          </div>
        </div>
      )}
    </div>
  )
}
