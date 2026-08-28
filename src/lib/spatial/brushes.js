export const SPATIAL_BRUSH_DEFINITIONS = Object.freeze({
  pen: Object.freeze({
    id: 'pen',
    label: 'Pen',
    widthMultiplier: 1,
    opacity: 1,
    pressureFloor: 0.62,
    pressureRange: 0.76,
    lineCap: 'round',
    lineJoin: 'round',
  }),
  highlighter: Object.freeze({
    id: 'highlighter',
    label: 'Highlighter',
    widthMultiplier: 4,
    opacity: 0.28,
    pressureFloor: 0.92,
    pressureRange: 0.16,
    lineCap: 'square',
    lineJoin: 'bevel',
  }),
})

export const SPATIAL_BRUSH_IDS = Object.freeze(Object.keys(SPATIAL_BRUSH_DEFINITIONS))

export function getSpatialBrushDefinition(id) {
  return SPATIAL_BRUSH_DEFINITIONS[id] || SPATIAL_BRUSH_DEFINITIONS.pen
}

export function createSpatialBrushSettings(id, { color, width }) {
  const definition = getSpatialBrushDefinition(id)
  return {
    brush: definition.id,
    color,
    width: width * definition.widthMultiplier,
    opacity: definition.opacity,
  }
}

export function spatialBrushWidth(id, baseWidth, pressure) {
  const definition = getSpatialBrushDefinition(id)
  const normalizedPressure = Number.isFinite(pressure) ? Math.min(1, Math.max(0, pressure)) : 0.5
  return baseWidth * (definition.pressureFloor + normalizedPressure * definition.pressureRange)
}
