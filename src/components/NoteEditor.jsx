import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Archive,
  AlertTriangle,
  ArrowLeft,
  Bell,
  ChevronDown,
  Check,
  Copy,
  Download,
  Eye,
  FileText,
  Focus,
  FolderOpen,
  History,
  Image as ImageIcon,
  Info,
  Link2,
  LayoutTemplate,
  Mic,
  MessageSquare,
  MoreVertical,
  Paperclip,
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
import { debounce } from '../lib/utils'
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
import { getNotePaperType, normalizePaperType } from '../lib/paperStyles'
import { IconButton, Input, Menu, MenuItem, MenuSeparator, EmptyState } from './ui'
import { ConfirmDialog } from './FolderDialogs'
import { isBackendConfigured } from '../lib/backend'
import toast from 'react-hot-toast'
import ResourceManagerModal from './resources/ResourceManagerModal'
import { taskSourceToKnowledgeTarget } from '../lib/taskSources'
import NoteCommentsModal from './collaboration/NoteCommentsModal'

import {
  hasSpecializedEditor,
  getEditorForNoteType,
  NOTE_TYPE_CONFIG,
  normalizeNoteData,
} from './editors'

export default function NoteEditor({ onBack, showBack = false }) {
  const { t } = useTranslation()
  const {
    folders,
    tags,
    user,
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
    collaborationConflict,
    collaborationConflicts = [],
    resolveCollaborationConflict,
    knowledgeNavigation = { pending: null },
    consumeKnowledgeNavigation = () => {},
    navigateToKnowledgeTarget = (target) => useNotesStore.getState().setSelectedNote(target.noteId),
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
    setTemplateSaveOpen,
    setMobileInspectorOpen,
    showNoteStatistics,
    confirmBeforeDelete,
    todayViewToken,
  } = useUIStore()

  const note = getSelectedNote()
  const noteConflict = collaborationConflicts.find((conflict) => conflict.noteId === note?.id)
    || (collaborationConflict?.noteId === note?.id ? collaborationConflict : null)
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
  const [noteDetailsOpen, setNoteDetailsOpen] = useState(false)
  const [editorRef, setEditorRef] = useState(null)
  const [specializedContextMenu, setSpecializedContextMenu] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [resourceManagerOpen, setResourceManagerOpen] = useState(false)
  const [commentsOpen, setCommentsOpen] = useState(false)

  const menuButtonRef = useRef(null)
  const tagButtonRef = useRef(null)
  const folderButtonRef = useRef(null)
  const mobileFolderButtonRef = useRef(null)
  const mobileTagButtonRef = useRef(null)
  const titleInputRef = useRef(null)
  const versionTrackerRef = useRef(null)
  const versionBaselineRef = useRef(null)
  const lastExternalVersionTokenRef = useRef(0)

  const { theme } = useThemeStore()
  const isDarkMode =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  const [paperType, setPaperType] = useState(() => getNotePaperType(note, isDarkMode))

  useEffect(() => {
    setPaperType(normalizePaperType(note?.noteData?.paperType, isDarkMode ? 'dark' : 'plain'))
  }, [isDarkMode, note?.id, note?.noteData?.paperType])

  const handlePaperTypeChange = (newType) => {
    if (!note) return
    const nextPaperType = normalizePaperType(newType, getNotePaperType(note, isDarkMode))
    const previousPaperType = getNotePaperType(note, isDarkMode)
    const previousNoteData = note.noteData && typeof note.noteData === 'object'
      ? note.noteData
      : {}
    const nextNoteData = { ...previousNoteData, paperType: nextPaperType }

    setPaperType(nextPaperType)
    updateNoteDraft(note.id, { noteData: nextNoteData })
    void updateNote(note.id, { noteData: nextNoteData }).catch(() => {
      setPaperType(previousPaperType)
      updateNoteDraft(note.id, { noteData: previousNoteData })
      toast.error(t('editor.paperSaveFailed', 'Could not save the paper style'))
    })
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
    setNoteDetailsOpen(false)
    setResourceManagerOpen(false)
    setCommentsOpen(false)
  }, [noteId, noteTitle])

  useEffect(() => {
    const target = knowledgeNavigation.pending
    if (target && target.noteId === noteId && target.resourceId && !target.objectId) {
      setResourceManagerOpen(true)
    }
  }, [knowledgeNavigation.pending, noteId])

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
    if (noteId) {
      updateNoteDraft(noteId, { title: newTitle })
      debouncedTitleUpdate(noteId, newTitle, noteTitle || '')
    }
  }

  useEffect(() => {
    if (!noteConflict) return
    debouncedTitleUpdate.cancel()
    debouncedNoteDataUpdate.cancel()
  }, [debouncedNoteDataUpdate, debouncedTitleUpdate, noteConflict])

  useEffect(() => {
    return () => {
      // A note switch must not let the next note's edits cancel pending writes.
      debouncedTitleUpdate.flush()
      debouncedNoteDataUpdate.flush()
    }
  }, [debouncedNoteDataUpdate, debouncedTitleUpdate, noteId])

  const handleContentChange = async (content) => {
    if (!note || noteConflict) return
    recordVersionChange({ content })
    try {
      await updateNote(note.id, { content })
    } catch {
      toast.error(t('editor.contentSaveFailed', 'Could not save your changes'))
    }
  }

  const handleContentDraft = (content) => {
    if (!note?.id || noteConflict) return
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
  const isSpatialShared = isShared && ['paper', 'canvas'].includes(note?.contentKind || note?.noteType)
  const workspaceReadOnly = isReadOnly || isSpatialShared || Boolean(noteConflict)
  const resourceReadOnly = isReadOnly || isShared
  const isSpecialized = hasSpecializedEditor(note?.noteType)
  const cloudEnabled = isBackendConfigured()
  const commentsEnabled = cloudEnabled && Boolean(user?.id) && !user?.isLocal

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
            className="qn-touch-target inline-flex items-center gap-1.5 rounded-control px-1 py-0.5 text-ui-sm text-content-muted transition-colors duration-fast hover:text-content"
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
                <li key={bl.linkId || bl.id}>
                  <button
                    type="button"
                    disabled={bl.sourceDeleted}
                    onClick={() => navigateToKnowledgeTarget({
                      noteId: bl.sourceNoteId,
                      anchorId: bl.sourceAnchorId,
                      objectId: bl.sourceObjectId,
                    })}
                    className="qn-touch-target flex w-full items-center gap-2 rounded-control px-2 py-1 text-left text-ui-md text-content-muted transition-colors duration-fast hover:bg-surface-hover hover:text-content disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <FileText className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block truncate">{bl.title}</span>
                      <span className="block truncate text-ui-xs text-content-subtle">{bl.sourceDeleted ? 'Source is in Trash' : bl.context}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {isSpatialShared && !isReadOnly && (
        <div role="status" className="flex shrink-0 items-center gap-2 border-b border-subtle bg-surface-sunken px-4 py-2 text-ui-md text-content-muted">
          <Eye className="h-4 w-4 shrink-0" aria-hidden="true" />
          Shared Paper and Canvas surfaces are view-only; concurrent spatial editing is intentionally not claimed.
        </div>
      )}

      {noteConflict && (
        <div role="alert" className="flex shrink-0 flex-wrap items-center gap-2 border-b border-warning-border bg-warning-soft px-4 py-2 text-ui-md text-warning-text">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="mr-auto">{noteConflict.kind === 'owned'
            ? noteConflict.remote
              ? `This note changed ${noteConflict.source === 'tab' ? 'in another tab' : 'in the cloud'} while this tab had unsynced edits. Choose which version to keep; a recovery checkpoint preserves your local version.`
              : 'This note was deleted on another device while this device had unsynced edits. Accept the deletion or restore your local version as a new cloud write.'
            : 'Another editor changed this note while your local draft was unsaved. Choose which version to keep.'}</span>
          <button type="button" className="rounded-control border border-warning-border px-2 py-1 font-medium hover:bg-surface-hover" onClick={() => void resolveCollaborationConflict('incoming', note.id)}>{noteConflict.remote ? 'Use incoming' : 'Accept deletion'}</button>
          <button type="button" className="rounded-control bg-warning-text px-2 py-1 font-medium text-surface hover:opacity-90" onClick={() => void resolveCollaborationConflict('local', note.id)}>Keep mine</button>
        </div>
      )}

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {isSpecialized ? (
          (() => {
            const SpecializedEditor = getEditorForNoteType(note.noteType)
            return (
              <div
                className={`flex h-full min-h-0 flex-col ${showBack ? 'qn-focused-mobile-chrome' : ''}`}
                onContextMenu={(e) => {
                  // Text fields keep the platform menu for selection, spelling,
                  // copy/paste, and assistive tooling. The workspace menu is
                  // reserved for the surrounding structured canvas.
                  if (e.target.closest?.('input, textarea, [contenteditable="true"]')) return
                  e.preventDefault()
                  setSpecializedContextMenu({ x: e.clientX, y: e.clientY })
                }}
              >
                {showBack && (
                  <div className="qn-ribbon-note-bar grid min-h-11 shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center px-2">
                    <div className="min-w-0 justify-self-start">
                      <IconButton
                        icon={ArrowLeft}
                        label={t('editor.backToList', 'Back to notes')}
                        onClick={onBack}
                      />
                    </div>
                    <div className="qn-ribbon-title min-w-0 justify-self-center px-1">
                      <label htmlFor="qn-focused-mobile-title" className="qn-sr-only">
                        {t('editor.noteTitle', 'Note title')}
                      </label>
                      <input
                        id="qn-focused-mobile-title"
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
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault()
                            event.currentTarget.blur()
                          }
                        }}
                        readOnly={workspaceReadOnly}
                        placeholder={t('editor.untitled', 'Untitled note')}
                        className={`h-9 w-full min-w-0 truncate rounded-control border border-transparent bg-transparent px-2 text-center text-ui-lg font-semibold outline-none transition-colors ${
                          isEditingTitle ? 'bg-white/12' : 'hover:bg-white/10'
                        } ${workspaceReadOnly ? 'cursor-default' : 'cursor-text'}`}
                      />
                    </div>
                    <div className="h-9 w-9 justify-self-end" aria-hidden="true" />
                  </div>
                )}
                <fieldset
                  disabled={workspaceReadOnly}
                  aria-label={workspaceReadOnly ? 'Read-only note workspace' : undefined}
                  className="min-h-0 min-w-0 flex-1 border-0 p-0"
                >
                  <SpecializedEditor
                    key={note.id}
                    note={note}
                    data={normalizedNoteData}
                    onChange={
                      workspaceReadOnly
                        ? () => {}
                        : (newData) => {
                            recordVersionChange({ noteData: newData, title })
                            updateNoteDraft(note.id, { noteData: newData })
                            debouncedNoteDataUpdate(note.id, newData)
                          }
                    }
                    noteTitle={title}
                    onTitleChange={handleTitleChange}
                    readOnly={workspaceReadOnly}
                    navigationTarget={knowledgeNavigation.pending}
                    onNavigationComplete={consumeKnowledgeNavigation}
                    onOpenResources={() => setResourceManagerOpen(true)}
                    onSetReminder={(target) => setReminderModalOpen(true, note.id, target)}
                    onOpenCaptureSource={(source) => {
                      const target = taskSourceToKnowledgeTarget(source)
                      if (!target || !navigateToKnowledgeTarget(target)) {
                        toast.error('The original capture is no longer accessible')
                      }
                    }}
                    todayViewToken={todayViewToken}
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
            navigationTarget={knowledgeNavigation.pending}
            onNavigationComplete={consumeKnowledgeNavigation}
            isExternalUpdate={isExternalUpdate}
            readOnly={isReadOnly}
            editingBlocked={Boolean(noteConflict)}
            ribbonLeadingAction={showBack ? (
              <IconButton
                icon={ArrowLeft}
                label={t('editor.backToList', 'Back to notes')}
                onClick={onBack}
              />
            ) : null}
            ribbonTitle={(
              <div className="flex min-w-0 items-center justify-center">
                <label htmlFor="qn-mobile-note-title" className="qn-sr-only">
                  {t('editor.noteTitle', 'Note title')}
                </label>
                <input
                  id="qn-mobile-note-title"
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
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      event.currentTarget.blur()
                    }
                  }}
                  readOnly={workspaceReadOnly}
                  placeholder={t('editor.untitled', 'Untitled note')}
                  className={`h-9 w-full min-w-0 truncate rounded-control border border-transparent bg-transparent px-2 text-center text-ui-lg font-semibold text-content outline-none transition-colors placeholder:text-content-subtle ${
                    isEditingTitle ? 'bg-surface-sunken' : 'hover:bg-surface-hover'
                  } ${workspaceReadOnly ? 'cursor-default' : 'cursor-text'}`}
                />
              </div>
            )}
            ribbonActions={(
              <>
                <IconButton
                  icon={Info}
                  label={noteDetailsOpen ? t('editor.hideNoteDetails', 'Hide note details') : t('editor.showNoteDetails', 'Show note details')}
                  active={noteDetailsOpen}
                  aria-expanded={noteDetailsOpen}
                  aria-controls="qn-note-details"
                  onClick={() => setNoteDetailsOpen((value) => !value)}
                  className="qn-ribbon-mobile-action"
                />
                {!isShared && (
                  <IconButton
                    icon={Star}
                    label={note.starred ? t('editor.unfavourite', 'Remove from favourites') : t('editor.favourite', 'Add to favourites')}
                    active={note.starred}
                    tone="favorite"
                    iconClassName={note.starred ? 'fill-current' : ''}
                    aria-pressed={!!note.starred}
                    onClick={() => toggleStar(note.id)}
                    className="qn-ribbon-secondary-action"
                  />
                )}
                {!isShared && (
                  <IconButton
                    icon={Pin}
                    label={note.pinned ? t('editor.unpin', 'Unpin note') : t('editor.pin', 'Pin note')}
                    active={note.pinned}
                    iconClassName={note.pinned ? 'fill-current' : ''}
                    aria-pressed={!!note.pinned}
                    onClick={() => togglePin(note.id)}
                    className="qn-ribbon-primary-action"
                  />
                )}
                {!isShared && (
                  <IconButton
                    ref={folderButtonRef}
                    icon={FolderOpen}
                    label={currentFolder ? `${t('editor.moveToFolder', 'Move to folder')}: ${currentFolder.name}` : t('editor.moveToFolder', 'Move to folder')}
                    active={folderPickerOpen}
                    aria-haspopup="menu"
                    aria-expanded={folderPickerOpen}
                    onClick={() => setFolderPickerOpen((value) => !value)}
                    className="qn-ribbon-secondary-action"
                  />
                )}
                {!isShared && (
                  <IconButton
                    ref={tagButtonRef}
                    icon={Tag}
                    label={note.tags?.length ? `${note.tags.length} ${t('editor.tags', 'tags')}` : t('editor.tags', 'Tags')}
                    active={tagPickerOpen || note.tags?.length > 0}
                    aria-haspopup="menu"
                    aria-expanded={tagPickerOpen}
                    onClick={() => setTagPickerOpen((value) => !value)}
                    className="qn-ribbon-secondary-action"
                  />
                )}
                <IconButton
                  icon={Search}
                  label={t('editor.findReplace', 'Find & replace')}
                  active={findReplaceOpen}
                  onClick={() => setFindReplaceOpen(!findReplaceOpen)}
                  className="qn-ribbon-secondary-action"
                />
                <IconButton
                  icon={Paperclip}
                  label="Attachments and recordings"
                  active={resourceManagerOpen}
                  onClick={() => setResourceManagerOpen(true)}
                  className="qn-ribbon-secondary-action"
                />
                {commentsEnabled && (
                  <IconButton
                    icon={MessageSquare}
                    label="Comments"
                    active={commentsOpen}
                    onClick={() => setCommentsOpen(true)}
                    className="qn-ribbon-secondary-action"
                  />
                )}
                {!isShared && (
                  <IconButton
                    icon={Bell}
                    label={t('editor.reminders', 'Reminders')}
                    active={note.reminders?.length > 0}
                    onClick={() => setReminderModalOpen(true, note.id)}
                    className="qn-ribbon-secondary-action"
                  />
                )}
                {cloudEnabled && !isShared && (
                  <IconButton
                    icon={Send}
                    label={t('editor.share', 'Share note')}
                    onClick={() => setShareModalOpen(true, note.id)}
                    className="qn-ribbon-secondary-action"
                  />
                )}
              </>
            )}
            ribbonDetails={(
              <div
                id="qn-note-details"
                hidden={!noteDetailsOpen}
                className="qn-mobile-note-details border-b border-subtle bg-surface-panel px-3 py-2 md:hidden"
              >
                <div className="grid grid-cols-2 gap-2">
                  <button
                    ref={mobileFolderButtonRef}
                    type="button"
                    aria-haspopup="menu"
                    aria-expanded={folderPickerOpen}
                    onClick={() => setFolderPickerOpen((value) => !value)}
                    className="flex min-w-0 items-center gap-2 rounded-control border border-subtle bg-surface-raised px-3 py-2 text-left text-ui-md text-content-muted shadow-xs"
                  >
                    <FolderOpen className="h-4 w-4 shrink-0 text-accent-text" aria-hidden="true" />
                    <span className="truncate">{currentFolder?.name || t('editor.noFolder', 'No folder')}</span>
                  </button>
                  <button
                    ref={mobileTagButtonRef}
                    type="button"
                    aria-haspopup="menu"
                    aria-expanded={tagPickerOpen}
                    onClick={() => setTagPickerOpen((value) => !value)}
                    className="flex min-w-0 items-center gap-2 rounded-control border border-subtle bg-surface-raised px-3 py-2 text-left text-ui-md text-content-muted shadow-xs"
                  >
                    <Tag className="h-4 w-4 shrink-0 text-accent-text" aria-hidden="true" />
                    <span className="truncate">
                      {note.tags?.length ? note.tags.map((tag) => `#${tag}`).join(', ') : t('editor.noTags', 'No tags')}
                    </span>
                  </button>
                </div>
              </div>
            )}
            ribbonOverflowAction={(
              <IconButton
                ref={menuButtonRef}
                icon={MoreVertical}
                label={t('editor.moreActions', 'More actions')}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((value) => !value)}
              />
            )}
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
        {!isSpecialized && (
          <MenuItem
            icon={Search}
            onClick={() => {
              setFindReplaceOpen(true)
              setMenuOpen(false)
            }}
          >
            {t('editor.findReplace', 'Find & replace')}
          </MenuItem>
        )}
        {!isShared && (
          <MenuItem
            icon={Star}
            onClick={() => {
              toggleStar(note.id)
              setMenuOpen(false)
            }}
          >
            {note.starred
              ? t('editor.unfavourite', 'Remove from favourites')
              : t('editor.favourite', 'Add to favourites')}
          </MenuItem>
        )}
        {!isShared && (
          <MenuItem
            icon={Pin}
            onClick={() => {
              togglePin(note.id)
              setMenuOpen(false)
            }}
          >
            {note.pinned ? t('editor.unpin', 'Unpin note') : t('editor.pin', 'Pin note')}
          </MenuItem>
        )}
        {!isShared && (
          <MenuItem
            icon={Tag}
            onClick={() => {
              setMenuOpen(false)
              setTagPickerOpen(true)
            }}
          >
            {t('editor.tags', 'Tags')}
          </MenuItem>
        )}
        {showBack && (
          <MenuItem icon={Info} onClick={() => { setMobileInspectorOpen(true); setMenuOpen(false) }}>
            Note details
          </MenuItem>
        )}
        <MenuSeparator />
        {!isShared && (
          <MenuItem icon={Copy} onClick={() => { duplicateNote(note.id); setMenuOpen(false) }}>
            {t('editor.duplicate', 'Duplicate note')}
          </MenuItem>
        )}
        {!isShared && (
          <MenuItem icon={LayoutTemplate} onClick={() => { setTemplateSaveOpen(true); setMenuOpen(false) }}>
            Save as template
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
        {commentsEnabled && (
          <MenuItem icon={MessageSquare} onClick={() => { setCommentsOpen(true); setMenuOpen(false) }}>
            Comments
          </MenuItem>
        )}
        <MenuItem icon={Paperclip} onClick={() => { setResourceManagerOpen(true); setMenuOpen(false) }}>
          Attachments and recordings
        </MenuItem>
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
        anchorRef={
          mobileFolderButtonRef.current?.offsetParent
            ? mobileFolderButtonRef
            : folderButtonRef.current?.offsetParent
              ? folderButtonRef
              : menuButtonRef
        }
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
        anchorRef={
          mobileTagButtonRef.current?.offsetParent
            ? mobileTagButtonRef
            : tagButtonRef.current?.offsetParent
              ? tagButtonRef
              : menuButtonRef
        }
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
          currentNoteId={note.id}
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
      <ResourceManagerModal
        open={resourceManagerOpen}
        onClose={() => setResourceManagerOpen(false)}
        note={note}
        readOnly={resourceReadOnly}
        navigationTarget={knowledgeNavigation.pending}
      />
      <NoteCommentsModal
        open={commentsOpen}
        onClose={() => setCommentsOpen(false)}
        note={note}
        currentUserId={user?.id || null}
        anchorId={knowledgeNavigation.pending?.anchorId || null}
        objectId={knowledgeNavigation.pending?.objectId || null}
      />

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
          {commentsEnabled && (
            <MenuItem icon={MessageSquare} onClick={() => { setCommentsOpen(true); setSpecializedContextMenu(null) }}>
              Comments
            </MenuItem>
          )}
          <MenuItem icon={Paperclip} onClick={() => { setResourceManagerOpen(true); setSpecializedContextMenu(null) }}>
            Attachments and recordings
          </MenuItem>
          {!isShared && (
            <MenuItem icon={LayoutTemplate} onClick={() => { setTemplateSaveOpen(true); setSpecializedContextMenu(null) }}>
              Save as template
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
