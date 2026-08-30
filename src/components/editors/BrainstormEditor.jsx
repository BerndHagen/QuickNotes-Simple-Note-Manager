import { useEffect, useRef, useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Edit3,
  Lightbulb,
  List,
  Move,
  Plus,
  Shuffle,
  Star,
  Tag,
  ThumbsDown,
  ThumbsUp,
  Trash2,
} from 'lucide-react'
import { Button, IconButton, Input, Modal, Select, Textarea } from '../ui'
import { generateId } from './noteTypes'
import StructuredWorkspaceShell, { WorkspaceSection, WorkspaceTabs } from './StructuredWorkspaceShell'
import SpatialEditor from '../spatial/SpatialEditor'
import { useLatestValue } from './useLatestValue'
import { useEditorDataSync } from './useEditorDataSync'

const DEFAULT_CATEGORIES = [
  { id: 'uncategorized', name: 'Uncategorized', color: '#6b7280' },
  { id: 'feature', name: 'Feature', color: '#6b7280' },
  { id: 'improvement', name: 'Improvement', color: '#6b7280' },
  { id: 'design', name: 'Design', color: '#6b7280' },
  { id: 'research', name: 'Research', color: '#6b7280' },
  { id: 'marketing', name: 'Marketing', color: '#6b7280' },
]

export default function BrainstormEditor({ data, onChange, note, noteTitle, onTitleChange, readOnly, navigationTarget, onNavigationComplete }) {
  const [brainstormData, setBrainstormData] = useState({
    topic: data?.topic || '',
    ideas: data?.ideas || [],
    categories: data?.categories || DEFAULT_CATEGORIES,
    viewMode: data?.viewMode === 'register' ? 'register' : 'canvas',
    sortBy: data?.sortBy || 'newest',
    selectedCategory: data?.selectedCategory || 'all',
  })
  const [newIdea, setNewIdea] = useState('')
  const [expandedIdea, setExpandedIdea] = useState(null)
  const [editingIdea, setEditingIdea] = useState(null)
  const [editText, setEditText] = useState('')
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const onChangeRef = useLatestValue(onChange)
  const skipChangeRef = useEditorDataSync(data, brainstormData, (incoming) => {
    setBrainstormData({
      ...incoming,
      viewMode: incoming.viewMode === 'register' ? 'register' : 'canvas',
    })
  })
  const isInitialMount = useRef(true)

  useEffect(() => {
    if (isInitialMount.current) { isInitialMount.current = false; return }
    if (skipChangeRef.current) { skipChangeRef.current = false; return }
    onChangeRef.current?.(brainstormData)
  }, [brainstormData, onChangeRef, skipChangeRef])

  const update = (field, value) => {
    setBrainstormData((current) => ({
      ...current,
      [field]: typeof value === 'function' ? value(current[field]) : value,
    }))
  }

  const updateIdea = (id, updates) => {
    update('ideas', (ideas) => ideas.map((idea) => idea.id === id ? { ...idea, ...updates } : idea))
  }

  const addIdea = () => {
    if (!newIdea.trim()) return
    update('ideas', (ideas) => [{
      id: generateId(),
      text: newIdea.trim(),
      category: 'uncategorized',
      votes: 0,
      starred: false,
      notes: '',
      createdAt: new Date().toISOString(),
    }, ...ideas])
    setNewIdea('')
  }

  const duplicateIdea = (idea) => {
    update('ideas', (ideas) => [{
      ...idea,
      id: generateId(),
      text: `${idea.text} (copy)`,
      createdAt: new Date().toISOString(),
    }, ...ideas])
  }

  const deleteIdea = (id) => {
    update('ideas', (ideas) => ideas.filter((idea) => idea.id !== id))
    setExpandedIdea((current) => current === id ? null : current)
  }

  const startEditing = (idea) => {
    setEditingIdea(idea.id)
    setEditText(idea.text)
  }

  const saveEdit = () => {
    if (!editingIdea || !editText.trim()) return
    updateIdea(editingIdea, { text: editText.trim() })
    setEditingIdea(null)
  }

  const addCategory = () => {
    if (!newCategoryName.trim()) return
    update('categories', (categories) => [...categories, {
      id: generateId(),
      name: newCategoryName.trim(),
      color: '#6b7280',
    }])
    setNewCategoryName('')
  }

  const deleteCategory = (id) => {
    if (id === 'uncategorized') return
    setBrainstormData((current) => ({
      ...current,
      categories: current.categories.filter((category) => category.id !== id),
      ideas: current.ideas.map((idea) => idea.category === id ? { ...idea, category: 'uncategorized' } : idea),
      selectedCategory: current.selectedCategory === id ? 'all' : current.selectedCategory,
    }))
  }

  const filteredIdeas = [...brainstormData.ideas]
    .filter((idea) => brainstormData.selectedCategory === 'all' || idea.category === brainstormData.selectedCategory)
    .sort((a, b) => {
      if (brainstormData.sortBy === 'votes') return b.votes - a.votes
      if (brainstormData.sortBy === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt)
      if (brainstormData.sortBy === 'starred') return Number(b.starred) - Number(a.starred)
      return new Date(b.createdAt) - new Date(a.createdAt)
    })

  const pickRandomIdea = () => {
    if (!filteredIdeas.length) return
    const idea = filteredIdeas[Math.floor(Math.random() * filteredIdeas.length)]
    setExpandedIdea(idea.id)
    requestAnimationFrame(() => document.getElementById(`idea-${idea.id}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }))
  }

  const starredCount = brainstormData.ideas.filter((idea) => idea.starred).length
  const canvasActive = brainstormData.viewMode !== 'register'

  return (
    <StructuredWorkspaceShell
      className={`qn-type-editor qn-type-brainstorm ${canvasActive ? 'qn-type-brainstorm--canvas' : ''}`}
      icon={Lightbulb}
      typeLabel="Idea workspace"
      title={noteTitle}
      fallback="Idea board"
      onTitleChange={onTitleChange}
      readOnly={readOnly}
      summary={(
        <>
          <span>{brainstormData.ideas.length} ideas</span>
          <span>{starredCount} shortlisted</span>
          <span>{brainstormData.categories.length} categories</span>
        </>
      )}
      commands={(
        <WorkspaceTabs
          tabs={[
            { id: 'canvas', label: 'Canvas', icon: Move },
            { id: 'register', label: 'Idea register', icon: List, count: brainstormData.ideas.length },
          ]}
          activeTab={canvasActive ? 'canvas' : 'register'}
          onChange={(viewMode) => update('viewMode', viewMode)}
        />
      )}
    >
      {canvasActive ? (
        <div className="qn-brainstorm-spatial">
          <SpatialEditor
            note={note}
            kind="canvas"
            experienceLabel="Brainstorm"
            hideTitlebar
            noteTitle={noteTitle}
            onTitleChange={onTitleChange}
            readOnly={readOnly}
            navigationTarget={navigationTarget}
            onNavigationComplete={onNavigationComplete}
          />
        </div>
      ) : (
        <>
      <WorkspaceSection title="Working question" description="Keep the prompt visible while ideas develop.">
        <div className="qn-idea-topic">
          <label htmlFor="qn-idea-topic">Topic or question</label>
          <Input
            id="qn-idea-topic"
            value={brainstormData.topic}
            onChange={(event) => update('topic', event.target.value)}
            placeholder="What problem are you exploring?"
          />
        </div>
      </WorkspaceSection>

      <WorkspaceSection title="Capture" description="One thought per entry; evaluate it afterward.">
        <form className="qn-idea-capture" onSubmit={(event) => { event.preventDefault(); addIdea() }}>
          <Input
            value={newIdea}
            onChange={(event) => setNewIdea(event.target.value)}
            aria-label="New idea"
            placeholder="Write an idea"
            autoFocus
          />
          <Button type="submit" variant="primary" icon={Plus} disabled={!newIdea.trim()}>Add idea</Button>
        </form>
      </WorkspaceSection>

      <WorkspaceSection
        title="Ideas"
        description={`${filteredIdeas.length} ${filteredIdeas.length === 1 ? 'idea' : 'ideas'} shown`}
        actions={(
          <div className="qn-idea-toolbar">
            <Select aria-label="Filter ideas by category" value={brainstormData.selectedCategory} onChange={(event) => update('selectedCategory', event.target.value)}>
              <option value="all">All categories</option>
              {brainstormData.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </Select>
            <Select aria-label="Sort ideas" value={brainstormData.sortBy} onChange={(event) => update('sortBy', event.target.value)}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="votes">Highest score</option>
              <option value="starred">Shortlisted first</option>
            </Select>
            <IconButton icon={Shuffle} label="Select a random idea" disabled={!filteredIdeas.length} onClick={pickRandomIdea} />
            <IconButton icon={Tag} label="Manage categories" onClick={() => setCategoryDialogOpen(true)} />
          </div>
        )}
      >
        {!filteredIdeas.length ? (
          <div className="qn-structured-empty">
            <strong>No ideas here</strong>
            {brainstormData.ideas.length ? 'Choose another category.' : 'Add the first idea above.'}
          </div>
        ) : filteredIdeas.map((idea) => (
          <IdeaRow
            key={idea.id}
            idea={idea}
            categories={brainstormData.categories}
            expanded={expandedIdea === idea.id}
            editing={editingIdea === idea.id}
            editText={editText}
            onEditTextChange={setEditText}
            onToggleExpanded={() => setExpandedIdea((current) => current === idea.id ? null : idea.id)}
            onVote={(delta) => updateIdea(idea.id, { votes: idea.votes + delta })}
            onToggleStar={() => updateIdea(idea.id, { starred: !idea.starred })}
            onStartEditing={() => startEditing(idea)}
            onSaveEdit={saveEdit}
            onCancelEdit={() => setEditingIdea(null)}
            onDuplicate={() => duplicateIdea(idea)}
            onDelete={() => deleteIdea(idea.id)}
            onUpdate={(updates) => updateIdea(idea.id, updates)}
          />
        ))}
      </WorkspaceSection>

        </>
      )}

      <Modal
        open={categoryDialogOpen}
        onClose={() => setCategoryDialogOpen(false)}
        title="Manage categories"
        description="Use categories only when they help group related ideas."
        size="md"
        footer={<Button variant="primary" onClick={() => setCategoryDialogOpen(false)}>Done</Button>}
      >
        <form className="qn-idea-category-add" onSubmit={(event) => { event.preventDefault(); addCategory() }}>
          <Input value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} placeholder="Category name" aria-label="New category name" />
          <Button type="submit" variant="secondary" icon={Plus} disabled={!newCategoryName.trim()}>Add</Button>
        </form>
        <div className="qn-idea-category-list">
          {brainstormData.categories.map((category) => (
            <div key={category.id}>
              <span>{category.name}</span>
              <small>{brainstormData.ideas.filter((idea) => idea.category === category.id).length} ideas</small>
              {category.id !== 'uncategorized' && (
                <IconButton icon={Trash2} label={`Delete ${category.name}`} variant="danger-ghost" onClick={() => deleteCategory(category.id)} />
              )}
            </div>
          ))}
        </div>
      </Modal>
    </StructuredWorkspaceShell>
  )
}

function IdeaRow({
  idea,
  categories,
  expanded,
  editing,
  editText,
  onEditTextChange,
  onToggleExpanded,
  onVote,
  onToggleStar,
  onStartEditing,
  onSaveEdit,
  onCancelEdit,
  onDuplicate,
  onDelete,
  onUpdate,
}) {
  return (
    <article id={`idea-${idea.id}`} className={`qn-idea-row qn-structured-row ${expanded ? 'qn-idea-row--expanded' : ''}`}>
      <div className="qn-idea-row-main">
        <div className="qn-idea-score" aria-label={`Score ${idea.votes}`}>
          <IconButton icon={ThumbsUp} size="sm" label={`Increase score for ${idea.text}`} onClick={() => onVote(1)} />
          <strong>{idea.votes}</strong>
          <IconButton icon={ThumbsDown} size="sm" label={`Decrease score for ${idea.text}`} onClick={() => onVote(-1)} />
        </div>
        <div className="min-w-0">
          {editing ? (
            <div className="qn-idea-inline-edit">
              <Input value={editText} onChange={(event) => onEditTextChange(event.target.value)} onKeyDown={(event) => {
                if (event.key === 'Enter') onSaveEdit()
                if (event.key === 'Escape') onCancelEdit()
              }} autoFocus aria-label={`Edit ${idea.text}`} />
              <Button size="sm" variant="primary" onClick={onSaveEdit}>Save</Button>
              <Button size="sm" variant="ghost" onClick={onCancelEdit}>Cancel</Button>
            </div>
          ) : (
            <button type="button" className="qn-idea-title" aria-expanded={expanded} onClick={onToggleExpanded}>
              {expanded ? <ChevronDown className="h-4 w-4" aria-hidden="true" /> : <ChevronRight className="h-4 w-4" aria-hidden="true" />}
              <span>{idea.text}</span>
            </button>
          )}
          <div className="qn-idea-meta">
            <span>{categories.find((category) => category.id === idea.category)?.name || 'Uncategorized'}</span>
            {idea.notes && !expanded && <span>{idea.notes}</span>}
          </div>
        </div>
        <div className="qn-idea-actions">
          <IconButton icon={Star} size="sm" label={idea.starred ? `Remove ${idea.text} from shortlist` : `Shortlist ${idea.text}`} active={idea.starred} tone="favorite" iconClassName={idea.starred ? 'fill-current' : ''} onClick={onToggleStar} />
          <IconButton icon={Edit3} size="sm" label={`Edit ${idea.text}`} onClick={onStartEditing} />
          <IconButton icon={Copy} size="sm" label={`Duplicate ${idea.text}`} onClick={onDuplicate} />
          <IconButton icon={Trash2} size="sm" label={`Delete ${idea.text}`} variant="danger-ghost" onClick={onDelete} />
        </div>
      </div>
      {expanded && (
        <div className="qn-idea-details">
          <label>
            <span>Category</span>
            <Select value={idea.category} onChange={(event) => onUpdate({ category: event.target.value })} aria-label={`Category for ${idea.text}`}>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </Select>
          </label>
          <label>
            <span>Working notes</span>
            <Textarea value={idea.notes || ''} onChange={(event) => onUpdate({ notes: event.target.value })} rows={4} placeholder="Develop this idea" />
          </label>
        </div>
      )}
    </article>
  )
}
