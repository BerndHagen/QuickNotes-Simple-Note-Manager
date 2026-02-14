import React, { useMemo, useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
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
  ChevronRight,
  FileText,
  ArrowLeft
} from 'lucide-react'
import { useNotesStore, useUIStore } from '../store'
import { formatDate, htmlToPlainText, truncateText, getNoteTypePreview } from '../lib/utils'
import { useTranslation } from '../lib/useTranslation'
import SortDropdown, { sortNotes } from './SortDropdown'
import NoteEditor from './NoteEditor'

function NoteContextMenu({ x, y, note, onClose, folders, tags }) {
  const menuRef = useRef(null)
  const folderButtonRef = useRef(null)
  const submenuRef = useRef(null)
  const hoverTimeoutRef = useRef(null)
  const { toggleStar, togglePin, duplicateNote, deleteNote, updateNote } = useNotesStore()
  const { confirmBeforeDelete } = useUIStore()
  const { t } = useTranslation()
  const [showFolderMenu, setShowFolderMenu] = useState(false)
  const [position, setPosition] = useState({ x, y })
  const [submenuPosition, setSubmenuPosition] = useState({ x: 0, y: 0, openLeft: false })
  const [maxHeight, setMaxHeight] = useState('auto')

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    const handleClickOutside = (e) => {
      const clickedInMenu = menuRef.current?.contains(e.target)
      const clickedInSubmenu = submenuRef.current?.contains(e.target)
      if (!clickedInMenu && !clickedInSubmenu) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect()
      const padding = 10
      const bottomPadding = 60
      
      let adjustedX = x
      let adjustedY = y
      let calculatedMaxHeight = 'auto'

      if (x + rect.width > window.innerWidth - padding) {
        adjustedX = window.innerWidth - rect.width - padding
      }
      if (adjustedX < padding) adjustedX = padding

      const spaceBelow = window.innerHeight - y - bottomPadding
      const spaceAbove = y - padding
      
      if (rect.height > spaceBelow) {
        if (spaceAbove > spaceBelow && spaceAbove >= rect.height) {
          adjustedY = y - rect.height
        } else {
          if (spaceAbove > spaceBelow) {
            calculatedMaxHeight = `${spaceAbove - padding}px`
            adjustedY = padding
          } else {
            calculatedMaxHeight = `${spaceBelow - padding}px`
            adjustedY = y
          }
        }
      }
      
      if (adjustedY < padding) adjustedY = padding

      setPosition({ x: adjustedX, y: adjustedY })
      setMaxHeight(calculatedMaxHeight)
    }
  }, [x, y])

  useEffect(() => {
    if (showFolderMenu && folderButtonRef.current) {
      const buttonRect = folderButtonRef.current.getBoundingClientRect()
      const menuRect = menuRef.current?.getBoundingClientRect()
      const padding = 10
      const submenuWidth = 160
      const submenuHeight = Math.min(300, (folders.length + 1) * 36 + 8)
      
      const spaceRight = window.innerWidth - (menuRect?.right || buttonRect.right) - padding
      const spaceLeft = (menuRect?.left || buttonRect.left) - padding
      const openLeft = spaceRight < submenuWidth && spaceLeft >= submenuWidth
      
      let subX = openLeft 
        ? (menuRect?.left || buttonRect.left) - submenuWidth 
        : (menuRect?.right || buttonRect.right)
      
      let subY = buttonRect.top
      const bottomPadding = 60
      if (subY + submenuHeight > window.innerHeight - bottomPadding) {
        subY = window.innerHeight - bottomPadding - submenuHeight
      }
      if (subY < padding) subY = padding
      
      setSubmenuPosition({ x: subX, y: subY, openLeft })
    }
  }, [showFolderMenu, folders.length])

  const handleFolderButtonEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
    setShowFolderMenu(true)
  }

  const handleFolderButtonLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setShowFolderMenu(false)
    }, 150)
  }

  const handleSubmenuEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
  }

  const handleSubmenuLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setShowFolderMenu(false)
    }, 150)
  }

  const handleAction = (action) => {
    action()
    onClose()
  }

  return (
    <div
      ref={menuRef}
      className="fixed z-[9999] bg-white dark:bg-gray-900 rounded-2xl shadow-xl shadow-black/5 dark:shadow-black/20 border border-[#cbd1db] dark:border-gray-700 py-1.5 min-w-[200px] backdrop-blur-xl overflow-y-auto float-up"
      style={{ left: position.x, top: position.y, maxHeight: maxHeight }}
    >
      <button
        onClick={() => handleAction(() => togglePin(note.id))}
        className="flex items-center w-[calc(100%-12px)] gap-3 mx-1.5 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700/50 dark:text-gray-300 transition-colors rounded-lg"
      >
        {note.pinned ? <PinOff className="w-4 h-4 text-gray-400" /> : <Pin className="w-4 h-4 text-gray-400" />}
        <span>{note.pinned ? 'Unpin' : 'Pin to Top'}</span>
      </button>
      <button
        onClick={() => handleAction(() => toggleStar(note.id))}
        className="flex items-center w-[calc(100%-12px)] gap-3 mx-1.5 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700/50 dark:text-gray-300 transition-colors rounded-lg"
      >
        {note.starred ? <StarOff className="w-4 h-4 text-gray-400" /> : <Star className="w-4 h-4 text-gray-400" />}
        <span>{note.starred ? 'Remove from Favorites' : 'Add to Favorites'}</span>
      </button>
      
      <div className="my-1.5 mx-3 border-t border-gray-100 dark:border-gray-800" />
      
      <button
        onClick={() => handleAction(() => duplicateNote(note.id))}
        className="flex items-center w-[calc(100%-12px)] gap-3 mx-1.5 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700/50 dark:text-gray-300 transition-colors rounded-lg"
      >
        <Copy className="w-4 h-4 text-gray-400" />
        <span>Duplicate</span>
      </button>

      <div 
        className="relative mx-1.5"
        onMouseEnter={handleFolderButtonEnter}
        onMouseLeave={handleFolderButtonLeave}
      >
        <button
          ref={folderButtonRef}
          onClick={() => setShowFolderMenu(!showFolderMenu)}
          className={`flex items-center justify-between w-full px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700/50 dark:text-gray-300 transition-colors rounded-lg ${showFolderMenu ? 'bg-gray-100 dark:bg-gray-700/50' : ''}`}
        >
          <div className="flex items-center gap-3">
            <FolderInput className="w-4 h-4 text-gray-400" />
            <span>Move to Folder</span>
          </div>
          <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${submenuPosition.openLeft ? 'rotate-180' : ''}`} />
        </button>
        {showFolderMenu && createPortal(
          <div 
            ref={submenuRef}
            onMouseEnter={handleSubmenuEnter}
            onMouseLeave={handleSubmenuLeave}
            className="fixed bg-white dark:bg-gray-900 rounded-2xl shadow-xl shadow-black/5 dark:shadow-black/20 border border-[#cbd1db] dark:border-gray-700 py-1.5 min-w-[160px] max-h-[300px] overflow-y-auto z-[10000] backdrop-blur-xl"
            style={{
              left: submenuPosition.x,
              top: submenuPosition.y,
            }}
          >
            <button
              onClick={() => handleAction(() => updateNote(note.id, { folderId: null }))}
              className={`w-[calc(100%-12px)] mx-1.5 px-3 py-2.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors rounded-lg ${
                !note.folderId ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-700 dark:text-gray-300'
              }`}
            >
              No Folder
            </button>
            {folders.map((folder) => (
              <button
                key={folder.id}
                onClick={() => handleAction(() => updateNote(note.id, { folderId: folder.id }))}
                className={`w-[calc(100%-12px)] mx-1.5 px-3 py-2.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors rounded-lg ${
                  note.folderId === folder.id ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-700 dark:text-gray-300'
                }`}
              >
                {folder.name}
              </button>
            ))}
          </div>,
          document.body
        )}
      </div>
      
      <div className="my-1.5 mx-3 border-t border-gray-100 dark:border-gray-800" />
      
      <button
        onClick={() => handleAction(() => {
          if (confirmBeforeDelete && !window.confirm(t('settings.confirmDeleteMessage'))) return
          deleteNote(note.id)
        })}
        className="flex items-center w-[calc(100%-12px)] gap-3 mx-1.5 px-3 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 dark:text-red-400 transition-colors rounded-lg"
      >
        <Trash2 className="w-4 h-4" />
        <span>Delete</span>
      </button>
    </div>
  )
}

function GridNoteCard({ note, isSelected, onClick, onContextMenu }) {
  const { tags } = useNotesStore()
  const { toggleStar } = useNotesStore()
  const { language } = useTranslation()

  const preview = useMemo(() => {
    const specialPreview = getNoteTypePreview(note, 150)
    if (specialPreview) return specialPreview
    const plainText = htmlToPlainText(note.content)
    return truncateText(plainText, 150)
  }, [note.content, note.noteType, note.noteData])

  const getTagColor = (tagName) => {
    const tag = tags.find((t) => t.name === tagName)
    return tag?.color || '#6b7280'
  }

  return (
    <div
      onClick={onClick}
      onContextMenu={onContextMenu}
      className={`group relative flex flex-col p-4 bg-white dark:bg-gray-900 rounded-2xl border cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 ${
        isSelected
          ? 'border-emerald-500/60 ring-2 ring-emerald-500/20 shadow-md'
          : 'border-[#cbd1db] dark:border-gray-700 hover:border-emerald-200 dark:hover:border-emerald-800'
      }`}
    >
      {note.pinned && (
        <div className="absolute -top-1 -right-1">
          <Pin className="w-4 h-4 text-primary-500 fill-primary-500" />
        </div>
      )}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="flex-1 font-semibold text-gray-900 dark:text-white line-clamp-2">
          {note.title}
        </h3>
        <button
          onClick={(e) => {
            e.stopPropagation()
            toggleStar(note.id)
          }}
          className="p-1 transition-opacity rounded opacity-0 group-hover:opacity-100 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <Star
            className={`w-4 h-4 ${
              note.starred
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-gray-400'
            }`}
          />
        </button>
      </div>
      <p className="flex-1 mb-3 text-sm text-gray-600 dark:text-gray-400 line-clamp-4">
        {preview || 'No content'}
      </p>
      {note.tags && note.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {note.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="px-1.5 py-0.5 rounded text-[10px] font-medium"
              style={{
                backgroundColor: `${getTagColor(tag)}20`,
                color: getTagColor(tag),
              }}
            >
              #{tag}
            </span>
          ))}
          {note.tags.length > 3 && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium text-gray-500 bg-gray-100 dark:bg-gray-700">
              +{note.tags.length - 3}
            </span>
          )}
        </div>
      )}
      <div className="flex items-center gap-2 pt-2 text-xs text-emerald-600 border-t border-gray-100 dark:border-gray-700 dark:text-emerald-400">
        <Clock className="w-3 h-3" />
        <span>{formatDate(note.updatedAt, language)}</span>
      </div>
    </div>
  )
}

export default function NotesGrid() {
  const {
    notes,
    folders,
    tags,
    selectedNoteId,
    selectedFolderId,
    selectedTagFilter,
    searchQuery,
    setSearchQuery,
    setSelectedNote,
    createNote,
  } = useNotesStore()

  const { currentSort, setCurrentSort, sidebarOpen } = useUIStore()
  const { t } = useTranslation()

  const [showingEditor, setShowingEditor] = useState(false)
  const [contextMenu, setContextMenu] = useState(null)

  useEffect(() => {
    if (selectedNoteId) {
      setShowingEditor(true)
    }
  }, [selectedNoteId])

  const filteredNotes = useMemo(() => {
    let result = notes.filter((note) => !note.deleted && !note.archived)

    if (selectedTagFilter === '__starred__') {
      result = result.filter((note) => note.starred)
    } else if (selectedTagFilter) {
      result = result.filter((note) => note.tags?.includes(selectedTagFilter))
    }

    if (selectedFolderId) {
      result = result.filter((note) => note.folderId === selectedFolderId)
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(
        (note) =>
          note.title.toLowerCase().includes(query) ||
          htmlToPlainText(note.content).toLowerCase().includes(query) ||
          note.tags?.some((tag) => tag.toLowerCase().includes(query))
      )
    }

    return sortNotes(result, currentSort)
  }, [notes, selectedFolderId, selectedTagFilter, searchQuery, currentSort])

  const handleNoteClick = (note) => {
    setSelectedNote(note.id)
    setShowingEditor(true)
  }

  const handleContextMenu = (e, note) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, note })
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
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/90 backdrop-blur-sm">
          <button
            onClick={handleBackToGrid}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Grid
          </button>
          <span className="text-sm text-gray-400 dark:text-gray-500">|</span>
          <span className="text-sm text-gray-500 dark:text-gray-400">{getTitle()}</span>
        </div>
        <div className="flex-1 min-h-0">
          <NoteEditor />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col w-full h-full bg-white dark:bg-gray-950">
      <div className="z-20 flex-shrink-0 px-6 py-4 border-b border-[#cbd1db] dark:border-gray-700 bg-white dark:bg-gray-950">
        <div className="flex items-center justify-between mb-4">
          <h2 className={`pl-10 text-[15px] font-bold tracking-tight text-gray-900 ${sidebarOpen ? 'md:pl-0' : ''} dark:text-white`}>
            {getTitle()}
          </h2>
          <div className="flex items-center gap-2">
            <SortDropdown currentSort={currentSort} onSortChange={setCurrentSort} />
            <button
              onClick={handleCreateNote}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white transition-all rounded-xl shadow-md shadow-emerald-500/15 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              New Note
            </button>
          </div>
        </div>
        <div className="relative max-w-md">
          <Search className="absolute w-4 h-4 text-gray-400 -translate-y-1/2 left-3 top-1/2" />
          <input
            type="text"
            placeholder={t('notes.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full py-2.5 pl-10 pr-4 text-[13px] text-gray-900 placeholder-gray-400 bg-gray-50/80 border border-gray-100 rounded-xl dark:bg-gray-900 dark:border-gray-800/60 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:text-white transition-all"
          />
        </div>
      </div>
      <div className="flex-1 min-h-0 p-6 overflow-y-auto">
        {filteredNotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="flex items-center justify-center w-20 h-20 mb-5 rounded-2xl bg-gray-50 dark:bg-gray-900">
              <FileText className="w-10 h-10 text-gray-300 dark:text-gray-600" />
            </div>
            <p className="text-base font-semibold text-gray-500 dark:text-gray-400">
              {searchQuery ? t('notes.noNotesFound') : t('notes.noNotes')}
            </p>
            {!searchQuery && (
              <button
                onClick={handleCreateNote}
                className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 transition-all shadow-md shadow-emerald-500/15 active:scale-[0.98]"
              >
                {t('notes.createFirst')}
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {filteredNotes.map((note) => (
              <GridNoteCard
                key={note.id}
                note={note}
                isSelected={selectedNoteId === note.id}
                onClick={() => handleNoteClick(note)}
                onContextMenu={(e) => handleContextMenu(e, note)}
              />
            ))}
          </div>
        )}
      </div>
      <div className="flex-shrink-0 px-6 py-3 text-[11px] text-center text-gray-300 border-t border-[#cbd1db] dark:border-gray-700 dark:text-gray-600 font-semibold">
        {filteredNotes.length} {filteredNotes.length === 1 ? t('notes.note') : t('notes.notes')}
      </div>
      {contextMenu && createPortal(
        <NoteContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          note={contextMenu.note}
          folders={folders}
          tags={tags}
          onClose={() => setContextMenu(null)}
        />,
        document.body
      )}
    </div>
  )
}
