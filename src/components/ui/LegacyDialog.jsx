import { useRef } from 'react'
import { useFocusTrap, useScrollLock, useEscapeKey } from './useFocusTrap'

/**
 * Overlay wrapper for the dialogs that still carry their own bespoke
 * markup.
 *
 * These screens were built before there was a shared `Modal`, and each
 * one hand-rolled its backdrop. None of them announced itself as a
 * dialog, trapped focus, restored focus on close, handled Escape or
 * locked background scrolling — and on short viewports several of them
 * pushed their own action buttons past the bottom edge.
 *
 * Wrapping them here fixes all of that in one place without rewriting
 * their contents. New dialogs should use `Modal` instead; this exists so
 * the existing ones are correct today rather than eventually.
 */
export default function LegacyDialog({
  open = true,
  onClose,
  label,
  align = 'center',
  className = '',
  panelClassName = '',
  closeOnBackdrop = true,
  children,
}) {
  const panelRef = useRef(null)

  useFocusTrap(panelRef, open)
  useScrollLock(open)
  useEscapeKey(open, onClose)

  if (!open) return null

  return (
    <div
      className={[
        'fixed inset-0 z-dialog flex justify-center overflow-y-auto overscroll-contain p-3 sm:p-4',
        align === 'top' ? 'items-start pt-[10vh]' : 'items-center',
        className,
      ].join(' ')}
    >
      <div
        className="fixed inset-0 bg-[var(--qn-overlay)] backdrop-blur-[2px] animate-fade-in"
        onClick={closeOnBackdrop ? onClose : undefined}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        data-dialog-body
        className={[
          // Never taller than the viewport, and always able to scroll
          // its own content so footer actions stay reachable.
          'relative my-auto flex max-h-[92dvh] w-full min-w-0 flex-col outline-none',
          // `items-center` matters: the wrapped panels size themselves
          // with `max-w-*`, and a flex column's default `stretch` pins
          // such a child to the left edge instead of centring it.
          'items-center',
          panelClassName,
        ].join(' ')}
      >
        {children}
      </div>
    </div>
  )
}
