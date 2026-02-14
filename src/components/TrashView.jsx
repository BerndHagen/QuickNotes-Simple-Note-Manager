import React, { useMemo } from 'react'
import { Trash2, RotateCcw, X, Clock, AlertTriangle } from 'lucide-react'
import { useNotesStore, useUIStore } from '../store'
import { formatDate, htmlToPlainText, truncateText } from '../lib/utils'
import { useTranslation } from '../lib/useTranslation'

export default function TrashView() {
  const { t, language } = useTranslation()
  const { notes, restoreNote, permanentlyDeleteNote } = useNotesStore()
  const { showTrash, setShowTrash } = useUIStore()

  const trashedNotes = useMemo(() => {
    return notes
      .filter(note => note.deleted)
      .sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt))
  }, [notes])

  const getDaysRemaining = (deletedAt) => {
    const deleteDate = new Date(deletedAt)
    const expiryDate = new Date(deleteDate.getTime() + 30 * 24 * 60 * 60 * 1000)
    const now = new Date()
    const daysRemaining = Math.ceil((expiryDate - now) / (24 * 60 * 60 * 1000))
    return Math.max(0, daysRemaining)
  }

  const handleRestoreAll = () => {
    trashedNotes.forEach(note => restoreNote(note.id))
  }

  const handleEmptyTrash = () => {
    if (window.confirm(t('trash.emptyTrashConfirm'))) {
      trashedNotes.forEach(note => permanentlyDeleteNote(note.id))
    }
  }

  const handlePermanentDelete = (noteId, noteTitle) => {
    if (window.confirm(t('trash.permanentDeleteConfirm'))) {
      permanentlyDeleteNote(noteId)
    }
  }

  if (!showTrash) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center modal-backdrop-animate" onClick={() => setShowTrash(false)}>
      <div 
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-[#cbd1db] dark:border-gray-700 w-full max-w-2xl mx-4 max-h-[85vh] overflow-hidden flex flex-col modal-animate"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Trash2 className="w-6 h-6" />
            <div>
              <h2 className="text-lg font-bold">{t('trash.title')}</h2>
              <p className="text-sm text-white/70">
                {trashedNotes.length} {trashedNotes.length === 1 ? 'note' : 'notes'} {"\u2022"} {t('trash.autoDelete')}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowTrash(false)}
            className="p-2 rounded-full hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {trashedNotes.length > 0 && (
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-900">
            <button
              onClick={handleRestoreAll}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              {t('trash.restoreAll')}
            </button>
            <button
              onClick={handleEmptyTrash}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              {t('trash.emptyTrash')}
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto">
          {trashedNotes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-500 dark:text-gray-400">
              <Trash2 className="w-16 h-16 mb-4 opacity-20" />
              <p className="text-lg font-medium">{t('trash.empty')}</p>
              <p className="text-sm">{t('trash.emptyDescription')}</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {trashedNotes.map((note) => {
                const daysRemaining = getDaysRemaining(note.deletedAt)
                const preview = truncateText(htmlToPlainText(note.content), 100)
                
                return (
                  <div
                    key={note.id}
                    className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                          {note.title}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                          {preview || t('notes.noPreview')}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {t('trash.deleted')} {formatDate(note.deletedAt, language)}
                          </span>
                          <span className={`flex items-center gap-1 ${
                            daysRemaining <= 7 ? 'text-red-600 dark:text-red-400' : ''
                          }`}>
                            <AlertTriangle className="w-3 h-3" />
                            {daysRemaining} {t('trash.daysLeft')}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => restoreNote(note.id)}
                          className="p-2 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-emerald-600 rounded-lg transition-colors"
                          title={t('common.restore')}
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handlePermanentDelete(note.id, note.title)}
                          className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 rounded-lg transition-colors"
                          title={t('trash.permanentDelete')}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
