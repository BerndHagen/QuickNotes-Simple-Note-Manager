import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Clock, Type, Volume2, VolumeX, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { useUIStore, useNotesStore } from '../store'
import RichTextEditor from './RichTextEditor'
import { useEscapeKey, useFocusTrap, useScrollLock } from './ui'

const AMBIENT_SOUNDS = [
  { id: 'none', name: 'No sound' },
  { id: 'rain', name: 'Rain', url: 'https://cdn.pixabay.com/audio/2022/05/16/audio_460734a5be.mp3' },
  { id: 'forest', name: 'Forest', url: 'https://cdn.pixabay.com/audio/2022/03/15/audio_a46401e44e.mp3' },
  { id: 'cafe', name: 'Café', url: 'https://cdn.pixabay.com/audio/2021/09/06/audio_68d69f40b4.mp3' },
  { id: 'waves', name: 'Waves', url: 'https://cdn.pixabay.com/audio/2022/02/23/audio_fd85f17289.mp3' },
]

// Focus themes are independent of the workspace theme and therefore carry
// an explicit background/text pair.
const FOCUS_THEMES = [
  { id: 'minimal', name: 'Minimal', bg: 'bg-surface-raised', text: 'text-content' },
  { id: 'sepia', name: 'Sepia', bg: 'bg-amber-50', text: 'text-amber-950' },
  { id: 'night', name: 'Night', bg: 'bg-gray-950', text: 'text-gray-100' },
  { id: 'green', name: 'Nature', bg: 'bg-emerald-50', text: 'text-emerald-950' },
]

const countWords = (html = '') => {
  const element = document.createElement('div')
  element.innerHTML = html
  const text = element.textContent || ''
  return text.trim() ? text.trim().split(/\s+/u).length : 0
}

const formatTime = (seconds) => {
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return `${minutes.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`
}

export default function FocusMode() {
  const { focusModeOpen, setFocusModeOpen } = useUIStore()
  const { getSelectedNote, updateNote } = useNotesStore()
  const note = getSelectedNote()
  const panelRef = useRef(null)
  const controlsRef = useRef(null)
  const audioRef = useRef(null)
  const lastActivityRef = useRef(0)
  const titleId = useId()

  const [theme, setTheme] = useState('minimal')
  const [ambientSound, setAmbientSound] = useState('none')
  const [showControls, setShowControls] = useState(true)
  const [controlsFocused, setControlsFocused] = useState(false)
  const [sessionTime, setSessionTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [audioError, setAudioError] = useState('')
  const [wordCount, setWordCount] = useState(() => countWords(note?.content))
  const [activity, setActivity] = useState(0)

  const close = useCallback(() => setFocusModeOpen(false), [setFocusModeOpen])
  const active = Boolean(focusModeOpen && note)
  useFocusTrap(panelRef, active)
  useScrollLock(active)
  useEscapeKey(active, close)

  const stopAudio = useCallback(() => {
    audioRef.current?.pause()
    audioRef.current = null
    setIsPlaying(false)
  }, [])

  useEffect(() => {
    if (focusModeOpen && !note) {
      toast.error('Open a note before entering focus mode')
      setFocusModeOpen(false)
    }
  }, [focusModeOpen, note, setFocusModeOpen])

  useEffect(() => {
    if (!active) {
      stopAudio()
      return undefined
    }

    setSessionTime(0)
    setShowControls(true)
    const timer = window.setInterval(() => setSessionTime((value) => value + 1), 1000)
    return () => window.clearInterval(timer)
  }, [active, note?.id, stopAudio])

  useEffect(() => {
    if (active) setWordCount(countWords(note.content))
  }, [active, note?.content])

  useEffect(() => {
    if (!active || !showControls || controlsFocused) return undefined
    const timeoutId = window.setTimeout(() => setShowControls(false), 3000)
    return () => window.clearTimeout(timeoutId)
  }, [active, activity, controlsFocused, showControls])

  useEffect(() => () => stopAudio(), [stopAudio])

  const playSound = useCallback(
    async (soundId) => {
      stopAudio()
      setAmbientSound(soundId)
      setAudioError('')

      const sound = AMBIENT_SOUNDS.find(({ id }) => id === soundId)
      if (!sound?.url) return

      const audio = new Audio(sound.url)
      audio.loop = true
      audio.volume = 0.3
      audioRef.current = audio

      try {
        await audio.play()
        if (audioRef.current === audio) setIsPlaying(true)
      } catch {
        if (audioRef.current === audio) audioRef.current = null
        audio.pause()
        setIsPlaying(false)
        setAudioError('Ambient audio could not be played. Check your connection or browser media settings.')
      }
    },
    [stopAudio]
  )

  const toggleSound = useCallback(async () => {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      audio.pause()
      setIsPlaying(false)
      return
    }

    setAudioError('')
    try {
      await audio.play()
      setIsPlaying(true)
    } catch {
      setIsPlaying(false)
      setAudioError('Ambient audio could not be resumed. Check your browser media settings.')
    }
  }, [isPlaying])

  const handleContentChange = useCallback(
    (content) => {
      if (!note || (note.isShared && note.sharePermission === 'view')) return
      updateNote(note.id, { content })
      setWordCount(countWords(content))
    },
    [note, updateNote]
  )

  const revealControls = useCallback(() => {
    setShowControls(true)
    const now = Date.now()
    if (now - lastActivityRef.current >= 250) {
      lastActivityRef.current = now
      setActivity((value) => value + 1)
    }
  }, [])

  if (!active) return null

  const currentTheme = FOCUS_THEMES.find(({ id }) => id === theme) || FOCUS_THEMES[0]
  const readOnly = Boolean(note.isShared && note.sharePermission === 'view')

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
      onPointerMove={revealControls}
      onPointerDown={revealControls}
      onKeyDownCapture={revealControls}
      className={`fixed inset-0 z-dialog overflow-hidden outline-none ${currentTheme.bg} ${currentTheme.text}`}
    >
      <header
        ref={controlsRef}
        onFocusCapture={() => {
          setControlsFocused(true)
          revealControls()
        }}
        onBlurCapture={(event) => {
          if (!controlsRef.current?.contains(event.relatedTarget)) setControlsFocused(false)
        }}
        className={`absolute inset-x-0 top-0 z-20 border-b border-black/10 bg-inherit px-3 py-2.5 shadow-xs transition-opacity duration-fast sm:px-5 ${
          showControls || controlsFocused ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex shrink-0 items-center gap-3 text-current opacity-70">
            <span className="flex items-center gap-1.5 font-mono text-ui-md" aria-label={`Session time ${formatTime(sessionTime)}`}>
              <Clock className="h-4 w-4" aria-hidden="true" />
              {formatTime(sessionTime)}
            </span>
            <span className="flex items-center gap-1.5 text-ui-md">
              <Type className="h-4 w-4" aria-hidden="true" />
              {wordCount} {wordCount === 1 ? 'word' : 'words'}
            </span>
          </div>

          <div className="ml-auto flex min-w-0 items-center gap-2">
            <label className="sr-only" htmlFor="qn-focus-theme">Paper theme</label>
            <select
              id="qn-focus-theme"
              value={theme}
              onChange={(event) => setTheme(event.target.value)}
              className="h-9 min-w-0 max-w-28 rounded-control border border-black/15 bg-black/5 px-2 text-ui-md font-medium text-current outline-none focus-visible:ring-2 focus-visible:ring-current"
            >
              {FOCUS_THEMES.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>

            <label className="sr-only" htmlFor="qn-focus-sound">Ambient sound</label>
            <select
              id="qn-focus-sound"
              value={ambientSound}
              onChange={(event) => void playSound(event.target.value)}
              className="h-9 min-w-0 max-w-28 rounded-control border border-black/15 bg-black/5 px-2 text-ui-md font-medium text-current outline-none focus-visible:ring-2 focus-visible:ring-current"
            >
              {AMBIENT_SOUNDS.map((sound) => <option key={sound.id} value={sound.id}>{sound.name}</option>)}
            </select>

            {ambientSound !== 'none' && audioRef.current && (
              <button
                type="button"
                onClick={() => void toggleSound()}
                aria-label={isPlaying ? 'Pause ambient sound' : 'Play ambient sound'}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control text-current hover:bg-black/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                {isPlaying ? <Volume2 className="h-4 w-4" aria-hidden="true" /> : <VolumeX className="h-4 w-4" aria-hidden="true" />}
              </button>
            )}

            <button
              type="button"
              onClick={close}
              aria-label="Exit focus mode"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control text-current hover:bg-black/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
        {audioError && <p role="alert" className="mx-auto mt-2 max-w-6xl text-ui-sm font-medium text-danger-text">{audioError}</p>}
      </header>

      <div data-dialog-body className="absolute inset-0 overflow-y-auto px-3 pb-6 pt-20 sm:px-6 sm:pb-8 sm:pt-24">
        <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col">
          <h1 id={titleId} className="mb-5 text-center text-2xl font-bold opacity-85 sm:mb-6 sm:text-3xl">
            {note.title || 'Untitled note'}
          </h1>
          {readOnly && (
            <p className="mb-3 text-center text-ui-md font-medium opacity-70">
              Read-only shared note
            </p>
          )}
          <div className="focus-mode-editor min-h-[50vh] flex-1 overflow-y-auto">
            <RichTextEditor
              content={note.content}
              onChange={handleContentChange}
              placeholder="Start writing…"
              paperType="plain"
              readOnly={readOnly}
            />
          </div>
        </div>
      </div>

      <p className={`pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 text-ui-xs opacity-50 transition-opacity ${showControls ? 'opacity-50' : 'opacity-0'}`}>
        Press Escape to exit
      </p>
    </div>,
    document.body
  )
}
