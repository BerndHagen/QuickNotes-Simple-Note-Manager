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
  BarChart3,
  GripVertical,
  MoreHorizontal,
  MoveUp,
  MoveDown,
  ChevronsUp,
  ChevronsDown,
  Flag,
  FileText,
  ShieldAlert,
  Scale,
} from 'lucide-react'
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { formatDateKey, generateId, parseDateKey } from './noteTypes'
import { useLatestValue } from './useLatestValue'
import { useEditorDataSync } from './useEditorDataSync'
import StructuredWorkspaceShell, {
  WorkspaceSection,
  WorkspaceTabs,
} from './StructuredWorkspaceShell'
import {
  Button,
  EmptyState,
  IconButton,
  Menu,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  Modal,
} from '../ui'

const PRIORITIES = {
  high: { label: 'High', className: 'text-danger-text' },
  medium: { label: 'Medium', className: 'text-content-muted' },
  low: { label: 'Low', className: 'text-content-subtle' },
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
  const [project, setProject] = useState({
    brief: data?.project?.brief || data?.description || '',
    status: data?.project?.status || 'active',
    priority: data?.project?.priority || 'medium',
    startDate: data?.project?.startDate || '',
    targetDate: data?.project?.targetDate || '',
    goals: data?.project?.goals || '',
    decisions: data?.project?.decisions || '',
    risks: data?.project?.risks || '',
  })
  const [activeView, setActiveView] = useState('overview')
  const [activeTaskId, setActiveTaskId] = useState(null)
  const [dragOverColumn, setDragOverColumn] = useState(null)
  const [showAddTask, setShowAddTask] = useState(null)
  const [newTaskText, setNewTaskText] = useState('')
  const [editingTask, setEditingTask] = useState(null)
  const [showMilestoneForm, setShowMilestoneForm] = useState(false)
  const [showTeamForm, setShowTeamForm] = useState(false)
  const [boardAnnouncement, setBoardAnnouncement] = useState('')
  const onChangeRef = useLatestValue(onChange)
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 160, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )
  const currentEditorData = { columns, milestones, team, project }
  const skipChangeRef = useEditorDataSync(data, currentEditorData, (incoming) => {
    setColumns(incoming?.columns || [])
    setMilestones(incoming?.milestones || [])
    setTeam(incoming?.team || [])
    setProject({
      brief: incoming?.project?.brief || incoming?.description || '',
      status: incoming?.project?.status || 'active',
      priority: incoming?.project?.priority || 'medium',
      startDate: incoming?.project?.startDate || '',
      targetDate: incoming?.project?.targetDate || '',
      goals: incoming?.project?.goals || '',
      decisions: incoming?.project?.decisions || '',
      risks: incoming?.project?.risks || '',
    })
  })
  const isInitialMount = useRef(true)
  useEffect(() => {
    if (isInitialMount.current) { isInitialMount.current = false; return }
    if (skipChangeRef.current) { skipChangeRef.current = false; return }
    onChangeRef.current?.({ columns, milestones, team, project })
  }, [columns, milestones, onChangeRef, project, skipChangeRef, team])
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
    setColumns((currentColumns) => {
      const sourceColumn = currentColumns.find((column) =>
        column.tasks.some((task) => task.id === taskToEdit.id)
      )
      const sourceIndex = sourceColumn?.tasks.findIndex((task) => task.id === taskToEdit.id) ?? -1
      const updatedTask = { ...taskRecord, ...taskUpdates }

      return currentColumns.map((column) => {
        const withoutTask = column.tasks.filter((task) => task.id !== taskToEdit.id)
        if (column.id !== targetColumnId) return { ...column, tasks: withoutTask }
        if (column.id === sourceColumn?.id && sourceIndex >= 0) {
          const nextTasks = [...withoutTask]
          nextTasks.splice(Math.min(sourceIndex, nextTasks.length), 0, updatedTask)
          return { ...column, tasks: nextTasks }
        }
        return { ...column, tasks: [...withoutTask, updatedTask] }
      })
    })
  }
  const deleteTask = (columnId, taskId) => {
    setColumns(columns.map(col => {
      if (col.id === columnId) {
        return { ...col, tasks: col.tasks.filter(t => t.id !== taskId) }
      }
      return col
    }))
  }
  const locateTask = (currentColumns, taskId) => {
    const column = currentColumns.find((candidate) =>
      candidate.tasks.some((task) => task.id === taskId)
    )
    if (!column) return null
    return {
      column,
      index: column.tasks.findIndex((task) => task.id === taskId),
      task: column.tasks.find((task) => task.id === taskId),
    }
  }

  const moveTask = (taskId, targetColumnId, targetIndex, announcement) => {
    setColumns((currentColumns) => {
      const source = locateTask(currentColumns, taskId)
      const targetColumn = currentColumns.find((column) => column.id === targetColumnId)
      if (!source || !targetColumn) return currentColumns

      if (source.column.id === targetColumnId) {
        const boundedIndex = Math.max(0, Math.min(targetIndex, source.column.tasks.length - 1))
        if (boundedIndex === source.index) return currentColumns
        return currentColumns.map((column) =>
          column.id === targetColumnId
            ? { ...column, tasks: arrayMove(column.tasks, source.index, boundedIndex) }
            : column
        )
      }

      const boundedIndex = Math.max(0, Math.min(targetIndex, targetColumn.tasks.length))
      return currentColumns.map((column) => {
        if (column.id === source.column.id) {
          return { ...column, tasks: column.tasks.filter((task) => task.id !== taskId) }
        }
        if (column.id === targetColumnId) {
          const nextTasks = [...column.tasks]
          nextTasks.splice(boundedIndex, 0, source.task)
          return { ...column, tasks: nextTasks }
        }
        return column
      })
    })
    if (announcement) setBoardAnnouncement(announcement)
  }

  const moveTaskWithinColumn = (task, columnId, destination) => {
    const column = columns.find((candidate) => candidate.id === columnId)
    const currentIndex = column?.tasks.findIndex((item) => item.id === task.id) ?? -1
    if (currentIndex < 0) return
    const targetIndex = destination === 'top'
      ? 0
      : destination === 'bottom'
        ? column.tasks.length - 1
        : currentIndex + destination
    if (targetIndex < 0 || targetIndex >= column.tasks.length || targetIndex === currentIndex) return
    moveTask(
      task.id,
      columnId,
      targetIndex,
      `${task.title} moved to position ${targetIndex + 1} in ${column.name}`
    )
  }

  const moveTaskToColumn = (task, sourceColumnId, targetColumnId) => {
    if (!targetColumnId || sourceColumnId === targetColumnId) return
    const targetColumn = columns.find((column) => column.id === targetColumnId)
    moveTask(
      task.id,
      targetColumnId,
      targetColumn?.tasks.length || 0,
      `${task.title} moved to ${targetColumn?.name || 'another status'}`
    )
  }

  const handleDragStart = ({ active }) => {
    setActiveTaskId(active.id)
    setDragOverColumn(active.data.current?.columnId || null)
  }

  const handleDragOver = ({ over }) => {
    if (!over) {
      setDragOverColumn(null)
      return
    }
    setDragOverColumn(over.data.current?.columnId || null)
  }

  const handleDragEnd = ({ active, over }) => {
    setActiveTaskId(null)
    setDragOverColumn(null)
    if (!over || active.id === over.id) return

    const source = locateTask(columns, active.id)
    const targetColumnId = over.data.current?.columnId
    const targetColumn = columns.find((column) => column.id === targetColumnId)
    if (!source || !targetColumn) return
    const targetIndex = over.data.current?.type === 'task'
      ? targetColumn.tasks.findIndex((task) => task.id === over.id)
      : targetColumn.tasks.length
    const position = Math.max(0, targetIndex) + 1
    moveTask(
      active.id,
      targetColumnId,
      targetIndex,
      `${source.task.title} moved to position ${position} in ${targetColumn.name}`
    )
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

  const activeTask = activeTaskId ? locateTask(columns, activeTaskId)?.task : null

  return (
    <StructuredWorkspaceShell
      className="qn-type-editor qn-type-project"
      icon={Target}
      typeLabel="Project workspace"
      title={noteTitle}
      fallback="Project board"
      onTitleChange={onTitleChange}
      readOnly={readOnly}
      summary={(
        <>
          <span>{stats.totalTasks} {stats.totalTasks === 1 ? 'task' : 'tasks'}</span>
          <span>{stats.progress}% complete</span>
          <span>{project.status.charAt(0).toUpperCase() + project.status.slice(1)}</span>
          {stats.inProgressTasks > 0 && <span>{stats.inProgressTasks} in progress</span>}
          {stats.overdueTasks > 0 && <span>{stats.overdueTasks} overdue</span>}
        </>
      )}
      commands={(
        <WorkspaceTabs
          activeTab={activeView}
          onChange={setActiveView}
          tabs={[
            { id: 'overview', label: 'Overview', icon: FileText },
            { id: 'board', label: 'Board', icon: BarChart3, count: stats.totalTasks },
            { id: 'milestones', label: 'Milestones', icon: Milestone, count: milestones.length },
            { id: 'team', label: 'People', icon: Users, count: team.length },
          ]}
        />
      )}
    >
        {activeView === 'overview' && (
          <div className="qn-project-overview">
            <section className="qn-project-brief" aria-labelledby="qn-project-brief-title">
              <div className="qn-project-overview-heading">
                <div>
                  <h2 id="qn-project-brief-title">Project brief</h2>
                  <p>Keep the outcome and operating context clear.</p>
                </div>
                <div className="qn-project-properties" aria-label="Project properties">
                  <label>
                    <span>Status</span>
                    <select value={project.status} onChange={(event) => setProject((current) => ({ ...current, status: event.target.value }))}>
                      <option value="planned">Planned</option>
                      <option value="active">Active</option>
                      <option value="paused">Paused</option>
                      <option value="complete">Complete</option>
                    </select>
                  </label>
                  <label>
                    <span>Priority</span>
                    <select value={project.priority} onChange={(event) => setProject((current) => ({ ...current, priority: event.target.value }))}>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </label>
                  <label>
                    <span>Start</span>
                    <input type="date" value={project.startDate} onChange={(event) => setProject((current) => ({ ...current, startDate: event.target.value }))} />
                  </label>
                  <label>
                    <span>Target</span>
                    <input type="date" value={project.targetDate} onChange={(event) => setProject((current) => ({ ...current, targetDate: event.target.value }))} />
                  </label>
                </div>
              </div>
              <textarea
                value={project.brief}
                onChange={(event) => setProject((current) => ({ ...current, brief: event.target.value }))}
                aria-label="Project brief"
                placeholder="Describe the desired outcome, scope, and constraints."
                rows={7}
              />
            </section>

            <div className="qn-project-overview-grid">
              <ProjectNarrativeField
                icon={Target}
                title="Goals"
                description="One outcome per line"
                value={project.goals}
                onChange={(value) => setProject((current) => ({ ...current, goals: value }))}
              />
              <ProjectNarrativeField
                icon={ShieldAlert}
                title="Risks and blockers"
                description="What could prevent delivery?"
                value={project.risks}
                onChange={(value) => setProject((current) => ({ ...current, risks: value }))}
              />
              <ProjectNarrativeField
                icon={Scale}
                title="Decisions"
                description="Record choices that affect the project"
                value={project.decisions}
                onChange={(value) => setProject((current) => ({ ...current, decisions: value }))}
              />
              <section className="qn-project-next" aria-labelledby="qn-project-next-title">
                <h3 id="qn-project-next-title">Delivery at a glance</h3>
                <dl>
                  <div><dt>Open tasks</dt><dd>{stats.totalTasks - stats.doneTasks}</dd></div>
                  <div><dt>In progress</dt><dd>{stats.inProgressTasks}</dd></div>
                  <div><dt>Overdue</dt><dd>{stats.overdueTasks}</dd></div>
                  <div><dt>Milestones</dt><dd>{milestones.filter((item) => !item.completed).length} open</dd></div>
                </dl>
              </section>
            </div>
          </div>
        )}

        {activeView === 'board' && (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={() => {
              setActiveTaskId(null)
              setDragOverColumn(null)
            }}
          >
            <p className="qn-sr-only" aria-live="polite">{boardAnnouncement}</p>
            <div className="qn-project-board">
              {columns.map((column) => (
                <ProjectColumn
                  key={column.id}
                  column={column}
                  columns={columns}
                  team={team}
                  isDragTarget={dragOverColumn === column.id}
                  showAddTask={showAddTask === column.id}
                  newTaskText={newTaskText}
                  onShowAddTask={() => setShowAddTask(column.id)}
                  onNewTaskTextChange={setNewTaskText}
                  onAddTask={() => addTask(column.id)}
                  onCancelAdd={() => { setShowAddTask(null); setNewTaskText('') }}
                  onDeleteTask={(taskId) => deleteTask(column.id, taskId)}
                  onEditTask={(task) => setEditingTask({ ...task, columnId: column.id })}
                  onMoveWithin={(task, destination) => moveTaskWithinColumn(task, column.id, destination)}
                  onMoveTo={(task, targetColumnId) => moveTaskToColumn(task, column.id, targetColumnId)}
                />
              ))}
            </div>
            <DragOverlay>
              {activeTask ? <ProjectTaskPreview task={activeTask} /> : null}
            </DragOverlay>
          </DndContext>
        )}

        {activeView === 'milestones' && (
          <WorkspaceSection
            title="Milestones"
            description="Track the outcomes that define project progress."
            actions={!showMilestoneForm && (
              <Button size="sm" variant="primary" icon={Plus} onClick={() => setShowMilestoneForm(true)}>
                Add milestone
              </Button>
            )}
          >

              {showMilestoneForm && (
                <MilestoneForm
                  onSave={(name, dueDate) => { addMilestone(name, dueDate); setShowMilestoneForm(false) }}
                  onCancel={() => setShowMilestoneForm(false)}
                />
              )}

              <div>
                {milestones.length === 0 ? (
                  <EmptyState
                    icon={Milestone}
                    title="No milestones yet"
                    description="Add a milestone to track the next meaningful outcome."
                    size="sm"
                  />
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
          </WorkspaceSection>
        )}

        {activeView === 'team' && (
          <WorkspaceSection
            title="People"
            description="Keep task ownership clear without turning the board into a directory."
            actions={!showTeamForm && (
              <Button size="sm" variant="primary" icon={Plus} onClick={() => setShowTeamForm(true)}>
                Add person
              </Button>
            )}
          >

              {showTeamForm && (
                <TeamMemberForm
                  onSave={(name, role) => { addTeamMember(name, role); setShowTeamForm(false) }}
                  onCancel={() => setShowTeamForm(false)}
                />
              )}

              <div className="qn-project-people">
                {team.length === 0 ? (
                  <EmptyState
                    icon={Users}
                    title="No team members yet"
                    description="Add people here when tasks need clear ownership."
                    size="sm"
                    className="col-span-2"
                  />
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
          </WorkspaceSection>
        )}
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
    </StructuredWorkspaceShell>
  )
}

function ProjectNarrativeField({ icon: Icon, title, description, value, onChange }) {
  return (
    <label className="qn-project-narrative">
      <span className="qn-project-narrative-title"><Icon className="h-4 w-4" aria-hidden="true" />{title}</span>
      <small>{description}</small>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={5} placeholder="Add details" />
    </label>
  )
}

function ProjectColumn({
  column,
  columns,
  team,
  isDragTarget,
  showAddTask,
  newTaskText,
  onShowAddTask,
  onNewTaskTextChange,
  onAddTask,
  onCancelAdd,
  onDeleteTask,
  onEditTask,
  onMoveWithin,
  onMoveTo,
}) {
  const { setNodeRef } = useDroppable({
    id: `column:${column.id}`,
    data: { type: 'column', columnId: column.id },
  })

  return (
    <section
      ref={setNodeRef}
      className={`qn-project-column ${isDragTarget ? 'qn-project-column--target' : ''}`}
      data-column={column.id}
      aria-label={`${column.name}, ${column.tasks.length} ${column.tasks.length === 1 ? 'task' : 'tasks'}`}
    >
      <header className="qn-project-column-heading">
        <div>
          <h2>{column.name}</h2>
          <span>{column.tasks.length}</span>
        </div>
        <IconButton icon={Plus} size="sm" label={`Add task to ${column.name}`} onClick={onShowAddTask} />
      </header>

      {showAddTask && (
        <form
          className="qn-project-quick-add"
          onSubmit={(event) => { event.preventDefault(); onAddTask() }}
        >
          <label className="qn-sr-only" htmlFor={`new-project-task-${column.id}`}>Task title</label>
          <input
            id={`new-project-task-${column.id}`}
            type="text"
            value={newTaskText}
            onChange={(event) => onNewTaskTextChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') onCancelAdd()
            }}
            placeholder="Task title"
            autoFocus
          />
          <div>
            <Button type="submit" size="sm" variant="primary" disabled={!newTaskText.trim()}>Add task</Button>
            <Button size="sm" variant="ghost" onClick={onCancelAdd}>Cancel</Button>
          </div>
        </form>
      )}

      <SortableContext items={column.tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
        <div className="qn-project-column-list">
          {column.tasks.map((task, index) => (
            <TaskCard
              key={task.id}
              task={task}
              columnId={column.id}
              columns={columns}
              team={team}
              index={index}
              itemCount={column.tasks.length}
              onDelete={() => onDeleteTask(task.id)}
              onEdit={() => onEditTask(task)}
              onMoveWithin={(destination) => onMoveWithin(task, destination)}
              onMoveTo={(targetColumnId) => onMoveTo(task, targetColumnId)}
            />
          ))}
          {column.tasks.length === 0 && !showAddTask && (
            <div className="qn-project-column-empty">No tasks in this status</div>
          )}
        </div>
      </SortableContext>
    </section>
  )
}

function TaskCard({ task, columnId, columns, team, index, itemCount, onDelete, onEdit, onMoveWithin, onMoveTo }) {
  const menuButtonRef = useRef(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: 'task', columnId },
  })
  const priority = PRIORITIES[task.priority]
  const assignee = team.find(m => m.id === task.assignee)
  const isOverdue = task.dueDate && task.dueDate < formatDateKey()

  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`qn-project-task-card ${isDragging ? 'qn-project-task-card--dragging' : ''}`}
    >
      <div className="qn-project-task-main">
        <button
          type="button"
          className="qn-project-drag-handle"
          aria-label={`Move ${task.title}. Use drag or the task menu.`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" aria-hidden="true" />
        </button>
        <div className="min-w-0 flex-1">
          <h3>{task.title}</h3>
          {task.description && <p>{task.description}</p>}
        </div>
        <IconButton
          ref={menuButtonRef}
          icon={MoreHorizontal}
          size="sm"
          label={`Actions for ${task.title}`}
          active={menuOpen}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        />
      </div>
      <div className="qn-project-task-meta">
        {task.priority && task.priority !== 'medium' && (
          <span className={priority?.className}>
            <Flag className="h-3.5 w-3.5" aria-hidden="true" />
            {priority?.label}
          </span>
        )}
        {task.dueDate && (
          <span className={isOverdue ? 'text-danger-text' : ''}>
            <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
            {parseDateKey(task.dueDate).toLocaleDateString('en-US')}
          </span>
        )}
        {assignee && (
          <span title={assignee.name}>{assignee.name}</span>
        )}
      </div>
      <Menu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        anchorRef={menuButtonRef}
        placement="bottom-end"
        label={`Actions for ${task.title}`}
        width={230}
      >
        <MenuLabel>Position</MenuLabel>
        <MenuItem icon={ChevronsUp} disabled={index === 0} onClick={() => { onMoveWithin('top'); setMenuOpen(false) }}>Move to top</MenuItem>
        <MenuItem icon={MoveUp} disabled={index === 0} onClick={() => { onMoveWithin(-1); setMenuOpen(false) }}>Move up</MenuItem>
        <MenuItem icon={MoveDown} disabled={index === itemCount - 1} onClick={() => { onMoveWithin(1); setMenuOpen(false) }}>Move down</MenuItem>
        <MenuItem icon={ChevronsDown} disabled={index === itemCount - 1} onClick={() => { onMoveWithin('bottom'); setMenuOpen(false) }}>Move to bottom</MenuItem>
        <MenuSeparator />
        <MenuLabel>Move to status</MenuLabel>
        {columns.filter((column) => column.id !== columnId).map((column) => (
          <MenuItem key={column.id} onClick={() => { onMoveTo(column.id); setMenuOpen(false) }}>{column.name}</MenuItem>
        ))}
        <MenuSeparator />
        <MenuItem icon={Edit3} onClick={() => { onEdit(); setMenuOpen(false) }}>Edit details</MenuItem>
        <MenuItem icon={Trash2} tone="danger" onClick={() => { onDelete(); setMenuOpen(false) }}>Delete task</MenuItem>
      </Menu>
    </article>
  )
}

function ProjectTaskPreview({ task }) {
  return (
    <div className="qn-project-task-preview">
      <GripVertical className="h-4 w-4" aria-hidden="true" />
      <span>{task.title}</span>
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
              className="w-full rounded-lg border border-subtle bg-surface-raised px-3 py-2 text-content outline-none focus:border-accent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-content-muted mb-1">Description</label>
            <textarea
              aria-label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full resize-none rounded-lg border border-subtle bg-surface-raised px-3 py-2 text-content outline-none focus:border-accent"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-content-muted mb-1">Priority</label>
              <select
                aria-label="Priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full rounded-lg border border-subtle bg-surface-raised px-3 py-2 text-content outline-none focus:border-accent"
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
                className="w-full rounded-lg border border-subtle bg-surface-raised px-3 py-2 text-content outline-none focus:border-accent"
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
                className="w-full rounded-lg border border-subtle bg-surface-raised px-3 py-2 text-content outline-none focus:border-accent"
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
                className="w-full rounded-lg border border-subtle bg-surface-raised px-3 py-2 text-content outline-none focus:border-accent"
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
    <div className={`qn-domain-card flex items-center gap-3 rounded-card border p-4 ${
 milestone.completed 
 ? 'bg-success-soft border-[var(--qn-success-border)]'
        : isOverdue
          ? 'bg-danger-soft border-[var(--qn-danger-border)]'
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
    <div className="qn-domain-card flex items-center gap-3 rounded-card border border-subtle bg-surface-raised p-4 shadow-xs">
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
