import { describe, expect, it } from 'vitest'
import { recognizeInkShape } from './shapeRecognition'

const stroke = (points, brush = 'pen') => ({
  kind: 'stroke',
  data: { brush, points: points.map(([x, y], index) => [x, y, 0.5, 0, 0, index * 8]) },
})

const interpolate = (start, end, count = 12) => Array.from({ length: count }, (_, index) => {
  const ratio = index / (count - 1)
  return [start[0] + (end[0] - start[0]) * ratio, start[1] + (end[1] - start[1]) * ratio]
})

describe('conservative ink-to-shape recognition', () => {
  it('recognizes a deliberate line', () => {
    const result = recognizeInkShape(stroke(interpolate([10, 20], [210, 25], 30)))
    expect(result).toMatchObject({ shape: 'line' })
    expect(result.confidence).toBeGreaterThanOrEqual(0.84)
  })

  it('recognizes a closed rectangle and ellipse', () => {
    const rectangle = [
      ...interpolate([20, 20], [220, 20]),
      ...interpolate([220, 20], [220, 140]).slice(1),
      ...interpolate([220, 140], [20, 140]).slice(1),
      ...interpolate([20, 140], [20, 20]).slice(1),
    ]
    const ellipse = Array.from({ length: 81 }, (_, index) => {
      const angle = Math.PI * 2 * index / 80
      return [140 + Math.cos(angle) * 100, 100 + Math.sin(angle) * 60]
    })
    expect(recognizeInkShape(stroke(rectangle))).toMatchObject({ shape: 'rectangle' })
    expect(recognizeInkShape(stroke(ellipse))).toMatchObject({ shape: 'ellipse' })
  })

  it('declines small, open, ambiguous, and highlighter marks', () => {
    expect(recognizeInkShape(stroke([[0, 0], [8, 12], [2, 20], [12, 28], [3, 35]]))).toBeNull()
    expect(recognizeInkShape(stroke([[0, 0], [100, 20], [40, 90], [120, 130], [10, 160]]))).toBeNull()
    expect(recognizeInkShape(stroke(interpolate([10, 20], [210, 25], 30), 'highlighter'))).toBeNull()
  })
})
