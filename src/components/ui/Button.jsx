import { forwardRef } from 'react'
import { Loader2 } from 'lucide-react'

const VARIANTS = {
  primary:
    'bg-accent text-accent-on hover:bg-accent-hover active:bg-accent-active shadow-xs disabled:bg-[var(--qn-border-strong)] disabled:text-content-subtle disabled:shadow-none',
  secondary:
    'bg-surface-raised text-content border border-strong hover:bg-surface-hover active:bg-surface-active disabled:text-content-subtle',
  subtle:
    'bg-surface-sunken text-content hover:bg-surface-hover active:bg-surface-active disabled:text-content-subtle',
  ghost:
    'text-content-muted hover:bg-surface-hover hover:text-content active:bg-surface-active disabled:text-content-subtle',
  danger:
    'bg-danger text-white hover:brightness-95 active:brightness-90 shadow-xs disabled:bg-[var(--qn-border-strong)] disabled:text-content-subtle disabled:shadow-none',
  'danger-ghost':
    'text-danger-text hover:bg-danger-soft active:bg-danger-soft disabled:text-content-subtle',
}

const SIZES = {
  sm: 'h-control-sm px-2.5 gap-1.5 text-ui-sm rounded-control',
  md: 'h-control-md px-3.5 gap-2 text-ui-md rounded-control',
  lg: 'h-control-lg px-5 gap-2 text-ui-lg rounded-control',
}

const ICON_SIZES = { sm: 'h-3.5 w-3.5', md: 'h-4 w-4', lg: 'h-[18px] w-[18px]' }

/**
 * The class string behind <Button>, exported so a control that cannot be the
 * component — one wrapped in a form row, or carrying its own layout — can use
 * the same variants and control sizing.
 */
export function buttonClasses({ variant = 'secondary', size = 'md', fullWidth = false } = {}) {
  return [
    'qn-touch-target inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap font-medium',
    'transition-[background-color,color,box-shadow,filter] duration-fast ease-qn',
    'disabled:cursor-not-allowed',
    VARIANTS[variant] || VARIANTS.secondary,
    SIZES[size] || SIZES.md,
    fullWidth ? 'w-full' : '',
  ].join(' ')
}

/**
 * The app's standard button. `loading` implies `disabled`, so a form
 * cannot be submitted twice while a request is in flight.
 */
const Button = forwardRef(function Button(
  {
    variant = 'secondary',
    size = 'md',
    icon: Icon,
    iconRight: IconRight,
    loading = false,
    disabled = false,
    fullWidth = false,
    className = '',
    children,
    type = 'button',
    ...props
  },
  ref
) {
  const iconClass = ICON_SIZES[size] || ICON_SIZES.md
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={[
        'qn-touch-target inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap font-medium',
        'transition-[background-color,color,box-shadow,filter] duration-fast ease-qn',
        'disabled:cursor-not-allowed',
        VARIANTS[variant] || VARIANTS.secondary,
        SIZES[size] || SIZES.md,
        fullWidth ? 'w-full' : '',
        className,
      ].join(' ')}
      {...props}
    >
      {loading ? (
        <Loader2 className={`${iconClass} animate-spin`} aria-hidden="true" />
      ) : (
        Icon && <Icon className={iconClass} aria-hidden="true" />
      )}
      {children}
      {IconRight && !loading && <IconRight className={iconClass} aria-hidden="true" />}
    </button>
  )
})

export default Button

const ICON_BUTTON_SIZES = {
  sm: 'h-control-sm w-control-sm rounded-control',
  md: 'h-control-md w-control-md rounded-control',
  lg: 'h-control-lg w-control-lg rounded-control',
}

/**
 * Colour treatments that replace the variant entirely, never combine with
 * one: a variant and a tone both emit `.text-*` utilities, and emitting
 * both leaves the winner up to stylesheet order rather than intent.
 */
const TONES = {
  onBanner: {
    base: 'text-banner-muted hover:bg-banner-hover hover:text-banner-text',
    active: 'bg-banner-hover text-banner-text',
  },
}

/**
 * Square icon-only button. `label` is required — it becomes both the
 * accessible name and the tooltip, so no icon control ships nameless.
 */
export const IconButton = forwardRef(function IconButton(
  {
    icon: Icon,
    label,
    variant = 'ghost',
    size = 'md',
    active = false,
    loading = false,
    disabled = false,
    className = '',
    tone,
    ...props
  },
  ref
) {
  const iconClass = ICON_SIZES[size] || ICON_SIZES.md
  const toneStyles = TONES[tone]

  const colourClasses = toneStyles
    ? active
      ? toneStyles.active
      : toneStyles.base
    : active
      ? 'bg-accent-soft text-accent-text'
      : VARIANTS[variant] || VARIANTS.ghost

  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={
        typeof props['aria-pressed'] === 'boolean' ? props['aria-pressed'] : active || undefined
      }
      disabled={disabled || loading}
      className={[
        'qn-square-control inline-flex shrink-0 items-center justify-center transition-colors duration-fast ease-qn',
        'disabled:cursor-not-allowed disabled:opacity-50',
        colourClasses,
        ICON_BUTTON_SIZES[size] || ICON_BUTTON_SIZES.md,
        className,
      ].join(' ')}
      {...props}
    >
      {loading ? (
        <Loader2 className={`${iconClass} animate-spin`} aria-hidden="true" />
      ) : (
        <Icon className={iconClass} aria-hidden="true" />
      )}
    </button>
  )
})
