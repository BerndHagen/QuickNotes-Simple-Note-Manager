import { describe, expect, it, vi } from 'vitest'
import { configureCanvas, drawInkObjects } from './renderer'

describe('spatial canvas renderer', () => {
  it('uses device pixels while bounding pathological backing dimensions', () => {
    const context = {}
    const canvas = { width: 0, height: 0, getContext: () => context }
    expect(configureCanvas(canvas, 800, 600, 2)).toMatchObject({ ratio: 2, width: 800, height: 600 })
    expect(canvas).toMatchObject({ width: 1600, height: 1200 })

    const large = configureCanvas(canvas, 5000, 4000, 3)
    expect(canvas.width).toBeLessThanOrEqual(8192)
    expect(canvas.height).toBeLessThanOrEqual(8192)
    expect(large.ratio).toBeCloseTo(8192 / 5000)
  })

  it('culls off-screen ink before issuing draw calls', () => {
    const context = {
      save: vi.fn(), restore: vi.fn(), beginPath: vi.fn(), arc: vi.fn(), fill: vi.fn(),
    }
    const stroke = (id, x) => ({
      id, kind: 'stroke', bounds: { x, y: x, width: 2, height: 2 },
      data: { points: [[x, x, 0.5]], width: 2, color: '#000', opacity: 1 },
    })
    drawInkObjects(context, [stroke('visible', 10), stroke('distant', 10_000)], { x: 0, y: 0, width: 100, height: 100 })
    expect(context.arc).toHaveBeenCalledTimes(1)
  })
})
