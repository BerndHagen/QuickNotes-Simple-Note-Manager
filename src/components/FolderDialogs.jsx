import { useEffect, useRef, useState } from 'react'
import { Check, FolderPlus, Pencil } from 'lucide-react'
import { Modal, Button, Field, Input } from './ui'
import { folderIcons, folderIconNames, folderColors, getFolderIcon } from '../lib/folderIcons'
import { useTranslation } from '../lib/useTranslation'

const DEFAULT_COLOR = '#10b981'
const MAX_NAME_LENGTH = 60

function IconGrid({ value, onChange, labelledBy }) {
  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      className="grid max-h-44 grid-cols-[repeat(auto-fill,minmax(36px,1fr))] gap-1 overflow-y-auto rounded-control border border-subtle bg-surface-sunken p-2"
    >
      {folderIconNames.map((name) => {
        const Icon = folderIcons[name]
        const selected = value === name
        return (
          <button
            key={name}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={name}
            title={name}
            onClick={() => onChange(name)}
            className={`flex aspect-square items-center justify-center rounded-control transition-colors duration-fast ${
              selected
                ? 'bg-accent-soft text-accent-text ring-2 ring-[var(--qn-accent)]'
                : 'text-content-muted hover:bg-surface-hover hover:text-content'
            }`}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
          </button>
        )
      })}
    </div>
  )
}

function ColorGrid({ value, onChange, labelledBy }) {
  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      className="grid grid-cols-[repeat(auto-fill,minmax(28px,1fr))] gap-1.5 rounded-control border border-subtle bg-surface-sunken p-2"
    >
      {folderColors.map((color) => {
        const selected = value === color
        return (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`Colour ${color}`}
            title={color}
            onClick={() => onChange(color)}
            className={`mx-auto flex h-6 w-6 items-center justify-center rounded-full transition-transform duration-fast hover:scale-110 ${
              selected ? 'ring-2 ring-[var(--qn-text)] ring-offset-2 ring-offset-[var(--qn-surface-sunken)]' : ''
            }`}
            style={{ backgroundColor: color }}
          >
            {selected && <Check className="h-3 w-3 text-white drop-shadow" aria-hidden="true" />}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Create / edit folder dialog.
 *
 * Replaces four near-identical hand-rolled overlays (NewFolderModal,
 * EditFolderModal, IconPickerModal, ColorPickerModal — the latter two
 * were never rendered at all).
 */
export function FolderDialog({ open, onClose, folder, onSubmit, existingNames = [] }) {
  const { t } = useTranslation()
  const isEdit = !!folder
  const nameRef = useRef(null)

  const [name, setName] = useState('')
  const [icon, setIcon] = useState('Folder')
  const [color, setColor] = useState(DEFAULT_COLOR)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(folder?.name ?? '')
    setIcon(folder?.icon ?? 'Folder')
    setColor(folder?.color ?? DEFAULT_COLOR)
    setError(null)
    setSubmitting(false)
  }, [open, folder])

  const validate = (candidate) => {
    const trimmed = candidate.trim()
    if (!trimmed) return t('folders.nameRequired', 'Folder name is required')
    if (trimmed.length > MAX_NAME_LENGTH) {
      return `Folder name must be ${MAX_NAME_LENGTH} characters or fewer`
    }
    const clash = existingNames.some(
      (existing) =>
        existing.toLowerCase() === trimmed.toLowerCase() &&
        existing.toLowerCase() !== (folder?.name || '').toLowerCase()
    )
    if (clash) return t('folders.nameExists', 'A folder with this name already exists')
    return null
  }

  const handleSubmit = async (e) => {
    e?.preventDefault()
    if (submitting) return
    const validationError = validate(name)
    if (validationError) {
      setError(validationError)
      nameRef.current?.focus()
      return
    }
    setSubmitting(true)
    try {
      await onSubmit({ name: name.trim(), icon, color })
      onClose()
    } catch (err) {
      setError(err?.message || 'Something went wrong. Please try again.')
      setSubmitting(false)
    }
  }

  const PreviewIcon = getFolderIcon(icon)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? t('folders.editFolder', 'Edit folder') : t('folders.createFolder', 'New folder')}
      description={
        isEdit
          ? t('folders.editFolderDesc', 'Rename this folder or change how it looks.')
          : t('folders.createFolderDesc', 'Group related notes together.')
      }
      icon={isEdit ? Pencil : FolderPlus}
      size="lg"
      initialFocusRef={nameRef}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button variant="primary" onClick={handleSubmit} loading={submitting} icon={Check}>
            {isEdit ? t('common.save', 'Save changes') : t('common.create', 'Create folder')}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="flex items-center gap-3 rounded-card border border-subtle bg-surface-sunken p-3">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control"
            style={{ backgroundColor: color }}
          >
            <PreviewIcon className="h-5 w-5 text-white" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-ui-lg font-medium text-content">
              {name.trim() || t('folders.newFolder', 'New folder')}
            </p>
            <p className="text-ui-sm text-content-subtle">{t('folders.preview', 'Preview')}</p>
          </div>
        </div>

        <Field
          label={t('folders.folderName', 'Folder name')}
          required
          error={error}
          hint={`${name.trim().length}/${MAX_NAME_LENGTH}`}
        >
          {({ id, ...a11y }) => (
            <Input
              {...a11y}
              id={id}
              ref={nameRef}
              data-autofocus
              value={name}
              maxLength={MAX_NAME_LENGTH + 20}
              onChange={(e) => {
                setName(e.target.value)
                if (error) setError(null)
              }}
              placeholder={t('folders.folderName', 'Folder name')}
              autoComplete="off"
            />
          )}
        </Field>

        <div className="flex flex-col gap-1.5">
          <span id="folder-icon-label" className="text-ui-sm font-medium text-content-muted">
            {t('folders.chooseIcon', 'Icon')}
          </span>
          <IconGrid value={icon} onChange={setIcon} labelledBy="folder-icon-label" />
        </div>

        <div className="flex flex-col gap-1.5">
          <span id="folder-color-label" className="text-ui-sm font-medium text-content-muted">
            {t('folders.chooseColor', 'Colour')}
          </span>
          <ColorGrid value={color} onChange={setColor} labelledBy="folder-color-label" />
        </div>

        {/* Enables Enter-to-submit without a visible duplicate button. */}
        <button type="submit" className="hidden" tabIndex={-1} aria-hidden="true" />
      </form>
    </Modal>
  )
}

/** Generic destructive confirmation — replaces bare `window.confirm`. */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  tone = 'danger',
  icon,
}) {
  const [busy, setBusy] = useState(false)
  const confirmRef = useRef(null)

  useEffect(() => {
    if (open) setBusy(false)
  }, [open])

  const handleConfirm = async () => {
    if (busy) return
    setBusy(true)
    try {
      await onConfirm()
      onClose()
    } catch {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      icon={icon}
      size="sm"
      initialFocusRef={confirmRef}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            ref={confirmRef}
            variant={tone === 'danger' ? 'danger' : 'primary'}
            onClick={handleConfirm}
            loading={busy}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-ui-md text-content-muted">
        {description ? null : 'This action cannot be undone.'}
      </p>
    </Modal>
  )
}
