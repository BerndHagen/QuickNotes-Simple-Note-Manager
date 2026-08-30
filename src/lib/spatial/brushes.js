export const SPATIAL_BRUSH_DEFINITIONS = Object.freeze({
  // `pen` is retained as the schema-1 identifier, so existing strokes remain
  // byte-compatible while the UI gives the instrument its professional name.
  pen: Object.freeze({
    id: 'pen', label: 'Ballpoint Pen', widthMultiplier: 1, opacity: 1,
    pressureFloor: 0.62, pressureRange: 0.76, velocityResponse: 0.08,
    taperStart: 0.015, taperEnd: 0.01, lineCap: 'round', lineJoin: 'round',
    composite: 'source-over', texture: 0.03,
  }),
  fountainPen: Object.freeze({
    id: 'fountainPen', label: 'Fountain Pen', widthMultiplier: 1.25, opacity: 0.94,
    pressureFloor: 0.28, pressureRange: 1.18, velocityResponse: 0.14, tiltResponse: 0.22,
    taperStart: 0.055, taperEnd: 0.045, lineCap: 'round', lineJoin: 'round',
    composite: 'source-over', texture: 0.02,
  }),
  gelPen: Object.freeze({
    id: 'gelPen', label: 'Gel Pen', widthMultiplier: 1.15, opacity: 1,
    pressureFloor: 0.84, pressureRange: 0.24, velocityResponse: 0.02,
    taperStart: 0.012, taperEnd: 0.012, lineCap: 'round', lineJoin: 'round',
    composite: 'source-over', texture: 0, inkCore: 0.22,
  }),
  pencil: Object.freeze({
    id: 'pencil', label: 'Pencil', widthMultiplier: 0.9, opacity: 0.58,
    pressureFloor: 0.4, pressureRange: 0.9, velocityResponse: 0.17,
    taperStart: 0.025, taperEnd: 0.025, lineCap: 'round', lineJoin: 'round',
    composite: 'source-over', texture: 0.42, grain: 0.65,
  }),
  mechanicalPencil: Object.freeze({
    id: 'mechanicalPencil', label: 'Mechanical Pencil', widthMultiplier: 0.58, opacity: 0.72,
    pressureFloor: 0.74, pressureRange: 0.36, velocityResponse: 0.06,
    taperStart: 0.01, taperEnd: 0.01, lineCap: 'round', lineJoin: 'round',
    composite: 'source-over', texture: 0.2, grain: 0.32,
  }),
  marker: Object.freeze({
    id: 'marker', label: 'Marker', widthMultiplier: 2.7, opacity: 0.74,
    pressureFloor: 0.88, pressureRange: 0.18, velocityResponse: 0.03,
    taperStart: 0.008, taperEnd: 0.008, lineCap: 'round', lineJoin: 'round',
    composite: 'multiply', texture: 0.08, softEdge: 0.2,
  }),
  brushPen: Object.freeze({
    id: 'brushPen', label: 'Brush Pen', widthMultiplier: 1.65, opacity: 0.96,
    pressureFloor: 0.18, pressureRange: 1.45, velocityResponse: 0.28, tiltResponse: 0.08,
    taperStart: 0.1, taperEnd: 0.1, lineCap: 'round', lineJoin: 'round',
    composite: 'source-over', texture: 0.035,
  }),
  fineLiner: Object.freeze({
    id: 'fineLiner', label: 'Fine Liner', widthMultiplier: 0.62, opacity: 0.98,
    pressureFloor: 0.96, pressureRange: 0.06, velocityResponse: 0,
    taperStart: 0, taperEnd: 0, lineCap: 'round', lineJoin: 'round',
    composite: 'source-over', texture: 0,
  }),
  highlighter: Object.freeze({
    id: 'highlighter', label: 'Highlighter', widthMultiplier: 4, opacity: 0.28,
    pressureFloor: 0.92, pressureRange: 0.16, velocityResponse: 0,
    taperStart: 0, taperEnd: 0, lineCap: 'square', lineJoin: 'bevel',
    composite: 'multiply', texture: 0.025,
  }),
})

export const SPATIAL_BRUSH_IDS = Object.freeze(Object.keys(SPATIAL_BRUSH_DEFINITIONS))

export function isSpatialBrush(id) {
  return SPATIAL_BRUSH_IDS.includes(id)
}

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
