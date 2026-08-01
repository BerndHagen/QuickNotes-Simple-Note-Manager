import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, ChevronRight, Clock, FileText, History, RotateCcw } from 'lucide-react'
import toast from 'react-hot-toast'
import { useNotesStore, useUIStore } from '../store'
import { getNoteVersions } from '../lib/db'
import { getRemoteNoteVersions, isBackendConfigured } from '../lib/backend'
import { htmlToPlainText, getNoteTypePreview, truncateText } from '../lib/utils'
import { sanitizeNoteHtml } from '../lib/sanitizeHtml'
import { useTranslation } from '../lib/useTranslation'
import { NOTE_TYPE_CONFIG } from './editors/noteTypes'
import { ConfirmDialog } from './FolderDialogs'
import { Button, EmptyState, Modal, Spinner } from './ui'

const asArray = (value) => (Array.isArray(value) ? value : [])

const getItemText = (item) => {
  if (typeof item === 'string') return item
  if (!item || typeof item !== 'object') return ''
  return item.text || item.title || item.name || item.topic || item.task || ''
}

export const parseVersionNoteData = (value) => {
  if (value == null) return { data: null, error: null }
  if (typeof value === 'object') return { data: value, error: null }

  try {
    const parsed = JSON.parse(value)
    if (parsed === null) return { data: null, error: null }
    if (parsed && typeof parsed === 'object') return { data: parsed, error: null }
    return { data: null, error: 'Structured data is not an object.' }
  } catch {
    return { data: null, error: 'Structured data could not be read.' }
  }
}

const getStructuredHighlights = (noteType, data) => {
  switch (noteType) {
    case 'todo':
      return asArray(data.tasks).slice(0, 5).map(getItemText).filter(Boolean)
    case 'shopping':
      return asArray(data.items).slice(0, 5).map(getItemText).filter(Boolean)
    case 'project':
      return asArray(data.columns)
        .slice(0, 5)
        .map((column) => `${column?.name || 'Column'}: ${asArray(column?.tasks).length} tasks`)
    case 'meeting':
      return asArray(data.agenda).slice(0, 5).map(getItemText).filter(Boolean)
    case 'journal':
      return [data.freeWrite, data.challenges, data.lessons]
        .filter((value) => typeof value === 'string' && value.trim())
        .slice(0, 3)
    case 'brainstorm':
      return asArray(data.ideas).slice(0, 5).map(getItemText).filter(Boolean)
    case 'weekly':
      return asArray(data.weeklyGoals || data.goals).slice(0, 5).map(getItemText).filter(Boolean)
    default:
      return []
  }
}

export const getStructuredVersionPreview = (noteType, rawData) => {
  const { data, error } = parseVersionNoteData(rawData)
  if (error) return { data: null, error, summary: '', highlights: [] }
  if (!data) {
    return {
      data: null,
      error: null,
      summary: 'Empty structured note snapshot',
      highlights: [],
    }
  }

  let summary = ''
  try {
    summary = getNoteTypePreview({ noteType, noteData: data }, 220) || ''
  } catch {
    summary = ''
  }

  return {
    data,
    error: null,
    summary: summary || 'Structured note snapshot',
    highlights: getStructuredHighlights(noteType, data).map((item) => truncateText(item, 180)),
  }
}

const getWordCount = (content) => htmlToPlainText(content || '').trim().split(/\s+/).filter(Boolean).length

function StructuredPreview({ noteType, noteData }) {
  const preview = getStructuredVersionPreview(noteType, noteData)
  const config = NOTE_TYPE_CONFIG[noteType]
  const PreviewIcon = config?.icon || FileText
  const typeName = config?.name || 'Focused note'

  if (preview.error) {
    return (
      <div role="alert" className="rounded-card border border-danger-border bg-danger-soft p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-danger-text" aria-hidden="true" />
          <div>
            <p className="text-ui-md font-medium text-content">Preview unavailable</p>
            <p className="mt-1 text-ui-sm text-content-muted">
              This structured snapshot is damaged and cannot be restored safely.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-card border border-subtle bg-surface-sunken p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-accent-soft text-accent-text">
          <PreviewIcon className="h-[18px] w-[18px]" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-ui-sm font-medium text-content-muted">{typeName} snapshot</p>
          <p className="mt-1 text-ui-lg font-medium text-content">{preview.summary}</p>
        </div>
      </div>

      {preview.highlights.length > 0 && (
        <ul className="mt-4 space-y-2 border-t border-subtle pt-4">
          {preview.highlights.map((highlight, index) => (
            <li key={`${highlight}-${index}`} className="flex gap-2 text-ui-md text-content-muted">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
              <span className="min-w-0 break-words">{highlight}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function VersionHistoryModal() {
  const { t, language } = useTranslation()
  const { versionHistoryOpen, setVersionHistoryOpen, versionHistoryNoteId } = useUIStore()
  const { notes, sharedNotes, updateNote } = useNotesStore()
  const [versions, setVersions] = useState([])
  const [selectedVersion, setSelectedVersion] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [showPreview, setShowPreview] = useState(true)
  const [confirmRestore, setConfirmRestore] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  const note =
    notes.find((candidate) => candidate.id === versionHistoryNoteId) ||
    (sharedNotes || []).find((share) => share.notes?.id === versionHistoryNoteId)?.notes
  const canRestore = !note?.isShared || note.sharePermission === 'edit'

  useEffect(() => {
    if (!versionHistoryOpen || !versionHistoryNoteId) return undefined

    let cancelled = false
    setIsLoading(true)
    setLoadError('')
    setSelectedVersion(null)
    setShowPreview(true)

    const loadVersions = async () => {
      try {
        const [localVersions, remoteVersions] = await Promise.all([
          getNoteVersions(versionHistoryNoteId),
          isBackendConfigured()
            ? getRemoteNoteVersions(versionHistoryNoteId)
            : Promise.resolve([]),
        ])

        const versionMap = new Map()
        asArray(localVersions).forEach((version, index) => {
          const createdAt = version.createdAt || version.created_at
          const key = createdAt || version.id || `local-${index}`
          versionMap.set(key, {
            ...version,
            createdAt,
            source: version.source || 'local',
          })
        })
        asArray(remoteVersions).forEach((version, index) => {
          const key = version.createdAt || version.id || `remote-${index}`
          if (!versionMap.has(key)) versionMap.set(key, version)
        })

        const mergedVersions = Array.from(versionMap.values())
          .sort((first, second) => new Date(second.createdAt) - new Date(first.createdAt))
          .slice(0, 30)

        if (!cancelled) setVersions(mergedVersions)
      } catch {
        if (!cancelled) {
          setVersions([])
          setLoadError('Could not load versions')
          toast.error('Could not load versions')
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void loadVersions()
    return () => {
      cancelled = true
    }
  }, [reloadKey, versionHistoryNoteId, versionHistoryOpen])

  const handleClose = useCallback(() => {
    setVersionHistoryOpen(false)
    setSelectedVersion(null)
    setVersions([])
    setLoadError('')
    setShowPreview(true)
    setConfirmRestore(false)
  }, [setVersionHistoryOpen])

  const formatVersionDate = useCallback(
    (dateString) => {
      const date = new Date(dateString)
      if (Number.isNaN(date.getTime())) return 'Unknown date'

      const difference = date.getTime() - Date.now()
      const absoluteDifference = Math.abs(difference)
      const relativeFormatter = new Intl.RelativeTimeFormat(language, { numeric: 'auto' })
      if (absoluteDifference < 60 * 60 * 1000) {
        return relativeFormatter.format(Math.round(difference / (60 * 1000)), 'minute')
      }
      if (absoluteDifference < 24 * 60 * 60 * 1000) {
        return relativeFormatter.format(Math.round(difference / (60 * 60 * 1000)), 'hour')
      }
      if (absoluteDifference < 7 * 24 * 60 * 60 * 1000) {
        return relativeFormatter.format(Math.round(difference / (24 * 60 * 60 * 1000)), 'day')
      }

      return new Intl.DateTimeFormat(language, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date)
    },
    [language]
  )

  const selectVersion = (version) => {
    setSelectedVersion(version)
    setShowPreview(true)
  }

  const selectedNoteType = selectedVersion?.noteType || note?.noteType || 'standard'
  const selectedVersionOwnsNoteData =
    !!selectedVersion && Object.prototype.hasOwnProperty.call(selectedVersion, 'noteData')
  const selectedHasStructuredData =
    selectedNoteType !== 'standard' &&
    (selectedVersion ? selectedVersionOwnsNoteData : note?.noteData != null)
  const selectedStructuredData = selectedVersionOwnsNoteData
    ? selectedVersion.noteData
    : note?.noteData
  const selectedStructuredPreview = selectedHasStructuredData
    ? getStructuredVersionPreview(selectedNoteType, selectedStructuredData)
    : null
  const selectedVersionIsRestorable = !selectedStructuredPreview?.error

  const handleRestore = async () => {
    if (!selectedVersion || !canRestore || !selectedVersionIsRestorable) return

    const updates = {}
    if (Object.prototype.hasOwnProperty.call(selectedVersion, 'noteData')) {
      const parsed = parseVersionNoteData(selectedVersion.noteData)
      if (parsed.error) {
        toast.error('Failed to parse version data')
        return
      }
      updates.noteData = parsed.data
    }
    if (typeof selectedVersion.content === 'string') updates.content = selectedVersion.content
    if (typeof selectedVersion.title === 'string') updates.title = selectedVersion.title
    if (selectedVersion.noteType) updates.noteType = selectedVersion.noteType

    try {
      await updateNote(versionHistoryNoteId, updates)
      toast.success('Version restored')
      handleClose()
    } catch {
      toast.error('Could not restore this version')
      throw new Error('Version restore failed')
    }
  }

  const getVersionSummary = (version) => {
    const noteType = version.noteType || note?.noteType || 'standard'
    if (noteType !== 'standard' && Object.prototype.hasOwnProperty.call(version, 'noteData')) {
      const preview = getStructuredVersionPreview(noteType, version.noteData)
      return preview.error ? 'Preview unavailable' : preview.summary
    }
    const words = getWordCount(version.content)
    return `${words} word${words === 1 ? '' : 's'}`
  }

  const footer = (
    <>
      <p className="mr-auto text-ui-sm text-content-muted" role="status" aria-live="polite">
        {versions.length} version{versions.length === 1 ? '' : 's'} saved
      </p>
      <Button variant="ghost" onClick={handleClose}>
        {t('common.close', 'Close')}
      </Button>
      {selectedVersion && canRestore && (
        <Button
          variant="primary"
          icon={RotateCcw}
          disabled={!selectedVersionIsRestorable}
          onClick={() => setConfirmRestore(true)}
        >
          Restore this version
        </Button>
      )}
    </>
  )

  return (
    <>
      <Modal
        open={versionHistoryOpen}
        onClose={handleClose}
        title="Version History"
        description={note?.title}
        icon={History}
        size="3xl"
        bodyClassName="!overflow-hidden p-0 sm:p-0"
        footer={footer}
      >
        <div className="grid h-[68dvh] min-h-0 grid-rows-[minmax(9rem,36%)_minmax(0,1fr)] md:h-[min(64dvh,620px)] md:grid-cols-[minmax(15rem,0.9fr)_minmax(0,2fr)] md:grid-rows-1">
          <div
            role="region"
            aria-label="Saved versions"
            tabIndex={0}
            className="min-h-0 overflow-y-auto overscroll-contain border-b border-subtle outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--qn-focus-ring)] md:border-b-0 md:border-r"
          >
            {isLoading ? (
              <div className="flex h-full min-h-36 items-center justify-center">
                <Spinner label="Loading version history" size="lg" />
              </div>
            ) : loadError ? (
              <EmptyState
                icon={AlertCircle}
                size="sm"
                title={loadError}
                description="Check your connection and try again."
                action={
                  <Button variant="secondary" size="sm" onClick={() => setReloadKey((key) => key + 1)}>
                    Try again
                  </Button>
                }
              />
            ) : versions.length === 0 ? (
              <EmptyState
                icon={History}
                size="sm"
                title="No versions found"
                description="Versions are automatically saved when editing."
              />
            ) : (
              <ul className="divide-y divide-[var(--qn-border)]" aria-label="Version snapshots">
                <li>
                  <button
                    type="button"
                    aria-pressed={!selectedVersion}
                    onClick={() => selectVersion(null)}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                      !selectedVersion ? 'bg-accent-soft' : 'hover:bg-surface-hover'
                    }`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-ui-md font-medium text-content">Current Version</span>
                      <span className="mt-0.5 flex items-center gap-1.5 text-ui-xs text-content-muted">
                        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                        {formatVersionDate(note?.updatedAt)}
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-content-subtle" aria-hidden="true" />
                  </button>
                </li>
                {versions.map((version, index) => {
                  const selected = selectedVersion?.id === version.id
                  const versionNumber = versions.length - index
                  return (
                    <li key={version.id || `${version.createdAt}-${index}`}>
                      <button
                        type="button"
                        aria-pressed={selected}
                        onClick={() => selectVersion(version)}
                        className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                          selected ? 'bg-accent-soft' : 'hover:bg-surface-hover'
                        }`}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block text-ui-md font-medium text-content">
                            Version {versionNumber}
                          </span>
                          <span className="mt-0.5 flex items-center gap-1.5 text-ui-xs text-content-muted">
                            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                            {formatVersionDate(version.createdAt)}
                          </span>
                          <span className="mt-1 block truncate text-ui-xs text-content-muted">
                            {getVersionSummary(version)}
                          </span>
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-content-subtle" aria-hidden="true" />
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <section className="flex min-h-0 flex-col" aria-labelledby="qn-version-preview-heading">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-subtle px-4 py-3">
              <h3 id="qn-version-preview-heading" className="text-ui-lg font-medium text-content">
                {selectedVersion ? 'Preview' : 'Current Version'}
              </h3>
              {!selectedHasStructuredData && (selectedVersion?.content || note?.content) && (
                <Button variant="ghost" size="sm" onClick={() => setShowPreview((visible) => !visible)}>
                  {showPreview ? 'Show HTML' : 'Show Preview'}
                </Button>
              )}
            </div>

            <div
              role="region"
              aria-label="Version preview"
              tabIndex={0}
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--qn-focus-ring)]"
            >
              {selectedHasStructuredData ? (
                <StructuredPreview noteType={selectedNoteType} noteData={selectedStructuredData} />
              ) : showPreview ? (
                selectedVersion?.content || note?.content ? (
                  <div
                    className="prose max-w-none text-content dark:prose-invert"
                    dangerouslySetInnerHTML={{
                      __html: sanitizeNoteHtml(selectedVersion?.content || note?.content || ''),
                    }}
                  />
                ) : (
                  <EmptyState
                    icon={FileText}
                    size="sm"
                    title="No content"
                    description="This snapshot does not contain note content."
                  />
                )
              ) : (
                <pre className="overflow-auto whitespace-pre-wrap break-words rounded-card border border-subtle bg-surface-sunken p-4 font-mono text-ui-sm text-content-muted">
                  {selectedVersion?.content || note?.content || 'No content'}
                </pre>
              )}
            </div>
          </section>
        </div>
      </Modal>

      <ConfirmDialog
        open={versionHistoryOpen && confirmRestore}
        onClose={() => setConfirmRestore(false)}
        onConfirm={handleRestore}
        title="Restore this version?"
        description="The current note will be replaced. It remains available in version history."
        confirmLabel="Restore version"
        tone="primary"
      />
    </>
  )
}
