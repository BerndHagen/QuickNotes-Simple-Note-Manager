import React, { useState, useEffect, useRef } from 'react'
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
const DEFAULT_CATEGORIES = [
  { id: 'uncategorized', name: 'Uncategorized', color: '#6b7280' },
  { id: 'feature', name: 'Feature', color: '#3b82f6' },
  { id: 'improvement', name: 'Improvement', color: '#10b981' },
  { id: 'design', name: 'Design', color: '#ec4899' },
  { id: 'research', name: 'Research', color: '#8b5cf6' },
  { id: 'marketing', name: 'Marketing', color: '#f59e0b' },
]

export default function BrainstormEditor({ data, onChange, noteTitle }) {
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
  const [ideaNotes, setIdeaNotes] = useState('')
  const isInitialMount = useRef(true)
  useEffect(() => {
    if (isInitialMount.current) { isInitialMount.current = false; return }
    onChange?.(brainstormData)
  }, [brainstormData])

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
  const saveIdeaNotes = (id) => {
    updateIdea(id, { notes: ideaNotes })
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
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      <div className="flex-shrink-0 p-4 border-b border-gray-200 dark:border-gray-700 bg-[#e5eaf0] dark:bg-gray-800">
        <div className="flex items-center justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 text-gray-900 dark:text-white mb-2">
              <Lightbulb className="w-7 h-7" />
              <h1 className="text-2xl font-bold">{noteTitle || 'Brainstorm Session'}</h1>
            </div>
            <input
              type="text"
              value={brainstormData.topic}
              onChange={(e) => update('topic', e.target.value)}
              placeholder="What are you brainstorming about?"
              className="w-full max-w-md px-4 py-2 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 outline-none border border-gray-300 dark:border-gray-600"
            />
          </div>
          <div className="flex gap-6 text-gray-900 dark:text-white">
            <div className="text-center">
              <div className="text-3xl font-bold">{brainstormData.ideas.length}</div>
              <div className="text-gray-500 dark:text-gray-400 text-sm">Ideas</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold">{totalVotes}</div>
              <div className="text-gray-500 dark:text-gray-400 text-sm">Total Votes</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold">{starredCount}</div>
              <div className="text-gray-500 dark:text-gray-400 text-sm">Starred</div>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={newIdea}
              onChange={(e) => setNewIdea(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addIdea()}
              placeholder="Type your idea and press Enter..."
              className="w-full pl-10 pr-4 py-3 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 outline-none text-lg border border-gray-300 dark:border-gray-600"
              autoFocus
            />
          </div>
          <button
            onClick={addIdea}
            className="px-6 py-3 rounded-lg bg-emerald-500 text-white font-semibold hover:bg-emerald-600 transition-colors flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Add Idea
          </button>
          <button
            onClick={pickRandomIdea}
            disabled={filteredIdeas.length === 0}
            className="px-4 py-3 rounded-lg bg-gray-200/50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300/50 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
            title="Pick random idea"
          >
            <Shuffle className="w-5 h-5" />
          </button>
        </div>
      </div>
      <div className="flex-shrink-0 flex items-center justify-between gap-4 p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <div className="flex items-center gap-2 flex-wrap">
          <Tag className="w-4 h-4 text-gray-500" />
          <button
            onClick={() => update('selectedCategory', 'all')}
            className={`px-3 py-1 rounded-full text-sm transition-colors ${
              brainstormData.selectedCategory === 'all'
                ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
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
                className={`px-3 py-1 rounded-full text-sm transition-colors flex items-center gap-2 ${
                  brainstormData.selectedCategory === cat.id
                    ? 'ring-2 ring-purple-500'
                    : 'hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
                style={{ backgroundColor: cat.color + '20', color: cat.color }}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                {cat.name} ({count})
              </button>
            )
          })}
          <button
            onClick={() => setShowAddCategory(true)}
            className="p-1 rounded-full text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={brainstormData.sortBy}
            onChange={(e) => update('sortBy', e.target.value)}
            className="px-3 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 outline-none text-sm"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="votes">Most Votes</option>
            <option value="starred">Starred First</option>
          </select>
          <div className="flex border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
            <button
              onClick={() => update('viewMode', 'grid')}
              className={`p-2 ${
                brainstormData.viewMode === 'grid'
                  ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600'
                  : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => update('viewMode', 'list')}
              className={`p-2 ${
                brainstormData.viewMode === 'list'
                  ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600'
                  : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {filteredIdeas.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
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
                  className={`relative p-4 rounded-xl bg-gray-50 dark:bg-gray-800 border-2 transition-all cursor-pointer ${
                    isExpanded
                      ? 'border-purple-500 shadow-lg scale-105'
                      : 'border-transparent hover:border-gray-200 dark:hover:border-gray-700'
                  } ${idea.starred ? 'ring-2 ring-yellow-400' : ''}`}
                  onClick={() => setExpandedIdea(isExpanded ? null : idea.id)}
                >
                  <div
                    className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-xs"
                    style={{ backgroundColor: category?.color + '20', color: category?.color }}
                  >
                    {category?.name}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleStar(idea.id) }}
                    className={`absolute top-2 right-2 p-1 rounded ${
                      idea.starred ? 'text-yellow-500' : 'text-gray-400 hover:text-yellow-500'
                    }`}
                  >
                    <Star className={`w-5 h-5 ${idea.starred ? 'fill-current' : ''}`} />
                  </button>
                  <div className="mt-6 mb-4">
                    {editingIdea === idea.id ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                          className="flex-1 px-2 py-1 rounded bg-white dark:bg-gray-700 outline-none text-gray-900 dark:text-white"
                          onClick={(e) => e.stopPropagation()}
                          autoFocus
                        />
                        <button onClick={(e) => { e.stopPropagation(); saveEdit() }} className="text-green-500">
                          <Check className="w-5 h-5" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); setEditingIdea(null) }} className="text-gray-400">
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    ) : (
                      <p className="text-gray-900 dark:text-white font-medium">{idea.text}</p>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); vote(idea.id, -1) }}
                        className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500"
                      >
                        <ThumbsDown className="w-4 h-4" />
                      </button>
                      <span className={`font-bold ${
                        idea.votes > 0 ? 'text-green-500' : idea.votes < 0 ? 'text-red-500' : 'text-gray-500'
                      }`}>
                        {idea.votes}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); vote(idea.id, 1) }}
                        className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500"
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
                        className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); duplicateIdea(idea) }}
                        className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteIdea(idea.id) }}
                        className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-red-400 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
                      <div className="mb-3">
                        <label className="text-xs text-gray-500 mb-1 block">Category</label>
                        <select
                          value={idea.category}
                          onChange={(e) => updateIdea(idea.id, { category: e.target.value })}
                          className="w-full px-2 py-1 rounded bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white outline-none text-sm"
                        >
                          {brainstormData.categories.map((cat) => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Notes</label>
                        <textarea
                          value={idea.notes || ''}
                          onChange={(e) => updateIdea(idea.id, { notes: e.target.value })}
                          placeholder="Add notes about this idea..."
                          className="w-full px-2 py-1 rounded bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white outline-none text-sm resize-none"
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
                  className={`p-4 rounded-xl bg-gray-50 dark:bg-gray-800 border-2 transition-all ${
                    isExpanded ? 'border-purple-500' : 'border-transparent'
                  } ${idea.starred ? 'ring-2 ring-yellow-400' : ''}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col items-center gap-1">
                      <button
                        onClick={() => vote(idea.id, 1)}
                        className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 hover:text-purple-500"
                      >
                        <ThumbsUp className="w-4 h-4" />
                      </button>
                      <span className={`font-bold text-lg ${
                        idea.votes > 0 ? 'text-green-500' : idea.votes < 0 ? 'text-red-500' : 'text-gray-500'
                      }`}>
                        {idea.votes}
                      </span>
                      <button
                        onClick={() => vote(idea.id, -1)}
                        className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 hover:text-purple-500"
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
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                              className="flex-1 px-2 py-1 rounded bg-white dark:bg-gray-700 outline-none text-gray-900 dark:text-white"
                              autoFocus
                            />
                            <button onClick={saveEdit} className="text-green-500">
                              <Check className="w-5 h-5" />
                            </button>
                            <button onClick={() => setEditingIdea(null)} className="text-gray-400">
                              <X className="w-5 h-5" />
                            </button>
                          </div>
                        ) : (
                          <p
                            className="text-gray-900 dark:text-white cursor-pointer flex-1"
                            onClick={() => setExpandedIdea(isExpanded ? null : idea.id)}
                          >
                            {idea.text}
                          </p>
                        )}
                      </div>
                      {idea.notes && !isExpanded && (
                        <p className="text-sm text-gray-500 mt-1 truncate">{idea.notes}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => toggleStar(idea.id)}
                        className={`p-2 rounded ${
                          idea.starred ? 'text-yellow-500' : 'text-gray-400 hover:text-yellow-500'
                        }`}
                      >
                        <Star className={`w-5 h-5 ${idea.starred ? 'fill-current' : ''}`} />
                      </button>
                      <button
                        onClick={() => {
                          setEditingIdea(idea.id)
                          setEditText(idea.text)
                        }}
                        className="p-2 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => duplicateIdea(idea)}
                        className="p-2 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteIdea(idea.id)}
                        className="p-2 rounded text-gray-400 hover:text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="mt-4 ml-14 pt-4 border-t border-gray-200 dark:border-gray-700 grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Category</label>
                        <select
                          value={idea.category}
                          onChange={(e) => updateIdea(idea.id, { category: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white outline-none"
                        >
                          {brainstormData.categories.map((cat) => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Notes</label>
                        <textarea
                          value={idea.notes || ''}
                          onChange={(e) => updateIdea(idea.id, { notes: e.target.value })}
                          placeholder="Add notes..."
                          className="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white outline-none resize-none"
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
      {showAddCategory && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 modal-backdrop-animate" onClick={() => setShowAddCategory(false)}>
          <div className="modal-animate bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-[#cbd1db] dark:border-gray-700 p-6 w-full max-w-md m-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Add Category</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-600 dark:text-gray-400 mb-1 block">Name</label>
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Category name"
                  className="w-full px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 outline-none text-gray-900 dark:text-white"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-sm text-gray-600 dark:text-gray-400 mb-1 block">Color</label>
                <div className="flex gap-2 flex-wrap">
                  {['#6b7280', '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'].map((color) => (
                    <button
                      key={color}
                      onClick={() => setNewCategoryColor(color)}
                      className={`w-8 h-8 rounded-full ${newCategoryColor === color ? 'ring-2 ring-offset-2 ring-purple-500' : ''}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowAddCategory(false)}
                  className="px-4 py-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={addCategory}
                  className="px-4 py-2 rounded-lg bg-purple-500 text-white hover:bg-purple-600"
                >
                  Add Category
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
