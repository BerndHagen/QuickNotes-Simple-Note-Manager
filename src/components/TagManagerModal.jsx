import { useEffect, useState } from 'react'
import { buttonClasses } from './ui'
import { X, Tag, Trash2, Edit2, Check, Plus, Hash } from 'lucide-react'
import { useNotesStore, useUIStore } from '../store'
import { useTranslation } from '../lib/useTranslation'
import LegacyDialog from './ui/LegacyDialog'
import { MAX_TAG_NAME_LENGTH } from '../lib/dataValidation'
import toast from 'react-hot-toast'

const TAG_COLORS = [
  // Reds
  '#fca5a5', '#f87171', '#ef4444', '#dc2626',
  // Rose
  '#fda4af', '#f43f5e', '#e11d48',
  // Oranges
  '#fdba74', '#f97316', '#ea580c',
  // Amber
  '#fcd34d', '#f59e0b', '#d97706',
  // Yellow
  '#fde047', '#eab308',
  // Lime
  '#bef264', '#84cc16', '#65a30d',
  // Green
  '#86efac', '#22c55e', '#16a34a',
  // Emerald
  '#6ee7b7', '#10b981', '#059669',
  // Teal
  '#5eead4', '#14b8a6', '#0d9488',
  // Cyan
  '#67e8f9', '#06b6d4', '#0891b2',
  // Sky
  '#7dd3fc', '#0ea5e9',
  // Blue
  '#93c5fd', '#3b82f6', '#2563eb',
  // Indigo
  '#a5b4fc', '#6366f1', '#4f46e5',
  // Violet
  '#c4b5fd', '#8b5cf6', '#7c3aed',
  // Purple
  '#d8b4fe', '#a855f7', '#9333ea',
  // Fuchsia
  '#e879f9', '#d946ef',
  // Pink
  '#f9a8d4', '#ec4899', '#db2777',
  // Slate
  '#94a3b8', '#64748b', '#475569',
  // Gray
  '#9ca3af', '#4b5563',
]

function handleColorKeyDown(event, index, onChange) {
  let nextIndex
  if (event.key === 'Home') nextIndex = 0
  else if (event.key === 'End') nextIndex = TAG_COLORS.length - 1
  else if (['ArrowRight', 'ArrowDown'].includes(event.key)) nextIndex = (index + 1) % TAG_COLORS.length
  else if (['ArrowLeft', 'ArrowUp'].includes(event.key)) nextIndex = (index - 1 + TAG_COLORS.length) % TAG_COLORS.length
  else return

  event.preventDefault()
  onChange(TAG_COLORS[nextIndex])
  event.currentTarget.parentElement?.querySelectorAll('[role="radio"]')[nextIndex]?.focus()
}

function TagColourChoice({ color, selected, index, onChange }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={`Colour ${color}`}
      title={color}
      tabIndex={selected ? 0 : -1}
      onClick={() => onChange(color)}
      onKeyDown={(event) => handleColorKeyDown(event, index, onChange)}
      className="qn-square-control flex h-11 w-11 items-center justify-center rounded-full transition-transform hover:scale-105"
    >
      <span
        className={`h-6 w-6 rounded-full ${
          selected ? 'ring-2 ring-gray-400 ring-offset-2 dark:ring-gray-500' : ''
        }`}
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
    </button>
  )
}

export default function TagManagerModal() {
  const { t } = useTranslation()
  const { tagManagerOpen, setTagManagerOpen } = useUIStore()
  const { tags, notes, deleteTag, updateTag, createTag } = useNotesStore()
  
  const [editingTagId, setEditingTagId] = useState(null)
  const [editingName, setEditingName] = useState('')
  const [editingColor, setEditingColor] = useState('')
  const [showNewTag, setShowNewTag] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState('#3b82f6')
  const [deleteConfirmId, setDeleteConfirmId] = useState(null)
  const managedTags = Array.isArray(tags)
    ? tags.filter((tag) => tag?.id && typeof tag.name === 'string')
    : []
  const availableNotes = Array.isArray(notes) ? notes.filter(Boolean) : []

  useEffect(() => {
    if (!tagManagerOpen) return
    setEditingTagId(null)
    setEditingName('')
    setEditingColor('')
    setShowNewTag(false)
    setNewTagName('')
    setNewTagColor('#3b82f6')
    setDeleteConfirmId(null)
  }, [tagManagerOpen])

  if (!tagManagerOpen) return null

  const getNotesCountForTag = (tagName) => {
    return availableNotes.filter(n => n.tags?.includes(tagName) && !n.deleted).length
  }

  const handleStartEdit = (tag) => {
    setEditingTagId(tag.id)
    setEditingName(String(tag.name || ''))
    setEditingColor(TAG_COLORS.includes(tag.color) ? tag.color : '#3b82f6')
  }

  const handleSaveEdit = () => {
    if (editingName.trim() && editingTagId) {
      try {
        updateTag(editingTagId, {
          name: editingName,
          color: editingColor,
        })
        setEditingTagId(null)
        setEditingName('')
        setEditingColor('')
      } catch (error) {
        toast.error(error.message)
      }
    }
  }

  const handleCancelEdit = () => {
    setEditingTagId(null)
    setEditingName('')
    setEditingColor('')
  }

  const handleDeleteTag = (tagId) => {
    try {
      deleteTag(tagId)
      setDeleteConfirmId(null)
    } catch (error) {
      toast.error(error?.message || 'The tag could not be deleted')
    }
  }

  const handleCreateTag = () => {
    if (newTagName.trim()) {
      const alreadyExists = managedTags.some(
        (tag) => String(tag?.name || '').toLowerCase() === newTagName.trim().toLowerCase()
      )
      if (alreadyExists) {
        toast.error('A tag with this name already exists')
        return
      }
      try {
        createTag({ name: newTagName.trim(), color: newTagColor })
        setNewTagName('')
        setNewTagColor('#3b82f6')
        setShowNewTag(false)
      } catch (error) {
        toast.error(error?.message || 'The tag could not be created')
      }
    }
  }

  return (
    <LegacyDialog label="Manage tags" onClose={() => setTagManagerOpen(false)} align="center">
      <div 
        className="bg-surface-raised rounded-2xl shadow-2xl border border-subtle w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col modal-animate"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 qn-banner-surface text-white">
          <div className="flex items-center gap-3">
            <Tag className="w-6 h-6" />
            <div>
              <h2 className="text-lg font-bold">{t('tags.manageTitle', 'Manage Tags')}</h2>
              <p className="text-sm text-white/70">Organize your notes with tags</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setTagManagerOpen(false)}
            aria-label={t('common.close', 'Close')}
            className="qn-square-control rounded-full p-2 transition-colors hover:bg-white/20"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {!showNewTag && (
            <button
              type="button"
              onClick={() => setShowNewTag(true)}
              className="w-full mb-4 p-3 border-2 border-dashed border-subtle rounded-xl hover:border-emerald-500 dark:hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors flex items-center justify-center gap-2 text-content-muted hover:text-emerald-600 dark:hover:text-emerald-400"
            >
              <Plus className="w-5 h-5" />
              <span>{t('tags.addNew', 'Add New Tag')}</span>
            </button>
          )}
          {showNewTag && (
            <div className="mb-4 p-4 bg-surface-sunken rounded-xl border border-subtle">
              <div className="flex items-center gap-3 mb-3">
                <div className="relative flex-1">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-subtle" />
                  <input
                    type="text"
                    maxLength={MAX_TAG_NAME_LENGTH}
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    placeholder={t('tags.tagName', 'Tag name')}
                    aria-label={t('tags.tagName', 'Tag name')}
                    className="w-full pl-9 pr-3 py-2 bg-surface-raised border border-subtle rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateTag()
                      if (e.key === 'Escape') setShowNewTag(false)
                    }}
                  />
                </div>
              </div>
              <div role="radiogroup" aria-label="New tag colour" className="flex flex-wrap gap-1.5 mb-3">
                {TAG_COLORS.map((color, index) => (
                  <TagColourChoice
                    key={color}
                    color={color}
                    selected={newTagColor === color}
                    index={index}
                    onChange={setNewTagColor}
                  />
                ))}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCreateTag}
                  disabled={!newTagName.trim()}
                  className={buttonClasses({ variant: 'primary' }) + ' flex-1'}
                >
                  <Check className="w-4 h-4" />
                  {t('common.create', 'Create')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowNewTag(false)
                    setNewTagName('')
                  }}
                  className="px-4 py-2 bg-surface-sunken hover:bg-surface-sunken dark:hover:bg-surface-active text-content-muted rounded-lg font-medium transition-colors border border-subtle "
                >
                  {t('common.cancel', 'Cancel')}
                </button>
              </div>
            </div>
          )}
          {managedTags.length === 0 ? (
            <div className="text-center py-12 text-content-muted">
              <Tag className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>{t('tags.noTags', 'No tags yet')}</p>
              <p className="text-sm mt-1">{t('tags.createFirst', 'Create your first tag to organize notes')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {managedTags.map((tag) => (
                <div
                  key={tag.id}
                  className="p-3 bg-surface-sunken rounded-xl border border-subtle hover:border-subtle dark:hover:border-subtle transition-colors"
                >
                  {editingTagId === tag.id ? (
                    <div>
                      <div className="flex items-center gap-3 mb-3">
                        <div className="relative flex-1">
                          <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-subtle" />
                          <input
                            type="text"
                            maxLength={MAX_TAG_NAME_LENGTH}
                            value={editingName}
                            aria-label={`Tag name for ${tag.name || 'tag'}`}
                            onChange={(e) => setEditingName(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 bg-surface-raised border border-subtle rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEdit()
                              if (e.key === 'Escape') handleCancelEdit()
                            }}
                          />
                        </div>
                      </div>
                      <div role="radiogroup" aria-label={`Colour for ${tag.name || 'tag'}`} className="flex flex-wrap gap-1.5 mb-3">
                        {TAG_COLORS.map((color, index) => (
                          <TagColourChoice
                            key={color}
                            color={color}
                            selected={editingColor === color}
                            index={index}
                            onChange={setEditingColor}
                          />
                        ))}
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleSaveEdit}
                          disabled={!editingName.trim()}
                          className={buttonClasses({ variant: 'primary' }) + ' flex-1'}
                        >
                          <Check className="w-4 h-4" />
                          {t('common.save', 'Save')}
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelEdit}
                          className="px-4 py-2 bg-surface-sunken hover:bg-surface-sunken dark:hover:bg-surface-active text-content-muted rounded-lg font-medium transition-colors border border-subtle "
                        >
                          {t('common.cancel', 'Cancel')}
                        </button>
                      </div>
                    </div>
                  ) : deleteConfirmId === tag.id ? (
                    <div>
                      <p className="text-sm text-content-muted mb-3">
                        {t('tags.deleteConfirm', 'Delete this tag? It will be removed from all notes.')}
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleDeleteTag(tag.id)}
                          className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
                        >
                          {t('common.delete', 'Delete')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(null)}
                          className="px-4 py-2 bg-surface-sunken hover:bg-surface-sunken dark:hover:bg-surface-active text-content-muted rounded-lg font-medium transition-colors border border-subtle "
                        >
                          {t('common.cancel', 'Cancel')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className="w-4 h-4 rounded-full flex-shrink-0"
                          style={{ backgroundColor: tag.color }}
                        />
                        <span className="truncate font-medium text-content">
                          #{tag.name}
                        </span>
                        <span className="text-sm text-content-muted">
                          {getNotesCountForTag(tag.name)} {getNotesCountForTag(tag.name) === 1 
                            ? (t('notes.note', 'note')) 
                            : (t('notes.notes', 'notes'))}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(tag)}
                          aria-label={`${t('common.edit', 'Edit')} ${tag.name || 'tag'}`}
                          className="p-2 hover:bg-surface-sunken dark:hover:bg-surface-sunken rounded-lg transition-colors text-content-muted hover:text-content dark:hover:text-content-subtle"
                          title={t('common.edit', 'Edit')}
                        >
                          <Edit2 className="w-4 h-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(tag.id)}
                          aria-label={`${t('common.delete', 'Delete')} ${tag.name || 'tag'}`}
                          className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors text-content-muted hover:text-red-600"
                          title={t('common.delete', 'Delete')}
                        >
                          <Trash2 className="w-4 h-4" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </LegacyDialog>
  )
}
