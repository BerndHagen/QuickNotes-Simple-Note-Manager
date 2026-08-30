import { generateId } from '../utils'
import { boundsFromPoints, clamp, normalizeBounds } from './geometry'
import { getSpatialBrushDefinition, SPATIAL_BRUSH_IDS } from './brushes'

export const SPATIAL_SCHEMA_VERSION = 1

export const SPATIAL_LIMITS = Object.freeze({
  MAX_PAGES: 200,
  MAX_OBJECTS_PER_NOTE: 25_000,
  MAX_POINTS_PER_STROKE: 20_000,
  MAX_TEXT_LENGTH: 20_000,
  MAX_COORDINATE: 1_000_000,
  MAX_RESOURCE_BYTES: 25 * 1024 * 1024,
  MIN_ZOOM: 0.1,
  MAX_ZOOM: 8,
})

export const PAPER_SIZES = Object.freeze({
  free: { name: 'Free', width: 900, height: 1200 },
  a4: { name: 'A4', width: 794, height: 1123 },
  a5: { name: 'A5', width: 559, height: 794 },
  letter: { name: 'Letter', width: 816, height: 1056 },
})

export const PAPER_PATTERNS = ['blank', 'ruled', 'dot', 'square', 'graph']
export const PAPER_SURFACES = ['white', 'warm', 'cream', 'dark']
export const STICKY_STYLES = Object.freeze({
  sunflower: { name: 'Sunflower', fill: '#f4e5a3', border: '#c9b561', text: '#29271f' },
  cream: { name: 'Cream', fill: '#f4ead2', border: '#c9baa0', text: '#2f2a22' },
  rose: { name: 'Rose', fill: '#edc9c5', border: '#bd938f', text: '#342524' },
  sage: { name: 'Sage', fill: '#cfe0cf', border: '#9ab19c', text: '#243027' },
  blue: { name: 'Blue', fill: '#cbdce6', border: '#96acb8', text: '#223039' },
  lavender: { name: 'Lavender', fill: '#d9d0e5', border: '#a89bb9', text: '#2d2834' },
})
export const SPATIAL_TOOLS = [
  'select', ...SPATIAL_BRUSH_IDS, 'eraser', 'hand',
  'line', 'arrow', 'rectangle', 'ellipse',
  'text', 'sticky', 'indexCard', 'noteLink', 'image',
]

const SPATIAL_OBJECT_KINDS = new Set(['stroke', 'shape', 'text', 'sticky', 'indexCard', 'noteLink', 'image'])
const SHAPE_KINDS = new Set(['line', 'arrow', 'rectangle', 'ellipse'])
const IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback
const coordinate = (value) => clamp(finite(value), -SPATIAL_LIMITS.MAX_COORDINATE, SPATIAL_LIMITS.MAX_COORDINATE)

export function createSpatialDocument(noteId, kind, ownerId = null) {
  if (kind !== 'paper' && kind !== 'canvas') throw new Error('A spatial document must be Paper or Canvas.')
  const now = new Date().toISOString()
  return {
    noteId,
    ownerId,
    kind,
    schemaVersion: SPATIAL_SCHEMA_VERSION,
    revision: 0,
    settings: kind === 'paper'
      ? { defaultSize: 'a4', defaultPattern: 'blank', defaultSurface: 'warm' }
      : { background: 'neutral' },
    viewport: kind === 'canvas'
      ? { panX: 0, panY: 0, zoom: 1 }
      : { panX: 0, panY: 0, zoom: 0.8 },
    createdAt: now,
    updatedAt: now,
  }
}

export function createPaperPage(noteId, ownerId = null, order = 0, input = {}) {
  const size = PAPER_SIZES[input.size] ? input.size : 'a4'
  const preset = PAPER_SIZES[size]
  const now = new Date().toISOString()
  return {
    id: generateId(),
    noteId,
    ownerId,
    schemaVersion: SPATIAL_SCHEMA_VERSION,
    order,
    name: String(input.name || `Page ${order + 1}`).slice(0, 120),
    size,
    width: size === 'free' ? clamp(finite(input.width, preset.width), 320, 4096) : preset.width,
    height: size === 'free' ? clamp(finite(input.height, preset.height), 320, 4096) : preset.height,
    pattern: PAPER_PATTERNS.includes(input.pattern) ? input.pattern : 'blank',
    surface: PAPER_SURFACES.includes(input.surface) ? input.surface : 'warm',
    createdAt: now,
    updatedAt: now,
  }
}

const baseObject = (noteId, pageId, kind, zIndex, ownerId) => {
  const now = new Date().toISOString()
  return {
    id: generateId(),
    noteId,
    pageId: pageId || null,
    ownerId: ownerId || null,
    schemaVersion: SPATIAL_SCHEMA_VERSION,
    kind,
    zIndex,
    createdAt: now,
    updatedAt: now,
  }
}

export function createStrokeObject({ noteId, pageId, ownerId, points, brush, color, width, opacity, zIndex }) {
  const safePoints = points.slice(0, SPATIAL_LIMITS.MAX_POINTS_PER_STROKE).map((point) => [
    coordinate(point[0]),
    coordinate(point[1]),
    clamp(finite(point[2], 0.5), 0, 1),
    clamp(finite(point[3]), -90, 90),
    clamp(finite(point[4]), -90, 90),
    Math.max(0, finite(point[5])),
  ])
  const safeWidth = clamp(finite(width, 2.5), 0.5, 64)
  const safeBrush = SPATIAL_BRUSH_IDS.includes(brush) ? brush : 'pen'
  const definition = getSpatialBrushDefinition(safeBrush)
  return {
    ...baseObject(noteId, pageId, 'stroke', zIndex, ownerId),
    bounds: boundsFromPoints(safePoints, safeWidth / 2 + 2),
    data: {
      points: safePoints,
      brush: safeBrush,
      color: String(color || '#18352a').slice(0, 32),
      width: safeWidth,
      opacity: clamp(finite(opacity, definition.opacity), 0.05, 1),
    },
  }
}

export function createShapeObject({ noteId, pageId, ownerId, shape, start, end, color, width, zIndex }) {
  const geometry = {
    x: coordinate(start.x),
    y: coordinate(start.y),
    width: coordinate(end.x) - coordinate(start.x),
    height: coordinate(end.y) - coordinate(start.y),
  }
  return {
    ...baseObject(noteId, pageId, 'shape', zIndex, ownerId),
    bounds: normalizeBounds(geometry),
    data: {
      shape: ['line', 'arrow', 'rectangle', 'ellipse'].includes(shape) ? shape : 'rectangle',
      geometry,
      color: String(color || '#18352a').slice(0, 32),
      width: clamp(finite(width, 2), 0.5, 32),
      fill: 'transparent',
    },
  }
}

export function createBoundedObject({ noteId, pageId, ownerId, kind, point, zIndex, text = '', targetNoteId = null, targetAnchorId = null, targetObjectId = null }) {
  const sizes = {
    text: { width: 240, height: 80 },
    sticky: { width: 220, height: 180 },
    indexCard: { width: 280, height: 180 },
    noteLink: { width: 240, height: 72 },
    image: { width: 320, height: 220 },
  }
  const safeKind = Object.hasOwn(sizes, kind) ? kind : 'text'
  const bounds = { x: coordinate(point.x), y: coordinate(point.y), ...sizes[safeKind] }
  const data = {
    text: String(text).slice(0, SPATIAL_LIMITS.MAX_TEXT_LENGTH),
    targetNoteId: targetNoteId || null,
    targetAnchorId: targetAnchorId || null,
    targetObjectId: targetObjectId || null,
    resourceId: null,
  }
  if (safeKind === 'sticky') {
    data.style = 'sunflower'
  }
  return {
    ...baseObject(noteId, pageId, safeKind, zIndex, ownerId),
    bounds,
    data,
  }
}

export function createImageResource(file, data, metadata = {}) {
  if (!file || !String(file.type).startsWith('image/')) throw new Error('A supported image file is required.')
  if (file.size <= 0 || file.size > SPATIAL_LIMITS.MAX_RESOURCE_BYTES) throw new Error('The image exceeds the spatial resource limit.')
  const now = new Date().toISOString()
  return {
    id: generateId(),
    ownerId: null,
    kind: 'image',
    mimeType: file.type,
    name: String(file.name || 'Image').slice(0, 255),
    byteSize: file.size,
    data,
    thumbnailData: typeof metadata.thumbnailData === 'string' ? metadata.thumbnailData : null,
    pixelWidth: clamp(finite(metadata.pixelWidth, 0), 0, 100_000),
    pixelHeight: clamp(finite(metadata.pixelHeight, 0), 0, 100_000),
    createdAt: now,
    updatedAt: now,
  }
}

export function createImageObject({ noteId, pageId, point, zIndex, resourceId, width, height }) {
  const object = createBoundedObject({ noteId, pageId, kind: 'image', point, zIndex })
  object.bounds.width = clamp(finite(width, 320), 48, 1200)
  object.bounds.height = clamp(finite(height, 220), 48, 1200)
  object.data.resourceId = resourceId
  return object
}

export function normalizeViewport(viewport, kind) {
  return {
    panX: kind === 'canvas' ? coordinate(viewport?.panX) : 0,
    panY: kind === 'canvas' ? coordinate(viewport?.panY) : 0,
    zoom: clamp(finite(viewport?.zoom, kind === 'canvas' ? 1 : 0.8), SPATIAL_LIMITS.MIN_ZOOM, SPATIAL_LIMITS.MAX_ZOOM),
  }
}

const assertSchemaVersion = (value, label) => {
  const version = Number(value || 1)
  if (!Number.isInteger(version) || version < 1) throw new Error(`${label} has an invalid schema version.`)
  if (version > SPATIAL_SCHEMA_VERSION) throw new Error(`${label} was created by a newer QuickNotes version.`)
}

const assertFiniteNumber = (value, label, maximum = SPATIAL_LIMITS.MAX_COORDINATE) => {
  if (!Number.isFinite(Number(value)) || Math.abs(Number(value)) > maximum) {
    throw new Error(`${label} contains invalid geometry.`)
  }
}

export function assertSpatialPage(page, document) {
  if (!page?.id || page.noteId !== document.noteId) throw new Error('Invalid Paper page identity.')
  assertSchemaVersion(page.schemaVersion, 'A Paper page')
  if (!PAPER_SIZES[page.size] || !PAPER_PATTERNS.includes(page.pattern) || !PAPER_SURFACES.includes(page.surface)) {
    throw new Error('A Paper page contains unsupported settings.')
  }
  assertFiniteNumber(page.order, 'A Paper page', 10_000)
  assertFiniteNumber(page.width, 'A Paper page', 4096)
  assertFiniteNumber(page.height, 'A Paper page', 4096)
  if (!Number.isInteger(Number(page.order)) || Number(page.order) < 0 || Number(page.width) < 320 || Number(page.height) < 320 || String(page.name || '').length > 120) {
    throw new Error('A Paper page contains invalid dimensions or metadata.')
  }
  return true
}

export function assertSpatialObject(object, document, pageIds = new Set()) {
  if (!object?.id || object.noteId !== document.noteId || !SPATIAL_OBJECT_KINDS.has(object.kind)) {
    throw new Error('Invalid spatial object identity or type.')
  }
  assertSchemaVersion(object.schemaVersion, 'A spatial object')
  if (document.kind === 'paper' && !pageIds.has(object.pageId)) throw new Error('A Paper object references a missing page.')
  if (document.kind === 'canvas' && object.pageId != null) throw new Error('A Canvas object cannot reference a Paper page.')
  assertFiniteNumber(object.zIndex, 'A spatial object', 1_000_000)
  for (const key of ['x', 'y', 'width', 'height']) {
    assertFiniteNumber(object.bounds?.[key], 'A spatial object', SPATIAL_LIMITS.MAX_COORDINATE * 2)
  }
  if (Number(object.bounds.width) < 0 || Number(object.bounds.height) < 0) throw new Error('A spatial object contains negative bounds.')

  const data = object.data
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('A spatial object contains invalid data.')
  if (object.kind === 'stroke') {
    if (!Array.isArray(data.points) || data.points.length === 0 || data.points.length > SPATIAL_LIMITS.MAX_POINTS_PER_STROKE) {
      throw new Error('A stroke is invalid or contains too many points.')
    }
    for (const point of data.points) {
      if (!Array.isArray(point) || point.length < 2 || point.length > 6) throw new Error('A stroke contains an invalid point.')
      point.forEach((value, index) => assertFiniteNumber(value, 'A stroke point', index < 2 ? SPATIAL_LIMITS.MAX_COORDINATE : 1_000_000_000))
      if (point[2] != null && (point[2] < 0 || point[2] > 1)) throw new Error('A stroke contains invalid pressure data.')
      if (point[3] != null && Math.abs(point[3]) > 90) throw new Error('A stroke contains invalid tilt data.')
      if (point[4] != null && Math.abs(point[4]) > 90) throw new Error('A stroke contains invalid tilt data.')
      if (point[5] != null && point[5] < 0) throw new Error('A stroke contains an invalid timestamp.')
    }
    if (!SPATIAL_BRUSH_IDS.includes(data.brush)) throw new Error('A stroke contains an unsupported brush.')
    assertFiniteNumber(data.width, 'A stroke', 64)
    assertFiniteNumber(data.opacity, 'A stroke', 1)
    if (data.width < 0.5 || data.opacity < 0.05) throw new Error('A stroke contains invalid brush settings.')
    if (data.hidden != null && typeof data.hidden !== 'boolean') throw new Error('A stroke contains invalid visibility metadata.')
  } else if (object.kind === 'shape') {
    if (!SHAPE_KINDS.has(data.shape)) throw new Error('A shape contains an unsupported type.')
    for (const key of ['x', 'y', 'width', 'height']) assertFiniteNumber(data.geometry?.[key], 'A shape', SPATIAL_LIMITS.MAX_COORDINATE * 2)
    if (data.sourceStrokeIds != null && (
      !Array.isArray(data.sourceStrokeIds) ||
      data.sourceStrokeIds.length > 100 ||
      data.sourceStrokeIds.some((id) => typeof id !== 'string' || !id || id.length > 128)
    )) throw new Error('A converted shape contains invalid source identities.')
  } else if (['text', 'sticky', 'indexCard'].includes(object.kind)) {
    if (typeof data.text !== 'string' || data.text.length > SPATIAL_LIMITS.MAX_TEXT_LENGTH) throw new Error('A text object is invalid or too long.')
    if (object.kind === 'sticky') {
      if (data.style != null && !Object.hasOwn(STICKY_STYLES, data.style)) throw new Error('A sticky note contains an unsupported colour.')
    }
  } else if (object.kind === 'noteLink') {
    for (const identity of ['targetNoteId', 'targetAnchorId', 'targetObjectId']) {
      if (data[identity] != null && (typeof data[identity] !== 'string' || data[identity].length > 128)) {
        throw new Error('A note link contains an invalid target.')
      }
    }
  } else if (object.kind === 'image' && (typeof data.resourceId !== 'string' || data.resourceId.length > 128)) {
    throw new Error('An image placement contains an invalid resource reference.')
  }
  return true
}

export function assertSpatialResource(resource) {
  if (!resource?.id || resource.kind !== 'image' || !IMAGE_MIME_TYPES.has(resource.mimeType)) {
    throw new Error('A spatial resource has an invalid identity or type.')
  }
  if (!Number.isInteger(Number(resource.byteSize)) || resource.byteSize <= 0 || resource.byteSize > SPATIAL_LIMITS.MAX_RESOURCE_BYTES) {
    throw new Error('A spatial resource exceeds the size limit.')
  }
  const prefix = `data:${resource.mimeType};base64,`
  if (typeof resource.data !== 'string' || !resource.data.startsWith(prefix) || resource.data.length > Math.ceil(SPATIAL_LIMITS.MAX_RESOURCE_BYTES * 4 / 3) + 256) {
    throw new Error('A spatial resource contains invalid image data.')
  }
  if (resource.thumbnailData != null && (
    typeof resource.thumbnailData !== 'string' ||
    !['data:image/png;base64,', 'data:image/jpeg;base64,'].some((value) => resource.thumbnailData.startsWith(value)) ||
    resource.thumbnailData.length > 10 * 1024 * 1024
  )) throw new Error('A spatial resource contains an invalid display thumbnail.')
  if (resource.pixelWidth) assertFiniteNumber(resource.pixelWidth, 'A spatial resource', 100_000)
  if (resource.pixelHeight) assertFiniteNumber(resource.pixelHeight, 'A spatial resource', 100_000)
  return true
}

export function assertSpatialPayload({ document, pages, objects, resources = null }) {
  if (!document || !['paper', 'canvas'].includes(document.kind)) throw new Error('Invalid spatial document.')
  if (!document.noteId) throw new Error('Invalid spatial document identity.')
  assertSchemaVersion(document.schemaVersion, 'This spatial document')
  if (!Number.isInteger(Number(document.revision || 0)) || Number(document.revision || 0) < 0) throw new Error('Invalid spatial document revision.')
  if (!document.settings || typeof document.settings !== 'object' || Array.isArray(document.settings)) throw new Error('Invalid spatial document settings.')
  const normalizedViewport = normalizeViewport(document.viewport, document.kind)
  if (
    Number(document.viewport?.zoom ?? normalizedViewport.zoom) !== normalizedViewport.zoom ||
    Number(document.viewport?.panX ?? normalizedViewport.panX) !== normalizedViewport.panX ||
    Number(document.viewport?.panY ?? normalizedViewport.panY) !== normalizedViewport.panY
  ) throw new Error('Invalid spatial document viewport.')
  if (!Array.isArray(pages) || !Array.isArray(objects)) throw new Error('Invalid spatial document collections.')
  if (pages.length > SPATIAL_LIMITS.MAX_PAGES) throw new Error('This Paper document has too many pages.')
  if (objects.length > SPATIAL_LIMITS.MAX_OBJECTS_PER_NOTE) throw new Error('This spatial document has too many objects.')
  if (document.kind === 'canvas' && pages.length > 0) throw new Error('A Canvas document cannot contain Paper pages.')
  const pageIds = new Set(pages.map((page) => page.id))
  if (pageIds.size !== pages.length) throw new Error('A spatial document contains duplicate page identities.')
  if (new Set(pages.map((page) => page.order)).size !== pages.length) throw new Error('A spatial document contains duplicate page order values.')
  pages.forEach((page) => assertSpatialPage(page, document))
  const objectIds = new Set(objects.map((object) => object.id))
  if (objectIds.size !== objects.length) throw new Error('A spatial document contains duplicate object identities.')
  objects.forEach((object) => assertSpatialObject(object, document, pageIds))
  if (resources) {
    if (!Array.isArray(resources)) throw new Error('Invalid spatial resource collection.')
    resources.forEach(assertSpatialResource)
    const resourceIds = new Set(resources.map((resource) => resource.id))
    if (resourceIds.size !== resources.length) throw new Error('A spatial document contains duplicate resource identities.')
    for (const object of objects) {
      if (object.kind === 'image' && !resourceIds.has(object.data.resourceId)) {
        throw new Error('An image placement references a missing resource.')
      }
    }
  }
  return true
}
