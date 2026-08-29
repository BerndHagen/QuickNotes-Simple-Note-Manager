import { useState, useEffect, useId, useRef } from 'react'
import { Link2, X, Search, FileText, ArrowRight } from 'lucide-react'
import { useNotesStore } from '../store'
import { useTranslation } from '../lib/useTranslation'
import toast from 'react-hot-toast'
import { createInternalNoteHref, extractKnowledgeLinks, parseInternalNoteHref } from '../lib/knowledge/links'
import { getBacklinks, getForwardLinks } from '../lib/knowledge/repository'
import { searchKnowledge } from '../lib/knowledge/service'
import { useKnowledgeIndexStatus } from '../hooks/useKnowledgeIndex'
import { extractDocumentHeadings } from '../lib/knowledge/document'

export default function NoteLinkPopover({ editor, isOpen, onClose, position, currentNoteId }) {
  const { notes, sharedNotes = [] } = useNotesStore()
  const { t } = useTranslation()
  const indexStatus = useKnowledgeIndexStatus()
  const [searchQuery, setSearchQuery] = useState('')
  const [filteredNotes, setFilteredNotes] = useState([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef(null)
  const popoverRef = useRef(null)
  const titleId = useId()
  const listboxId = useId()

  useEffect(() => {
    let active = true
    const accessibleNotes = [...notes, ...sharedNotes.map((share) => share.notes).filter(Boolean)]
    const noteById = new Map(accessibleNotes.map((note) => [note.id, note]))
    if (!searchQuery.trim()) {
      const recent = accessibleNotes
        .filter(note => note?.id && note.id !== currentNoteId && !note.deleted)
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
        .slice(0, 5)
        .map((note) => ({ note, target: { noteId: note.id } }))
      setFilteredNotes(recent)
      setSelectedIndex(0)
      return () => { active = false }
    }

    const timer = setTimeout(() => {
      searchKnowledge(searchQuery, { limit: 12 })
        .then((results) => {
          if (!active) return
          const candidates = results.length || indexStatus.status === 'ready'
            ? results
            : accessibleNotes
                .filter((note) => String(note.title || '').toLocaleLowerCase().includes(searchQuery.toLocaleLowerCase()))
                .map((note) => ({ noteId: note.id, target: { noteId: note.id } }))
          setFilteredNotes(candidates
            .map((result) => {
              const note = noteById.get(result.noteId)
              const anchorLabel = result.target?.anchorId
                ? extractDocumentHeadings(note?.content).find((heading) => heading.anchorId === result.target.anchorId)?.text
                : result.target?.objectId
                  ? result.snippet
                  : null
              return { note, target: result.target || { noteId: result.noteId }, anchorLabel }
            })
            .filter((item) => item.note?.id && item.note.id !== currentNoteId && !item.note.deleted)
            .slice(0, 8))
          setSelectedIndex(0)
        })
        .catch(() => {
          if (!active) return
          const normalized = searchQuery.toLocaleLowerCase()
          setFilteredNotes(accessibleNotes
            .filter((note) => note.id !== currentNoteId && !note.deleted)
            .filter((note) => String(note.title || '').toLocaleLowerCase().includes(normalized))
            .slice(0, 8)
            .map((note) => ({ note, target: { noteId: note.id } })))
        })
    }, 100)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [currentNoteId, indexStatus.status, searchQuery, notes, sharedNotes])

  useEffect(() => {
    if (isOpen && inputRef.current) {
      const focusTimer = setTimeout(() => {
        inputRef.current?.focus()
      }, 50)
      return () => clearTimeout(focusTimer)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const handlePointerDown = (event) => {
      if (!popoverRef.current?.contains(event.target)) onClose()
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [isOpen, onClose])

  const handleKeyDown = (e) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex((previous) => {
          if (filteredNotes.length === 0) return 0
          return previous < filteredNotes.length - 1 ? previous + 1 : 0
        })
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex((previous) => {
          if (filteredNotes.length === 0) return 0
          return previous > 0 ? previous - 1 : filteredNotes.length - 1
        })
        break
      case 'Enter':
        e.preventDefault()
        if (filteredNotes[selectedIndex]) {
          insertNoteLink(filteredNotes[selectedIndex])
        }
        break
      case 'Escape':
        e.preventDefault()
        e.stopPropagation()
        onClose()
        break
    }
  }

  const insertNoteLink = (item) => {
    if (!editor) return
    const note = item.note || item
    const target = item.target || { noteId: note.id }

    const link = document.createElement('a')
    // Keep a meaningful, app-owned destination in the saved HTML. TipTap is
    // configured not to open links itself; QuickNotes handles this anchor and
    // resolves the exact immutable note id from data-note-id.
    link.href = createInternalNoteHref(target)
    link.className = 'note-link'
    link.dataset.noteId = String(note.id)
    if (target.anchorId) link.dataset.noteAnchorId = target.anchorId
    if (target.objectId) link.dataset.noteObjectId = target.objectId
    link.textContent = String(item.anchorLabel
      ? `${note.title || t('notes.untitled', 'Untitled note')} › ${item.anchorLabel}`
      : note.title || t('notes.untitled', 'Untitled note'))
    
    editor.chain()
      .focus()
      .insertContent(link.outerHTML)
      .insertContent(' ')
      .run()

    setSearchQuery('')
    onClose()
  }

  const getPreview = (content) => {
    if (!content) return t('noteLink.emptyNote')
    const text = String(content).replace(/<[^>]*>/g, '')
    return text.substring(0, 60) + (text.length > 60 ? '...' : '')
  }

  if (!isOpen) return null

  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      className="fixed z-50 w-[min(20rem,calc(100vw-1.5rem))] overflow-hidden rounded-card border border-strong bg-surface-raised shadow-md"
      style={(() => {
        const popoverWidth = Math.min(320, Math.max(window.innerWidth - 24, 0))
        const popoverHeight = 400
        const padding = 12
        const rawX = position?.x ?? 100
        const rawY = position?.y ?? 100
        const maxX = Math.max(padding, window.innerWidth - popoverWidth - padding)
        const clampedX = Math.min(Math.max(rawX, padding), maxX)
        const spaceBelow = window.innerHeight - rawY - padding
        const clampedY = spaceBelow < popoverHeight 
          ? Math.max(rawY - popoverHeight, padding)
          : rawY
        return { left: clampedX, top: clampedY }
      })()}
    >
      <div className="qn-dialog-header border-b border-subtle bg-surface-raised p-3 text-content">
        <div className="flex items-center justify-between mb-2">
          <h3 id={titleId} className="flex items-center gap-2 text-sm font-semibold text-content">
            <Link2 className="h-4 w-4 text-accent-text" aria-hidden="true" />
            {t('noteLink.title')}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close', 'Close')}
            className="qn-square-control rounded-control p-1 text-content-muted transition-colors hover:bg-surface-hover hover:text-content"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-subtle" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('noteLink.searchNotes')}
            aria-label={t('noteLink.searchNotes', 'Search notes')}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded="true"
            aria-controls={listboxId}
            aria-activedescendant={filteredNotes[selectedIndex] ? `${listboxId}-option-${selectedIndex}` : undefined}
            className="w-full rounded-control border border-subtle bg-surface-raised py-2 pl-9 pr-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-soft"
          />
        </div>
      </div>
      <div id={listboxId} role="listbox" aria-label={t('noteLink.title', 'Link to a note')} className="max-h-64 overflow-y-auto">
        {filteredNotes.length === 0 ? (
          <div className="p-4 text-center text-content-muted">
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">{t('noteLink.noNotesFound')}</p>
          </div>
        ) : (
          <div className="py-1">
            {searchQuery === '' && (
              <div className="px-3 py-1.5 text-xs font-medium text-content-muted uppercase">
                {t('noteLink.recentNotes')}
              </div>
            )}
            {filteredNotes.map((item, index) => {
              const note = item.note || item
              return (
              <button
                key={`${note.id}:${item.target?.anchorId || item.target?.objectId || ''}`}
                id={`${listboxId}-option-${index}`}
                type="button"
                role="option"
                aria-selected={index === selectedIndex}
                onClick={() => insertNoteLink(item)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`w-full px-3 py-2 flex items-start gap-3 transition-colors ${
 index === selectedIndex
 ? 'bg-accent-soft'
                    : 'hover:bg-surface-hover'
                }`}
              >
                <FileText aria-hidden="true" className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
 index === selectedIndex ? 'text-accent-text' : 'text-content-subtle'
 }`} />
                <div className="flex-1 text-left min-w-0">
                  <p className={`text-sm font-medium truncate ${
 index === selectedIndex 
 ? 'text-accent-text'
                      : 'text-content'
                  }`}>
                    {note.title}{item.anchorLabel ? ` › ${item.anchorLabel}` : ''}
                  </p>
                  <p className="text-xs text-content-muted truncate">
                    {getPreview(note.content)}
                  </p>
                </div>
                {index === selectedIndex && (
                  <ArrowRight className="mt-1 h-4 w-4 flex-shrink-0 text-accent-text" aria-hidden="true" />
                )}
              </button>
              )
            })}
          </div>
        )}
      </div>
      <div className="px-3 py-2 bg-surface-sunken border-t border-subtle">
        <p className="text-xs text-content-muted flex items-center gap-2">
          <span className="px-1.5 py-0.5 bg-surface-sunken dark:bg-surface-sunken rounded text-[10px]">{"\u2191\u2193"}</span>
          Navigate
          <span className="px-1.5 py-0.5 bg-surface-sunken dark:bg-surface-sunken rounded text-[10px]">Enter</span>
          Select
          <span className="px-1.5 py-0.5 bg-surface-sunken dark:bg-surface-sunken rounded text-[10px]">Esc</span>
          Close
        </p>
      </div>
    </div>
  )
}

export function useNoteLinkHandler() {
  useEffect(() => {
    const handleClick = (e) => {
      const link = e.target.closest?.('a.note-link')
      if (link) {
        e.preventDefault()
        e.stopPropagation()
        const parsed = parseInternalNoteHref(link.getAttribute('href'))
        const noteId = link.dataset.noteId || parsed?.noteId || ''
        if (noteId) {
          const { notes, sharedNotes = [], navigateToKnowledgeTarget, setSelectedNote } = useNotesStore.getState()
          const note = notes.find(n => n.id === noteId && !n.deleted) ||
            sharedNotes.find((share) => share.notes?.id === noteId && !share.notes.deleted)?.notes
          if (note) {
            const target = {
              noteId,
              anchorId: link.dataset.noteAnchorId || parsed?.anchorId || null,
              objectId: link.dataset.noteObjectId || parsed?.objectId || null,
            }
            if (target.anchorId || target.objectId) navigateToKnowledgeTarget?.(target)
            else setSelectedNote(noteId)
          } else {
            toast.error('This linked note no longer exists')
          }
        }
      }
    }

    // Capture before TipTap/browser link handling. This guarantees an internal
    // note link never creates a tab and cannot fall through to href navigation.
    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  }, [])
}

export function useBacklinks(noteId) {
  const ownerId = useNotesStore((state) => state.hydratedWorkspaceOwnerId)
  const notes = useNotesStore((state) => state.notes)
  const sharedNotes = useNotesStore((state) => state.sharedNotes || [])
  const indexStatus = useKnowledgeIndexStatus()
  const [backlinks, setBacklinks] = useState([])

  useEffect(() => {
    let active = true
    if (!noteId) {
      setBacklinks([])
      return () => { active = false }
    }
    const accessibleNotes = [...notes, ...sharedNotes.map((share) => share.notes).filter(Boolean)]
    if (!ownerId) {
      const notesById = new Map(accessibleNotes.map((note) => [note.id, note]))
      const fallback = accessibleNotes.flatMap((source) =>
        extractKnowledgeLinks({ ownerId: 'fallback', note: source, notesById }))
        .filter((link) => link.targetNoteId === noteId)
        .map((link) => ({
          ...link,
          linkId: link.id,
          id: link.sourceNoteId,
          noteId: link.sourceNoteId,
          title: notesById.get(link.sourceNoteId)?.title || 'Untitled note',
        }))
      setBacklinks(fallback)
      return () => { active = false }
    }
    void getBacklinks(ownerId, noteId, accessibleNotes).then((links) => {
      if (!active) return
      setBacklinks(links.map((link) => ({
        ...link,
        linkId: link.id,
        id: link.sourceNoteId,
        noteId: link.sourceNoteId,
        title: link.sourceTitle,
      })))
    })
    return () => { active = false }
  }, [indexStatus.documentCount, indexStatus.status, noteId, notes, ownerId, sharedNotes])

  return backlinks
}

export function useForwardLinks(noteId) {
  const ownerId = useNotesStore((state) => state.hydratedWorkspaceOwnerId)
  const notes = useNotesStore((state) => state.notes)
  const sharedNotes = useNotesStore((state) => state.sharedNotes || [])
  const indexStatus = useKnowledgeIndexStatus()
  const [links, setLinks] = useState([])

  useEffect(() => {
    let active = true
    if (!noteId) {
      setLinks([])
      return () => { active = false }
    }
    const accessibleNotes = [...notes, ...sharedNotes.map((share) => share.notes).filter(Boolean)]
    if (!ownerId) {
      const notesById = new Map(accessibleNotes.map((note) => [note.id, note]))
      const source = notesById.get(noteId)
      setLinks(source ? extractKnowledgeLinks({ ownerId: 'fallback', note: source, notesById }).map((link) => ({
        ...link,
        targetTitle: notesById.get(link.targetNoteId)?.title || 'Missing note',
        targetBroken: !notesById.has(link.targetNoteId),
      })) : [])
      return () => { active = false }
    }
    void getForwardLinks(ownerId, noteId, accessibleNotes).then((result) => {
      if (active) setLinks(result)
    })
    return () => { active = false }
  }, [indexStatus.documentCount, indexStatus.status, noteId, notes, ownerId, sharedNotes])

  return links
}
