import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useEscapeKey, getFocusable } from './useFocusTrap'

const VIEWPORT_PADDING = 8

/**
 * Positions a floating panel against an anchor rect and keeps it inside
 * the viewport.
 *
 * The position is recomputed on scroll, resize and zoom rather than read
 * once during render, so a panel cannot drift away from its anchor or be
 * clipped off the edge of a narrow screen.
 */
export function useAnchoredPosition({ anchorRef, open, placement = 'bottom-start', offset = 6, point }) {
  const floatingRef = useRef(null)
  const [style, setStyle] = useState({ visibility: 'hidden', left: 0, top: 0 })

  const compute = useCallback(() => {
    const floating = floatingRef.current
    if (!floating) return

    const vw = document.documentElement.clientWidth
    const vh = document.documentElement.clientHeight
    const rect = point
      ? { top: point.y, bottom: point.y, left: point.x, right: point.x, width: 0, height: 0 }
      : anchorRef?.current?.getBoundingClientRect()
    if (!rect) return

    // Measure without constraints first, then clamp.
    const fw = floating.offsetWidth
    const fh = floating.scrollHeight

    const spaceBelow = vh - rect.bottom - offset - VIEWPORT_PADDING
    const spaceAbove = rect.top - offset - VIEWPORT_PADDING
    const preferTop = placement.startsWith('top')
    const openUp = preferTop ? spaceAbove >= Math.min(fh, 200) : fh > spaceBelow && spaceAbove > spaceBelow

    const maxHeight = Math.max(140, openUp ? spaceAbove : spaceBelow)
    const top = openUp
      ? Math.max(VIEWPORT_PADDING, rect.top - offset - Math.min(fh, maxHeight))
      : Math.min(rect.bottom + offset, vh - VIEWPORT_PADDING - Math.min(fh, maxHeight))

    const alignEnd = placement.endsWith('end')
    let left = alignEnd ? rect.right - fw : rect.left
    left = Math.min(left, vw - fw - VIEWPORT_PADDING)
    left = Math.max(VIEWPORT_PADDING, left)

    setStyle({
      position: 'fixed',
      left,
      top,
      maxHeight,
      maxWidth: vw - VIEWPORT_PADDING * 2,
      visibility: 'visible',
    })
  }, [anchorRef, offset, placement, point])

  useLayoutEffect(() => {
    if (!open) {
      setStyle((s) => ({ ...s, visibility: 'hidden' }))
      return
    }
    compute()
  }, [open, compute])

  useEffect(() => {
    if (!open) return
    const handler = () => compute()
    window.addEventListener('resize', handler)
    // `true` → capture, so scrolling any ancestor repositions the panel.
    window.addEventListener('scroll', handler, true)
    return () => {
      window.removeEventListener('resize', handler)
      window.removeEventListener('scroll', handler, true)
    }
  }, [open, compute])

  return { floatingRef, style }
}

/**
 * Portal-rendered dropdown with arrow-key roving focus, Escape to close,
 * and click-outside dismissal.
 */
export function Menu({
  open,
  onClose,
  anchorRef,
  point,
  placement = 'bottom-start',
  label,
  children,
  className = '',
  width,
}) {
  const { floatingRef, style } = useAnchoredPosition({ anchorRef, open, placement, point })
  const focusBeforeOpenRef = useRef(null)

  useEffect(() => {
    if (open) focusBeforeOpenRef.current = document.activeElement
  }, [open])

  const closeFromEscape = useCallback(() => {
    const focusTarget = anchorRef?.current || focusBeforeOpenRef.current
    onClose?.()
    requestAnimationFrame(() => {
      if (focusTarget instanceof HTMLElement && document.contains(focusTarget)) {
        focusTarget.focus({ preventScroll: true })
      }
    })
  }, [anchorRef, onClose])

  useEscapeKey(open, closeFromEscape)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e) => {
      if (floatingRef.current?.contains(e.target)) return
      if (anchorRef?.current?.contains(e.target)) return
      onClose?.()
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open, onClose, anchorRef, floatingRef])

  useEffect(() => {
    if (!open) return
    const node = floatingRef.current
    if (!node) return
    const frame = requestAnimationFrame(() => getFocusable(node)[0]?.focus({ preventScroll: true }))

    const onKeyDown = (e) => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return
      const items = getFocusable(node)
      if (!items.length) return
      e.preventDefault()
      const index = items.indexOf(document.activeElement)
      const next =
        e.key === 'Home'
          ? 0
          : e.key === 'End'
            ? items.length - 1
            : e.key === 'ArrowDown'
              ? (index + 1) % items.length
              : (index - 1 + items.length) % items.length
      items[next].focus()
    }

    node.addEventListener('keydown', onKeyDown)
    return () => {
      cancelAnimationFrame(frame)
      node.removeEventListener('keydown', onKeyDown)
    }
  }, [open, floatingRef])

  if (!open) return null

  return createPortal(
    <div
      ref={floatingRef}
      role="menu"
      aria-label={label}
      style={{ ...style, width }}
      className={`qn-menu z-dropdown overflow-y-auto overscroll-contain rounded-card border border-subtle bg-surface-raised p-1 shadow-lg animate-menu-in ${className}`}
    >
      {children}
    </div>,
    document.body
  )
}

export function MenuItem({
  icon: Icon,
  children,
  onClick,
  tone = 'default',
  shortcut,
  trailing,
  disabled,
  selected,
  ...props
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      aria-current={selected || undefined}
      onClick={onClick}
      className={[
        'flex w-full items-center gap-2.5 rounded-control px-2.5 py-2 text-left text-ui-md transition-colors duration-fast',
        'disabled:cursor-not-allowed disabled:opacity-50',
        tone === 'danger'
          ? 'text-danger-text hover:bg-danger-soft'
          : selected
            ? 'bg-accent-soft text-accent-text'
            : 'text-content hover:bg-surface-hover',
      ].join(' ')}
      {...props}
    >
      {Icon && <Icon className="h-4 w-4 shrink-0 opacity-70" aria-hidden="true" />}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {shortcut && <kbd className="shrink-0 text-ui-xs text-content-subtle">{shortcut}</kbd>}
      {trailing}
    </button>
  )
}

export function MenuSeparator() {
  return <div role="separator" className="my-1 h-px bg-[var(--qn-border-subtle)]" />
}

export function MenuLabel({ children }) {
  return (
    <div className="px-2.5 pb-1 pt-2 text-ui-2xs font-semibold uppercase tracking-wider text-content-subtle">
      {children}
    </div>
  )
}
