import React, { useState, useRef, useEffect } from 'react'
import { Eye, FileText, Calendar, Tag, Folder } from 'lucide-react'
import { useNotesStore } from '../store'

export default function NotePreviewPopover({ noteId, children, position = 'right' }) {
  const [isVisible, setIsVisible] = useState(false)
  const [coords, setCoords] = useState({ x: 0, y: 0 })
  const triggerRef = useRef(null)
  const popoverRef = useRef(null)
  const timeoutRef = useRef(null)

  const { notes, folders } = useNotesStore()
  const note = notes.find((n) => n.id === noteId)

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    
    timeoutRef.current = setTimeout(() => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect()
        const popoverWidth = 320
        const popoverHeight = 280

        let x = rect.left - popoverWidth - 10
        let y = rect.top

        if (x < 10) {
          return
        }

        if (y + popoverHeight > window.innerHeight - 10) {
          y = window.innerHeight - popoverHeight - 10
        }
        if (y < 10) {
          y = 10
        }

        setCoords({ x, y })
        setIsVisible(true)
      }
    }, 500)
  }

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    
    timeoutRef.current = setTimeout(() => {
      setIsVisible(false)
    }, 100)
  }

  const getContentPreview = (content) => {
    if (!content) return 'No content'
    const div = document.createElement('div')
    div.innerHTML = content
    const text = div.textContent || div.innerText || ''
    return text.slice(0, 300) + (text.length > 300 ? '...' : '')
  }

  const getFolder = () => {
    if (!note?.folderId) return null
    return folders.find((f) => f.id === note.folderId)
  }

  const formatDate = (dateString) => {
    if (!dateString) return ''
    return new Date(dateString).toLocaleDateString('en-US', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (!note) return children

  const folder = getFolder()

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {children}
      </div>

      {isVisible && (
        <div
          ref={popoverRef}
          className="fixed z-50 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
          style={{ left: coords.x, top: coords.y }}
          onMouseEnter={() => {
            if (timeoutRef.current) {
              clearTimeout(timeoutRef.current)
            }
          }}
          onMouseLeave={handleMouseLeave}
        >
          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-start gap-2">
              <Eye className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <h4 className="font-medium text-gray-900 dark:text-white truncate">
                  {note.title}
                </h4>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {folder && (
                    <span className="flex items-center gap-1">
                      <Folder className="w-3 h-3" />
                      {folder.name}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {formatDate(note.updatedAt)}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="p-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed line-clamp-6">
              {getContentPreview(note.content)}
            </p>
          </div>
          {note.tags && note.tags.length > 0 && (
            <div className="px-4 pb-3 flex items-center gap-2 flex-wrap">
              <Tag className="w-3 h-3 text-gray-400" />
              {note.tags.slice(0, 5).map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded text-xs"
                >
                  {tag}
                </span>
              ))}
              {note.tags.length > 5 && (
                <span className="text-xs text-gray-400">
                  +{note.tags.length - 5}
                </span>
              )}
            </div>
          )}
          <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1">
              <FileText className="w-3 h-3" />
              {(note.content || '').replace(/<[^>]*>/g, '').trim().split(/\s+/).filter(Boolean).length} words
            </span>
            {note.starred && <span className="text-yellow-500">{"\u2B50"} Favorite</span>}
            {note.pinned && <span className="text-blue-500">{"\u{1F4CC}"} Pinned</span>}
          </div>
        </div>
      )}
    </>
  )
}
