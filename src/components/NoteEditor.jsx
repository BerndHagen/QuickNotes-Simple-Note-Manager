import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Archive,
  ArrowLeft,
  Bell,
  ChevronDown,
  Check,
  Clock,
  Copy,
  Download,
  Eye,
  FileText,
  Focus,
  FolderOpen,
  History,
  Image as ImageIcon,
  Link2,
  Mic,
  MoreVertical,
  Pin,
  Send,
  Plus,
  Search,
  Share2,
  Star,
  Tag,
  Trash2,
  Upload,
} from 'lucide-react'
import { useNotesStore, useUIStore, useThemeStore } from '../store'
import RichTextEditor from './RichTextEditor'
import FindReplaceBar from './FindReplaceBar'
import NoteStatistics from './NoteStatistics'
import NoteLinkPopover, { useNoteLinkHandler, useBacklinks } from './NoteLinkPopover'
import VoiceInput from './VoiceInput'
import ImageUploadModal from './ImageUploadModal'
import LinkInsertModal from './LinkInsertModal'
import HTMLEditorModal from './HTMLEditorModal'
import { formatDate, debounce } from '../lib/utils'
import { useTranslation } from '../lib/useTranslation'
import { saveNoteVersion } from '../lib/db'
import {
  advanceVersionCheckpoint,
  createVersionCheckpointTracker,
  createVersionSnapshot,
  versionSnapshotsEqual,
} from '../lib/versionCheckpoints'
import { insertTextIntoActiveField } from '../lib/textFieldInsertion'
import { useRealtimeCollaboration } from '../lib/useCollaboration'
import { getFolderIcon } from '../lib/folderIcons'
import { MAX_NOTE_TITLE_LENGTH, MAX_TAG_NAME_LENGTH } from '../lib/dataValidation'
import { IconButton, Input, Menu, MenuItem, MenuSeparator, EmptyState, TagChip } from './ui'
import { ConfirmDialog } from './FolderDialogs'
import { SyncStatusPill } from './SyncStatus'
import { isBackendConfigured } from '../lib/backend'
import toast from 'react-hot-toast'

import {
  hasSpecializedEditor,
  getEditorForNoteType,
  NOTE_TYPE_CONFIG,
  normalizeNoteData,
} from './editors'

export default function NoteEditor({ onBack, showBack = false }) {
  const { t, language } = useTranslation()
  const {
    folders,
    tags,
    getSelectedNote,
    updateNote,
    updateNoteDraft,
    deleteNote,
    toggleStar,
    togglePin,
    duplicateNote,
    moveNote,
    addTagToNote,
    removeTagFromNote,
    createTag,
    archiveNote,
    externalUpdate,
  } = useNotesStore()

  const {
    findReplaceOpen,
    setFindReplaceOpen,
    setReminderModalOpen,
    setExportModalOpen,
    setImportModalOpen,
    noteLinkPopoverOpen,
    setNoteLinkPopoverOpen,
    noteLinkPosition,
    setImageUploadOpen,
    setVersionHistoryOpen,
    setFocusModeOpen,
    voiceInputActive,
    setVoiceInputActive,
    setShareModalOpen,
    showNoteStatistics,
    confirmBeforeDelete,
  } = useUIStore()

  const note = getSelectedNote()
  const backlinks = useBacklinks(note?.id)
  useNoteLinkHandler()
  useRealtimeCollaboration(note?.id)

  const [title, setTitle] = useState('')
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [tagPickerOpen, setTagPickerOpen] = useState(false)
  const [folderPickerOpen, setFolderPickerOpen] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [showBacklinks, setShowBacklinks] = useState(false)
  const [editorRef, setEditorRef] = useState(null)
  const [specializedContextMenu, setSpecializedContextMenu] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const menuButtonRef = useRef(null)
  const tagButtonRef = useRef(null)
  const folderButtonRef = useRef(null)
  const titleInputRef = useRef(null)
  const versionTrackerRef = useRef(null)
  const versionBaselineRef = useRef(null)
  const lastExternalVersionTokenRef = useRef(0)

  const { theme } = useThemeStore()
  const isDarkMode =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  const [paperType, setPaperType] = useState(() => (isDarkMode ? 'dark' : 'plain'))
  const [userChangedPaper, setUserChangedPaper] = useState(false)

  useEffect(() => {
    if (!userChangedPaper) setPaperType(isDarkMode ? 'dark' : 'plain')
  }, [isDarkMode, userChangedPaper])

  const handlePaperTypeChange = (newType) => {
    setPaperType(newType)
    setUserChangedPaper(true)
  }

  const noteId = note?.id
  const noteTitle = note?.title
  const noteType = note?.noteType
  const noteData = note?.noteData
  const normalizedNoteData = useMemo(
    () => hasSpecializedEditor(noteType) ? normalizeNoteData(noteType, noteData) : noteData,
    [noteType, noteData]
  )
  versionBaselineRef.current = createVersionSnapshot(note, {
    title,
    noteData: hasSpecializedEditor(noteType) ? normalizedNoteData : note?.noteData,
  })

  useEffect(() => {
    if (!noteId) return
    versionTrackerRef.current = createVersionCheckpointTracker(versionBaselineRef.current)
  }, [noteId, noteType])

  /**
   * A collaborator's change arrived for the note we are viewing.
   * `externalUpdate.token` increments per inbound change, so the editor
   * can resync its document without the note itself carrying a private
   * `_isExternalUpdate` field through persistence and sync.
   */
  const isExternalUpdate = externalUpdate.noteId === noteId && externalUpdate.token > 0

  useEffect(() => {
    if (noteTitle !== undefined) setTitle(noteTitle || '')
  }, [noteId, noteTitle])

  useEffect(() => {
    const tracker = versionTrackerRef.current
    const baseline = versionBaselineRef.current
    if (
      !noteId ||
      tracker?.latest?.id !== noteId ||
      versionSnapshotsEqual(tracker.latest, baseline)
    ) return
    versionTrackerRef.current = createVersionCheckpointTracker(baseline)
  }, [noteId, noteType, noteTitle, note?.content, noteData, title])

  useEffect(() => {
    if (
      !isExternalUpdate ||
      lastExternalVersionTokenRef.current === externalUpdate.token
    ) return
    lastExternalVersionTokenRef.current = externalUpdate.token
    versionTrackerRef.current = createVersionCheckpointTracker(versionBaselineRef.current)
  }, [externalUpdate.token, isExternalUpdate])

  const recordVersionChange = (updates) => {
    if (!note || (note.isShared && note.sharePermission === 'view')) return

    const initialSnapshot = versionBaselineRef.current
    const currentTracker = versionTrackerRef.current || createVersionCheckpointTracker(initialSnapshot)
    const nextSnapshot = createVersionSnapshot(currentTracker.latest, updates)
    const result = advanceVersionCheckpoint(currentTracker, nextSnapshot)
    versionTrackerRef.current = result.tracker

    if (!result.checkpoint) return
    const checkpoint = result.checkpoint
    void saveNoteVersion(
      checkpoint.id,
      checkpoint.content,
      checkpoint.title,
      checkpoint.noteData,
      checkpoint.noteType
    ).catch(() => {
      toast.error(t('editor.versionSaveFailed', 'Could not create a recovery checkpoint'))
    })
  }

  const debouncedTitleUpdate = useMemo(
    () =>
      debounce(async (id, newTitle, previousTitle) => {
        try {
          await updateNote(id, { title: newTitle })
        } catch {
          setTitle((currentTitle) => currentTitle === newTitle ? previousTitle : currentTitle)
          toast.error(t('editor.titleSaveFailed', 'Could not save the title'))
        }
      }, 400),
    [updateNote, t]
  )

  const debouncedNoteDataUpdate = useMemo(
    () =>
      debounce(async (id, newData) => {
        try {
          await updateNote(id, { noteData: newData })
        } catch {
          toast.error(t('editor.contentSaveFailed', 'Could not save your changes'))
        }
      }, 400),
    [t, updateNote]
  )

  const handleTitleChange = (e) => {
    const newTitle = e.target.value
    recordVersionChange({ title: newTitle })
    setTitle(newTitle)
    if (noteId) debouncedTitleUpdate(noteId, newTitle, noteTitle || '')
  }

  useEffect(() => {
    return () => {
      // A note switch must not let the next note's edits cancel pending writes.
      debouncedTitleUpdate.flush()
      debouncedNoteDataUpdate.flush()
    }
  }, [debouncedNoteDataUpdate, debouncedTitleUpdate, noteId])

  const handleContentChange = async (content) => {
    if (!note) return
    recordVersionChange({ content })
    try {
      await updateNote(note.id, { content })
    } catch {
      toast.error(t('editor.contentSaveFailed', 'Could not save your changes'))
    }
  }

  const handleContentDraft = (content) => {
    if (!note?.id) return
    recordVersionChange({ content })
    updateNoteDraft(note.id, { content })
  }

  const handleDelete = () => {
    if (!note) return
    if (confirmBeforeDelete) {
      setMenuOpen(false)
      setConfirmDelete(true)
      return
    }
    deleteNote(note.id)
    setMenuOpen(false)
  }

  const getRandomColor = () => {
    const colors = [
      '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e',
      '#14b8a6', '#06b6d4', '#3b82f6', '#8b5cf6', '#a855f7',
      '#ec4899', '#f43f5e',
    ]
    return colors[Math.floor(Math.random() * colors.length)]
  }

  const handleAddTag = (tagName) => {
    if (!note || !tagName) return
    addTagToNote(note.id, tagName)
    if (!tags.find((tag) => tag.name === tagName)) {
      createTag({ name: tagName, color: getRandomColor() })
    }
    setNewTagName('')
  }

  const handleCreateAndAddTag = () => {
    const name = newTagName.trim().toLowerCase()
    if (name) handleAddTag(name)
  }

  const currentFolder = note?.folderId ? folders.find((f) => f.id === note.folderId) : null
  const isShared = !!note?.isShared
  const isReadOnly = !!note?.isShared && note?.sharePermission === 'view'
  const isSpecialized = hasSpecializedEditor(note?.noteType)
  const cloudEnabled = isBackendConfigured()

  if (!note) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-surface">
        <EmptyState
          icon={FileText}
          title={t('editor.noNoteSelected', 'No note selected')}
          description={
            t('editor.noNoteSelectedHint', 'Choose a note from the list, or create a new one to start writing.')
          }
        />
      </div>
    )
  }

  return (
    <div className="editor-paper flex h-full w-full min-w-0 flex-col bg-surface">
      {/* Window chrome: sync state and note-level actions sit on the light
          strip above the coloured banner. */}
      <div className="flex shrink-0 items-center gap-1 border-b border-subtle bg-surface px-2 py-1.5 sm:px-3">
        {showBack && (
          <IconButton
            icon={ArrowLeft}
            label={t('editor.backToList', 'Back to notes')}
            onClick={onBack}
          />
        )}
        <SyncStatusPill className="mr-auto" />
        {!isSpecialized && (
          <IconButton
            icon={Search}
            label={t('editor.findReplace', 'Find & replace')}
            active={findReplaceOpen}
            onClick={() => setFindReplaceOpen(!findReplaceOpen)}
          />
        )}
        {isSpecialized && !isShared && (
          <>
            <IconButton
              ref={folderButtonRef}
              icon={FolderOpen}
              label={
                currentFolder
                  ? `${t('editor.moveToFolder', 'Move to folder')}: ${currentFolder.name}`
                  : t('editor.moveToFolder', 'Move to folder')
              }
              active={folderPickerOpen}
              aria-haspopup="menu"
              aria-expanded={folderPickerOpen}
              onClick={() => setFolderPickerOpen((value) => !value)}
              className="hidden sm:inline-flex"
            />
            <IconButton
              ref={tagButtonRef}
              icon={Tag}
              label={t('editor.tags', 'Tags')}
              active={tagPickerOpen || note.tags?.length > 0}
              aria-haspopup="menu"
              aria-expanded={tagPickerOpen}
              onClick={() => setTagPickerOpen((value) => !value)}
              className="hidden sm:inline-flex"
            />
            <IconButton
              icon={Pin}
              label={note.pinned ? t('editor.unpin', 'Unpin note') : t('editor.pin', 'Pin note')}
              active={note.pinned}
              aria-pressed={!!note.pinned}
              onClick={() => togglePin(note.id)}
              className="hidden sm:inline-flex"
            />
          </>
        )}
        {!isShared && (
          <IconButton
            icon={Bell}
            label={t('editor.reminders', 'Reminders')}
            active={note.reminders?.length > 0}
            onClick={() => setReminderModalOpen(true, note.id)}
            className="hidden sm:inline-flex"
          />
        )}
        {cloudEnabled && !isShared && (
          <IconButton
            icon={Send}
            label={t('editor.share', 'Share note')}
            onClick={() => setShareModalOpen(true, note.id)}
            className="hidden sm:inline-flex"
          />
        )}
        {!isShared && (
          <IconButton
            icon={Star}
            label={
              note.starred
                ? t('editor.unfavourite', 'Remove from favourites')
                : t('editor.favourite', 'Add to favourites')
            }
            active={note.starred}
            aria-pressed={!!note.starred}
            onClick={() => toggleStar(note.id)}
          />
        )}
        <IconButton
          ref={menuButtonRef}
          icon={MoreVertical}
          label={t('editor.moreActions', 'More actions')}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        />
      </div>

      {/* Banner header */}
      {!isSpecialized && (
        <header className="qn-banner-surface m-2 shrink-0 rounded-card px-4 py-3.5 text-banner-text sm:mx-3 sm:px-5 sm:py-4">
        <div className="mb-2 flex items-start gap-1.5">

          <div className="min-w-0 flex-1">
            <label htmlFor="qn-note-title" className="qn-sr-only">
              {t('editor.noteTitle', 'Note title')}
            </label>
            <input
              id="qn-note-title"
              ref={titleInputRef}
              type="text"
              maxLength={MAX_NOTE_TITLE_LENGTH}
              value={title}
              onChange={handleTitleChange}
              onFocus={() => setIsEditingTitle(true)}
              onBlur={() => {
                debouncedTitleUpdate.flush()
                setIsEditingTitle(false)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  e.currentTarget.blur()
                }
              }}
              readOnly={isReadOnly}
              placeholder={t('editor.untitled', 'Untitled note')}
              className={`w-full truncate rounded-control bg-transparent px-2 py-1 text-title-md font-semibold text-banner-text outline-none transition-colors duration-fast placeholder:text-banner-muted sm:text-title-lg ${
 isEditingTitle ? 'bg-banner-hover' : 'hover:bg-banner-hover'
 } ${isReadOnly ? 'cursor-default' : 'cursor-text'}`}
            />
          </div>

          {!isShared && (
            <IconButton
              icon={Pin}
              label={note.pinned ? t('editor.unpin', 'Unpin note') : t('editor.pin', 'Pin note')}
              tone="onBanner"
              active={note.pinned}
              aria-pressed={!!note.pinned}
              onClick={() => togglePin(note.id)}
              className="mt-1 hidden md:inline-flex"
            />
          )}
        </div>

        {/* Metadata row */}
        <div className="flex flex-wrap items-center gap-x-1 gap-y-1 text-ui-md text-banner-muted">
          <span className="inline-flex items-center gap-1.5 px-1.5 py-0.5">
            <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <time dateTime={note.updatedAt}>{formatDate(note.updatedAt, language)}</time>
          </span>

          <button
            ref={folderButtonRef}
            type="button"
            onClick={() => !isShared && setFolderPickerOpen((v) => !v)}
            aria-haspopup={isShared ? undefined : 'menu'}
            aria-expanded={isShared ? undefined : folderPickerOpen}
            disabled={isShared}
            className="inline-flex max-w-[45%] items-center gap-1.5 rounded-control px-1.5 py-0.5 transition-colors duration-fast enabled:hover:bg-banner-hover enabled:hover:text-banner-text disabled:cursor-default"
          >
            <FolderOpen className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{currentFolder?.name || t('editor.noFolder', 'No folder')}</span>
            <ChevronDown className="h-3 w-3 shrink-0 opacity-60" aria-hidden="true" />
          </button>

          <button
            ref={tagButtonRef}
            type="button"
            onClick={() => !isShared && setTagPickerOpen((v) => !v)}
            aria-haspopup={isShared ? undefined : 'menu'}
            aria-expanded={isShared ? undefined : tagPickerOpen}
            disabled={isShared}
            className="inline-flex items-center gap-1.5 rounded-control px-1.5 py-0.5 transition-colors duration-fast enabled:hover:bg-banner-hover enabled:hover:text-banner-text disabled:cursor-default"
          >
            <Tag className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>
              {note.tags?.length
                ? `${note.tags.length} ${note.tags.length === 1 ? t('editor.tag', 'tag') : t('editor.tags', 'tags')}`
                : t('editor.noTags', 'No tags')}
            </span>
            <ChevronDown className="h-3 w-3 shrink-0 opacity-60" aria-hidden="true" />
          </button>

          {note.tags?.length > 0 && (
            <ul className="flex min-w-0 flex-wrap items-center gap-1">
              {note.tags.map((tagName) => (
                <li key={tagName} className="min-w-0">
                  <TagChip
                    surface="dark"
                    name={tagName}
                    color={tags.find((tag) => tag.name === tagName)?.color || '#6b7280'}
                    className="max-w-[16ch]"
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
        </header>
      )}

      <FindReplaceBar editor={editorRef} isOpen={findReplaceOpen} onClose={() => setFindReplaceOpen(false)} />

      {isReadOnly && (
        <div
          role="status"
          className="flex shrink-0 items-center gap-2 border-b border-[var(--qn-warning-border)] bg-warning-soft px-4 py-2 text-ui-md text-warning-text"
        >
          <Eye className="h-4 w-4 shrink-0" aria-hidden="true" />
          {t('editor.readOnly', 'Read-only — you have view access to this shared note')}
        </div>
      )}

      {backlinks.length > 0 && (
        <div className="shrink-0 border-b border-subtle bg-surface-sunken px-4 py-1.5">
          <button
            type="button"
            onClick={() => setShowBacklinks((v) => !v)}
            aria-expanded={showBacklinks}
            className="inline-flex items-center gap-1.5 rounded-control px-1 py-0.5 text-ui-sm text-content-muted transition-colors duration-fast hover:text-content"
          >
            <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
            {backlinks.length} {backlinks.length === 1 ? 'backlink' : 'backlinks'}
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform duration-fast ${showBacklinks ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
          </button>
          {showBacklinks && (
            <ul className="mt-1 space-y-0.5">
              {backlinks.map((bl) => (
                <li key={bl.id}>
                  <button
                    type="button"
                    onClick={() => useNotesStore.getState().setSelectedNote(bl.id)}
                    className="flex w-full items-center gap-2 rounded-control px-2 py-1 text-left text-ui-md text-content-muted transition-colors duration-fast hover:bg-surface-hover hover:text-content"
                  >
                    <FileText className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden="true" />
                    <span className="truncate">{bl.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {isSpecialized ? (
          (() => {
            const SpecializedEditor = getEditorForNoteType(note.noteType)
            return (
              <div
                className="h-full"
                onContextMenu={(e) => {
                  e.preventDefault()
                  setSpecializedContextMenu({ x: e.clientX, y: e.clientY })
                }}
              >
                <fieldset
                  disabled={isReadOnly}
                  aria-label={isReadOnly ? 'Read-only note workspace' : undefined}
                  className="h-full min-w-0 border-0 p-0"
                >
                  <SpecializedEditor
                    key={note.id}
                    data={normalizedNoteData}
                    onChange={
                      isReadOnly
                        ? () => {}
                        : (newData) => {
                            recordVersionChange({ noteData: newData, title })
                            updateNoteDraft(note.id, { noteData: newData })
                            debouncedNoteDataUpdate(note.id, newData)
                          }
                    }
                    noteTitle={title}
                    onTitleChange={handleTitleChange}
                    readOnly={isReadOnly}
                  />
                </fieldset>
              </div>
            )
          })()
        ) : (
          <RichTextEditor
            noteId={note.id}
            content={note.content}
            onChange={handleContentChange}
            onDraftChange={handleContentDraft}
            placeholder={t('editor.placeholder', 'Start writing…')}
            paperType={paperType}
            onPaperTypeChange={handlePaperTypeChange}
            onEditorReady={setEditorRef}
            isExternalUpdate={isExternalUpdate}
            readOnly={isReadOnly}
          />
        )}
      </div>

      {/* Status bar */}
      {showNoteStatistics && <NoteStatistics note={note} />}

      {/* Overlays */}
      <Menu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        anchorRef={menuButtonRef}
        placement="bottom-end"
        label={t('editor.moreActions', 'Note actions')}
        width={230}
      >
        {!isShared && (
          <MenuItem icon={Copy} onClick={() => { duplicateNote(note.id); setMenuOpen(false) }}>
            {t('editor.duplicate', 'Duplicate note')}
          </MenuItem>
        )}
        {cloudEnabled && !isShared && (
          <MenuItem icon={Share2} onClick={() => { setShareModalOpen(true, note.id); setMenuOpen(false) }}>
            {t('editor.share', 'Share note')}
          </MenuItem>
        )}
        {!isShared && (
          <MenuItem icon={FolderOpen} onClick={() => { setMenuOpen(false); setFolderPickerOpen(true) }}>
            {t('editor.moveToFolder', 'Move to folder')}
          </MenuItem>
        )}
        <MenuSeparator />
        <MenuItem icon={Download} onClick={() => { setExportModalOpen(true); setMenuOpen(false) }}>
          {t('editor.export', 'Export')}
        </MenuItem>
        {!isShared && (
          <MenuItem icon={Upload} onClick={() => { setImportModalOpen(true); setMenuOpen(false) }}>
            {t('editor.import', 'Import')}
          </MenuItem>
        )}
        <MenuItem icon={History} onClick={() => { setVersionHistoryOpen(true, note.id); setMenuOpen(false) }}>
          {t('editor.versionHistory', 'Version history')}
        </MenuItem>
        {!isShared && (
          <MenuItem icon={Bell} onClick={() => { setReminderModalOpen(true, note.id); setMenuOpen(false) }}>
            {t('editor.setReminder', 'Set reminder')}
          </MenuItem>
        )}
        {!isSpecialized && !isReadOnly && (
          <>
            <MenuSeparator />
            <MenuItem
              icon={Link2}
              onClick={() => {
                const rect = menuButtonRef.current?.getBoundingClientRect()
                setNoteLinkPopoverOpen(true, { x: rect?.left || 100, y: (rect?.bottom || 100) + 8 })
                setMenuOpen(false)
              }}
            >
              {t('editor.insertNoteLink', 'Insert note link')}
            </MenuItem>
            <MenuItem icon={ImageIcon} onClick={() => { setImageUploadOpen(true); setMenuOpen(false) }}>
              {t('editor.insertImage', 'Insert image')}
            </MenuItem>
            <MenuItem icon={Focus} onClick={() => { setFocusModeOpen(true); setMenuOpen(false) }}>
              {t('editor.focusMode', 'Focus mode')}
            </MenuItem>
          </>
        )}
        {!isReadOnly && (
          <MenuItem icon={Mic} onClick={() => { setVoiceInputActive(true); setMenuOpen(false) }}>
            {t('editor.voiceInput', 'Voice input')}
          </MenuItem>
        )}
        {!isShared && (
          <>
            <MenuSeparator />
            <MenuItem icon={Archive} onClick={() => { archiveNote(note.id); setMenuOpen(false) }}>
              {t('editor.archive', 'Archive note')}
            </MenuItem>
            <MenuItem icon={Trash2} tone="danger" onClick={handleDelete}>
              {t('editor.moveToTrash', 'Move to trash')}
            </MenuItem>
          </>
        )}
      </Menu>

      <Menu
        open={folderPickerOpen}
        onClose={() => setFolderPickerOpen(false)}
        anchorRef={folderButtonRef}
        label={t('editor.moveToFolder', 'Move to folder')}
        width={220}
      >
        <MenuItem
          selected={!note.folderId}
          onClick={() => { moveNote(note.id, null); setFolderPickerOpen(false) }}
        >
          {t('editor.noFolder', 'No folder')}
        </MenuItem>
        {folders.map((folder) => {
          const Icon = getFolderIcon(folder.icon)
          return (
            <MenuItem
              key={folder.id}
              selected={note.folderId === folder.id}
              onClick={() => { moveNote(note.id, folder.id); setFolderPickerOpen(false) }}
            >
              <span className="flex items-center gap-2">
                <Icon className="h-4 w-4 shrink-0" style={{ color: folder.color }} aria-hidden="true" />
                <span className="truncate">{folder.name}</span>
              </span>
            </MenuItem>
          )
        })}
      </Menu>

      <Menu
        open={tagPickerOpen}
        onClose={() => setTagPickerOpen(false)}
        anchorRef={tagButtonRef}
        label={t('editor.tags', 'Tags')}
        width={250}
        className="p-2"
      >
        <div className="mb-2 flex items-center gap-1.5">
          <label htmlFor="qn-new-tag" className="qn-sr-only">
            {t('tags.newTag', 'New tag name')}
          </label>
          <Input
            id="qn-new-tag"
            maxLength={MAX_TAG_NAME_LENGTH}
            size="sm"
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleCreateAndAddTag()
              }
            }}
            placeholder={t('tags.newTag', 'New tag…')}
          />
          <IconButton
            icon={Plus}
            variant="primary"
            size="sm"
            label={t('tags.addTag', 'Add tag')}
            disabled={!newTagName.trim()}
            onClick={handleCreateAndAddTag}
          />
        </div>
        {tags.length === 0 ? (
          <p className="px-1 py-2 text-ui-sm text-content-subtle">{t('tags.empty', 'No tags yet')}</p>
        ) : (
          tags.map((tag) => {
            const selected = note.tags?.includes(tag.name)
            return (
              <MenuItem
                key={tag.id}
                selected={selected}
                onClick={() =>
                  selected ? removeTagFromNote(note.id, tag.name) : handleAddTag(tag.name)
                }
                trailing={selected ? <Check className="h-4 w-4 shrink-0" aria-hidden="true" /> : null}
              >
                <span className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: tag.color }}
                    aria-hidden="true"
                  />
                  <span className="truncate">#{tag.name}</span>
                </span>
              </MenuItem>
            )
          })
        )}
      </Menu>

      {!isSpecialized && (
        <NoteLinkPopover
          editor={editorRef}
          isOpen={noteLinkPopoverOpen}
          onClose={() => setNoteLinkPopoverOpen(false)}
          position={noteLinkPosition}
        />
      )}

      {voiceInputActive && (
        <VoiceInput
          isActive={voiceInputActive}
          onTranscript={(text) => {
            if (editorRef && !isSpecialized) {
              editorRef.commands.insertContent(`${text} `)
              return
            }
            const activeEl = document.activeElement
            if (!activeEl || !insertTextIntoActiveField(text)) {
              toast(t('editor.voiceHint', 'Click into a text field first, then speak'))
            }
          }}
          onToggle={setVoiceInputActive}
        />
      )}

      {!isSpecialized && <ImageUploadModal editor={editorRef} />}
      {!isSpecialized && <LinkInsertModal editor={editorRef} />}
      {!isSpecialized && <HTMLEditorModal editor={editorRef} />}

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => deleteNote(note.id)}
        icon={Trash2}
        title={t('editor.moveToTrashConfirm', 'Move note to trash?')}
        description={t('settings.confirmDeleteMessage')}
        confirmLabel={t('editor.moveToTrash', 'Move to trash')}
        cancelLabel={t('common.cancel', 'Cancel')}
      />

      {specializedContextMenu && isSpecialized && (
        <Menu
          open
          onClose={() => setSpecializedContextMenu(null)}
          point={specializedContextMenu}
          label={NOTE_TYPE_CONFIG[note.noteType]?.name || 'Note'}
          width={220}
        >
          {!isReadOnly && (
            <MenuItem icon={Mic} onClick={() => { setVoiceInputActive(true); setSpecializedContextMenu(null) }}>
              {t('editor.voiceInput', 'Voice input')}
            </MenuItem>
          )}
          <MenuItem
            icon={History}
            onClick={() => { setVersionHistoryOpen(true, note.id); setSpecializedContextMenu(null) }}
          >
            {t('editor.versionHistory', 'Version history')}
          </MenuItem>
          {!isShared && <MenuSeparator />}
          {!isShared && (
            <MenuItem icon={Copy} onClick={() => { duplicateNote(note.id); setSpecializedContextMenu(null) }}>
              {t('editor.duplicate', 'Duplicate note')}
            </MenuItem>
          )}
          <MenuItem icon={Download} onClick={() => { setExportModalOpen(true); setSpecializedContextMenu(null) }}>
            {t('editor.export', 'Export')}
          </MenuItem>
          {!isShared && (
            <MenuItem
              icon={Bell}
              onClick={() => { setReminderModalOpen(true, note.id); setSpecializedContextMenu(null) }}
            >
              {t('editor.setReminder', 'Set reminder')}
            </MenuItem>
          )}
        </Menu>
      )}
    </div>
  )
}
