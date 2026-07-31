import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Search,
  FileText,
  Folder,
  Tag,
  ChevronRight,
  Loader2
} from 'lucide-react'
import { useNotesStore, useUIStore } from '../store'
import { debounce } from '../lib/utils'
import { useTranslation } from '../lib/useTranslation'
import LegacyDialog from './ui/LegacyDialog'

export default function GlobalSearchModal() {
  const { t } = useTranslation()
  const { globalSearchOpen, setGlobalSearchOpen } = useUIStore()
  const { notes, folders, tags, setSelectedNote, setSelectedFolder, setSelectedTagFilter } = useNotesStore()
  
  const [query, setQuery] = useState('')
  const [results, setResults] = useState({ notes: [], folders: [], tags: [] })
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [isSearching, setIsSearching] = useState(false)
  const inputRef = useRef(null)
  const resultsRef = useRef(null)

  useEffect(() => {
    if (globalSearchOpen) {
      setQuery('')
      setResults({ notes: [], folders: [], tags: [] })
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [globalSearchOpen])
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!globalSearchOpen) return

      const totalResults = results.notes.length + results.folders.length + results.tags.length

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex((prev) => (prev + 1) % Math.max(totalResults, 1))
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex((prev) => (prev - 1 + Math.max(totalResults, 1)) % Math.max(totalResults, 1))
          break
        case 'Enter':
          e.preventDefault()
          handleSelectResult(selectedIndex)
          break
        case 'Escape':
          setGlobalSearchOpen(false)
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [globalSearchOpen, results, selectedIndex])
  useEffect(() => {
    const handleGlobalShortcut = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'f') {
        e.preventDefault()
        setGlobalSearchOpen(true)
      }
    }

    document.addEventListener('keydown', handleGlobalShortcut)
    return () => document.removeEventListener('keydown', handleGlobalShortcut)
  }, [])

  const performSearch = useCallback(
    debounce((searchQuery) => {
      if (!searchQuery.trim()) {
        setResults({ notes: [], folders: [], tags: [] })
        setIsSearching(false)
        return
      }

      const q = searchQuery.toLowerCase()
      const matchedNotes = notes
        .filter((note) => !note.deleted && !note.archived)
        .filter((note) => {
          const titleMatch = note.title.toLowerCase().includes(q)
          const contentMatch = stripHtml(note.content || '').toLowerCase().includes(q)
          const tagMatch = note.tags?.some((t) => t.toLowerCase().includes(q))
          return titleMatch || contentMatch || tagMatch
        })
        .slice(0, 10)
        .map((note) => ({
          ...note,
          matchType: getMatchType(note, q),
          preview: getMatchPreview(note, q),
        }))
      const matchedFolders = folders
        .filter((folder) => folder.name.toLowerCase().includes(q))
        .slice(0, 5)
      const matchedTags = tags
        .filter((tag) => tag.name.toLowerCase().includes(q))
        .slice(0, 5)

      setResults({
        notes: matchedNotes,
        folders: matchedFolders,
        tags: matchedTags,
      })
      setIsSearching(false)
    }, 200),
    [notes, folders, tags]
  )

  const handleQueryChange = (e) => {
    const value = e.target.value
    setQuery(value)
    setIsSearching(true)
    setSelectedIndex(0)
    performSearch(value)
  }

  const stripHtml = (html) => {
    const div = document.createElement('div')
    div.innerHTML = html
    return div.textContent || div.innerText || ''
  }

  const getMatchType = (note, query) => {
    if (note.title.toLowerCase().includes(query)) return 'title'
    if (note.tags?.some((t) => t.toLowerCase().includes(query))) return 'tag'
    return 'content'
  }

  const getMatchPreview = (note, query) => {
    const content = stripHtml(note.content || '')
    const lowerContent = content.toLowerCase()
    const index = lowerContent.indexOf(query)
    
    if (index === -1) return content.slice(0, 100) + '...'
    
    const start = Math.max(0, index - 40)
    const end = Math.min(content.length, index + query.length + 40)
    let preview = content.slice(start, end)
    
    if (start > 0) preview = '...' + preview
    if (end < content.length) preview = preview + '...'
    
    return preview
  }

  const highlightMatch = (text, query) => {
    if (!query) return text
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    const parts = text.split(regex)
    
    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 text-inherit rounded px-0.5">
          {part}
        </mark>
      ) : (
        part
      )
    )
  }

  const handleSelectResult = (index) => {
    let currentIndex = 0
    for (const note of results.notes) {
      if (currentIndex === index) {
        setSelectedNote(note.id)
        setGlobalSearchOpen(false)
        return
      }
      currentIndex++
    }
    for (const folder of results.folders) {
      if (currentIndex === index) {
        setSelectedFolder(folder.id)
        setGlobalSearchOpen(false)
        return
      }
      currentIndex++
    }
    for (const tag of results.tags) {
      if (currentIndex === index) {
        setSelectedTagFilter(tag.name)
        setGlobalSearchOpen(false)
        return
      }
      currentIndex++
    }
  }

  const getResultIndex = (type, itemIndex) => {
    let offset = 0
    if (type === 'folder') offset = results.notes.length
    if (type === 'tag') offset = results.notes.length + results.folders.length
    return offset + itemIndex
  }

  const totalResults = results.notes.length + results.folders.length + results.tags.length

  if (!globalSearchOpen) return null

  return (
    <LegacyDialog label="Search all notes" onClose={() => setGlobalSearchOpen(false)} align="top">
      <div
        className="bg-surface-raised rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden border border-subtle modal-animate"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-1.5 qn-banner-surface" />
        <div className="flex items-center gap-3 px-4 py-3 border-b border-subtle">
          <Search className="w-5 h-5 text-content-subtle" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleQueryChange}
            placeholder="Search notes, folders, or tags..."
            className="flex-1 bg-transparent text-lg outline-none text-content placeholder:text-content-subtle"
          />
          {isSearching && <Loader2 className="w-5 h-5 text-content-subtle animate-spin" />}
          <kbd className="kbd hidden sm:inline-flex">
            ESC
          </kbd>
        </div>
        <div ref={resultsRef} className="max-h-[60vh] overflow-y-auto">
          {query && totalResults === 0 && !isSearching && (
            <div className="p-8 text-center text-content-muted">
              <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No results for "{query}"</p>
            </div>
          )}
          {results.notes.length > 0 && (
            <div className="p-2">
              <div className="px-3 py-1.5 text-xs font-semibold text-content-muted uppercase">
                Notes
              </div>
              {results.notes.map((note, i) => (
                <button
                  key={note.id}
                  onClick={() => {
                    setSelectedNote(note.id)
                    setGlobalSearchOpen(false)
                  }}
                  className={`w-full px-3 py-2 rounded-lg flex items-start gap-3 text-left transition-colors ${
 selectedIndex === getResultIndex('note', i)
 ? 'bg-primary-100 dark:bg-accent-soft'
                      : 'hover:bg-surface-hover'
                  }`}
                >
                  <FileText className="w-5 h-5 mt-0.5 text-content-subtle shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-content truncate">
                      {highlightMatch(note.title, query)}
                    </div>
                    <div className="text-sm text-content-muted line-clamp-2">
                      {highlightMatch(note.preview, query)}
                    </div>
                    {note.matchType === 'tag' && (
                      <div className="flex items-center gap-1 mt-1">
                        <Tag className="w-3 h-3 text-content-subtle" />
                        <span className="text-xs text-content-subtle">
                          Tags: {note.tags?.join(', ')}
                        </span>
                      </div>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-content-subtle shrink-0 mt-1" />
                </button>
              ))}
            </div>
          )}
          {results.folders.length > 0 && (
            <div className="p-2 border-t border-subtle">
              <div className="px-3 py-1.5 text-xs font-semibold text-content-muted uppercase">
                Folders
              </div>
              {results.folders.map((folder, i) => (
                <button
                  key={folder.id}
                  onClick={() => {
                    setSelectedFolder(folder.id)
                    setGlobalSearchOpen(false)
                  }}
                  className={`w-full px-3 py-2 rounded-lg flex items-center gap-3 text-left transition-colors ${
 selectedIndex === getResultIndex('folder', i)
 ? 'bg-primary-100 dark:bg-accent-soft'
                      : 'hover:bg-surface-hover'
                  }`}
                >
                  <Folder className="w-5 h-5" style={{ color: folder.color }} />
                  <span className="font-medium text-content">
                    {highlightMatch(folder.name, query)}
                  </span>
                  <ChevronRight className="w-4 h-4 text-content-subtle ml-auto" />
                </button>
              ))}
            </div>
          )}
          {results.tags.length > 0 && (
            <div className="p-2 border-t border-subtle">
              <div className="px-3 py-1.5 text-xs font-semibold text-content-muted uppercase">
                Tags
              </div>
              {results.tags.map((tag, i) => (
                <button
                  key={tag.id}
                  onClick={() => {
                    setSelectedTagFilter(tag.name)
                    setGlobalSearchOpen(false)
                  }}
                  className={`w-full px-3 py-2 rounded-lg flex items-center gap-3 text-left transition-colors ${
 selectedIndex === getResultIndex('tag', i)
 ? 'bg-primary-100 dark:bg-accent-soft'
                      : 'hover:bg-surface-hover'
                  }`}
                >
                  <span
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="font-medium text-content">
                    #{highlightMatch(tag.name, query)}
                  </span>
                  <ChevronRight className="w-4 h-4 text-content-subtle ml-auto" />
                </button>
              ))}
            </div>
          )}
          {!query && (
            <div className="p-6 text-center text-content-muted">
              <p className="text-sm">Start typing to search</p>
              <div className="flex justify-center gap-4 mt-4 text-xs">
                <span><kbd className="kbd px-1.5 py-0.5">{"\u2191\u2193"}</kbd> Navigate</span>
                <span><kbd className="kbd px-1.5 py-0.5">{"\u21B5"}</kbd> Open</span>
                <span><kbd className="kbd px-1.5 py-0.5">ESC</kbd> Close</span>
              </div>
            </div>
          )}
        </div>
        {totalResults > 0 && (
          <div className="px-4 py-2 border-t border-subtle text-xs text-content-muted flex items-center justify-between">
            <span>{totalResults} result{totalResults !== 1 ? 's' : ''}</span>
            <span>Ctrl+Shift+F for global search</span>
          </div>
        )}
      </div>
    </LegacyDialog>
  )
}
