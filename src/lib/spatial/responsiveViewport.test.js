import { describe, expect, it } from 'vitest'
import { fitCanvasViewport, fitPaperViewport } from './responsiveViewport'

describe('responsive spatial viewports', () => {
  it('fits a Paper page inside a compact stage without inheriting desktop zoom', () => {
    const viewport = fitPaperViewport({ width: 794 }, 390)
    expect(viewport.zoom).toBeCloseTo(366 / 794)
    expect(794 * viewport.zoom).toBeLessThanOrEqual(390)
    expect(viewport).toMatchObject({ panX: 0, panY: 0 })
  })

  it('centres and fits existing Canvas content at no more than 100 percent', () => {
    const viewport = fitCanvasViewport([
      { bounds: { x: 100, y: 200, width: 400, height: 250 } },
      { bounds: { x: 650, y: 500, width: 200, height: 150 } },
    ], 390, 600)

    expect(viewport.zoom).toBeLessThan(1)
    expect(750 * viewport.zoom).toBeLessThanOrEqual(390 - 64 + 0.001)
    expect(Number.isFinite(viewport.panX)).toBe(true)
    expect(Number.isFinite(viewport.panY)).toBe(true)
  })

  it('opens an empty compact Canvas at a neutral viewport', () => {
    expect(fitCanvasViewport([], 390, 600)).toEqual({ panX: 0, panY: 0, zoom: 1 })
  })
})
