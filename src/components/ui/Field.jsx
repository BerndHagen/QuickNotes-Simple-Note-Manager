import { forwardRef, useId } from 'react'
import { AlertCircle } from 'lucide-react'

/**
 * Label + control + hint/error wrapper.
 *
 * Wires `htmlFor`/`id`, `aria-describedby` and `aria-invalid` for you so
 * form controls cannot ship without an accessible name or an announced
 * error — both were missing across the existing dialogs.
 */
export function Field({ label, hint, error, required, children, className = '', htmlFor }) {
  const generatedId = useId()
  const id = htmlFor || generatedId
  const hintId = `${id}-hint`
  const errorId = `${id}-error`

  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ')

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label htmlFor={id} className="text-ui-sm font-medium text-content-muted">
          {label}
          {required && (
            <span className="ml-0.5 text-danger-text" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      {typeof children === 'function'
        ? children({ id, 'aria-describedby': describedBy || undefined, 'aria-invalid': !!error })
        : children}
      {error ? (
        <p id={errorId} role="alert" className="flex items-center gap-1.5 text-ui-sm text-danger-text">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-ui-sm text-content-subtle">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

const inputBase =
  'w-full bg-surface-raised text-content placeholder:text-content-subtle border border-strong rounded-control ' +
  'transition-[border-color,box-shadow] duration-fast ease-qn ' +
  'focus:outline-none focus:border-accent focus:ring-2 focus:ring-[var(--qn-accent-soft)] ' +
  'disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-content-subtle ' +
  'aria-[invalid=true]:border-danger aria-[invalid=true]:focus:ring-[var(--qn-danger-soft)]'

export const Input = forwardRef(function Input({ className = '', size = 'md', ...props }, ref) {
  const sizing = size === 'sm' ? 'h-control-sm px-2.5 text-ui-sm' : 'h-control-md px-3 text-ui-md'
  return <input ref={ref} className={`${inputBase} ${sizing} ${className}`} {...props} />
})

export const Textarea = forwardRef(function Textarea({ className = '', rows = 4, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={`${inputBase} resize-y px-3 py-2 text-ui-md leading-relaxed ${className}`}
      {...props}
    />
  )
})

export const Select = forwardRef(function Select({ className = '', children, ...props }, ref) {
  return (
    <select
      ref={ref}
      className={`${inputBase} h-control-md cursor-pointer px-3 pr-8 text-ui-md ${className}`}
      {...props}
    >
      {children}
    </select>
  )
})

/**
 * Switch-style boolean control. Renders a real checkbox input so it is
 * reachable by keyboard and announced correctly; the visual track is
 * decorative.
 */
export function Toggle({ checked, onChange, label, description, disabled, id: providedId }) {
  const generatedId = useId()
  const id = providedId || generatedId
  const descId = `${id}-desc`

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className="block cursor-pointer text-ui-lg font-medium text-content">
          {label}
        </label>
        {description && (
          <p id={descId} className="mt-0.5 text-ui-md text-content-muted">
            {description}
          </p>
        )}
      </div>
      <label className="relative mt-0.5 inline-flex shrink-0 cursor-pointer items-center">
        <input
          id={id}
          type="checkbox"
          role="switch"
          className="peer sr-only"
          checked={!!checked}
          disabled={disabled}
          aria-describedby={description ? descId : undefined}
          onChange={(e) => onChange?.(e.target.checked)}
        />
        <span
          aria-hidden="true"
          className="h-5 w-9 rounded-full bg-[var(--qn-border-strong)] transition-colors duration-fast peer-checked:bg-accent peer-disabled:opacity-50 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--qn-focus-ring)]"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-0.5 h-4 w-4 rounded-full bg-white shadow-xs transition-transform duration-fast ease-qn peer-checked:translate-x-4"
        />
      </label>
    </div>
  )
}

/** Segmented single-choice control — replaces ad-hoc radio button rows. */
export function SegmentedControl({ value, onChange, options, label, size = 'md' }) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex w-full gap-1 rounded-control border border-subtle bg-surface-sunken p-1"
    >
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={[
              'flex-1 rounded-[calc(var(--qn-radius-control)-2px)] px-2.5 font-medium transition-colors duration-fast',
              size === 'sm' ? 'h-6 text-ui-xs' : 'h-7 text-ui-sm',
              selected
                ? 'bg-surface-raised text-content shadow-xs'
                : 'text-content-muted hover:text-content',
            ].join(' ')}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
