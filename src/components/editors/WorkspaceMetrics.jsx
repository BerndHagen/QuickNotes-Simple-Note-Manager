/**
 * Compact secondary information for focused workspaces.
 *
 * Values stay available at a glance without turning routine workspace state
 * into dashboard cards. A description list also preserves the value/label
 * relationship for assistive technology.
 */
export default function WorkspaceMetrics({ items }) {
  return (
    <dl className="qn-workspace-metrics" aria-label="Workspace summary">
      {items.map(({ label, value, tone = 'neutral' }) => (
        <div key={label} className="qn-workspace-metric">
          <dt className="qn-workspace-metric-label">{label}</dt>
          <dd
            className={`qn-workspace-metric-value ${
              tone === 'danger' ? 'text-danger-text' : 'text-content'
            }`}
          >
            {value}
          </dd>
        </div>
      ))}
    </dl>
  )
}
