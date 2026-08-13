import { useState, useEffect, useRef } from 'react'
import {
  Button,
  EmptyState,
  IconButton,
  Input,
  SegmentedControl,
  Select,
  Textarea,
  buttonClasses,
} from '../ui'
import {
  Lightbulb,
  Plus,
  ThumbsUp,
  ThumbsDown,
  Star,
  Trash2,
  Edit3,
  X,
  Check,
  Grid,
  List,
  Tag,
  Sparkles,
  Shuffle,
  Copy,
  ChevronDown,
} from 'lucide-react'
import { generateId } from './noteTypes'
import { useLatestValue } from './useLatestValue'
import { useEditorDataSync } from './useEditorDataSync'
import FocusedNoteTitle from './FocusedNoteTitle'
import WorkspaceMetrics from './WorkspaceMetrics'
import Modal from '../ui/Modal'
const DEFAULT_CATEGORIES = [
  { id: 'uncategorized', name: 'Uncategorized', color: '#6b7280' },
  { id: 'feature', name: 'Feature', color: '#3b82f6' },
  { id: 'improvement', name: 'Improvement', color: '#10b981' },
  { id: 'design', name: 'Design', color: '#ec4899' },
  { id: 'research', name: 'Research', color: '#8b5cf6' },
  { id: 'marketing', name: 'Marketing', color: '#f59e0b' },
]

function IdeaCategorySelect({ idea, categories, onChange, className = '' }) {
  const category = categories.find((candidate) => candidate.id === idea.category)

  return (
    <label
      className={`qn-idea-card-category inline-flex h-7 max-w-[12rem] items-center gap-1.5 rounded-full border border-subtle bg-surface-sunken px-2 text-ui-xs font-medium text-content-muted ${className}`}
      style={{
        backgroundColor: `color-mix(in srgb, ${category?.color || '#6b7280'} 10%, var(--qn-surface-sunken))`,
      }}
    >
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: category?.color || '#6b7280' }}
        aria-hidden="true"
      />
      <select
        aria-label={`Category for ${idea.text}`}
        value={idea.category}
        onClick={(event) => event.stopPropagation()}
        onChange={(event) => onChange(event.target.value)}
        className="min-w-0 flex-1 cursor-pointer appearance-none truncate border-0 bg-transparent py-0 pl-0 pr-3 font-medium text-content outline-none"
      >
        {categories.map((candidate) => (
          <option key={candidate.id} value={candidate.id}>{candidate.name}</option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none -ml-3 h-3 w-3 shrink-0" aria-hidden="true" />
    </label>
  )
}

export default function BrainstormEditor({ data, onChange, noteTitle, onTitleChange, readOnly }) {
  const [brainstormData, setBrainstormData] = useState({
    topic: data?.topic || '',
    ideas: data?.ideas || [],
    categories: data?.categories || DEFAULT_CATEGORIES,
    viewMode: data?.viewMode || 'grid',
    sortBy: data?.sortBy || 'newest',
    selectedCategory: data?.selectedCategory || 'all',
  })

  const [newIdea, setNewIdea] = useState('')
  const [editingIdea, setEditingIdea] = useState(null)
  const [editText, setEditText] = useState('')
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryColor, setNewCategoryColor] = useState('#6b7280')
  const [expandedIdea, setExpandedIdea] = useState(null)
  const onChangeRef = useLatestValue(onChange)
  const skipChangeRef = useEditorDataSync(data, brainstormData, setBrainstormData)
  const isInitialMount = useRef(true)
  useEffect(() => {
    if (isInitialMount.current) { isInitialMount.current = false; return }
    if (skipChangeRef.current) { skipChangeRef.current = false; return }
    onChangeRef.current?.(brainstormData)
  }, [brainstormData, onChangeRef, skipChangeRef])

  const update = (field, value) => {
    setBrainstormData(prev => ({ ...prev, [field]: value }))
  }
  const addIdea = () => {
    if (!newIdea.trim()) return
    const idea = {
      id: generateId(),
      text: newIdea.trim(),
      category: 'uncategorized',
      votes: 0,
      starred: false,
      notes: '',
      createdAt: new Date().toISOString(),
    }
    update('ideas', [idea, ...brainstormData.ideas])
    setNewIdea('')
  }
  const updateIdea = (id, updates) => {
    update('ideas', brainstormData.ideas.map(idea =>
      idea.id === id ? { ...idea, ...updates } : idea
    ))
  }
  const deleteIdea = (id) => {
    update('ideas', brainstormData.ideas.filter(idea => idea.id !== id))
    if (expandedIdea === id) setExpandedIdea(null)
  }
  const duplicateIdea = (idea) => {
    const newIdea = {
      ...idea,
      id: generateId(),
      text: idea.text + ' (copy)',
      createdAt: new Date().toISOString(),
    }
    update('ideas', [newIdea, ...brainstormData.ideas])
  }
  const vote = (id, delta) => {
    update('ideas', brainstormData.ideas.map(idea =>
      idea.id === id ? { ...idea, votes: idea.votes + delta } : idea
    ))
  }
  const toggleStar = (id) => {
    update('ideas', brainstormData.ideas.map(idea =>
      idea.id === id ? { ...idea, starred: !idea.starred } : idea
    ))
  }
  const addCategory = () => {
    if (!newCategoryName.trim()) return
    const category = {
      id: generateId(),
      name: newCategoryName.trim(),
      color: newCategoryColor,
    }
    update('categories', [...brainstormData.categories, category])
    setNewCategoryName('')
    setNewCategoryColor('#6b7280')
    setShowAddCategory(false)
  }
  const deleteCategory = (id) => {
    if (id === 'uncategorized') return
    update('categories', brainstormData.categories.filter(c => c.id !== id))
    update('ideas', brainstormData.ideas.map(idea =>
      idea.category === id ? { ...idea, category: 'uncategorized' } : idea
    ))
  }
  const pickRandomIdea = () => {
    const filteredIdeas = getFilteredIdeas()
    if (filteredIdeas.length === 0) return
    const randomIndex = Math.floor(Math.random() * filteredIdeas.length)
    setExpandedIdea(filteredIdeas[randomIndex].id)
  }
  const saveEdit = () => {
    if (!editText.trim()) return
    updateIdea(editingIdea, { text: editText.trim() })
    setEditingIdea(null)
    setEditText('')
  }
  const getFilteredIdeas = () => {
    let ideas = [...brainstormData.ideas]
    if (brainstormData.selectedCategory !== 'all') {
      ideas = ideas.filter(i => i.category === brainstormData.selectedCategory)
    }
    switch (brainstormData.sortBy) {
      case 'votes':
        ideas.sort((a, b) => b.votes - a.votes)
        break
      case 'oldest':
        ideas.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
        break
      case 'starred':
        ideas.sort((a, b) => (b.starred ? 1 : 0) - (a.starred ? 1 : 0))
        break
      default:
        ideas.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    }

    return ideas
  }

  const filteredIdeas = getFilteredIdeas()
  const totalVotes = brainstormData.ideas.reduce((sum, i) => sum + i.votes, 0)
  const starredCount = brainstormData.ideas.filter(i => i.starred).length

  return (
    <div className="qn-type-editor qn-type-brainstorm flex h-full flex-col">
      <header className="qn-type-hero qn-workspace-header flex-shrink-0 border-b border-subtle">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <FocusedNoteTitle
              icon={Lightbulb}
              typeLabel="Idea workspace"
              title={noteTitle}
              fallback="Idea board"
              onChange={onTitleChange}
              readOnly={readOnly}
            />
            <Input
              type="text"
              aria-label="Brainstorm topic"
              value={brainstormData.topic}
              onChange={(e) => update('topic', e.target.value)}
              placeholder="What are you brainstorming about?"
              className="ml-12 mt-2 max-w-lg bg-surface-raised"
            />
          </div>
        </div>
        <WorkspaceMetrics
          items={[
            { label: 'Ideas', value: brainstormData.ideas.length },
            { label: 'Votes', value: totalVotes },
            { label: 'Starred', value: starredCount, tone: starredCount ? 'warning' : 'neutral' },
          ]}
        />
        <div className="mt-3 flex gap-2">
          <div className="flex-1 relative">
            <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-content-subtle" />
            <Input
              type="text"
              aria-label="New idea"
              value={newIdea}
              onChange={(e) => setNewIdea(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addIdea()}
              placeholder="Type your idea and press Enter..."
              className="h-control-lg bg-surface-raised pl-10 pr-4 text-ui-lg"
              autoFocus
            />
          </div>
          <Button onClick={addIdea} variant="primary" size="lg" icon={Plus}>
            Add Idea
          </Button>
          <IconButton
            icon={Shuffle}
            size="lg"
            variant="secondary"
            onClick={pickRandomIdea}
            disabled={filteredIdeas.length === 0}
            label="Pick a random idea"
          />
        </div>
      </header>
      <div className="qn-type-tabs qn-workspace-filterbar flex-shrink-0 flex flex-wrap items-center justify-between gap-3 p-3 border-b border-subtle">
        <div className="qn-idea-category-chips flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
          <Tag className="w-4 h-4 text-content-muted" />
          <button
            onClick={() => update('selectedCategory', 'all')}
            aria-pressed={brainstormData.selectedCategory === 'all'}
            className={`qn-filter-chip px-3 py-1 rounded-full text-sm transition-colors ${
 brainstormData.selectedCategory === 'all'
 ? 'bg-accent-soft text-accent-text'
                : 'bg-surface-sunken text-content-muted hover:bg-surface-sunken dark:hover:bg-surface-active'
            }`}
          >
            All ({brainstormData.ideas.length})
          </button>
          {brainstormData.categories.map((cat) => {
            const count = brainstormData.ideas.filter(i => i.category === cat.id).length
            return (
              <button
                key={cat.id}
                onClick={() => update('selectedCategory', cat.id)}
                aria-pressed={brainstormData.selectedCategory === cat.id}
                className={`qn-filter-chip px-3 py-1 rounded-full border text-sm text-content transition-colors flex items-center gap-2 ${
 brainstormData.selectedCategory === cat.id
 ? 'border-accent ring-2 ring-[var(--qn-accent-soft)]'
                    : 'border-transparent hover:border-strong'
                }`}
                style={{ backgroundColor: `color-mix(in srgb, ${cat.color} 12%, var(--qn-surface-raised))` }}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                {cat.name} ({count})
              </button>
            )
          })}
        </div>
        <Select
          aria-label="Filter ideas by category"
          value={brainstormData.selectedCategory}
          onChange={(event) => update('selectedCategory', event.target.value)}
          className="qn-idea-category-select min-w-0 bg-surface-raised"
        >
          <option value="all">All categories ({brainstormData.ideas.length})</option>
          {brainstormData.categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name} ({brainstormData.ideas.filter((idea) => idea.category === category.id).length})
            </option>
          ))}
        </Select>
        <Button
          variant="secondary"
          size="sm"
          icon={Tag}
          onClick={() => setShowAddCategory(true)}
          className="qn-idea-manage-categories"
        >
          Categories
        </Button>
        <div className="qn-idea-filter-tools flex items-center gap-2">
          <Select aria-label="Sort ideas" value={brainstormData.sortBy} onChange={(e) => update('sortBy', e.target.value)} className="w-auto min-w-36 bg-surface-raised">
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="votes">Most Votes</option>
            <option value="starred">Starred First</option>
          </Select>
          <SegmentedControl
            label="Idea view"
            value={brainstormData.viewMode}
            onChange={(value) => update('viewMode', value)}
            options={[
              { value: 'grid', label: <><Grid className="h-4 w-4" aria-hidden="true" /><span className="qn-sr-only">Grid</span></> },
              { value: 'list', label: <><List className="h-4 w-4" aria-hidden="true" /><span className="qn-sr-only">List</span></> },
            ]}
            size="sm"
          />
        </div>
      </div>
      <div className="qn-workspace-canvas flex-1 overflow-y-auto p-4">
        {filteredIdeas.length === 0 ? (
          <EmptyState
            icon={Lightbulb}
            title="No ideas yet"
            description="Capture the first thought above. You can categorize, expand, vote on, and refine it afterward."
          />
        ) : brainstormData.viewMode === 'grid' ? (
          /* Grid View */
          <div className="qn-idea-grid">
            {filteredIdeas.map((idea) => {
              const category = brainstormData.categories.find(c => c.id === idea.category)
              const isExpanded = expandedIdea === idea.id
              
              return (
                <article
                  key={idea.id}
                  className={`qn-domain-card qn-idea-card relative min-h-40 rounded-card border bg-surface-raised p-4 ${
 isExpanded
 ? 'border-accent shadow-md'
                      : 'border-subtle shadow-xs hover:border-strong hover:shadow-sm'
                  } ${idea.starred ? 'ring-2 ring-[var(--qn-warning-border)]' : ''}`}
                  style={{ '--qn-item-accent': category?.color || 'var(--qn-accent)' }}
                >
                  <IdeaCategorySelect
                    idea={idea}
                    categories={brainstormData.categories}
                    onChange={(categoryId) => updateIdea(idea.id, { category: categoryId })}
                    className="absolute left-3 top-3"
                  />
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleStar(idea.id) }}
                    aria-label={idea.starred ? `Unstar ${idea.text}` : `Star ${idea.text}`}
                    className={`qn-card-action qn-square-control absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-control ${
 idea.starred ? 'bg-warning-soft text-warning-text' : 'text-content-subtle hover:bg-surface-hover hover:text-warning-text'
 }`}
                  >
                    <Star className={`w-5 h-5 ${idea.starred ? 'fill-current' : ''}`} />
                  </button>
                  <div className="mt-6 mb-4">
                    {editingIdea === idea.id ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          aria-label={`Edit ${idea.text}`}
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                          className="flex-1 rounded-control border border-strong bg-surface-raised px-2 py-1 text-content outline-none focus:border-accent"
                          onClick={(e) => e.stopPropagation()}
                          autoFocus
                        />
                        <button
                          onClick={(e) => { e.stopPropagation(); saveEdit() }}
                          aria-label={`Save changes to ${idea.text}`}
                          className="qn-square-control flex h-8 w-8 items-center justify-center rounded-control text-success-text hover:bg-success-soft"
                        >
                          <Check className="w-5 h-5" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditingIdea(null) }}
                          aria-label={`Cancel editing ${idea.text}`}
                          className="qn-square-control flex h-8 w-8 items-center justify-center rounded-control text-content-muted hover:bg-surface-hover"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setExpandedIdea(isExpanded ? null : idea.id)}
                        aria-expanded={isExpanded}
                        className="w-full text-left text-ui-lg font-semibold leading-snug text-content hover:text-accent-text"
                      >
                        {idea.text}
                      </button>
                    )}
                  </div>
                  <div className="mt-auto flex items-center justify-between border-t border-subtle pt-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); vote(idea.id, -1) }}
                        aria-label={`Downvote ${idea.text}`}
                        className="qn-square-control flex h-8 w-8 items-center justify-center rounded-control text-content-muted hover:bg-surface-hover"
                      >
                        <ThumbsDown className="w-4 h-4" />
                      </button>
                      <span className={`font-bold ${
 idea.votes > 0 ? 'text-success-text' : idea.votes < 0 ? 'text-danger-text' : 'text-content-muted'
 }`}>
                        {idea.votes}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); vote(idea.id, 1) }}
                        aria-label={`Upvote ${idea.text}`}
                        className="qn-square-control flex h-8 w-8 items-center justify-center rounded-control text-content-muted hover:bg-surface-hover"
                      >
                        <ThumbsUp className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditingIdea(idea.id)
                          setEditText(idea.text)
                        }}
                        aria-label={`Edit ${idea.text}`}
                        className="qn-square-control flex h-8 w-8 items-center justify-center rounded-control text-content-muted hover:bg-surface-hover"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); duplicateIdea(idea) }}
                        aria-label={`Duplicate ${idea.text}`}
                        className="qn-square-control flex h-8 w-8 items-center justify-center rounded-control text-content-muted hover:bg-surface-hover"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteIdea(idea.id) }}
                        aria-label={`Delete ${idea.text}`}
                        className="qn-square-control flex h-8 w-8 items-center justify-center rounded-control text-danger-text hover:bg-danger-soft"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-subtle" onClick={(e) => e.stopPropagation()}>
                      <div>
                        <label className="text-xs text-content-muted mb-1 block">Notes</label>
                        <Textarea
                          value={idea.notes || ''}
                          onChange={(e) => updateIdea(idea.id, { notes: e.target.value })}
                          placeholder="Add notes about this idea..."
                          className="bg-surface-raised"
                          rows={3}
                        />
                      </div>
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        ) : (
          /* List View */
          <div className="max-w-3xl mx-auto space-y-2">
            {filteredIdeas.map((idea) => {
              const category = brainstormData.categories.find(c => c.id === idea.category)
              const isExpanded = expandedIdea === idea.id

              return (
                <article
                  key={idea.id}
                  className={`qn-domain-card qn-idea-card rounded-card border bg-surface-raised p-4 shadow-xs ${
 isExpanded ? 'border-accent shadow-md' : 'border-subtle hover:border-strong hover:shadow-sm'
 } ${idea.starred ? 'ring-2 ring-[var(--qn-warning-border)]' : ''}`}
                  style={{ '--qn-item-accent': category?.color || 'var(--qn-accent)' }}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col items-center gap-1">
                      <button
                        onClick={() => vote(idea.id, 1)}
                        aria-label={`Upvote ${idea.text}`}
                        className="p-1 rounded hover:bg-surface-sunken dark:hover:bg-surface-sunken text-content-muted hover:text-accent-text"
                      >
                        <ThumbsUp className="w-4 h-4" />
                      </button>
                      <span className={`font-bold text-lg ${
 idea.votes > 0 ? 'text-success-text' : idea.votes < 0 ? 'text-danger-text' : 'text-content-muted'
 }`}>
                        {idea.votes}
                      </span>
                      <button
                        onClick={() => vote(idea.id, -1)}
                        aria-label={`Downvote ${idea.text}`}
                        className="p-1 rounded hover:bg-surface-sunken dark:hover:bg-surface-sunken text-content-muted hover:text-accent-text"
                      >
                        <ThumbsDown className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start gap-2">
                        <IdeaCategorySelect
                          idea={idea}
                          categories={brainstormData.categories}
                          onChange={(categoryId) => updateIdea(idea.id, { category: categoryId })}
                          className="shrink-0"
                        />
                        {editingIdea === idea.id ? (
                          <div className="flex-1 flex gap-2">
                            <input
                              type="text"
                              aria-label={`Edit ${idea.text}`}
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                              className="flex-1 rounded-control border border-strong bg-surface-raised px-2 py-1 text-content outline-none focus:border-accent"
                              autoFocus
                            />
                            <button onClick={saveEdit} aria-label={`Save changes to ${idea.text}`} className="text-success-text">
                              <Check className="w-5 h-5" />
                            </button>
                            <button onClick={() => setEditingIdea(null)} aria-label={`Cancel editing ${idea.text}`} className="text-content-muted">
                              <X className="w-5 h-5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            aria-expanded={isExpanded}
                            className="flex-1 text-left font-semibold text-content hover:text-accent-text"
                            onClick={() => setExpandedIdea(isExpanded ? null : idea.id)}
                          >
                            {idea.text}
                          </button>
                        )}
                      </div>
                      {idea.notes && !isExpanded && (
                        <p className="text-sm text-content-muted mt-1 truncate">{idea.notes}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => toggleStar(idea.id)}
                        aria-label={idea.starred ? `Unstar ${idea.text}` : `Star ${idea.text}`}
                        className={`p-2 rounded ${
 idea.starred ? 'text-warning-text' : 'text-content-subtle hover:text-warning-text'
 }`}
                      >
                        <Star className={`w-5 h-5 ${idea.starred ? 'fill-current' : ''}`} />
                      </button>
                      <button
                        onClick={() => {
                          setEditingIdea(idea.id)
                          setEditText(idea.text)
                        }}
                        aria-label={`Edit ${idea.text}`}
                        className="p-2 rounded text-content-subtle hover:text-content-muted dark:hover:text-content-subtle"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => duplicateIdea(idea)}
                        aria-label={`Duplicate ${idea.text}`}
                        className="p-2 rounded text-content-subtle hover:text-content-muted dark:hover:text-content-subtle"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteIdea(idea.id)}
                        aria-label={`Delete ${idea.text}`}
                        className="p-2 rounded text-content-subtle hover:text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="mt-4 ml-14 border-t border-subtle pt-4">
                      <div>
                        <label className="text-xs text-content-muted mb-1 block">Notes</label>
                        <Textarea
                          value={idea.notes || ''}
                          onChange={(e) => updateIdea(idea.id, { notes: e.target.value })}
                          placeholder="Add notes..."
                          className="bg-surface-raised"
                          rows={2}
                        />
                      </div>
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </div>
      <Modal
        open={showAddCategory}
        onClose={() => setShowAddCategory(false)}
        title="Manage categories"
        description="Add a color-coded category or remove one you no longer need."
        size="md"
        footer={(
          <>
            <button
              onClick={() => setShowAddCategory(false)}
              className="px-4 py-2 rounded-lg text-content-muted hover:bg-surface-hover"
            >
              Done
            </button>
            <button
              onClick={addCategory}
              disabled={!newCategoryName.trim()}
              className={buttonClasses({ variant: 'primary' })}
            >
              Add category
            </button>
          </>
        )}
      >
            <div className="space-y-5">
              <div>
                <label className="text-sm text-content-muted mb-1 block">Name</label>
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Category name"
                  className="w-full px-4 py-2 rounded-lg bg-surface-sunken border border-subtle outline-none text-content"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-sm text-content-muted mb-1 block">Color</label>
                <div className="flex gap-2 flex-wrap">
                  {['#6b7280', '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'].map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewCategoryColor(color)}
                      aria-label={`Use category color ${color}`}
                      aria-pressed={newCategoryColor === color}
                      className="qn-square-control flex h-11 w-11 items-center justify-center rounded-full"
                    >
                      <span
                        className={`h-8 w-8 rounded-full ${
                          newCategoryColor === color ? 'ring-2 ring-purple-500 ring-offset-2' : ''
                        }`}
                        style={{ backgroundColor: color }}
                        aria-hidden="true"
                      />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="mb-2 text-sm font-medium text-content-muted">Current categories</h4>
                <div className="space-y-2">
                  {brainstormData.categories.map((category) => (
                    <div key={category.id} className="flex items-center gap-3 rounded-lg border border-subtle px-3 py-2 ">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: category.color }} aria-hidden="true" />
                      <span className="flex-1 text-sm text-content dark:text-content-subtle">{category.name}</span>
                      {category.id !== 'uncategorized' && (
                        <button
                          type="button"
                          onClick={() => deleteCategory(category.id)}
                          aria-label={`Delete ${category.name} category`}
                          className="rounded p-1 text-content-muted hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
      </Modal>
    </div>
  )
}
