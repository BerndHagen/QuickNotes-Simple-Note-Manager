const TONES = {
  neutral: 'bg-surface-sunken text-content-muted border-subtle',
  accent: 'bg-accent-soft text-accent-text border-[var(--qn-accent-border)]',
  danger: 'bg-danger-soft text-danger-text border-[var(--qn-danger-border)]',
  warning: 'bg-warning-soft text-warning-text border-[var(--qn-warning-border)]',
  success: 'bg-success-soft text-success-text border-[var(--qn-success-border)]',
  info: 'bg-info-soft text-info-text border-[var(--qn-info-border)]',
}

export function Badge({ tone = 'neutral', icon: Icon, children, className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-ui-xs font-medium ${TONES[tone] || TONES.neutral} ${className}`}
    >
      {Icon && <Icon className="h-3 w-3" aria-hidden="true" />}
      {children}
    </span>
  )
}

/** Right-aligned numeric badge used throughout the sidebar navigation. */
export function CountBadge({ value, tone = 'neutral', className = '' }) {
  if (value === 0 || value === null || value === undefined) return null
  return (
    <span
      className={`min-w-[20px] rounded-full px-1.5 py-0.5 text-center text-ui-xs font-medium tabular-nums ${
        tone === 'accent'
          ? 'bg-accent-soft text-accent-text'
          : tone === 'danger'
            ? 'bg-danger-soft text-danger-text'
            : tone === 'warning'
              ? 'bg-warning-soft text-warning-text'
              : 'bg-surface-sunken text-content-subtle'
      } ${className}`}
    >
      {value > 999 ? '999+' : value}
    </span>
  )
}

/**
 * Tag pill.
 *
 * The tag colour is user-chosen, so it can never be relied on for text
 * contrast — a light green label on a light green tint measured 1.94:1
 * against WCAG's 4.5:1 requirement. The colour is therefore carried by a
 * dot and the border, while the label itself uses the standard text
 * colour. That keeps the colour as an identity cue without making it the
 * only cue, and keeps every tag readable whatever colour is picked.
 */
export function TagChip({ name, color = '#6b7280', count, active, as = 'span', ...props }) {
  const Component = as
  return (
    <Component
      {...props}
      className={[
        'inline-flex max-w-full items-center gap-1.5 rounded-full border px-2 py-0.5 text-ui-xs font-medium text-content transition-colors duration-fast',
        active
          ? 'ring-2 ring-[var(--qn-focus-ring)] ring-offset-1 ring-offset-[var(--qn-surface-panel)]'
          : '',
        as === 'button' ? 'cursor-pointer hover:bg-surface-hover' : '',
        props.className || '',
      ].join(' ')}
      style={{
        backgroundColor: `color-mix(in srgb, ${color} 10%, transparent)`,
        borderColor: `color-mix(in srgb, ${color} 35%, transparent)`,
        ...props.style,
      }}
    >
      <span
        aria-hidden="true"
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="truncate">{name}</span>
      {count !== undefined && (
        <span className="shrink-0 tabular-nums text-content-subtle">{count}</span>
      )}
    </Component>
  )
}
