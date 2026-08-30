import { Minus, Plus } from 'lucide-react'
import { WORKSPACE_ZOOM_MAX, WORKSPACE_ZOOM_MIN } from '../../hooks/useWorkspaceZoom'

export default function WorkspaceZoomControls({ zoom, onZoomIn, onZoomOut, onReset, className = '' }) {
  const percentage = Math.round(zoom * 100)

  return (
    <div
      role="group"
      aria-label="Workspace zoom"
      className={`qn-workspace-zoom-controls flex shrink-0 items-center gap-0.5 ${className}`}
    >
      <button
        type="button"
        onClick={onZoomOut}
        disabled={zoom <= WORKSPACE_ZOOM_MIN}
        aria-label="Zoom out"
        title="Zoom out (Ctrl+-)"
        className="qn-workspace-zoom-button"
      >
        <Minus className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={onReset}
        aria-label={`Reset zoom. Current zoom ${percentage}%`}
        title="Reset zoom (Ctrl+0)"
        className="qn-workspace-zoom-value tabular-nums"
      >
        {percentage}%
      </button>
      <button
        type="button"
        onClick={onZoomIn}
        disabled={zoom >= WORKSPACE_ZOOM_MAX}
        aria-label="Zoom in"
        title="Zoom in (Ctrl++)"
        className="qn-workspace-zoom-button"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  )
}
