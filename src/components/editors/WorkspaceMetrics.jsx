/**
 * Compact secondary information for focused workspaces.
 *
 * Values stay available at a glance without turning routine workspace state
 * into dashboard cards. A description list also preserves the value/label
 * relationship for assistive technology.
 */
export default function WorkspaceMetrics({ items }) {
  const toneClass = {
    danger: 'text-danger-text',
    warning: 'text-warning-text',
    success: 'text-success-text',
    info: 'text-info-text',
    neutral: 'text-content',
  }

  return (
    <dl className="qn-workspace-metrics" aria-label="Workspace summary">
      {items.map(({ label, value, tone = 'neutral' }) => (
        <div key={label} className="qn-workspace-metric">
          <dt className="qn-workspace-metric-label">{label}</dt>
          <dd
            className={`qn-workspace-metric-value ${toneClass[tone] || toneClass.neutral}`}
          >
            {value}
          </dd>
        </div>
      ))}
    </dl>
  )
}
