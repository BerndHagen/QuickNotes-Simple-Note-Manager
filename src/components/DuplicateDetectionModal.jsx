import { useState, useEffect } from 'react'
import { X, AlertTriangle, Copy, FileText, Trash2, ExternalLink } from 'lucide-react'
import { useNotesStore, useUIStore } from '../store'
import toast from 'react-hot-toast'
import LegacyDialog from './ui/LegacyDialog'
import { ConfirmDialog } from './FolderDialogs'

const normalizeText = (value) => String(value ?? '').toLowerCase().replace(/\s+/g, ' ').trim()

export const stripNoteHtml = (html) => {
  const documentNode = new DOMParser().parseFromString(String(html ?? ''), 'text/html')
  documentNode.querySelectorAll('script, style, noscript').forEach((node) => node.remove())
  return documentNode.body.textContent || ''
}

const STRUCTURED_METADATA_KEYS = new Set([
  'id', 'createdAt', 'updatedAt', 'completedAt', 'color', 'avatar', 'icon',
])

const collectStructuredText = (value, key = '', output = []) => {
  if (output.join(' ').length >= 1_000 || value == null) return output
  if (STRUCTURED_METADATA_KEYS.has(key)) return output
  if (typeof value === 'string') {
    const text = value.trim()
    if (text) output.push(text)
    return output
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectStructuredText(item, key, output))
    return output
  }
  if (typeof value === 'object') {
    Object.entries(value).forEach(([childKey, child]) => {
      collectStructuredText(child, childKey, output)
    })
  }
  return output
}

const getComparableContent = (note) => {
  const richText = normalizeText(stripNoteHtml(note?.content))
  if (richText) return richText.slice(0, 1_000)
  return normalizeText(collectStructuredText(note?.noteData).join(' ')).slice(0, 1_000)
}

export const levenshteinDistance = (first, second) => {
  const s1 = String(first ?? '').slice(0, 200)
  const s2 = String(second ?? '').slice(0, 200)
  const previous = Array.from({ length: s2.length + 1 }, (_, index) => index)

  for (let row = 1; row <= s1.length; row += 1) {
    const current = [row]
    for (let column = 1; column <= s2.length; column += 1) {
      current[column] = s1[row - 1] === s2[column - 1]
        ? previous[column - 1]
        : 1 + Math.min(previous[column], current[column - 1], previous[column - 1])
    }
    previous.splice(0, previous.length, ...current)
  }

  return previous[s2.length]
}

export const levenshteinSimilarity = (first, second) => {
  const s1 = normalizeText(first).slice(0, 200)
  const s2 = normalizeText(second).slice(0, 200)
  const longestLength = Math.max(s1.length, s2.length)
  if (longestLength === 0) return 0
  return (longestLength - levenshteinDistance(s1, s2)) / longestLength
}

const contentSimilarity = (first, second) => {
  if (!first || !second) return 0
  if (first === second) return 1

  const firstWords = new Set(first.split(/\s+/).filter((word) => word.length > 2))
  const secondWords = new Set(second.split(/\s+/).filter((word) => word.length > 2))
  const union = new Set([...firstWords, ...secondWords])
  if (union.size === 0) return 0
  const intersectionSize = [...firstWords].filter((word) => secondWords.has(word)).length
  return intersectionSize / union.size
}

export const calculateNoteSimilarity = (firstNote, secondNote) => {
  const firstTitle = normalizeText(firstNote?.title)
  const secondTitle = normalizeText(secondNote?.title)
  const titleScore = firstTitle && secondTitle
    ? levenshteinSimilarity(firstTitle, secondTitle)
    : 0
  const firstContent = getComparableContent(firstNote)
  const secondContent = getComparableContent(secondNote)
  const contentScore = contentSimilarity(firstContent, secondContent)
  let score = (titleScore * 0.4) + (contentScore * 0.6)

  if (firstTitle && firstTitle === secondTitle && !firstContent && !secondContent) score = 0.8
  if (firstContent.length >= 12 && firstContent === secondContent) score = Math.max(score, 0.9)
  return Math.min(score, 1)
}

export const getSimilarityReason = (firstNote, secondNote) => {
  const reasons = []
  const firstTitle = normalizeText(firstNote?.title)
  const secondTitle = normalizeText(secondNote?.title)
  const firstContent = getComparableContent(firstNote)
  const secondContent = getComparableContent(secondNote)

  if (firstTitle && firstTitle === secondTitle) reasons.push('Same title')
  else if (levenshteinSimilarity(firstTitle, secondTitle) > 0.8) reasons.push('Similar title')

  const contentScore = contentSimilarity(firstContent, secondContent)
  if (firstContent && firstContent === secondContent) reasons.push('Identical content')
  else if (contentScore >= 0.7) reasons.push('Similar content')

  return reasons.join(', ') || 'Similar note'
}

export const findDuplicateGroups = (notes) => {
  const activeNotes = (Array.isArray(notes) ? notes : []).filter(
    (note) => note && !note.deleted && !note.archived
  )
  const duplicateGroups = []
  const processed = new Set()

  for (let index = 0; index < activeNotes.length; index += 1) {
    const note = activeNotes[index]
    if (!note.id || processed.has(note.id)) continue
    const similar = []

    for (let candidateIndex = index + 1; candidateIndex < activeNotes.length; candidateIndex += 1) {
      const candidate = activeNotes[candidateIndex]
      if (!candidate.id || processed.has(candidate.id)) continue
      const similarity = calculateNoteSimilarity(note, candidate)
      if (similarity < 0.7) continue

      similar.push({
        note: candidate,
        similarity,
        reason: getSimilarityReason(note, candidate),
      })
      processed.add(candidate.id)
    }

    if (similar.length > 0) {
      duplicateGroups.push({ original: note, duplicates: similar })
      processed.add(note.id)
    }
  }

  return duplicateGroups
}

export default function DuplicateDetectionModal() {
  const { duplicateModalOpen, setDuplicateModalOpen } = useUIStore()
  const { notes, deleteNote, setSelectedNote } = useNotesStore()
  const [duplicates, setDuplicates] = useState([])
  const [isAnalyzing, setIsAnalyzing] = useState(true)
  const [pendingDeleteId, setPendingDeleteId] = useState(null)

  useEffect(() => {
    if (!duplicateModalOpen) return undefined
    setIsAnalyzing(true)
    const timer = window.setTimeout(() => {
      setDuplicates(findDuplicateGroups(notes))
      setIsAnalyzing(false)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [duplicateModalOpen, notes])

  const handleDeleteDuplicate = (noteId) => {
    setPendingDeleteId(noteId)
  }

  const confirmDeleteDuplicate = async () => {
    if (!pendingDeleteId) return
    await deleteNote(pendingDeleteId)
    toast.success('Note moved to trash')
  }

  const handleClose = () => {
    setPendingDeleteId(null)
    setDuplicateModalOpen(false)
  }

  const handleOpenNote = (noteId) => {
    setSelectedNote(noteId)
    setDuplicateModalOpen(false)
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    if (Number.isNaN(date.getTime())) return 'Date unavailable'
    return date.toLocaleDateString('en-US', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  const getContentPreview = (content) => {
    const text = stripNoteHtml(content || '')
    return text.slice(0, 100) + (text.length > 100 ? '...' : '')
  }

  if (!duplicateModalOpen) return null

  return (
    <>
    <LegacyDialog
      open={!pendingDeleteId}
      label="Find duplicates"
      onClose={handleClose}
      align="center"
    >
      <div className="flex max-h-full min-h-0 w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-subtle bg-surface-raised shadow-2xl modal-animate sm:mx-4">
        <div className="qn-banner-surface flex shrink-0 items-center justify-between p-5 text-banner-text">
          <div className="flex items-center gap-3">
            <Copy className="w-6 h-6" />
            <div>
              <h2 className="text-lg font-bold">Duplicate Detection</h2>
              <p className="text-sm text-banner-muted">Review similar notes before moving anything to Trash</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close duplicate detection"
            className="qn-square-control rounded-full p-2 transition-colors hover:bg-banner-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-banner-text"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
          {isAnalyzing ? (
            <div className="flex flex-col items-center justify-center py-12" role="status">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mb-4" aria-hidden="true" />
              <p className="text-content-muted">Analyzing notes…</p>
            </div>
          ) : duplicates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                <FileText className="w-8 h-8 text-green-500" />
              </div>
              <h3 className="text-lg font-medium text-content mb-2">
                No Duplicates Found
              </h3>
              <p className="text-content-muted max-w-md">
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
                  className="border border-subtle rounded-lg overflow-hidden"
                >
                  <div className="px-4 py-3 bg-surface-sunken border-b border-subtle">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-content-muted">
                        Group {index + 1}
                      </span>
                      <span className="text-xs text-content-muted">
                        {group.duplicates.length + 1} similar notes
                      </span>
                    </div>
                  </div>
                  <div className="p-4 border-b border-subtle">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded">
                            Reference note
                          </span>
                          <span className="text-xs text-content-muted">
                            {formatDate(group.original.createdAt)}
                          </span>
                        </div>
                        <h4 className="font-medium text-content truncate">
                          {group.original.title}
                        </h4>
                        <p className="text-sm text-content-muted mt-1 line-clamp-2">
                          {getContentPreview(group.original.content)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleOpenNote(group.original.id)}
                        aria-label={`Open ${group.original.title || 'untitled note'}`}
                        className="p-2 hover:bg-surface-hover rounded-lg transition-colors shrink-0"
                      >
                        <ExternalLink className="w-4 h-4 text-content-subtle" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                  {group.duplicates.map((dup) => (
                    <div
                      key={dup.note.id}
                      className="p-4 border-b border-subtle last:border-b-0 bg-surface-sunken dark:bg-surface-sunken"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 text-xs rounded">
                              {Math.round(dup.similarity * 100)}% similar
                            </span>
                            <span className="text-xs text-content-muted">
                              {dup.reason}
                            </span>
                            <span className="text-xs text-content-subtle">
                              {"\u2022"} {formatDate(dup.note.createdAt)}
                            </span>
                          </div>
                          <h4 className="font-medium text-content truncate">
                            {dup.note.title}
                          </h4>
                          <p className="text-sm text-content-muted mt-1 line-clamp-2">
                            {getContentPreview(dup.note.content)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleOpenNote(dup.note.id)}
                            aria-label={`Open ${dup.note.title || 'untitled note'}`}
                            className="p-2 hover:bg-surface-hover rounded-lg transition-colors"
                          >
                            <ExternalLink className="w-4 h-4 text-content-subtle" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteDuplicate(dup.note.id)}
                            aria-label={`Move ${dup.note.title || 'untitled note'} to trash`}
                            className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4 text-red-500" aria-hidden="true" />
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
        <div className="flex justify-end px-6 py-4 border-t border-subtle shrink-0">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-content-muted hover:bg-surface-sunken dark:hover:bg-surface-sunken rounded-lg transition-colors border border-subtle "
          >
            Close
          </button>
        </div>
      </div>
    </LegacyDialog>
    <ConfirmDialog
      open={Boolean(pendingDeleteId)}
      onClose={() => setPendingDeleteId(null)}
      onConfirm={confirmDeleteDuplicate}
      title="Move duplicate to trash?"
      description="The note will remain recoverable from Trash until it is permanently deleted."
      confirmLabel="Move to trash"
      icon={Trash2}
    />
    </>
  )
}
