import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, Keyboard, Lock, RotateCcw, Save } from 'lucide-react'
import { useUIStore } from '../store'
import { useTranslation } from '../lib/useTranslation'
import { useMediaQuery } from '../hooks/useBreakpoint'
import {
  DEFAULT_SHORTCUTS,
  formatShortcut,
  isCustomisable,
  loadShortcuts,
  saveShortcuts,
} from '../lib/shortcuts'
import { Modal, Button, IconButton } from './ui'

const CATEGORIES = [
  {
    id: 'workspace',
    name: 'Workspace',
    actions: [
      'newNote',
      'globalSearch',
      'findReplace',
      'toggleSidebar',
      'focusMode',
      'settings',
      'shortcuts',
    ],
  },
  {
    id: 'notes',
    name: 'Note actions',
    actions: ['templates', 'duplicate', 'archive', 'insertLink', 'export', 'import'],
  },
  {
    id: 'formatting',
    name: 'Text formatting',
    actions: ['bold', 'italic', 'underline', 'strikethrough', 'undo', 'redo'],
  },
  {
    id: 'blocks',
    name: 'Headings, lists & blocks',
    actions: [
      'heading1',
      'heading2',
      'heading3',
      'bulletList',
      'numberedList',
      'taskList',
      'quote',
      'codeBlock',
    ],
  },
]

const sameBinding = (a, b) =>
  a?.key?.toLowerCase() === b?.key?.toLowerCase() &&
  !!a?.ctrl === !!b?.ctrl &&
  !!a?.alt === !!b?.alt &&
  !!a?.shift === !!b?.shift

export default function KeyboardShortcutsModal() {
  const { shortcutsModalOpen, setShortcutsModalOpen } = useUIStore()
  const { t } = useTranslation()
  const hasTouchInput = useMediaQuery('(hover: none), (pointer: coarse), (any-pointer: coarse)')

  const [shortcuts, setShortcuts] = useState(() => loadShortcuts())
  const [recording, setRecording] = useState(null)
  const [conflict, setConflict] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const firstFieldRef = useRef(null)

  useEffect(() => {
    if (!shortcutsModalOpen) return
    setShortcuts(loadShortcuts())
    setRecording(null)
    setConflict(null)
    setDirty(false)
    setSaved(false)
    setSaveError('')
  }, [shortcutsModalOpen])

  useEffect(() => {
    if (!recording || conflict) return

    const onKeyDown = (e) => {
      e.preventDefault()
      e.stopPropagation()
      if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return
      if (e.key === 'Escape') {
        setRecording(null)
        return
      }

      const candidate = {
        ...shortcuts[recording],
        key: e.key,
        ctrl: e.ctrlKey || e.metaKey,
        alt: e.altKey,
        shift: e.shiftKey,
      }

      const clash = Object.entries(shortcuts).find(
        ([action, shortcut]) => action !== recording && sameBinding(shortcut, candidate)
      )
      if (clash) {
        setConflict({ action: clash[0], candidate })
        return
      }

      if (sameBinding(shortcuts[recording], candidate)) {
        setRecording(null)
        return
      }

      setShortcuts((prev) => ({ ...prev, [recording]: candidate }))
      setRecording(null)
      setDirty(true)
      setSaved(false)
      setSaveError('')
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [conflict, recording, shortcuts])

  const modifiedCount = useMemo(
    () =>
      Object.entries(shortcuts).filter(
        ([action, shortcut]) =>
          isCustomisable(action) && !sameBinding(shortcut, DEFAULT_SHORTCUTS[action])
      ).length,
    [shortcuts]
  )

  const handleSave = () => {
    try {
      saveShortcuts(shortcuts)
      setDirty(false)
      setSaved(true)
      setSaveError('')
    } catch {
      setSaved(false)
      setSaveError('Keyboard shortcuts could not be saved in this browser. Your changes have not been applied.')
    }
  }

  const resolveConflict = () => {
    // Clearing the clashing binding leaves that action unbound rather
    // than silently giving two actions the same keys.
    setShortcuts((prev) => ({
      ...prev,
      [conflict.action]: {
        ...prev[conflict.action],
        key: '',
        ctrl: false,
        alt: false,
        shift: false,
      },
      [recording]: conflict.candidate,
    }))
    setConflict(null)
    setRecording(null)
    setDirty(true)
    setSaved(false)
    setSaveError('')
  }

  return (
    <Modal
      open={shortcutsModalOpen}
      onClose={() => setShortcutsModalOpen(false)}
      title={t('sidebar.shortcuts', 'Keyboard shortcuts')}
      description="View and customise shortcuts for this device."
      icon={Keyboard}
      size="xl"
      initialFocusRef={firstFieldRef}
      footer={
        <>
          <Button
            variant="ghost"
            icon={RotateCcw}
            className="sm:mr-auto"
            disabled={modifiedCount === 0}
            onClick={() => {
              setShortcuts({ ...DEFAULT_SHORTCUTS })
              setDirty(true)
              setSaved(false)
              setSaveError('')
            }}
          >
            Reset all
          </Button>
          <Button variant="primary" icon={Save} disabled={!dirty} onClick={handleSave}>
            {saved ? 'Saved' : 'Save changes'}
          </Button>
        </>
      }
    >
      {hasTouchInput && (
        <div className="mb-4 rounded-card border border-[var(--qn-info-border)] bg-info-soft p-3 text-ui-md leading-relaxed text-info-text">
          Keyboard shortcuts work when a hardware keyboard is connected. Apple devices use the Command key where Windows and Linux use Ctrl.
        </div>
      )}

      {conflict && (
        <div
          role="alert"
          className="mb-4 flex gap-2.5 rounded-card border border-[var(--qn-warning-border)] bg-warning-soft p-3"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning-text" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-ui-md text-warning-text">
              <strong>{formatShortcut(conflict.candidate)}</strong> is already used by{' '}
              <strong>{DEFAULT_SHORTCUTS[conflict.action]?.description}</strong>. Reassigning it
              leaves that action without a shortcut.
            </p>
            <div className="mt-2.5 flex gap-2">
              <Button size="sm" variant="primary" onClick={resolveConflict}>
                Reassign
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setConflict(null)
                  setRecording(null)
                }}
              >
                {t('common.cancel', 'Cancel')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {saveError && (
        <div
          role="alert"
          className="mb-4 flex gap-2.5 rounded-card border border-danger-border bg-danger-soft p-3 text-danger-text"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p className="text-ui-md">{saveError}</p>
        </div>
      )}

      <div className="space-y-6">
        {CATEGORIES.map((category, categoryIndex) => (
          <section key={category.id}>
            <h3 className="mb-2 text-ui-xs font-semibold uppercase tracking-wide text-content-muted">
              {category.name}
            </h3>
            <ul className="divide-y divide-[var(--qn-border-subtle)] overflow-hidden rounded-card border border-subtle">
              {category.actions.map((action, actionIndex) => {
                const shortcut = shortcuts[action]
                if (!shortcut) return null
                const editable = isCustomisable(action)
                const isRecording = recording === action
                const modified = editable && !sameBinding(shortcut, DEFAULT_SHORTCUTS[action])

                return (
                  <li
                    key={action}
                    className="flex flex-col items-stretch gap-2 bg-surface-raised px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                  >
                    <span className="min-w-0 flex-1 text-ui-md text-content">
                      {shortcut.description}
                    </span>
                    <span className="flex shrink-0 items-center justify-end gap-1.5">
                      {modified && (
                        <IconButton
                          icon={RotateCcw}
                          size="sm"
                          label={`Reset ${shortcut.description} to default`}
                          onClick={() => {
                            setShortcuts((prev) => ({
                              ...prev,
                              [action]: { ...DEFAULT_SHORTCUTS[action] },
                            }))
                            setDirty(true)
                            setSaved(false)
                            setSaveError('')
                          }}
                        />
                      )}
                      {editable ? (
                        <button
                          ref={categoryIndex === 0 && actionIndex === 0 ? firstFieldRef : undefined}
                          type="button"
                          disabled={!!conflict}
                          onClick={() => setRecording(isRecording ? null : action)}
                          aria-label={`Change shortcut for ${shortcut.description}. Currently ${formatShortcut(shortcut)}`}
                          aria-pressed={isRecording}
                          className={`min-w-[108px] rounded-control px-2.5 py-1 font-mono text-ui-sm transition-colors duration-fast disabled:cursor-not-allowed disabled:opacity-60 ${
 isRecording
 ? 'bg-accent text-accent-on'
                              : 'bg-surface-sunken text-content hover:bg-surface-hover'
                          }`}
                        >
                          {isRecording ? 'Press keys…' : formatShortcut(shortcut)}
                        </button>
                      ) : (
                        <span
                          title="Provided by the editor and not rebindable"
                          className="inline-flex min-w-[108px] items-center justify-center gap-1.5 rounded-control bg-surface-sunken px-2.5 py-1 font-mono text-ui-sm text-content-muted"
                        >
                          <Lock className="h-3 w-3 opacity-60" aria-hidden="true" />
                          {formatShortcut(shortcut)}
                        </span>
                      )}
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>
    </Modal>
  )
}
