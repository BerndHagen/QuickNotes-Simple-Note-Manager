import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FileText, Search } from 'lucide-react'
import { useNotesStore, useUIStore } from '../../store'
import { createSearchDocument } from '../../lib/knowledge/document'
import { parseKnowledgeQuery } from '../../lib/knowledge/query'
import { createKnowledgeSearchEngine } from '../../lib/knowledge/searchEngine'
import { searchKnowledge } from '../../lib/knowledge/service'
import { debounce } from '../../lib/utils'

const MAX_RESULTS = 8

/**
 * The application-bar search is an actual inline combobox. Ctrl+K remains the
 * advanced search window, but merely focusing this field never opens a modal.
 */
export default function TopSearch() {
  const notes = useNotesStore((state) => state.notes)
  const sharedNotes = useNotesStore((state) => state.sharedNotes || [])
  const folders = useNotesStore((state) => state.folders)
  const navigateToKnowledgeTarget = useNotesStore((state) => state.navigateToKnowledgeTarget)
  const setMobileView = useUIStore((state) => state.setMobileView)
  const query = useUIStore((state) => state.globalSearchQuery)
  const setQuery = useUIStore((state) => state.setGlobalSearchQuery)
  const setAdvancedSearchOpen = useUIStore((state) => state.setGlobalSearchOpen)
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const rootRef = useRef(null)
  const requestRef = useRef(0)

  const accessibleNotes = useMemo(
    () => [...notes, ...sharedNotes.map((share) => share.notes).filter(Boolean)],
    [notes, sharedNotes]
  )
  const fallbackEngine = useMemo(() => {
    const folderById = new Map(folders.map((folder) => [folder.id, folder]))
    const notesById = new Map(accessibleNotes.map((note) => [note.id, note]))
    return createKnowledgeSearchEngine(accessibleNotes.map((note) => createSearchDocument({
      ownerId: 'active-workspace',
      note,
      folder: folderById.get(note.folderId),
      notesById,
    })))
  }, [accessibleNotes, folders])

  const runSearch = useMemo(() => debounce(async (value, token) => {
    const parsed = parseKnowledgeQuery(value)
    let matches = []
    try {
      matches = await searchKnowledge(parsed, { noteType: 'all', limit: MAX_RESULTS })
      if (!matches.length) matches = fallbackEngine.search(parsed, { noteType: 'all', limit: MAX_RESULTS })
    } catch {
      // Indexed search can be unavailable briefly during first hydration. The
      // same canonical projection provides an immediate in-memory fallback.
      matches = fallbackEngine.search(parsed, { noteType: 'all', limit: MAX_RESULTS })
    }
    if (token !== requestRef.current) return
    setResults(matches.slice(0, MAX_RESULTS))
    setSearching(false)
    setActiveIndex(0)
    setOpen(Boolean(value.trim()))
  }, 100), [fallbackEngine])

  useEffect(() => () => runSearch.cancel(), [runSearch])
  useEffect(() => {
    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  const selectResult = useCallback((result) => {
    if (!result) return
    navigateToKnowledgeTarget(result.target || { noteId: result.noteId })
    setMobileView('editor')
    setQuery('')
    setResults([])
    setOpen(false)
  }, [navigateToKnowledgeTarget, setMobileView, setQuery])

  const handleChange = (event) => {
    const value = event.target.value
    setQuery(value)
    setResults([])
    if (!value.trim()) {
      requestRef.current += 1
      runSearch.cancel()
      setOpen(false)
      setSearching(false)
      return
    }
    setOpen(true)
    setSearching(true)
    runSearch(value, ++requestRef.current)
  }

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
      event.currentTarget.blur()
      return
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!results.length) return
      event.preventDefault()
      setOpen(true)
      setActiveIndex((index) => event.key === 'ArrowDown'
        ? (index + 1) % results.length
        : (index - 1 + results.length) % results.length)
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      if (open && results[activeIndex]) selectResult(results[activeIndex])
      else setAdvancedSearchOpen(true)
    }
  }

  return (
    <div ref={rootRef} className="qn-top-search-root w-full max-w-[32rem] min-w-0">
      <label className="qn-top-search flex h-9 w-full min-w-0 items-center gap-2 border border-banner-border bg-white/[0.07] px-2.5 text-left text-ui-md text-banner-muted transition-colors duration-fast focus-within:bg-banner-hover focus-within:text-banner-text hover:bg-banner-hover hover:text-banner-text sm:px-3">
        <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
        <input
          type="search"
          role="combobox"
          value={query}
          onChange={handleChange}
          onFocus={() => query.trim() && setOpen(true)}
          onKeyDown={handleKeyDown}
          aria-label="Search all notes and content"
          aria-autocomplete="list"
          aria-controls="qn-top-search-listbox"
          aria-expanded={open}
          aria-activedescendant={open && results.length ? `qn-top-search-result-${activeIndex}` : undefined}
          placeholder="Notes and content"
          className="qn-top-search-input min-w-0 flex-1 bg-transparent text-banner-text outline-none placeholder:text-banner-muted"
        />
        <kbd className="hidden border border-white/15 bg-black/10 px-1.5 py-0.5 font-sans text-ui-xs text-banner-muted xl:inline">
          Ctrl K
        </kbd>
      </label>

      {open && (
        <div className="qn-top-search-results">
          <div id="qn-top-search-listbox" role="listbox" aria-label="Search results">
            {results.length ? results.map((result, index) => (
              <button
                id={`qn-top-search-result-${index}`}
                key={`${result.noteId}-${result.locationKey || index}`}
                type="button"
                role="option"
                aria-selected={activeIndex === index}
                onPointerMove={() => setActiveIndex(index)}
                onClick={() => selectResult(result)}
                className="qn-top-search-result"
              >
                <FileText className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <strong>{result.title || 'Untitled note'}</strong>
                  <small>{result.snippet || 'Open note'}</small>
                </span>
              </button>
            )) : (
              <p className="qn-top-search-empty" role="status">
                {searching ? 'Searching all notes and content…' : 'No matching notes or content'}
              </p>
            )}
          </div>
          <button type="button" className="qn-top-search-advanced" onClick={() => { setOpen(false); setAdvancedSearchOpen(true) }}>
            Advanced search and filters <kbd>Ctrl K</kbd>
          </button>
        </div>
      )}
    </div>
  )
}
