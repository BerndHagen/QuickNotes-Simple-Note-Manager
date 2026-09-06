import { clamp } from './geometry'
import { SPATIAL_LIMITS } from './model'

const PAPER_MAX_COMPACT_ZOOM = 0.8
const PAPER_INLINE_PADDING = 24
const CANVAS_PADDING = 32

export function fitPaperViewport(page, availableWidth) {
  const width = Number(page?.width)
  const stageWidth = Number(availableWidth)
  const zoom = width > 0 && stageWidth > 0
    ? clamp(
        (stageWidth - PAPER_INLINE_PADDING) / width,
        SPATIAL_LIMITS.MIN_ZOOM,
        PAPER_MAX_COMPACT_ZOOM,
      )
    : Math.min(PAPER_MAX_COMPACT_ZOOM, 1)

  return { panX: 0, panY: 0, zoom }
}

export function fitCanvasViewport(objects, availableWidth, availableHeight) {
  const visible = (objects || []).filter((object) => (
    !object?.data?.hidden
    && Number.isFinite(object?.bounds?.x)
    && Number.isFinite(object?.bounds?.y)
    && Number.isFinite(object?.bounds?.width)
    && Number.isFinite(object?.bounds?.height)
  ))
  if (visible.length === 0) return { panX: 0, panY: 0, zoom: 1 }

  const left = Math.min(...visible.map((object) => object.bounds.x))
  const top = Math.min(...visible.map((object) => object.bounds.y))
  const right = Math.max(...visible.map((object) => object.bounds.x + object.bounds.width))
  const bottom = Math.max(...visible.map((object) => object.bounds.y + object.bounds.height))
  const contentWidth = Math.max(1, right - left)
  const contentHeight = Math.max(1, bottom - top)
  const stageWidth = Math.max(1, Number(availableWidth) || 1)
  const stageHeight = Math.max(1, Number(availableHeight) || 1)
  const zoom = clamp(
    Math.min(
      1,
      (stageWidth - CANVAS_PADDING * 2) / contentWidth,
      (stageHeight - CANVAS_PADDING * 2) / contentHeight,
    ),
    SPATIAL_LIMITS.MIN_ZOOM,
    SPATIAL_LIMITS.MAX_ZOOM,
  )
  const centerX = left + contentWidth / 2
  const centerY = top + contentHeight / 2

  return {
    panX: stageWidth / 2 - centerX * zoom,
    panY: stageHeight / 2 - centerY * zoom,
    zoom,
  }
}
