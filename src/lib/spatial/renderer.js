import { boundsIntersect, compareSpatialZOrder, normalizeBounds } from './geometry'
import { getSpatialBrushDefinition, spatialBrushWidth } from './brushes'

const MAX_CANVAS_DIMENSION = 8192

export function configureCanvas(canvas, width, height, pixelRatio = globalThis.window?.devicePixelRatio || 1) {
  const safeWidth = Math.max(1, Math.round(width))
  const safeHeight = Math.max(1, Math.round(height))
  const requestedRatio = Math.min(3, Math.max(1, pixelRatio))
  const ratio = Math.min(
    requestedRatio,
    MAX_CANVAS_DIMENSION / safeWidth,
    MAX_CANVAS_DIMENSION / safeHeight
  )
  const backingWidth = Math.max(1, Math.round(safeWidth * ratio))
  const backingHeight = Math.max(1, Math.round(safeHeight * ratio))
  if (canvas.width !== backingWidth) canvas.width = backingWidth
  if (canvas.height !== backingHeight) canvas.height = backingHeight
  return { context: canvas.getContext('2d'), ratio, width: safeWidth, height: safeHeight }
}

export function applyViewportTransform(context, viewport, ratio = 1) {
  const zoom = viewport.zoom || 1
  context.setTransform(
    ratio * zoom,
    0,
    0,
    ratio * zoom,
    ratio * (viewport.panX || 0),
    ratio * (viewport.panY || 0)
  )
}

export function drawStroke(context, object) {
  if (object.data?.hidden && !object.data?.replayVisible) return
  const points = object.data?.points || []
  if (points.length === 0) return
  const baseWidth = object.data?.width || 2.5
  const brushId = object.data?.brush || 'pen'
  const definition = getSpatialBrushDefinition(brushId)
  context.save()
  context.strokeStyle = object.data?.color || '#18352a'
  context.fillStyle = context.strokeStyle
  context.globalAlpha = object.data?.opacity ?? 1
  context.lineCap = definition.lineCap
  context.lineJoin = definition.lineJoin

  if (points.length === 1) {
    const width = spatialBrushWidth(brushId, baseWidth, points[0][2])
    if (definition.lineCap === 'round') {
      context.beginPath()
      context.arc(points[0][0], points[0][1], width / 2, 0, Math.PI * 2)
      context.fill()
    } else {
      context.fillRect(points[0][0] - width / 2, points[0][1] - width / 2, width, width)
    }
    context.restore()
    return
  }

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]
    const point = points[index]
    const next = points[Math.min(points.length - 1, index + 1)]
    const midX = (point[0] + next[0]) / 2
    const midY = (point[1] + next[1]) / 2
    context.lineWidth = spatialBrushWidth(brushId, baseWidth, (previous[2] + point[2]) / 2)
    context.beginPath()
    context.moveTo(previous[0], previous[1])
    context.quadraticCurveTo(point[0], point[1], midX, midY)
    context.stroke()
  }
  context.restore()
}

export function drawStrokeSegment(context, previous, point, brush) {
  const definition = getSpatialBrushDefinition(brush.brush)
  context.save()
  context.strokeStyle = brush.color
  context.globalAlpha = brush.opacity
  context.lineWidth = spatialBrushWidth(brush.brush, brush.width, (previous[2] + point[2]) / 2)
  context.lineCap = definition.lineCap
  context.lineJoin = definition.lineJoin
  context.beginPath()
  context.moveTo(previous[0], previous[1])
  context.lineTo(point[0], point[1])
  context.stroke()
  context.restore()
}

export function drawInkObjects(context, objects, visibleBounds = null) {
  for (const object of objects) {
    if (
      object.kind === 'stroke' &&
      (!visibleBounds || boundsIntersect(object.bounds, visibleBounds))
    ) drawStroke(context, object)
  }
}

const drawArrowHead = (context, x1, y1, x2, y2, width) => {
  const angle = Math.atan2(y2 - y1, x2 - x1)
  const length = Math.max(10, width * 4)
  context.moveTo(x2, y2)
  context.lineTo(x2 - length * Math.cos(angle - Math.PI / 6), y2 - length * Math.sin(angle - Math.PI / 6))
  context.moveTo(x2, y2)
  context.lineTo(x2 - length * Math.cos(angle + Math.PI / 6), y2 - length * Math.sin(angle + Math.PI / 6))
}

export function drawShape(context, object) {
  const geometry = object.data?.geometry || object.bounds
  const { x, y, width, height } = geometry
  context.save()
  context.strokeStyle = object.data?.color || '#18352a'
  context.lineWidth = object.data?.width || 2
  context.lineCap = 'round'
  context.lineJoin = 'round'
  context.beginPath()
  switch (object.data?.shape) {
    case 'line':
      context.moveTo(x, y)
      context.lineTo(x + width, y + height)
      break
    case 'arrow':
      context.moveTo(x, y)
      context.lineTo(x + width, y + height)
      drawArrowHead(context, x, y, x + width, y + height, context.lineWidth)
      break
    case 'ellipse':
      context.ellipse(x + width / 2, y + height / 2, Math.abs(width / 2), Math.abs(height / 2), 0, 0, Math.PI * 2)
      break
    default: {
      const bounds = normalizeBounds(geometry)
      context.rect(bounds.x, bounds.y, bounds.width, bounds.height)
    }
  }
  context.stroke()
  context.restore()
}

const wrapText = (context, text, x, y, maxWidth, lineHeight, maxLines = 12) => {
  const words = String(text || '').split(/\s+/)
  let line = ''
  let row = 0
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (context.measureText(candidate).width > maxWidth && line) {
      context.fillText(line, x, y + row * lineHeight)
      row += 1
      line = word
      if (row >= maxLines) return
    } else {
      line = candidate
    }
  }
  if (line && row < maxLines) context.fillText(line, x, y + row * lineHeight)
}

export function drawBoundedObject(context, object, resolveNoteTitle = () => 'Linked note', resolveResource = () => null) {
  const bounds = normalizeBounds(object.bounds)
  context.save()
  if (object.kind === 'image') {
    const resource = resolveResource(object.data?.resourceId)
    if (resource?.image) {
      context.drawImage(resource.image, bounds.x, bounds.y, bounds.width, bounds.height)
    } else {
      context.fillStyle = '#e7e9e7'
      context.fillRect(bounds.x, bounds.y, bounds.width, bounds.height)
    }
    context.restore()
    return
  } else if (object.kind === 'sticky') {
    context.fillStyle = '#f5e8a7'
    context.strokeStyle = '#c8b76d'
    context.fillRect(bounds.x, bounds.y, bounds.width, bounds.height)
    context.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height)
  } else if (object.kind === 'indexCard') {
    context.fillStyle = '#fffdfa'
    context.strokeStyle = '#bdb8ad'
    context.fillRect(bounds.x, bounds.y, bounds.width, bounds.height)
    context.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height)
    for (let y = bounds.y + 38; y < bounds.y + bounds.height; y += 25) {
      context.beginPath()
      context.moveTo(bounds.x, y)
      context.lineTo(bounds.x + bounds.width, y)
      context.strokeStyle = '#d8d3ca'
      context.stroke()
    }
  } else if (object.kind === 'noteLink') {
    context.fillStyle = '#eef4f0'
    context.strokeStyle = '#9eafa7'
    context.fillRect(bounds.x, bounds.y, bounds.width, bounds.height)
    context.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height)
  }
  context.fillStyle = '#1e2924'
  context.font = object.kind === 'text' ? '16px system-ui' : '14px system-ui'
  context.textBaseline = 'top'
  const value = object.kind === 'noteLink'
    ? resolveNoteTitle(object.data?.targetNoteId)
    : object.data?.text
  wrapText(context, value, bounds.x + 12, bounds.y + 12, bounds.width - 24, 21)
  context.restore()
}

export function drawAllSpatialObjects(context, objects, resolveNoteTitle, resolveResource) {
  for (const object of [...objects].sort(compareSpatialZOrder)) {
    if (object.data?.hidden) continue
    if (object.kind === 'stroke') drawStroke(context, object)
    else if (object.kind === 'shape') drawShape(context, object)
    else if (['text', 'sticky', 'indexCard', 'noteLink', 'image'].includes(object.kind)) {
      drawBoundedObject(context, object, resolveNoteTitle, resolveResource)
    }
  }
}
