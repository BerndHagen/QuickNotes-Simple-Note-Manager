import React, { useState, useEffect, useRef } from 'react'
import { X, Code, Copy, Check, Eye, EyeOff, Download, Upload, AlertTriangle } from 'lucide-react'
import { useUIStore } from '../store'
import { useTranslation } from '../lib/useTranslation'

export default function HTMLEditorModal({ editor }) {
  const { htmlEditorOpen, setHTMLEditorOpen } = useUIStore()
  const { t } = useTranslation()
  
  const [htmlContent, setHtmlContent] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [copied, setCopied] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const textareaRef = useRef(null)

  useEffect(() => {
    if (htmlEditorOpen && editor) {
      const currentHtml = editor.getHTML()
      setHtmlContent(formatHtml(currentHtml))
      setHasUnsavedChanges(false)
    }
  }, [htmlEditorOpen, editor])

  const formatHtml = (html) => {
    if (!html) return ''
    
    let formatted = html
      .replace(/></g, '>\n<')
      .replace(/(<\/(?:div|p|h[1-6]|ul|ol|li|table|tr|td|th|blockquote|pre|hr|br)>)/gi, '$1\n')
      .replace(/(<(?:div|p|h[1-6]|ul|ol|li|table|tr|blockquote|pre)[^>]*>)/gi, '\n$1')
    
    formatted = formatted.replace(/\n\s*\n\s*\n/g, '\n\n')
    
    return formatted.trim()
  }

  const minifyHtml = (html) => {
    return html
      .replace(/\n/g, '')
      .replace(/\s+/g, ' ')
      .replace(/>\s+</g, '><')
      .trim()
  }

  const handleApply = () => {
    if (editor) {
      const cleanHtml = minifyHtml(htmlContent)
      editor.commands.setContent(cleanHtml)
      setHasUnsavedChanges(false)
      setHTMLEditorOpen(false)
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(htmlContent)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
    }
  }

  const handleExport = () => {
    const blob = new Blob([htmlContent], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'note-content.html'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.html,.htm,.txt'
    input.onchange = (e) => {
      const file = e.target.files[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = (event) => {
          setHtmlContent(event.target.result)
          setHasUnsavedChanges(true)
        }
        reader.readAsText(file)
      }
    }
    input.click()
  }

  const handleClose = () => {
    if (hasUnsavedChanges) {
      if (window.confirm('You have unsaved changes. Are you sure you want to close?')) {
        setHTMLEditorOpen(false)
      }
    } else {
      setHTMLEditorOpen(false)
    }
  }

  if (!htmlEditorOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm modal-backdrop-animate">
      <div className="modal-animate bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-[#cbd1db] dark:border-gray-700 w-full max-w-4xl mx-4 h-[85vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
          <div className="flex items-center gap-3">
            <Code className="w-6 h-6" />
            <h2 className="text-lg font-bold">HTML Editor</h2>
            {hasUnsavedChanges && (
              <span className="px-2 py-1 text-[11px] font-semibold text-white bg-white/20 rounded-lg">
                Unsaved changes
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className={`p-2 rounded-full transition-colors ${
                showPreview 
                  ? 'bg-white/20 text-white' 
                  : 'hover:bg-white/20 text-white/70'
              }`}
              title={showPreview ? 'Hide Preview' : 'Show Preview'}
            >
              {showPreview ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
            <button
              onClick={handleClose}
              className="p-2 rounded-full hover:bg-white/20 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3 px-6 py-3 text-sm border-b bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <p className="text-amber-700 dark:text-amber-300">
            <strong>Warning:</strong> Direct HTML editing can break formatting. Use with caution.
          </p>
        </div>
        <div className="flex flex-1 overflow-hidden">
          <div className={`flex flex-col flex-1 ${showPreview ? 'border-r border-gray-300 dark:border-gray-700' : ''}`}>
            <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100 bg-gray-50 dark:bg-gray-900 dark:border-gray-700">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">HTML Source</span>
              <div className="flex-1" />
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 px-2 py-1 text-xs transition-colors rounded hover:bg-gray-200 dark:hover:bg-gray-700"
              >
                {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <button
                onClick={handleImport}
                className="flex items-center gap-1 px-2 py-1 text-xs transition-colors rounded hover:bg-gray-200 dark:hover:bg-gray-700"
              >
                <Upload className="w-3 h-3" />
                Import
              </button>
              <button
                onClick={handleExport}
                className="flex items-center gap-1 px-2 py-1 text-xs transition-colors rounded hover:bg-gray-200 dark:hover:bg-gray-700"
              >
                <Download className="w-3 h-3" />
                Export
              </button>
            </div>
            <textarea
              ref={textareaRef}
              value={htmlContent}
              onChange={(e) => {
                setHtmlContent(e.target.value)
                setHasUnsavedChanges(true)
              }}
              className="flex-1 w-full p-4 font-mono text-sm text-gray-900 bg-white border-none outline-none resize-none dark:bg-gray-900 dark:text-gray-100"
              spellCheck={false}
              placeholder="Enter HTML code here..."
            />
          </div>
          {showPreview && (
            <div className="flex flex-col flex-1">
              <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100 bg-gray-50 dark:bg-gray-900 dark:border-gray-700">
                <Eye className="w-4 h-4 text-gray-400" />
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Preview</span>
              </div>
              <div 
                className="flex-1 p-4 overflow-auto prose prose-sm dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: htmlContent }}
              />
            </div>
          )}
        </div>
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {htmlContent.length} characters
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-gray-700 transition-colors rounded-lg dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={!hasUnsavedChanges}
              className="px-4 py-2 font-medium text-white transition-colors rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              Apply Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
