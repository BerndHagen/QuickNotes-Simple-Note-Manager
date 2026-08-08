import { useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useFocusTrap, useScrollLock, useEscapeKey } from './useFocusTrap'

const SIZES = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
  xl: 'sm:max-w-2xl',
  '2xl': 'sm:max-w-3xl',
  '3xl': 'sm:max-w-5xl',
}

/**
 * The dialog shell every modal in the app is built on. It owns:
 *   - focus trap + focus restore + initial focus
 *   - Escape to close, respecting nesting order
 *   - background scroll lock
 *   - `role="dialog"`, `aria-modal`, labelled title
 *   - a body that scrolls internally so the header and footer actions
 *     are always reachable, at any viewport height
 *   - full-height bottom sheet on small screens, centred card above `sm`
 */
export default function Modal({
  open,
  onClose,
  title,
  description,
  icon: Icon,
  size = 'lg',
  footer,
  children,
  initialFocusRef,
  closeOnBackdrop = true,
  hideCloseButton = false,
  contentClassName = '',
  bodyClassName = '',
  labelledBy,
}) {
  const panelRef = useRef(null)
  const titleId = useId()
  const descriptionId = useId()

  useFocusTrap(panelRef, open, { initialFocusRef })
  useScrollLock(open)
  useEscapeKey(open, onClose)

  if (!open) return null

  return createPortal(
    <div className="qn-modal-viewport fixed inset-0 z-dialog flex items-end justify-center sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-[var(--qn-overlay)] backdrop-blur-[2px] animate-fade-in"
        onClick={closeOnBackdrop ? onClose : undefined}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy || (title ? titleId : undefined)}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={[
          'qn-dialog relative flex w-full flex-col overflow-hidden bg-surface-raised text-content',
          'border border-subtle shadow-dialog outline-none',
          // Mobile: bottom sheet pinned to the viewport, never taller than it.
          'max-h-[92dvh] rounded-t-dialog animate-sheet-in',
          // sm+: centred card.
          'sm:max-h-[min(88dvh,900px)] sm:rounded-dialog sm:animate-dialog-in',
          SIZES[size] || SIZES.lg,
          contentClassName,
        ].join(' ')}
      >
        {/* Drag affordance for the mobile sheet */}
        <div className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-[var(--qn-border-strong)] sm:hidden" />

        {(title || !hideCloseButton) && (
          <header
            data-dialog-banner
            className="qn-banner-surface flex shrink-0 items-start gap-3 border-b border-white/15 px-5 py-4 text-banner-text sm:px-6"
          >
            {Icon && (
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-white/15 text-banner-text">
                <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              {title && (
                <h2 id={titleId} className="truncate text-title-sm font-semibold text-banner-text">
                  {title}
                </h2>
              )}
              {description && (
                <p id={descriptionId} className="mt-0.5 text-ui-md text-white/80">
                  {description}
                </p>
              )}
            </div>
            {!hideCloseButton && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close dialog"
                className="qn-square-control -mr-1.5 -mt-1 flex h-control-md w-control-md shrink-0 items-center justify-center rounded-control text-white/85 transition-colors duration-fast hover:bg-white/15 hover:text-white"
              >
                <X className="h-[18px] w-[18px]" aria-hidden="true" />
              </button>
            )}
          </header>
        )}

        <div
          data-dialog-body
          className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6 ${bodyClassName}`}
        >
          {children}
        </div>

        {footer && (
          <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-subtle px-5 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-6 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-4">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body
  )
}
