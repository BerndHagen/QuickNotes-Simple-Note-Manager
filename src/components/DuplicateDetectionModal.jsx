import React, { useState, useEffect } from 'react'
import { X, AlertTriangle, Copy, FileText, Trash2, ExternalLink } from 'lucide-react'
import { useNotesStore, useUIStore } from '../store'
import toast from 'react-hot-toast'

export default function DuplicateDetectionModal() {
  const { duplicateModalOpen, setDuplicateModalOpen } = useUIStore()
  const { notes, deleteNote, setSelectedNote } = useNotesStore()
  const [duplicates, setDuplicates] = useState([])
  const [isAnalyzing, setIsAnalyzing] = useState(true)

  useEffect(() => {
    if (duplicateModalOpen) {
      analyzeDuplicates()
    }
  }, [duplicateModalOpen, notes])

  const analyzeDuplicates = () => {
    setIsAnalyzing(true)
    const activeNotes = notes.filter((n) => !n.deleted && !n.archived)
    
    const duplicateGroups = []
    const processed = new Set()

    for (let i = 0; i < activeNotes.length; i++) {
      if (processed.has(activeNotes[i].id)) continue

      const note = activeNotes[i]
      const similar = []

      for (let j = i + 1; j < activeNotes.length; j++) {
        if (processed.has(activeNotes[j].id)) continue

        const otherNote = activeNotes[j]
        const similarity = calculateSimilarity(note, otherNote)

        if (similarity >= 0.7) {
          similar.push({
            note: otherNote,
            similarity: similarity,
            reason: getSimilarityReason(note, otherNote),
          })
          processed.add(otherNote.id)
        }
      }

      if (similar.length > 0) {
        duplicateGroups.push({
          original: note,
          duplicates: similar,
        })
        processed.add(note.id)
      }
    }

    setDuplicates(duplicateGroups)
    setIsAnalyzing(false)
  }

  const calculateSimilarity = (note1, note2) => {
    const title1 = note1.title.toLowerCase().trim()
    const title2 = note2.title.toLowerCase().trim()
    
    if (title1 === title2) return 1

    const titleSimilarity = levenshteinSimilarity(title1, title2)

    const content1 = stripHtml(note1.content || '').toLowerCase().slice(0, 500)
    const content2 = stripHtml(note2.content || '').toLowerCase().slice(0, 500)
    
    let contentSimilarity = 0
    if (content1 && content2) {
      if (content1 === content2) {
        contentSimilarity = 1
      } else {
        const words1 = new Set(content1.split(/\s+/).filter(w => w.length > 3))
        const words2 = new Set(content2.split(/\s+/).filter(w => w.length > 3))
        const intersection = [...words1].filter(w => words2.has(w)).length
        const union = new Set([...words1, ...words2]).size
        contentSimilarity = union > 0 ? intersection / union : 0
      }
    }
    return (titleSimilarity * 0.4) + (contentSimilarity * 0.6)
  }

  const levenshteinSimilarity = (s1, s2) => {
    const longer = s1.length > s2.length ? s1 : s2
    const shorter = s1.length > s2.length ? s2 : s1
    
    if (longer.length === 0) return 1

    const distance = levenshteinDistance(longer, shorter)
    return (longer.length - distance) / longer.length
  }

  const levenshteinDistance = (s1, s2) => {
    const m = s1.length
    const n = s2.length
    const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0))

    for (let i = 0; i <= m; i++) dp[i][0] = i
    for (let j = 0; j <= n; j++) dp[0][j] = j

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (s1[i - 1] === s2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1]
        } else {
          dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
        }
      }
    }

    return dp[m][n]
  }

  const stripHtml = (html) => {
    const div = document.createElement('div')
    div.innerHTML = html
    return div.textContent || div.innerText || ''
  }

  const getSimilarityReason = (note1, note2) => {
    const reasons = []
    
    if (note1.title.toLowerCase().trim() === note2.title.toLowerCase().trim()) {
      reasons.push('Same title')
    } else if (levenshteinSimilarity(note1.title, note2.title) > 0.8) {
      reasons.push('Similar title')
    }

    const content1 = stripHtml(note1.content || '').slice(0, 200)
    const content2 = stripHtml(note2.content || '').slice(0, 200)
    
    if (content1 && content2 && content1 === content2) {
      reasons.push('Identical content')
    } else if (content1 && content2) {
      reasons.push('Similar content')
    }

    return reasons.join(', ') || 'Similar structure'
  }

  const handleDeleteDuplicate = (noteId) => {
    if (window.confirm('Move this note to trash?')) {
      deleteNote(noteId)
      toast.success('Note moved to trash')
      analyzeDuplicates()
    }
  }

  const handleOpenNote = (noteId) => {
    setSelectedNote(noteId)
    setDuplicateModalOpen(false)
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  const getContentPreview = (content) => {
    const text = stripHtml(content || '')
    return text.slice(0, 100) + (text.length > 100 ? '...' : '')
  }

  if (!duplicateModalOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm modal-backdrop-animate">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-[#cbd1db] dark:border-gray-700 w-full max-w-3xl mx-4 max-h-[85vh] overflow-hidden flex flex-col modal-animate">
        <div className="flex items-center justify-between p-5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white shrink-0">
          <div className="flex items-center gap-3">
            <Copy className="w-6 h-6" />
            <div>
              <h2 className="text-lg font-bold">Duplicate Detection</h2>
              <p className="text-sm text-white/70">Find and clean up similar notes</p>
            </div>
          </div>
          <button
            onClick={() => setDuplicateModalOpen(false)}
            className="p-2 rounded-full hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {isAnalyzing ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mb-4"></div>
              <p className="text-gray-500 dark:text-gray-400">Analyzing notes...</p>
            </div>
          ) : duplicates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                <FileText className="w-8 h-8 text-green-500" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No Duplicates Found
              </h3>
              <p className="text-gray-500 dark:text-gray-400 max-w-md">
                All your notes are unique. No similar notes were detected.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center gap-2 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-orange-500 shrink-0" />
                <p className="text-sm text-orange-700 dark:text-orange-300">
                  {duplicates.length} group{duplicates.length !== 1 ? 's' : ''} with possible duplicates found
                </p>
              </div>

              {duplicates.map((group, index) => (
                <div
                  key={group.original.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
                >
                  <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Gruppe {index + 1}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {group.duplicates.length + 1} similar notes
                      </span>
                    </div>
                  </div>
                  <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded">
                            Original
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {formatDate(group.original.createdAt)}
                          </span>
                        </div>
                        <h4 className="font-medium text-gray-900 dark:text-white truncate">
                          {group.original.title}
                        </h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                          {getContentPreview(group.original.content)}
                        </p>
                      </div>
                      <button
                        onClick={() => handleOpenNote(group.original.id)}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors shrink-0"
                        title="Open"
                      >
                        <ExternalLink className="w-4 h-4 text-gray-400" />
                      </button>
                    </div>
                  </div>
                  {group.duplicates.map((dup) => (
                    <div
                      key={dup.note.id}
                      className="p-4 border-b border-gray-100 dark:border-gray-700 last:border-b-0 bg-gray-50/50 dark:bg-gray-900/30"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 text-xs rounded">
                              {Math.round(dup.similarity * 100)}% similar
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {dup.reason}
                            </span>
                            <span className="text-xs text-gray-400 dark:text-gray-500">
                              {"\u2022"} {formatDate(dup.note.createdAt)}
                            </span>
                          </div>
                          <h4 className="font-medium text-gray-900 dark:text-white truncate">
                            {dup.note.title}
                          </h4>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                            {getContentPreview(dup.note.content)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleOpenNote(dup.note.id)}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            title="Open"
                          >
                            <ExternalLink className="w-4 h-4 text-gray-400" />
                          </button>
                          <button
                            onClick={() => handleDeleteDuplicate(dup.note.id)}
                            className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex justify-end px-6 py-4 border-t border-gray-200 dark:border-gray-700 shrink-0">
          <button
            onClick={() => setDuplicateModalOpen(false)}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
