import { useId } from 'react'
import { MAX_NOTE_TITLE_LENGTH } from '../../lib/dataValidation'

export default function FocusedNoteTitle({
  icon: Icon,
  typeLabel,
  title,
  fallback,
  onChange,
  readOnly = false,
}) {
  const id = useId()

  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="qn-focused-type-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-control border border-accent-border bg-accent-soft text-accent-text">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <label
          htmlFor={id}
          className="qn-focused-type-label block text-ui-2xs font-semibold uppercase tracking-[0.12em] text-content-subtle"
        >
          {typeLabel}
        </label>
        <input
          id={id}
          type="text"
          maxLength={MAX_NOTE_TITLE_LENGTH}
          value={title || ''}
          onChange={onChange}
          readOnly={readOnly}
          placeholder={fallback}
          className="qn-focused-title mt-0.5 w-full truncate border-0 bg-transparent p-0 text-title-lg font-semibold leading-tight text-content outline-none placeholder:text-content-subtle focus:ring-0"
        />
      </div>
    </div>
  )
}
