import { useState, useEffect, useRef } from 'react'
import {
  Plus,
  Trash2,
  Calendar,
  Flag,
  ChevronDown,
  ChevronRight,
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
import { formatDateKey, generateId, parseDateKey } from './noteTypes'
import FocusedNoteTitle from './FocusedNoteTitle'
import { ConfirmDialog } from '../FolderDialogs'
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

export default function TodoListEditor({ data, onChange, noteTitle, onTitleChange, readOnly }) {
  const [tasks, setTasks] = useState(data?.tasks || [])
  const [filter, setFilter] = useState(data?.filter || 'all')
  const [sortBy, setSortBy] = useState(data?.sortBy || 'priority')
  const [newTaskText, setNewTaskText] = useState('')
  const [editingTaskId, setEditingTaskId] = useState(null)
  const [expandedTaskId, setExpandedTaskId] = useState(null)
  const [showFilterMenu, setShowFilterMenu] = useState(false)
  const [showSortMenu, setShowSortMenu] = useState(false)
  const [clearCompletedOpen, setClearCompletedOpen] = useState(false)
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
    const today = formatDateKey()
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
        case 'priority': {
          const priorityOrder = { high: 0, medium: 1, low: 2, none: 3 }
          return priorityOrder[a.priority] - priorityOrder[b.priority]
        }
        case 'dueDate':
          if (!a.dueDate) return 1
          if (!b.dueDate) return -1
          return parseDateKey(a.dueDate) - parseDateKey(b.dueDate)
        case 'created':
          return new Date(b.createdAt) - new Date(a.createdAt)
        case 'alphabetical':
          return a.text.localeCompare(b.text, 'en-US')
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
    overdue: tasks.filter(t => t.dueDate && t.dueDate < formatDateKey() && !t.completed).length,
    progress: tasks.length > 0 ? Math.round((tasks.filter(t => t.completed).length / tasks.length) * 100) : 0,
  }
  const filteredTasks = getFilteredTasks()

  return (
    <>
      <div className="qn-type-editor qn-type-todo flex flex-col h-full bg-surface-raised">
      <div className="qn-type-hero flex-shrink-0 p-4 border-b border-subtle bg-[#e5eaf0] dark:bg-surface-raised">
        <div className="flex items-center justify-between mb-4">
          <div>
            <FocusedNoteTitle
              icon={CheckCircle2}
              typeLabel="Task workspace"
              title={noteTitle}
              fallback="Task list"
              onChange={onTitleChange}
              readOnly={readOnly}
            />
            <p className="text-content-muted text-sm mt-1">
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
                <span className="text-content font-bold text-sm">{stats.progress}%</span>
              </div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-white dark:bg-surface-sunken rounded-lg p-2 text-center border border-subtle ">
            <div className="text-2xl font-bold text-content">{stats.total}</div>
            <div className="text-xs text-content-muted">Total</div>
          </div>
          <div className="bg-white dark:bg-surface-sunken rounded-lg p-2 text-center border border-subtle ">
            <div className="text-2xl font-bold text-content">{stats.active}</div>
            <div className="text-xs text-content-muted">Active</div>
          </div>
          <div className="bg-white dark:bg-surface-sunken rounded-lg p-2 text-center border border-subtle ">
            <div className="text-2xl font-bold text-content">{stats.completed}</div>
            <div className="text-xs text-content-muted">Done</div>
          </div>
          <div className="bg-white dark:bg-surface-sunken rounded-lg p-2 text-center border border-subtle ">
            <div className="text-2xl font-bold text-red-500 dark:text-red-400">{stats.overdue}</div>
            <div className="text-xs text-content-muted">Overdue</div>
          </div>
        </div>
      </div>
      <div className="qn-type-tabs flex-shrink-0 p-3 border-b border-subtle flex items-center gap-2 bg-surface-sunken">
        <div className="relative" ref={filterRef}>
          <button
            onClick={() => setShowFilterMenu(!showFilterMenu)}
            aria-label="Filter tasks"
            aria-expanded={showFilterMenu}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-surface-sunken border border-subtle hover:bg-surface-sunken dark:hover:bg-surface-active transition-colors"
          >
            <Filter className="w-4 h-4 text-content-muted" />
            <span className="text-sm text-content-muted">
              {FILTERS.find(f => f.id === filter)?.label}
            </span>
            <ChevronDown className="w-4 h-4 text-content-subtle" />
          </button>
          
          {showFilterMenu && (
            <div className="absolute top-full left-0 mt-1.5 w-48 bg-surface-raised rounded-2xl shadow-xl shadow-black/5 dark:shadow-black/20 border border-subtle z-50 overflow-hidden backdrop-blur-xl py-1.5">
              {FILTERS.map((f) => {
                const Icon = f.icon
                return (
                  <button
                    key={f.id}
                    onClick={() => { setFilter(f.id); setShowFilterMenu(false) }}
                    aria-pressed={filter === f.id}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-surface-hover transition-colors ${
 filter === f.id ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600' : 'text-content-muted'
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
            aria-label="Sort tasks"
            aria-expanded={showSortMenu}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-surface-sunken border border-subtle hover:bg-surface-sunken dark:hover:bg-surface-active transition-colors"
          >
            <SortAsc className="w-4 h-4 text-content-muted" />
            <span className="text-sm text-content-muted">
              {SORT_OPTIONS.find(s => s.id === sortBy)?.label}
            </span>
            <ChevronDown className="w-4 h-4 text-content-subtle" />
          </button>
          
          {showSortMenu && (
            <div className="absolute top-full left-0 mt-1.5 w-40 bg-surface-raised rounded-2xl shadow-xl shadow-black/5 dark:shadow-black/20 border border-subtle z-50 overflow-hidden backdrop-blur-xl py-1.5">
              {SORT_OPTIONS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => { setSortBy(s.id); setShowSortMenu(false) }}
                  aria-pressed={sortBy === s.id}
                  className={`w-full text-left px-4 py-2.5 text-sm hover:bg-surface-hover transition-colors ${
 sortBy === s.id ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600' : 'text-content-muted'
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
            if (completedTasks.length > 0) setClearCompletedOpen(true)
          }}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-content-muted hover:bg-surface-sunken dark:hover:bg-surface-sunken transition-colors text-sm"
          disabled={!tasks.some(t => t.completed)}
        >
          <CheckCheck className="w-4 h-4" />
          Clear Done
        </button>
      </div>
      <div className="flex-shrink-0 p-4 border-b border-subtle">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            aria-label="New task"
            value={newTaskText}
            onChange={(e) => setNewTaskText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addTask()}
            placeholder="Add a new task..."
            className="flex-1 px-4 py-3 rounded-xl bg-surface-sunken border-2 border-subtle focus:border-emerald-500 focus:bg-white dark:focus:bg-surface-sunken outline-none text-content placeholder:text-content-subtle transition-all"
          />
          <button
            onClick={addTask}
            disabled={!newTaskText.trim()}
            className="px-4 py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:bg-surface-active dark:disabled:bg-surface-sunken text-white font-medium transition-colors flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Add
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {filteredTasks.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface-sunken flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-content-subtle" />
            </div>
            <p className="text-content-muted font-medium">
              {filter === 'all' ? 'No tasks yet' : `No ${FILTERS.find(f => f.id === filter)?.label.toLowerCase()}`}
            </p>
            <p className="text-content-subtle text-sm mt-1">
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
            />
          ))
        )}
      </div>
      </div>
      <ConfirmDialog
        open={clearCompletedOpen}
        onClose={() => setClearCompletedOpen(false)}
        onConfirm={() => setTasks(tasks.filter((task) => !task.completed))}
        title="Clear completed tasks?"
        description={`${tasks.filter((task) => task.completed).length} completed task${
          tasks.filter((task) => task.completed).length === 1 ? '' : 's'
        } will be permanently removed from this note.`}
        confirmLabel="Clear completed"
        icon={CheckCheck}
      />
    </>
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
  const isOverdue = task.dueDate && task.dueDate < formatDateKey() && !task.completed
  const subtaskProgress = task.subtasks.length > 0 
    ? Math.round((task.subtasks.filter(st => st.completed).length / task.subtasks.length) * 100)
    : null

  return (
    <div
      className={`group rounded-xl border-2 transition-all ${
 task.completed 
 ? 'bg-surface-sunken border-subtle opacity-60' 
          : 'bg-surface-raised border-subtle hover:border-emerald-300 dark:hover:border-emerald-700'
      }`}
    >
      <div className="flex items-center gap-3 p-3">
        <button
          onClick={onToggle}
          aria-label={task.completed ? `Mark ${task.text} incomplete` : `Complete ${task.text}`}
          className="flex-shrink-0 transition-transform hover:scale-110"
        >
          {task.completed ? (
            <CheckCircle2 className="w-6 h-6 text-emerald-500" />
          ) : (
            <Circle className="w-6 h-6 text-content-subtle hover:text-emerald-500" />
          )}
        </button>
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <input
              ref={editInputRef}
              type="text"
              aria-label={`Edit ${task.text}`}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSaveEdit(editText)
                if (e.key === 'Escape') onCancelEdit()
              }}
              onBlur={() => onSaveEdit(editText)}
              className="w-full px-2 py-1 rounded bg-surface-sunken border border-emerald-500 outline-none text-content"
            />
          ) : (
            <div 
              className={`font-medium cursor-pointer ${
 task.completed ? 'line-through text-content-subtle' : 'text-content'
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
                  : 'bg-surface-sunken text-content-muted'
              }`}>
                <Calendar className="w-3 h-3" />
                {parseDateKey(task.dueDate).toLocaleDateString('en-US')}
              </span>
            )}
            {task.subtasks.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-accent-soft text-accent-text">
                {task.subtasks.filter(st => st.completed).length}/{task.subtasks.length} subtasks
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => onUpdate({ starred: !task.starred })}
          aria-label={task.starred ? `Remove star from ${task.text}` : `Star ${task.text}`}
          aria-pressed={task.starred}
          className={`p-1 rounded transition-colors ${
 task.starred ? 'text-accent-text' : 'text-content-subtle hover:text-accent-text'
 }`}
        >
          <Star className={`w-5 h-5 ${task.starred ? 'fill-yellow-500' : ''}`} />
        </button>
        <div className="relative" ref={priorityRef}>
          <button
            onClick={() => setShowPriorityMenu(!showPriorityMenu)}
            aria-label={`Set priority for ${task.text}. Current priority: ${priority.label}`}
            aria-expanded={showPriorityMenu}
            className="p-1.5 rounded-lg transition-colors"
            style={{ backgroundColor: priority.bgColor, color: priority.color }}
            title={`Priority: ${priority.label}`}
          >
            <Flag className="w-4 h-4" />
          </button>
          
          {showPriorityMenu && (
            <div className="absolute right-0 top-full mt-1.5 w-32 bg-surface-raised rounded-2xl shadow-xl shadow-black/5 dark:shadow-black/20 border border-subtle z-50 overflow-hidden backdrop-blur-xl py-1.5">
              {Object.entries(PRIORITIES).map(([key, value]) => (
                <button
                  key={key}
                  onClick={() => { onUpdate({ priority: key }); setShowPriorityMenu(false) }}
                  aria-pressed={task.priority === key}
                  className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-surface-hover ${
 task.priority === key ? 'bg-surface-sunken' : ''
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
            aria-label={`Due date for ${task.text}`}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            style={{ colorScheme: 'dark light' }}
          />
          <button 
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            className={`p-1.5 rounded-lg transition-all hover:scale-110 ${
 task.dueDate 
 ? isOverdue 
                  ? 'bg-red-100 dark:bg-red-900/30 text-red-500 hover:bg-red-200 dark:hover:bg-red-900/50'
                  : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/50'
                : 'bg-surface-sunken text-content-muted hover:bg-surface-sunken dark:hover:bg-surface-active'
            }`}
            title={task.dueDate ? `Due: ${parseDateKey(task.dueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}` : "Set due date"}
          >
            <Calendar className="w-4 h-4" />
          </button>
        </div>
        <button
          onClick={onExpand}
          aria-label={isExpanded ? `Collapse details for ${task.text}` : `Expand details for ${task.text}`}
          aria-expanded={isExpanded}
          className="p-1.5 rounded-lg bg-surface-sunken text-content-muted hover:bg-surface-sunken dark:hover:bg-surface-active transition-colors"
        >
          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        <div className="relative" ref={moreRef}>
          <button
            onClick={() => setShowMoreMenu(!showMoreMenu)}
            aria-label={`More actions for ${task.text}`}
            aria-expanded={showMoreMenu}
            className="p-1.5 rounded-lg bg-surface-sunken text-content-muted hover:bg-surface-sunken dark:hover:bg-surface-active transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
          
          {showMoreMenu && (
            <div className="absolute right-0 top-full mt-1.5 w-40 bg-surface-raised rounded-2xl shadow-xl shadow-black/5 dark:shadow-black/20 border border-subtle z-50 overflow-hidden backdrop-blur-xl py-1.5">
              <button
                onClick={() => { onEdit(); setShowMoreMenu(false) }}
                className="w-full text-left px-4 py-2.5 text-sm text-content-muted hover:bg-surface-hover flex items-center gap-2 transition-colors"
              >
                <Edit3 className="w-4 h-4 text-content-subtle" /> Edit
              </button>
              <button
                onClick={() => { onDuplicate(); setShowMoreMenu(false) }}
                className="w-full text-left px-4 py-2.5 text-sm text-content-muted hover:bg-surface-hover flex items-center gap-2 transition-colors"
              >
                <Copy className="w-4 h-4 text-content-subtle" /> Duplicate
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
        <div className="px-4 pb-4 pt-2 border-t border-subtle">
          <div className="mb-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium text-content-muted">Subtasks</span>
              {subtaskProgress !== null && (
                <span className="text-xs text-content-muted">({subtaskProgress}%)</span>
              )}
            </div>
            
            <div className="space-y-1 mb-2">
              {task.subtasks.map((subtask) => (
                <div key={subtask.id} className="flex items-center gap-2 group/subtask">
                  <button
                    onClick={() => onToggleSubtask(subtask.id)}
                    aria-label={subtask.completed ? `Mark ${subtask.text} incomplete` : `Complete ${subtask.text}`}
                    className="flex-shrink-0"
                  >
                    {subtask.completed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <Circle className="w-4 h-4 text-content-subtle hover:text-emerald-500" />
                    )}
                  </button>
                  <span className={`flex-1 text-sm ${subtask.completed ? 'line-through text-content-subtle' : 'text-content-muted'}`}>
                    {subtask.text}
                  </span>
                  <button
                    onClick={() => onDeleteSubtask(subtask.id)}
                    aria-label={`Delete ${subtask.text}`}
                    className="p-1 opacity-0 group-hover/subtask:opacity-100 text-content-subtle hover:text-red-500"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                aria-label={`New subtask for ${task.text}`}
                value={newSubtaskText}
                onChange={(e) => setNewSubtaskText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newSubtaskText.trim()) {
                    onAddSubtask(newSubtaskText)
                    setNewSubtaskText('')
                  }
                }}
                placeholder="Add subtask..."
                className="flex-1 px-3 py-1.5 text-sm rounded-lg bg-surface-sunken border border-subtle focus:border-emerald-500 outline-none text-content"
              />
              <button
                onClick={() => {
                  if (newSubtaskText.trim()) {
                    onAddSubtask(newSubtaskText)
                    setNewSubtaskText('')
                  }
                }}
                className="px-3 py-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-800/30 text-sm font-medium"
              >
                Add
              </button>
            </div>
          </div>
          <div>
            <span className="text-sm font-medium text-content-muted block mb-2">Notes</span>
            <textarea
              aria-label={`Notes for ${task.text}`}
              value={task.notes}
              onChange={(e) => onUpdate({ notes: e.target.value })}
              placeholder="Add notes..."
              className="w-full px-3 py-2 text-sm rounded-lg bg-surface-sunken border border-subtle focus:border-emerald-500 outline-none text-content resize-none"
              rows={3}
            />
          </div>
        </div>
      )}
    </div>
  )
}
