import React, { useState, useEffect, useCallback } from 'react'
import { X, Keyboard, Edit3, RotateCcw, Save, AlertCircle } from 'lucide-react'
import { useUIStore } from '../store'
export const DEFAULT_SHORTCUTS = {
  newNote: { key: 'n', ctrl: true, description: 'New Note' },
  save: { key: 's', ctrl: true, description: 'Save Note' },
  search: { key: 'f', ctrl: true, description: 'Find & Replace' },
  globalSearch: { key: 'k', ctrl: true, description: 'Global Search' },
  focusMode: { key: 'f', ctrl: true, shift: true, description: 'Focus Mode' },
  bold: { key: 'b', ctrl: true, description: 'Bold Text' },
  italic: { key: 'i', ctrl: true, description: 'Italic Text' },
  underline: { key: 'u', ctrl: true, description: 'Underline Text' },
  strikethrough: { key: 'd', ctrl: true, description: 'Strikethrough' },
  link: { key: 'k', ctrl: true, shift: true, description: 'Insert Link' },
  undo: { key: 'z', ctrl: true, description: 'Undo' },
  redo: { key: 'y', ctrl: true, description: 'Redo' },
  heading1: { key: '1', ctrl: true, alt: true, description: 'Heading 1' },
  heading2: { key: '2', ctrl: true, alt: true, description: 'Heading 2' },
  heading3: { key: '3', ctrl: true, alt: true, description: 'Heading 3' },
  bulletList: { key: '8', ctrl: true, shift: true, description: 'Bullet List' },
  numberedList: { key: '7', ctrl: true, shift: true, description: 'Numbered List' },
  taskList: { key: '9', ctrl: true, shift: true, description: 'Task List' },
  codeBlock: { key: 'e', ctrl: true, alt: true, description: 'Code Block' },
  quote: { key: 'q', ctrl: true, shift: true, description: 'Quote' },
  escape: { key: 'Escape', description: 'Close Modal / Exit Focus Mode' },
  delete: { key: 'Delete', ctrl: true, description: 'Delete Note' },
  duplicate: { key: 'd', ctrl: true, shift: true, description: 'Duplicate Note' },
  archive: { key: 'e', ctrl: true, shift: true, description: 'Archive Note' },
  settings: { key: ',', ctrl: true, description: 'Open Settings' },
}
export const loadCustomShortcuts = () => {
  try {
    const saved = localStorage.getItem('quicknotes-shortcuts')
    if (saved) {
      return { ...DEFAULT_SHORTCUTS, ...JSON.parse(saved) }
    }
  } catch (e) {
  }
  return DEFAULT_SHORTCUTS
}
export const saveCustomShortcuts = (shortcuts) => {
  try {
    const customized = {}
    for (const [action, shortcut] of Object.entries(shortcuts)) {
      const defaultShortcut = DEFAULT_SHORTCUTS[action]
      if (defaultShortcut && JSON.stringify(shortcut) !== JSON.stringify(defaultShortcut)) {
        customized[action] = shortcut
      }
    }
    localStorage.setItem('quicknotes-shortcuts', JSON.stringify(customized))
  } catch (e) {
  }
}
export const formatShortcut = (shortcut) => {
  const parts = []
  if (shortcut.ctrl) parts.push('Ctrl')
  if (shortcut.alt) parts.push('Alt')
  if (shortcut.shift) parts.push('Shift')
  
  let keyDisplay = shortcut.key
  if (keyDisplay === ' ') keyDisplay = 'Space'
  else if (keyDisplay === 'Escape') keyDisplay = 'Esc'
  else if (keyDisplay === 'Delete') keyDisplay = 'Del'
  else if (keyDisplay === 'ArrowUp') keyDisplay = '\u2191'
  else if (keyDisplay === 'ArrowDown') keyDisplay = '\u2193'
  else if (keyDisplay === 'ArrowLeft') keyDisplay = '\u2190'
  else if (keyDisplay === 'ArrowRight') keyDisplay = '\u2192'
  else if (keyDisplay.length === 1) keyDisplay = keyDisplay.toUpperCase()
  
  parts.push(keyDisplay)
  return parts.join(' + ')
}
export const matchesShortcut = (event, shortcut) => {
  if (!shortcut) return false
  
  const ctrlMatch = !!shortcut.ctrl === (event.ctrlKey || event.metaKey)
  const altMatch = !!shortcut.alt === event.altKey
  const shiftMatch = !!shortcut.shift === event.shiftKey
  const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase()
  
  return ctrlMatch && altMatch && shiftMatch && keyMatch
}

export default function KeyboardShortcutsModal() {
  const { shortcutsModalOpen, setShortcutsModalOpen } = useUIStore()
  const [shortcuts, setShortcuts] = useState(loadCustomShortcuts())
  const [editingAction, setEditingAction] = useState(null)
  const [recordingKey, setRecordingKey] = useState(null)
  const [conflict, setConflict] = useState(null)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    if (shortcutsModalOpen) {
      setShortcuts(loadCustomShortcuts())
      setEditingAction(null)
      setRecordingKey(null)
      setConflict(null)
      setHasChanges(false)
    }
  }, [shortcutsModalOpen])
  useEffect(() => {
    if (!editingAction) return

    const handleKeyDown = (e) => {
      e.preventDefault()
      e.stopPropagation()
      if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
        return
      }

      const newShortcut = {
        key: e.key,
        ctrl: e.ctrlKey || e.metaKey,
        alt: e.altKey,
        shift: e.shiftKey,
        description: shortcuts[editingAction].description,
      }
      for (const [action, shortcut] of Object.entries(shortcuts)) {
        if (action !== editingAction && 
            shortcut.key?.toLowerCase() === newShortcut.key.toLowerCase() &&
            !!shortcut.ctrl === newShortcut.ctrl &&
            !!shortcut.alt === newShortcut.alt &&
            !!shortcut.shift === newShortcut.shift) {
          setConflict({ action, shortcut })
          setRecordingKey(newShortcut)
          return
        }
      }

      setShortcuts((prev) => ({
        ...prev,
        [editingAction]: newShortcut,
      }))
      setEditingAction(null)
      setRecordingKey(null)
      setConflict(null)
      setHasChanges(true)
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [editingAction, shortcuts])

  const handleSave = () => {
    saveCustomShortcuts(shortcuts)
    setHasChanges(false)
  }

  const handleReset = () => {
    setShortcuts({ ...DEFAULT_SHORTCUTS })
    setHasChanges(true)
  }

  const handleResetSingle = (action) => {
    setShortcuts((prev) => ({
      ...prev,
      [action]: { ...DEFAULT_SHORTCUTS[action] },
    }))
    setHasChanges(true)
  }

  const handleConfirmConflict = () => {
    if (recordingKey && editingAction) {
      const conflictAction = conflict.action
      setShortcuts((prev) => ({
        ...prev,
        [conflictAction]: { ...prev[conflictAction], key: '', ctrl: false, alt: false, shift: false },
        [editingAction]: recordingKey,
      }))
      setEditingAction(null)
      setRecordingKey(null)
      setConflict(null)
      setHasChanges(true)
    }
  }

  const handleCancelConflict = () => {
    setEditingAction(null)
    setRecordingKey(null)
    setConflict(null)
  }

  if (!shortcutsModalOpen) return null

  const categories = [
    {
      name: 'General',
      actions: ['newNote', 'save', 'search', 'globalSearch', 'focusMode', 'settings', 'escape'],
    },
    {
      name: 'Text Formatting',
      actions: ['bold', 'italic', 'underline', 'strikethrough', 'link'],
    },
    {
      name: 'Headings & Blocks',
      actions: ['heading1', 'heading2', 'heading3', 'quote', 'codeBlock'],
    },
    {
      name: 'Lists',
      actions: ['bulletList', 'numberedList', 'taskList'],
    },
    {
      name: 'Note Actions',
      actions: ['delete', 'duplicate', 'archive', 'undo', 'redo'],
    },
  ]

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm modal-backdrop-animate"
        onClick={() => setShortcutsModalOpen(false)}
      />
      <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-[#cbd1db] dark:border-gray-700 w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col modal-animate">
        <div className="flex items-center justify-between p-5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
          <div className="flex items-center gap-3">
            <Keyboard className="w-6 h-6" />
            <div>
              <h2 className="text-lg font-bold">Keyboard Shortcuts</h2>
              <p className="text-sm text-white/70">Click on a shortcut to customize it</p>
            </div>
          </div>
          <button
            onClick={() => setShortcutsModalOpen(false)}
            className="p-2 rounded-full hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {conflict && (
          <div className="mx-6 mt-4 p-4 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-xl">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  This shortcut is already used by <strong>"{conflict.shortcut.description}"</strong>.
                  Do you want to replace it?
                </p>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={handleConfirmConflict}
                    className="px-3 py-1.5 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700"
                  >
                    Replace
                  </button>
                  <button
                    onClick={handleCancelConflict}
                    className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {categories.map((category) => (
            <div key={category.name}>
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                {category.name}
              </h3>
              <div className="space-y-2">
                {category.actions.map((action) => {
                  const shortcut = shortcuts[action]
                  if (!shortcut) return null

                  const isEditing = editingAction === action
                  const isModified = JSON.stringify(shortcut) !== JSON.stringify(DEFAULT_SHORTCUTS[action])

                  return (
                    <div
                      key={action}
                      className={`flex items-center justify-between p-3 rounded-xl transition-colors ${
                        isEditing 
                          ? 'bg-emerald-50 dark:bg-emerald-900/30 ring-2 ring-emerald-500' 
                          : 'bg-gray-50 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      <span className="text-gray-700 dark:text-gray-300">{shortcut.description}</span>
                      <div className="flex items-center gap-2">
                        {isModified && (
                          <button
                            onClick={() => handleResetSingle(action)}
                            className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                            title="Reset to default"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => setEditingAction(isEditing ? null : action)}
                          className={`px-3 py-1.5 rounded-lg font-mono text-sm transition-colors flex items-center gap-2 ${
                            isEditing
                              ? 'bg-emerald-500 text-white animate-pulse'
                              : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
                          }`}
                        >
                          {isEditing ? (
                            <>Press keys...</>
                          ) : (
                            <>
                              {formatShortcut(shortcut)}
                              <Edit3 className="w-3 h-3 opacity-50" />
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between p-6 border-t border-[#cbd1db] dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors border border-[#cbd1db] dark:border-gray-600 rounded-lg"
          >
            <RotateCcw className="w-4 h-4" />
            Reset All to Default
          </button>
          <div className="flex gap-3">
            <button
              onClick={() => setShortcutsModalOpen(false)}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors border border-[#cbd1db] dark:border-gray-600 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!hasChanges}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-colors ${
                hasChanges
                  ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
              }`}
            >
              <Save className="w-4 h-4" />
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
