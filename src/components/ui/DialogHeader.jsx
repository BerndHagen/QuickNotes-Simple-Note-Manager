import { X } from 'lucide-react'

/**
 * One header for every application window.
 *
 * Dialog hierarchy comes from typography and the same quiet toolbar surface
 * used by every application window.
 */
export default function DialogHeader({
  title,
  description,
  onClose,
  closeLabel = 'Close dialog',
  hideCloseButton = false,
  titleId,
  descriptionId,
  className = '',
}) {
  return (
    <header
      data-dialog-banner
      className={`qn-dialog-header flex shrink-0 items-start gap-3 border-b border-strong bg-[var(--qn-surface-window-header)] px-5 py-4 text-content sm:px-6 ${className}`}
    >
      <div className="min-w-0 flex-1">
        {title && (
          <h2 id={titleId} className="truncate text-title-sm font-semibold text-content">
            {title}
          </h2>
        )}
        {description && (
          <p id={descriptionId} className="mt-0.5 text-ui-md text-content-muted">
            {description}
          </p>
        )}
      </div>
      {!hideCloseButton && (
        <button
          type="button"
          onClick={onClose}
          aria-label={closeLabel}
          className="qn-square-control -mr-1.5 -mt-1 flex h-control-md w-control-md shrink-0 items-center justify-center rounded-control text-content-muted transition-colors duration-fast hover:bg-surface-hover hover:text-content"
        >
          <X className="h-[18px] w-[18px]" aria-hidden="true" />
        </button>
      )}
    </header>
  )
}
