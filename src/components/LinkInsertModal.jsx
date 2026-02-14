import React, { useState, useEffect, useRef } from 'react'
import { X, Link as LinkIcon, ExternalLink, Unlink } from 'lucide-react'
import { useUIStore } from '../store'

export default function LinkInsertModal({ editor }) {
  const { linkModalOpen, setLinkModalOpen } = useUIStore()
  const [url, setUrl] = useState('')
  const [text, setText] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const urlInputRef = useRef(null)

  useEffect(() => {
    if (linkModalOpen && editor) {
      const { from, to } = editor.state.selection
      const selectedText = editor.state.doc.textBetween(from, to, '')
      
      const linkAttrs = editor.getAttributes('link')
      if (linkAttrs.href) {
        setUrl(linkAttrs.href)
        setIsEditing(true)
      } else {
        setUrl('')
        setIsEditing(false)
      }
      
      setText(selectedText)
      
      setTimeout(() => urlInputRef.current?.focus(), 100)
    }
  }, [linkModalOpen, editor])

  const handleInsert = () => {
    if (!url.trim()) return

    let finalUrl = url.trim()
    if (!/^https?:\/\//.test(finalUrl)) {
      finalUrl = 'https://' + finalUrl
    }

    if (editor) {
      if (text && !editor.state.selection.empty) {
        editor.chain().focus().setLink({ href: finalUrl }).run()
      } else if (text) {
        editor.chain().focus().insertContent(`<a href="${finalUrl}">${text}</a>`).run()
      } else {
        editor.chain().focus().setLink({ href: finalUrl }).run()
      }
    }

    handleClose()
  }

  const handleRemoveLink = () => {
    if (editor) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
    }
    handleClose()
  }

  const handleClose = () => {
    setLinkModalOpen(false)
    setUrl('')
    setText('')
    setIsEditing(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleInsert()
    } else if (e.key === 'Escape') {
      handleClose()
    }
  }

  if (!linkModalOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm modal-backdrop-animate">
      <div className="modal-animate bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-[#cbd1db] dark:border-gray-700 w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between p-5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
          <div className="flex items-center gap-3">
            <LinkIcon className="w-6 h-6" />
            <div>
              <h2 className="text-lg font-bold">{isEditing ? 'Edit Link' : 'Insert Link'}</h2>
              <p className="text-sm text-white/70">Add a hyperlink to your note</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-full hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              URL
            </label>
            <div className="relative">
              <input
                ref={urlInputRef}
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="https://example.com"
                className="w-full px-3 py-2 pl-10 border border-[#cbd1db] dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <ExternalLink className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              https:// will be added automatically if not specified
            </p>
          </div>

          {text && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Link Text
              </label>
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Display text"
                className="w-full px-3 py-2 border border-[#cbd1db] dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          )}
          {url && (
            <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Preview:</p>
              <a
                href={url.startsWith('http') ? url : `https://${url}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-600 dark:text-primary-400 underline hover:text-primary-700 dark:hover:text-primary-300 break-all"
                onClick={(e) => e.preventDefault()}
              >
                {text || url}
              </a>
            </div>
          )}
        </div>
        <div className="flex justify-between gap-3 px-6 py-4 border-t border-[#cbd1db] dark:border-gray-700">
          <div>
            {isEditing && (
              <button
                onClick={handleRemoveLink}
                className="px-4 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex items-center gap-2"
              >
                <Unlink className="w-4 h-4" />
                Remove Link
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors border border-[#cbd1db] dark:border-gray-600"
            >
              Cancel
            </button>
            <button
              onClick={handleInsert}
              disabled={!url.trim()}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isEditing ? 'Update' : 'Insert'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
