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
      className={`flex h-full flex-col items-center justify-center px-6 py-8 text-center ${className}`}
    >
      {Icon && (
        <span className="mb-3 flex items-center justify-center text-content-subtle">
          <Icon className={compact ? 'h-5 w-5' : 'h-[22px] w-[22px]'} aria-hidden="true" />
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
