import React, { useState } from 'react'
import { Archive, ArchiveRestore, X, Search, Calendar, Clock, Folder } from 'lucide-react'
import { useNotesStore, useUIStore } from '../store'
import { formatDate } from '../lib/utils'
import { useTranslation } from '../lib/useTranslation'
import toast from 'react-hot-toast'

export default function ArchiveView() {
  const { t, language } = useTranslation()
  const { archiveViewOpen, setArchiveViewOpen } = useUIStore()
  const { notes, folders, unarchiveNote, setSelectedNote } = useNotesStore()
  const [searchQuery, setSearchQuery] = useState('')

  const archivedNotes = notes.filter((note) => note.archived && !note.deleted)

  const filteredNotes = archivedNotes.filter((note) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      note.title.toLowerCase().includes(q) ||
      stripHtml(note.content || '').toLowerCase().includes(q)
    )
  })

  const stripHtml = (html) => {
    const div = document.createElement('div')
    div.innerHTML = html
    return div.textContent || div.innerText || ''
  }

  const handleUnarchive = (noteId) => {
    unarchiveNote(noteId)
    toast.success(t('archive.noteRemoved'))
  }

  const handleOpenNote = (noteId) => {
    unarchiveNote(noteId)
    setSelectedNote(noteId)
    setArchiveViewOpen(false)
    toast.success(t('archive.noteRestoredOpened'))
  }

  const getFolder = (folderId) => {
    return folders.find((f) => f.id === folderId)
  }

  const getContentPreview = (content) => {
    const text = stripHtml(content || '')
    return text.slice(0, 150) + (text.length > 150 ? '...' : '')
  }

  if (!archiveViewOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm modal-backdrop-animate">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-[#cbd1db] dark:border-gray-700 w-full max-w-3xl mx-4 max-h-[85vh] overflow-hidden flex flex-col modal-animate">
        <div className="flex items-center justify-between p-5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white shrink-0">
          <div className="flex items-center gap-3">
            <Archive className="w-6 h-6" />
            <div>
              <h2 className="text-lg font-bold">{t('archive.title')}</h2>
              <p className="text-sm text-white/70">
                {archivedNotes.length} {archivedNotes.length !== 1 ? t('archive.archivedNotes') : t('archive.archivedNote')}
              </p>
            </div>
          </div>
          <button
            onClick={() => setArchiveViewOpen(false)}
            className="p-2 rounded-full hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('archive.searchPlaceholder')}
              className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-700 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {filteredNotes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <Archive className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                {searchQuery ? t('archive.noResults') : t('archive.empty')}
              </h3>
              <p className="text-gray-500 dark:text-gray-400 max-w-sm">
                {searchQuery
                  ? `${t('archive.noArchivedFound')} "${searchQuery}".`
                  : t('archive.emptyDescription')}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredNotes.map((note) => {
                const folder = getFolder(note.folderId)
                return (
                  <div
                    key={note.id}
                    className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-gray-900 dark:text-white truncate mb-1">
                          {note.title}
                        </h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-2">
                          {getContentPreview(note.content)}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-gray-400 dark:text-gray-500">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Archived: {formatDate(note.archivedAt, language)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Created: {formatDate(note.createdAt, language)}
                          </span>
                          {folder && (
                            <span className="flex items-center gap-1">
                              <Folder className="w-3 h-3" />
                              {folder.name}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleUnarchive(note.id)}
                          className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                          title={t('archive.removeFromArchive')}
                        >
                          <ArchiveRestore className="w-4 h-4 text-gray-500" />
                        </button>
                        <button
                          onClick={() => handleOpenNote(note.id)}
                          className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-sm rounded-lg transition-colors"
                        >
                          {t('common.open')}
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
