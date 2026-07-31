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
 * The one tag chip. Used by the note list, the sidebar rail and the editor
 * banner, so a tag looks the same wherever it appears.
 *
 * The hue is carried by a tint and a matching border. It is never used for the
 * label, because the colour is user-chosen and a light label on a light tint of
 * the same hue falls far below WCAG's 4.5:1 — the label always takes a theme
 * text colour instead.
 *
 * `surface` sits on the light panels, `dark` on the rail and the editor banner,
 * where the tint has to be stronger to register against a dark green.
 */
const TAG_SURFACES = {
  surface: { tint: 14, border: 40, text: 'text-content', count: 'text-content-subtle' },
  dark: { tint: 26, border: 55, text: 'text-white', count: 'text-white/60' },
}

export function TagChip({
  name,
  color = '#6b7280',
  count,
  active,
  surface = 'surface',
  as = 'span',
  ...props
}) {
  const Component = as
  const tone = TAG_SURFACES[surface] || TAG_SURFACES.surface
  return (
    <Component
      {...props}
      className={[
        'inline-flex max-w-full items-center gap-1.5 rounded-md border px-2 py-0.5 text-ui-xs font-medium transition-colors duration-fast',
        tone.text,
        active ? 'ring-2 ring-[var(--qn-focus-ring)] ring-offset-1 ring-offset-[var(--qn-surface-panel)]' : '',
        as === 'button' ? 'cursor-pointer hover:brightness-110' : '',
        props.className || '',
      ].join(' ')}
      style={{
        backgroundColor: `color-mix(in srgb, ${color} ${tone.tint}%, transparent)`,
        borderColor: `color-mix(in srgb, ${color} ${tone.border}%, transparent)`,
        ...props.style,
      }}
    >
      <span className="truncate">#{name}</span>
      {count !== undefined && (
        <span className={`shrink-0 tabular-nums ${tone.count}`}>{count}</span>
      )}
    </Component>
  )
}
