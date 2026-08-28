import { useCallback, useEffect, useRef, useState } from 'react'
import { Mic, Pause, Play, StopCircle, Subtitles } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  appendRecordingChunk,
  beginRecordingSession,
  finalizeRecordingSession,
} from '../../lib/resources/repository'
import {
  saveBrowserManagedTranscript,
  startBrowserManagedLiveTranscription,
} from '../../lib/intelligence/service'
import { isBrowserSpeechRecognitionSupported } from '../../lib/intelligence/browserSpeech'
import { Button } from '../ui'

const preferredMimeType = () => [
  'audio/webm;codecs=opus',
  'audio/mp4;codecs=mp4a.40.2',
  'audio/ogg;codecs=opus',
  'audio/webm',
  'audio/mp4',
].find((type) => globalThis.MediaRecorder?.isTypeSupported?.(type)) || ''

const formatDuration = (milliseconds) => {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000))
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`
}

export default function AudioRecorder({ noteId, disabled = false, onSaved, onBusyChange }) {
  const [state, setState] = useState('idle')
  const [elapsedMs, setElapsedMs] = useState(0)
  const [error, setError] = useState(null)
  const [liveTranscription, setLiveTranscription] = useState(false)
  const [interimTranscript, setInterimTranscript] = useState('')
  const [transcriptionStatus, setTranscriptionStatus] = useState('off')
  const recorderRef = useRef(null)
  const streamRef = useRef(null)
  const sessionRef = useRef(null)
  const writeChainRef = useRef(Promise.resolve())
  const writeFailureRef = useRef(null)
  const startedAtRef = useRef(0)
  const pausedAtRef = useRef(0)
  const pausedDurationRef = useRef(0)
  const transcriptionRef = useRef(null)
  const transcriptionControllerRef = useRef(null)
  const transcriptSegmentsRef = useRef([])
  const transcriptTextLengthRef = useRef(0)
  const speechSupported = isBrowserSpeechRecognitionSupported()

  const durationNow = useCallback(() => {
    if (!startedAtRef.current) return 0
    const effectiveNow = pausedAtRef.current || Date.now()
    return Math.max(0, effectiveNow - startedAtRef.current - pausedDurationRef.current)
  }, [])

  useEffect(() => {
    const busy = ['acquiring', 'recording', 'paused', 'stopping'].includes(state)
    onBusyChange?.(busy)
    if (!['recording', 'paused'].includes(state)) return undefined
    const update = () => setElapsedMs(durationNow())
    update()
    const timer = window.setInterval(update, 250)
    return () => window.clearInterval(timer)
  }, [durationNow, onBusyChange, state])

  const releaseStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    recorderRef.current = null
  }

  useEffect(() => () => {
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.requestData()
        recorder.stop()
      } catch {
        // The periodic chunks already committed to IndexedDB remain recoverable.
      }
    }
    streamRef.current?.getTracks().forEach((track) => track.stop())
    transcriptionControllerRef.current?.abort()
    transcriptionRef.current?.session?.abort?.()
  }, [])

  const start = async () => {
    setError(null)
    if (!navigator.mediaDevices?.getUserMedia || !globalThis.MediaRecorder) {
      setError('This browser does not support durable audio recording.')
      return
    }
    setState('acquiring')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      // Own the stream immediately. MediaRecorder construction or the first
      // IndexedDB session write can fail, and both paths must still release
      // the already granted microphone.
      streamRef.current = stream
      const requestedType = preferredMimeType()
      const recorder = requestedType ? new MediaRecorder(stream, { mimeType: requestedType }) : new MediaRecorder(stream)
      const mimeType = recorder.mimeType || requestedType
      const session = await beginRecordingSession(noteId, mimeType)
      recorderRef.current = recorder
      sessionRef.current = session
      writeChainRef.current = Promise.resolve()
      writeFailureRef.current = null
      startedAtRef.current = Date.now()
      pausedAtRef.current = 0
      pausedDurationRef.current = 0
      setElapsedMs(0)
      setInterimTranscript('')
      setTranscriptionStatus(liveTranscription ? 'starting' : 'off')
      transcriptSegmentsRef.current = []
      transcriptTextLengthRef.current = 0
      recorder.ondataavailable = (event) => {
        if (!event.data?.size || writeFailureRef.current) return
        const durationMs = durationNow()
        writeChainRef.current = writeChainRef.current.then(() => (
          appendRecordingChunk(session.id, event.data, { durationMs })
        )).catch((writeError) => {
          writeFailureRef.current = writeError
          setError(`Audio could not be saved to browser storage: ${writeError?.message || 'storage write failed'}. Stop the recording; earlier saved chunks remain recoverable.`)
        })
      }
      recorder.onerror = (event) => {
        setError(event.error?.message || 'The browser stopped recording unexpectedly. Saved chunks can be recovered.')
      }
      recorder.start(5_000)
      setState('recording')
      if (liveTranscription) {
        const controller = new AbortController()
        transcriptionControllerRef.current = controller
        try {
          transcriptionRef.current = await startBrowserManagedLiveTranscription({
            externalConfirmed: true,
            signal: controller.signal,
            getElapsedMs: durationNow,
            onInterim: setInterimTranscript,
            onStatus: setTranscriptionStatus,
            onError: (speechError) => {
              setTranscriptionStatus('failed')
              setError(speechError?.message || 'Live transcription stopped unexpectedly. The recording is still being saved.')
            },
            onSegment: (segment) => {
              if (transcriptSegmentsRef.current.length >= 5_000) return
              const nextLength = transcriptTextLengthRef.current + segment.text.length
              if (nextLength > 200_000) return
              transcriptTextLengthRef.current = nextLength
              transcriptSegmentsRef.current.push(segment)
            },
          })
        } catch (speechError) {
          transcriptionControllerRef.current = null
          setTranscriptionStatus('failed')
          setError(`${speechError?.message || 'Live transcription could not be started.'} The audio recording is continuing.`)
        }
      }
    } catch (startError) {
      releaseStream()
      setState('idle')
      setError(startError?.name === 'NotAllowedError'
        ? 'Microphone access was denied. Allow access in browser settings and try again.'
        : startError?.message || 'Audio recording could not be started.')
    }
  }

  const togglePause = () => {
    const recorder = recorderRef.current
    if (!recorder) return
    if (recorder.state === 'recording') {
      recorder.requestData()
      recorder.pause()
      pausedAtRef.current = Date.now()
      setState('paused')
      transcriptionRef.current?.session?.pause?.()
    } else if (recorder.state === 'paused') {
      pausedDurationRef.current += Date.now() - pausedAtRef.current
      pausedAtRef.current = 0
      recorder.resume()
      transcriptionRef.current?.session?.resume?.()
      setState('recording')
    }
  }

  const stop = async () => {
    const recorder = recorderRef.current
    const session = sessionRef.current
    if (!recorder || !session) return
    setError(null)
    setState('stopping')
    const durationMs = durationNow()
    try {
      await transcriptionRef.current?.session?.stop?.()
      if (recorder.state === 'paused') recorder.resume()
      const stopped = new Promise((resolve) => recorder.addEventListener('stop', resolve, { once: true }))
      recorder.requestData()
      recorder.stop()
      await stopped
      await writeChainRef.current
      if (writeFailureRef.current) throw writeFailureRef.current
      const saved = await finalizeRecordingSession(session.id, durationMs)
      let transcriptCount = 0
      let transcriptSaveFailed = false
      if (transcriptSegmentsRef.current.length > 0) {
        try {
          const rows = await saveBrowserManagedTranscript({
            noteId,
            resourceId: saved.resource.id,
            segments: transcriptSegmentsRef.current,
            language: transcriptionRef.current?.language || navigator.language || 'en',
          })
          transcriptCount = rows.length
        } catch (transcriptError) {
          transcriptSaveFailed = true
          setError(`Recording saved, but its live transcript could not be attached: ${transcriptError?.message || 'unknown error'}`)
        }
      }
      sessionRef.current = null
      transcriptionRef.current = null
      transcriptionControllerRef.current = null
      releaseStream()
      setState('idle')
      setElapsedMs(0)
      setInterimTranscript('')
      setTranscriptionStatus('off')
      if (liveTranscription && transcriptCount === 0 && !transcriptSaveFailed) {
        setError('Recording saved, but the browser did not produce any transcript text.')
      }
      toast.success(transcriptCount > 0
        ? `Recording saved with ${transcriptCount} transcript segment${transcriptCount === 1 ? '' : 's'}`
        : liveTranscription ? 'Recording saved without a transcript' : 'Recording saved')
      onSaved?.({ ...saved, transcriptCount })
    } catch (stopError) {
      releaseStream()
      transcriptionControllerRef.current?.abort()
      transcriptionRef.current = null
      transcriptionControllerRef.current = null
      setState('idle')
      setError(stopError?.message || 'The recording could not be finalized. Its saved chunks can be recovered.')
    }
  }

  if (!['recording', 'paused', 'stopping'].includes(state)) {
    return (
      <div className="space-y-2">
        <Button icon={Mic} onClick={start} loading={state === 'acquiring'} disabled={disabled}>
          Record audio
        </Button>
        {speechSupported && (
          <label className="flex items-start gap-2 text-ui-xs text-content-muted">
            <input
              type="checkbox"
              checked={liveTranscription}
              onChange={(event) => setLiveTranscription(event.target.checked)}
              disabled={disabled || state === 'acquiring'}
              className="mt-0.5 accent-[var(--qn-accent)]"
            />
            <span>
              <span className="font-medium text-content">Create a live transcript</span>
              <span className="mt-0.5 block leading-relaxed">
                Browser-managed: microphone speech may be processed online by the browser or operating system. Requires “External allowed” in Recognition settings. Selecting this option and starting the recording confirms this session only.
              </span>
            </span>
          </label>
        )}
        {error && <p role="alert" className="mt-2 text-ui-sm text-danger-text">{error}</p>}
      </div>
    )
  }

  return (
    <div className="border-y border-subtle bg-surface-sunken px-3 py-3">
      <div className="mb-2 flex items-center justify-between gap-3" role="status" aria-live="polite">
        <span className="flex items-center gap-2 text-ui-sm font-semibold text-content">
          <span className={`h-2.5 w-2.5 rounded-full ${state === 'recording' ? 'animate-pulse bg-danger' : 'bg-warning'}`} aria-hidden="true" />
          {state === 'paused' ? 'Recording paused' : state === 'stopping' ? 'Saving recording' : 'Recording'}
        </span>
        <time className="font-mono text-ui-sm tabular-nums text-content-muted">{formatDuration(elapsedMs)}</time>
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          icon={state === 'paused' ? Play : Pause}
          onClick={togglePause}
          disabled={state === 'stopping'}
        >
          {state === 'paused' ? 'Resume' : 'Pause'}
        </Button>
        <Button size="sm" variant="primary" icon={StopCircle} onClick={stop} loading={state === 'stopping'}>
          Stop and save
        </Button>
      </div>
      <p className="mt-2 text-ui-xs text-content-subtle">Audio chunks are saved to this browser every few seconds.</p>
      {liveTranscription && (
        <div className="mt-2 border-t border-subtle pt-2 text-ui-xs text-content-muted">
          <p className="flex items-center gap-1.5 font-medium text-content">
            <Subtitles className="h-3.5 w-3.5" aria-hidden="true" />
            {transcriptionStatus === 'failed' ? 'Live transcript stopped' : transcriptionStatus === 'paused' ? 'Live transcript paused' : 'Live transcript active'}
          </p>
          {interimTranscript && <p aria-live="polite" className="mt-1 line-clamp-2 italic">{interimTranscript}</p>}
        </div>
      )}
      {error && <p role="alert" className="mt-2 text-ui-sm text-danger-text">{error}</p>}
    </div>
  )
}
