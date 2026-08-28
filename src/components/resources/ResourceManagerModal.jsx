import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  FileAudio,
  FileText,
  ListTodo,
  Paperclip,
  PencilLine,
  RotateCcw,
  ScanText,
  Target,
  Trash2,
  Upload,
  UploadCloud,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { db, getActiveWorkspaceOwner } from '../../lib/db'
import {
  attachResourceToNote,
  discardRecordingSession,
  finalizeRecordingSession,
  inspectLinkedResource,
  listNoteResources,
  listRecoverableRecordings,
  removeNoteResource,
} from '../../lib/resources/repository'
import { resourceKindForMimeType } from '../../lib/resources/model'
import {
  cancelIntelligenceJob,
  requestPdfRecognition,
  getImportedAudioTranscriptionAvailability,
  requestImportedAudioTranscription,
  retryIntelligenceJob,
} from '../../lib/intelligence/service'
import { correctRecognition } from '../../lib/intelligence/repository'
import { getIntelligenceSettings } from '../../lib/intelligence/repository'
import { openPdfPreview, renderPdfPreviewPage } from '../../lib/intelligence/pdfText'
import { TESSERACT_OCR_LANGUAGES } from '../../lib/intelligence/tesseractOcr'
import { Button, Field, Input, Modal, Select, Textarea } from '../ui'
import AudioRecorder from './AudioRecorder'
import RecognitionTaskModal from '../RecognitionTaskModal'
import AttachmentAnnotationModal from '../spatial/AttachmentAnnotationModal'
import { useNotesStore } from '../../store'
import { createRecognitionTaskSource } from '../../lib/taskSources'
import {
  hydrateSharedCaptureGraph,
  listCaptureConflicts,
  resolveCaptureConflict,
  syncCaptureCloud,
} from '../../lib/capture/cloud'

const formatBytes = (value) => {
  if (!Number.isFinite(value) || value < 1024) return `${value || 0} B`
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`
  return `${(value / 1024 / 1024).toFixed(value >= 10 * 1024 * 1024 ? 0 : 1)} MB`
}

const formatDuration = (value) => {
  if (!Number.isFinite(value)) return null
  const seconds = Math.floor(value / 1000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

const importedBlob = (file) => {
  if (resourceKindForMimeType(file.type)) return file
  const extension = file.name.toLowerCase().split('.').pop()
  const mimeType = extension === 'pdf'
    ? 'application/pdf'
    : ({ mp3: 'audio/mpeg', wav: 'audio/wav', webm: 'audio/webm', ogg: 'audio/ogg', m4a: 'audio/mp4' })[extension]
  return mimeType ? new Blob([file], { type: mimeType }) : file
}

const TRANSCRIPTION_LANGUAGES = [
  { id: 'auto', label: 'Detect automatically' },
  { id: 'en', label: 'English' },
  { id: 'de', label: 'German' },
  { id: 'fr', label: 'French' },
  { id: 'es', label: 'Spanish' },
  { id: 'it', label: 'Italian' },
  { id: 'pt', label: 'Portuguese' },
  { id: 'nl', label: 'Dutch' },
  { id: 'pl', label: 'Polish' },
]

export default function ResourceManagerModal({ open, onClose, note, readOnly = false, navigationTarget = null }) {
  const ownerId = open ? (note?.isShared ? note.userId : getActiveWorkspaceOwner()) : null
  const fileInputRef = useRef(null)
  const canvasRef = useRef(null)
  const audioRef = useRef(null)
  const recognizedTextRef = useRef(null)
  const [selectedResourceId, setSelectedResourceId] = useState(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [pdfDocument, setPdfDocument] = useState(null)
  const [previewError, setPreviewError] = useState(null)
  const [jobId, setJobId] = useState(null)
  const [scope, setScope] = useState('page')
  const [rangeStart, setRangeStart] = useState(1)
  const [rangeEnd, setRangeEnd] = useState(1)
  const [language, setLanguage] = useState('eng')
  const [includeOcr, setIncludeOcr] = useState(true)
  const [draft, setDraft] = useState('')
  const [savingCorrection, setSavingCorrection] = useState(false)
  const [busyRecording, setBusyRecording] = useState(false)
  const [confirmRemoveId, setConfirmRemoveId] = useState(null)
  const [selectedTranscriptId, setSelectedTranscriptId] = useState(null)
  const [taskModalOpen, setTaskModalOpen] = useState(false)
  const [taskText, setTaskText] = useState('')
  const [transcriptionLanguage, setTranscriptionLanguage] = useState('auto')
  const [transcriptionConsent, setTranscriptionConsent] = useState(false)
  const [transcriptionAvailability, setTranscriptionAvailability] = useState({ status: 'idle' })
  const [annotationOpen, setAnnotationOpen] = useState(false)
  const [sharedHydration, setSharedHydration] = useState({ status: 'idle', error: '' })

  useEffect(() => {
    if (!open || !note?.isShared || !ownerId) {
      setSharedHydration({ status: 'idle', error: '' })
      return undefined
    }
    let active = true
    setSharedHydration({ status: 'loading', error: '' })
    hydrateSharedCaptureGraph(note.id, ownerId)
      .then(() => { if (active) setSharedHydration({ status: 'ready', error: '' }) })
      .catch((error) => { if (active) setSharedHydration({ status: 'error', error: error?.message || 'Shared attachments could not be loaded.' }) })
    return () => { active = false }
  }, [note?.id, note?.isShared, open, ownerId])

  const entries = useLiveQuery(
    () => open && note?.id ? listNoteResources(note.id, { ownerId }) : [],
    [open, note?.id, ownerId],
    []
  )
  const recoverable = useLiveQuery(
    () => open && note?.id ? listRecoverableRecordings(note.id, { ownerId }) : [],
    [open, note?.id, ownerId],
    []
  )
  const selected = useMemo(
    () => entries.find((entry) => entry.link.resourceId === selectedResourceId) || null,
    [entries, selectedResourceId]
  )
  const inspectedDetails = useLiveQuery(
    () => open && ownerId && selected?.link.resourceId
      ? inspectLinkedResource(selected.link.resourceId, note.id, { ownerId })
      : null,
    [open, selected?.link.resourceId, note?.id, ownerId],
    null
  )
  const details = inspectedDetails?.status === 'available' ? inspectedDetails : null
  const recognition = useLiveQuery(async () => {
    if (!open || !ownerId || !selected?.resource?.id) return []
    return db.recognizedContent
      .where('[ownerId+noteId]')
      .equals([ownerId, note.id])
      .filter((row) => row.sourceResourceId === selected.resource.id && row.status !== 'superseded')
      .toArray()
  }, [open, ownerId, note?.id, selected?.resource?.id], [])
  const transcriptRows = useMemo(() => recognition
    .filter((row) => row.type === 'transcript')
    .sort((left, right) => (left.sourceTimeRange?.startMs || 0) - (right.sourceTimeRange?.startMs || 0)), [recognition])
  const activeRecognition = selected?.resource?.kind === 'pdf'
    ? recognition.find((row) => row.sourcePageNumber === pageNumber) || null
    : transcriptRows.find((row) => row.id === selectedTranscriptId) || transcriptRows[0] || null
  const captureConflicts = useLiveQuery(
    () => open && ownerId && note?.id && selected?.resource?.id
      ? listCaptureConflicts(ownerId, { noteId: note.id, resourceId: selected.resource.id })
      : [],
    [open, ownerId, note?.id, selected?.resource?.id],
    []
  )
  const activeCaptureConflict = captureConflicts.find(
    (conflict) => conflict.recordId === activeRecognition?.id
  ) || captureConflicts[0] || null
  const job = useLiveQuery(() => jobId ? db.intelligenceJobs.get(jobId) : null, [jobId], null)
  const isWorking = ['queued', 'running'].includes(job?.status)
  const transcriptionJob = useLiveQuery(async () => {
    if (!open || !ownerId || !selected?.resource?.id || selected.resource.kind !== 'audio') return null
    const rows = await db.intelligenceJobs
      .where('ownerId')
      .equals(ownerId)
      .filter((row) => row.type === 'transcription' && row.noteId === note.id && row.resourceId === selected.resource.id)
      .toArray()
    return rows.sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))[0] || null
  }, [open, ownerId, note?.id, selected?.resource?.id, selected?.resource?.kind], null)
  const intelligenceSettings = useLiveQuery(
    () => open && ownerId ? getIntelligenceSettings(ownerId) : null,
    [open, ownerId],
    null
  )
  const isTranscriptionWorking = ['queued', 'running'].includes(transcriptionJob?.status)
  const selectedDetailsId = details?.resource.id || null
  const selectedBlob = details?.blob || null

  useEffect(() => {
    if (!open) return
    const requested = navigationTarget?.resourceId
    if (requested && entries.some((entry) => entry.link.resourceId === requested)) {
      setSelectedResourceId(requested)
      if (navigationTarget.pageNumber) setPageNumber(navigationTarget.pageNumber)
      return
    }
    if (!selectedResourceId && entries[0]) setSelectedResourceId(entries[0].link.resourceId)
  }, [entries, navigationTarget, open, selectedResourceId])

  useEffect(() => {
    setDraft(activeRecognition?.text || '')
  }, [activeRecognition?.id, activeRecognition?.text])

  useEffect(() => {
    if (selected?.resource?.kind !== 'audio' || transcriptRows.length === 0) {
      setSelectedTranscriptId(null)
      return
    }
    const requestedId = navigationTarget?.resourceId === selected.resource.id
      ? navigationTarget.recognitionId
      : null
    const requestedTime = navigationTarget?.resourceId === selected.resource.id
      ? navigationTarget.timeMs
      : null
    const requestedRow = requestedId
      ? transcriptRows.find((row) => row.id === requestedId)
      : requestedTime != null
        ? transcriptRows.find((row) => requestedTime >= row.sourceTimeRange?.startMs && requestedTime <= row.sourceTimeRange?.endMs)
        : null
    if (requestedRow) setSelectedTranscriptId(requestedRow.id)
    else if (!transcriptRows.some((row) => row.id === selectedTranscriptId)) setSelectedTranscriptId(transcriptRows[0].id)
  }, [navigationTarget, selected?.resource?.id, selected?.resource?.kind, selectedTranscriptId, transcriptRows])

  useEffect(() => {
    if (!selectedBlob || selected?.resource?.kind !== 'pdf') {
      setPdfDocument(null)
      return undefined
    }
    let disposed = false
    let loaded = null
    setPreviewError(null)
    openPdfPreview(selectedBlob).then((pdf) => {
      if (disposed) {
        void pdf.destroy()
        return
      }
      loaded = pdf
      setPdfDocument(pdf)
      setPageNumber((value) => Math.max(1, Math.min(pdf.numPages, value)))
      setRangeEnd(pdf.numPages)
    }).catch((error) => setPreviewError(error?.message || 'The PDF preview could not be opened.'))
    return () => {
      disposed = true
      setPdfDocument(null)
      void loaded?.destroy?.()
    }
  }, [selected?.resource?.kind, selectedBlob, selectedDetailsId])

  useEffect(() => {
    if (!pdfDocument || !canvasRef.current) return
    const controller = new AbortController()
    const availableWidth = Math.max(320, Math.min(900, canvasRef.current.parentElement?.clientWidth - 24 || 720))
    renderPdfPreviewPage(pdfDocument, pageNumber, canvasRef.current, availableWidth, controller.signal)
      .catch((error) => { if (!controller.signal.aborted) setPreviewError(error?.message || 'This PDF page could not be rendered.') })
    return () => controller.abort()
  }, [pageNumber, pdfDocument])

  useEffect(() => {
    if (!details || details.resource.kind !== 'audio') return undefined
    const url = URL.createObjectURL(details.blob)
    if (audioRef.current) audioRef.current.src = url
    return () => URL.revokeObjectURL(url)
  }, [details])

  useEffect(() => {
    const requestedTime = navigationTarget && navigationTarget.resourceId === selected?.resource.id
      ? navigationTarget.timeMs
      : null
    if (requestedTime == null || !audioRef.current) return
    const seek = () => {
      audioRef.current.currentTime = Math.max(0, requestedTime / 1000)
      audioRef.current.focus()
    }
    if (audioRef.current.readyState >= 1) seek()
    else audioRef.current.addEventListener('loadedmetadata', seek, { once: true })
  }, [navigationTarget, selected?.resource?.id])

  useEffect(() => {
    setTranscriptionConsent(false)
    if (!open || selected?.resource?.kind !== 'audio') {
      setTranscriptionAvailability({ status: 'idle' })
      return undefined
    }
    if (!ownerId || ownerId === 'local') {
      setTranscriptionAvailability({
        status: 'unavailable',
        reason: 'Sign in to a QuickNotes cloud account to use audio-file transcription.',
      })
      return undefined
    }
    const controller = new AbortController()
    setTranscriptionAvailability({ status: 'checking' })
    getImportedAudioTranscriptionAvailability({ signal: controller.signal })
      .then((value) => {
        if (controller.signal.aborted) return
        setTranscriptionAvailability({
          ...value,
          status: value.available ? 'available' : 'unavailable',
        })
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setTranscriptionAvailability({
            status: 'unavailable',
            reason: 'Audio-file transcription availability could not be verified.',
          })
        }
      })
    return () => controller.abort()
  }, [open, ownerId, selected?.resource?.id, selected?.resource?.kind])

  useEffect(() => {
    if (job?.status === 'completed' && job.resultRef?.pageCount && pageNumber > job.resultRef.pageCount) {
      setPageNumber(job.resultRef.pageCount)
    }
  }, [job?.resultRef?.pageCount, job?.status, pageNumber])

  const close = () => {
    if (busyRecording) {
      toast('Stop and save the recording before closing attachments.')
      return
    }
    if (isWorking && jobId) void cancelIntelligenceJob(jobId)
    onClose()
  }

  const attachFiles = async (event) => {
    const files = [...(event.target.files || [])]
    event.target.value = ''
    for (const file of files) {
      try {
        const blob = importedBlob(file)
        const kind = resourceKindForMimeType(blob.type)
        if (!kind) throw new Error('Choose a PDF or a supported audio file.')
        const saved = await attachResourceToNote({
          noteId: note.id,
          blob,
          fileName: file.name,
          kind,
          role: kind === 'audio' ? 'recording' : 'attachment',
          source: 'import',
        })
        setSelectedResourceId(saved.resource.id)
        toast.success(`${kind === 'pdf' ? 'PDF' : 'Audio'} attached`)
      } catch (error) {
        toast.error(error?.message || `${file.name} could not be attached.`)
      }
    }
  }

  const pagesForScope = () => {
    if (!pdfDocument) return null
    if (scope === 'all') return null
    if (scope === 'page') return [pageNumber]
    const start = Math.max(1, Math.min(pdfDocument.numPages, Number(rangeStart) || 1))
    const end = Math.max(start, Math.min(pdfDocument.numPages, Number(rangeEnd) || start))
    return Array.from({ length: end - start + 1 }, (_value, index) => start + index)
  }

  const recognizePdf = async () => {
    try {
      const next = await requestPdfRecognition({
        noteId: note.id,
        resourceId: selected.resource.id,
        pageNumbers: pagesForScope(),
        ocrScannedPages: includeOcr,
        language,
      })
      setJobId(next.id)
    } catch (error) {
      toast.error(error?.message || 'PDF text extraction could not be started.')
    }
  }

  const transcribeAudio = async () => {
    try {
      await requestImportedAudioTranscription({
        noteId: note.id,
        resourceId: selected.resource.id,
        language: transcriptionLanguage,
        externalConfirmed: transcriptionConsent,
      })
      setTranscriptionConsent(false)
      toast.success('Audio transcription queued')
    } catch (error) {
      toast.error(error?.message || 'Audio transcription could not be started.')
    }
  }

  const saveCorrection = async () => {
    if (!activeRecognition || !draft.trim() || draft === activeRecognition.text) return
    setSavingCorrection(true)
    try {
      await correctRecognition(activeRecognition.id, draft)
      toast.success('Recognition correction saved')
    } catch (error) {
      toast.error(error?.message || 'The correction could not be saved.')
    } finally {
      setSavingCorrection(false)
    }
  }

  const chooseCaptureCorrection = async (choice) => {
    if (!activeCaptureConflict) return
    try {
      await resolveCaptureConflict(activeCaptureConflict.id, choice, ownerId)
      if (choice === 'local') await syncCaptureCloud(ownerId)
      toast.success(choice === 'local' ? 'Your correction was kept' : 'Incoming correction applied')
    } catch (error) {
      toast.error(error?.message || 'The correction conflict could not be resolved.')
    }
  }

  const captureConflictBanner = activeCaptureConflict ? (
    <div role="alert" className="mt-3 border border-warning-border bg-warning-soft px-3 py-2 text-ui-sm text-warning-text">
      <p className="font-medium">This text was corrected on two devices.</p>
      <p className="mt-1 text-ui-xs">Your correction remains saved on this device until you choose which version to keep.</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={() => void chooseCaptureCorrection('incoming')}>Use incoming</Button>
        <Button size="sm" variant="primary" onClick={() => void chooseCaptureCorrection('local')}>Keep mine</Button>
      </div>
    </div>
  ) : null

  const openTaskModal = () => {
    if (!activeRecognition) return
    const field = recognizedTextRef.current
    const selection = field && field.selectionStart !== field.selectionEnd
      ? draft.slice(field.selectionStart, field.selectionEnd)
      : draft
    setTaskText(selection.trim())
    setTaskModalOpen(true)
  }

  const addMeetingDecision = async () => {
    if (!activeRecognition || note?.noteType !== 'meeting') return
    const field = recognizedTextRef.current
    const selection = field && field.selectionStart !== field.selectionEnd
      ? draft.slice(field.selectionStart, field.selectionEnd)
      : draft
    const text = selection.replace(/\s+/g, ' ').trim().slice(0, 4_000)
    if (!text) return
    try {
      const store = useNotesStore.getState()
      const current = store.notes.find((candidate) => candidate.id === note.id)
      if (!current || current.noteType !== 'meeting') throw new Error('The meeting is no longer available.')
      const noteData = current.noteData && typeof current.noteData === 'object' ? current.noteData : {}
      await store.updateNote(current.id, {
        noteData: {
          ...noteData,
          decisions: [{
            id: crypto.randomUUID(),
            text,
            timestamp: new Date().toISOString(),
            source: createRecognitionTaskSource(activeRecognition),
          }, ...(Array.isArray(noteData.decisions) ? noteData.decisions : [])],
        },
      })
      toast.success('Meeting decision added with its transcript source')
    } catch (error) {
      toast.error(error?.message || 'The meeting decision could not be added.')
    }
  }

  const removeSelected = async () => {
    if (!selected) return
    if (confirmRemoveId !== selected.link.id) {
      setConfirmRemoveId(selected.link.id)
      return
    }
    try {
      await removeNoteResource(selected.link.id)
      setSelectedResourceId(null)
      setConfirmRemoveId(null)
      toast.success('Attachment removed')
    } catch (error) {
      toast.error(error?.message || 'The attachment could not be removed.')
    }
  }

  return (
    <>
    <Modal
      open={open}
      onClose={close}
      title="Attachments and recordings"
      description="Original sources linked to this note."
      icon={Paperclip}
      size="3xl"
      bodyPadding="none"
      closeOnBackdrop={!busyRecording && !isWorking}
      footer={<Button onClick={close}>{isWorking ? 'Cancel processing and close' : 'Close'}</Button>}
      contentClassName="sm:h-[min(82dvh,820px)]"
    >
      <input
        ref={fileInputRef}
        className="hidden"
        type="file"
        accept="application/pdf,.pdf,audio/*,.mp3,.wav,.m4a,.ogg,.webm"
        multiple
        onChange={attachFiles}
      />
      <div className="grid min-h-full md:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="border-b border-subtle bg-surface-panel md:border-b-0 md:border-r">
          <div className="space-y-2 border-b border-subtle p-3">
            <Button icon={Upload} size="sm" fullWidth onClick={() => fileInputRef.current?.click()} disabled={readOnly || busyRecording}>
              Attach PDF or audio
            </Button>
            <AudioRecorder
              noteId={note.id}
              disabled={readOnly}
              onBusyChange={setBusyRecording}
              onSaved={(saved) => setSelectedResourceId(saved.resource.id)}
            />
            {sharedHydration.status === 'loading' && <p role="status" className="text-ui-xs text-content-muted">Loading shared sources…</p>}
            {sharedHydration.status === 'error' && <p role="alert" className="text-ui-xs text-danger-text">{sharedHydration.error}</p>}
          </div>

          {recoverable.length > 0 && (
            <div className="border-b border-warning-border bg-warning-soft p-3">
              <p className="text-ui-sm font-semibold text-warning-text">Interrupted recording</p>
              <p className="mt-1 text-ui-xs text-warning-text">Saved chunks remain in this browser.</p>
              {recoverable.map((session) => (
                <div key={session.id} className="mt-2 flex gap-1.5">
                  <Button size="sm" icon={RotateCcw} onClick={async () => {
                    try {
                      const saved = await finalizeRecordingSession(session.id, session.durationMs)
                      setSelectedResourceId(saved.resource.id)
                    } catch (error) {
                      toast.error(error?.message || 'The recording could not be recovered.')
                    }
                  }}>Recover</Button>
                  <Button size="sm" variant="danger-ghost" onClick={() => void discardRecordingSession(session.id)}>Discard</Button>
                </div>
              ))}
            </div>
          )}

          <div className="max-h-48 overflow-y-auto md:max-h-[calc(82dvh-14rem)]">
            {entries.length === 0 ? (
              <p className="p-4 text-ui-sm text-content-subtle">No PDFs or recordings are attached.</p>
            ) : entries.map(({ link, resource }) => {
              const missing = !resource
              const Icon = missing ? AlertTriangle : resource.kind === 'pdf' ? FileText : FileAudio
              const selectedRow = link.resourceId === selectedResourceId
              return (
                <button
                  key={link.id}
                  type="button"
                  onClick={() => {
                    setSelectedResourceId(link.resourceId)
                    setPageNumber(1)
                    setConfirmRemoveId(null)
                  }}
                  className={`flex w-full items-start gap-2.5 border-b border-subtle px-3 py-2.5 text-left transition-colors ${
                    selectedRow ? 'bg-accent-soft text-content' : 'text-content-muted hover:bg-surface-hover hover:text-content'
                  }`}
                >
                  <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${missing ? 'text-warning-text' : 'text-accent-text'}`} aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block truncate text-ui-sm font-medium">{resource?.fileName || link.label || 'Missing attachment'}</span>
                    <span className="mt-0.5 block text-ui-xs text-content-subtle">
                      {missing ? 'Metadata is unavailable' : formatBytes(resource.byteSize)}
                      {resource?.durationMs != null ? ` · ${formatDuration(resource.durationMs)}` : ''}
                      {resource?.pageCount ? ` · ${resource.pageCount} pages` : ''}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </aside>

        <main className="min-w-0 bg-surface">
          {!selected ? (
            <div className="flex min-h-72 items-center justify-center p-8 text-center text-ui-sm text-content-subtle">
              Select an attachment to preview it.
            </div>
          ) : inspectedDetails && inspectedDetails.status !== 'available' ? (
            <div className="flex min-h-72 items-center justify-center p-8">
              <div role="alert" className="max-w-md border border-warning-border bg-warning-soft p-4 text-ui-sm text-warning-text">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                  <div>
                    <h3 className="font-semibold text-content">Attachment source is unavailable</h3>
                    <p className="mt-1">
                      {inspectedDetails.status === 'missingMetadata'
                        ? 'The note still contains its attachment reference, but the resource metadata is missing.'
                        : inspectedDetails.status === 'missingPayload'
                          ? 'The attachment metadata is intact, but its original binary payload is missing from this browser.'
                          : inspectedDetails.status === 'invalid'
                            ? inspectedDetails.error
                            : 'This attachment is no longer linked to the note.'}
                    </p>
                    <p className="mt-2 text-ui-xs">Restore a complete workspace backup or allow cloud sync to hydrate the source. QuickNotes will not discard this reference automatically.</p>
                    {!readOnly && inspectedDetails.link && (
                      <Button
                        className="mt-3"
                        size="sm"
                        variant={confirmRemoveId === inspectedDetails.link.id ? 'danger' : 'danger-ghost'}
                        icon={Trash2}
                        onClick={removeSelected}
                      >
                        {confirmRemoveId === inspectedDetails.link.id ? 'Confirm remove reference' : 'Remove broken reference'}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : !details ? (
            <div role="status" className="flex min-h-72 items-center justify-center p-8 text-center text-ui-sm text-content-subtle">
              Checking attachment integrity…
            </div>
          ) : selected.resource.kind === 'pdf' ? (
            <div className="flex min-h-full flex-col">
              <header className="flex flex-wrap items-center gap-2 border-b border-subtle bg-surface-raised px-3 py-2">
                <Button size="sm" icon={ChevronLeft} onClick={() => setPageNumber((value) => Math.max(1, value - 1))} disabled={!pdfDocument || pageNumber <= 1}>Previous</Button>
                <label className="flex items-center gap-2 text-ui-sm text-content-muted">
                  Page
                  <Input
                    className="w-16"
                    size="sm"
                    type="number"
                    min="1"
                    max={pdfDocument?.numPages || 1}
                    value={pageNumber}
                    onChange={(event) => setPageNumber(Math.max(1, Math.min(pdfDocument?.numPages || 1, Number(event.target.value) || 1)))}
                  />
                  of {pdfDocument?.numPages || '—'}
                </label>
                <Button size="sm" iconRight={ChevronRight} onClick={() => setPageNumber((value) => Math.min(pdfDocument?.numPages || value, value + 1))} disabled={!pdfDocument || pageNumber >= pdfDocument.numPages}>Next</Button>
                <Button size="sm" variant="secondary" icon={PencilLine} onClick={() => setAnnotationOpen(true)} disabled={!pdfDocument}>
                  {readOnly ? 'View annotations' : 'Annotate page'}
                </Button>
                {!readOnly && (
                  <Button
                    size="sm"
                    variant={confirmRemoveId === selected.link.id ? 'danger' : 'danger-ghost'}
                    icon={Trash2}
                    className="ml-auto"
                    onClick={removeSelected}
                  >
                    {confirmRemoveId === selected.link.id ? 'Confirm remove' : 'Remove'}
                  </Button>
                )}
              </header>
              <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_20rem]">
                <div className="min-h-72 overflow-auto bg-surface-sunken p-3 text-center">
                  {previewError && <p role="alert" className="m-4 text-ui-sm text-danger-text">{previewError}</p>}
                  <canvas ref={canvasRef} className="mx-auto max-w-full border border-strong bg-white shadow-sm" aria-label={`PDF page ${pageNumber}`} />
                </div>
                <aside className="border-t border-subtle p-4 lg:border-l lg:border-t-0">
                  <div className="border-y border-subtle bg-surface-sunken px-3 py-2 text-ui-xs text-content-muted">
                    <strong className="font-semibold text-content">Processing: Local</strong>
                    <p className="mt-1">PDF.js extracts selectable text first. Only pages without useful text are rendered for local OCR.</p>
                  </div>
                  <div className="mt-4 space-y-3">
                    <Field label="Pages">
                      {({ id, ...props }) => (
                        <Select id={id} value={scope} onChange={(event) => setScope(event.target.value)} disabled={isWorking} {...props}>
                          <option value="page">Current page</option>
                          <option value="range">Page range</option>
                          <option value="all">Full PDF</option>
                        </Select>
                      )}
                    </Field>
                    {scope === 'range' && (
                      <div className="grid grid-cols-2 gap-2">
                        <Field label="From">{({ id, ...props }) => <Input id={id} type="number" min="1" max={pdfDocument?.numPages} value={rangeStart} onChange={(event) => setRangeStart(event.target.value)} {...props} />}</Field>
                        <Field label="To">{({ id, ...props }) => <Input id={id} type="number" min="1" max={pdfDocument?.numPages} value={rangeEnd} onChange={(event) => setRangeEnd(event.target.value)} {...props} />}</Field>
                      </div>
                    )}
                    <label className="flex items-start gap-2 text-ui-sm text-content-muted">
                      <input type="checkbox" className="mt-0.5 accent-[var(--qn-accent)]" checked={includeOcr} onChange={(event) => setIncludeOcr(event.target.checked)} disabled={isWorking} />
                      <span>OCR scanned pages locally</span>
                    </label>
                    {includeOcr && (
                      <Field label="OCR language">
                        {({ id, ...props }) => (
                          <Select id={id} value={language} onChange={(event) => setLanguage(event.target.value)} disabled={isWorking} {...props}>
                            {TESSERACT_OCR_LANGUAGES.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                          </Select>
                        )}
                      </Field>
                    )}
                    <Button variant="primary" icon={ScanText} onClick={recognizePdf} loading={isWorking} disabled={!pdfDocument || readOnly} fullWidth>
                      Extract searchable text
                    </Button>
                    {isWorking && (
                      <div role="status" aria-live="polite" className="space-y-1 text-ui-xs text-content-muted">
                        <span>{job.status === 'queued' ? 'Waiting' : 'Processing'} · {Math.round((job.progress || 0) * 100)}%</span>
                        <progress className="h-1.5 w-full accent-[var(--qn-accent)]" max="100" value={(job.progress || 0) * 100} />
                        <Button size="sm" variant="ghost" onClick={() => void cancelIntelligenceJob(job.id)}>Cancel</Button>
                      </div>
                    )}
                    {job?.status === 'failed' && (
                      <div role="alert" className="text-ui-sm text-danger-text">
                        <p>{job.error}</p>
                        <Button className="mt-2" size="sm" icon={RotateCcw} onClick={() => void retryIntelligenceJob(job.id)}>Retry</Button>
                      </div>
                    )}
                  </div>

                  <div className="mt-5 border-t border-subtle pt-4">
                    <p className="text-ui-sm font-semibold text-content">Page {pageNumber} text</p>
                    {captureConflictBanner}
                    {activeRecognition ? (
                      <>
                        <Textarea ref={recognizedTextRef} aria-label={`Recognized text for PDF page ${pageNumber}`} className="mt-2" rows={7} value={draft} onChange={(event) => setDraft(event.target.value)} readOnly={readOnly} />
                        <p className="mt-1 text-ui-xs text-content-subtle">
                          {activeRecognition.type === 'pdfText' ? 'Embedded PDF text' : 'Local OCR'}
                          {activeRecognition.userEdited ? ' · User corrected' : ''}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {!readOnly && <Button size="sm" onClick={saveCorrection} loading={savingCorrection} disabled={!draft.trim() || draft === activeRecognition.text}>Save correction</Button>}
                          <Button size="sm" variant="secondary" icon={ListTodo} onClick={openTaskModal} disabled={!draft.trim()}>Create task</Button>
                        </div>
                      </>
                    ) : (
                      <p className="mt-2 text-ui-sm text-content-subtle">No searchable text has been extracted for this page.</p>
                    )}
                  </div>
                </aside>
              </div>
            </div>
          ) : (
            <div className="p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4 border-b border-subtle pb-4">
                <div className="min-w-0">
                  <h3 className="truncate text-ui-lg font-semibold text-content">{selected.resource.fileName}</h3>
                  <p className="mt-1 text-ui-sm text-content-muted">Original audio · {formatBytes(selected.resource.byteSize)}{selected.resource.durationMs != null ? ` · ${formatDuration(selected.resource.durationMs)}` : ''}</p>
                </div>
                {!readOnly && (
                  <Button variant={confirmRemoveId === selected.link.id ? 'danger' : 'danger-ghost'} size="sm" icon={Trash2} onClick={removeSelected}>
                    {confirmRemoveId === selected.link.id ? 'Confirm remove' : 'Remove'}
                  </Button>
                )}
              </div>
              <audio ref={audioRef} controls preload="metadata" className="mt-5 w-full" aria-label={`Playback for ${selected.resource.fileName}`} />
              <div className="mt-6 border-t border-subtle pt-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-ui-sm font-semibold text-content">Transcript</p>
                  {activeRecognition?.status === 'stale' && <span className="text-ui-xs font-medium text-warning-text">Source changed</span>}
                </div>
                {captureConflictBanner}
                {!readOnly && (
                  <div className="mt-3 border-y border-subtle bg-surface-sunken px-3 py-3">
                    {isTranscriptionWorking ? (
                      <div role="status" aria-live="polite" className="text-ui-sm text-content-muted">
                        <p className="font-medium text-content">
                          {transcriptionJob.status === 'queued' ? 'Waiting to transcribe' : transcriptionJob.progress < 0.18 ? 'Preparing synced audio' : 'External transcription in progress'}
                        </p>
                        <progress className="mt-2 h-1.5 w-full accent-[var(--qn-accent)]" max="100" {...(transcriptionJob.progress < 0.18 ? { value: transcriptionJob.progress * 100 } : {})} />
                        <div className="mt-2 flex items-center justify-between gap-3">
                          <span className="text-ui-xs">The original recording remains unchanged.</span>
                          <Button size="sm" variant="ghost" onClick={() => void cancelIntelligenceJob(transcriptionJob.id)}>Cancel</Button>
                        </div>
                      </div>
                    ) : transcriptionJob?.status === 'failed' ? (
                      <div role="alert" className="text-ui-sm text-danger-text">
                        <p>{transcriptionJob.error}</p>
                        <p className="mt-1 text-ui-xs text-content-subtle">Retrying sends this audio to the configured provider again.</p>
                        <Button className="mt-2" size="sm" icon={RotateCcw} onClick={() => void retryIntelligenceJob(transcriptionJob.id)}>Retry transcription</Button>
                      </div>
                    ) : transcriptionAvailability.status === 'checking' ? (
                      <p role="status" className="text-ui-sm text-content-muted">Checking configured audio-file transcription...</p>
                    ) : ownerId === 'local' ? (
                      <div className="text-ui-sm text-content-muted">
                        <p className="font-medium text-content">Audio-file transcription unavailable</p>
                        <p className="mt-1">{transcriptionAvailability.reason}</p>
                      </div>
                    ) : intelligenceSettings?.mode !== 'externalAllowed' ? (
                      <div className="text-ui-sm text-content-muted">
                        <p className="font-medium text-content">Audio-file transcription is external</p>
                        <p className="mt-1">Enable External allowed in Recognition privacy settings to use a configured provider. Local-only mode never uploads audio.</p>
                      </div>
                    ) : transcriptionAvailability.status !== 'available' ? (
                      <div className="text-ui-sm text-content-muted">
                        <p className="font-medium text-content">Audio-file transcription unavailable</p>
                        <p className="mt-1">{transcriptionAvailability.reason || 'No operational provider is configured.'}</p>
                      </div>
                    ) : selected.resource.byteSize > transcriptionAvailability.maxBytes ? (
                      <div className="text-ui-sm text-content-muted">
                        <p className="font-medium text-content">Audio file exceeds provider limit</p>
                        <p className="mt-1">This configured provider accepts files up to {Math.round(transcriptionAvailability.maxBytes / 1024 / 1024)} MB. The original audio remains attached.</p>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-start gap-2">
                          <UploadCloud className="mt-0.5 h-4 w-4 shrink-0 text-accent-text" aria-hidden="true" />
                          <div className="text-ui-sm text-content-muted">
                            <p className="font-medium text-content">External audio-file transcription</p>
                            <p className="mt-1">QuickNotes sends this recording through its authenticated server to the configured OpenAI speech-to-text provider. Consent applies to this operation only.</p>
                          </div>
                        </div>
                        <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,12rem)_1fr] sm:items-end">
                          <Field label="Spoken language">
                            {({ id, ...props }) => (
                              <Select id={id} value={transcriptionLanguage} onChange={(event) => setTranscriptionLanguage(event.target.value)} {...props}>
                                {TRANSCRIPTION_LANGUAGES.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                              </Select>
                            )}
                          </Field>
                          <label className="flex items-start gap-2 text-ui-sm text-content-muted">
                            <input type="checkbox" className="mt-0.5 accent-[var(--qn-accent)]" checked={transcriptionConsent} onChange={(event) => setTranscriptionConsent(event.target.checked)} />
                            <span>Send this audio for external transcription now</span>
                          </label>
                        </div>
                        <Button className="mt-3" variant="primary" size="sm" icon={UploadCloud} onClick={transcribeAudio} disabled={!transcriptionConsent}>
                          {transcriptRows.length > 0 ? 'Transcribe again' : 'Transcribe audio'}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
                {transcriptRows.length > 0 ? (
                  <>
                    <p className="mt-3 text-ui-xs text-content-subtle">
                      {transcriptRows.some((row) => row.processingLocation === 'external')
                        ? 'Provider timestamped transcript linked to the original audio.'
                        : 'Browser-managed live transcript; capture-time segments are approximate.'}
                    </p>
                    <ol className="mt-3 max-h-56 overflow-y-auto border-y border-subtle" aria-label="Transcript segments">
                      {transcriptRows.map((row) => {
                        const selectedSegment = row.id === activeRecognition?.id
                        return (
                          <li key={row.id} className="border-b border-subtle last:border-b-0">
                            <button
                              type="button"
                              className={`grid w-full grid-cols-[5.5rem_1fr] gap-3 px-3 py-2 text-left text-ui-sm transition-colors ${selectedSegment ? 'bg-accent-soft text-content' : 'hover:bg-surface-hover'}`}
                              aria-current={selectedSegment ? 'true' : undefined}
                              onClick={() => {
                                setSelectedTranscriptId(row.id)
                                if (audioRef.current) {
                                  audioRef.current.currentTime = Math.max(0, (row.sourceTimeRange?.startMs || 0) / 1000)
                                  audioRef.current.focus()
                                }
                              }}
                            >
                              <span className="font-mono text-ui-xs tabular-nums text-content-subtle">
                                {formatDuration(row.sourceTimeRange?.startMs || 0)}–{formatDuration(row.sourceTimeRange?.endMs || 0)}
                              </span>
                              <span>{row.text}{row.status === 'stale' ? <span className="ml-2 text-ui-xs text-warning-text">Stale</span> : null}</span>
                            </button>
                          </li>
                        )
                      })}
                    </ol>
                    <Textarea ref={recognizedTextRef} aria-label="Selected transcript segment" className="mt-3" rows={4} value={draft} onChange={(event) => setDraft(event.target.value)} readOnly={readOnly} />
                    <p className="mt-1 text-ui-xs text-content-subtle">Linked to the original recording and selected time range{activeRecognition?.userEdited ? ' · User corrected' : ''}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {!readOnly && <Button size="sm" onClick={saveCorrection} loading={savingCorrection} disabled={!draft.trim() || draft === activeRecognition.text}>Save correction</Button>}
                      <Button size="sm" variant="secondary" icon={ListTodo} onClick={openTaskModal} disabled={!draft.trim()}>{note?.noteType === 'meeting' ? 'Add action item' : 'Create task'}</Button>
                      {note?.noteType === 'meeting' && !readOnly && (
                        <Button size="sm" variant="secondary" icon={Target} onClick={() => void addMeetingDecision()} disabled={!draft.trim()}>Add decision</Button>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="mt-3 text-ui-sm text-content-subtle">No transcript is attached. New recordings can create an optional live transcript with explicit consent where browser speech recognition is supported.</p>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </Modal>
    {selected?.resource?.kind === 'pdf' && details && (
      <AttachmentAnnotationModal
        open={annotationOpen}
        onClose={() => setAnnotationOpen(false)}
        noteId={note.id}
        resource={{ ...selected.resource, kind: 'pdf' }}
        pdfDocument={pdfDocument}
        initialPage={pageNumber}
        readOnly={readOnly}
        ownerId={ownerId}
      />
    )}
    <RecognitionTaskModal
      open={taskModalOpen}
      onClose={() => setTaskModalOpen(false)}
      recognition={activeRecognition}
      initialText={taskText}
      allowMeetingTarget={!readOnly}
    />
    </>
  )
}
