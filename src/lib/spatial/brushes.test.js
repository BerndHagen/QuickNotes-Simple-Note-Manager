import { describe, expect, it } from 'vitest'
import {
  createSpatialBrushSettings,
  getSpatialBrushDefinition,
  SPATIAL_BRUSH_DEFINITIONS,
  SPATIAL_BRUSH_IDS,
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

  it('defines nine materially different instruments rather than renamed width presets', () => {
    expect(SPATIAL_BRUSH_IDS).toEqual([
      'pen', 'fountainPen', 'gelPen', 'pencil', 'mechanicalPencil',
      'marker', 'brushPen', 'fineLiner', 'highlighter',
    ])
    expect(new Set(SPATIAL_BRUSH_IDS.map((id) => SPATIAL_BRUSH_DEFINITIONS[id].widthMultiplier)).size).toBeGreaterThanOrEqual(7)
    expect(new Set(SPATIAL_BRUSH_IDS.map((id) => SPATIAL_BRUSH_DEFINITIONS[id].opacity)).size).toBeGreaterThanOrEqual(6)
    expect(SPATIAL_BRUSH_DEFINITIONS.pencil.grain).toBeGreaterThan(0)
    expect(SPATIAL_BRUSH_DEFINITIONS.gelPen.inkCore).toBeGreaterThan(0)
    expect(SPATIAL_BRUSH_DEFINITIONS.marker.softEdge).toBeGreaterThan(0)
    expect(SPATIAL_BRUSH_DEFINITIONS.brushPen.velocityResponse).toBeGreaterThan(SPATIAL_BRUSH_DEFINITIONS.pen.velocityResponse)
    expect(SPATIAL_BRUSH_DEFINITIONS.fountainPen.pressureRange).toBeGreaterThan(SPATIAL_BRUSH_DEFINITIONS.fineLiner.pressureRange)
    expect(SPATIAL_BRUSH_DEFINITIONS.highlighter.lineCap).toBe('square')
  })
})
