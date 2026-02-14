import React, { useState, useEffect, useRef } from 'react'
import { Link2, X, Search, FileText, ArrowRight } from 'lucide-react'
import { useNotesStore } from '../store'
import { useTranslation } from '../lib/useTranslation'

export default function NoteLinkPopover({ editor, isOpen, onClose, position }) {
  const { notes } = useNotesStore()
  const { t } = useTranslation()
  const [searchQuery, setSearchQuery] = useState('')
  const [filteredNotes, setFilteredNotes] = useState([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef(null)
  const popoverRef = useRef(null)

  useEffect(() => {
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      const filtered = notes
        .filter(note => !note.deleted)
        .filter(note => 
          note.title.toLowerCase().includes(query) ||
          note.content?.toLowerCase().includes(query)
        )
        .slice(0, 8)
      setFilteredNotes(filtered)
      setSelectedIndex(0)
    } else {
      const recent = notes
        .filter(note => !note.deleted)
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
        .slice(0, 5)
      setFilteredNotes(recent)
      setSelectedIndex(0)
    }
  }, [searchQuery, notes])

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus()
      }, 50)
    }
  }, [isOpen])

  const handleKeyDown = (e) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => 
          prev < filteredNotes.length - 1 ? prev + 1 : 0
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : filteredNotes.length - 1
        )
        break
      case 'Enter':
        e.preventDefault()
        if (filteredNotes[selectedIndex]) {
          insertNoteLink(filteredNotes[selectedIndex])
        }
        break
      case 'Escape':
        onClose()
        break
    }
  }

  const insertNoteLink = (note) => {
    if (!editor) return

    const linkHtml = `<a href="note://${note.id}" class="note-link" data-note-id="${note.id}">${note.title}</a>`
    
    editor.chain()
      .focus()
      .insertContent(linkHtml)
      .insertContent(' ')
      .run()

    setSearchQuery('')
    onClose()
  }

  const getPreview = (content) => {
    if (!content) return t('noteLink.emptyNote')
    const text = content.replace(/<[^>]*>/g, '')
    return text.substring(0, 60) + (text.length > 60 ? '...' : '')
  }

  if (!isOpen) return null

  return (
    <div
      ref={popoverRef}
      className="fixed z-50 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-80 overflow-hidden"
      style={{
        left: position?.x || 100,
        top: position?.y || 100,
      }}
    >
      <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Link2 className="w-4 h-4 text-emerald-600" />
            {t('noteLink.title')}
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('noteLink.searchNotes')}
            className="w-full pl-9 pr-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
          />
        </div>
      </div>
      <div className="max-h-64 overflow-y-auto">
        {filteredNotes.length === 0 ? (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400">
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">{t('noteLink.noNotesFound')}</p>
          </div>
        ) : (
          <div className="py-1">
            {searchQuery === '' && (
              <div className="px-3 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                {t('noteLink.recentNotes')}
              </div>
            )}
            {filteredNotes.map((note, index) => (
              <button
                key={note.id}
                onClick={() => insertNoteLink(note)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`w-full px-3 py-2 flex items-start gap-3 transition-colors ${
                  index === selectedIndex
                    ? 'bg-emerald-50 dark:bg-emerald-900/30'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700/50'
                }`}
              >
                <FileText className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                  index === selectedIndex ? 'text-emerald-600' : 'text-gray-400'
                }`} />
                <div className="flex-1 text-left min-w-0">
                  <p className={`text-sm font-medium truncate ${
                    index === selectedIndex 
                      ? 'text-emerald-900 dark:text-emerald-100' 
                      : 'text-gray-900 dark:text-white'
                  }`}>
                    {note.title}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {getPreview(note.content)}
                  </p>
                </div>
                {index === selectedIndex && (
                  <ArrowRight className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-1" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="px-3 py-2 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
          <span className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-[10px]">{"\u2191\u2193"}</span>
          Navigate
          <span className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-[10px]">Enter</span>
          Select
          <span className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-[10px]">Esc</span>
          Close
        </p>
      </div>
    </div>
  )
}

export function useNoteLinkHandler() {
  const { notes, setSelectedNote } = useNotesStore()

  useEffect(() => {
    const handleClick = (e) => {
      const link = e.target.closest('a.note-link')
      if (link) {
        e.preventDefault()
        const noteId = link.dataset.noteId
        if (noteId) {
          const note = notes.find(n => n.id === noteId)
          if (note) {
            setSelectedNote(noteId)
          } else {
            alert('This linked note no longer exists')
          }
        }
      }
    }

    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [notes, setSelectedNote])
}

export function useBacklinks(noteId) {
  const { notes } = useNotesStore()
  const [backlinks, setBacklinks] = useState([])

  useEffect(() => {
    if (!noteId) {
      setBacklinks([])
      return
    }

    const linkedNotes = notes.filter(note => {
      if (note.id === noteId || note.deleted) return false
      return note.content?.includes(`note://${noteId}`) || 
             note.content?.includes(`data-note-id="${noteId}"`)
    })

    setBacklinks(linkedNotes)
  }, [noteId, notes])

  return backlinks
}
