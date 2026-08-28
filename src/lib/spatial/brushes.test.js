import { describe, expect, it } from 'vitest'
import {
  createSpatialBrushSettings,
  getSpatialBrushDefinition,
  spatialBrushWidth,
} from './brushes'

describe('spatial brush definitions', () => {
  it('keeps Pen pressure-sensitive and Highlighter broad and stable', () => {
    const pen = createSpatialBrushSettings('pen', { color: '#123456', width: 3 })
    const highlighter = createSpatialBrushSettings('highlighter', { color: '#fedc00', width: 3 })

    expect(pen).toMatchObject({ brush: 'pen', width: 3, opacity: 1 })
    expect(highlighter).toMatchObject({ brush: 'highlighter', width: 12, opacity: 0.28 })
    expect(spatialBrushWidth('pen', pen.width, 1) - spatialBrushWidth('pen', pen.width, 0)).toBeGreaterThan(2)
    expect(spatialBrushWidth('highlighter', highlighter.width, 1) - spatialBrushWidth('highlighter', highlighter.width, 0)).toBeLessThan(2)
    expect(getSpatialBrushDefinition('highlighter').lineCap).toBe('square')
  })

  it('falls back to the stable Pen contract for unknown rendering data', () => {
    expect(getSpatialBrushDefinition('future-brush').id).toBe('pen')
  })
})
