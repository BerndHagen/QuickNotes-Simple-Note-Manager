import { useState, useEffect, useRef } from 'react'
import { buttonClasses } from '../ui'
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
  Copy
} from 'lucide-react'
import { generateId } from './noteTypes'
import { useLatestValue } from './useLatestValue'
import { useEditorDataSync } from './useEditorDataSync'
import FocusedNoteTitle from './FocusedNoteTitle'
import Modal from '../ui/Modal'
const DEFAULT_CATEGORIES = [
  { id: 'uncategorized', name: 'Uncategorized', color: '#6b7280' },
  { id: 'feature', name: 'Feature', color: '#3b82f6' },
  { id: 'improvement', name: 'Improvement', color: '#10b981' },
  { id: 'design', name: 'Design', color: '#ec4899' },
  { id: 'research', name: 'Research', color: '#8b5cf6' },
  { id: 'marketing', name: 'Marketing', color: '#f59e0b' },
]

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
    <div className="qn-type-editor qn-type-brainstorm flex flex-col h-full bg-surface-raised">
      <div className="qn-type-hero flex-shrink-0 p-4 border-b border-subtle bg-[#e5eaf0] dark:bg-surface-raised">
        <div className="flex items-center justify-between mb-4">
          <div className="flex-1">
            <FocusedNoteTitle
              icon={Lightbulb}
              typeLabel="Idea workspace"
              title={noteTitle}
              fallback="Idea board"
              onChange={onTitleChange}
              readOnly={readOnly}
            />
            <input
              type="text"
              aria-label="Brainstorm topic"
              value={brainstormData.topic}
              onChange={(e) => update('topic', e.target.value)}
              placeholder="What are you brainstorming about?"
              className="w-full max-w-md px-4 py-2 rounded-lg bg-white dark:bg-surface-sunken text-content placeholder:text-content-subtle dark:placeholder:text-content-subtle outline-none border border-subtle "
            />
          </div>
          <div className="flex gap-6 text-content">
            <div className="text-center">
              <div className="text-3xl font-bold">{brainstormData.ideas.length}</div>
              <div className="text-content-muted text-sm">Ideas</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold">{totalVotes}</div>
              <div className="text-content-muted text-sm">Total Votes</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold">{starredCount}</div>
              <div className="text-content-muted text-sm">Starred</div>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-content-subtle" />
            <input
              type="text"
              aria-label="New idea"
              value={newIdea}
              onChange={(e) => setNewIdea(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addIdea()}
              placeholder="Type your idea and press Enter..."
              className="w-full pl-10 pr-4 py-3 rounded-lg bg-white dark:bg-surface-sunken text-content placeholder:text-content-subtle dark:placeholder:text-content-subtle outline-none text-lg border border-subtle "
              autoFocus
            />
          </div>
          <button
            onClick={addIdea}
            className={buttonClasses({ variant: 'primary' })}
          >
            <Plus className="w-5 h-5" />
            Add Idea
          </button>
          <button
            onClick={pickRandomIdea}
            disabled={filteredIdeas.length === 0}
            aria-label="Pick a random idea"
            className="px-4 py-3 rounded-lg bg-surface-sunken dark:bg-surface-sunken text-content-muted hover:bg-surface-active dark:hover:bg-surface-active transition-colors disabled:opacity-50"
            title="Pick random idea"
          >
            <Shuffle className="w-5 h-5" />
          </button>
        </div>
      </div>
      <div className="qn-type-tabs flex-shrink-0 flex items-center justify-between gap-4 p-3 border-b border-subtle bg-surface-sunken">
        <div className="flex items-center gap-2 flex-wrap">
          <Tag className="w-4 h-4 text-content-muted" />
          <button
            onClick={() => update('selectedCategory', 'all')}
            aria-pressed={brainstormData.selectedCategory === 'all'}
            className={`px-3 py-1 rounded-full text-sm transition-colors ${
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
                className={`px-3 py-1 rounded-full text-sm text-content transition-colors flex items-center gap-2 ${
 brainstormData.selectedCategory === cat.id
 ? 'ring-2 ring-purple-500'
                    : 'hover:bg-surface-sunken dark:hover:bg-surface-active'
                }`}
                style={{ backgroundColor: cat.color + '20' }}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                {cat.name} ({count})
              </button>
            )
          })}
          <button
            onClick={() => setShowAddCategory(true)}
            aria-label="Add idea category"
            className="p-1 rounded-full text-content-muted hover:bg-surface-sunken dark:hover:bg-surface-sunken"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <select
            aria-label="Sort ideas"
            value={brainstormData.sortBy}
            onChange={(e) => update('sortBy', e.target.value)}
            className="px-3 py-1 rounded-lg bg-surface-sunken border border-subtle text-content-muted outline-none text-sm"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="votes">Most Votes</option>
            <option value="starred">Starred First</option>
          </select>
          <div className="flex border border-subtle rounded-lg overflow-hidden">
            <button
              onClick={() => update('viewMode', 'grid')}
              aria-label="Grid view"
              aria-pressed={brainstormData.viewMode === 'grid'}
              className={`p-2 ${
 brainstormData.viewMode === 'grid'
 ? 'bg-accent-soft text-accent-text'
                  : 'text-content-muted hover:bg-surface-hover'
              }`}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => update('viewMode', 'list')}
              aria-label="List view"
              aria-pressed={brainstormData.viewMode === 'list'}
              className={`p-2 ${
 brainstormData.viewMode === 'list'
 ? 'bg-accent-soft text-accent-text'
                  : 'text-content-muted hover:bg-surface-hover'
              }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {filteredIdeas.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-content-subtle">
            <Lightbulb className="w-16 h-16 mb-4 opacity-50" />
            <p className="text-lg">No ideas yet. Start brainstorming!</p>
            <p className="text-sm mt-1">Type your first idea above and press Enter</p>
          </div>
        ) : brainstormData.viewMode === 'grid' ? (
          /* Grid View */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredIdeas.map((idea) => {
              const category = brainstormData.categories.find(c => c.id === idea.category)
              const isExpanded = expandedIdea === idea.id
              
              return (
                <div
                  key={idea.id}
                  className={`relative p-4 rounded-xl bg-surface-sunken border-2 transition-all ${
 isExpanded
 ? 'border-accent shadow-lg scale-105'
                      : 'border-transparent hover:border-subtle dark:hover:border-subtle'
                  } ${idea.starred ? 'ring-2 ring-yellow-400' : ''}`}
                >
                  <div
                    className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-xs"
                    style={{ backgroundColor: category?.color + '20', color: category?.color }}
                  >
                    {category?.name}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleStar(idea.id) }}
                    aria-label={idea.starred ? `Unstar ${idea.text}` : `Star ${idea.text}`}
                    className={`absolute top-2 right-2 p-1 rounded ${
 idea.starred ? 'text-accent-text' : 'text-content-subtle hover:text-accent-text'
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
                          className="flex-1 px-2 py-1 rounded bg-white dark:bg-surface-sunken outline-none text-content"
                          onClick={(e) => e.stopPropagation()}
                          autoFocus
                        />
                        <button
                          onClick={(e) => { e.stopPropagation(); saveEdit() }}
                          aria-label={`Save changes to ${idea.text}`}
                          className="text-green-600"
                        >
                          <Check className="w-5 h-5" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditingIdea(null) }}
                          aria-label={`Cancel editing ${idea.text}`}
                          className="text-content-muted"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setExpandedIdea(isExpanded ? null : idea.id)}
                        aria-expanded={isExpanded}
                        className="w-full text-left font-medium text-content hover:text-accent-text dark:text-white dark:hover:text-purple-300"
                      >
                        {idea.text}
                      </button>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); vote(idea.id, -1) }}
                        aria-label={`Downvote ${idea.text}`}
                        className="p-1 rounded hover:bg-surface-sunken dark:hover:bg-surface-sunken text-content-muted"
                      >
                        <ThumbsDown className="w-4 h-4" />
                      </button>
                      <span className={`font-bold ${
 idea.votes > 0 ? 'text-green-700 dark:text-green-300' : idea.votes < 0 ? 'text-red-700 dark:text-red-300' : 'text-content-muted'
 }`}>
                        {idea.votes}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); vote(idea.id, 1) }}
                        aria-label={`Upvote ${idea.text}`}
                        className="p-1 rounded hover:bg-surface-sunken dark:hover:bg-surface-sunken text-content-muted"
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
                        className="p-1 rounded hover:bg-surface-sunken dark:hover:bg-surface-sunken text-content-muted"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); duplicateIdea(idea) }}
                        aria-label={`Duplicate ${idea.text}`}
                        className="p-1 rounded hover:bg-surface-sunken dark:hover:bg-surface-sunken text-content-muted"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteIdea(idea.id) }}
                        aria-label={`Delete ${idea.text}`}
                        className="p-1 rounded hover:bg-surface-sunken dark:hover:bg-surface-sunken text-red-400 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-subtle" onClick={(e) => e.stopPropagation()}>
                      <div className="mb-3">
                        <label className="text-xs text-content-muted mb-1 block">Category</label>
                        <select
                          value={idea.category}
                          onChange={(e) => updateIdea(idea.id, { category: e.target.value })}
                          className="w-full px-2 py-1 rounded bg-white dark:bg-surface-sunken border border-subtle text-content outline-none text-sm"
                        >
                          {brainstormData.categories.map((cat) => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-content-muted mb-1 block">Notes</label>
                        <textarea
                          value={idea.notes || ''}
                          onChange={(e) => updateIdea(idea.id, { notes: e.target.value })}
                          placeholder="Add notes about this idea..."
                          className="w-full px-2 py-1 rounded bg-white dark:bg-surface-sunken border border-subtle text-content outline-none text-sm resize-none"
                          rows={3}
                        />
                      </div>
                    </div>
                  )}
                </div>
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
                <div
                  key={idea.id}
                  className={`p-4 rounded-xl bg-surface-sunken border-2 transition-all ${
 isExpanded ? 'border-accent' : 'border-transparent'
 } ${idea.starred ? 'ring-2 ring-yellow-400' : ''}`}
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
 idea.votes > 0 ? 'text-green-700 dark:text-green-300' : idea.votes < 0 ? 'text-red-700 dark:text-red-300' : 'text-content-muted'
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
                        <span
                          className="px-2 py-0.5 rounded-full text-xs flex-shrink-0"
                          style={{ backgroundColor: category?.color + '20', color: category?.color }}
                        >
                          {category?.name}
                        </span>
                        {editingIdea === idea.id ? (
                          <div className="flex-1 flex gap-2">
                            <input
                              type="text"
                              aria-label={`Edit ${idea.text}`}
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                              className="flex-1 px-2 py-1 rounded bg-white dark:bg-surface-sunken outline-none text-content"
                              autoFocus
                            />
                            <button onClick={saveEdit} aria-label={`Save changes to ${idea.text}`} className="text-green-600">
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
                            className="text-left text-content hover:text-accent-text dark:text-white dark:hover:text-purple-300 flex-1"
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
 idea.starred ? 'text-accent-text' : 'text-content-subtle hover:text-accent-text'
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
                    <div className="mt-4 ml-14 pt-4 border-t border-subtle grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-content-muted mb-1 block">Category</label>
                        <select
                          value={idea.category}
                          onChange={(e) => updateIdea(idea.id, { category: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg bg-white dark:bg-surface-sunken border border-subtle text-content outline-none"
                        >
                          {brainstormData.categories.map((cat) => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-content-muted mb-1 block">Notes</label>
                        <textarea
                          value={idea.notes || ''}
                          onChange={(e) => updateIdea(idea.id, { notes: e.target.value })}
                          placeholder="Add notes..."
                          className="w-full px-3 py-2 rounded-lg bg-white dark:bg-surface-sunken border border-subtle text-content outline-none resize-none"
                          rows={2}
                        />
                      </div>
                    </div>
                  )}
                </div>
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
                      onClick={() => setNewCategoryColor(color)}
                      aria-label={`Use category color ${color}`}
                      aria-pressed={newCategoryColor === color}
                      className={`w-8 h-8 rounded-full ${newCategoryColor === color ? 'ring-2 ring-offset-2 ring-purple-500' : ''}`}
                      style={{ backgroundColor: color }}
                    />
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
