import { useState, useEffect, useRef } from 'react'
import {
  Plus,
  Trash2,
  Calendar,
  Users,
  Target,
  Edit3,
  CheckCircle2,
  Milestone,
  BarChart3
} from 'lucide-react'
import { formatDateKey, generateId, parseDateKey } from './noteTypes'
import { useLatestValue } from './useLatestValue'
import { useEditorDataSync } from './useEditorDataSync'
import FocusedNoteTitle from './FocusedNoteTitle'
import WorkspaceMetrics from './WorkspaceMetrics'
import Modal from '../ui/Modal'
const COLUMN_COLORS = {
  backlog: { indicator: 'bg-content-subtle' },
  todo: { indicator: 'bg-info' },
  inProgress: { indicator: 'bg-warning' },
  done: { indicator: 'bg-success' },
}

const PRIORITIES = {
  high: { label: 'High', color: '#b91c1c', icon: '\u{1F534}' },
  medium: { label: 'Medium', color: '#a16207', icon: '\u{1F7E1}' },
  low: { label: 'Low', color: '#15803d', icon: '\u{1F7E2}' },
}

export default function ProjectPlannerEditor({ data, onChange, noteTitle, onTitleChange, readOnly }) {
  const [columns, setColumns] = useState(data?.columns || [
    { id: 'backlog', name: 'Backlog', tasks: [] },
    { id: 'todo', name: 'To Do', tasks: [] },
    { id: 'inProgress', name: 'In Progress', tasks: [] },
    { id: 'done', name: 'Done', tasks: [] },
  ])
  const [milestones, setMilestones] = useState(data?.milestones || [])
  const [team, setTeam] = useState(data?.team || [])
  const [activeView, setActiveView] = useState('board')
  const [draggedTask, setDraggedTask] = useState(null)
  const [dragOverColumn, setDragOverColumn] = useState(null)
  const [showAddTask, setShowAddTask] = useState(null)
  const [newTaskText, setNewTaskText] = useState('')
  const [editingTask, setEditingTask] = useState(null)
  const [showMilestoneForm, setShowMilestoneForm] = useState(false)
  const [showTeamForm, setShowTeamForm] = useState(false)
  const onChangeRef = useLatestValue(onChange)
  const currentEditorData = { columns, milestones, team }
  const skipChangeRef = useEditorDataSync(data, currentEditorData, (incoming) => {
    setColumns(incoming?.columns || [])
    setMilestones(incoming?.milestones || [])
    setTeam(incoming?.team || [])
  })
  const isInitialMount = useRef(true)
  useEffect(() => {
    if (isInitialMount.current) { isInitialMount.current = false; return }
    if (skipChangeRef.current) { skipChangeRef.current = false; return }
    onChangeRef.current?.({ columns, milestones, team })
  }, [columns, milestones, onChangeRef, skipChangeRef, team])
  const stats = {
    totalTasks: columns.reduce((sum, col) => sum + col.tasks.length, 0),
    doneTasks: columns.find(c => c.id === 'done')?.tasks.length || 0,
    inProgressTasks: columns.find(c => c.id === 'inProgress')?.tasks.length || 0,
    overdueTasks: columns.reduce((sum, col) => {
      return sum + col.tasks.filter(t => t.dueDate && t.dueDate < formatDateKey() && col.id !== 'done').length
    }, 0),
  }
  stats.progress = stats.totalTasks > 0 ? Math.round((stats.doneTasks / stats.totalTasks) * 100) : 0
  const addTask = (columnId) => {
    if (!newTaskText.trim()) return
    
    const newTask = {
      id: generateId(),
      title: newTaskText.trim(),
      description: '',
      priority: 'medium',
      dueDate: null,
      assignee: null,
      labels: [],
      createdAt: new Date().toISOString(),
    }

    setColumns(columns.map(col => 
      col.id === columnId 
        ? { ...col, tasks: [...col.tasks, newTask] }
        : col
    ))
    setNewTaskText('')
    setShowAddTask(null)
  }
  const saveTaskEdits = (taskToEdit, updates) => {
    const { columnId: targetColumnId, ...taskUpdates } = updates
    const taskRecord = Object.fromEntries(
      Object.entries(taskToEdit).filter(([key]) => key !== 'columnId')
    )
    setColumns(columns.map(col => {
      const tasksWithoutEditedTask = col.tasks.filter(task => task.id !== taskToEdit.id)
      if (col.id !== targetColumnId) return { ...col, tasks: tasksWithoutEditedTask }

      return {
        ...col,
        tasks: [...tasksWithoutEditedTask, { ...taskRecord, ...taskUpdates }],
      }
    }))
  }
  const deleteTask = (columnId, taskId) => {
    setColumns(columns.map(col => {
      if (col.id === columnId) {
        return { ...col, tasks: col.tasks.filter(t => t.id !== taskId) }
      }
      return col
    }))
  }
  const handleDragStart = (e, task, sourceColumnId) => {
    setDraggedTask({ task, sourceColumnId })
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e, columnId) => {
    e.preventDefault()
    setDragOverColumn(columnId)
  }

  const handleDragLeave = () => {
    setDragOverColumn(null)
  }

  const handleDrop = (e, targetColumnId) => {
    e.preventDefault()
    setDragOverColumn(null)
    
    if (!draggedTask) return

    const { task, sourceColumnId } = draggedTask

    if (sourceColumnId === targetColumnId) return
    const newColumns = columns.map(col => {
      if (col.id === sourceColumnId) {
        return { ...col, tasks: col.tasks.filter(t => t.id !== task.id) }
      }
      if (col.id === targetColumnId) {
        return { ...col, tasks: [...col.tasks, task] }
      }
      return col
    })

    setColumns(newColumns)
    setDraggedTask(null)
  }
  const addMilestone = (name, dueDate) => {
    const newMilestone = {
      id: generateId(),
      name,
      dueDate,
      completed: false,
      createdAt: new Date().toISOString(),
    }
    setMilestones([...milestones, newMilestone])
  }
  const toggleMilestone = (id) => {
    setMilestones(milestones.map(m =>
      m.id === id ? { ...m, completed: !m.completed } : m
    ))
  }
  const deleteMilestone = (id) => {
    setMilestones(milestones.filter(m => m.id !== id))
  }
  const addTeamMember = (name, role, avatar) => {
    const newMember = {
      id: generateId(),
      name,
      role,
      avatar: avatar || name.charAt(0).toUpperCase(),
    }
    setTeam([...team, newMember])
  }
  const deleteTeamMember = (id) => {
    setTeam(team.filter(m => m.id !== id))
  }

  return (
    <div className="qn-type-editor qn-type-project flex flex-col h-full bg-surface-sunken">
      <header className="qn-type-hero qn-workspace-header flex-shrink-0 border-b border-subtle">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <FocusedNoteTitle
              icon={Target}
              typeLabel="Project workspace"
              title={noteTitle}
              fallback="Project board"
              onChange={onTitleChange}
              readOnly={readOnly}
            />
            <p className="ml-12 mt-1 text-ui-md text-content-muted">
              {stats.totalTasks} tasks {"\u2022"} {stats.progress}% complete
            </p>
          </div>
        </div>
        <WorkspaceMetrics
          items={[
            { label: 'Total', value: stats.totalTasks },
            { label: 'In progress', value: stats.inProgressTasks },
            { label: 'Done', value: stats.doneTasks },
            { label: 'Overdue', value: stats.overdueTasks, tone: stats.overdueTasks ? 'danger' : 'neutral' },
          ]}
        />
      </header>
      <div className="qn-type-tabs flex-shrink-0 flex gap-1 p-2 border-b border-subtle bg-surface-raised">
        {[
          { id: 'board', label: 'Kanban Board', icon: BarChart3 },
          { id: 'milestones', label: 'Milestones', icon: Milestone },
          { id: 'team', label: 'Team', icon: Users },
        ].map(view => (
          <button
            key={view.id}
            onClick={() => setActiveView(view.id)}
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
      <div className="flex-1 overflow-hidden">
        {activeView === 'board' && (
          <div className="h-full overflow-x-auto p-4">
            <div className="flex gap-4 h-full min-w-max">
              {columns.map((column) => {
                const colors = COLUMN_COLORS[column.id] || COLUMN_COLORS.backlog
                return (
                  <section
                    key={column.id}
                    onDragOver={(e) => handleDragOver(e, column.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, column.id)}
                    className={`w-72 flex flex-col overflow-hidden rounded-card border border-subtle bg-surface-raised ${
 dragOverColumn === column.id ? 'ring-2 ring-accent ring-offset-2 ring-offset-[var(--qn-surface-sunken)]' : ''
 }`}
                    aria-label={`${column.name}, ${column.tasks.length} tasks`}
                  >
                    <div className="flex items-center justify-between border-b border-subtle bg-surface-sunken px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${colors.indicator}`} aria-hidden="true" />
                        <span className="text-ui-lg font-semibold text-content">{column.name}</span>
                        <span className="min-w-5 text-center text-ui-xs tabular-nums text-content-subtle">
                          {column.tasks.length}
                        </span>
                      </div>
                      <button
                        onClick={() => setShowAddTask(column.id)}
                        aria-label={`Add task to ${column.name}`}
                        className="qn-square-control flex h-8 w-8 items-center justify-center rounded-control text-content-muted transition-colors hover:bg-surface-active hover:text-content"
                      >
                        <Plus className="w-4 h-4 text-content-muted" />
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-2 bg-surface-raised p-2">
                      {showAddTask === column.id && (
                        <div className="p-3 rounded-lg border-2 border-dashed border-accent-border bg-accent-soft">
                          <input
                            type="text"
                            value={newTaskText}
                            onChange={(e) => setNewTaskText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') addTask(column.id)
                              if (e.key === 'Escape') { setShowAddTask(null); setNewTaskText('') }
                            }}
                            placeholder="Task title..."
                            aria-label={`New task title for ${column.name}`}
                            className="w-full px-3 py-2 rounded-lg bg-surface-raised border border-subtle text-sm outline-none focus:border-accent"
                            autoFocus
                          />
                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={() => addTask(column.id)}
                              className="flex-1 px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-accent-on text-sm"
                            >
                              Add Task
                            </button>
                            <button
                              onClick={() => { setShowAddTask(null); setNewTaskText('') }}
                              className="px-3 py-1.5 rounded-lg bg-surface-sunken dark:bg-surface-sunken text-content-muted text-sm"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                      {column.tasks.map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          team={team}
                          onDragStart={(e) => handleDragStart(e, task, column.id)}
                          onDelete={() => deleteTask(column.id, task.id)}
                          onEdit={() => setEditingTask({ ...task, columnId: column.id })}
                        />
                      ))}

                      {column.tasks.length === 0 && showAddTask !== column.id && (
                        <div className="text-center py-8 text-content-subtle text-sm">
                          No tasks
                        </div>
                      )}
                    </div>
                  </section>
                )
              })}
            </div>
          </div>
        )}

        {activeView === 'milestones' && (
          <div className="p-4 overflow-y-auto">
            <div className="max-w-2xl mx-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-content">Milestones</h2>
                <button
                  onClick={() => setShowMilestoneForm(true)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent hover:bg-accent-hover text-accent-on text-sm"
                >
                  <Plus className="w-4 h-4" />
                  Add Milestone
                </button>
              </div>

              {showMilestoneForm && (
                <MilestoneForm
                  onSave={(name, dueDate) => { addMilestone(name, dueDate); setShowMilestoneForm(false) }}
                  onCancel={() => setShowMilestoneForm(false)}
                />
              )}

              <div className="space-y-3">
                {milestones.length === 0 ? (
                  <div className="text-center py-12 text-content-muted">
                    No milestones yet. Add your first milestone to track progress.
                  </div>
                ) : (
                  milestones.map((milestone) => (
                    <MilestoneCard
                      key={milestone.id}
                      milestone={milestone}
                      onToggle={() => toggleMilestone(milestone.id)}
                      onDelete={() => deleteMilestone(milestone.id)}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {activeView === 'team' && (
          <div className="p-4 overflow-y-auto">
            <div className="max-w-2xl mx-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-content">Team Members</h2>
                <button
                  onClick={() => setShowTeamForm(true)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent hover:bg-accent-hover text-accent-on text-sm"
                >
                  <Plus className="w-4 h-4" />
                  Add Member
                </button>
              </div>

              {showTeamForm && (
                <TeamMemberForm
                  onSave={(name, role) => { addTeamMember(name, role); setShowTeamForm(false) }}
                  onCancel={() => setShowTeamForm(false)}
                />
              )}

              <div className="grid grid-cols-2 gap-3">
                {team.length === 0 ? (
                  <div className="col-span-2 text-center py-12 text-content-muted">
                    No team members yet. Add people to assign tasks.
                  </div>
                ) : (
                  team.map((member) => (
                    <TeamMemberCard
                      key={member.id}
                      member={member}
                      tasksAssigned={columns.reduce((sum, col) => 
                        sum + col.tasks.filter(t => t.assignee === member.id).length, 0
                      )}
                      onDelete={() => deleteTeamMember(member.id)}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      {editingTask && (
        <TaskEditModal
          task={editingTask}
          team={team}
          columns={columns}
          onSave={(updates) => {
            saveTaskEdits(editingTask, updates)
            setEditingTask(null)
          }}
          onClose={() => setEditingTask(null)}
        />
      )}
    </div>
  )
}
function TaskCard({ task, team, onDragStart, onDelete, onEdit }) {
  const priority = PRIORITIES[task.priority]
  const assignee = team.find(m => m.id === task.assignee)
  const isOverdue = task.dueDate && task.dueDate < formatDateKey()

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="group p-3 rounded-lg bg-surface-raised border border-subtle hover:shadow-md transition-all cursor-grab active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="font-medium text-content text-sm flex-1">
          {task.title}
        </h3>
        <div className="flex items-center">
          <button
            onClick={onEdit}
            aria-label={`Edit ${task.title}`}
            className="p-1.5 rounded text-content-muted hover:bg-surface-sunken hover:text-accent-text dark:hover:bg-surface-sunken"
          >
            <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
          <button
            onClick={onDelete}
            aria-label={`Delete ${task.title}`}
            className="p-1.5 rounded text-content-muted hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {task.description && (
        <p className="text-xs text-content-muted mb-2 line-clamp-2">
          {task.description}
        </p>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        {task.priority && task.priority !== 'medium' && (
          <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: priority?.color + '20', color: priority?.color }}>
            {priority?.icon} {priority?.label}
          </span>
        )}
        
        {task.dueDate && (
          <span className={`text-xs px-1.5 py-0.5 rounded flex items-center gap-1 ${
 isOverdue ? 'bg-red-100 text-red-600' : 'bg-surface-sunken text-content-muted'
 }`}>
            <Calendar className="w-3 h-3" />
            {parseDateKey(task.dueDate).toLocaleDateString('en-US')}
          </span>
        )}

        {assignee && (
          <div className="flex items-center gap-1 text-xs text-content-muted">
            <div className="w-5 h-5 rounded-full bg-accent-soft text-accent-text flex items-center justify-center text-xs font-medium">
              {assignee.avatar}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
function TaskEditModal({ task, team, columns, onSave, onClose }) {
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description || '')
  const [priority, setPriority] = useState(task.priority)
  const [dueDate, setDueDate] = useState(task.dueDate || '')
  const [assignee, setAssignee] = useState(task.assignee || '')
  const [columnId, setColumnId] = useState(task.columnId)

  return (
    <Modal
      open
      onClose={onClose}
      title="Edit task"
      description="Refine the task details, priority, date, and owner."
      size="lg"
      bodyClassName="space-y-4"
      footer={(
        <>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-content-muted hover:bg-surface-hover"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave({
              title: title.trim(),
              description,
              priority,
              dueDate: dueDate || null,
              assignee: assignee || null,
              columnId,
            })}
            disabled={!title.trim()}
            className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50 text-accent-on"
          >
            Save changes
          </button>
        </>
      )}
    >
          <div>
            <label className="block text-sm font-medium text-content-muted mb-1">Title</label>
            <input
              type="text"
              aria-label="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-subtle bg-white dark:bg-surface-sunken text-content outline-none focus:border-accent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-content-muted mb-1">Description</label>
            <textarea
              aria-label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-subtle bg-white dark:bg-surface-sunken text-content outline-none focus:border-accent resize-none"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-content-muted mb-1">Priority</label>
              <select
                aria-label="Priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-subtle bg-white dark:bg-surface-sunken text-content outline-none focus:border-accent"
              >
                {Object.entries(PRIORITIES).map(([key, value]) => (
                  <option key={key} value={key}>{value.icon} {value.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-content-muted mb-1">Due Date</label>
              <input
                type="date"
                aria-label="Due date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-subtle bg-white dark:bg-surface-sunken text-content outline-none focus:border-accent"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-content-muted mb-1">Status</label>
              <select
                aria-label="Status"
                value={columnId}
                onChange={(e) => setColumnId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-subtle bg-white dark:bg-surface-sunken text-content outline-none focus:border-accent"
              >
                {columns.map((column) => (
                  <option key={column.id} value={column.id}>{column.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-content-muted mb-1">Assignee</label>
              <select
                aria-label="Assignee"
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-subtle bg-white dark:bg-surface-sunken text-content outline-none focus:border-accent"
              >
                <option value="">Unassigned</option>
                {team.map((member) => (
                  <option key={member.id} value={member.id}>{member.name}</option>
                ))}
              </select>
            </div>
          </div>
    </Modal>
  )
}
function MilestoneForm({ onSave, onCancel }) {
  const [name, setName] = useState('')
  const [dueDate, setDueDate] = useState('')

  return (
    <div className="p-4 mb-4 rounded-lg border-2 border-dashed border-accent-border bg-accent-soft">
      <div className="space-y-3">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Milestone name..."
          aria-label="Milestone name"
          className="w-full px-3 py-2 rounded-lg border border-subtle bg-surface-raised text-sm outline-none focus:border-accent"
          autoFocus
        />
        <input
          type="date"
          aria-label="Milestone due date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-subtle bg-surface-raised text-sm outline-none focus:border-accent"
        />
        <div className="flex gap-2">
          <button
            onClick={() => name && onSave(name, dueDate || null)}
            className="flex-1 px-3 py-2 rounded-lg bg-accent hover:bg-accent-hover text-accent-on text-sm"
          >
            Add Milestone
          </button>
          <button
            onClick={onCancel}
            className="px-3 py-2 rounded-lg bg-surface-sunken dark:bg-surface-sunken text-content-muted text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
function MilestoneCard({ milestone, onToggle, onDelete }) {
  const isOverdue = milestone.dueDate && milestone.dueDate < formatDateKey() && !milestone.completed

  return (
    <div className={`flex items-center gap-3 p-4 rounded-lg border ${
 milestone.completed 
 ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
        : isOverdue
          ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
          : 'bg-surface-raised border-subtle'
    }`}>
      <button
        onClick={onToggle}
        aria-label={milestone.completed ? `Mark ${milestone.name} incomplete` : `Complete ${milestone.name}`}
      >
        {milestone.completed ? (
          <CheckCircle2 className="w-6 h-6 text-green-500" />
        ) : (
          <Milestone className={`w-6 h-6 ${isOverdue ? 'text-red-500' : 'text-accent-text'}`} />
        )}
      </button>
      <div className="flex-1">
        <h3 className={`font-medium ${milestone.completed ? 'line-through text-content-subtle' : 'text-content'}`}>
          {milestone.name}
        </h3>
        {milestone.dueDate && (
          <span className={`text-xs ${isOverdue && !milestone.completed ? 'text-red-500' : 'text-content-muted'}`}>
            Due: {parseDateKey(milestone.dueDate).toLocaleDateString('en-US')}
          </span>
        )}
      </div>
      <button
        onClick={onDelete}
        aria-label={`Delete ${milestone.name}`}
        className="p-1 rounded hover:bg-surface-hover text-content-subtle hover:text-red-500"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  )
}
function TeamMemberForm({ onSave, onCancel }) {
  const [name, setName] = useState('')
  const [role, setRole] = useState('')

  return (
    <div className="p-4 mb-4 rounded-lg border-2 border-dashed border-accent-border bg-accent-soft">
      <div className="space-y-3">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name..."
          aria-label="Team member name"
          className="w-full px-3 py-2 rounded-lg border border-subtle bg-surface-raised text-sm outline-none focus:border-accent"
          autoFocus
        />
        <input
          type="text"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          placeholder="Role (e.g., Developer, Designer)..."
          aria-label="Team member role"
          className="w-full px-3 py-2 rounded-lg border border-subtle bg-surface-raised text-sm outline-none focus:border-accent"
        />
        <div className="flex gap-2">
          <button
            onClick={() => name && onSave(name, role)}
            className="flex-1 px-3 py-2 rounded-lg bg-accent hover:bg-accent-hover text-accent-on text-sm"
          >
            Add Member
          </button>
          <button
            onClick={onCancel}
            className="px-3 py-2 rounded-lg bg-surface-sunken dark:bg-surface-sunken text-content-muted text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
function TeamMemberCard({ member, tasksAssigned, onDelete }) {
  return (
    <div className="flex items-center gap-3 p-4 rounded-lg bg-surface-raised border border-subtle">
      <div className="w-10 h-10 rounded-full bg-accent-soft text-accent-text flex items-center justify-center font-medium">
        {member.avatar}
      </div>
      <div className="flex-1">
        <h3 className="font-medium text-content">{member.name}</h3>
        <p className="text-xs text-content-muted">{member.role || 'Team Member'}</p>
        <p className="text-xs text-accent-text">{tasksAssigned} tasks assigned</p>
      </div>
      <button
        onClick={onDelete}
        aria-label={`Remove ${member.name}`}
        className="p-1 rounded hover:bg-surface-hover text-content-subtle hover:text-red-500"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  )
}
