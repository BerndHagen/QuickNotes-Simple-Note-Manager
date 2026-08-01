import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle, Mic, MicOff } from 'lucide-react'
import toast from 'react-hot-toast'

const isAlreadyRunningError = (error) => error?.name === 'InvalidStateError'

export default function VoiceInput({ onTranscript, isActive, onToggle }) {
  const [isListening, setIsListening] = useState(false)
  const [isSupported, setIsSupported] = useState(true)
  const [interimTranscript, setInterimTranscript] = useState('')
  const recognitionRef = useRef(null)
  const onTranscriptRef = useRef(onTranscript)
  const onToggleRef = useRef(onToggle)
  const activeRef = useRef(isActive)
  const disposedRef = useRef(false)
  const manuallyPausedRef = useRef(false)
  const hadErrorRef = useRef(false)
  const announceStartRef = useRef(false)

  onTranscriptRef.current = onTranscript
  onToggleRef.current = onToggle
  activeRef.current = isActive

  const startRecognition = useCallback((announce = false) => {
    const recognition = recognitionRef.current
    if (!recognition || disposedRef.current) return

    manuallyPausedRef.current = false
    announceStartRef.current = announce
    try {
      recognition.start()
    } catch (error) {
      announceStartRef.current = false
      if (!isAlreadyRunningError(error)) {
        toast.error('Voice recognition could not be started')
      }
    }
  }, [])

  const pauseRecognition = useCallback(() => {
    const recognition = recognitionRef.current
    manuallyPausedRef.current = true
    announceStartRef.current = false
    if (!recognition) return

    try {
      recognition.stop()
    } catch (error) {
      if (!isAlreadyRunningError(error)) {
        toast.error('Voice recognition could not be paused')
      }
    }
    setIsListening(false)
  }, [])

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition

    if (!SpeechRecognition) {
      setIsSupported(false)
      return undefined
    }

    disposedRef.current = false
    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = navigator.language || 'en-US'

    recognition.onstart = () => {
      if (disposedRef.current) return
      setIsListening(true)
      hadErrorRef.current = false
      if (announceStartRef.current) {
        announceStartRef.current = false
        toast.success('Voice recognition started')
      }
    }

    recognition.onend = () => {
      if (disposedRef.current) return
      setIsListening(false)
      if (activeRef.current && !manuallyPausedRef.current && !hadErrorRef.current) {
        try {
          recognition.start()
        } catch (error) {
          if (!isAlreadyRunningError(error)) {
            toast.error('Voice recognition stopped unexpectedly')
          }
        }
      }
    }

    recognition.onresult = (event) => {
      let final = ''
      let interim = ''

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index]
        if (result.isFinal) final += result[0].transcript
        else interim += result[0].transcript
      }

      setInterimTranscript(interim)
      if (final) onTranscriptRef.current?.(final)
    }

    recognition.onerror = (event) => {
      hadErrorRef.current = event.error !== 'no-speech'
      setIsListening(false)

      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        manuallyPausedRef.current = true
        setIsSupported(false)
        toast.error('Microphone access was denied. Allow access in your browser settings to use voice input.')
      } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
        toast.error(`Voice recognition error: ${event.error}`)
        onToggleRef.current?.(false)
      }
    }

    recognitionRef.current = recognition

    if (activeRef.current) startRecognition(true)

    return () => {
      disposedRef.current = true
      activeRef.current = false
      manuallyPausedRef.current = true
      recognitionRef.current = null
      try {
        recognition.abort?.()
      } catch {
        // The recognition service may already have released its session.
      }
    }
  }, [startRecognition])

  useEffect(() => {
    if (!recognitionRef.current || !isSupported) return

    if (isActive) {
      if (!isListening && !manuallyPausedRef.current) startRecognition(true)
    } else {
      pauseRecognition()
      setInterimTranscript('')
    }
  }, [isActive, isListening, isSupported, pauseRecognition, startRecognition])

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && activeRef.current) onToggleRef.current?.(false)
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  if (!isSupported) {
    return (
      <div
        role="alert"
        aria-label="Voice input unavailable"
        className="fixed bottom-4 left-4 right-4 z-50 rounded-xl border border-red-200 bg-red-50 p-4 shadow-xl sm:bottom-8 sm:left-auto sm:right-8 dark:border-red-800 dark:bg-red-900/30"
      >
        <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
          <AlertCircle className="h-6 w-6 shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">Voice input unavailable</p>
            <p className="text-sm">This browser does not support voice recognition, or microphone access is blocked.</p>
          </div>
          <button
            type="button"
            onClick={() => onToggleRef.current?.(false)}
            aria-label="Close voice input"
            className="ml-2 rounded p-1 hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:hover:bg-red-800/50"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
      </div>
    )
  }

  return (
    <section
      role="dialog"
      aria-label="Voice input"
      className="fixed bottom-4 left-4 right-4 z-50 overflow-hidden rounded-xl border border-subtle bg-surface-raised shadow-2xl sm:bottom-8 sm:left-auto sm:right-8 sm:w-[320px]"
    >
      <div className="flex items-center justify-between border-b border-subtle bg-surface-sunken px-4 py-3">
        <div className="flex items-center gap-2" role="status" aria-live="polite">
          <span
            className={`h-3 w-3 rounded-full ${isListening ? 'animate-pulse bg-red-500' : 'bg-gray-400'}`}
            aria-hidden="true"
          />
          <span className="text-sm font-medium text-content">
            {isListening ? 'Recording…' : 'Voice input paused'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onToggleRef.current?.(false)}
          aria-label="Close voice input"
          className="rounded p-1 transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <MicOff className="h-4 w-4 text-content-muted" aria-hidden="true" />
        </button>
      </div>
      <div className="p-4">
        <div className="flex flex-col items-center gap-4">
          <button
            type="button"
            onClick={() => (isListening ? pauseRecognition() : startRecognition())}
            aria-label={isListening ? 'Pause voice input' : 'Resume voice input'}
            aria-pressed={isListening}
            className={`flex h-16 w-16 items-center justify-center rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ${
              isListening
                ? 'scale-110 bg-red-500 text-white shadow-lg shadow-red-500/30'
                : 'bg-surface-sunken text-content-muted hover:bg-surface-hover'
            }`}
          >
            <Mic className="h-8 w-8" aria-hidden="true" />
          </button>
          {interimTranscript && (
            <p aria-live="polite" className="max-w-[250px] text-center text-sm italic text-content-muted">
              “{interimTranscript}”
            </p>
          )}
          <p className="text-center text-xs text-content-subtle">Speak clearly · Esc closes voice input</p>
        </div>
      </div>
    </section>
  )
}

export function useVoiceInput(onTranscript) {
  const [isActive, setIsActive] = useState(false)

  const toggle = (active) => {
    setIsActive((current) => active ?? !current)
  }

  return {
    isActive,
    toggle,
    VoiceButton: () => (
      <VoiceInput
        isActive={isActive}
        onToggle={toggle}
        onTranscript={onTranscript}
      />
    ),
  }
}
