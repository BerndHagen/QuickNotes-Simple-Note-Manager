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
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-white/15 bg-white/10 text-white">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <label
          htmlFor={id}
          className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-white/60"
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
          className="qn-focused-title mt-0.5 w-full truncate border-0 bg-transparent p-0 text-2xl font-bold leading-tight text-white outline-none placeholder:text-white/55 focus:ring-0"
        />
      </div>
    </div>
  )
}
