import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ListTodo, ScanText } from 'lucide-react'
import toast from 'react-hot-toast'
import { db, getActiveWorkspaceOwner } from '../../lib/db'
import {
  cancelIntelligenceJob,
  requestSpatialImageOcr,
  retryIntelligenceJob,
} from '../../lib/intelligence/service'
import { correctRecognition } from '../../lib/intelligence/repository'
import { TESSERACT_OCR_LANGUAGES } from '../../lib/intelligence/tesseractOcr'
import { Button, Field, Modal, Select, Textarea } from '../ui'
import RecognitionTaskModal from '../RecognitionTaskModal'

export default function ImageOcrModal({ open, onClose, noteId, object, resource }) {
  const [language, setLanguage] = useState('eng')
  const [jobId, setJobId] = useState(null)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [taskModalOpen, setTaskModalOpen] = useState(false)
  const [taskText, setTaskText] = useState('')
  const recognizedTextRef = useRef(null)
  const ownerId = getActiveWorkspaceOwner()

  const job = useLiveQuery(
    () => jobId ? db.intelligenceJobs.get(jobId) : null,
    [jobId],
    null
  )
  const existingRecognition = useLiveQuery(async () => {
    if (!open || !ownerId || !noteId || !object?.id) return null
    return db.recognizedContent
      .where('[ownerId+noteId]')
      .equals([ownerId, noteId])
      .filter((row) => row.type === 'ocr' && row.sourceObjectIds?.includes(object.id) && row.status !== 'superseded')
      .first()
  }, [open, ownerId, noteId, object?.id], null)
  const jobRecognition = useLiveQuery(async () => {
    const recognitionId = job?.resultRef?.recognitionIds?.[0]
    return recognitionId ? db.recognizedContent.get(recognitionId) : null
  }, [job?.resultRef?.recognitionIds?.[0]], null)
  const recognition = jobRecognition || existingRecognition
  const isWorking = ['queued', 'running'].includes(job?.status)
  const progress = Math.round((job?.progress || 0) * 100)

  useEffect(() => {
    if (!open) {
      setJobId(null)
      setDraft('')
      setError(null)
      return
    }
    setDraft(recognition?.text || '')
  }, [open, recognition?.id, recognition?.text])

  useEffect(() => {
    if (job?.status === 'failed') setError(job.error || 'OCR failed.')
    else if (job?.status === 'completed') setError(null)
  }, [job?.error, job?.status])

  const providerSummary = useMemo(() => {
    const selected = TESSERACT_OCR_LANGUAGES.find((candidate) => candidate.id === language)
    return selected ? `${selected.label} model` : 'Selected language model'
  }, [language])

  const start = async () => {
    setError(null)
    try {
      const nextJob = await requestSpatialImageOcr({
        noteId,
        objectId: object.id,
        resourceId: resource.id,
        language,
      })
      setJobId(nextJob.id)
    } catch (requestError) {
      setError(requestError?.message || 'OCR could not be started.')
    }
  }

  const saveCorrection = async () => {
    if (!recognition || draft === recognition.text) return
    setSaving(true)
    setError(null)
    try {
      await correctRecognition(recognition.id, draft)
      toast.success('OCR correction saved')
    } catch (saveError) {
      setError(saveError?.message || 'The correction could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  const close = () => {
    if (isWorking && jobId) void cancelIntelligenceJob(jobId)
    onClose()
  }

  const primaryAction = recognition
    ? <Button variant="primary" onClick={saveCorrection} loading={saving} disabled={!draft.trim() || draft === recognition.text}>Save correction</Button>
    : <Button variant="primary" icon={ScanText} onClick={start} disabled={isWorking} loading={isWorking}>Recognize text</Button>

  const openTaskModal = () => {
    const field = recognizedTextRef.current
    const selection = field && field.selectionStart !== field.selectionEnd
      ? draft.slice(field.selectionStart, field.selectionEnd)
      : draft
    setTaskText(selection.trim())
    setTaskModalOpen(true)
  }

  return (
    <>
    <Modal
      open={open}
      onClose={close}
      title="Recognize image text"
      description="Local printed-text OCR for the selected image."
      icon={ScanText}
      size="md"
      closeOnBackdrop={!isWorking}
      footer={(
        <>
          <Button onClick={close}>{isWorking ? 'Cancel' : 'Close'}</Button>
          {job?.status === 'failed'
            ? <Button variant="primary" onClick={() => void retryIntelligenceJob(job.id)} icon={ScanText}>Retry</Button>
            : primaryAction}
        </>
      )}
    >
      <div className="space-y-4">
        <div className="border-y border-subtle bg-surface-sunken px-3 py-2.5 text-ui-sm text-content-muted">
          <strong className="font-semibold text-content">Processing: Local</strong>
          <p className="mt-1">
            The image stays in this browser. Tesseract may download and cache the {providerSummary}; the model receives the image only on this device.
          </p>
        </div>

        {!recognition && (
          <Field
            label="Recognition language"
            hint="Choosing the correct language improves printed-text recognition. Handwriting is not supported by this OCR engine."
          >
            {({ id, ...fieldProps }) => (
              <Select id={id} value={language} onChange={(event) => setLanguage(event.target.value)} disabled={isWorking} {...fieldProps}>
                {TESSERACT_OCR_LANGUAGES.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
              </Select>
            )}
          </Field>
        )}

        {isWorking && (
          <div role="status" aria-live="polite" className="space-y-2">
            <div className="flex items-center justify-between text-ui-sm text-content-muted">
              <span>{job?.status === 'queued' ? 'Waiting for the local OCR worker' : 'Recognizing printed text'}</span>
              <span>{progress}%</span>
            </div>
            <progress className="h-1.5 w-full accent-[var(--qn-accent)]" max="100" value={progress}>{progress}%</progress>
          </div>
        )}

        {recognition && (
          <>
            <Field
              label="Recognized text"
              hint="Corrections are searchable and will be preserved if OCR is rerun. The source image remains unchanged."
              error={error}
            >
              {({ id, ...fieldProps }) => (
                <Textarea ref={recognizedTextRef} id={id} rows={9} value={draft} onChange={(event) => setDraft(event.target.value)} {...fieldProps} />
              )}
            </Field>
            <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-subtle pt-3 text-ui-xs text-content-subtle">
              <span>{recognition.providerId}</span>
              <span>{recognition.language?.toUpperCase() || 'Language unknown'}</span>
              {recognition.confidence != null && <span>{Math.round(recognition.confidence * 100)}% confidence</span>}
              {recognition.userEdited && <span>User corrected</span>}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" icon={ListTodo} onClick={openTaskModal} disabled={!draft.trim()}>Create task</Button>
              <Button variant="ghost" size="sm" onClick={start} disabled={isWorking}>Re-run local OCR</Button>
            </div>
          </>
        )}

        {error && !recognition && <p role="alert" className="text-ui-sm text-danger-text">{error}</p>}
      </div>
    </Modal>
    <RecognitionTaskModal
      open={taskModalOpen}
      onClose={() => setTaskModalOpen(false)}
      recognition={recognition}
      initialText={taskText}
    />
    </>
  )
}
