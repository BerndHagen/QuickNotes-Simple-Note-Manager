import { describe, expect, it } from 'vitest'
import { buildInkReplay, inkObjectsAtReplayTime } from './replay'

const stroke = (id, zIndex, createdAt, pointTimes) => ({
  id,
  kind: 'stroke',
  zIndex,
  createdAt,
  data: { points: pointTimes.map((time, index) => [index, index, 0.5, 0, 0, time]) },
})

describe('ink replay timeline', () => {
  it('preserves stroke order and relative point timing without changing source objects', () => {
    const later = stroke('later', 2, '2026-08-26T10:00:01.000Z', [900, 930, 990])
    const earlier = stroke('earlier', 1, '2026-08-26T10:00:00.000Z', [100, 140, 220])
    const timeline = buildInkReplay([later, earlier, { id: 'shape', kind: 'shape' }])

    expect(timeline.entries.map((entry) => entry.object.id)).toEqual(['earlier', 'later'])
    expect(timeline.entries[0].relativeTimes).toEqual([0, 40, 120])
    expect(timeline.entries[1].start - timeline.entries[0].end).toBe(750)

    const partial = inkObjectsAtReplayTime(timeline, 60)
    expect(partial).toHaveLength(1)
    expect(partial[0].data.points).toHaveLength(2)
    expect(earlier.data.points).toHaveLength(3)
    expect(inkObjectsAtReplayTime(timeline, timeline.duration).map((object) => object.id)).toEqual(['earlier', 'later'])
  })
})
