import React, { useState, useEffect, useRef } from 'react'
import { Mic, MicOff, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'

export default function VoiceInput({ onTranscript, isActive, onToggle }) {
  const [isListening, setIsListening] = useState(false)
  const [isSupported, setIsSupported] = useState(true)
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const recognitionRef = useRef(null)
  const hadErrorRef = useRef(false)

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    
    if (!SpeechRecognition) {
      setIsSupported(false)
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onstart = () => {
      setIsListening(true)
      hadErrorRef.current = false
    }

    recognition.onend = () => {
      setIsListening(false)
      if (isActive && !hadErrorRef.current) {
        try {
          recognition.start()
        } catch (e) {
        }
      }
    }

    recognition.onresult = (event) => {
      let final = ''
      let interim = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          final += result[0].transcript
        } else {
          interim += result[0].transcript
        }
      }

      setInterimTranscript(interim)
      
      if (final) {
        setTranscript((prev) => prev + final)
        onTranscript?.(final)
      }
    }

    recognition.onerror = (event) => {
      hadErrorRef.current = true
      if (event.error === 'not-allowed') {
        toast.error('Microphone access not allowed. Please check permissions.')
        setIsSupported(false)
      } else if (event.error === 'no-speech') {
        hadErrorRef.current = false
      } else {
        toast.error(`Speech recognition error: ${event.error}`)
        onToggle?.(false)
      }
      
      setIsListening(false)
    }

    recognitionRef.current = recognition

    return () => {
      recognition.stop()
    }
  }, [])

  useEffect(() => {
    if (!recognitionRef.current || !isSupported) return

    if (isActive) {
      try {
        recognitionRef.current.start()
        toast.success('Voice recognition started')
      } catch (e) {
      }
    } else {
      recognitionRef.current.stop()
      setTranscript('')
      setInterimTranscript('')
    }
  }, [isActive, isSupported])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isActive) {
        onToggle?.(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isActive, onToggle])

  if (!isSupported) {
    return (
      <div className="fixed bottom-8 right-8 z-50 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl p-4 shadow-xl">
        <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
          <AlertCircle className="w-6 h-6" />
          <div>
            <p className="font-medium">Not Supported</p>
            <p className="text-sm">Voice recognition is not supported by this browser</p>
          </div>
          <button
            onClick={() => onToggle?.(false)}
            className="ml-2 p-1 hover:bg-red-100 dark:hover:bg-red-800/50 rounded"
          >
            {"\u2715"}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed bottom-8 right-8 z-50 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl shadow-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-300 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${isListening ? 'bg-red-500 animate-pulse' : 'bg-gray-400'}`} />
          <span className="font-medium text-gray-900 dark:text-white text-sm">
            {isListening ? 'Recording...' : 'Voice Recognition'}
          </span>
        </div>
        <button
          onClick={() => onToggle?.(false)}
          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
        >
          <MicOff className="w-4 h-4 text-gray-500" />
        </button>
      </div>
      <div className="p-4 min-w-[280px]">
        <div className="flex flex-col items-center gap-4">
          <button
            onClick={() => {
              if (isListening) {
                recognitionRef.current?.stop()
              } else {
                try {
                  recognitionRef.current?.start()
                } catch (e) {}
              }
            }}
            className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
              isListening
                ? 'bg-red-500 text-white shadow-lg shadow-red-500/30 scale-110'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            <Mic className="w-8 h-8" />
          </button>
          {interimTranscript && (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center italic max-w-[250px]">
              "{interimTranscript}"
            </p>
          )}
          <p className="text-xs text-gray-400 text-center">
            Speak clearly {"\u2022"} ESC to stop
          </p>
        </div>
      </div>
    </div>
  )
}

export function useVoiceInput(onTranscript) {
  const [isActive, setIsActive] = useState(false)

  const toggle = (active) => {
    setIsActive(active ?? !isActive)
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
