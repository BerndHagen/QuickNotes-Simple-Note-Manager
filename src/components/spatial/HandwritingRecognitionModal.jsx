import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ListTodo, ScanText } from 'lucide-react'
import toast from 'react-hot-toast'
import { db, getActiveWorkspaceOwner } from '../../lib/db'
import {
  cancelIntelligenceJob,
  requestHandwritingRecognition,
  retryIntelligenceJob,
} from '../../lib/intelligence/service'
import { correctRecognition } from '../../lib/intelligence/repository'
import { Button, Field, Input, Modal, Textarea } from '../ui'
import RecognitionTaskModal from '../RecognitionTaskModal'

const sameIds = (left = [], right = []) => {
  if (left.length !== right.length) return false
  const sortedLeft = [...left].sort()
  const sortedRight = [...right].sort()
  return sortedLeft.every((id, index) => id === sortedRight[index])
}

export default function HandwritingRecognitionModal({ open, onClose, noteId, objects, onInsertText }) {
  const [language, setLanguage] = useState(() => navigator.language || 'en')
  const [jobId, setJobId] = useState(null)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [taskModalOpen, setTaskModalOpen] = useState(false)
  const ownerId = getActiveWorkspaceOwner()
  const objectIds = useMemo(() => objects.map((object) => object.id), [objects])
  const objectIdentity = objectIds.join('\u001f')

  const job = useLiveQuery(
    () => jobId ? db.intelligenceJobs.get(jobId) : null,
    [jobId],
    null
  )
  const existingRecognition = useLiveQuery(async () => {
    if (!open || !ownerId || !noteId || objectIds.length === 0) return null
    return db.recognizedContent
      .where('[ownerId+noteId]')
      .equals([ownerId, noteId])
      .filter((row) => row.type === 'handwriting' && row.status !== 'superseded' && sameIds(row.sourceObjectIds, objectIds))
      .first()
  }, [open, ownerId, noteId, objectIdentity], null)
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
    if (job?.status === 'failed') setError(job.error || 'Handwriting recognition failed.')
    else if (job?.status === 'completed') setError(null)
  }, [job?.error, job?.status])

  const start = async () => {
    setError(null)
    try {
      const nextJob = await requestHandwritingRecognition({
        noteId,
        objectIds,
        language: language.trim() || navigator.language || 'en',
        // Clicking the action below confirms this disclosed operation only.
        externalConfirmed: true,
      })
      setJobId(nextJob.id)
    } catch (requestError) {
      setError(requestError?.message || 'Handwriting recognition could not be started.')
    }
  }

  const saveCorrection = async () => {
    if (!recognition || !draft.trim() || draft === recognition.text) return recognition
    setSaving(true)
    setError(null)
    try {
      const corrected = await correctRecognition(recognition.id, draft.trim())
      toast.success('Handwriting correction saved')
      return corrected
    } catch (saveError) {
      setError(saveError?.message || 'The correction could not be saved.')
      return null
    } finally {
      setSaving(false)
    }
  }

  const insertText = async () => {
    const text = draft.trim()
    if (!recognition || !text) return
    if (text !== recognition.text && !await saveCorrection()) return
    onInsertText?.(text, recognition.sourceRegion)
    toast.success('Recognized text added; original ink preserved')
    onClose()
  }

  const close = () => {
    if (isWorking && jobId) void cancelIntelligenceJob(jobId)
    onClose()
  }

  return (
    <>
    <Modal
      open={open}
      onClose={close}
      title="Recognize handwriting"
      description={`${objects.length} selected ink stroke${objects.length === 1 ? '' : 's'}`}
      icon={ScanText}
      size="md"
      closeOnBackdrop={!isWorking}
      footer={(
        <>
          <Button onClick={close}>{isWorking ? 'Cancel' : 'Close'}</Button>
          {job?.status === 'failed'
            ? <Button variant="primary" onClick={() => void retryIntelligenceJob(job.id)} icon={ScanText}>Retry this operation</Button>
            : recognition
              ? <Button variant="primary" onClick={insertText} loading={saving} disabled={!draft.trim()}>Add as editable text</Button>
              : <Button variant="primary" icon={ScanText} onClick={start} disabled={isWorking} loading={isWorking}>Recognize with browser</Button>}
        </>
      )}
    >
      <div className="space-y-4">
        <div className="border-y border-subtle bg-surface-sunken px-3 py-2.5 text-ui-sm text-content-muted">
          <strong className="font-semibold text-content">Processing: Browser-managed</strong>
          <p className="mt-1 leading-relaxed">
            The selected stroke coordinates are passed to the browser&apos;s handwriting recognizer. The browser or operating system decides whether its recognizer runs on this device or uses a service. QuickNotes does not send other note content.
          </p>
          <p className="mt-2 text-ui-xs text-content-subtle">
            Choosing “Recognize with browser” confirms this selection once. Recognition is never started automatically.
          </p>
        </div>

        {!recognition && (
          <Field label="Language" hint="Use a BCP 47 language tag supported by your device, such as en-US or de-AT.">
            {({ id, ...fieldProps }) => (
              <Input id={id} value={language} maxLength={35} onChange={(event) => setLanguage(event.target.value)} disabled={isWorking} {...fieldProps} />
            )}
          </Field>
        )}

        {isWorking && (
          <div role="status" aria-live="polite" className="space-y-2">
            <div className="flex items-center justify-between text-ui-sm text-content-muted">
              <span>{job?.status === 'queued' ? 'Waiting for recognition' : 'Recognizing selected ink'}</span>
              <span>{progress}%</span>
            </div>
            <progress className="h-1.5 w-full accent-[var(--qn-accent)]" max="100" value={progress}>{progress}%</progress>
          </div>
        )}

        {recognition && (
          <>
            <Field
              label="Recognized text"
              hint="Corrections stay searchable and survive a rerun. The original ink remains canonical and unchanged."
              error={error}
            >
              {({ id, ...fieldProps }) => (
                <Textarea id={id} rows={7} value={draft} onChange={(event) => setDraft(event.target.value)} {...fieldProps} />
              )}
            </Field>
            <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-subtle pt-3 text-ui-xs text-content-subtle">
              <span>{recognition.providerId}</span>
              <span>{recognition.language || 'Language unknown'}</span>
              <span>Browser-managed</span>
              {recognition.status === 'stale' && <span className="text-warning-text">Source changed</span>}
              {recognition.userEdited && <span>User corrected</span>}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={saveCorrection} loading={saving} disabled={!draft.trim() || draft === recognition.text}>Save correction</Button>
              <Button variant="secondary" size="sm" icon={ListTodo} onClick={() => setTaskModalOpen(true)} disabled={!draft.trim()}>Create task</Button>
              <Button variant="ghost" size="sm" onClick={start} disabled={isWorking}>Re-run with browser</Button>
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
      initialText={draft}
    />
    </>
  )
}
