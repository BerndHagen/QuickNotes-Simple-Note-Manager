import React, { useState, useEffect, useCallback } from 'react'
import {
  Type,
  Clock,
  X,
  Volume2,
  VolumeX
} from 'lucide-react'
import { useUIStore, useNotesStore } from '../store'
import RichTextEditor from './RichTextEditor'

const AMBIENT_SOUNDS = [
  { id: 'none', name: 'None', icon: VolumeX },
  { id: 'rain', name: 'Rain', url: 'https://cdn.pixabay.com/audio/2022/05/16/audio_460734a5be.mp3' },
  { id: 'forest', name: 'Forest', url: 'https://cdn.pixabay.com/audio/2022/03/15/audio_a46401e44e.mp3' },
  { id: 'cafe', name: 'Café', url: 'https://cdn.pixabay.com/audio/2021/09/06/audio_68d69f40b4.mp3' },
  { id: 'waves', name: 'Waves', url: 'https://cdn.pixabay.com/audio/2022/02/23/audio_fd85f17289.mp3' },
]

const FOCUS_THEMES = [
  { id: 'minimal', name: 'Minimal', bg: 'bg-white dark:bg-gray-900', text: 'text-gray-900 dark:text-gray-100' },
  { id: 'sepia', name: 'Sepia', bg: 'bg-amber-50', text: 'text-amber-900' },
  { id: 'night', name: 'Night', bg: 'bg-gray-950', text: 'text-gray-200' },
  { id: 'green', name: 'Nature', bg: 'bg-emerald-50 dark:bg-emerald-950', text: 'text-emerald-900 dark:text-emerald-100' },
]

export default function FocusMode() {
  const { focusModeOpen, setFocusModeOpen } = useUIStore()
  const { getSelectedNote, updateNote } = useNotesStore()
  const note = getSelectedNote()

  const [theme, setTheme] = useState('minimal')
  const [ambientSound, setAmbientSound] = useState('none')
  const [showControls, setShowControls] = useState(true)
  const [sessionTime, setSessionTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [audio, setAudio] = useState(null)
  const [wordCount, setWordCount] = useState(0)

  useEffect(() => {
    if (!focusModeOpen) return
    
    const timer = setInterval(() => {
      setSessionTime((prev) => prev + 1)
    }, 1000)

    return () => clearInterval(timer)
  }, [focusModeOpen])

  useEffect(() => {
    if (focusModeOpen) {
      setSessionTime(0)
      setShowControls(true)
    }
  }, [focusModeOpen])

  useEffect(() => {
    if (audio) {
      audio.pause()
      setAudio(null)
    }

    const sound = AMBIENT_SOUNDS.find((s) => s.id === ambientSound)
    if (sound?.url) {
      const newAudio = new Audio(sound.url)
      newAudio.loop = true
      newAudio.volume = 0.3
      setAudio(newAudio)
      
      if (isPlaying) {
        newAudio.play().catch(() => {})
      }
    }

    return () => {
      if (audio) {
        audio.pause()
      }
    }
  }, [ambientSound])

  useEffect(() => {
    if (audio) {
      if (isPlaying) {
        audio.play().catch(() => {})
      } else {
        audio.pause()
      }
    }
  }, [isPlaying, audio])

  useEffect(() => {
    if (!focusModeOpen && audio) {
      audio.pause()
      setAudio(null)
      setIsPlaying(false)
    }
  }, [focusModeOpen])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        if (audio) {
          audio.pause()
        }
        setFocusModeOpen(false)
      }
    }

    if (focusModeOpen) {
      window.addEventListener('keydown', handleKeyDown, true)
      return () => window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [focusModeOpen, setFocusModeOpen, audio])

  useEffect(() => {
    if (!focusModeOpen) return
    
    let hideTimeout
    if (showControls) {
      hideTimeout = setTimeout(() => setShowControls(false), 3000)
    }
    return () => clearTimeout(hideTimeout)
  }, [focusModeOpen, showControls])

  const handleContentChange = useCallback((content) => {
    if (note) {
      updateNote(note.id, { content })
      
      const div = document.createElement('div')
      div.innerHTML = content
      const text = div.textContent || div.innerText || ''
      setWordCount(text.trim().split(/\s+/).filter(Boolean).length)
    }
  }, [note, updateNote])

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const toggleSound = () => {
    setIsPlaying(!isPlaying)
  }

  const currentTheme = FOCUS_THEMES.find((t) => t.id === theme) || FOCUS_THEMES[0]

  if (!focusModeOpen || !note) return null

  return (
    <div
      className={`fixed inset-0 z-[200] ${currentTheme.bg} transition-colors duration-500`}
      onMouseMove={() => setShowControls(true)}
    >
      <div
        className={`absolute top-0 left-0 right-0 z-[210] flex items-center justify-between px-6 py-4 transition-all duration-300 ${
          showControls ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-4">
          <div className={`flex items-center gap-2 ${currentTheme.text} opacity-60`}>
            <Clock className="w-4 h-4" />
            <span className="text-sm font-mono">{formatTime(sessionTime)}</span>
          </div>
          <div className={`flex items-center gap-2 ${currentTheme.text} opacity-60`}>
            <Type className="w-4 h-4" />
            <span className="text-sm">{wordCount} words</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-black/10 dark:bg-white/10 rounded-lg p-1">
            {FOCUS_THEMES.map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  theme === t.id
                    ? 'bg-white dark:bg-gray-800 shadow'
                    : 'hover:bg-white/50 dark:hover:bg-gray-800/50'
                } ${currentTheme.text}`}
              >
                {t.name}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 bg-black/10 dark:bg-white/10 rounded-lg p-1">
            {AMBIENT_SOUNDS.slice(0, 4).map((sound) => (
              <button
                key={sound.id}
                onClick={() => {
                  setAmbientSound(sound.id)
                  if (sound.id !== 'none') setIsPlaying(true)
                }}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  ambientSound === sound.id
                    ? 'bg-white dark:bg-gray-800 shadow'
                    : 'hover:bg-white/50 dark:hover:bg-gray-800/50'
                } ${currentTheme.text}`}
              >
                {sound.name}
              </button>
            ))}
            {ambientSound !== 'none' && (
              <button
                onClick={toggleSound}
                className={`p-1.5 rounded-md hover:bg-white/50 dark:hover:bg-gray-800/50 ${currentTheme.text}`}
              >
                {isPlaying ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>
            )}
          </div>
          <button
            onClick={() => setFocusModeOpen(false)}
            className={`p-2 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors ${currentTheme.text}`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
      <div className="absolute inset-0 flex items-center justify-center pt-16 pb-8 px-4">
        <div className={`w-full max-w-3xl h-full ${currentTheme.text}`}>
          <h1 className="text-3xl font-bold mb-6 text-center opacity-80">
            {note.title}
          </h1>
          <div className="h-[calc(100%-4rem)] overflow-y-auto focus-mode-editor">
            <RichTextEditor
              content={note.content}
              onChange={handleContentChange}
              placeholder="Start writing..."
              paperType="plain"
            />
          </div>
        </div>
      </div>
      <div
        className={`absolute bottom-4 left-1/2 -translate-x-1/2 text-sm opacity-30 transition-opacity duration-300 ${
          showControls ? 'opacity-30' : 'opacity-0'
        } ${currentTheme.text}`}
      >
        Press ESC to exit
      </div>
    </div>
  )
}
