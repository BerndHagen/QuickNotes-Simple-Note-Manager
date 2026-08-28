import { compareSpatialZOrder } from './geometry'

const MAX_INTER_STROKE_GAP = 750
const MAX_STROKE_DURATION = 20_000

const finiteTime = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback

export function buildInkReplay(objects) {
  const strokes = objects
    .filter((object) => object.kind === 'stroke' && object.data?.points?.length > 0)
    .slice()
    .sort((first, second) => {
      const timeDifference = finiteTime(Date.parse(first.createdAt)) - finiteTime(Date.parse(second.createdAt))
      return timeDifference || compareSpatialZOrder(first, second)
    })

  let cursor = 0
  let previousCreatedAt = null
  const entries = strokes.map((object) => {
    const createdAt = finiteTime(Date.parse(object.createdAt), previousCreatedAt ?? 0)
    if (previousCreatedAt != null) cursor += Math.min(MAX_INTER_STROKE_GAP, Math.max(0, createdAt - previousCreatedAt))
    const firstPointTime = finiteTime(object.data.points[0]?.[5])
    const relativeTimes = object.data.points.map((point) => Math.max(0, finiteTime(point[5], firstPointTime) - firstPointTime))
    const duration = Math.min(MAX_STROKE_DURATION, Math.max(1, relativeTimes.at(-1) || 1))
    const entry = { object, start: cursor, end: cursor + duration, relativeTimes }
    cursor = entry.end
    previousCreatedAt = createdAt
    return entry
  })

  return { entries, duration: cursor }
}

export function inkObjectsAtReplayTime(timeline, elapsed) {
  const time = Math.max(0, Number(elapsed) || 0)
  const visible = []
  for (const entry of timeline.entries) {
    if (time < entry.start) continue
    if (time >= entry.end) {
      visible.push({ ...entry.object, data: { ...entry.object.data, replayVisible: true } })
      continue
    }
    const localTime = time - entry.start
    let pointCount = entry.relativeTimes.findIndex((pointTime) => pointTime > localTime)
    if (pointCount < 0) pointCount = entry.object.data.points.length
    pointCount = Math.max(1, pointCount)
    visible.push({
      ...entry.object,
      data: { ...entry.object.data, replayVisible: true, points: entry.object.data.points.slice(0, pointCount) },
    })
  }
  return visible
}
