import { useEffect, useRef } from 'react'
import { drawPaperBackground } from '../../lib/spatial/export'
import { configureCanvas, drawAllSpatialObjects } from '../../lib/spatial/renderer'

export default function PaperPageThumbnail({ page, objects, resolveNoteTitle, resolveResource }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined

    let disposed = false
    const imageResources = new Map()
    const draw = () => {
      if (disposed) return
      const width = canvas.clientWidth || 48
      const height = canvas.clientHeight || Math.max(1, width * page.height / page.width)
      const configured = configureCanvas(canvas, width, height)
      const { context, ratio } = configured
      context.setTransform(1, 0, 0, 1, 0, 0)
      context.clearRect(0, 0, canvas.width, canvas.height)
      context.setTransform(
        ratio * width / page.width,
        0,
        0,
        ratio * height / page.height,
        0,
        0
      )
      drawPaperBackground(context, page)
      drawAllSpatialObjects(
        context,
        objects,
        resolveNoteTitle,
        (resourceId) => imageResources.get(resourceId) || resolveResource(resourceId)
      )
    }

    draw()
    const imageIds = new Set(
      objects.filter((object) => object.kind === 'image').map((object) => object.data?.resourceId)
    )
    for (const resourceId of imageIds) {
      const resource = resolveResource(resourceId)
      const source = resource?.thumbnailData || resource?.data
      if (!resource || typeof source !== 'string') continue
      const image = new Image()
      image.onload = () => {
        if (disposed) return
        imageResources.set(resourceId, { ...resource, image })
        draw()
      }
      image.src = source
    }

    const observer = new ResizeObserver(draw)
    observer.observe(canvas)
    return () => {
      disposed = true
      observer.disconnect()
    }
  }, [objects, page, resolveNoteTitle, resolveResource])

  return (
    <canvas
      ref={canvasRef}
      className="qn-paper-page-thumbnail"
      style={{ aspectRatio: `${page.width} / ${page.height}` }}
      aria-hidden="true"
    />
  )
}
