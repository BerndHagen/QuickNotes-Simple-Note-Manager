import { useRef } from 'react'
import { createPortal } from 'react-dom'
import { useFocusTrap, useScrollLock, useEscapeKey } from './useFocusTrap'

/**
 * Overlay wrapper for dialogs that carry their own bespoke panel markup.
 *
 * It supplies the backdrop, dialog semantics, focus trap, Escape handling
 * and scroll lock around content it does not otherwise touch.
 *
 * New dialogs should use `Modal`, which owns its panel layout as well.
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

  return createPortal(
    <div
      className={[
        'qn-legacy-dialog-viewport fixed inset-0 z-dialog flex justify-center overflow-hidden p-3 sm:p-4',
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
          'qn-legacy-dialog-panel',
          // Legacy panels contain a single explicit scrolling region. The
          // overlay and semantic panel must not become competing scroll owners.
          'relative my-auto flex max-h-[92dvh] w-full min-w-0 flex-col overflow-hidden outline-none',
          // Wrapped panels size themselves with `max-w-*`; a flex column's
          // default `stretch` would pin such a child to the left edge.
          'items-center',
          panelClassName,
        ].join(' ')}
      >
        {children}
      </div>
    </div>,
    document.body
  )
}
