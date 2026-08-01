import { cloneElement, useState, useRef, useEffect, useId, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Eye, FileText, Calendar, Tag, Folder } from 'lucide-react'
import { useNotesStore } from '../store'

export default function NotePreviewPopover({ noteId, children, position = 'right' }) {
  const [isVisible, setIsVisible] = useState(false)
  const [coords, setCoords] = useState({ x: 0, y: 0 })
  const triggerRef = useRef(null)
  const popoverRef = useRef(null)
  const timeoutRef = useRef(null)
  const previewId = useId()

  const { notes, folders } = useNotesStore()
  const note = notes.find((n) => n.id === noteId)

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return

    const rect = triggerRef.current.getBoundingClientRect()
    const padding = 10
    const gap = 10
    const popoverWidth = Math.min(320, Math.max(window.innerWidth - padding * 2, 0))
    const popoverHeight = Math.min(280, Math.max(window.innerHeight - padding * 2, 0))
    const leftX = rect.left - popoverWidth - gap
    const rightX = rect.right + gap
    const preferredX = position === 'left' ? leftX : rightX
    const fallbackX = position === 'left' ? rightX : leftX
    const fits = (x) => x >= padding && x + popoverWidth <= window.innerWidth - padding
    const x = Math.min(
      Math.max(fits(preferredX) ? preferredX : fits(fallbackX) ? fallbackX : preferredX, padding),
      Math.max(padding, window.innerWidth - popoverWidth - padding)
    )
    const y = Math.min(
      Math.max(rect.top, padding),
      Math.max(padding, window.innerHeight - popoverHeight - padding)
    )

    setCoords({ x, y })
  }, [position])

  const showPreview = (delay = 500) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    timeoutRef.current = setTimeout(() => {
      updatePosition()
      setIsVisible(true)
    }, delay)
  }

  const hidePreview = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    
    timeoutRef.current = setTimeout(() => {
      setIsVisible(false)
    }, 100)
  }

  useEffect(() => {
    if (!isVisible) return
    const handleViewportChange = () => updatePosition()
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setIsVisible(false)
    }
    window.addEventListener('resize', handleViewportChange)
    window.addEventListener('scroll', handleViewportChange, true)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('resize', handleViewportChange)
      window.removeEventListener('scroll', handleViewportChange, true)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isVisible, updatePosition])

  const getContentPreview = (content) => {
    if (!content) return 'No content'
    const parsed = new DOMParser().parseFromString(String(content), 'text/html')
    const text = parsed.body.textContent || ''
    return text.slice(0, 300) + (text.length > 300 ? '...' : '')
  }

  const getFolder = () => {
    if (!note?.folderId) return null
    return folders.find((f) => f.id === note.folderId)
  }

  const formatDate = (dateString) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    if (Number.isNaN(date.getTime())) return 'Date unavailable'
    return date.toLocaleDateString(undefined, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (!note) return children

  const folder = getFolder()
  const childRef = children.ref
  const setTriggerRef = (node) => {
    triggerRef.current = node
    if (typeof childRef === 'function') childRef(node)
    else if (childRef) childRef.current = node
  }

  return (
    <>
      {cloneElement(children, {
        ref: setTriggerRef,
        'aria-describedby': isVisible
          ? [children.props['aria-describedby'], previewId].filter(Boolean).join(' ')
          : children.props['aria-describedby'],
        onMouseEnter: (event) => {
          children.props.onMouseEnter?.(event)
          showPreview()
        },
        onMouseLeave: (event) => {
          children.props.onMouseLeave?.(event)
          hidePreview()
        },
        onFocus: (event) => {
          children.props.onFocus?.(event)
          showPreview(0)
        },
        onBlur: (event) => {
          children.props.onBlur?.(event)
          hidePreview()
        },
      })}

      {isVisible && createPortal(
        <div
          ref={popoverRef}
          id={previewId}
          role="tooltip"
          className="fixed z-50 w-[min(20rem,calc(100vw-1.25rem))] bg-surface-raised border border-subtle rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
          style={{ left: coords.x, top: coords.y }}
          onMouseEnter={() => {
            if (timeoutRef.current) {
              clearTimeout(timeoutRef.current)
            }
          }}
          onMouseLeave={hidePreview}
        >
          <div className="px-4 py-3 bg-surface-sunken border-b border-subtle">
            <div className="flex items-start gap-2">
              <Eye className="w-4 h-4 text-content-subtle mt-0.5 shrink-0" />
              <div className="min-w-0">
                <h4 className="font-medium text-content truncate">
                  {note.title}
                </h4>
                <div className="flex items-center gap-3 mt-1 text-xs text-content-muted">
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
            <p className="text-sm text-content-muted leading-relaxed line-clamp-6">
              {getContentPreview(note.content)}
            </p>
          </div>
          {note.tags && note.tags.length > 0 && (
            <div className="px-4 pb-3 flex items-center gap-2 flex-wrap">
              <Tag className="w-3 h-3 text-content-subtle" />
              {note.tags.slice(0, 5).map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 bg-surface-sunken text-content-muted rounded text-xs"
                >
                  {tag}
                </span>
              ))}
              {note.tags.length > 5 && (
                <span className="text-xs text-content-subtle">
                  +{note.tags.length - 5}
                </span>
              )}
            </div>
          )}
          <div className="px-4 py-2 bg-surface-sunken border-t border-subtle flex items-center justify-between text-xs text-content-muted">
            <span className="flex items-center gap-1">
              <FileText className="w-3 h-3" />
              {(note.content || '').replace(/<[^>]*>/g, '').trim().split(/\s+/).filter(Boolean).length} words
            </span>
            {note.starred && <span className="text-yellow-500">{"\u2B50"} Favorite</span>}
            {note.pinned && <span className="text-blue-500">{"\u{1F4CC}"} Pinned</span>}
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
