import {
  ArrowUpRight,
  BringToFront,
  Circle,
  Copy,
  Download,
  Eraser,
  FileText,
  Image as ImageIcon,
  Hand,
  Highlighter,
  Link2,
  Minus,
  MousePointer2,
  Pause,
  PencilLine,
  Pencil,
  Play,
  Redo2,
  Rows,
  ScanText,
  SendToBack,
  Shapes,
  Square,
  StickyNote,
  Type,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import {
  PAPER_PATTERNS,
  PAPER_SIZES,
  PAPER_SURFACES,
  STICKY_STYLES,
} from '../../lib/spatial/model'

const primaryTools = [
  ['select', MousePointer2, 'Select (V)'],
  ['pen', Pencil, 'Pen (P)'],
  ['highlighter', Highlighter, 'Highlighter (H)'],
  ['eraser', Eraser, 'Stroke eraser (E)'],
  ['hand', Hand, 'Pan (Space)'],
]

const objectTools = [
  ['line', Minus, 'Line'],
  ['arrow', ArrowUpRight, 'Arrow'],
  ['rectangle', Square, 'Rectangle'],
  ['ellipse', Circle, 'Ellipse'],
  ['text', Type, 'Text'],
  ['sticky', StickyNote, 'Sticky note'],
  ['indexCard', Rows, 'Index card'],
  ['noteLink', Link2, 'Link to note'],
]

function ToolButton({ tool, activeTool, onToolChange, icon: Icon, label, disabled = false }) {
  return (
    <button
      type="button"
      className="qn-spatial-tool"
      data-active={activeTool === tool ? 'true' : 'false'}
      aria-pressed={activeTool === tool}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={() => onToolChange(tool)}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  )
}

export default function SpatialToolbar({
  kind,
  tool,
  onToolChange,
  brush,
  onBrushChange,
  viewport,
  onZoom,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  hasSelection,
  selectedSticky,
  onStickySetting,
  onDuplicate,
  onBringToFront,
  onSendToBack,
  activePage,
  onPageSetting,
  noteLinkTarget,
  onNoteLinkTarget,
  linkableNotes,
  onExportPng,
  onExportPdf,
  onImageRequest,
  hasInk,
  replayActive,
  replayPlaying,
  replayProgress,
  onReplayToggle,
  onReplaySeek,
  onReplayStop,
  canRecognizeImage,
  onRecognizeImage,
  canAnnotateImage,
  onAnnotateImage,
  canRecognizeHandwriting,
  onRecognizeHandwriting,
  shapeCandidate,
  onConvertShape,
  editingDisabled = false,
}) {
  return (
    <div className="qn-spatial-toolbar" role="toolbar" aria-label={`${kind === 'paper' ? 'Paper' : 'Canvas'} tools`}>
      <div className="qn-spatial-tool-group">
        {primaryTools.map(([id, icon, label]) => (
          <ToolButton key={id} tool={id} activeTool={tool} onToolChange={onToolChange} icon={icon} label={label} disabled={editingDisabled} />
        ))}
      </div>
      <div className="qn-spatial-tool-separator qn-spatial-tool-separator--objects" />
      <div className="qn-spatial-tool-group qn-spatial-tool-group--objects">
        {objectTools.map(([id, icon, label]) => (
          <ToolButton key={id} tool={id} activeTool={tool} onToolChange={onToolChange} icon={icon} label={label} disabled={editingDisabled} />
        ))}
        <button type="button" className="qn-spatial-tool" onClick={onImageRequest} aria-label="Place image" title="Place image" disabled={editingDisabled}>
          <ImageIcon className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <label className="qn-spatial-mobile-insert">
        <span className="qn-sr-only">Insert object</span>
        <select
          aria-label="Insert object"
          disabled={editingDisabled}
          value={objectTools.some(([id]) => id === tool) ? tool : ''}
          onChange={(event) => {
            if (event.target.value === 'image') onImageRequest()
            else if (event.target.value) onToolChange(event.target.value)
          }}
        >
          <option value="">Insert</option>
          {objectTools.map(([id, , label]) => <option key={id} value={id}>{label}</option>)}
          <option value="image">Place image</option>
        </select>
      </label>
      <div className="qn-spatial-tool-separator" />
      <label
        className="qn-spatial-color"
        title="Ink color"
        style={{ '--qn-ink-color': brush.color }}
      >
        <span className="qn-sr-only">Ink color</span>
        <input
          type="color"
          value={brush.color}
          disabled={editingDisabled}
          onChange={(event) => onBrushChange({ color: event.target.value })}
        />
      </label>
      <label className="qn-spatial-width" title="Stroke width">
        <span className="qn-sr-only">Stroke width</span>
        <input
          type="range"
          min="1"
          max="18"
          step="0.5"
          value={brush.width}
          disabled={editingDisabled}
          onChange={(event) => onBrushChange({ width: Number(event.target.value) })}
        />
      </label>

      {tool === 'noteLink' && (
        <label className="qn-spatial-link-target">
          <span>Target</span>
          <select value={noteLinkTarget} onChange={(event) => onNoteLinkTarget(event.target.value)} disabled={editingDisabled}>
            <option value="">Choose a note</option>
            {linkableNotes.map((note) => <option key={note.id} value={note.id}>{note.title || 'Untitled note'}</option>)}
          </select>
        </label>
      )}

      {kind === 'paper' && activePage && (
        <div className="qn-spatial-page-settings" aria-label="Paper settings">
          <label>
            <span className="qn-sr-only">Paper size</span>
            <select value={activePage.size} onChange={(event) => onPageSetting('size', event.target.value)} title="Paper size" disabled={editingDisabled}>
              {Object.entries(PAPER_SIZES).map(([id, value]) => <option key={id} value={id}>{value.name}</option>)}
            </select>
          </label>
          <label>
            <span className="qn-sr-only">Paper pattern</span>
            <select value={activePage.pattern} onChange={(event) => onPageSetting('pattern', event.target.value)} title="Paper pattern" disabled={editingDisabled}>
              {PAPER_PATTERNS.map((value) => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}
            </select>
          </label>
          <label>
            <span className="qn-sr-only">Paper surface</span>
            <select value={activePage.surface} onChange={(event) => onPageSetting('surface', event.target.value)} title="Paper surface" disabled={editingDisabled}>
              {PAPER_SURFACES.map((value) => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}
            </select>
          </label>
        </div>
      )}

      {selectedSticky && (
        <div className="qn-spatial-sticky-settings" aria-label="Sticky note design">
          <label>
            <span className="qn-sr-only">Sticky note colour</span>
            <select
              value={selectedSticky.data?.style || 'sunflower'}
              onChange={(event) => onStickySetting('style', event.target.value)}
              title="Sticky note colour"
              disabled={editingDisabled}
            >
              {Object.entries(STICKY_STYLES).map(([id, value]) => <option key={id} value={id}>{value.name}</option>)}
            </select>
          </label>
        </div>
      )}

      <div className="qn-spatial-toolbar-spacer" />
      <div className="qn-spatial-tool-group qn-spatial-tool-group--history">
        <button type="button" className="qn-spatial-tool" onClick={onUndo} disabled={editingDisabled || !canUndo} aria-label="Undo" title="Undo (Ctrl+Z)"><Undo2 className="h-4 w-4" /></button>
        <button type="button" className="qn-spatial-tool" onClick={onRedo} disabled={editingDisabled || !canRedo} aria-label="Redo" title="Redo (Ctrl+Y)"><Redo2 className="h-4 w-4" /></button>
      </div>
      {hasInk && (
        <div className="qn-spatial-replay" aria-label="Ink replay controls">
          <button
            type="button"
            className="qn-spatial-tool"
            data-active={replayActive ? 'true' : 'false'}
            onClick={onReplayToggle}
            aria-label={replayPlaying ? 'Pause ink replay' : 'Replay ink'}
            title={replayPlaying ? 'Pause ink replay' : 'Replay ink'}
          >
            {replayPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          {replayActive && (
            <>
              <label className="qn-spatial-replay-scrubber">
                <span className="qn-sr-only">Ink replay position</span>
                <input
                  type="range"
                  min="0"
                  max="1000"
                  value={Math.round(replayProgress * 1000)}
                  onChange={(event) => onReplaySeek(Number(event.target.value) / 1000)}
                />
              </label>
              <button type="button" className="qn-spatial-tool" onClick={onReplayStop} aria-label="Stop ink replay" title="Stop ink replay">
                <X className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      )}
      <div className="qn-spatial-tool-group qn-spatial-tool-group--arrange" data-visible={hasSelection ? 'true' : 'false'}>
        {shapeCandidate && (
          <button type="button" className="qn-spatial-text-action" onClick={onConvertShape} title={`Convert selected ink to ${shapeCandidate.shape}`} disabled={editingDisabled}>
            <Shapes className="h-3.5 w-3.5" aria-hidden="true" /> Convert to {shapeCandidate.shape}
          </button>
        )}
        {canRecognizeImage && (
          <button type="button" className="qn-spatial-text-action" onClick={onRecognizeImage} title="Recognize printed text locally">
            <ScanText className="h-3.5 w-3.5" aria-hidden="true" /> OCR
          </button>
        )}
        {canAnnotateImage && (
          <button type="button" className="qn-spatial-text-action" onClick={onAnnotateImage} title="Annotate the selected image non-destructively">
            <PencilLine className="h-3.5 w-3.5" aria-hidden="true" /> Annotate
          </button>
        )}
        {canRecognizeHandwriting && (
          <button type="button" className="qn-spatial-text-action" onClick={onRecognizeHandwriting} title="Recognize selected handwriting with the browser">
            <ScanText className="h-3.5 w-3.5" aria-hidden="true" /> Handwriting
          </button>
        )}
        <button type="button" className="qn-spatial-tool" onClick={onDuplicate} disabled={editingDisabled || !hasSelection} aria-label="Duplicate selection" title="Duplicate (Ctrl+D)"><Copy className="h-4 w-4" /></button>
        <button type="button" className="qn-spatial-tool" onClick={onBringToFront} disabled={editingDisabled || !hasSelection} aria-label="Bring selection to front" title="Bring to front"><BringToFront className="h-4 w-4" /></button>
        <button type="button" className="qn-spatial-tool" onClick={onSendToBack} disabled={editingDisabled || !hasSelection} aria-label="Send selection to back" title="Send to back"><SendToBack className="h-4 w-4" /></button>
      </div>
      <div className="qn-spatial-tool-separator" />
      <div className="qn-spatial-zoom" aria-label="Zoom controls">
        <button type="button" className="qn-spatial-tool" onClick={() => onZoom(-0.1)} aria-label="Zoom out"><ZoomOut className="h-4 w-4" /></button>
        <output aria-label="Current zoom">{Math.round(viewport.zoom * 100)}%</output>
        <button type="button" className="qn-spatial-tool" onClick={() => onZoom(0.1)} aria-label="Zoom in"><ZoomIn className="h-4 w-4" /></button>
      </div>
      <div className="qn-spatial-tool-separator" />
      <div className="qn-spatial-export-actions">
        <button type="button" className="qn-spatial-text-action" onClick={onExportPng} title={kind === 'paper' ? 'Export current page as PNG' : 'Export canvas as PNG'}>
          <Download className="h-3.5 w-3.5" aria-hidden="true" /> PNG
        </button>
        <button type="button" className="qn-spatial-text-action" onClick={onExportPdf}>
          <FileText className="h-3.5 w-3.5" aria-hidden="true" /> PDF
        </button>
      </div>
    </div>
  )
}
