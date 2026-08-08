import { lazy, Suspense, useMemo, useState, useEffect, useRef } from 'react'
import {
  Plus,
  Search,
  Star,
  Pin,
  Clock,
  Copy,
  Trash2,
  FolderInput,
  PinOff,
  StarOff,
  FileText,
  ArrowLeft,
  MoreHorizontal,
  List,
  LayoutGrid,
} from 'lucide-react'
import { useNotesStore, useUIStore } from '../store'
import { formatDate, htmlToPlainText, truncateText, getNoteTypePreview } from '../lib/utils'
import { filterNotes } from '../lib/filterNotes'
import { useTranslation } from '../lib/useTranslation'
import SortDropdown, { sortNotes } from './SortDropdown'
import { ConfirmDialog } from './FolderDialogs'
import { Button, IconButton, Input, Menu, MenuItem, MenuLabel, MenuSeparator, Spinner } from './ui'

const NoteEditor = lazy(() => import('./NoteEditor'))

function NoteContextMenu({ point, note, onClose, onRequestDelete, folders }) {
  const { toggleStar, togglePin, duplicateNote, deleteNote, updateNote } = useNotesStore()
  const { confirmBeforeDelete } = useUIStore()

  const handleAction = (action) => {
    action()
    onClose()
  }

  return (
    <Menu
      open
      point={point}
      onClose={onClose}
      label={`Actions for ${note.title || 'Untitled note'}`}
      width={224}
    >
      <MenuItem
        icon={note.pinned ? PinOff : Pin}
        onClick={() => handleAction(() => togglePin(note.id))}
      >
        {note.pinned ? 'Unpin' : 'Pin to top'}
      </MenuItem>
      <MenuItem
        icon={note.starred ? StarOff : Star}
        onClick={() => handleAction(() => toggleStar(note.id))}
      >
        {note.starred ? 'Remove from favorites' : 'Add to favorites'}
      </MenuItem>
      <MenuSeparator />
      <MenuItem
        icon={Copy}
        onClick={() => handleAction(() => duplicateNote(note.id))}
      >
        Duplicate
      </MenuItem>
      <MenuLabel>Move to folder</MenuLabel>
      <MenuItem
        icon={FolderInput}
        selected={!note.folderId}
        onClick={() => handleAction(() => updateNote(note.id, { folderId: null }))}
      >
        No folder
      </MenuItem>
      {folders.map((folder) => (
        <MenuItem
          key={folder.id}
          selected={note.folderId === folder.id}
          onClick={() => handleAction(() => updateNote(note.id, { folderId: folder.id }))}
        >
          {folder.name}
        </MenuItem>
      ))}
      <MenuSeparator />
      <MenuItem
        icon={Trash2}
        tone="danger"
        onClick={() => handleAction(() => {
          if (confirmBeforeDelete) onRequestDelete(note)
          else deleteNote(note.id)
        })}
      >
        Move to trash
      </MenuItem>
    </Menu>
  )
}

function GridNoteCard({ note, isSelected, onClick, onOpenMenu }) {
  const cardRef = useRef(null)
  const { tags } = useNotesStore()
  const { toggleStar } = useNotesStore()
  const { language } = useTranslation()

  const preview = useMemo(() => {
    const specialPreview = getNoteTypePreview(note, 150)
    if (specialPreview) return specialPreview
    const plainText = htmlToPlainText(note.content)
    return truncateText(plainText, 150)
  }, [note])

  const getTagColor = (tagName) => {
    const tag = tags.find((t) => t.name === tagName)
    return tag?.color || '#6b7280'
  }

  const openMenuAtCard = () => {
    const rect = cardRef.current?.getBoundingClientRect()
    if (!rect) return
    onOpenMenu({ x: rect.right - 12, y: rect.top + 40 })
  }

  return (
    <article
      ref={cardRef}
      onContextMenu={(event) => {
        event.preventDefault()
        onOpenMenu({ x: event.clientX, y: event.clientY })
      }}
      className={`group relative flex min-h-40 flex-col rounded-card border bg-surface-raised p-3 shadow-xs transition-[border-color,box-shadow,transform] duration-fast hover:-translate-y-0.5 hover:shadow-md sm:min-h-48 sm:p-4 ${
        isSelected
          ? 'border-accent ring-2 ring-[var(--qn-accent-soft)]'
          : 'border-subtle hover:border-strong'
      }`}
    >
      <button
        type="button"
        onClick={onClick}
        onKeyDown={(event) => {
          if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
            event.preventDefault()
            openMenuAtCard()
          }
        }}
        aria-label={`Open ${note.title || 'Untitled note'}`}
        aria-current={isSelected ? 'true' : undefined}
        className="absolute inset-0 z-0 rounded-card outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--qn-focus-ring)]"
      />
      <div className="pointer-events-none relative z-10 mb-2 flex items-start justify-between gap-2">
        <h3 className="line-clamp-2 flex-1 font-semibold text-content">
          {note.title}
        </h3>
        <div className="pointer-events-auto -mr-1 -mt-1 flex items-center">
          {note.pinned && (
            <span className="inline-flex h-control-sm w-control-sm items-center justify-center text-accent-text">
              <Pin className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
              <span className="qn-sr-only">Pinned</span>
            </span>
          )}
          <IconButton
            icon={Star}
            size="sm"
            label={note.starred ? 'Remove from favorites' : 'Add to favorites'}
            active={note.starred}
            iconClassName={note.starred ? 'fill-current' : ''}
            onClick={() => toggleStar(note.id)}
            className={note.starred ? '' : 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100'}
          />
          <IconButton
            icon={MoreHorizontal}
            size="sm"
            label={`More actions for ${note.title || 'Untitled note'}`}
            onClick={openMenuAtCard}
            className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
          />
        </div>
      </div>
      <p className="pointer-events-none relative z-10 mb-3 flex-1 text-xs text-content-muted line-clamp-3 sm:text-sm sm:line-clamp-4">
        {preview || 'No content'}
      </p>
      {note.tags && note.tags.length > 0 && (
        <div className="pointer-events-none relative z-10 mb-3 hidden flex-wrap gap-1 min-[390px]:flex">
          {note.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded bg-surface-sunken px-1.5 py-0.5 text-[10px] font-medium text-content-muted"
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: getTagColor(tag) }}
                aria-hidden="true"
              />
              #{tag}
            </span>
          ))}
          {note.tags.length > 3 && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium text-content-muted bg-surface-sunken">
              +{note.tags.length - 3}
            </span>
          )}
        </div>
      )}
      <div className="pointer-events-none relative z-10 flex items-center gap-1 border-t border-subtle pt-2 text-[10px] text-content-subtle sm:gap-2 sm:text-xs">
        <Clock className="h-3 w-3" aria-hidden="true" />
        <span>{formatDate(note.updatedAt, language)}</span>
      </div>
    </article>
  )
}

export default function NotesGrid({ sidebarToggle }) {
  const {
    notes,
    folders,
    selectedNoteId,
    selectedFolderId,
    selectedTagFilter,
    searchQuery,
    setSearchQuery,
    setSelectedNote,
    createNote,
    deleteNote,
  } = useNotesStore()

  const { currentSort, setCurrentSort, sidebarOpen, viewMode, setViewMode } = useUIStore()
  const { t } = useTranslation()

  const [showingEditor, setShowingEditor] = useState(false)
  const [contextMenu, setContextMenu] = useState(null)
  const [pendingDeleteNote, setPendingDeleteNote] = useState(null)

  useEffect(() => {
    if (selectedNoteId) {
      setShowingEditor(true)
    }
  }, [selectedNoteId])

  const filteredNotes = useMemo(() => {
    const result = filterNotes(notes, {
      folderId: selectedFolderId,
      tagFilter: selectedTagFilter,
      query: searchQuery,
    })
    return sortNotes(result, currentSort)
  }, [notes, selectedFolderId, selectedTagFilter, searchQuery, currentSort])

  const handleNoteClick = (note) => {
    setSelectedNote(note.id)
    setShowingEditor(true)
  }

  const handleBackToGrid = () => {
    setShowingEditor(false)
    setSelectedNote(null)
  }

  const handleCreateNote = () => {
    createNote({
      title: t('notes.newNote'),
      content: '',
      folderId: selectedFolderId,
    })
    setShowingEditor(true)
  }

  const getTitle = () => {
    if (selectedTagFilter === '__starred__') return t('sidebar.favorites')
    if (selectedTagFilter) return `#${selectedTagFilter}`
    if (selectedFolderId) {
      const folder = folders.find((f) => f.id === selectedFolderId)
      return folder?.name || t('sidebar.folders')
    }
    return t('sidebar.allNotes')
  }

  if (showingEditor && selectedNoteId) {
    return (
      <div className="flex flex-col w-full h-full">
        <div className="flex items-center gap-2 border-b border-subtle bg-surface-raised/95 px-3 py-3 backdrop-blur-sm sm:gap-3 sm:px-4">
          {!sidebarOpen && sidebarToggle}
          <Button
            size="sm"
            variant="ghost"
            icon={ArrowLeft}
            onClick={handleBackToGrid}
          >
            Back to grid
          </Button>
          <span className="h-4 w-px bg-[var(--qn-border)]" aria-hidden="true" />
          <span className="truncate text-sm text-content-muted">{getTitle()}</span>
        </div>
        <div className="flex-1 min-h-0">
          <Suspense
            fallback={
              <div className="flex min-h-0 flex-1 items-center justify-center bg-surface-raised">
                <Spinner label="Loading the editor" />
              </div>
            }
          >
            <NoteEditor />
          </Suspense>
        </div>
      </div>
    )
  }

  return (
    <main className="flex h-full w-full flex-col bg-surface-base">
      <header className="z-20 flex-shrink-0 border-b border-subtle bg-surface-raised px-4 py-4 sm:px-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            {!sidebarOpen && sidebarToggle}
            <h2 className="truncate text-[15px] font-bold tracking-tight text-content">
              {getTitle()}
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <SortDropdown currentSort={currentSort} onSortChange={setCurrentSort} />
            <Button
              size="sm"
              variant="primary"
              icon={Plus}
              onClick={handleCreateNote}
            >
              <span className="hidden sm:inline">New note</span>
              <span className="sr-only sm:hidden">New note</span>
            </Button>
          </div>
        </div>
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-content-subtle" aria-hidden="true" />
          <Input
            placeholder={t('notes.searchPlaceholder')}
            aria-label={t('notes.searchPlaceholder')}
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="bg-surface-sunken pl-9"
          />
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-6">
        {filteredNotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="flex items-center justify-center w-20 h-20 mb-5 rounded-2xl bg-surface-sunken">
              <FileText className="w-10 h-10 text-content-subtle dark:text-content-muted" />
            </div>
            <p className="text-base font-semibold text-content-muted">
              {searchQuery ? t('notes.noNotesFound') : t('notes.noNotes')}
            </p>
            {!searchQuery && (
              <Button
                size="sm"
                variant="primary"
                onClick={handleCreateNote}
                className="mt-3"
              >
                {t('notes.createFirst')}
              </Button>
            )}
          </div>
        ) : (
          <div data-note-grid className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {filteredNotes.map((note) => (
              <GridNoteCard
                key={note.id}
                note={note}
                isSelected={selectedNoteId === note.id}
                onClick={() => handleNoteClick(note)}
                onOpenMenu={(point) => setContextMenu({ point, note })}
              />
            ))}
          </div>
        )}
      </div>
      <div className="qn-safe-bottom flex shrink-0 items-center justify-between gap-2 border-t border-subtle px-4 py-2 sm:px-6">
        <span className="text-ui-sm font-medium text-content-subtle">
          {filteredNotes.length} {filteredNotes.length === 1 ? t('notes.note') : t('notes.notes')}
        </span>
        <div
          role="group"
          aria-label="View mode"
          className="flex items-center gap-0.5 rounded-control bg-surface-sunken p-0.5"
        >
          <button
            type="button"
            onClick={() => setViewMode('list')}
            aria-pressed={viewMode === 'list'}
            aria-label="List view"
            title="List view"
            className={`qn-square-control flex h-6 w-7 items-center justify-center rounded-[6px] transition-colors duration-fast ${
              viewMode === 'list'
                ? 'bg-surface-raised text-content shadow-xs'
                : 'text-content-subtle hover:text-content'
            }`}
          >
            <List className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-pressed={viewMode === 'grid'}
            aria-label="Grid view"
            title="Grid view"
            className={`qn-square-control flex h-6 w-7 items-center justify-center rounded-[6px] transition-colors duration-fast ${
              viewMode === 'grid'
                ? 'bg-surface-raised text-content shadow-xs'
                : 'text-content-subtle hover:text-content'
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
      {contextMenu && (
        <NoteContextMenu
          point={contextMenu.point}
          note={contextMenu.note}
          folders={folders}
          onRequestDelete={setPendingDeleteNote}
          onClose={() => setContextMenu(null)}
        />
      )}
      <ConfirmDialog
        open={Boolean(pendingDeleteNote)}
        onClose={() => setPendingDeleteNote(null)}
        onConfirm={() => deleteNote(pendingDeleteNote.id)}
        title="Move note to trash?"
        description={`“${pendingDeleteNote?.title || 'Untitled note'}” will remain recoverable from Trash.`}
        confirmLabel="Move to trash"
        icon={Trash2}
      />
    </main>
  )
}
