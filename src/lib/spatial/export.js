import { boundsIntersect, normalizeBounds } from './geometry'
import { drawAllSpatialObjects } from './renderer'

const SURFACE_COLORS = {
  white: '#ffffff',
  warm: '#fffdf8',
  cream: '#fbf4df',
  dark: '#202722',
}

const safeFilename = (value, extension) => {
  const name = String(value || 'QuickNotes spatial note')
    .replace(/[^a-z0-9_-]/gi, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 72) || 'QuickNotes_spatial_note'
  return `${name}.${extension}`
}

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
}

const canvasToBlob = (canvas, type = 'image/png', quality) => new Promise((resolve, reject) => {
  canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not encode the spatial export.')), type, quality)
})

export function drawPaperBackground(context, page, width = page.width, height = page.height) {
  context.fillStyle = SURFACE_COLORS[page.surface] || SURFACE_COLORS.warm
  context.fillRect(0, 0, width, height)
  if (page.pattern === 'blank') return
  const dark = page.surface === 'dark'
  context.save()
  context.strokeStyle = dark ? 'rgba(225,236,229,.15)' : 'rgba(68,102,86,.16)'
  context.fillStyle = dark ? 'rgba(225,236,229,.25)' : 'rgba(68,102,86,.25)'
  context.lineWidth = 1
  const step = page.pattern === 'ruled' ? 28 : page.pattern === 'graph' ? 16 : 24
  if (page.pattern === 'dot') {
    for (let y = step; y < height; y += step) {
      for (let x = step; x < width; x += step) {
        context.beginPath()
        context.arc(x, y, 1.1, 0, Math.PI * 2)
        context.fill()
      }
    }
  } else {
    for (let y = step; y < height; y += step) {
      context.beginPath()
      context.moveTo(0, y + 0.5)
      context.lineTo(width, y + 0.5)
      context.stroke()
    }
    if (page.pattern === 'square' || page.pattern === 'graph') {
      for (let x = step; x < width; x += step) {
        context.beginPath()
        context.moveTo(x + 0.5, 0)
        context.lineTo(x + 0.5, height)
        context.stroke()
      }
    }
  }
  context.restore()
}

export function renderPaperPage(page, objects, resolveNoteTitle, resolveResource, scale = 2) {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(page.width * scale))
  canvas.height = Math.max(1, Math.round(page.height * scale))
  const context = canvas.getContext('2d', { alpha: false })
  context.scale(scale, scale)
  drawPaperBackground(context, page)
  drawAllSpatialObjects(context, objects, resolveNoteTitle, resolveResource)
  return canvas
}

const spatialBounds = (objects) => {
  if (objects.length === 0) return { x: -600, y: -400, width: 1200, height: 800 }
  const normalized = objects.map((object) => normalizeBounds(object.bounds))
  const minX = Math.min(...normalized.map((bounds) => bounds.x))
  const minY = Math.min(...normalized.map((bounds) => bounds.y))
  const maxX = Math.max(...normalized.map((bounds) => bounds.x + bounds.width))
  const maxY = Math.max(...normalized.map((bounds) => bounds.y + bounds.height))
  const padding = 80
  return {
    x: minX - padding,
    y: minY - padding,
    width: Math.max(320, maxX - minX + padding * 2),
    height: Math.max(240, maxY - minY + padding * 2),
  }
}

export function renderCanvasDocument(objects, resolveNoteTitle, resolveResource) {
  const bounds = spatialBounds(objects)
  const scale = Math.min(2, 4096 / Math.max(bounds.width, bounds.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bounds.width * scale))
  canvas.height = Math.max(1, Math.round(bounds.height * scale))
  const context = canvas.getContext('2d', { alpha: false })
  context.fillStyle = '#f3f1eb'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.setTransform(scale, 0, 0, scale, -bounds.x * scale, -bounds.y * scale)
  const visible = objects.filter((object) => boundsIntersect(object.bounds, bounds))
  drawAllSpatialObjects(context, visible, resolveNoteTitle, resolveResource)
  return canvas
}

const loadResourceImages = async (resources = []) => {
  const entries = await Promise.all(resources.filter((resource) => resource.kind === 'image').map((resource) => new Promise((resolve) => {
    const image = new Image()
    image.onload = () => resolve([resource.id, { ...resource, image }])
    image.onerror = () => resolve([resource.id, resource])
    image.src = resource.data
  })))
  return new Map(entries)
}

export async function exportSpatialPng({ kind, noteTitle, page, objects, resources, resolveNoteTitle }) {
  const resourceMap = await loadResourceImages(resources)
  const resolveResource = (id) => resourceMap.get(id)
  const canvas = kind === 'paper'
    ? renderPaperPage(page, objects.filter((object) => object.pageId === page.id), resolveNoteTitle, resolveResource)
    : renderCanvasDocument(objects, resolveNoteTitle, resolveResource)
  const blob = await canvasToBlob(canvas)
  downloadBlob(blob, safeFilename(kind === 'paper' ? `${noteTitle}_${page.name}` : noteTitle, 'png'))
  return blob
}

export async function exportSpatialPdf({ kind, noteTitle, pages, objects, resources, resolveNoteTitle }) {
  const { jsPDF } = await import('jspdf')
  const resourceMap = await loadResourceImages(resources)
  const resolveResource = (id) => resourceMap.get(id)
  const canvases = kind === 'paper'
    ? pages.map((page) => ({
        page,
        canvas: renderPaperPage(page, objects.filter((object) => object.pageId === page.id), resolveNoteTitle, resolveResource),
      }))
    : [{ page: null, canvas: renderCanvasDocument(objects, resolveNoteTitle, resolveResource) }]
  if (canvases.length === 0) throw new Error('There is no spatial content to export.')

  const first = canvases[0].canvas
  const pdf = new jsPDF({
    orientation: first.width >= first.height ? 'landscape' : 'portrait',
    unit: 'px',
    format: [first.width, first.height],
    compress: true,
  })
  pdf.setProperties({ title: noteTitle || 'QuickNotes spatial note', creator: 'QuickNotes' })
  canvases.forEach(({ canvas }, index) => {
    if (index > 0) {
      pdf.addPage([canvas.width, canvas.height], canvas.width >= canvas.height ? 'landscape' : 'portrait')
    }
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, canvas.width, canvas.height, undefined, 'FAST')
  })
  const blob = pdf.output('blob')
  downloadBlob(blob, safeFilename(noteTitle, 'pdf'))
  return blob
}
