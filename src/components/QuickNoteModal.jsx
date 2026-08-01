import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, FolderOpen, Plus, Tag, Zap } from 'lucide-react'
import { useNotesStore, useUIStore } from '../store'
import { formatShortcut } from '../lib/shortcuts'
import { useTranslation } from '../lib/useTranslation'
import { escapeHtml } from '../lib/sanitizeHtml'
import { MAX_NOTE_TITLE_LENGTH, MAX_TAG_NAME_LENGTH } from '../lib/dataValidation'
import {
  Button,
  IconButton,
  Input,
  Menu,
  MenuItem,
  Modal,
  TagChip,
  Textarea,
  getFocusable,
  useAnchoredPosition,
  useEscapeKey,
} from './ui'

function TagPopover({ open, onClose, anchorRef, tags, selectedTags, onAddTag, onCreateTag, t }) {
  const { floatingRef, style } = useAnchoredPosition({
    anchorRef,
    open,
    placement: 'bottom-start',
  })
  const inputRef = useRef(null)
  const [newTagName, setNewTagName] = useState('')
  const availableTags = tags.filter((tag) => !selectedTags.includes(tag.name))

  const closeAndRestoreFocus = useCallback(() => {
    onClose()
    requestAnimationFrame(() => anchorRef.current?.focus({ preventScroll: true }))
  }, [anchorRef, onClose])

  useEscapeKey(open, closeAndRestoreFocus)

  useEffect(() => {
    if (!open) {
      setNewTagName('')
      return
    }

    const frame = requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }))
    const handlePointerDown = (event) => {
      if (floatingRef.current?.contains(event.target)) return
      if (anchorRef.current?.contains(event.target)) return
      onClose()
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [anchorRef, floatingRef, onClose, open])

  useEffect(() => {
    if (!open) return
    const node = floatingRef.current
    if (!node) return

    const keepFocusInside = (event) => {
      if (event.key !== 'Tab') return
      const focusable = getFocusable(node)
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    node.addEventListener('keydown', keepFocusInside)
    return () => node.removeEventListener('keydown', keepFocusInside)
  }, [floatingRef, open])

  if (!open) return null

  const createTag = () => {
    const name = newTagName.trim()
    if (!name) return
    onCreateTag(name)
    setNewTagName('')
  }

  return createPortal(
    <div
      ref={floatingRef}
      role="dialog"
      aria-label={t('quickNote.addTags')}
      style={{ ...style, width: 280 }}
      className="z-popover overflow-y-auto overscroll-contain rounded-card border border-subtle bg-surface-raised p-3 shadow-lg animate-menu-in"
    >
      <div className="mb-3 flex items-center gap-2">
        <Input
          ref={inputRef}
          size="sm"
          maxLength={MAX_TAG_NAME_LENGTH}
          value={newTagName}
          onChange={(event) => setNewTagName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return
            event.preventDefault()
            createTag()
          }}
          aria-label={t('quickNote.newTag', 'New tag name')}
          placeholder={t('quickNote.newTag')}
        />
        <IconButton
          icon={Plus}
          size="sm"
          variant="primary"
          label={t('quickNote.createTag', 'Create tag')}
          disabled={!newTagName.trim()}
          onClick={createTag}
        />
      </div>

      {availableTags.length > 0 ? (
        <ul className="max-h-52 space-y-1 overflow-y-auto" aria-label={t('quickNote.availableTags', 'Available tags')}>
          {availableTags.map((tag) => (
            <li key={tag.id}>
              <button
                type="button"
                onClick={() => onAddTag(tag.name)}
                className="flex w-full items-center gap-2 rounded-control px-2.5 py-2 text-left text-ui-md text-content transition-colors hover:bg-surface-hover"
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: tag.color }}
                  aria-hidden="true"
                />
                <span className="truncate">#{tag.name}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-1 py-2 text-ui-sm text-content-muted">
          {t('quickNote.noMoreTags', 'No more tags available')}
        </p>
      )}
    </div>,
    document.body
  )
}

export default function QuickNoteModal() {
  const { quickNoteOpen, setQuickNoteOpen } = useUIStore()
  const { createNote, folders, tags, createTag } = useNotesStore()
  const { t } = useTranslation()

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [selectedFolder, setSelectedFolder] = useState(null)
  const [selectedTags, setSelectedTags] = useState([])
  const [folderMenuOpen, setFolderMenuOpen] = useState(false)
  const [tagPopoverOpen, setTagPopoverOpen] = useState(false)

  const titleRef = useRef(null)
  const folderButtonRef = useRef(null)
  const tagButtonRef = useRef(null)
  const titleId = useId()
  const contentId = useId()
  const saveShortcut = formatShortcut({ key: 'Enter', ctrl: true })

  const resetForm = useCallback(() => {
    setTitle('')
    setContent('')
    setSelectedFolder(null)
    setSelectedTags([])
    setFolderMenuOpen(false)
    setTagPopoverOpen(false)
  }, [])

  const handleClose = useCallback(() => {
    setQuickNoteOpen(false)
    resetForm()
  }, [resetForm, setQuickNoteOpen])

  const handleSave = useCallback(() => {
    if (!title.trim() && !content.trim()) {
      handleClose()
      return
    }

    createNote({
      title: title.trim() || 'Untitled Note',
      content: `<p>${escapeHtml(content).replace(/\n/g, '</p><p>')}</p>`,
      folderId: selectedFolder,
      tags: selectedTags,
    })
    handleClose()
  }, [content, createNote, handleClose, selectedFolder, selectedTags, title])

  const handleCreateTag = useCallback(
    (rawName) => {
      const name = rawName.trim().toLowerCase()
      if (!name) return

      if (!tags.some((tag) => tag.name.toLowerCase() === name)) {
        const colors = [
          '#ef4444',
          '#f97316',
          '#f59e0b',
          '#22c55e',
          '#06b6d4',
          '#3b82f6',
          '#8b5cf6',
          '#ec4899',
        ]
        createTag({ name, color: colors[Math.floor(Math.random() * colors.length)] })
      }

      setSelectedTags((current) => (current.includes(name) ? current : [...current, name]))
      setTagPopoverOpen(false)
    },
    [createTag, tags]
  )

  const handleAddTag = useCallback((tagName) => {
    setSelectedTags((current) =>
      current.includes(tagName) ? current : [...current, tagName]
    )
    setTagPopoverOpen(false)
  }, [])

  const closeFolderMenu = useCallback(() => setFolderMenuOpen(false), [])
  const closeTagPopover = useCallback(() => setTagPopoverOpen(false), [])

  const closeFolderMenuOnTab = (event) => {
    if (event.key !== 'Tab') return
    event.preventDefault()
    closeFolderMenu()
    requestAnimationFrame(() => folderButtonRef.current?.focus({ preventScroll: true }))
  }

  if (!quickNoteOpen) return null

  const selectedFolderName = folders.find((folder) => folder.id === selectedFolder)?.name

  return (
    <Modal
      open={quickNoteOpen}
      onClose={handleClose}
      title={t('quickNote.title')}
      description={`${t('quickNote.subtitle')} · ${t(
        'quickNote.saveHint',
        `${saveShortcut} to save`
      )}`}
      icon={Zap}
      size="xl"
      initialFocusRef={titleRef}
      contentClassName="sm:self-start sm:mt-[8dvh]"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" onClick={handleSave}>
            {t('common.save')}
            <kbd className="text-ui-xs opacity-75">{saveShortcut}</kbd>
          </Button>
        </>
      }
    >
      <div
        className="space-y-4"
        onKeyDown={(event) => {
          if (event.key !== 'Enter' || (!event.ctrlKey && !event.metaKey)) return
          event.preventDefault()
          handleSave()
        }}
      >
        <div>
          <label htmlFor={titleId} className="qn-sr-only">
            {t('quickNote.titleLabel', 'Note title')}
          </label>
          <Input
            id={titleId}
            ref={titleRef}
            maxLength={MAX_NOTE_TITLE_LENGTH}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={t('quickNote.titlePlaceholder')}
            className="h-auto px-4 py-3 text-xl font-semibold"
          />
        </div>

        <div>
          <label htmlFor={contentId} className="qn-sr-only">
            {t('quickNote.contentLabel', 'Note content')}
          </label>
          <Textarea
            id={contentId}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder={t('quickNote.contentPlaceholder')}
            rows={7}
            className="min-h-36"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            ref={folderButtonRef}
            variant="subtle"
            icon={FolderOpen}
            iconRight={ChevronDown}
            aria-haspopup="menu"
            aria-expanded={folderMenuOpen}
            onClick={() => {
              setFolderMenuOpen((open) => !open)
              setTagPopoverOpen(false)
            }}
          >
            {selectedFolderName || t('quickNote.selectFolder')}
          </Button>

          <Menu
            open={folderMenuOpen}
            onClose={closeFolderMenu}
            anchorRef={folderButtonRef}
            placement="bottom-start"
            label={t('quickNote.selectFolder')}
            width={240}
            className="!z-popover"
          >
            <div onKeyDown={closeFolderMenuOnTab}>
              <MenuItem
                selected={!selectedFolder}
                trailing={!selectedFolder ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
                onClick={() => {
                  setSelectedFolder(null)
                  closeFolderMenu()
                }}
              >
                {t('quickNote.noFolder')}
              </MenuItem>
              {folders.map((folder) => (
                <MenuItem
                  key={folder.id}
                  selected={selectedFolder === folder.id}
                  trailing={
                    selectedFolder === folder.id ? (
                      <Check className="h-4 w-4" aria-hidden="true" />
                    ) : null
                  }
                  onClick={() => {
                    setSelectedFolder(folder.id)
                    closeFolderMenu()
                  }}
                >
                  <span className="flex items-center gap-2">
                    <span aria-hidden="true">{folder.icon}</span>
                    <span className="truncate">{folder.name}</span>
                  </span>
                </MenuItem>
              ))}
            </div>
          </Menu>

          <Button
            ref={tagButtonRef}
            variant="subtle"
            icon={Tag}
            iconRight={ChevronDown}
            aria-haspopup="dialog"
            aria-expanded={tagPopoverOpen}
            onClick={() => {
              setTagPopoverOpen((open) => !open)
              setFolderMenuOpen(false)
            }}
          >
            {selectedTags.length > 0
              ? `${t('quickNote.addTags')} (${selectedTags.length})`
              : t('quickNote.addTags')}
          </Button>

          <TagPopover
            open={tagPopoverOpen}
            onClose={closeTagPopover}
            anchorRef={tagButtonRef}
            tags={tags}
            selectedTags={selectedTags}
            onAddTag={handleAddTag}
            onCreateTag={handleCreateTag}
            t={t}
          />
        </div>

        {selectedTags.length > 0 && (
          <div>
            <p className="mb-2 text-ui-sm text-content-muted">
              {t('quickNote.selectedTags', 'Selected tags. Activate a tag to remove it.')}
            </p>
            <ul className="flex flex-wrap gap-1.5">
              {selectedTags.map((tagName) => {
                const tag = tags.find((item) => item.name === tagName)
                return (
                  <li key={tagName}>
                    <TagChip
                      as="button"
                      type="button"
                      name={tagName}
                      color={tag?.color}
                      aria-label={t('quickNote.removeTag', `Remove tag ${tagName}`)}
                      title={t('quickNote.removeTag', `Remove tag ${tagName}`)}
                      onClick={() =>
                        setSelectedTags((current) => current.filter((name) => name !== tagName))
                      }
                    />
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  )
}
