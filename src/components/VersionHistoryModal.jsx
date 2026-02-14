import React, { useState, useEffect } from 'react'
import { X, History, Clock, RotateCcw, ChevronRight, FileText, AlertCircle } from 'lucide-react'
import { useNotesStore, useUIStore } from '../store'
import { getNoteVersions } from '../lib/db'
import { getRemoteNoteVersions, isBackendConfigured } from '../lib/backend'
import toast from 'react-hot-toast'

export default function VersionHistoryModal() {
  const { versionHistoryOpen, setVersionHistoryOpen, versionHistoryNoteId } = useUIStore()
  const { notes, updateNote } = useNotesStore()
  const [versions, setVersions] = useState([])
  const [selectedVersion, setSelectedVersion] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showPreview, setShowPreview] = useState(false)

  const note = notes.find((n) => n.id === versionHistoryNoteId)

  useEffect(() => {
    if (versionHistoryOpen && versionHistoryNoteId) {
      loadVersions()
    }
  }, [versionHistoryOpen, versionHistoryNoteId])

  const loadVersions = async () => {
    setIsLoading(true)
    try {
      const [localVersions, remoteVersions] = await Promise.all([
        getNoteVersions(versionHistoryNoteId),
        isBackendConfigured() ? getRemoteNoteVersions(versionHistoryNoteId) : Promise.resolve([]),
      ])
      
      const versionMap = new Map()
      
      for (const v of localVersions) {
        const key = v.createdAt || v.created_at
        versionMap.set(key, { ...v, createdAt: key, source: v.source || 'local' })
      }
      
      for (const v of remoteVersions) {
        const key = v.createdAt
        if (!versionMap.has(key)) {
          versionMap.set(key, v)
        }
      }
      
      const allVersions = Array.from(versionMap.values())
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      
      setVersions(allVersions)
    } catch (error) {
      toast.error('Could not load versions')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRestore = () => {
    if (!selectedVersion) return

    if (window.confirm('Do you want to restore this version? The current version will be overwritten.')) {
      updateNote(versionHistoryNoteId, {
        content: selectedVersion.content,
      })
      toast.success('Version restored')
      handleClose()
    }
  }

  const handleClose = () => {
    setVersionHistoryOpen(false)
    setSelectedVersion(null)
    setVersions([])
    setShowPreview(false)
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now - date

    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000)
      if (hours < 1) {
        const minutes = Math.floor(diff / 60000)
        return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`
      }
      return `${hours} hour${hours !== 1 ? 's' : ''} ago`
    }

    if (diff < 604800000) {
      const days = Math.floor(diff / 86400000)
      return `${days} day${days !== 1 ? 's' : ''} ago`
    }

    return date.toLocaleDateString('en-US', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getContentPreview = (content) => {
    const div = document.createElement('div')
    div.innerHTML = content
    const text = div.textContent || div.innerText || ''
    return text.slice(0, 150) + (text.length > 150 ? '...' : '')
  }

  const getWordCount = (content) => {
    const div = document.createElement('div')
    div.innerHTML = content
    const text = div.textContent || div.innerText || ''
    return text.trim().split(/\s+/).filter(Boolean).length
  }

  if (!versionHistoryOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm modal-backdrop-animate">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-[#cbd1db] dark:border-gray-700 w-full max-w-4xl mx-4 max-h-[85vh] overflow-hidden flex flex-col modal-animate">
        <div className="flex items-center justify-between p-5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white shrink-0">
          <div className="flex items-center gap-3">
            <History className="w-6 h-6" />
            <div>
              <h2 className="text-lg font-bold">Version History</h2>
              {note && (
                <p className="text-sm text-white/70">
                  {note.title}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-full hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 flex overflow-hidden">
          <div className="w-1/3 border-r border-gray-300 dark:border-gray-700 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
              </div>
            ) : versions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-6">
                <AlertCircle className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" />
                <p className="text-gray-500 dark:text-gray-400">
                  No versions found
                </p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                  Versions are automatically saved when editing.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                <div
                  className={`p-4 cursor-pointer transition-colors ${
                    !selectedVersion
                      ? 'bg-primary-50 dark:bg-primary-900/30'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700/50'
                  }`}
                  onClick={() => setSelectedVersion(null)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-primary-600 dark:text-primary-400">
                      Current Version
                    </span>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <Clock className="w-3 h-3" />
                    {formatDate(note?.updatedAt)}
                  </div>
                </div>
                {versions.map((version, index) => (
                  <div
                    key={version.id}
                    className={`p-4 cursor-pointer transition-colors ${
                      selectedVersion?.id === version.id
                        ? 'bg-primary-50 dark:bg-primary-900/30'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700/50'
                    }`}
                    onClick={() => setSelectedVersion(version)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Version {versions.length - index}
                      </span>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                      <Clock className="w-3 h-3" />
                      {formatDate(version.createdAt)}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500 mt-1">
                      <FileText className="w-3 h-3" />
                      {getWordCount(version.content)} words
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-gray-300 dark:border-gray-700 shrink-0">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-gray-900 dark:text-white">
                  {selectedVersion ? 'Preview' : 'Current Version'}
                </h3>
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
                >
                  {showPreview ? 'Show HTML' : 'Show Preview'}
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {showPreview ? (
                <div
                  className="prose dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{
                    __html: selectedVersion?.content || note?.content || '',
                  }}
                />
              ) : (
                <pre className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap font-mono bg-gray-50 dark:bg-gray-900 p-4 rounded-lg overflow-auto">
                  {selectedVersion?.content || note?.content || 'No content'}
                </pre>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-300 dark:border-gray-700 shrink-0">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {versions.length} version{versions.length !== 1 ? 's' : ''} saved
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors border border-gray-300 dark:border-gray-600"
            >
              Close
            </button>
            {selectedVersion && (
              <button
                onClick={handleRestore}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Restore this version
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
