import React, { useState, useEffect, useRef } from 'react'
import {
  Plus,
  Trash2,
  Calendar,
  Users,
  Target,
  Edit3,
  X,
  CheckCircle2,
  Milestone,
  BarChart3
} from 'lucide-react'
import { generateId } from './noteTypes'
const COLUMN_COLORS = {
  backlog: { bg: 'bg-gray-100 dark:bg-gray-800', border: 'border-gray-300 dark:border-gray-600', text: 'text-gray-600' },
  todo: { bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-300 dark:border-blue-700', text: 'text-blue-600' },
  inProgress: { bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-300 dark:border-amber-700', text: 'text-amber-600' },
  done: { bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-300 dark:border-green-700', text: 'text-green-600' },
}

const PRIORITIES = {
  high: { label: 'High', color: '#ef4444', icon: '\u{1F534}' },
  medium: { label: 'Medium', color: '#f59e0b', icon: '\u{1F7E1}' },
  low: { label: 'Low', color: '#22c55e', icon: '\u{1F7E2}' },
}

export default function ProjectPlannerEditor({ data, onChange, noteTitle }) {
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
  const isInitialMount = useRef(true)
  useEffect(() => {
    if (isInitialMount.current) { isInitialMount.current = false; return }
    onChange?.({ columns, milestones, team })
  }, [columns, milestones, team])
  const stats = {
    totalTasks: columns.reduce((sum, col) => sum + col.tasks.length, 0),
    doneTasks: columns.find(c => c.id === 'done')?.tasks.length || 0,
    inProgressTasks: columns.find(c => c.id === 'inProgress')?.tasks.length || 0,
    overdueTasks: columns.reduce((sum, col) => {
      return sum + col.tasks.filter(t => t.dueDate && t.dueDate < new Date().toISOString().split('T')[0] && col.id !== 'done').length
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
  const updateTask = (columnId, taskId, updates) => {
    setColumns(columns.map(col => {
      if (col.id === columnId) {
        return {
          ...col,
          tasks: col.tasks.map(task =>
            task.id === taskId ? { ...task, ...updates } : task
          ),
        }
      }
      return col
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
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      <div className="flex-shrink-0 p-4 border-b border-gray-200 dark:border-gray-700 bg-[#e5eaf0] dark:bg-gray-800">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Target className="w-7 h-7" />
              {noteTitle || 'Project Planner'}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
              {stats.totalTasks} tasks {"\u2022"} {stats.progress}% complete
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-14 h-14">
              <svg className="transform -rotate-90 w-14 h-14">
                <circle cx="28" cy="28" r="24" stroke="rgba(0,0,0,0.1)" strokeWidth="6" fill="none" />
                <circle
                  cx="28" cy="28" r="24"
                  stroke="#10b981"
                  strokeWidth="6"
                  fill="none"
                  strokeDasharray={`${stats.progress * 1.5} 150`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-gray-900 dark:text-white font-bold text-xs">{stats.progress}%</span>
              </div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-white dark:bg-gray-700 rounded-lg p-2 text-center">
            <div className="text-xl font-bold text-gray-900 dark:text-white">{stats.totalTasks}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Total</div>
          </div>
          <div className="bg-white dark:bg-gray-700 rounded-lg p-2 text-center">
            <div className="text-xl font-bold text-gray-900 dark:text-white">{stats.inProgressTasks}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">In Progress</div>
          </div>
          <div className="bg-white dark:bg-gray-700 rounded-lg p-2 text-center">
            <div className="text-xl font-bold text-gray-900 dark:text-white">{stats.doneTasks}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Done</div>
          </div>
          <div className="bg-white dark:bg-gray-700 rounded-lg p-2 text-center">
            <div className="text-xl font-bold text-red-500 dark:text-red-400">{stats.overdueTasks}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Overdue</div>
          </div>
        </div>
      </div>
      <div className="flex-shrink-0 flex gap-1 p-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        {[
          { id: 'board', label: 'Kanban Board', icon: BarChart3 },
          { id: 'milestones', label: 'Milestones', icon: Milestone },
          { id: 'team', label: 'Team', icon: Users },
        ].map(view => (
          <button
            key={view.id}
            onClick={() => setActiveView(view.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeView === view.id
                ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
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
                  <div
                    key={column.id}
                    onDragOver={(e) => handleDragOver(e, column.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, column.id)}
                    className={`w-72 flex flex-col rounded-xl border-2 ${colors.border} ${
                      dragOverColumn === column.id ? 'ring-2 ring-purple-500' : ''
                    }`}
                  >
                    <div className={`flex items-center justify-between p-3 rounded-t-lg ${colors.bg}`}>
                      <div className="flex items-center gap-2">
                        <span className={`font-semibold ${colors.text}`}>{column.name}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                          {column.tasks.length}
                        </span>
                      </div>
                      <button
                        onClick={() => setShowAddTask(column.id)}
                        className="p-1 rounded hover:bg-white/50 dark:hover:bg-gray-700 transition-colors"
                      >
                        <Plus className="w-4 h-4 text-gray-500" />
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-white dark:bg-gray-800/50">
                      {showAddTask === column.id && (
                        <div className="p-3 rounded-lg border-2 border-dashed border-purple-300 dark:border-purple-700 bg-purple-50 dark:bg-purple-900/20">
                          <input
                            type="text"
                            value={newTaskText}
                            onChange={(e) => setNewTaskText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') addTask(column.id)
                              if (e.key === 'Escape') { setShowAddTask(null); setNewTaskText('') }
                            }}
                            placeholder="Task title..."
                            className="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-sm outline-none focus:border-purple-500"
                            autoFocus
                          />
                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={() => addTask(column.id)}
                              className="flex-1 px-3 py-1.5 rounded-lg bg-purple-500 hover:bg-purple-600 text-white text-sm"
                            >
                              Add Task
                            </button>
                            <button
                              onClick={() => { setShowAddTask(null); setNewTaskText('') }}
                              className="px-3 py-1.5 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-sm"
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
                          onUpdate={(updates) => updateTask(column.id, task.id, updates)}
                          onDelete={() => deleteTask(column.id, task.id)}
                          onEdit={() => setEditingTask({ ...task, columnId: column.id })}
                        />
                      ))}

                      {column.tasks.length === 0 && showAddTask !== column.id && (
                        <div className="text-center py-8 text-gray-400 text-sm">
                          No tasks
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {activeView === 'milestones' && (
          <div className="p-4 overflow-y-auto">
            <div className="max-w-2xl mx-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Milestones</h2>
                <button
                  onClick={() => setShowMilestoneForm(true)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 text-white text-sm"
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
                  <div className="text-center py-12 text-gray-500">
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
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Team Members</h2>
                <button
                  onClick={() => setShowTeamForm(true)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 text-white text-sm"
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
                  <div className="col-span-2 text-center py-12 text-gray-500">
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
          onSave={(updates) => {
            updateTask(editingTask.columnId, editingTask.id, updates)
            setEditingTask(null)
          }}
          onClose={() => setEditingTask(null)}
        />
      )}
    </div>
  )
}
function TaskCard({ task, team, onDragStart, onUpdate, onDelete, onEdit }) {
  const priority = PRIORITIES[task.priority]
  const assignee = team.find(m => m.id === task.assignee)
  const isOverdue = task.dueDate && task.dueDate < new Date().toISOString().split('T')[0]

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="group p-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all cursor-grab active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="font-medium text-gray-900 dark:text-white text-sm flex-1">
          {task.title}
        </h3>
        <button
          onClick={onEdit}
          className="p-1 opacity-0 group-hover:opacity-100 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <Edit3 className="w-3 h-3 text-gray-400" />
        </button>
      </div>

      {task.description && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 line-clamp-2">
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
            isOverdue ? 'bg-red-100 text-red-600' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
          }`}>
            <Calendar className="w-3 h-3" />
            {new Date(task.dueDate).toLocaleDateString()}
          </span>
        )}

        {assignee && (
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <div className="w-5 h-5 rounded-full bg-purple-100 dark:bg-purple-900 text-purple-600 flex items-center justify-center text-xs font-medium">
              {assignee.avatar}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
function TaskEditModal({ task, team, onSave, onClose }) {
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description || '')
  const [priority, setPriority] = useState(task.priority)
  const [dueDate, setDueDate] = useState(task.dueDate || '')
  const [assignee, setAssignee] = useState(task.assignee || '')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm modal-backdrop-animate">
      <div className="modal-animate w-full max-w-lg bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-[#cbd1db] dark:border-gray-700">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-white">Edit Task</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:border-purple-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:border-purple-500"
              >
                {Object.entries(PRIORITIES).map(([key, value]) => (
                  <option key={key} value={key}>{value.icon} {value.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:border-purple-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Assignee</label>
            <select
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:border-purple-500"
            >
              <option value="">Unassigned</option>
              {team.map((member) => (
                <option key={member.id} value={member.id}>{member.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave({ title, description, priority, dueDate: dueDate || null, assignee: assignee || null })}
            className="px-4 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 text-white"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  )
}
function MilestoneForm({ onSave, onCancel }) {
  const [name, setName] = useState('')
  const [dueDate, setDueDate] = useState('')

  return (
    <div className="p-4 mb-4 rounded-lg border-2 border-dashed border-purple-300 dark:border-purple-700 bg-purple-50 dark:bg-purple-900/20">
      <div className="space-y-3">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Milestone name..."
          className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm outline-none focus:border-purple-500"
          autoFocus
        />
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm outline-none focus:border-purple-500"
        />
        <div className="flex gap-2">
          <button
            onClick={() => name && onSave(name, dueDate || null)}
            className="flex-1 px-3 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 text-white text-sm"
          >
            Add Milestone
          </button>
          <button
            onClick={onCancel}
            className="px-3 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
function MilestoneCard({ milestone, onToggle, onDelete }) {
  const isOverdue = milestone.dueDate && milestone.dueDate < new Date().toISOString().split('T')[0] && !milestone.completed

  return (
    <div className={`flex items-center gap-3 p-4 rounded-lg border ${
      milestone.completed 
        ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
        : isOverdue
          ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
    }`}>
      <button onClick={onToggle}>
        {milestone.completed ? (
          <CheckCircle2 className="w-6 h-6 text-green-500" />
        ) : (
          <Milestone className={`w-6 h-6 ${isOverdue ? 'text-red-500' : 'text-purple-500'}`} />
        )}
      </button>
      <div className="flex-1">
        <h3 className={`font-medium ${milestone.completed ? 'line-through text-gray-400' : 'text-gray-900 dark:text-white'}`}>
          {milestone.name}
        </h3>
        {milestone.dueDate && (
          <span className={`text-xs ${isOverdue && !milestone.completed ? 'text-red-500' : 'text-gray-500'}`}>
            Due: {new Date(milestone.dueDate).toLocaleDateString()}
          </span>
        )}
      </div>
      <button
        onClick={onDelete}
        className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-red-500"
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
    <div className="p-4 mb-4 rounded-lg border-2 border-dashed border-purple-300 dark:border-purple-700 bg-purple-50 dark:bg-purple-900/20">
      <div className="space-y-3">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name..."
          className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm outline-none focus:border-purple-500"
          autoFocus
        />
        <input
          type="text"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          placeholder="Role (e.g., Developer, Designer)..."
          className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm outline-none focus:border-purple-500"
        />
        <div className="flex gap-2">
          <button
            onClick={() => name && onSave(name, role)}
            className="flex-1 px-3 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 text-white text-sm"
          >
            Add Member
          </button>
          <button
            onClick={onCancel}
            className="px-3 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-sm"
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
    <div className="flex items-center gap-3 p-4 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
      <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900 text-purple-600 flex items-center justify-center font-medium">
        {member.avatar}
      </div>
      <div className="flex-1">
        <h3 className="font-medium text-gray-900 dark:text-white">{member.name}</h3>
        <p className="text-xs text-gray-500">{member.role || 'Team Member'}</p>
        <p className="text-xs text-purple-500">{tasksAssigned} tasks assigned</p>
      </div>
      <button
        onClick={onDelete}
        className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-red-500"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  )
}
