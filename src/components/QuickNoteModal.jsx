import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X, Zap, Tag, FolderOpen, Plus } from 'lucide-react'
import { useNotesStore, useUIStore } from '../store'
import { createShortcutHandler } from '../lib/utils'
import { useTranslation } from '../lib/useTranslation'
import LegacyDialog from './ui/LegacyDialog'
import { escapeHtml } from '../lib/sanitizeHtml'
import { MAX_NOTE_TITLE_LENGTH, MAX_TAG_NAME_LENGTH } from '../lib/dataValidation'

function SmartDropdown({ isOpen, onClose, triggerRef, children, minWidth = 160 }) {
  const dropdownRef = useRef(null)
  const [position, setPosition] = useState({ top: 0, left: 0 })

  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const updatePosition = () => {
        const trigger = triggerRef.current.getBoundingClientRect()
        const dropdown = dropdownRef.current
        
        if (!dropdown) return
        
        const dropdownHeight = dropdown.offsetHeight || 200
        const dropdownWidth = dropdown.offsetWidth || minWidth
        const viewportHeight = window.innerHeight
        const viewportWidth = window.innerWidth
        const padding = 8

        let top = trigger.bottom + 4
        let left = trigger.left

        if (top + dropdownHeight > viewportHeight - padding) {
          top = trigger.top - dropdownHeight - 4
        }

        if (left + dropdownWidth > viewportWidth - padding) {
          left = viewportWidth - dropdownWidth - padding
        }

        if (left < padding) {
          left = padding
        }

        if (top < padding) {
          top = trigger.bottom + 4
        }

        setPosition({ top, left })
      }

      updatePosition()
      window.addEventListener('resize', updatePosition)
      window.addEventListener('scroll', updatePosition, true)
      
      return () => {
        window.removeEventListener('resize', updatePosition)
        window.removeEventListener('scroll', updatePosition, true)
      }
    }
  }, [isOpen, triggerRef, minWidth])

  useEffect(() => {
    if (!isOpen) return
    
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target) &&
          triggerRef.current && !triggerRef.current.contains(e.target)) {
        onClose()
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, onClose, triggerRef])

  if (!isOpen) return null

  return createPortal(
    <div
      ref={dropdownRef}
      className="fixed bg-surface-raised border border-subtle rounded-lg shadow-xl z-[100]"
      style={{
        top: position.top,
        left: position.left,
        minWidth: minWidth,
        maxHeight: 'calc(100vh - 32px)',
        overflowY: 'auto'
      }}
    >
      {children}
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
  const [showFolderDropdown, setShowFolderDropdown] = useState(false)
  const [showTagDropdown, setShowTagDropdown] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  
  const modalRef = useRef(null)
  const titleRef = useRef(null)
  const folderButtonRef = useRef(null)
  const tagButtonRef = useRef(null)

  useEffect(() => {
    const handler = createShortcutHandler({
      'ctrl+n': () => setQuickNoteOpen(true),
      'cmd+n': () => setQuickNoteOpen(true),
      'escape': () => {
        if (quickNoteOpen) {
          handleClose()
        }
      },
    })

    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [quickNoteOpen])

  useEffect(() => {
    if (quickNoteOpen && titleRef.current) {
      titleRef.current.focus()
    }
  }, [quickNoteOpen])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        handleClose()
      }
    }

    if (quickNoteOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [quickNoteOpen])

  const handleClose = () => {
    setQuickNoteOpen(false)
    resetForm()
  }

  const resetForm = () => {
    setTitle('')
    setContent('')
    setSelectedFolder(null)
    setSelectedTags([])
  }

  const handleSave = () => {
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
  }

  const handleAddTag = (tagName) => {
    if (!selectedTags.includes(tagName)) {
      setSelectedTags([...selectedTags, tagName])
    }
    setShowTagDropdown(false)
  }

  const handleRemoveTag = (tagName) => {
    setSelectedTags(selectedTags.filter((t) => t !== tagName))
  }

  const handleCreateTag = () => {
    if (newTagName.trim()) {
      const name = newTagName.trim().toLowerCase()
      if (!tags.find((t) => t.name === name)) {
        const colors = [
          '#ef4444', '#f97316', '#f59e0b', '#22c55e', '#06b6d4',
          '#3b82f6', '#8b5cf6', '#ec4899'
        ]
        createTag({
          name,
          color: colors[Math.floor(Math.random() * colors.length)],
        })
      }
      handleAddTag(name)
      setNewTagName('')
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleSave()
    }
  }

  if (!quickNoteOpen) return null

  return (
    <LegacyDialog label="Quick note" onClose={handleClose} align="top">
      <div
        ref={modalRef}
        className="bg-surface-raised rounded-2xl shadow-2xl border border-subtle w-full max-w-2xl mx-4 overflow-hidden modal-animate"
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center justify-between p-5 qn-banner-surface text-white">
          <div className="flex items-center gap-3">
            <Zap className="w-6 h-6" />
            <div>
              <h2 className="text-lg font-bold">{t('quickNote.title')}</h2>
              <p className="text-sm text-white/70">{t('quickNote.subtitle')} {"\u2022"} {t('quickNote.ctrlEnterToSave')}</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-full hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <input
            ref={titleRef}
            type="text"
            maxLength={MAX_NOTE_TITLE_LENGTH}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('quickNote.titlePlaceholder')}
            className="w-full text-xl font-semibold bg-surface-sunken rounded-lg px-4 py-3 border border-subtle outline-none placeholder:text-content-subtle dark:placeholder:text-content-subtle text-content focus:border-primary-500 focus:ring-2 focus:ring-[rgba(16,185,129,0.20)]"
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={t('quickNote.contentPlaceholder')}
            rows={6}
            className="w-full bg-surface-sunken rounded-lg p-4 border border-subtle focus:border-primary-500 focus:ring-2 focus:ring-[rgba(16,185,129,0.20)] outline-none resize-none text-content placeholder:text-content-subtle dark:placeholder:text-content-subtle"
          />
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative">
              <button
                ref={folderButtonRef}
                onClick={() => {
                  setShowFolderDropdown(!showFolderDropdown)
                  setShowTagDropdown(false)
                }}
                className="flex items-center gap-2 px-3 py-2 bg-surface-sunken rounded-lg text-sm text-content-muted hover:bg-surface-sunken dark:hover:bg-surface-active transition-colors border border-subtle "
              >
                <FolderOpen className="w-4 h-4" />
                {selectedFolder
                  ? folders.find((f) => f.id === selectedFolder)?.name
                  : t('quickNote.selectFolder')}
              </button>

              <SmartDropdown
                isOpen={showFolderDropdown}
                onClose={() => setShowFolderDropdown(false)}
                triggerRef={folderButtonRef}
                minWidth={180}
              >
                <div className="py-1">
                  <button
                    onClick={() => {
                      setSelectedFolder(null)
                      setShowFolderDropdown(false)
                    }}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-surface-hover text-content-muted ${
 !selectedFolder ? 'bg-surface-sunken' : ''
 }`}
                  >
                    {t('quickNote.noFolder')}
                  </button>
                  {folders.map((folder) => (
                    <button
                      key={folder.id}
                      onClick={() => {
                        setSelectedFolder(folder.id)
                        setShowFolderDropdown(false)
                      }}
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-surface-hover flex items-center gap-2 text-content-muted ${
 selectedFolder === folder.id ? 'bg-surface-sunken' : ''
 }`}
                    >
                      <span>{folder.icon}</span>
                      {folder.name}
                    </button>
                  ))}
                </div>
              </SmartDropdown>
            </div>
            <div className="relative">
              <button
                ref={tagButtonRef}
                onClick={() => {
                  setShowTagDropdown(!showTagDropdown)
                  setShowFolderDropdown(false)
                }}
                className="flex items-center gap-2 px-3 py-2 bg-surface-sunken rounded-lg text-sm text-content-muted hover:bg-surface-sunken dark:hover:bg-surface-active transition-colors border border-subtle "
              >
                <Tag className="w-4 h-4" />
                {t('quickNote.addTags')}
              </button>

              <SmartDropdown
                isOpen={showTagDropdown}
                onClose={() => setShowTagDropdown(false)}
                triggerRef={tagButtonRef}
                minWidth={220}
              >
                <div className="p-2">
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="text"
                      maxLength={MAX_TAG_NAME_LENGTH}
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCreateTag()
                      }}
                      placeholder={t('quickNote.newTag')}
                      className="flex-1 px-2 py-1 text-sm border border-subtle rounded bg-transparent text-content"
                    />
                    <button
                      onClick={handleCreateTag}
                      className="p-1 bg-primary-600 text-white rounded hover:bg-primary-700 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="max-h-[200px] overflow-y-auto space-y-1">
                    {tags
                      .filter((t) => !selectedTags.includes(t.name))
                      .map((tag) => (
                        <button
                          key={tag.id}
                          onClick={() => handleAddTag(tag.name)}
                          className="w-full px-2 py-1.5 text-left text-sm hover:bg-surface-hover rounded flex items-center gap-2 text-content-muted"
                        >
                          <span
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: tag.color }}
                          />
                          #{tag.name}
                        </button>
                      ))}
                    {tags.filter((t) => !selectedTags.includes(t.name)).length === 0 && (
                      <p className="text-xs text-content-muted px-2 py-1">
                        No more tags available
                      </p>
                    )}
                  </div>
                </div>
              </SmartDropdown>
            </div>
            {selectedTags.map((tagName) => {
              const tag = tags.find((t) => t.name === tagName)
              return (
                <span
                  key={tagName}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium"
                  style={{
                    backgroundColor: `${tag?.color || '#6b7280'}20`,
                    color: tag?.color || '#6b7280',
                  }}
                >
                  #{tagName}
                  <button
                    onClick={() => handleRemoveTag(tagName)}
                    className="hover:bg-black/10 rounded-full p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )
            })}
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-subtle bg-surface-sunken">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm text-content-muted hover:bg-surface-sunken dark:hover:bg-surface-sunken rounded-lg transition-colors border border-subtle "
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            {t('common.save')}
            <span className="text-xs opacity-75">{"\u2318+\u21B5"}</span>
          </button>
        </div>
      </div>
    </LegacyDialog>
  )
}
