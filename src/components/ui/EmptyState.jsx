/**
 * Consistent empty / zero-result state.
 *
 * Every empty state answers the same three questions: what is missing,
 * why, and what the user can do about it.
 */
export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  size = 'md',
  className = '',
}) {
  const compact = size === 'sm'
  return (
    <div
      className={`flex h-full flex-col items-center justify-center px-6 py-10 text-center ${className}`}
    >
      {Icon && (
        <span
          className={`mb-4 flex items-center justify-center rounded-card border border-subtle bg-surface-sunken text-content-subtle ${
 compact ? 'h-11 w-11' : 'h-14 w-14'
 }`}
        >
          <Icon className={compact ? 'h-5 w-5' : 'h-6 w-6'} aria-hidden="true" />
        </span>
      )}
      <p className={`font-semibold text-content ${compact ? 'text-ui-lg' : 'text-title-xs'}`}>
        {title}
      </p>
      {description && (
        <p className="mt-1.5 max-w-[36ch] text-ui-md leading-relaxed text-content-muted">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
