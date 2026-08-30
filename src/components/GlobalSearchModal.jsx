import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BrainCircuit, ChevronRight, FileText, Folder, Loader2, Move, PenTool, RefreshCw, Search, Tag, X } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNotesStore, useUIStore } from '../store'
import { debounce } from '../lib/utils'
import { formatShortcut, loadShortcuts } from '../lib/shortcuts'
import { parseKnowledgeQuery } from '../lib/knowledge/query'
import { rebuildActiveKnowledgeIndex, searchKnowledge } from '../lib/knowledge/service'
import { createSearchDocument } from '../lib/knowledge/document'
import { createKnowledgeSearchEngine } from '../lib/knowledge/searchEngine'
import { useKnowledgeIndexStatus } from '../hooks/useKnowledgeIndex'
import { useTranslation } from '../lib/useTranslation'
import { Button, Input, Modal } from './ui'
import { db } from '../lib/db'
import { getIntelligenceSettings } from '../lib/intelligence/repository'
import {
  cancelIntelligenceJob,
  getAiIntelligenceAvailability,
  requestSemanticIndex,
  searchSemantically,
} from '../lib/intelligence/service'
import { mergeHybridResults } from '../lib/intelligence/semantic'

const EMPTY_RESULTS = { notes: [], folders: [], tags: [] }
const TYPE_FILTERS = [
  { id: 'all', label: 'All notes' },
  { id: 'standard', label: 'Documents' },
  { id: 'todo', label: 'Tasks' },
  { id: 'project', label: 'Projects' },
  { id: 'meeting', label: 'Meetings' },
  { id: 'journal', label: 'Journals' },
  { id: 'brainstorm', label: 'Brainstorms' },
  { id: 'shopping', label: 'Shopping' },
  { id: 'weekly', label: 'Weekly plans' },
  { id: 'paper', label: 'Paper' },
  { id: 'canvas', label: 'Canvas' },
]

const MATCH_LABELS = {
  title: 'Title',
  heading: 'Heading',
  tag: 'Tag',
  object: 'Spatial object',
  content: 'Content',
  recognized: 'Recognized text',
  attachment: 'Attachment',
  metadata: 'Details',
  recent: 'Recent',
}

const highlightTerms = (text, query) => {
  const parsed = parseKnowledgeQuery(query)
  const terms = [...parsed.phrases, ...parsed.text.split(/\s+/u)]
    .map((term) => term.trim())
    .filter((term) => term.length > 1)
    .sort((left, right) => right.length - left.length)
  if (!text || terms.length === 0) return text
  const expression = terms
    .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|')
  const parts = String(text).split(new RegExp(`(${expression})`, 'giu'))
  const normalizedTerms = new Set(terms.map((term) => term.toLocaleLowerCase()))
  return parts.map((part, index) => normalizedTerms.has(part.toLocaleLowerCase()) ? (
    <mark key={`${index}-${part}`} className="bg-warning-soft px-0.5 text-inherit">{part}</mark>
  ) : part)
}

const readGlobalSearchShortcut = () => formatShortcut(loadShortcuts().globalSearch)
const iconForResult = (result) => result.contentKind === 'paper'
  ? PenTool
  : result.contentKind === 'canvas'
    ? Move
    : FileText

export default function GlobalSearchModal() {
  const { t } = useTranslation()
  const {
    globalSearchOpen,
    globalSearchQuery,
    setGlobalSearchOpen,
    setGlobalSearchQuery,
    setMobileView,
  } = useUIStore()
  const {
    notes,
    sharedNotes = [],
    folders,
    tags,
    user,
    cacheOwnerId,
    navigateToKnowledgeTarget,
    setSelectedFolder,
    setSelectedTagFilter,
  } = useNotesStore()
  const indexStatus = useKnowledgeIndexStatus()
  const accessibleNotes = useMemo(
    () => [...notes, ...sharedNotes.map((share) => share.notes).filter(Boolean)],
    [notes, sharedNotes]
  )
  const fallbackEngine = useMemo(() => {
    if (indexStatus.ownerId) return null
    const folderById = new Map(folders.map((folder) => [folder.id, folder]))
    const notesById = new Map(accessibleNotes.map((note) => [note.id, note]))
    const documents = accessibleNotes.map((note) => createSearchDocument({
      ownerId: 'unhydrated-workspace',
      note,
      folder: folderById.get(note.folderId),
      notesById,
    }))
    return createKnowledgeSearchEngine(documents)
  }, [accessibleNotes, folders, indexStatus.ownerId])
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(EMPTY_RESULTS)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [isSearching, setIsSearching] = useState(false)
  const [typeFilter, setTypeFilter] = useState('all')
  const [shortcutLabel, setShortcutLabel] = useState(readGlobalSearchShortcut)
  const [aiAvailability, setAiAvailability] = useState(null)
  const [semanticJobId, setSemanticJobId] = useState(null)
  const [semanticSearching, setSemanticSearching] = useState(false)
  const [semanticError, setSemanticError] = useState('')
  const [consentAction, setConsentAction] = useState(null)
  const inputRef = useRef(null)
  const requestTokenRef = useRef(0)
  const semanticAbortRef = useRef(null)
  const semanticJob = useLiveQuery(() => semanticJobId ? db.intelligenceJobs.get(semanticJobId) : null, [semanticJobId], null)
  const semanticState = useLiveQuery(() => cacheOwnerId ? db.semanticIndexState.get(cacheOwnerId) : null, [cacheOwnerId], null)
  const ownedIndexNotes = useMemo(() => accessibleNotes.filter((note) =>
    !note.isShared && !note.deleted && !note.archived
  ).slice(0, 1_000), [accessibleNotes])

  const performSearch = useMemo(() => debounce(async (searchQuery, selectedType, token) => {
    try {
      const parsed = parseKnowledgeQuery(searchQuery)
      let matchedNotes = await searchKnowledge(parsed, { noteType: selectedType, limit: 80 })
      if (fallbackEngine) matchedNotes = fallbackEngine.search(parsed, { noteType: selectedType, limit: 80 })
      if (token !== requestTokenRef.current) return
      setResults({
        notes: matchedNotes,
        folders: parsed.text
          ? folders.filter((folder) => folder.name.toLocaleLowerCase().includes(parsed.text)).slice(0, 5)
          : [],
        tags: parsed.text
          ? tags.filter((tag) => tag.name.toLocaleLowerCase().includes(parsed.text)).slice(0, 5)
          : [],
      })
    } catch {
      if (token !== requestTokenRef.current) return
      const normalized = searchQuery.trim().toLocaleLowerCase()
      setResults({
        notes: accessibleNotes
          .filter((note) => !note.deleted && !note.archived)
          .filter((note) => selectedType === 'all' || (note.noteType || 'standard') === selectedType)
          .filter((note) => !normalized || String(note.title || '').toLocaleLowerCase().includes(normalized))
          .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
          .slice(0, 12)
          .map((note) => ({
            ...note,
            noteId: note.id,
            target: { noteId: note.id },
            matchField: normalized ? 'title' : 'recent',
            snippet: '',
          })),
        folders: [],
        tags: [],
      })
    } finally {
      if (token === requestTokenRef.current) {
        setSelectedIndex(0)
        setIsSearching(false)
      }
    }
  }, 120), [accessibleNotes, fallbackEngine, folders, tags])

  const requestSearch = useCallback((nextQuery, nextType) => {
    semanticAbortRef.current?.abort()
    semanticAbortRef.current = null
    setSemanticSearching(false)
    setSemanticError('')
    setConsentAction(null)
    performSearch.cancel()
    setIsSearching(true)
    const token = ++requestTokenRef.current
    performSearch(nextQuery, nextType, token)
  }, [performSearch])

  const flattenedResults = useMemo(() => [
    ...results.notes.map((item) => ({ type: 'note', item })),
    ...results.folders.map((item) => ({ type: 'folder', item })),
    ...results.tags.map((item) => ({ type: 'tag', item })),
  ], [results])
  const totalResults = flattenedResults.length
  const activeOptionId = totalResults ? `qn-search-option-${selectedIndex}` : undefined

  const closeSearch = useCallback(() => {
    semanticAbortRef.current?.abort()
    semanticAbortRef.current = null
    if (semanticJob && ['queued', 'running'].includes(semanticJob.status)) void cancelIntelligenceJob(semanticJob.id)
    performSearch.cancel()
    requestTokenRef.current += 1
    setGlobalSearchQuery('')
    setGlobalSearchOpen(false)
  }, [performSearch, semanticJob, setGlobalSearchOpen, setGlobalSearchQuery])

  const selectResult = useCallback((index) => {
    const result = flattenedResults[index]
    if (!result) return
    if (result.type === 'note') {
      navigateToKnowledgeTarget(result.item.target || { noteId: result.item.noteId })
      setMobileView('editor')
    } else if (result.type === 'folder') {
      setSelectedFolder(result.item.id)
      setMobileView('notes')
    } else {
      setSelectedTagFilter(result.item.name)
      setMobileView('notes')
    }
    closeSearch()
  }, [closeSearch, flattenedResults, navigateToKnowledgeTarget, setMobileView, setSelectedFolder, setSelectedTagFilter])

  useEffect(() => () => performSearch.cancel(), [performSearch])
  useEffect(() => {
    if (!globalSearchOpen) {
      performSearch.cancel()
      return
    }
    const initialQuery = globalSearchQuery || ''
    setQuery(initialQuery)
    setResults(EMPTY_RESULTS)
    setSelectedIndex(0)
    setTypeFilter('all')
    setAiAvailability(null)
    setSemanticJobId(null)
    setSemanticError('')
    setConsentAction(null)
    requestSearch(initialQuery, 'all')
    // Opening initializes the query once. A worker/status transition must not
    // clear text that the user has already entered; the ready-state effect
    // below refreshes that current query instead.
  }, [globalSearchOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!globalSearchOpen || !cacheOwnerId || user?.isLocal) return undefined
    const controller = new AbortController()
    void getIntelligenceSettings(cacheOwnerId).then((settings) => {
      if (settings.mode !== 'externalAllowed') return null
      return getAiIntelligenceAvailability({ signal: controller.signal })
    }).then((availability) => {
      if (!controller.signal.aborted) setAiAvailability(availability)
    }).catch(() => {
      if (!controller.signal.aborted) setAiAvailability(null)
    })
    return () => controller.abort()
  }, [cacheOwnerId, globalSearchOpen, user?.isLocal])

  useEffect(() => {
    if (globalSearchOpen && indexStatus.status === 'ready') requestSearch(query, typeFilter)
    // Re-run once a background build becomes queryable; keystrokes use their
    // own debounced path above.
  }, [globalSearchOpen, indexStatus.documentCount, indexStatus.status]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const updateShortcut = () => setShortcutLabel(readGlobalSearchShortcut())
    window.addEventListener('quicknotes:shortcuts-changed', updateShortcut)
    return () => window.removeEventListener('quicknotes:shortcuts-changed', updateShortcut)
  }, [])
  useEffect(() => {
    if (activeOptionId) document.getElementById(activeOptionId)?.scrollIntoView?.({ block: 'nearest' })
  }, [activeOptionId])

  const handleQueryChange = (event) => {
    setQuery(event.target.value)
    setGlobalSearchQuery(event.target.value)
    setResults(EMPTY_RESULTS)
    setSelectedIndex(0)
    requestSearch(event.target.value, typeFilter)
  }
  const handleTypeFilterChange = (nextType) => {
    setTypeFilter(nextType)
    setResults(EMPTY_RESULTS)
    setSelectedIndex(0)
    requestSearch(query, nextType)
  }
  const handleSearchKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (totalResults) setSelectedIndex((index) => (index + 1) % totalResults)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (totalResults) setSelectedIndex((index) => (index - 1 + totalResults) % totalResults)
    } else if (event.key === 'Enter' && totalResults) {
      event.preventDefault()
      selectResult(selectedIndex)
    }
  }

  const retryIndex = async () => {
    setIsSearching(true)
    try {
      await rebuildActiveKnowledgeIndex({ notes: accessibleNotes, folders })
      requestSearch(query, typeFilter)
    } finally {
      setIsSearching(false)
    }
  }

  const beginSemanticIndex = async () => {
    setConsentAction(null)
    setSemanticError('')
    try {
      const job = await requestSemanticIndex({ noteIds: ownedIndexNotes.map((note) => note.id), externalConfirmed: true })
      setSemanticJobId(job.id)
    } catch (error) {
      setSemanticError(error?.message || 'Semantic indexing could not start.')
    }
  }

  const beginSemanticSearch = async () => {
    setConsentAction(null)
    setSemanticError('')
    const controller = new AbortController()
    semanticAbortRef.current = controller
    setSemanticSearching(true)
    try {
      const lexical = results.notes
      const semantic = await searchSemantically({ query, externalConfirmed: true, signal: controller.signal, limit: 80 })
      if (controller.signal.aborted) return
      const filtered = typeFilter === 'all' ? semantic : semantic.filter((note) => note.noteType === typeFilter)
      setResults((current) => ({ ...current, notes: mergeHybridResults(lexical, filtered, query).slice(0, 80) }))
      setSelectedIndex(0)
    } catch (error) {
      if (!controller.signal.aborted) setSemanticError(error?.message || 'Semantic search failed.')
    } finally {
      if (semanticAbortRef.current === controller) semanticAbortRef.current = null
      if (!controller.signal.aborted) setSemanticSearching(false)
    }
  }

  const semanticReady = semanticState?.status === 'ready' && Number(semanticState.embeddingCount) > 0
  const semanticOperational = aiAvailability?.embeddings === true

  const resultFooter = (
    <div className="flex w-full flex-wrap items-center justify-between gap-2 text-ui-sm text-content-muted">
      <span role="status" aria-live="polite">
        {indexStatus.status === 'error'
          ? 'Search index needs attention'
            : isSearching || semanticSearching
            ? 'Searching…'
            : query
              ? `${totalResults} ${t(totalResults === 1 ? 'search.result' : 'search.results')}`
              : `${results.notes.length} recent notes`}
      </span>
      {indexStatus.status === 'error' ? (
        <button type="button" onClick={retryIndex} className="inline-flex items-center gap-1.5 text-accent-text hover:underline">
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Rebuild index
        </button>
      ) : semanticOperational ? (
        <span className="inline-flex items-center gap-2">
          {semanticJob && ['queued', 'running'].includes(semanticJob.status) ? (
            <><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Indexing {Math.round((semanticJob.progress || 0) * 100)}%</>
          ) : semanticReady ? 'Lexical search with optional semantic augmentation' : 'Semantic index is not built'}
        </span>
      ) : (
        <span className="inline-flex items-center gap-2"><kbd className="kbd">{shortcutLabel}</kbd>{t('search.globalSearch')}</span>
      )}
    </div>
  )

  return (
    <Modal
      open={globalSearchOpen}
      onClose={closeSearch}
      title={t('search.globalSearch')}
      icon={Search}
      size="xl"
      initialFocusRef={inputRef}
      contentClassName="h-[88dvh] sm:mt-[8dvh] sm:h-auto sm:self-start"
      bodyPadding="none"
      footer={resultFooter}
    >
      <div className="flex items-center gap-3 border-b border-subtle px-4 py-3 sm:px-5">
        <Search className="h-5 w-5 shrink-0 text-content-subtle" aria-hidden="true" />
        <Input
          ref={inputRef}
          type="search"
          value={query}
          onChange={handleQueryChange}
          onKeyDown={handleSearchKeyDown}
          role="combobox"
          aria-label={t('search.searchPlaceholder')}
          aria-autocomplete="list"
          aria-controls="qn-global-search-results"
          aria-expanded={totalResults > 0}
          aria-activedescendant={activeOptionId}
          placeholder="Search notes, tags, folders, and content…"
          className="h-auto border-0 bg-transparent px-0 py-1 text-lg shadow-none focus:border-transparent focus:ring-0"
        />
        {isSearching && <Loader2 className="h-5 w-5 shrink-0 animate-spin text-content-muted" aria-label="Searching" />}
        {semanticOperational && query.trim() && semanticReady && (
          <button
            type="button"
            onClick={() => setConsentAction({ kind: 'query' })}
            disabled={semanticSearching}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-control border border-subtle px-2.5 text-ui-sm font-medium text-content-muted hover:bg-surface-hover hover:text-content disabled:opacity-60"
          >
            {semanticSearching ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <BrainCircuit className="h-3.5 w-3.5" aria-hidden="true" />}
            <span className="hidden sm:inline">Search meaning</span>
          </button>
        )}
        <kbd className="kbd hidden sm:inline-flex">Esc</kbd>
      </div>

      {semanticOperational && !semanticReady && !semanticJobId && ownedIndexNotes.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-subtle bg-surface-sunken px-4 py-2 text-ui-sm text-content-muted">
          <BrainCircuit className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="mr-auto">Semantic search is optional. Lexical search remains available without it.</span>
          <button type="button" className="font-medium text-accent-text hover:underline" onClick={() => setConsentAction({ kind: 'index' })}>Build semantic index</button>
        </div>
      )}

      {semanticJob && ['queued', 'running'].includes(semanticJob.status) && (
        <div className="flex items-center gap-3 border-b border-subtle bg-surface-sunken px-4 py-2 text-ui-sm text-content-muted">
          <div className="h-1.5 min-w-24 flex-1 overflow-hidden bg-surface-hover" aria-hidden="true"><div className="h-full bg-accent" style={{ width: `${Math.max(3, (semanticJob.progress || 0) * 100)}%` }} /></div>
          <span role="status">Building semantic indexâ€¦ {Math.round((semanticJob.progress || 0) * 100)}%</span>
          <button type="button" className="inline-flex items-center gap-1 font-medium hover:text-content" onClick={() => void cancelIntelligenceJob(semanticJob.id)}><X className="h-3.5 w-3.5" aria-hidden="true" /> Cancel</button>
        </div>
      )}

      {consentAction && (
        <section role="alertdialog" aria-labelledby="qn-semantic-consent-title" className="border-b border-warning-border bg-warning-soft px-4 py-3 text-ui-sm text-warning-text">
          <div className="flex items-start gap-3">
            <BrainCircuit className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <h3 id="qn-semantic-consent-title" className="font-semibold text-content">
                {consentAction.kind === 'index' ? 'Send this explicit note scope for semantic indexing?' : 'Send this search phrase for a semantic match?'}
              </h3>
              <p className="mt-1">
                {consentAction.kind === 'index'
                  ? `${ownedIndexNotes.length} owned notes will be sent to the configured external embedding provider. Shared notes are excluded. Vectors stay on this device and can be deleted or rebuilt.`
                  : `Only “${query.slice(0, 180)}” will be sent. Existing local vectors are compared on this device; note bodies are not resent for this search.`}
              </p>
              <p className="mt-1 text-ui-xs">This approval applies once. Closing Search cancels active work.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => setConsentAction(null)}>Cancel</Button>
                <Button size="sm" variant="primary" onClick={() => void (consentAction.kind === 'index' ? beginSemanticIndex() : beginSemanticSearch())}>Continue once</Button>
              </div>
            </div>
          </div>
        </section>
      )}

      {semanticError && <div role="alert" className="border-b border-danger-border bg-danger-soft px-4 py-2 text-ui-sm text-danger-text">{semanticError}</div>}

      <div role="group" aria-label="Search note types" className="flex gap-1 overflow-x-auto border-b border-subtle bg-surface-raised px-3 py-2">
        {TYPE_FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={typeFilter === item.id}
            onClick={() => handleTypeFilterChange(item.id)}
            className={`h-8 shrink-0 rounded-control px-3 text-ui-sm font-medium transition-colors ${
              typeFilter === item.id ? 'bg-accent-soft text-accent-text' : 'text-content-muted hover:bg-surface-hover hover:text-content'
            }`}
          >{item.label}</button>
        ))}
      </div>

      <div
        id="qn-global-search-results"
        role={totalResults ? 'listbox' : undefined}
        aria-label={totalResults ? t('search.globalSearch') : undefined}
        className="max-h-[min(60dvh,560px)] overflow-y-auto overscroll-contain"
      >
        {!isSearching && totalResults === 0 && (
          <div className="p-8 text-center text-content-muted" role="status">
            <Search className="mx-auto mb-3 h-8 w-8 opacity-40" aria-hidden="true" />
            <p>{query ? `${t('search.noResults')} “${query}”` : 'No recent notes'}</p>
            {query && <p className="mt-2 text-ui-xs">Try a shorter term or filters such as tag:work, type:paper, or is:starred.</p>}
          </div>
        )}

        {results.notes.length > 0 && (
          <section aria-label={query ? t('search.notes') : 'Recent notes'} className="mx-2 mt-2">
            <h3 className="px-3 py-1.5 text-ui-xs font-semibold uppercase tracking-wider text-content-muted">
              {query ? t('search.notes') : 'Recent notes'}
            </h3>
            {results.notes.map((note, index) => {
              const Icon = iconForResult(note)
              const selected = selectedIndex === index
              return (
                <button
                  id={`qn-search-option-${index}`}
                  key={note.noteId}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  tabIndex={-1}
                  onMouseEnter={() => setSelectedIndex(index)}
                  onClick={() => selectResult(index)}
                  className={`flex w-full items-start gap-3 rounded-control px-3 py-2 text-left transition-colors ${selected ? 'bg-accent-soft' : 'hover:bg-surface-hover'}`}
                >
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-content-subtle" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span className="min-w-0 flex-1 truncate font-medium text-content">{highlightTerms(note.title, query)}</span>
                      <span className="shrink-0 text-ui-xs text-content-subtle">
                        {note.matchField === 'semantic'
                          ? 'Semantically related'
                          : note.contentKind === 'structured' && note.matchField === 'content'
                          ? 'Match in structured note details'
                          : MATCH_LABELS[note.matchField] || 'Content'}
                      </span>
                    </span>
                    {note.snippet && <span className="line-clamp-2 block text-ui-md text-content-muted">{highlightTerms(note.snippet, query)}</span>}
                    <span className="mt-0.5 block truncate text-ui-xs text-content-subtle">
                      {[note.folderName, ...(note.tags || []).map((tag) => `#${tag}`)].filter(Boolean).join(' · ') || note.contentKind}
                    </span>
                  </span>
                  <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-content-subtle" aria-hidden="true" />
                </button>
              )
            })}
          </section>
        )}

        {results.folders.length > 0 && (
          <section aria-label={t('search.folders')} className="mx-2 mt-2 border-t border-subtle pt-2">
            <h3 className="px-3 py-1.5 text-ui-xs font-semibold uppercase tracking-wider text-content-muted">{t('search.folders')}</h3>
            {results.folders.map((folder, index) => {
              const resultIndex = results.notes.length + index
              return (
                <button key={folder.id} id={`qn-search-option-${resultIndex}`} type="button" role="option" aria-selected={selectedIndex === resultIndex} tabIndex={-1} onMouseEnter={() => setSelectedIndex(resultIndex)} onClick={() => selectResult(resultIndex)} className={`flex w-full items-center gap-3 rounded-control px-3 py-2 text-left ${selectedIndex === resultIndex ? 'bg-accent-soft' : 'hover:bg-surface-hover'}`}>
                  <Folder className="h-5 w-5 shrink-0" style={{ color: folder.color }} aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate font-medium text-content">{highlightTerms(folder.name, query)}</span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-content-subtle" aria-hidden="true" />
                </button>
              )
            })}
          </section>
        )}

        {results.tags.length > 0 && (
          <section aria-label={t('search.tags')} className="mx-2 my-2 border-t border-subtle pt-2">
            <h3 className="px-3 py-1.5 text-ui-xs font-semibold uppercase tracking-wider text-content-muted">{t('search.tags')}</h3>
            {results.tags.map((tag, index) => {
              const resultIndex = results.notes.length + results.folders.length + index
              return (
                <button key={tag.id} id={`qn-search-option-${resultIndex}`} type="button" role="option" aria-selected={selectedIndex === resultIndex} tabIndex={-1} onMouseEnter={() => setSelectedIndex(resultIndex)} onClick={() => selectResult(resultIndex)} className={`flex w-full items-center gap-3 rounded-control px-3 py-2 text-left ${selectedIndex === resultIndex ? 'bg-accent-soft' : 'hover:bg-surface-hover'}`}>
                  <Tag className="h-4 w-4 shrink-0" style={{ color: tag.color }} aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate font-medium text-content">#{highlightTerms(tag.name, query)}</span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-content-subtle" aria-hidden="true" />
                </button>
              )
            })}
          </section>
        )}
      </div>
    </Modal>
  )
}
