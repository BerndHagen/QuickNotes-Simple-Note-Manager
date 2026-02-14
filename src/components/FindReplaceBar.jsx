import React, { useState, useEffect, useCallback, useRef } from 'react'
import { X, Search, Replace, ChevronDown, ChevronUp, CaseSensitive, WholeWord, Regex } from 'lucide-react'
import { useTranslation } from '../lib/useTranslation'

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
  const findInputRef = useRef(null)
  useEffect(() => {
    if (isOpen && findInputRef.current) {
      findInputRef.current.focus()
      findInputRef.current.select()
    }
  }, [isOpen])
  useEffect(() => {
    if (!isOpen && editor) {
      clearHighlights()
    }
  }, [isOpen])
  useEffect(() => {
    if (editor && findText && isOpen) {
      const timeoutId = setTimeout(() => {
        performSearch()
      }, 150)
      return () => clearTimeout(timeoutId)
    } else {
      setMatchCount(0)
      setCurrentMatch(0)
      clearHighlights()
    }
  }, [findText, caseSensitive, wholeWord, useRegex, editor, isOpen])

  const clearHighlights = useCallback(() => {
    if (!editor) return
    const { from, to } = { from: 0, to: editor.state.doc.content.size }
    editor.chain().focus().setTextSelection({ from, to }).unsetMark('highlight').run()
    editor.commands.setTextSelection(0)
  }, [editor])

  const performSearch = useCallback(() => {
    if (!editor || !findText) return []

    const doc = editor.state.doc
    let matches = []
    doc.descendants((node, pos) => {
      if (node.isText) {
        const nodeText = node.text || ''
        let pattern
        
        try {
          if (useRegex) {
            pattern = new RegExp(findText, caseSensitive ? 'g' : 'gi')
          } else {
            let escapedText = findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            if (wholeWord) {
              escapedText = `\\b${escapedText}\\b`
            }
            pattern = new RegExp(escapedText, caseSensitive ? 'g' : 'gi')
          }
          
          let match
          while ((match = pattern.exec(nodeText)) !== null) {
            matches.push({
              from: pos + match.index,
              to: pos + match.index + match[0].length,
              text: match[0]
            })
          }
        } catch (e) {
        }
      }
    })
    
    setMatchCount(matches.length)
    if (matches.length > 0 && currentMatch === 0) {
      setCurrentMatch(1)
    } else if (matches.length === 0) {
      setCurrentMatch(0)
    }
    
    return matches
  }, [editor, findText, caseSensitive, wholeWord, useRegex, currentMatch])

  const findTextPositionInEditor = useCallback((searchText, occurrence = 1) => {
    if (!editor || !searchText) return null

    const doc = editor.state.doc
    let count = 0
    let foundPos = null
    doc.descendants((node, pos) => {
      if (foundPos) return false
      
      if (node.isText) {
        const nodeText = node.text || ''
        let pattern
        
        try {
          if (useRegex) {
            pattern = new RegExp(searchText, caseSensitive ? 'g' : 'gi')
          } else {
            let escapedText = searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            if (wholeWord) {
              escapedText = `\\b${escapedText}\\b`
            }
            pattern = new RegExp(escapedText, caseSensitive ? 'g' : 'gi')
          }
          
          let match
          while ((match = pattern.exec(nodeText)) !== null) {
            count++
            if (count === occurrence) {
              foundPos = {
                from: pos + match.index,
                to: pos + match.index + match[0].length,
                text: match[0]
              }
              return false
            }
          }
        } catch (e) {
        }
      }
    })
    
    return foundPos
  }, [editor, caseSensitive, wholeWord, useRegex])

  const goToNextMatch = useCallback(() => {
    if (matchCount === 0) return
    
    const next = currentMatch >= matchCount ? 1 : currentMatch + 1
    setCurrentMatch(next)
    
    const pos = findTextPositionInEditor(findText, next)
    if (pos && editor) {
      editor.chain().focus().setTextSelection({ from: pos.from, to: pos.to }).run()
      const editorElement = editor.view.dom
      const selection = window.getSelection()
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0)
        const rect = range.getBoundingClientRect()
        const editorRect = editorElement.getBoundingClientRect()
        
        if (rect.top < editorRect.top || rect.bottom > editorRect.bottom) {
          editorElement.scrollTop += rect.top - editorRect.top - editorRect.height / 2
        }
      }
    }
  }, [matchCount, currentMatch, findText, findTextPositionInEditor, editor])

  const goToPrevMatch = useCallback(() => {
    if (matchCount === 0) return
    
    const prev = currentMatch <= 1 ? matchCount : currentMatch - 1
    setCurrentMatch(prev)
    
    const pos = findTextPositionInEditor(findText, prev)
    if (pos && editor) {
      editor.chain().focus().setTextSelection({ from: pos.from, to: pos.to }).run()
    }
  }, [matchCount, currentMatch, findText, findTextPositionInEditor, editor])

  const replaceCurrentMatch = useCallback(() => {
    if (!editor || matchCount === 0 || !findText) return
    
    const pos = findTextPositionInEditor(findText, currentMatch)
    if (pos) {
      editor.chain()
        .focus()
        .setTextSelection({ from: pos.from, to: pos.to })
        .deleteSelection()
        .insertContent(replaceText)
        .run()
      setTimeout(() => {
        performSearch()
      }, 50)
    }
  }, [editor, matchCount, currentMatch, findText, replaceText, findTextPositionInEditor, performSearch])

  const replaceAllMatches = useCallback(() => {
    if (!editor || !findText) return
    
    const text = editor.getText()
    let pattern
    
    try {
      if (useRegex) {
        pattern = new RegExp(findText, caseSensitive ? 'g' : 'gi')
      } else {
        let escapedText = findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        if (wholeWord) {
          escapedText = `\\b${escapedText}\\b`
        }
        pattern = new RegExp(escapedText, caseSensitive ? 'g' : 'gi')
      }
      let html = editor.getHTML()
      const matches = text.match(pattern) || []
      matches.forEach(match => {
        html = html.replace(new RegExp(match.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), caseSensitive ? '' : 'i'), replaceText)
      })
      
      editor.commands.setContent(html)
      
      setMatchCount(0)
      setCurrentMatch(0)
    } catch (e) {
    }
  }, [editor, findText, replaceText, caseSensitive, wholeWord, useRegex])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (e.shiftKey) {
        goToPrevMatch()
      } else {
        goToNextMatch()
      }
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="bg-white dark:bg-gray-800 border-b border-[#cbd1db] dark:border-gray-700 px-4 py-2 shadow-sm">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            ref={findInputRef}
            type="text"
            value={findText}
            onChange={(e) => setFindText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('findReplace.findInNote')}
            className="w-full pl-10 pr-20 py-2 bg-gray-100 dark:bg-gray-900 border border-[#cbd1db] dark:border-gray-600 focus:border-emerald-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-sm"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">
            {matchCount > 0 ? `${currentMatch}/${matchCount}` : t('findReplace.noResults')}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCaseSensitive(!caseSensitive)}
            className={`p-2 rounded-lg transition-colors ${
              caseSensitive 
                ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600' 
                : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500'
            }`}
            title={`${t('findReplace.caseSensitive')} (Alt+C)`}
          >
            <CaseSensitive className="w-4 h-4" />
          </button>
          <button
            onClick={() => setWholeWord(!wholeWord)}
            className={`p-2 rounded-lg transition-colors ${
              wholeWord 
                ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600' 
                : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500'
            }`}
            title={`${t('findReplace.wholeWord')} (Alt+W)`}
          >
            <WholeWord className="w-4 h-4" />
          </button>
          <button
            onClick={() => setUseRegex(!useRegex)}
            className={`p-2 rounded-lg transition-colors ${
              useRegex 
                ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600' 
                : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500'
            }`}
            title={`${t('findReplace.useRegex')} (Alt+R)`}
          >
            <Regex className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={goToPrevMatch}
            disabled={matchCount === 0}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
            title={`${t('findReplace.previousMatch')} (Shift+Enter)`}
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <button
            onClick={goToNextMatch}
            disabled={matchCount === 0}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
            title={`${t('findReplace.nextMatch')} (Enter)`}
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
        <button
          onClick={() => setShowReplace(!showReplace)}
          className={`p-2 rounded-lg transition-colors ${
            showReplace 
              ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600' 
              : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500'
          }`}
          title={t('findReplace.toggleReplace')}
        >
          <Replace className="w-4 h-4" />
        </button>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          title="Close (Esc)"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      {showReplace && (
        <div className="flex items-center gap-2 mt-2">
          <div className="relative flex-1 min-w-[200px]">
            <Replace className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={replaceText}
              onChange={(e) => setReplaceText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  replaceCurrentMatch()
                } else if (e.key === 'Escape') {
                  onClose()
                }
              }}
              placeholder={t('findReplace.replaceWith')}
              className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-900 border border-[#cbd1db] dark:border-gray-600 focus:border-emerald-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-sm"
            />
          </div>
          <button
            onClick={replaceCurrentMatch}
            disabled={matchCount === 0}
            className="px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 border border-[#cbd1db] dark:border-gray-600"
          >
            {t('findReplace.replace')}
          </button>
          <button
            onClick={replaceAllMatches}
            disabled={matchCount === 0}
            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {t('findReplace.replaceAll')}
          </button>
        </div>
      )}
    </div>
  )
}
