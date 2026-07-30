import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Copy,
  Info,
  FileText,
  FolderInput,
  GripVertical,
  LayoutGrid,
  List,
  Pin,
  PinOff,
  Plus,
  Search,
  Star,
  StarOff,
  Tag,
  Trash2,
  X,
} from 'lucide-react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useNotesStore, useUIStore } from '../store'
import { useTranslation } from '../lib/useTranslation'
import { groupNotesByDate } from '../lib/utils'
import { filterNotes, STARRED_FILTER } from '../lib/filterNotes'
import SortDropdown, { sortNotes } from './SortDropdown'
import NotePreviewPopover from './NotePreviewPopover'
import NoteCard from './NoteCard'
import { Button, IconButton, Input, Menu, MenuItem, MenuSeparator, MenuLabel, EmptyState } from './ui'
import { ConfirmDialog } from './FolderDialogs'

function NoteContextMenu({ point, notes: targets, onClose, folders, tags }) {
  const { toggleStar, togglePin, duplicateNote, deleteNote, moveNote, addTagToNote, removeTagFromNote } =
    useNotesStore()
  const confirmBeforeDelete = useUIStore((s) => s.confirmBeforeDelete)
  const [submenu, setSubmenu] = useState(null)
  const [confirming, setConfirming] = useState(false)

  const count = targets.length
  const allPinned = targets.every((n) => n.pinned)
  const allStarred = targets.every((n) => n.starred)
  const commonTags = targets.reduce(
    (acc, note, i) => (i === 0 ? note.tags || [] : acc.filter((tag) => note.tags?.includes(tag))),
    []
  )

  const run = (fn) => () => {
    fn()
    onClose()
  }

  const doDelete = () => {
    targets.forEach((n) => deleteNote(n.id))
    onClose()
  }

  if (submenu === 'folder') {
    return (
      <Menu open onClose={onClose} point={point} label="Move to folder" width={220}>
        <MenuLabel>Move to folder</MenuLabel>
        <MenuItem onClick={run(() => targets.forEach((n) => moveNote(n.id, null)))}>No folder</MenuItem>
        {folders.map((folder) => (
          <MenuItem
            key={folder.id}
            onClick={run(() => targets.forEach((n) => moveNote(n.id, folder.id)))}
          >
            {folder.name}
          </MenuItem>
        ))}
      </Menu>
    )
  }

  if (submenu === 'tag') {
    return (
      <Menu open onClose={onClose} point={point} label="Assign tags" width={220}>
        <MenuLabel>Assign tags</MenuLabel>
        {tags.length === 0 && <p className="px-2.5 py-2 text-ui-sm text-content-subtle">No tags yet</p>}
        {tags.map((tag) => {
          const applied = commonTags.includes(tag.name)
          return (
            <MenuItem
              key={tag.id}
              selected={applied}
              onClick={() =>
                targets.forEach((n) =>
                  applied ? removeTagFromNote(n.id, tag.name) : addTagToNote(n.id, tag.name)
                )
              }
            >
              <span className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: tag.color }}
                  aria-hidden="true"
                />
                #{tag.name}
              </span>
            </MenuItem>
          )
        })}
      </Menu>
    )
  }

  return (
    <>
      <Menu open={!confirming} onClose={onClose} point={point} label="Note actions" width={235}>
        {count > 1 && <MenuLabel>{count} notes selected</MenuLabel>}
        <MenuItem icon={allPinned ? PinOff : Pin} onClick={run(() => targets.forEach((n) => togglePin(n.id)))}>
          {allPinned ? 'Unpin' : 'Pin to top'}
        </MenuItem>
        <MenuItem
          icon={allStarred ? StarOff : Star}
          onClick={run(() => targets.forEach((n) => toggleStar(n.id)))}
        >
          {allStarred ? 'Remove from favourites' : 'Add to favourites'}
        </MenuItem>
        <MenuSeparator />
        <MenuItem icon={Copy} onClick={run(() => targets.forEach((n) => duplicateNote(n.id)))}>
          Duplicate
        </MenuItem>
        <MenuItem icon={FolderInput} onClick={() => setSubmenu('folder')}>
          Move to folder…
        </MenuItem>
        <MenuItem icon={Tag} onClick={() => setSubmenu('tag')}>
          Assign tags…
        </MenuItem>
        <MenuSeparator />
        <MenuItem
          icon={Trash2}
          tone="danger"
          onClick={() => (confirmBeforeDelete ? setConfirming(true) : doDelete())}
        >
          {count > 1 ? `Move ${count} notes to trash` : 'Move to trash'}
        </MenuItem>
      </Menu>

      <ConfirmDialog
        open={confirming}
        onClose={onClose}
        onConfirm={doDelete}
        icon={Trash2}
        title={count > 1 ? `Move ${count} notes to trash?` : 'Move note to trash?'}
        description="You can restore it from Trash until it is permanently deleted."
        confirmLabel="Move to trash"
      />
    </>
  )
}

function SortableNoteRow({ note, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: note.id,
  })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? 'opacity-50' : ''}
    >
      {children(
        <span
          {...attributes}
          {...listeners}
          className="absolute left-0 top-0 z-10 flex h-full w-5 cursor-grab items-center justify-center text-content-subtle opacity-0 transition-opacity duration-fast hover:opacity-100 focus-visible:opacity-100 active:cursor-grabbing"
          aria-label={`Reorder ${note.title}`}
        >
          <GripVertical className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
      )}
    </div>
  )
}

export default function NotesList({ sidebarToggle, onOpenNote }) {
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
    reorderNotes,
  } = useNotesStore()

  const { currentSort, setCurrentSort, viewMode, setViewMode } = useUIStore()
  const { t } = useTranslation()

  const [contextMenu, setContextMenu] = useState(null)
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [lastClickedId, setLastClickedId] = useState(null)
  const listRef = useRef(null)
  const searchRef = useRef(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const visibleNotes = useMemo(() => {
    const filtered = filterNotes(notes, {
      folderId: selectedFolderId,
      tagFilter: selectedTagFilter,
      query: searchQuery,
    })
    return sortNotes(filtered, currentSort)
  }, [notes, selectedFolderId, selectedTagFilter, searchQuery, currentSort])

  const groups = useMemo(
    () =>
      groupNotesByDate(visibleNotes, {
        sort: currentSort,
        labels: {
          pinned: t('notes.pinned', 'Pinned'),
          today: t('notes.today', 'Today'),
          yesterday: t('notes.yesterday', 'Yesterday'),
          week: t('notes.previousWeek', 'Previous 7 days'),
          earlier: t('notes.earlier', 'Earlier'),
        },
      }),
    [visibleNotes, currentSort, t]
  )

  useEffect(() => {
    setSelectedIds(new Set())
    setLastClickedId(null)
  }, [selectedFolderId, selectedTagFilter, searchQuery])

  const handleNoteClick = useCallback(
    (e, note, index) => {
      if (e.ctrlKey || e.metaKey) {
        setSelectedIds((prev) => {
          const next = new Set(prev)
          if (next.has(note.id)) next.delete(note.id)
          else next.add(note.id)
          return next
        })
        setLastClickedId(note.id)
        return
      }
      if (e.shiftKey && lastClickedId) {
        const from = visibleNotes.findIndex((n) => n.id === lastClickedId)
        if (from !== -1) {
          const [start, end] = from < index ? [from, index] : [index, from]
          setSelectedIds(new Set(visibleNotes.slice(start, end + 1).map((n) => n.id)))
          return
        }
      }
      setSelectedIds(new Set())
      setSelectedNote(note.id)
      setLastClickedId(note.id)
      onOpenNote?.()
    },
    [lastClickedId, visibleNotes, setSelectedNote, onOpenNote]
  )

  /**
   * Up/Down move between notes; Escape clears a multi-selection.
   * Scoped to the list rather than `document`, so it cannot fight the
   * editor or an open dialog for arrow keys.
   */
  const handleListKeyDown = (e) => {
    if (e.key === 'Escape' && selectedIds.size > 0) {
      setSelectedIds(new Set())
      return
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    const items = Array.from(listRef.current?.querySelectorAll('.note-card') || [])
    if (!items.length) return
    e.preventDefault()
    const index = items.indexOf(document.activeElement)
    const next = e.key === 'ArrowDown' ? Math.min(index + 1, items.length - 1) : Math.max(index - 1, 0)
    items[next === -1 ? 0 : next].focus()
  }

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return
    const oldIndex = visibleNotes.findIndex((n) => n.id === active.id)
    const newIndex = visibleNotes.findIndex((n) => n.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    reorderNotes(arrayMove(visibleNotes, oldIndex, newIndex).map((n) => n.id))
  }

  const handleCreateNote = () => {
    createNote({ title: t('notes.newNote'), content: '', folderId: selectedFolderId })
    onOpenNote?.()
  }

  const title = useMemo(() => {
    if (selectedTagFilter === STARRED_FILTER) return t('sidebar.favorites')
    if (selectedTagFilter) return `#${selectedTagFilter}`
    if (selectedFolderId) {
      return folders.find((f) => f.id === selectedFolderId)?.name || t('sidebar.folders')
    }
    return t('sidebar.allNotes')
  }, [selectedTagFilter, selectedFolderId, folders, t])

  const isManualSort = currentSort === 'manual'
  let flatIndex = -1

  const renderCard = (note, dragHandle) => {
    flatIndex += 1
    const index = flatIndex
    return (
      <NotePreviewPopover key={note.id} noteId={note.id}>
        <NoteCard
          note={note}
          dragHandle={dragHandle}
          isSelected={selectedNoteId === note.id}
          isMultiSelected={selectedIds.has(note.id)}
          onClick={(e) => handleNoteClick(e, note, index)}
          onContextMenu={(e) => {
            e.preventDefault()
            const targets =
              selectedIds.size > 1 && selectedIds.has(note.id)
                ? visibleNotes.filter((n) => selectedIds.has(n.id))
                : [note]
            setContextMenu({ point: { x: e.clientX, y: e.clientY }, notes: targets })
          }}
        />
      </NotePreviewPopover>
    )
  }

  const listBody = groups.map((group) => (
    <li key={group.id}>
      {group.label && (
        <h3 className="sticky top-0 z-sticky flex items-center gap-1.5 bg-panel/95 px-4 pb-1 pt-3 text-ui-sm font-semibold text-content-muted backdrop-blur">
          {group.id === 'pinned' && <Pin className="h-3 w-3 shrink-0" aria-hidden="true" />}
          {group.label}
        </h3>
      )}
      <ul className="group/list">
        {group.notes.map((note) =>
          isManualSort ? (
            <SortableNoteRow key={note.id} note={note}>
              {(handle) => renderCard(note, handle)}
            </SortableNoteRow>
          ) : (
            renderCard(note)
          )
        )}
      </ul>
    </li>
  ))

  return (
    <section aria-label={title} className="flex h-full w-full min-w-0 flex-col bg-panel">
      <div className="shrink-0 px-3 pb-2.5 pt-3">
        <div className="mb-2.5 flex items-center gap-1.5">
          {sidebarToggle}
          <h2 className="min-w-0 flex-1 truncate text-title-sm font-semibold text-content">{title}</h2>
          <span className="shrink-0 rounded-full bg-surface-sunken px-2 py-0.5 text-ui-xs font-medium tabular-nums text-content-muted">
            {visibleNotes.length}
          </span>
          <SortDropdown currentSort={currentSort} onSortChange={setCurrentSort} />
          <IconButton
            icon={Plus}
            variant="primary"
            label={t('notes.createNew', 'New note')}
            onClick={handleCreateNote}
          />
        </div>

        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-content-subtle"
            aria-hidden="true"
          />
          <Input
            ref={searchRef}
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('notes.searchPlaceholder')}
            aria-label={t('notes.searchPlaceholder')}
            className="pl-8 pr-8"
          />
          {searchQuery ? (
            <IconButton
              icon={X}
              size="sm"
              label="Clear search"
              onClick={() => {
                setSearchQuery('')
                searchRef.current?.focus()
              }}
              className="absolute right-1 top-1/2 -translate-y-1/2"
            />
          ) : (
            <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-subtle bg-surface-sunken px-1.5 py-0.5 text-ui-xs font-medium text-content-subtle">
              Ctrl F
            </kbd>
          )}
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex shrink-0 items-center justify-between gap-2 border-y border-subtle bg-info-soft px-3 py-1.5">
          <span className="text-ui-sm font-medium text-info-text">{selectedIds.size} selected</span>
          <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
            Clear
          </Button>
        </div>
      )}

      <div
        ref={listRef}
        onKeyDown={handleListKeyDown}
        className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain border-t border-subtle"
      >
        {visibleNotes.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={searchQuery ? t('notes.noNotesFound') : t('notes.noNotes')}
            description={
              searchQuery
                ? t('notes.noNotesFoundHint', 'Try a different search term or clear the filter.')
                : t('notes.noNotesHint', 'Create your first note to get started.')
            }
            action={
              searchQuery ? (
                <Button variant="secondary" onClick={() => setSearchQuery('')}>
                  Clear search
                </Button>
              ) : (
                <Button variant="primary" icon={Plus} onClick={handleCreateNote}>
                  {t('notes.createFirst')}
                </Button>
              )
            }
          />
        ) : isManualSort ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={visibleNotes.map((n) => n.id)} strategy={verticalListSortingStrategy}>
              <ul>{listBody}</ul>
            </SortableContext>
          </DndContext>
        ) : (
          <ul>{listBody}</ul>
        )}
      </div>

      <div className="qn-safe-bottom flex shrink-0 items-center justify-between gap-2 border-t border-subtle px-3 py-1.5">
        <span className="flex items-center gap-1.5 text-ui-sm text-content-subtle">
          <Info className="h-3.5 w-3.5" aria-hidden="true" />
          {visibleNotes.length} {visibleNotes.length === 1 ? t('notes.note') : t('notes.notes')}
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
            className={`flex h-6 w-7 items-center justify-center rounded-[6px] transition-colors duration-fast ${
              viewMode === 'list'
                ? 'bg-surface-raised text-content shadow-xs'
                : 'text-content-subtle hover:text-content'
            }`}
          >
            <List className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            aria-pressed={viewMode === 'grid'}
            aria-label="Grid view"
            title="Grid view"
            className={`flex h-6 w-7 items-center justify-center rounded-[6px] transition-colors duration-fast ${
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
          notes={contextMenu.notes}
          folders={folders}
          tags={tags}
          onClose={() => setContextMenu(null)}
        />
      )}
    </section>
  )
}
