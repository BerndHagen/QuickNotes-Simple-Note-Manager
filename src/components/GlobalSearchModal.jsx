import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronRight, FileText, Folder, Loader2, Search, Tag } from 'lucide-react'
import { useNotesStore, useUIStore } from '../store'
import { debounce, htmlToPlainText } from '../lib/utils'
import { formatShortcut, loadShortcuts } from '../lib/shortcuts'
import { useTranslation } from '../lib/useTranslation'
import { Input, Modal } from './ui'

const EMPTY_RESULTS = { notes: [], folders: [], tags: [] }

const getMatchType = (note, query) => {
  if (note.title.toLowerCase().includes(query)) return 'title'
  if (note.tags?.some((tag) => tag.toLowerCase().includes(query))) return 'tag'
  return 'content'
}

const getMatchPreview = (note, query) => {
  const content = htmlToPlainText(note.content || '')
  const index = content.toLowerCase().indexOf(query)
  if (index === -1) return content.length > 100 ? `${content.slice(0, 100)}…` : content

  const start = Math.max(0, index - 40)
  const end = Math.min(content.length, index + query.length + 40)
  return `${start > 0 ? '…' : ''}${content.slice(start, end)}${end < content.length ? '…' : ''}`
}

const highlightMatch = (text, query) => {
  if (!query) return text
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = String(text || '').split(new RegExp(`(${escapedQuery})`, 'gi'))
  return parts.map((part, index) =>
    index % 2 === 1 ? (
      <mark key={`${part}-${index}`} className="rounded bg-warning-soft px-0.5 text-inherit">
        {part}
      </mark>
    ) : (
      part
    )
  )
}

const readGlobalSearchShortcut = () => formatShortcut(loadShortcuts().globalSearch)

export default function GlobalSearchModal() {
  const { t } = useTranslation()
  const {
    globalSearchOpen,
    setGlobalSearchOpen,
    setMobileView,
  } = useUIStore()
  const {
    notes,
    folders,
    tags,
    setSelectedNote,
    setSelectedFolder,
    setSelectedTagFilter,
  } = useNotesStore()

  const [query, setQuery] = useState('')
  const [results, setResults] = useState(EMPTY_RESULTS)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [isSearching, setIsSearching] = useState(false)
  const [shortcutLabel, setShortcutLabel] = useState(readGlobalSearchShortcut)
  const inputRef = useRef(null)

  const performSearch = useMemo(
    () =>
      debounce((searchQuery) => {
        const normalizedQuery = searchQuery.trim().toLowerCase()
        if (!normalizedQuery) {
          setResults(EMPTY_RESULTS)
          setIsSearching(false)
          return
        }

        const matchedNotes = notes
          .filter((note) => !note.deleted && !note.archived)
          .filter((note) => {
            const titleMatch = note.title.toLowerCase().includes(normalizedQuery)
            const contentMatch = htmlToPlainText(note.content || '')
              .toLowerCase()
              .includes(normalizedQuery)
            const tagMatch = note.tags?.some((tag) =>
              tag.toLowerCase().includes(normalizedQuery)
            )
            return titleMatch || contentMatch || tagMatch
          })
          .slice(0, 10)
          .map((note) => ({
            ...note,
            matchType: getMatchType(note, normalizedQuery),
            preview: getMatchPreview(note, normalizedQuery),
          }))

        setResults({
          notes: matchedNotes,
          folders: folders
            .filter((folder) => folder.name.toLowerCase().includes(normalizedQuery))
            .slice(0, 5),
          tags: tags
            .filter((tag) => tag.name.toLowerCase().includes(normalizedQuery))
            .slice(0, 5),
        })
        setSelectedIndex(0)
        setIsSearching(false)
      }, 200),
    [folders, notes, tags]
  )

  const flattenedResults = useMemo(
    () => [
      ...results.notes.map((item) => ({ type: 'note', item })),
      ...results.folders.map((item) => ({ type: 'folder', item })),
      ...results.tags.map((item) => ({ type: 'tag', item })),
    ],
    [results]
  )

  const totalResults = flattenedResults.length
  const activeOptionId = totalResults > 0 ? `qn-search-option-${selectedIndex}` : undefined

  const closeSearch = useCallback(() => {
    performSearch.cancel()
    setGlobalSearchOpen(false)
  }, [performSearch, setGlobalSearchOpen])

  const selectResult = useCallback(
    (index) => {
      const result = flattenedResults[index]
      if (!result) return

      if (result.type === 'note') {
        setSelectedNote(result.item.id)
        setMobileView('editor')
      } else if (result.type === 'folder') {
        setSelectedFolder(result.item.id)
        setMobileView('notes')
      } else {
        setSelectedTagFilter(result.item.name)
        setMobileView('notes')
      }
      closeSearch()
    },
    [
      closeSearch,
      flattenedResults,
      setMobileView,
      setSelectedFolder,
      setSelectedNote,
      setSelectedTagFilter,
    ]
  )

  useEffect(() => () => performSearch.cancel(), [performSearch])

  useEffect(() => {
    if (!globalSearchOpen) {
      performSearch.cancel()
      return
    }
    setQuery('')
    setResults(EMPTY_RESULTS)
    setSelectedIndex(0)
    setIsSearching(false)
  }, [globalSearchOpen, performSearch])

  useEffect(() => {
    const updateShortcut = () => setShortcutLabel(readGlobalSearchShortcut())
    window.addEventListener('quicknotes:shortcuts-changed', updateShortcut)
    return () => window.removeEventListener('quicknotes:shortcuts-changed', updateShortcut)
  }, [])

  useEffect(() => {
    if (!activeOptionId) return
    document.getElementById(activeOptionId)?.scrollIntoView?.({ block: 'nearest' })
  }, [activeOptionId])

  const handleQueryChange = (event) => {
    const value = event.target.value
    setQuery(value)
    setSelectedIndex(0)

    if (!value.trim()) {
      performSearch.cancel()
      setResults(EMPTY_RESULTS)
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    performSearch(value)
  }

  const handleSearchKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (totalResults > 0) setSelectedIndex((index) => (index + 1) % totalResults)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (totalResults > 0) {
        setSelectedIndex((index) => (index - 1 + totalResults) % totalResults)
      }
    } else if (event.key === 'Enter' && totalResults > 0) {
      event.preventDefault()
      selectResult(selectedIndex)
    }
  }

  const resultFooter = (
    <div className="flex w-full flex-wrap items-center justify-between gap-2 text-ui-sm text-content-muted">
      <span role="status" aria-live="polite">
        {query && !isSearching
          ? `${totalResults} ${t(totalResults === 1 ? 'search.result' : 'search.results')}`
          : t('search.startTyping')}
      </span>
      <span className="inline-flex items-center gap-2">
        <kbd className="kbd">{shortcutLabel}</kbd>
        <span>{t('search.globalSearch')}</span>
      </span>
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
      contentClassName="sm:self-start sm:mt-[8dvh]"
      bodyClassName="p-0 sm:p-0"
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
          placeholder={t('search.searchPlaceholder')}
          className="h-auto border-0 bg-transparent px-0 py-1 text-lg shadow-none focus:border-transparent focus:ring-0"
        />
        {isSearching && (
          <span role="status" className="shrink-0">
            <Loader2 className="h-5 w-5 animate-spin text-content-muted" aria-hidden="true" />
            <span className="qn-sr-only">{t('common.loading')}</span>
          </span>
        )}
        <kbd className="kbd hidden sm:inline-flex">Esc</kbd>
      </div>

      <div
        id="qn-global-search-results"
        role={totalResults > 0 ? 'listbox' : undefined}
        aria-label={totalResults > 0 ? t('search.globalSearch') : undefined}
        className="max-h-[min(60dvh,560px)] overflow-y-auto overscroll-contain"
      >
        {query && totalResults === 0 && !isSearching && (
          <div className="p-8 text-center text-content-muted" role="status">
            <Search className="mx-auto mb-3 h-10 w-10 opacity-40" aria-hidden="true" />
            <p>
              {t('search.noResults')} “{query}”
            </p>
          </div>
        )}

        {results.notes.length > 0 && (
          <div
            role="group"
            aria-label={t('search.notes')}
            data-label={t('search.notes')}
            className="mx-2 mt-2 before:block before:px-3 before:py-1.5 before:text-ui-xs before:font-semibold before:uppercase before:tracking-wider before:text-content-muted before:content-[attr(data-label)]"
          >
            {results.notes.map((note, index) => {
              const resultIndex = index
              const selected = selectedIndex === resultIndex
              return (
                <button
                  id={`qn-search-option-${resultIndex}`}
                  key={note.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  tabIndex={-1}
                  onMouseEnter={() => setSelectedIndex(resultIndex)}
                  onClick={() => selectResult(resultIndex)}
                  className={`flex w-full items-start gap-3 rounded-control px-3 py-2 text-left transition-colors ${
                    selected ? 'bg-accent-soft' : 'hover:bg-surface-hover'
                  }`}
                >
                  <FileText className="mt-0.5 h-5 w-5 shrink-0 text-content-subtle" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-content">
                      {highlightMatch(note.title, query.trim())}
                    </span>
                    <span className="line-clamp-2 block text-ui-md text-content-muted">
                      {highlightMatch(note.preview, query.trim())}
                    </span>
                    {note.matchType === 'tag' && (
                      <span className="mt-1 flex items-center gap-1 text-ui-xs text-content-muted">
                        <Tag className="h-3 w-3" aria-hidden="true" />
                        {t('search.tags')}: {note.tags?.join(', ')}
                      </span>
                    )}
                  </span>
                  <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-content-subtle" aria-hidden="true" />
                </button>
              )
            })}
          </div>
        )}

        {results.folders.length > 0 && (
          <div
            role="group"
            aria-label={t('search.folders')}
            data-label={t('search.folders')}
            className="mx-2 mt-2 border-t border-subtle pt-2 before:block before:px-3 before:py-1.5 before:text-ui-xs before:font-semibold before:uppercase before:tracking-wider before:text-content-muted before:content-[attr(data-label)]"
          >
            {results.folders.map((folder, index) => {
              const resultIndex = results.notes.length + index
              const selected = selectedIndex === resultIndex
              return (
                <button
                  id={`qn-search-option-${resultIndex}`}
                  key={folder.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  tabIndex={-1}
                  onMouseEnter={() => setSelectedIndex(resultIndex)}
                  onClick={() => selectResult(resultIndex)}
                  className={`flex w-full items-center gap-3 rounded-control px-3 py-2 text-left transition-colors ${
                    selected ? 'bg-accent-soft' : 'hover:bg-surface-hover'
                  }`}
                >
                  <Folder
                    className="h-5 w-5 shrink-0"
                    style={{ color: folder.color }}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 truncate font-medium text-content">
                    {highlightMatch(folder.name, query.trim())}
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-content-subtle" aria-hidden="true" />
                </button>
              )
            })}
          </div>
        )}

        {results.tags.length > 0 && (
          <div
            role="group"
            aria-label={t('search.tags')}
            data-label={t('search.tags')}
            className="mx-2 mt-2 border-t border-subtle pt-2 before:block before:px-3 before:py-1.5 before:text-ui-xs before:font-semibold before:uppercase before:tracking-wider before:text-content-muted before:content-[attr(data-label)]"
          >
            {results.tags.map((tag, index) => {
              const resultIndex = results.notes.length + results.folders.length + index
              const selected = selectedIndex === resultIndex
              return (
                <button
                  id={`qn-search-option-${resultIndex}`}
                  key={tag.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  tabIndex={-1}
                  onMouseEnter={() => setSelectedIndex(resultIndex)}
                  onClick={() => selectResult(resultIndex)}
                  className={`flex w-full items-center gap-3 rounded-control px-3 py-2 text-left transition-colors ${
                    selected ? 'bg-accent-soft' : 'hover:bg-surface-hover'
                  }`}
                >
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: tag.color }}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 truncate font-medium text-content">
                    #{highlightMatch(tag.name, query.trim())}
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-content-subtle" aria-hidden="true" />
                </button>
              )
            })}
          </div>
        )}

        {!query && (
          <div className="p-6 text-center text-content-muted">
            <p className="text-ui-md">{t('search.startTyping')}</p>
            <div className="mt-4 flex flex-wrap justify-center gap-4 text-ui-xs">
              <span>
                <kbd className="kbd">↑↓</kbd> {t('search.navigate')}
              </span>
              <span>
                <kbd className="kbd">↵</kbd> {t('search.open')}
              </span>
              <span>
                <kbd className="kbd">Esc</kbd> {t('search.close')}
              </span>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
