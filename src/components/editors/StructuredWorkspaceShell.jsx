import { useRef } from 'react'
import FocusedNoteTitle from './FocusedNoteTitle'

/**
 * Shared frame for the seven structured workspaces.
 *
 * The frame deliberately owns the only vertical scrollbar. Individual views
 * may scroll a short horizontal command strip, but content sections must grow
 * with their contents so phone users never get trapped inside nested panes.
 */
export default function StructuredWorkspaceShell({
  className = '',
  icon,
  typeLabel,
  title,
  fallback,
  onTitleChange,
  readOnly = false,
  summary,
  commands,
  children,
}) {
  return (
    <div className={`qn-structured-workspace ${className}`}>
      <header className="qn-structured-header">
        <FocusedNoteTitle
          icon={icon}
          typeLabel={typeLabel}
          title={title}
          fallback={fallback}
          onChange={onTitleChange}
          readOnly={readOnly}
        />
        {summary && <div className="qn-structured-summary">{summary}</div>}
      </header>

      {commands && (
        <nav className="qn-structured-commands" aria-label={`${typeLabel} views and commands`}>
          {commands}
        </nav>
      )}

      <main className="qn-structured-content">{children}</main>
    </div>
  )
}

export function WorkspaceTabs({ tabs, activeTab, onChange }) {
  const tabRefs = useRef([])

  const moveFocus = (event, index) => {
    let nextIndex = null
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (index + 1) % tabs.length
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (index - 1 + tabs.length) % tabs.length
    if (event.key === 'Home') nextIndex = 0
    if (event.key === 'End') nextIndex = tabs.length - 1
    if (nextIndex == null) return
    event.preventDefault()
    onChange(tabs[nextIndex].id)
    requestAnimationFrame(() => tabRefs.current[nextIndex]?.focus())
  }

  return (
    <div className="qn-structured-tabs" role="tablist">
      {tabs.map(({ id, label, icon: Icon, count }, index) => (
        <button
          key={id}
          ref={(element) => { tabRefs.current[index] = element }}
          type="button"
          role="tab"
          aria-selected={activeTab === id}
          tabIndex={activeTab === id ? 0 : -1}
          onClick={() => onChange(id)}
          onKeyDown={(event) => moveFocus(event, index)}
          className="qn-structured-tab"
        >
          {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
          <span>{label}</span>
          {Number.isFinite(count) && <span className="qn-structured-tab-count">{count}</span>}
        </button>
      ))}
    </div>
  )
}

export function WorkspaceSection({ title, description, actions, children, className = '' }) {
  return (
    <section className={`qn-structured-section ${className}`}>
      {(title || actions) && (
        <header className="qn-structured-section-header">
          <div className="min-w-0">
            {title && <h2 className="qn-structured-section-title">{title}</h2>}
            {description && <p className="qn-structured-section-description">{description}</p>}
          </div>
          {actions && <div className="qn-structured-section-actions">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  )
}
