import { useState } from 'react'
import { Archive, ArchiveRestore, Calendar, Clock, Folder, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { useNotesStore, useUIStore } from '../store'
import { formatDate, htmlToPlainText } from '../lib/utils'
import { useTranslation } from '../lib/useTranslation'
import { Button, EmptyState, IconButton, Input, Modal } from './ui'

export default function ArchiveView() {
  const { t, language } = useTranslation()
  const { archiveViewOpen, setArchiveViewOpen } = useUIStore()
  const { notes, folders, unarchiveNote, setSelectedNote } = useNotesStore()
  const [searchQuery, setSearchQuery] = useState('')

  const archivedNotes = notes.filter((note) => note.archived && !note.deleted)
  const normalizedQuery = searchQuery.trim().toLowerCase()
  const filteredNotes = archivedNotes.filter((note) => {
    if (!normalizedQuery) return true
    return (
      String(note.title || '').toLowerCase().includes(normalizedQuery) ||
      htmlToPlainText(note.content || '').toLowerCase().includes(normalizedQuery)
    )
  })

  const closeArchive = () => {
    setArchiveViewOpen(false)
    setSearchQuery('')
  }

  const handleUnarchive = (noteId) => {
    unarchiveNote(noteId)
    toast.success(t('archive.noteRemoved'))
  }

  const handleOpenNote = (noteId) => {
    unarchiveNote(noteId)
    setSelectedNote(noteId)
    closeArchive()
    toast.success(t('archive.noteRestoredOpened'))
  }

  const getContentPreview = (content) => {
    const text = htmlToPlainText(content || '')
    return text.length > 150 ? `${text.slice(0, 150).trim()}…` : text
  }

  const countLabel = `${archivedNotes.length} ${
    archivedNotes.length === 1 ? t('archive.archivedNote') : t('archive.archivedNotes')
  }`

  return (
    <Modal
      open={archiveViewOpen}
      onClose={closeArchive}
      title={t('archive.title')}
      description={countLabel}
      icon={Archive}
      size="2xl"
      bodyClassName="!overflow-hidden p-0 sm:p-0"
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="shrink-0 border-b border-subtle px-5 py-3 sm:px-6">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-subtle"
              aria-hidden="true"
            />
            <Input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              aria-label={t('archive.searchPlaceholder')}
              placeholder={t('archive.searchPlaceholder')}
              className="bg-surface-sunken pl-9"
            />
          </div>
        </div>

        <div
          role="region"
          aria-label={t('archive.title')}
          tabIndex={0}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--qn-focus-ring)]"
        >
          {filteredNotes.length === 0 ? (
            <EmptyState
              icon={Archive}
              title={searchQuery ? t('archive.noResults') : t('archive.empty')}
              description={
                searchQuery
                  ? `${t('archive.noArchivedFound')} “${searchQuery}”.`
                  : t('archive.emptyDescription')
              }
              action={
                searchQuery ? (
                  <Button variant="secondary" size="sm" onClick={() => setSearchQuery('')}>
                    {t('common.clear', 'Clear search')}
                  </Button>
                ) : null
              }
            />
          ) : (
            <ul className="space-y-3">
              {filteredNotes.map((note) => {
                const folder = folders.find((candidate) => candidate.id === note.folderId)
                const title = note.title || t('notes.untitled', 'Untitled note')
                const headingId = `qn-archived-note-${note.id}`
                return (
                  <li key={note.id}>
                    <article
                      aria-labelledby={headingId}
                      className="rounded-card border border-subtle bg-surface-sunken p-4 transition-colors hover:bg-surface-hover"
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <h3 id={headingId} className="truncate text-ui-lg font-medium text-content">
                            {title}
                          </h3>
                          <p className="mt-1 line-clamp-2 text-ui-md text-content-muted">
                            {getContentPreview(note.content) || t('notes.noPreview')}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-ui-xs text-content-muted">
                            <span className="flex items-center gap-1.5">
                              <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                              Archived: {formatDate(note.archivedAt, language)}
                            </span>
                            <span className="flex items-center gap-1.5">
                              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                              Created: {formatDate(note.createdAt, language)}
                            </span>
                            {folder && (
                              <span className="flex items-center gap-1.5">
                                <Folder className="h-3.5 w-3.5" aria-hidden="true" />
                                {folder.name}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center justify-end gap-2">
                          <IconButton
                            icon={ArchiveRestore}
                            size="sm"
                            label={`${t('archive.removeFromArchive')}: ${title}`}
                            onClick={() => handleUnarchive(note.id)}
                          />
                          <Button
                            variant="primary"
                            size="sm"
                            aria-label={`${t('common.open')} ${title}`}
                            onClick={() => handleOpenNote(note.id)}
                          >
                            {t('common.open')}
                          </Button>
                        </div>
                      </div>
                    </article>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  )
}
