import { useEffect, useId, useRef, useState } from 'react'
import { Check, FolderPlus, Pencil } from 'lucide-react'
import { Modal, Button, Field, Input } from './ui'
import { folderIcons, folderIconNames, folderColors, getFolderIcon } from '../lib/folderIcons'
import { useTranslation } from '../lib/useTranslation'

const DEFAULT_COLOR = '#10b981'
const MAX_NAME_LENGTH = 60

function handleRadioNavigation(event, values, index, onChange) {
  let nextIndex
  if (event.key === 'Home') nextIndex = 0
  else if (event.key === 'End') nextIndex = values.length - 1
  else if (['ArrowRight', 'ArrowDown'].includes(event.key)) nextIndex = (index + 1) % values.length
  else if (['ArrowLeft', 'ArrowUp'].includes(event.key)) nextIndex = (index - 1 + values.length) % values.length
  else return

  event.preventDefault()
  onChange(values[nextIndex])
  event.currentTarget.parentElement?.querySelectorAll('[role="radio"]')[nextIndex]?.focus()
}

function IconGrid({ value, onChange, labelledBy }) {
  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      className="grid max-h-52 grid-cols-[repeat(auto-fill,minmax(44px,1fr))] gap-1 overflow-y-auto rounded-control border border-subtle bg-surface-sunken p-2"
    >
      {folderIconNames.map((name, index) => {
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
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(name)}
            onKeyDown={(event) => handleRadioNavigation(event, folderIconNames, index, onChange)}
            className={`qn-square-control flex aspect-square items-center justify-center rounded-control transition-colors duration-fast ${
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
      className="grid grid-cols-[repeat(auto-fill,minmax(44px,1fr))] gap-1 rounded-control border border-subtle bg-surface-sunken p-2"
    >
      {folderColors.map((color, index) => {
        const selected = value === color
        return (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`Colour ${color}`}
            title={color}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(color)}
            onKeyDown={(event) => handleRadioNavigation(event, folderColors, index, onChange)}
            className="qn-folder-colour flex h-11 w-11 items-center justify-center rounded-full transition-transform duration-fast hover:scale-105"
          >
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full ${
                selected
                  ? 'ring-2 ring-[var(--qn-text)] ring-offset-2 ring-offset-[var(--qn-surface-sunken)]'
                  : ''
              }`}
              style={{ backgroundColor: color }}
            >
              {selected && <Check className="h-3 w-3 text-white drop-shadow" aria-hidden="true" />}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/**
 * Create / edit folder dialog, including the icon and colour pickers.
 *
 * Pass a `folder` to edit it, or omit it to create a new one.
 */
export function FolderDialog({ open, onClose, folder, onSubmit, existingNames = [] }) {
  const { t } = useTranslation()
  const isEdit = !!folder
  const nameRef = useRef(null)
  const iconLabelId = useId()
  const colorLabelId = useId()

  const [name, setName] = useState('')
  const [icon, setIcon] = useState('Folder')
  const [color, setColor] = useState(DEFAULT_COLOR)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(typeof folder?.name === 'string' ? folder.name : '')
    setIcon(folderIconNames.includes(folder?.icon) ? folder.icon : 'Folder')
    setColor(folderColors.includes(folder?.color) ? folder.color : DEFAULT_COLOR)
    setError(null)
    setSubmitting(false)
  }, [open, folder])

  const validate = (candidate) => {
    const trimmed = candidate.trim()
    if (!trimmed) return t('folders.nameRequired', 'Folder name is required')
    if (trimmed.length > MAX_NAME_LENGTH) {
      return `Folder name must be ${MAX_NAME_LENGTH} characters or fewer`
    }
    const clash = (Array.isArray(existingNames) ? existingNames : []).some(
      (existing) =>
        typeof existing === 'string' &&
        existing.trim().toLowerCase() === trimmed.toLowerCase() &&
        existing.trim().toLowerCase() !== String(folder?.name || '').trim().toLowerCase()
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
          <span id={iconLabelId} className="text-ui-sm font-medium text-content-muted">
            {t('folders.chooseIcon', 'Icon')}
          </span>
          <IconGrid value={icon} onChange={setIcon} labelledBy={iconLabelId} />
        </div>

        <div className="flex flex-col gap-1.5">
          <span id={colorLabelId} className="text-ui-sm font-medium text-content-muted">
            {t('folders.chooseColor', 'Colour')}
          </span>
          <ColorGrid value={color} onChange={setColor} labelledBy={colorLabelId} />
        </div>

        {/* Enables Enter-to-submit without a visible duplicate button. */}
        <button type="submit" className="hidden" tabIndex={-1} aria-hidden="true" />
      </form>
    </Modal>
  )
}

/** Generic destructive-action confirmation dialog. */
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
  const [error, setError] = useState('')
  const confirmRef = useRef(null)

  useEffect(() => {
    if (open) {
      setBusy(false)
      setError('')
    }
  }, [open])

  const handleConfirm = async () => {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await onConfirm()
      onClose()
    } catch (confirmationError) {
      setError(confirmationError?.message || 'The action could not be completed. Please try again.')
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
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
      {!description && <p className="text-ui-md text-content-muted">This action cannot be undone.</p>}
      {error && (
        <p role="alert" className="rounded-control border border-danger-border bg-danger-soft px-3 py-2.5 text-ui-md text-danger-text">
          {error}
        </p>
      )}
    </Modal>
  )
}
