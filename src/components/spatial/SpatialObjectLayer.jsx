import { FileText } from 'lucide-react'
import { boundsIntersect, normalizeBounds } from '../../lib/spatial/geometry'

function ShapeObject({ object, previewOffset }) {
  const geometry = object.data.geometry
  const bounds = normalizeBounds(object.bounds)
  const padding = 10
  const width = Math.max(1, bounds.width) + padding * 2
  const height = Math.max(1, bounds.height) + padding * 2
  const x1 = geometry.x - bounds.x + padding
  const y1 = geometry.y - bounds.y + padding
  const x2 = geometry.x + geometry.width - bounds.x + padding
  const y2 = geometry.y + geometry.height - bounds.y + padding
  const markerId = `arrow-${object.id}`
  const style = {
    left: bounds.x - padding,
    top: bounds.y - padding,
    width,
    height,
    transform: previewOffset ? `translate(${previewOffset.dx}px, ${previewOffset.dy}px)` : undefined,
  }
  const common = {
    fill: 'transparent',
    stroke: object.data.color || '#18352a',
    strokeWidth: object.data.width || 2,
    vectorEffect: 'non-scaling-stroke',
  }

  return (
    <svg className="qn-spatial-shape" style={style} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      {object.data.shape === 'arrow' && (
        <defs>
          <marker id={markerId} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="strokeWidth">
            <path d="M 0 0 L 8 4 L 0 8 z" fill={common.stroke} />
          </marker>
        </defs>
      )}
      {(object.data.shape === 'line' || object.data.shape === 'arrow') && (
        <line {...common} x1={x1} y1={y1} x2={x2} y2={y2} markerEnd={object.data.shape === 'arrow' ? `url(#${markerId})` : undefined} />
      )}
      {object.data.shape === 'rectangle' && (
        <rect {...common} x={padding} y={padding} width={Math.max(1, bounds.width)} height={Math.max(1, bounds.height)} />
      )}
      {object.data.shape === 'ellipse' && (
        <ellipse {...common} cx={padding + bounds.width / 2} cy={padding + bounds.height / 2} rx={Math.max(1, bounds.width / 2)} ry={Math.max(1, bounds.height / 2)} />
      )}
    </svg>
  )
}

function TextObject({ object, editing, previewOffset, resolveNoteTitle, onDraft, onFocus, onBlur, onOpenNote }) {
  const bounds = normalizeBounds(object.bounds)
  const style = {
    left: bounds.x,
    top: bounds.y,
    width: bounds.width,
    height: bounds.height,
    transform: previewOffset ? `translate(${previewOffset.dx}px, ${previewOffset.dy}px)` : undefined,
    pointerEvents: editing ? 'auto' : 'none',
  }
  if (object.kind === 'noteLink') {
    return (
      <button
        type="button"
        className="qn-spatial-object qn-spatial-object--note-link"
        data-spatial-object-id={object.id}
        style={style}
        onClick={() => onOpenNote({
          noteId: object.data?.targetNoteId,
          anchorId: object.data?.targetAnchorId || null,
          objectId: object.data?.targetObjectId || null,
        })}
        onDoubleClick={() => onOpenNote({
          noteId: object.data?.targetNoteId,
          anchorId: object.data?.targetAnchorId || null,
          objectId: object.data?.targetObjectId || null,
        })}
        aria-label={`Linked note: ${resolveNoteTitle(object.data?.targetNoteId)}`}
      >
        <FileText className="h-4 w-4" aria-hidden="true" />
        <span>{resolveNoteTitle(object.data?.targetNoteId)}</span>
      </button>
    )
  }

  const stickyStyle = object.kind === 'sticky' ? object.data?.style || 'sunflower' : undefined
  return (
    <div
      data-spatial-object-id={object.id}
      data-sticky-style={stickyStyle}
      className={`qn-spatial-object qn-spatial-object--${object.kind}`}
      style={style}
    >
      <textarea
        value={object.data?.text || ''}
        onChange={(event) => onDraft(object, event.target.value)}
        onFocus={() => onFocus(object)}
        onBlur={() => onBlur(object)}
        onKeyDown={(event) => {
          if (event.key === 'Escape' || ((event.ctrlKey || event.metaKey) && event.key === 'Enter')) event.currentTarget.blur()
        }}
        aria-label={object.kind === 'text' ? 'Canvas text' : object.kind === 'sticky' ? 'Sticky note text' : 'Index card text'}
        spellCheck="true"
      />
    </div>
  )
}

function ImageObject({ object, previewOffset, resolveResource }) {
  const bounds = normalizeBounds(object.bounds)
  const resource = resolveResource(object.data?.resourceId)
  return (
    <div
      className="qn-spatial-object qn-spatial-object--image"
      style={{
        left: bounds.x,
        top: bounds.y,
        width: bounds.width,
        height: bounds.height,
        transform: previewOffset ? `translate(${previewOffset.dx}px, ${previewOffset.dy}px)` : undefined,
        pointerEvents: 'none',
      }}
    >
      {resource?.data
        ? <img src={resource.thumbnailData || resource.data} alt={resource.name || 'Placed image'} draggable="false" />
        : <span>Image unavailable</span>}
    </div>
  )
}

export default function SpatialObjectLayer({
  objects,
  selectedIds,
  editingTextId,
  viewport,
  viewportSize,
  canvasMode,
  dragPreview,
  lasso,
  shapePreview,
  resolveNoteTitle,
  resolveResource,
  onDraft,
  onTextFocus,
  onTextBlur,
  onResizePointerDown,
  onOpenNote,
}) {
  const movePreview = Number.isFinite(dragPreview?.dx) && Number.isFinite(dragPreview?.dy)
    ? dragPreview
    : null
  const resizePreview = Number.isFinite(dragPreview?.resizeWidth) && Number.isFinite(dragPreview?.resizeHeight)
    ? dragPreview
    : null
  const transform = canvasMode
    ? `translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.zoom})`
    : undefined
  const visibleBounds = canvasMode && viewportSize?.width && viewportSize?.height
    ? {
        x: -(viewport.panX || 0) / viewport.zoom - 120 / viewport.zoom,
        y: -(viewport.panY || 0) / viewport.zoom - 120 / viewport.zoom,
        width: (viewportSize.width + 240) / viewport.zoom,
        height: (viewportSize.height + 240) / viewport.zoom,
      }
    : null
  const visibleObjects = visibleBounds
    ? objects.filter((object) => selectedIds.has(object.id) || boundsIntersect(object.bounds, visibleBounds))
    : objects
  const selectionObjects = visibleObjects.filter((object) => selectedIds.has(object.id))

  return (
    <div className="qn-spatial-object-viewport" aria-hidden={false}>
      <div className="qn-spatial-object-world" style={{ transform }}>
        {visibleObjects.filter((object) => object.kind === 'shape').map((object) => (
          <ShapeObject
            key={object.id}
            object={object}
            previewOffset={selectedIds.has(object.id) ? movePreview : null}
          />
        ))}
        {visibleObjects.filter((object) => ['text', 'sticky', 'indexCard', 'noteLink'].includes(object.kind)).map((object) => (
          <TextObject
            key={object.id}
            object={object}
            editing={editingTextId === object.id}
            previewOffset={selectedIds.has(object.id) ? movePreview : null}
            resolveNoteTitle={resolveNoteTitle}
            onDraft={onDraft}
            onFocus={onTextFocus}
            onBlur={onTextBlur}
            onOpenNote={onOpenNote}
          />
        ))}
        {visibleObjects.filter((object) => object.kind === 'image').map((object) => (
          <ImageObject
            key={object.id}
            object={object}
            previewOffset={selectedIds.has(object.id) ? movePreview : null}
            resolveResource={resolveResource}
          />
        ))}
        {shapePreview && <ShapeObject object={shapePreview} />}
        {selectionObjects.map((object) => {
          const bounds = normalizeBounds(object.bounds)
          const offset = movePreview || { dx: 0, dy: 0 }
          return (
            <div
              key={`selection-${object.id}`}
              className="qn-spatial-selection-box"
              style={{
                left: bounds.x + offset.dx,
                top: bounds.y + offset.dy,
                width: Math.max(2, resizePreview && selectionObjects.length === 1 ? resizePreview.resizeWidth : bounds.width),
                height: Math.max(2, resizePreview && selectionObjects.length === 1 ? resizePreview.resizeHeight : bounds.height),
              }}
            >
              {selectionObjects.length === 1 && object.kind !== 'stroke' && (
                <button
                  type="button"
                  className="qn-spatial-resize-handle"
                  aria-label="Resize selected object"
                  onPointerDown={(event) => onResizePointerDown(event, object)}
                />
              )}
            </div>
          )
        })}
        {lasso && (
          <div
            className="qn-spatial-lasso"
            style={normalizeBounds(lasso)}
            aria-hidden="true"
          />
        )}
      </div>
    </div>
  )
}
