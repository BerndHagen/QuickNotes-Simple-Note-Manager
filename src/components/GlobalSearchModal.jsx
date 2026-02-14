import React, { useState, useRef, useEffect, useCallback } from 'react'
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
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] bg-black/50 backdrop-blur-sm modal-backdrop-animate"
      onClick={() => setGlobalSearchOpen(false)}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden border border-[#cbd1db] dark:border-gray-700 modal-animate"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-1.5 bg-gradient-to-r from-emerald-600 to-teal-600" />
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#cbd1db] dark:border-gray-700">
          <Search className="w-5 h-5 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleQueryChange}
            placeholder="Search notes, folders, or tags..."
            className="flex-1 bg-transparent text-lg outline-none text-gray-900 dark:text-white placeholder-gray-400"
          />
          {isSearching && <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />}
          <kbd className="kbd hidden sm:inline-flex">
            ESC
          </kbd>
        </div>
        <div ref={resultsRef} className="max-h-[60vh] overflow-y-auto">
          {query && totalResults === 0 && !isSearching && (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No results for "{query}"</p>
            </div>
          )}
          {results.notes.length > 0 && (
            <div className="p-2">
              <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
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
                      ? 'bg-primary-100 dark:bg-primary-900/50'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <FileText className="w-5 h-5 mt-0.5 text-gray-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 dark:text-white truncate">
                      {highlightMatch(note.title, query)}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                      {highlightMatch(note.preview, query)}
                    </div>
                    {note.matchType === 'tag' && (
                      <div className="flex items-center gap-1 mt-1">
                        <Tag className="w-3 h-3 text-gray-400" />
                        <span className="text-xs text-gray-400">
                          Tags: {note.tags?.join(', ')}
                        </span>
                      </div>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 shrink-0 mt-1" />
                </button>
              ))}
            </div>
          )}
          {results.folders.length > 0 && (
            <div className="p-2 border-t border-[#cbd1db] dark:border-gray-700">
              <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
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
                      ? 'bg-primary-100 dark:bg-primary-900/50'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <Folder className="w-5 h-5" style={{ color: folder.color }} />
                  <span className="font-medium text-gray-900 dark:text-white">
                    {highlightMatch(folder.name, query)}
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-400 ml-auto" />
                </button>
              ))}
            </div>
          )}
          {results.tags.length > 0 && (
            <div className="p-2 border-t border-[#cbd1db] dark:border-gray-700">
              <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
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
                      ? 'bg-primary-100 dark:bg-primary-900/50'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <span
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="font-medium text-gray-900 dark:text-white">
                    #{highlightMatch(tag.name, query)}
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-400 ml-auto" />
                </button>
              ))}
            </div>
          )}
          {!query && (
            <div className="p-6 text-center text-gray-500 dark:text-gray-400">
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
          <div className="px-4 py-2 border-t border-[#cbd1db] dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 flex items-center justify-between">
            <span>{totalResults} result{totalResults !== 1 ? 's' : ''}</span>
            <span>Ctrl+Shift+F for global search</span>
          </div>
        )}
      </div>
    </div>
  )
}
