import { normalizeBounds } from './geometry'

const MIN_CONFIDENCE = 0.84
const distance = (left, right) => Math.hypot(left[0] - right[0], left[1] - right[1])
const clamp01 = (value) => Math.min(1, Math.max(0, value))

const pathLength = (points) => points.slice(1).reduce((sum, point, index) => sum + distance(points[index], point), 0)

const distanceToInfiniteLine = (point, start, end) => {
  const dx = end[0] - start[0]
  const dy = end[1] - start[1]
  const length = Math.hypot(dx, dy)
  if (length === 0) return distance(point, start)
  return Math.abs(dy * point[0] - dx * point[1] + end[0] * start[1] - end[1] * start[0]) / length
}

const rawBounds = (points) => normalizeBounds({
  x: Math.min(...points.map((point) => point[0])),
  y: Math.min(...points.map((point) => point[1])),
  width: Math.max(...points.map((point) => point[0])) - Math.min(...points.map((point) => point[0])),
  height: Math.max(...points.map((point) => point[1])) - Math.min(...points.map((point) => point[1])),
})

const candidate = (shape, confidence, start, end) => confidence >= MIN_CONFIDENCE
  ? { shape, confidence: Math.round(confidence * 1000) / 1000, start, end }
  : null

const recognizeLine = (points, length) => {
  const start = points[0]
  const end = points.at(-1)
  const direct = distance(start, end)
  if (direct < 32 || direct / length < 0.965) return null
  const maximumDeviation = Math.max(...points.map((point) => distanceToInfiniteLine(point, start, end)))
  const allowedDeviation = Math.max(3, direct * 0.025)
  if (maximumDeviation > allowedDeviation) return null
  const confidence = 0.55 * clamp01((direct / length - 0.95) / 0.05) +
    0.45 * clamp01(1 - maximumDeviation / allowedDeviation)
  return candidate('line', confidence, { x: start[0], y: start[1] }, { x: end[0], y: end[1] })
}

const recognizeRectangle = (points, bounds) => {
  const minimum = Math.min(bounds.width, bounds.height)
  const diagonal = Math.hypot(bounds.width, bounds.height)
  if (minimum < 40 || diagonal < 80) return null
  const edgeDistances = points.map((point) => Math.min(
    Math.abs(point[0] - bounds.x),
    Math.abs(point[0] - (bounds.x + bounds.width)),
    Math.abs(point[1] - bounds.y),
    Math.abs(point[1] - (bounds.y + bounds.height))
  ))
  const averageError = edgeDistances.reduce((sum, value) => sum + value, 0) / edgeDistances.length / minimum
  const sortedErrors = edgeDistances.slice().sort((left, right) => left - right)
  const p90Error = sortedErrors[Math.floor(sortedErrors.length * 0.9)] / minimum
  const corners = [
    [bounds.x, bounds.y],
    [bounds.x + bounds.width, bounds.y],
    [bounds.x + bounds.width, bounds.y + bounds.height],
    [bounds.x, bounds.y + bounds.height],
  ]
  const cornerError = Math.max(...corners.map((corner) => Math.min(...points.map((point) => distance(point, corner))))) / diagonal
  if (averageError > 0.055 || p90Error > 0.13 || cornerError > 0.16) return null
  const confidence = 0.45 * clamp01(1 - averageError / 0.055) +
    0.3 * clamp01(1 - p90Error / 0.13) +
    0.25 * clamp01(1 - cornerError / 0.16)
  return candidate('rectangle', confidence, { x: bounds.x, y: bounds.y }, { x: bounds.x + bounds.width, y: bounds.y + bounds.height })
}

const recognizeEllipse = (points, bounds) => {
  const rx = bounds.width / 2
  const ry = bounds.height / 2
  if (Math.min(rx, ry) < 24 || Math.hypot(bounds.width, bounds.height) < 90) return null
  const cx = bounds.x + rx
  const cy = bounds.y + ry
  const radialErrors = points.map((point) => Math.abs(Math.hypot((point[0] - cx) / rx, (point[1] - cy) / ry) - 1))
  const averageError = radialErrors.reduce((sum, value) => sum + value, 0) / radialErrors.length
  const sortedErrors = radialErrors.slice().sort((left, right) => left - right)
  const p90Error = sortedErrors[Math.floor(sortedErrors.length * 0.9)]
  const quadrants = new Set(points.map((point) => `${point[0] >= cx ? 1 : 0}:${point[1] >= cy ? 1 : 0}`))
  if (quadrants.size < 4 || averageError > 0.085 || p90Error > 0.19) return null
  const confidence = 0.6 * clamp01(1 - averageError / 0.085) + 0.4 * clamp01(1 - p90Error / 0.19)
  return candidate('ellipse', confidence, { x: bounds.x, y: bounds.y }, { x: bounds.x + bounds.width, y: bounds.y + bounds.height })
}

/**
 * Returns only high-confidence, explicitly reviewable shape candidates.
 * The recognizer intentionally handles one sufficiently large pen stroke and
 * declines ambiguous marks rather than converting handwriting aggressively.
 */
export function recognizeInkShape(object) {
  const shapeBrushes = new Set(['pen', 'fineLiner', 'mechanicalPencil'])
  const points = object?.kind === 'stroke' && shapeBrushes.has(object.data?.brush)
    ? object.data.points?.filter((point) => Array.isArray(point) && Number.isFinite(point[0]) && Number.isFinite(point[1]))
    : null
  if (!points || points.length < 4 || points.length > 20_000) return null
  const length = pathLength(points)
  if (length < 32) return null
  const line = recognizeLine(points, length)
  if (line) return line

  const bounds = rawBounds(points)
  const closingDistance = distance(points[0], points.at(-1))
  if (closingDistance > Math.max(12, Math.hypot(bounds.width, bounds.height) * 0.14)) return null
  const options = [recognizeRectangle(points, bounds), recognizeEllipse(points, bounds)].filter(Boolean)
  return options.sort((left, right) => right.confidence - left.confidence)[0] || null
}
