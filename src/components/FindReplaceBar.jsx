import { useCallback, useEffect, useRef, useState } from 'react'
import {
  CaseSensitive,
  ChevronDown,
  ChevronUp,
  Regex,
  Replace,
  Search,
  WholeWord,
  X,
} from 'lucide-react'
import { Button, IconButton, Input } from './ui'
import { useTranslation } from '../lib/useTranslation'
import { createEditorSearchPattern, findEditorMatches } from '../lib/editorSearch'

export default function FindReplaceBar({ editor, isOpen, onClose }) {
  const { t } = useTranslation()
  const [findText, setFindText] = useState('')
  const [replaceText, setReplaceText] = useState('')
  const [showReplace, setShowReplace] = useState(false)
  const [matchCount, setMatchCount] = useState(0)
  const [currentMatch, setCurrentMatch] = useState(0)
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [wholeWord, setWholeWord] = useState(false)
  const [useRegex, setUseRegex] = useState(false)
  const [searchError, setSearchError] = useState('')
  const findInputRef = useRef(null)

  const collectMatches = useCallback(() => {
    if (!editor || !findText) return { matches: [], error: '' }

    const compiled = createEditorSearchPattern(findText, {
      caseSensitive,
      wholeWord,
      useRegex,
    })
    if (compiled.error) return { matches: [], error: compiled.error }

    return findEditorMatches(editor.state.doc, compiled.pattern)
  }, [caseSensitive, editor, findText, useRegex, wholeWord])

  const refreshSearch = useCallback(() => {
    const { matches, error } = collectMatches()
    setSearchError(error)
    setMatchCount(matches.length)
    setCurrentMatch((current) => {
      if (matches.length === 0) return 0
      if (current < 1) return 1
      return Math.min(current, matches.length)
    })
    return matches
  }, [collectMatches])

  useEffect(() => {
    if (!isOpen) return
    findInputRef.current?.focus()
    findInputRef.current?.select()
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) {
      setMatchCount(0)
      setCurrentMatch(0)
      setSearchError('')
      return undefined
    }

    const timeoutId = window.setTimeout(refreshSearch, 150)
    return () => window.clearTimeout(timeoutId)
  }, [isOpen, refreshSearch])

  useEffect(() => {
    if (!editor || !isOpen) return undefined
    const handleEditorUpdate = () => refreshSearch()
    editor.on('update', handleEditorUpdate)
    return () => editor.off('update', handleEditorUpdate)
  }, [editor, isOpen, refreshSearch])

  const selectMatch = useCallback(
    (match) => {
      if (!editor || !match) return
      editor.chain().focus().setTextSelection({ from: match.from, to: match.to }).run()

      const selection = window.getSelection()
      if (!selection?.rangeCount) return
      const rect = selection.getRangeAt(0).getBoundingClientRect()
      const editorElement = editor.view.dom
      const editorRect = editorElement.getBoundingClientRect()
      if (rect.top < editorRect.top || rect.bottom > editorRect.bottom) {
        editorElement.scrollTop += rect.top - editorRect.top - editorRect.height / 2
      }
    },
    [editor]
  )

  const goToMatch = useCallback(
    (direction) => {
      const { matches, error } = collectMatches()
      setSearchError(error)
      setMatchCount(matches.length)
      if (error || matches.length === 0) {
        setCurrentMatch(0)
        return
      }

      const currentIndex = Math.max(0, currentMatch - 1)
      const nextIndex = (currentIndex + direction + matches.length) % matches.length
      setCurrentMatch(nextIndex + 1)
      selectMatch(matches[nextIndex])
    },
    [collectMatches, currentMatch, selectMatch]
  )

  const replaceCurrentMatch = useCallback(() => {
    if (!editor || !findText) return
    const { matches, error } = collectMatches()
    setSearchError(error)
    if (error || matches.length === 0) return

    const index = Math.min(Math.max(currentMatch, 1), matches.length) - 1
    const match = matches[index]
    editor.view.dispatch(editor.state.tr.insertText(replaceText, match.from, match.to))
    editor.commands.focus()
    refreshSearch()
  }, [collectMatches, currentMatch, editor, findText, refreshSearch, replaceText])

  const replaceAllMatches = useCallback(() => {
    if (!editor || !findText) return
    const { matches, error } = collectMatches()
    setSearchError(error)
    if (error || matches.length === 0) return

    let transaction = editor.state.tr
    for (let index = matches.length - 1; index >= 0; index -= 1) {
      const match = matches[index]
      transaction = transaction.insertText(replaceText, match.from, match.to)
    }

    editor.view.dispatch(transaction)
    editor.commands.focus()
    setCurrentMatch(0)
    refreshSearch()
  }, [collectMatches, editor, findText, refreshSearch, replaceText])

  const handleFindKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      goToMatch(event.shiftKey ? -1 : 1)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
    }
  }

  if (!isOpen) return null

  const resultText = searchError
    ? searchError
    : matchCount > 0
      ? `${currentMatch} of ${matchCount}`
      : t('findReplace.noResults')

  return (
    <section
      role="search"
      aria-label={t('findReplace.findInNote')}
      className="border-b border-subtle bg-surface-raised px-3 py-2 shadow-xs sm:px-4"
    >
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-[min(100%,15rem)] flex-1">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-subtle"
              aria-hidden="true"
            />
            <Input
              ref={findInputRef}
              value={findText}
              onChange={(event) => setFindText(event.target.value)}
              onKeyDown={handleFindKeyDown}
              placeholder={t('findReplace.findInNote')}
              aria-label={t('findReplace.findInNote')}
              aria-invalid={!!searchError}
              aria-describedby="qn-find-results"
              className="pl-9 pr-20"
            />
            {!searchError && (
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ui-xs text-content-muted">
                {matchCount > 0 ? `${currentMatch}/${matchCount}` : '0/0'}
              </span>
            )}
          </div>
          <p
            id="qn-find-results"
            role={searchError ? 'alert' : 'status'}
            className={`mt-1 text-ui-xs ${searchError ? 'text-danger-text' : 'sr-only'}`}
          >
            {resultText}
          </p>
        </div>

        <div className="flex items-center gap-1" aria-label="Search options">
          <IconButton
            icon={CaseSensitive}
            size="sm"
            label={`${t('findReplace.caseSensitive')} (Alt+C)`}
            active={caseSensitive}
            aria-pressed={caseSensitive}
            onClick={() => setCaseSensitive((enabled) => !enabled)}
          />
          <IconButton
            icon={WholeWord}
            size="sm"
            label={`${t('findReplace.wholeWord')} (Alt+W)`}
            active={wholeWord}
            aria-pressed={wholeWord}
            onClick={() => setWholeWord((enabled) => !enabled)}
          />
          <IconButton
            icon={Regex}
            size="sm"
            label={`${t('findReplace.useRegex')} (Alt+R)`}
            active={useRegex}
            aria-pressed={useRegex}
            onClick={() => setUseRegex((enabled) => !enabled)}
          />
        </div>

        <div className="flex items-center gap-1">
          <IconButton
            icon={ChevronUp}
            size="sm"
            label={`${t('findReplace.previousMatch')} (Shift+Enter)`}
            disabled={matchCount === 0 || !!searchError}
            onClick={() => goToMatch(-1)}
          />
          <IconButton
            icon={ChevronDown}
            size="sm"
            label={`${t('findReplace.nextMatch')} (Enter)`}
            disabled={matchCount === 0 || !!searchError}
            onClick={() => goToMatch(1)}
          />
          <IconButton
            icon={Replace}
            size="sm"
            label={t('findReplace.toggleReplace')}
            active={showReplace}
            aria-pressed={showReplace}
            onClick={() => setShowReplace((visible) => !visible)}
          />
          <IconButton icon={X} size="sm" label="Close find and replace (Esc)" onClick={onClose} />
        </div>
      </div>

      {showReplace && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <div className="min-w-[min(100%,15rem)] flex-1">
            <Input
              value={replaceText}
              onChange={(event) => setReplaceText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  replaceCurrentMatch()
                } else if (event.key === 'Escape') {
                  event.preventDefault()
                  onClose()
                }
              }}
              placeholder={t('findReplace.replaceWith')}
              aria-label={t('findReplace.replaceWith')}
            />
          </div>
          <Button
            size="sm"
            onClick={replaceCurrentMatch}
            disabled={matchCount === 0 || !!searchError}
          >
            {t('findReplace.replace')}
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={replaceAllMatches}
            disabled={matchCount === 0 || !!searchError}
          >
            {t('findReplace.replaceAll')}
          </Button>
        </div>
      )}
    </section>
  )
}
