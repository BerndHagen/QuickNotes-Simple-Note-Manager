import { useId } from 'react'
import { MAX_NOTE_TITLE_LENGTH } from '../../lib/dataValidation'

export default function FocusedNoteTitle({
  typeLabel,
  title,
  fallback,
  onChange,
  readOnly = false,
}) {
  const id = useId()

  return (
    <div className="qn-focused-note-title min-w-0">
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
          className="qn-focused-title w-full truncate border-0 bg-transparent p-0 text-title-md font-semibold leading-tight text-content outline-none placeholder:text-content-subtle focus:ring-0"
        />
      </div>
    </div>
  )
}
