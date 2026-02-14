import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  Plus,
  Search,
  Star,
  Pin,
  Clock,
  Tag,
  Copy,
  Trash2,
  FolderInput,
  PinOff,
  StarOff,
  GripVertical,
  ChevronRight,
  FileText,
  CheckSquare
} from 'lucide-react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useNotesStore, useUIStore } from '../store'
import { formatDate, htmlToPlainText, truncateText, getNoteTypePreview } from '../lib/utils'
import { useTranslation } from '../lib/useTranslation'
import SortDropdown, { sortNotes } from './SortDropdown'
import NotePreviewPopover from './NotePreviewPopover'

function NoteContextMenu({ x, y, note, notes: selectedNotes, onClose, folders, tags, isBulkMode }) {
  const menuRef = useRef(null)
  const folderButtonRef = useRef(null)
  const tagButtonRef = useRef(null)
  const submenuRef = useRef(null)
  const tagSubmenuRef = useRef(null)
  const hoverTimeoutRef = useRef(null)
  const tagHoverTimeoutRef = useRef(null)
  const { toggleStar, togglePin, duplicateNote, deleteNote, updateNote, addTagToNote, removeTagFromNote, createTag } = useNotesStore()
  const { confirmBeforeDelete } = useUIStore()
  const { t } = useTranslation()
  const [showFolderMenu, setShowFolderMenu] = useState(false)
  const [showTagMenu, setShowTagMenu] = useState(false)
  const [position, setPosition] = useState({ x, y })
  const [submenuPosition, setSubmenuPosition] = useState({ x: 0, y: 0, openLeft: false })
  const [tagSubmenuPosition, setTagSubmenuPosition] = useState({ x: 0, y: 0, openLeft: false })
  const [maxHeight, setMaxHeight] = useState('auto')

  const notesToProcess = isBulkMode && selectedNotes.length > 0 ? selectedNotes : [note]

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
      if (tagHoverTimeoutRef.current) clearTimeout(tagHoverTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    const handleClickOutside = (e) => {
      const clickedInMenu = menuRef.current?.contains(e.target)
      const clickedInSubmenu = submenuRef.current?.contains(e.target)
      const clickedInTagSubmenu = tagSubmenuRef.current?.contains(e.target)
      if (!clickedInMenu && !clickedInSubmenu && !clickedInTagSubmenu) {
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

  useEffect(() => {
    if (showTagMenu && tagButtonRef.current) {
      const buttonRect = tagButtonRef.current.getBoundingClientRect()
      const menuRect = menuRef.current?.getBoundingClientRect()
      const padding = 10
      const submenuWidth = 180
      const submenuHeight = Math.min(300, (tags.length + 1) * 36 + 8)
      
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
      
      setTagSubmenuPosition({ x: subX, y: subY, openLeft })
    }
  }, [showTagMenu, tags.length])

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

  const handleTagButtonEnter = () => {
    if (tagHoverTimeoutRef.current) clearTimeout(tagHoverTimeoutRef.current)
    setShowTagMenu(true)
  }

  const handleTagButtonLeave = () => {
    tagHoverTimeoutRef.current = setTimeout(() => {
      setShowTagMenu(false)
    }, 150)
  }

  const handleTagSubmenuEnter = () => {
    if (tagHoverTimeoutRef.current) clearTimeout(tagHoverTimeoutRef.current)
  }

  const handleTagSubmenuLeave = () => {
    tagHoverTimeoutRef.current = setTimeout(() => {
      setShowTagMenu(false)
    }, 150)
  }

  const handleAction = (action) => {
    action()
    onClose()
  }

  const handleBulkPin = () => {
    const allPinned = notesToProcess.every(n => n.pinned)
    notesToProcess.forEach(n => {
      if (allPinned || !n.pinned) togglePin(n.id)
    })
  }

  const handleBulkStar = () => {
    const allStarred = notesToProcess.every(n => n.starred)
    notesToProcess.forEach(n => {
      if (allStarred || !n.starred) toggleStar(n.id)
    })
  }

  const handleBulkDuplicate = () => {
    notesToProcess.forEach(n => duplicateNote(n.id))
  }

  const handleBulkDelete = () => {
    if (confirmBeforeDelete && !window.confirm(t('settings.confirmDeleteMessage'))) return
    notesToProcess.forEach(n => deleteNote(n.id))
  }

  const handleBulkMoveToFolder = (folderId) => {
    notesToProcess.forEach(n => updateNote(n.id, { folderId }))
  }

  const handleBulkAddTag = (tagName) => {
    notesToProcess.forEach(n => {
      if (!n.tags?.includes(tagName)) {
        addTagToNote(n.id, tagName)
      }
    })
  }

  const handleBulkRemoveTag = (tagName) => {
    notesToProcess.forEach(n => {
      if (n.tags?.includes(tagName)) {
        removeTagFromNote(n.id, tagName)
      }
    })
  }

  const commonTags = notesToProcess.reduce((common, n, index) => {
    if (index === 0) return n.tags || []
    return common.filter(tag => n.tags?.includes(tag))
  }, [])

  const allPinned = notesToProcess.every(n => n.pinned)
  const allStarred = notesToProcess.every(n => n.starred)
  const noteCount = notesToProcess.length

  return (
    <div
      ref={menuRef}
      className="fixed z-[9999] bg-white dark:bg-gray-900 rounded-2xl shadow-xl shadow-black/5 dark:shadow-black/20 border border-[#cbd1db] dark:border-gray-700 py-1.5 min-w-[200px] backdrop-blur-xl overflow-y-auto"
      style={{ left: position.x, top: position.y, maxHeight: maxHeight }}
    >
      {isBulkMode && noteCount > 1 && (
        <>
          <div className="px-3 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
            {noteCount} notes selected
          </div>
          <div className="h-px my-1 bg-gray-200 dark:bg-gray-700" />
        </>
      )}
      <button
        onClick={() => handleAction(handleBulkPin)}
        className="flex items-center w-[calc(100%-12px)] gap-3 mx-1.5 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700/50 dark:text-gray-300 transition-colors rounded-lg"
      >
        {allPinned ? <PinOff className="w-4 h-4 text-gray-400" /> : <Pin className="w-4 h-4 text-gray-400" />}
        <span>{allPinned ? 'Unpin' : 'Pin to Top'}</span>
      </button>
      <button
        onClick={() => handleAction(handleBulkStar)}
        className="flex items-center w-[calc(100%-12px)] gap-3 mx-1.5 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700/50 dark:text-gray-300 transition-colors rounded-lg"
      >
        {allStarred ? <StarOff className="w-4 h-4 text-gray-400" /> : <Star className="w-4 h-4 text-gray-400" />}
        <span>{allStarred ? 'Remove from Favorites' : 'Add to Favorites'}</span>
      </button>
      
      <div className="my-1.5 mx-3 border-t border-gray-100 dark:border-gray-800" />
      
      <button
        onClick={() => handleAction(handleBulkDuplicate)}
        className="flex items-center w-[calc(100%-12px)] gap-3 mx-1.5 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700/50 dark:text-gray-300 transition-colors rounded-lg"
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
          className={`flex items-center justify-between w-full px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700/50 dark:text-gray-300 transition-colors rounded-lg ${showFolderMenu ? 'bg-gray-200 dark:bg-gray-700/50' : ''}`}
        >
          <div className="flex items-center gap-3">
            <FolderInput className="w-4 h-4" />
            <span className="text-sm">Move to Folder</span>
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
              onClick={() => handleAction(() => handleBulkMoveToFolder(null))}
              className={`w-[calc(100%-12px)] mx-1.5 px-3 py-2.5 text-left text-sm hover:bg-gray-200 dark:hover:bg-gray-700/50 transition-colors rounded-lg ${
                !isBulkMode && !note.folderId ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-700 dark:text-gray-300'
              }`}
            >
              No Folder
            </button>
            {folders.map((folder) => (
              <button
                key={folder.id}
                onClick={() => handleAction(() => handleBulkMoveToFolder(folder.id))}
                className={`w-[calc(100%-12px)] mx-1.5 px-3 py-2.5 text-left text-sm hover:bg-gray-200 dark:hover:bg-gray-700/50 transition-colors rounded-lg ${
                  !isBulkMode && note.folderId === folder.id ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-700 dark:text-gray-300'
                }`}
              >
                {folder.name}
              </button>
            ))}
          </div>,
          document.body
        )}
      </div>
      <div 
        className="relative mx-1.5"
        onMouseEnter={handleTagButtonEnter}
        onMouseLeave={handleTagButtonLeave}
      >
        <button
          ref={tagButtonRef}
          onClick={() => setShowTagMenu(!showTagMenu)}
          className={`flex items-center justify-between w-full px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700/50 dark:text-gray-300 transition-colors rounded-lg ${showTagMenu ? 'bg-gray-200 dark:bg-gray-700/50' : ''}`}
        >
          <div className="flex items-center gap-3">
            <Tag className="w-4 h-4" />
            <span className="text-sm">Assign Tags</span>
          </div>
          <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${tagSubmenuPosition.openLeft ? 'rotate-180' : ''}`} />
        </button>
        {showTagMenu && createPortal(
          <div 
            ref={tagSubmenuRef}
            onMouseEnter={handleTagSubmenuEnter}
            onMouseLeave={handleTagSubmenuLeave}
            className="fixed bg-white dark:bg-gray-900 rounded-2xl shadow-xl shadow-black/5 dark:shadow-black/20 border border-[#cbd1db] dark:border-gray-700 py-1.5 min-w-[180px] max-h-[300px] overflow-y-auto z-[10000] backdrop-blur-xl"
            style={{
              left: tagSubmenuPosition.x,
              top: tagSubmenuPosition.y,
            }}
          >
            {tags.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 italic">
                No tags available
              </div>
            ) : (
              <>
                <div className="px-3 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  Click to toggle tag
                </div>
                {tags.map((tag) => {
                  const isApplied = isBulkMode 
                    ? commonTags.includes(tag.name)
                    : note.tags?.includes(tag.name)
                  const isPartiallyApplied = isBulkMode && !isApplied && notesToProcess.some(n => n.tags?.includes(tag.name))
                  
                  return (
                    <button
                      key={tag.id}
                      onClick={() => {
                        if (isApplied) {
                          handleBulkRemoveTag(tag.name)
                        } else {
                          handleBulkAddTag(tag.name)
                        }
                      }}
                      className={`w-[calc(100%-12px)] mx-1.5 px-3 py-2.5 text-left text-sm hover:bg-gray-200 dark:hover:bg-gray-700/50 flex items-center gap-2 transition-colors rounded-lg ${
                        isApplied ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="flex-1 truncate">#{tag.name}</span>
                      {isApplied && (
                        <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                      {isPartiallyApplied && (
                        <span className="w-4 h-4 flex items-center justify-center">
                          <span className="w-2 h-0.5 bg-gray-400 rounded" />
                        </span>
                      )}
                    </button>
                  )
                })}
              </>
            )}
          </div>,
          document.body
        )}
      </div>
      
      <div className="my-1.5 mx-3 border-t border-gray-100 dark:border-gray-800" />
      
      <button
        onClick={() => handleAction(handleBulkDelete)}
        className="flex items-center w-[calc(100%-12px)] gap-3 mx-1.5 px-3 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 dark:text-red-400 transition-colors rounded-lg"
      >
        <Trash2 className="w-4 h-4" />
        <span>Delete{noteCount > 1 ? ` (${noteCount})` : ''}</span>
      </button>
    </div>
  )
}

export default function NotesList() {
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
    getFilteredNotes,
    reorderNotes,
  } = useNotesStore()

  const { currentSort, setCurrentSort, setMobileEditorOpen, sidebarOpen } = useUIStore()

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const [contextMenu, setContextMenu] = useState(null)
  
  const [selectedNoteIds, setSelectedNoteIds] = useState(new Set())
  const [lastClickedNoteId, setLastClickedNoteId] = useState(null)

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

  useEffect(() => {
    setSelectedNoteIds(new Set())
    setLastClickedNoteId(null)
  }, [selectedFolderId, selectedTagFilter, searchQuery])

  const handleContextMenu = (e, note) => {
    e.preventDefault()
    if (selectedNoteIds.size > 0 && !selectedNoteIds.has(note.id)) {
      setSelectedNoteIds(new Set())
    }
    const notesForContext = selectedNoteIds.size > 0 && selectedNoteIds.has(note.id) 
      ? filteredNotes.filter(n => selectedNoteIds.has(n.id))
      : [note]
    setContextMenu({ x: e.clientX, y: e.clientY, note, notes: notesForContext, isBulkMode: selectedNoteIds.size > 1 && selectedNoteIds.has(note.id) })
  }

  const handleNoteClick = useCallback((e, note, noteIndex) => {
    const isCtrlOrMeta = e.ctrlKey || e.metaKey
    const isShift = e.shiftKey

    if (isCtrlOrMeta) {
      setSelectedNoteIds(prev => {
        const newSet = new Set(prev)
        if (newSet.has(note.id)) {
          newSet.delete(note.id)
        } else {
          newSet.add(note.id)
        }
        return newSet
      })
      setLastClickedNoteId(note.id)
    } else if (isShift && lastClickedNoteId) {
      const lastIndex = filteredNotes.findIndex(n => n.id === lastClickedNoteId)
      if (lastIndex !== -1) {
        const start = Math.min(lastIndex, noteIndex)
        const end = Math.max(lastIndex, noteIndex)
        const rangeIds = filteredNotes.slice(start, end + 1).map(n => n.id)
        setSelectedNoteIds(new Set(rangeIds))
      }
    } else if (isShift && !lastClickedNoteId) {
      setSelectedNoteIds(new Set([note.id]))
      setLastClickedNoteId(note.id)
    } else {
      setSelectedNoteIds(new Set())
      setSelectedNote(note.id)
      setMobileEditorOpen(true)
      setLastClickedNoteId(note.id)
    }
  }, [lastClickedNoteId, filteredNotes, setSelectedNote, setMobileEditorOpen])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && selectedNoteIds.size > 0) {
        setSelectedNoteIds(new Set())
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'a' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        const notesListEl = document.querySelector('[data-notes-list]')
        if (notesListEl?.contains(document.activeElement) || !document.activeElement || document.activeElement === document.body) {
          e.preventDefault()
          setSelectedNoteIds(new Set(filteredNotes.map(n => n.id)))
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [selectedNoteIds, filteredNotes])

  const handleDragEnd = (event) => {
    const { active, over } = event

    if (active.id !== over?.id) {
      const oldIndex = filteredNotes.findIndex((n) => n.id === active.id)
      const newIndex = filteredNotes.findIndex((n) => n.id === over?.id)
      
      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(filteredNotes, oldIndex, newIndex)
        reorderNotes(newOrder.map((n) => n.id))
      }
    }
  }

  const { t, language } = useTranslation()

  const handleCreateNote = () => {
    createNote({
      title: t('notes.newNote'),
      content: '',
      folderId: selectedFolderId,
    })
  }

  const getTitle = () => {
    if (selectedTagFilter === '__starred__') return t('sidebar.favorites')
    if (selectedTagFilter) return `#${selectedTagFilter}`
    if (selectedFolderId) {
      const folder = useNotesStore.getState().folders.find(
        (f) => f.id === selectedFolderId
      )
      return folder?.name || t('sidebar.folders')
    }
    return t('sidebar.allNotes')
  }

  return (
    <div className="flex flex-col w-full h-full border-r md:max-w-sm notes-list-premium border-[#cbd1db] dark:border-gray-800">
      <div className="flex-shrink-0 p-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <div className={`flex items-center gap-2.5 pl-10 ${sidebarOpen ? 'md:pl-0' : ''}`}>
            <h2 className="text-[15px] font-bold text-gray-900 truncate dark:text-white tracking-tight">
              {getTitle()}
            </h2>
            <span className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-md tabular-nums">
              {filteredNotes.length}
            </span>
          </div>
          <div className="flex items-center flex-shrink-0 gap-1">
            <SortDropdown currentSort={currentSort} onSortChange={setCurrentSort} />
            <button
              onClick={handleCreateNote}
              className="p-2 text-white transition-all rounded-xl shadow-md shadow-emerald-500/15 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 hover:shadow-lg hover:shadow-emerald-500/25 active:scale-95 btn-glow"
              title="Create new note"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute w-4 h-4 text-gray-300 dark:text-gray-600 -translate-y-1/2 left-3.5 top-1/2" />
          <input
            type="text"
            placeholder={t('notes.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full py-2.5 pl-10 pr-4 text-[13px] text-gray-900 placeholder-gray-400 bg-white dark:bg-gray-800/80 border border-gray-300 dark:border-gray-700 rounded-xl focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/10 dark:text-white transition-all font-medium shadow-sm input-enterprise"
          />
        </div>
      </div>
      <div className="h-px mx-4 bg-[#cbd1db] dark:bg-gray-700/60" />
      <div className="flex-1 min-h-0 overflow-x-hidden overflow-y-auto" data-notes-list>
        {selectedNoteIds.size > 0 && (
          <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-2 text-sm border-b bg-primary-50 dark:bg-primary-900/30 border-primary-200 dark:border-primary-700">
            <span className="font-medium text-primary-700 dark:text-primary-300">
              {selectedNoteIds.size} note{selectedNoteIds.size > 1 ? 's' : ''} selected
            </span>
            <button
              onClick={() => setSelectedNoteIds(new Set())}
              className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
            >
              Clear selection
            </button>
          </div>
        )}
        {filteredNotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <div className="relative mb-5 empty-state-glow">
              <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100/80 dark:from-gray-800 dark:to-gray-900 shadow-sm">
                <FileText className="w-7 h-7 text-gray-200 dark:text-gray-700" />
              </div>
            </div>
            <p className="text-[13px] font-semibold text-gray-400 dark:text-gray-500 mb-1">
              {searchQuery
                ? t('notes.noNotesFound')
                : t('notes.noNotes')}
            </p>
            <p className="text-[12px] text-gray-300 dark:text-gray-600 max-w-[200px]">
              {searchQuery ? 'Try a different search term' : 'Create your first note to get started'}
            </p>
            {!searchQuery && (
              <button
                onClick={handleCreateNote}
                className="mt-4 inline-flex items-center gap-1.5 px-5 py-2.5 text-sm font-semibold text-white rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 transition-all shadow-md shadow-emerald-500/15 hover:shadow-lg hover:shadow-emerald-500/20 active:scale-[0.98]"
              >
                <Plus className="w-4 h-4" />
                {t('notes.createFirst')}
              </button>
            )}
          </div>
        ) : currentSort === 'manual' ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={filteredNotes.map(n => n.id)} strategy={verticalListSortingStrategy}>
              {filteredNotes.map((note, index) => (
                <NotePreviewPopover key={note.id} noteId={note.id}>
                  <SortableNoteCard
                    note={note}
                    isSelected={selectedNoteId === note.id}
                    isMultiSelected={selectedNoteIds.has(note.id)}
                    onClick={(e) => handleNoteClick(e, note, index)}
                    onContextMenu={(e) => handleContextMenu(e, note)}
                  />
                </NotePreviewPopover>
              ))}
            </SortableContext>
          </DndContext>
        ) : (
          filteredNotes.map((note, index) => (
            <NotePreviewPopover key={note.id} noteId={note.id}>
              <NoteCard
                note={note}
                isSelected={selectedNoteId === note.id}
                isMultiSelected={selectedNoteIds.has(note.id)}
                onClick={(e) => handleNoteClick(e, note, index)}
                onContextMenu={(e) => handleContextMenu(e, note)}
              />
            </NotePreviewPopover>
          ))
        )}
      </div>
      {contextMenu && createPortal(
        <NoteContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          note={contextMenu.note}
          notes={contextMenu.notes}
          folders={folders}
          tags={tags}
          isBulkMode={contextMenu.isBulkMode}
          onClose={() => {
            setContextMenu(null)
            if (contextMenu.isBulkMode) {
              setSelectedNoteIds(new Set())
            }
          }}
        />,
        document.body
      )}
      <div className="flex-shrink-0 flex items-center justify-center px-6 py-2.5 text-xs text-gray-500 dark:text-gray-400 border-t border-[#cbd1db] dark:border-gray-800 font-medium">
        {filteredNotes.length} {filteredNotes.length === 1 ? (t('notes.note').charAt(0).toUpperCase() + t('notes.note').slice(1)) : (t('notes.notes').charAt(0).toUpperCase() + t('notes.notes').slice(1))}
      </div>
    </div>
  )
}

function NoteCard({ note, isSelected, isMultiSelected, onClick, onContextMenu, isDragging }) {
  const { tags } = useNotesStore()
  const { toggleStar, togglePin } = useNotesStore()
  const { language } = useTranslation()

  const preview = useMemo(() => {
    const specialPreview = getNoteTypePreview(note, 100)
    if (specialPreview) return specialPreview
    const plainText = htmlToPlainText(note.content)
    return truncateText(plainText, 100)
  }, [note.content, note.noteType, note.noteData])

  const getTagColor = (tagName) => {
    const tag = tags.find((t) => t.name === tagName)
    return tag?.color || '#6b7280'
  }

  return (
    <div
      onClick={onClick}
      onContextMenu={onContextMenu}
      className={`note-card px-4 py-3.5 border-b border-[#cbd1db] dark:border-gray-700/60 cursor-pointer transition-all relative surface-hover ${
        isSelected
          ? 'bg-emerald-100 dark:bg-emerald-950/50 border-l-[3px] border-l-emerald-500 shadow-sm shadow-emerald-100 dark:shadow-emerald-950/20 card-selected'
          : isMultiSelected
          ? 'bg-blue-50/60 dark:bg-blue-950/30 border-l-[3px] border-l-blue-500'
          : 'dark:bg-gray-900/30 hover:bg-white/80 dark:hover:bg-gray-800/40 border-l-[3px] border-l-transparent'
      } ${isDragging ? 'opacity-50 shadow-lg scale-[1.02]' : ''}`}
    >
      {isMultiSelected && (
        <div className="absolute top-2.5 right-2.5">
          <CheckSquare className="w-4 h-4 text-blue-500" />
        </div>
      )}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <h3 className="flex-1 text-[14px] font-bold text-gray-900 dark:text-white line-clamp-1 tracking-tight leading-snug">
          {note.title}
        </h3>
        <div className={`flex items-center flex-shrink-0 gap-1 ${isMultiSelected ? 'mr-6' : ''}`}>
          {note.pinned && (
            <Pin className="w-3 h-3 text-emerald-500 fill-emerald-500" />
          )}
          <button
            onClick={(e) => {
              e.stopPropagation()
              toggleStar(note.id)
            }}
            className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all"
          >
            <Star
              className={`w-3.5 h-3.5 ${
                note.starred
                  ? 'fill-amber-400 text-amber-400'
                  : 'text-gray-200 dark:text-gray-700'
              }`}
            />
          </button>
        </div>
      </div>
      <p className="mb-2.5 text-[13px] leading-relaxed text-gray-400 dark:text-gray-500 line-clamp-2">
        {preview || 'Empty note'}
      </p>
      {note.tags && note.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2.5">
          {note.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 rounded-md text-[10px] font-semibold"
              style={{
                backgroundColor: `${getTagColor(tag)}12`,
                color: getTagColor(tag),
              }}
            >
              #{tag}
            </span>
          ))}
          {note.tags.length > 3 && (
            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold text-gray-400 bg-gray-100/80 dark:bg-gray-800">
              +{note.tags.length - 3}
            </span>
          )}
        </div>
      )}
      <div className="flex items-center gap-2 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
        <Clock className="w-3 h-3 flex-shrink-0" />
        <span>{formatDate(note.updatedAt, language)}</span>
      </div>
    </div>
  )
}

function SortableNoteCard({ note, isSelected, isMultiSelected, onClick, onContextMenu }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: note.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      <div
        {...attributes}
        {...listeners}
        className="absolute top-0 bottom-0 left-0 z-10 flex items-center justify-center w-6 transition-opacity opacity-0 cursor-grab active:cursor-grabbing group-hover:opacity-100 bg-gradient-to-r from-gray-100 dark:from-gray-800 to-transparent"
      >
        <GripVertical className="w-4 h-4 text-gray-400" />
      </div>
      <NoteCard
        note={note}
        isSelected={isSelected}
        isMultiSelected={isMultiSelected}
        onClick={onClick}
        onContextMenu={onContextMenu}
        isDragging={isDragging}
      />
    </div>
  )
}
