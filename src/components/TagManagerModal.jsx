import React, { useState } from 'react'
import { X, Tag, Trash2, Edit2, Check, Plus, Hash } from 'lucide-react'
import { useNotesStore, useUIStore } from '../store'
import { useTranslation } from '../lib/useTranslation'

const TAG_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
  '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
  '#ec4899', '#f43f5e', '#78716c', '#64748b', '#71717a',
]

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

  if (!tagManagerOpen) return null

  const getNotesCountForTag = (tagName) => {
    return notes.filter(n => n.tags?.includes(tagName) && !n.deleted).length
  }

  const handleStartEdit = (tag) => {
    setEditingTagId(tag.id)
    setEditingName(tag.name)
    setEditingColor(tag.color)
  }

  const handleSaveEdit = () => {
    if (editingName.trim() && editingTagId) {
      updateTag(editingTagId, { 
        name: editingName.trim(), 
        color: editingColor 
      })
      setEditingTagId(null)
      setEditingName('')
      setEditingColor('')
    }
  }

  const handleCancelEdit = () => {
    setEditingTagId(null)
    setEditingName('')
    setEditingColor('')
  }

  const handleDeleteTag = (tagId) => {
    deleteTag(tagId)
    setDeleteConfirmId(null)
  }

  const handleCreateTag = () => {
    if (newTagName.trim()) {
      createTag({
        name: newTagName.trim(),
        color: newTagColor
      })
      setNewTagName('')
      setNewTagColor('#3b82f6')
      setShowNewTag(false)
    }
  }

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 modal-backdrop-animate"
      onClick={() => setTagManagerOpen(false)}
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-[#cbd1db] dark:border-gray-700 w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col modal-animate"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
          <div className="flex items-center gap-3">
            <Tag className="w-6 h-6" />
            <div>
              <h2 className="text-lg font-bold">{t('tags.manageTitle') || 'Manage Tags'}</h2>
              <p className="text-sm text-white/70">Organize your notes with tags</p>
            </div>
          </div>
          <button
            onClick={() => setTagManagerOpen(false)}
            className="p-2 rounded-full hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {!showNewTag && (
            <button
              onClick={() => setShowNewTag(true)}
              className="w-full mb-4 p-3 border-2 border-dashed border-[#cbd1db] dark:border-gray-600 rounded-xl hover:border-emerald-500 dark:hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors flex items-center justify-center gap-2 text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400"
            >
              <Plus className="w-5 h-5" />
              <span>{t('tags.addNew') || 'Add New Tag'}</span>
            </button>
          )}
          {showNewTag && (
            <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-[#cbd1db] dark:border-gray-700">
              <div className="flex items-center gap-3 mb-3">
                <div className="relative flex-1">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    placeholder={t('tags.tagName') || 'Tag name'}
                    className="w-full pl-9 pr-3 py-2 bg-white dark:bg-gray-800 border border-[#cbd1db] dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateTag()
                      if (e.key === 'Escape') setShowNewTag(false)
                    }}
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {TAG_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setNewTagColor(color)}
                    className={`w-6 h-6 rounded-full transition-transform hover:scale-110 ${
                      newTagColor === color ? 'ring-2 ring-offset-2 ring-gray-400 dark:ring-gray-500' : ''
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleCreateTag}
                  disabled={!newTagName.trim()}
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  {t('common.create') || 'Create'}
                </button>
                <button
                  onClick={() => {
                    setShowNewTag(false)
                    setNewTagName('')
                  }}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors border border-[#cbd1db] dark:border-gray-600"
                >
                  {t('common.cancel') || 'Cancel'}
                </button>
              </div>
            </div>
          )}
          {tags.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <Tag className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>{t('tags.noTags') || 'No tags yet'}</p>
              <p className="text-sm mt-1">{t('tags.createFirst') || 'Create your first tag to organize notes'}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {tags.map((tag) => (
                <div
                  key={tag.id}
                  className="p-3 bg-gray-50 dark:bg-gray-900 rounded-xl border border-[#cbd1db] dark:border-gray-700 hover:border-[#cbd1db] dark:hover:border-gray-600 transition-colors"
                >
                  {editingTagId === tag.id ? (
                    <div>
                      <div className="flex items-center gap-3 mb-3">
                        <div className="relative flex-1">
                          <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 bg-white dark:bg-gray-800 border border-[#cbd1db] dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEdit()
                              if (e.key === 'Escape') handleCancelEdit()
                            }}
                          />
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {TAG_COLORS.map((color) => (
                          <button
                            key={color}
                            onClick={() => setEditingColor(color)}
                            className={`w-6 h-6 rounded-full transition-transform hover:scale-110 ${
                              editingColor === color ? 'ring-2 ring-offset-2 ring-gray-400 dark:ring-gray-500' : ''
                            }`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={handleSaveEdit}
                          className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                        >
                          <Check className="w-4 h-4" />
                          {t('common.save') || 'Save'}
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors border border-[#cbd1db] dark:border-gray-600"
                        >
                          {t('common.cancel') || 'Cancel'}
                        </button>
                      </div>
                    </div>
                  ) : deleteConfirmId === tag.id ? (
                    <div>
                      <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                        {t('tags.deleteConfirm') || 'Delete this tag? It will be removed from all notes.'}
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDeleteTag(tag.id)}
                          className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
                        >
                          {t('common.delete') || 'Delete'}
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors border border-[#cbd1db] dark:border-gray-600"
                        >
                          {t('common.cancel') || 'Cancel'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-4 h-4 rounded-full flex-shrink-0"
                          style={{ backgroundColor: tag.color }}
                        />
                        <span className="font-medium text-gray-900 dark:text-white">
                          #{tag.name}
                        </span>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {getNotesCountForTag(tag.name)} {getNotesCountForTag(tag.name) === 1 
                            ? (t('notes.note') || 'note') 
                            : (t('notes.notes') || 'notes')}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleStartEdit(tag)}
                          className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                          title={t('common.edit') || 'Edit'}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(tag.id)}
                          className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors text-gray-500 hover:text-red-600"
                          title={t('common.delete') || 'Delete'}
                        >
                          <Trash2 className="w-4 h-4" />
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
    </div>
  )
}
