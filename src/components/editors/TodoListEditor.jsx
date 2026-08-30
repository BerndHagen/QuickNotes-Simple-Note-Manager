import { useState, useEffect, useRef } from 'react'
import { Button, Menu, MenuItem, MenuSeparator } from '../ui'
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
  SortAsc,
  MoreHorizontal,
  Edit3,
  Copy,
  Star,
  AlertCircle,
  CheckCheck,
  ListTodo,
  Repeat2,
  X
} from 'lucide-react'
import { formatDateKey, generateId, parseDateKey } from './noteTypes'
import { normalizeRecurrence, RECURRENCE_LABELS, toggleTaskWithRecurrence } from '../../lib/taskRecurrence'
import { useLatestValue } from './useLatestValue'
import { useEditorDataSync } from './useEditorDataSync'
import StructuredWorkspaceShell, { WorkspaceSection, WorkspaceTabs } from './StructuredWorkspaceShell'
import { ConfirmDialog } from '../FolderDialogs'
const PRIORITIES = {
  high: { label: 'High', className: 'text-danger-text' },
  medium: { label: 'Medium', className: 'text-content' },
  low: { label: 'Low', className: 'text-content-muted' },
  none: { label: 'None', className: 'text-content-subtle' },
}
const FILTERS = [
  { id: 'all', label: 'All', icon: ListTodo },
  { id: 'today', label: 'Today', icon: Clock },
  { id: 'upcoming', label: 'Upcoming', icon: Calendar },
  { id: 'overdue', label: 'Overdue', icon: AlertCircle },
  { id: 'active', label: 'Active', icon: Circle },
  { id: 'completed', label: 'Completed', icon: CheckCircle2 },
  { id: 'starred', label: 'Favourites', icon: Star },
]
const SORT_OPTIONS = [
  { id: 'priority', label: 'Priority' },
  { id: 'dueDate', label: 'Due Date' },
  { id: 'created', label: 'Created' },
  { id: 'alphabetical', label: 'A-Z' },
]
const RECURRENCE_UNITS = {
  daily: 'days',
  weekdays: 'workdays',
  weekly: 'weeks',
  monthly: 'months',
  yearly: 'years',
}

export default function TodoListEditor({ data, onChange, noteTitle, onTitleChange, readOnly }) {
  const [tasks, setTasks] = useState(data?.tasks || [])
  const [filter, setFilter] = useState(data?.filter || 'all')
  const [sortBy, setSortBy] = useState(data?.sortBy || 'priority')
  const [newTaskText, setNewTaskText] = useState('')
  const [editingTaskId, setEditingTaskId] = useState(null)
  const [expandedTaskId, setExpandedTaskId] = useState(null)
  const [showSortMenu, setShowSortMenu] = useState(false)
  const [clearCompletedOpen, setClearCompletedOpen] = useState(false)
  const inputRef = useRef(null)
  const sortRef = useRef(null)
  const onChangeRef = useLatestValue(onChange)
  const currentEditorData = { tasks, filter, sortBy }
  const skipChangeRef = useEditorDataSync(data, currentEditorData, (incoming) => {
    setTasks(incoming?.tasks || [])
    setFilter(incoming?.filter || 'all')
    setSortBy(incoming?.sortBy || 'priority')
  })
  const isInitialMount = useRef(true)
  useEffect(() => {
    if (isInitialMount.current) { isInitialMount.current = false; return }
    if (skipChangeRef.current) { skipChangeRef.current = false; return }
    onChangeRef.current?.({ tasks, filter, sortBy })
  }, [filter, onChangeRef, skipChangeRef, sortBy, tasks])
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
      recurrence: null,
    }
    
    setTasks((currentTasks) => [newTask, ...currentTasks])
    setNewTaskText('')
    inputRef.current?.focus()
  }
  const toggleTask = (taskId) => {
    setTasks((currentTasks) => toggleTaskWithRecurrence(currentTasks, taskId, { createId: generateId }))
  }
  const updateTask = (taskId, updates) => {
    setTasks((currentTasks) => currentTasks.map(task =>
      task.id === taskId ? { ...task, ...updates } : task
    ))
  }
  const deleteTask = (taskId) => {
    setTasks((currentTasks) => currentTasks.filter(task => task.id !== taskId))
  }
  const duplicateTask = (task) => {
    const newTask = {
      ...task,
      id: generateId(),
      completed: false,
      completedAt: null,
      createdAt: new Date().toISOString(),
    }
    setTasks((currentTasks) => [newTask, ...currentTasks])
  }
  const addSubtask = (taskId, text) => {
    if (!text.trim()) return
    setTasks((currentTasks) => currentTasks.map(task => {
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
    setTasks((currentTasks) => currentTasks.map(task => {
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
    setTasks((currentTasks) => currentTasks.map(task => {
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
      case 'upcoming':
        filtered = filtered.filter(t => t.dueDate && t.dueDate > today && !t.completed)
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
  const filterTabs = FILTERS.map((item) => ({
    ...item,
    count: item.id === 'all'
      ? stats.total
      : item.id === 'active'
        ? stats.active
        : item.id === 'completed'
          ? stats.completed
          : item.id === 'overdue'
            ? stats.overdue
            : item.id === 'today'
              ? tasks.filter((task) => !task.completed && task.dueDate === formatDateKey()).length
              : item.id === 'upcoming'
                ? tasks.filter((task) => !task.completed && task.dueDate && task.dueDate > formatDateKey()).length
                : tasks.filter((task) => task.starred).length,
  }))

  return (
    <>
      <StructuredWorkspaceShell
        className="qn-type-editor qn-type-todo"
        icon={CheckCircle2}
        typeLabel="Task workspace"
        title={noteTitle}
        fallback="Task list"
        onTitleChange={onTitleChange}
        readOnly={readOnly}
        summary={(
          <>
            <span>{stats.active} remaining</span>
            <span>{stats.completed} completed</span>
            {stats.overdue > 0 && <span>{stats.overdue} overdue</span>}
          </>
        )}
        commands={<WorkspaceTabs tabs={filterTabs} activeTab={filter} onChange={setFilter} />}
      >
      <WorkspaceSection title="Add a task" description="Capture it now; schedule and details can follow.">
        <form className="qn-task-capture" onSubmit={(event) => { event.preventDefault(); addTask() }}>
          <input
            ref={inputRef}
            type="text"
            aria-label="New task"
              value={newTaskText}
              onChange={(e) => setNewTaskText(e.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return
                event.preventDefault()
                addTask()
              }}
              placeholder="Task name"
          />
          <Button type="submit" variant="primary" icon={Plus} disabled={!newTaskText.trim()}>Add task</Button>
        </form>
      </WorkspaceSection>
      <WorkspaceSection
        title={`${FILTERS.find((item) => item.id === filter)?.label} tasks`}
        description={`${filteredTasks.length} ${filteredTasks.length === 1 ? 'task' : 'tasks'} shown`}
        actions={(
          <div className="qn-task-toolbar">
        <div className="relative" ref={sortRef}>
          <button
            onClick={() => setShowSortMenu(!showSortMenu)}
            aria-label="Sort tasks"
            aria-expanded={showSortMenu}
            className="qn-task-toolbar-button"
          >
            <SortAsc className="w-4 h-4 text-content-muted" />
            <span className="text-sm text-content-muted">
              {SORT_OPTIONS.find(s => s.id === sortBy)?.label}
            </span>
            <ChevronDown className="w-4 h-4 text-content-subtle" />
          </button>
          
          <Menu
            open={showSortMenu}
            onClose={() => setShowSortMenu(false)}
            anchorRef={sortRef}
            label="Sort tasks"
            width={176}
          >
              {SORT_OPTIONS.map((s) => (
                <MenuItem
                  key={s.id}
                  onClick={() => { setSortBy(s.id); setShowSortMenu(false) }}
                  selected={sortBy === s.id}
                >
                  {s.label}
                </MenuItem>
              ))}
          </Menu>
        </div>

        <Button
          size="sm"
          variant="danger-ghost"
          icon={CheckCheck}
          onClick={() => {
            const completedTasks = tasks.filter(t => t.completed)
            if (completedTasks.length > 0) setClearCompletedOpen(true)
          }}
          disabled={!tasks.some(t => t.completed)}
        >
          Clear completed
        </Button>
          </div>
        )}
      >
      <div className="qn-task-list">
        {filteredTasks.length === 0 ? (
          <div className="qn-structured-empty">
            <strong>{filter === 'all' ? 'No tasks yet' : `No ${FILTERS.find(f => f.id === filter)?.label.toLowerCase()}`}</strong>
            {filter === 'all' ? 'Add a task above to begin.' : 'Choose another filter to see more tasks.'}
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
      </WorkspaceSection>
      </StructuredWorkspaceShell>
      <ConfirmDialog
        open={clearCompletedOpen}
        onClose={() => setClearCompletedOpen(false)}
        onConfirm={() => setTasks((currentTasks) => currentTasks.filter((task) => !task.completed))}
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

  const priority = PRIORITIES[task.priority]
  const recurrence = normalizeRecurrence(task.recurrence)
  const isOverdue = task.dueDate && task.dueDate < formatDateKey() && !task.completed
  const subtaskProgress = task.subtasks.length > 0 
    ? Math.round((task.subtasks.filter(st => st.completed).length / task.subtasks.length) * 100)
    : null

  return (
    <div
      className={`qn-task-row group border-b border-subtle transition-colors ${
 task.completed
 ? 'text-content-subtle'
          : 'hover:bg-surface-hover'
      }`}
    >
      <div className="qn-task-main flex items-center gap-3 p-3">
        <button
          onClick={onToggle}
          aria-label={task.completed ? `Mark ${task.text} incomplete` : `Complete ${task.text}`}
          className="qn-square-control flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-control transition-colors hover:bg-surface-active"
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
              <span className={`qn-task-metadata ${isOverdue ? 'text-danger-text' : ''}`}>
                <Calendar className="w-3 h-3" />
                {parseDateKey(task.dueDate).toLocaleDateString('en-US')}
              </span>
            )}
            {task.subtasks.length > 0 && (
              <span className="qn-task-metadata">
                {task.subtasks.filter(st => st.completed).length}/{task.subtasks.length} subtasks
              </span>
            )}
            {recurrence && (
              <span className="qn-task-metadata">
                <Repeat2 className="h-3 w-3" aria-hidden="true" />
                {recurrence.interval > 1
                  ? `Every ${recurrence.interval} ${RECURRENCE_UNITS[recurrence.frequency]}`
                  : RECURRENCE_LABELS[recurrence.frequency]}
              </span>
            )}
          </div>
        </div>
        <div className="qn-task-actions flex flex-shrink-0 items-center gap-2">
          <button
            onClick={() => onUpdate({ starred: !task.starred })}
            aria-label={task.starred ? `Remove star from ${task.text}` : `Star ${task.text}`}
            aria-pressed={task.starred}
            className={`qn-task-quick-star p-1 rounded transition-colors ${
 task.starred ? 'text-warning' : 'text-content-subtle hover:text-warning'
 }`}
          >
            <Star className={`w-5 h-5 ${task.starred ? 'fill-current' : ''}`} />
          </button>
          <div className="qn-task-quick-priority relative" ref={priorityRef}>
          <button
            onClick={() => setShowPriorityMenu(!showPriorityMenu)}
            aria-label={`Set priority for ${task.text}. Current priority: ${priority.label}`}
            aria-expanded={showPriorityMenu}
            className={`qn-square-control rounded-control p-1.5 transition-colors hover:bg-surface-hover ${priority.className}`}
            title={`Priority: ${priority.label}`}
          >
            <Flag className="w-4 h-4" />
          </button>
          
          <Menu
            open={showPriorityMenu}
            onClose={() => setShowPriorityMenu(false)}
            anchorRef={priorityRef}
            placement="bottom-end"
            label={`Set priority for ${task.text}`}
            width={160}
          >
              {Object.entries(PRIORITIES).map(([key, value]) => (
                <MenuItem
                  key={key}
                  onClick={() => { onUpdate({ priority: key }); setShowPriorityMenu(false) }}
                  selected={task.priority === key}
                >
                  <span className="flex items-center gap-2">
                    <Flag className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{value.label}</span>
                  </span>
                </MenuItem>
              ))}
          </Menu>
          </div>
          <div className="qn-task-quick-date relative group/date">
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
            className={`p-1.5 rounded-control transition-colors ${
 task.dueDate 
 ? isOverdue 
                  ? 'bg-red-100 dark:bg-red-900/30 text-red-500 hover:bg-red-200 dark:hover:bg-red-900/50'
                  : 'bg-accent-soft text-accent-text hover:bg-accent-soft-hover'
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
          
          <Menu
            open={showMoreMenu}
            onClose={() => setShowMoreMenu(false)}
            anchorRef={moreRef}
            placement="bottom-end"
            label={`Actions for ${task.text}`}
            width={176}
          >
              <MenuItem
                icon={Edit3}
                onClick={() => { onEdit(); setShowMoreMenu(false) }}
              >
                Edit
              </MenuItem>
              <MenuItem
                icon={Copy}
                onClick={() => { onDuplicate(); setShowMoreMenu(false) }}
              >
                Duplicate
              </MenuItem>
              <MenuSeparator />
              <MenuItem
                icon={Trash2}
                tone="danger"
                onClick={() => { onDelete(); setShowMoreMenu(false) }}
              >
                Delete
              </MenuItem>
          </Menu>
          </div>
        </div>
      </div>
      {isExpanded && (
        <div className="px-4 pb-4 pt-2 border-t border-subtle">
          <div className="qn-task-mobile-details mb-3 grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)] items-end gap-2 border-b border-subtle pb-3">
            <button
              type="button"
              onClick={() => onUpdate({ starred: !task.starred })}
              aria-label={task.starred ? `Remove star from ${task.text}` : `Star ${task.text}`}
              aria-pressed={task.starred}
              className={`qn-square-control flex h-control-md w-control-md items-center justify-center rounded-control border border-subtle ${task.starred ? 'text-warning' : 'text-content-muted'}`}
            >
              <Star className={`h-4 w-4 ${task.starred ? 'fill-current' : ''}`} />
            </button>
            <label className="min-w-0 text-ui-xs font-medium text-content-muted">
              Priority
              <select
                value={task.priority}
                onChange={(event) => onUpdate({ priority: event.target.value })}
                aria-label={`Priority for ${task.text}`}
                className="mt-1 h-control-md w-full rounded-control border border-subtle bg-surface-raised px-2 text-content"
              >
                {Object.entries(PRIORITIES).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
              </select>
            </label>
            <label className="min-w-0 text-ui-xs font-medium text-content-muted">
              Due date
              <input
                type="date"
                value={task.dueDate || ''}
                onChange={(event) => onUpdate({ dueDate: event.target.value || null })}
                aria-label={`Detailed due date for ${task.text}`}
                className="mt-1 h-control-md w-full rounded-control border border-subtle bg-surface-raised px-2 text-content"
              />
            </label>
          </div>
          <div className="mb-4 grid gap-3 rounded-card border border-subtle bg-surface-raised p-3 sm:grid-cols-[minmax(0,1fr)_9rem]">
            <label className="flex min-w-0 flex-col gap-1.5 text-sm font-medium text-content-muted">
              <span className="flex items-center gap-1.5">
                <Repeat2 className="h-4 w-4" aria-hidden="true" />
                Repeat
              </span>
              <select
                aria-label={`Repeat ${task.text}`}
                value={recurrence?.frequency || 'none'}
                onChange={(event) => onUpdate({
                  recurrence: event.target.value === 'none'
                    ? null
                    : { frequency: event.target.value, interval: recurrence?.interval || 1 },
                })}
                className="h-control-md rounded-control border border-strong bg-surface-raised px-3 text-sm text-content outline-none focus:border-accent focus:ring-2 focus:ring-[var(--qn-accent-soft)]"
              >
                <option value="none">Does not repeat</option>
                <option value="daily">Daily</option>
                <option value="weekdays">Weekdays</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </label>
            {recurrence && (
              <label className="flex flex-col gap-1.5 text-sm font-medium text-content-muted">
                Every
                <span className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={recurrence.interval}
                    aria-label={`Repeat interval for ${task.text}`}
                    onChange={(event) => onUpdate({
                      recurrence: {
                        ...recurrence,
                        interval: Math.min(30, Math.max(1, Number(event.target.value) || 1)),
                      },
                    })}
                    className="h-control-md w-16 rounded-control border border-strong bg-surface-raised px-2 text-sm text-content outline-none focus:border-accent focus:ring-2 focus:ring-[var(--qn-accent-soft)]"
                  />
                  <span className="text-xs font-normal text-content-muted">
                    {RECURRENCE_UNITS[recurrence.frequency]}
                  </span>
                </span>
              </label>
            )}
          </div>
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
                    className="qn-subtask-row-action p-1 opacity-0 text-content-subtle hover:text-red-500 focus-visible:opacity-100 group-hover/subtask:opacity-100"
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
