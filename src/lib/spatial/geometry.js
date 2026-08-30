export const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value))

export const compareSpatialZOrder = (first, second) =>
  (Number(first?.zIndex) || 0) - (Number(second?.zIndex) || 0) ||
  String(first?.id || '').localeCompare(String(second?.id || ''))

export function screenToWorld(clientX, clientY, rect, viewport) {
  const zoom = viewport.zoom || 1
  return {
    x: (clientX - rect.left - (viewport.panX || 0)) / zoom,
    y: (clientY - rect.top - (viewport.panY || 0)) / zoom,
  }
}

export function worldToScreen(x, y, viewport) {
  return {
    x: (viewport.panX || 0) + x * (viewport.zoom || 1),
    y: (viewport.panY || 0) + y * (viewport.zoom || 1),
  }
}

export function boundsFromPoints(points, padding = 0) {
  if (!Array.isArray(points) || points.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 }
  }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const point of points) {
    minX = Math.min(minX, point[0])
    minY = Math.min(minY, point[1])
    maxX = Math.max(maxX, point[0])
    maxY = Math.max(maxY, point[1])
  }
  return {
    x: minX - padding,
    y: minY - padding,
    width: Math.max(1, maxX - minX + padding * 2),
    height: Math.max(1, maxY - minY + padding * 2),
  }
}

export function normalizeBounds(bounds) {
  const x = Number(bounds?.x) || 0
  const y = Number(bounds?.y) || 0
  const width = Number(bounds?.width) || 0
  const height = Number(bounds?.height) || 0
  return {
    x: width < 0 ? x + width : x,
    y: height < 0 ? y + height : y,
    width: Math.abs(width),
    height: Math.abs(height),
  }
}

export function boundsIntersect(a, b) {
  const left = normalizeBounds(a)
  const right = normalizeBounds(b)
  return !(
    left.x + left.width < right.x ||
    right.x + right.width < left.x ||
    left.y + left.height < right.y ||
    right.y + right.height < left.y
  )
}

export function pointInBounds(point, bounds, padding = 0) {
  const value = normalizeBounds(bounds)
  return point.x >= value.x - padding &&
    point.x <= value.x + value.width + padding &&
    point.y >= value.y - padding &&
    point.y <= value.y + value.height + padding
}

const distanceToSegment = (point, start, end) => {
  const dx = end[0] - start[0]
  const dy = end[1] - start[1]
  if (dx === 0 && dy === 0) return Math.hypot(point.x - start[0], point.y - start[1])
  const ratio = clamp(
    ((point.x - start[0]) * dx + (point.y - start[1]) * dy) / (dx * dx + dy * dy),
    0,
    1
  )
  return Math.hypot(point.x - (start[0] + ratio * dx), point.y - (start[1] + ratio * dy))
}

export function hitTestObject(object, point, tolerance = 6) {
  if (!pointInBounds(point, object.bounds, tolerance)) return false
  if (object.kind === 'stroke') {
    const points = object.data?.points || []
    const threshold = (object.data?.width || 2) / 2 + tolerance
    if (points.length === 1) {
      return Math.hypot(point.x - points[0][0], point.y - points[0][1]) <= threshold
    }
    for (let index = 1; index < points.length; index += 1) {
      if (distanceToSegment(point, points[index - 1], points[index]) <= threshold) return true
    }
    return false
  }
  if (object.kind === 'shape') {
    const geometry = object.data?.geometry || object.bounds
    const shape = object.data?.shape
    if (shape === 'line' || shape === 'arrow') {
      return distanceToSegment(
        point,
        [geometry.x, geometry.y],
        [geometry.x + geometry.width, geometry.y + geometry.height]
      ) <= (object.data?.width || 2) / 2 + tolerance
    }
    if (shape === 'ellipse') {
      const rx = Math.max(1, Math.abs(geometry.width) / 2)
      const ry = Math.max(1, Math.abs(geometry.height) / 2)
      const cx = geometry.x + geometry.width / 2
      const cy = geometry.y + geometry.height / 2
      const value = ((point.x - cx) ** 2) / (rx ** 2) + ((point.y - cy) ** 2) / (ry ** 2)
      return Math.abs(value - 1) <= Math.max(0.08, tolerance / Math.min(rx, ry)) || value < 1
    }
  }
  return true
}

export function objectAtPoint(objects, point, tolerance = 6) {
  return [...objects]
    .sort((a, b) => compareSpatialZOrder(b, a))
    .find((object) => hitTestObject(object, point, tolerance)) || null
}

export function moveSpatialObject(object, dx, dy) {
  const next = structuredClone(object)
  if (next.kind === 'stroke') {
    next.data.points = next.data.points.map((point) => [point[0] + dx, point[1] + dy, ...point.slice(2)])
  } else if (next.kind === 'shape') {
    next.data.geometry.x += dx
    next.data.geometry.y += dy
  }
  next.bounds = { ...next.bounds, x: next.bounds.x + dx, y: next.bounds.y + dy }
  next.updatedAt = new Date().toISOString()
  return next
}

export function constrainSpatialTranslation(objects, dx, dy, width, height) {
  if (!Array.isArray(objects) || objects.length === 0) return { dx, dy }
  const bounds = objects.map((object) => normalizeBounds(object.bounds))
  const left = Math.min(...bounds.map((value) => value.x))
  const top = Math.min(...bounds.map((value) => value.y))
  const right = Math.max(...bounds.map((value) => value.x + value.width))
  const bottom = Math.max(...bounds.map((value) => value.y + value.height))

  const boundedDelta = (requested, minimum, maximum, limit) => {
    // Legacy/imported objects can be larger than a page. Do not distort or
    // unexpectedly relocate that canonical data; the page renderer clips it.
    if (maximum - minimum > limit) return requested
    return clamp(requested, -minimum, limit - maximum)
  }

  return {
    dx: boundedDelta(dx, left, right, Math.max(0, Number(width) || 0)),
    dy: boundedDelta(dy, top, bottom, Math.max(0, Number(height) || 0)),
  }
}

export function constrainSpatialObjectToBounds(object, width, height) {
  const bounds = normalizeBounds(object.bounds)
  const pageWidth = Math.max(0, Number(width) || 0)
  const pageHeight = Math.max(0, Number(height) || 0)
  const targetX = bounds.width <= pageWidth ? clamp(bounds.x, 0, pageWidth - bounds.width) : bounds.x
  const targetY = bounds.height <= pageHeight ? clamp(bounds.y, 0, pageHeight - bounds.height) : bounds.y
  return moveSpatialObject(object, targetX - bounds.x, targetY - bounds.y)
}

export function resizeSpatialObject(object, width, height) {
  const next = structuredClone(object)
  const safeWidth = Math.max(24, width)
  const safeHeight = Math.max(24, height)
  if (next.kind === 'shape') {
    next.data.geometry.width = safeWidth
    next.data.geometry.height = safeHeight
  }
  next.bounds = { ...next.bounds, width: safeWidth, height: safeHeight }
  next.updatedAt = new Date().toISOString()
  return next
}
