import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import {
  applyViewportTransform,
  configureCanvas,
  drawInkObjects,
  drawStrokeSegment,
} from '../../lib/spatial/renderer'

const clearCanvas = (canvas, context) => {
  context.save()
  context.setTransform(1, 0, 0, 1, 0, 0)
  context.clearRect(0, 0, canvas.width, canvas.height)
  context.restore()
}

const InkCanvas = forwardRef(function InkCanvas({ objects, viewport }, ref) {
  const committedRef = useRef(null)
  const activeRef = useRef(null)
  const transformRef = useRef({ viewport, ratio: 1 })
  const activeStrokeRef = useRef(null)

  useEffect(() => {
    const committed = committedRef.current
    const active = activeRef.current
    if (!committed || !active) return undefined

    const render = () => {
      // clientWidth/clientHeight stay in the surface's logical coordinate
      // system even when a Paper page is scaled by a parent transform.
      const width = committed.clientWidth || committed.getBoundingClientRect().width
      const height = committed.clientHeight || committed.getBoundingClientRect().height
      const committedCanvas = configureCanvas(committed, width, height)
      const activeCanvas = configureCanvas(active, width, height)
      clearCanvas(committed, committedCanvas.context)
      clearCanvas(active, activeCanvas.context)
      applyViewportTransform(committedCanvas.context, viewport, committedCanvas.ratio)
      applyViewportTransform(activeCanvas.context, viewport, activeCanvas.ratio)
      transformRef.current = { viewport, ratio: activeCanvas.ratio }
      const zoom = viewport.zoom || 1
      const visibleBounds = {
        x: -(viewport.panX || 0) / zoom,
        y: -(viewport.panY || 0) / zoom,
        width: width / zoom,
        height: height / zoom,
      }
      drawInkObjects(committedCanvas.context, objects, visibleBounds)
      const activeStroke = activeStrokeRef.current
      if (activeStroke?.points.length > 1) {
        activeStroke.points.slice(1).forEach((point, index) => {
          drawStrokeSegment(activeCanvas.context, activeStroke.points[index], point, {
            ...activeStroke.brush,
            pointIndex: index + 1,
            pointCount: activeStroke.points.length,
          })
        })
      }
    }

    render()
    const observer = new ResizeObserver(render)
    observer.observe(committed)
    window.addEventListener('resize', render)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', render)
    }
  }, [objects, viewport])

  useImperativeHandle(ref, () => ({
    clearActive() {
      activeStrokeRef.current = null
      const canvas = activeRef.current
      if (!canvas) return
      const context = canvas.getContext('2d')
      clearCanvas(canvas, context)
      applyViewportTransform(context, transformRef.current.viewport, transformRef.current.ratio)
    },
    drawSegment(previous, point, brush) {
      const canvas = activeRef.current
      if (!canvas) return
      const activeStroke = activeStrokeRef.current
      const last = activeStroke?.points.at(-1)
      if (!activeStroke || !last || last[0] !== previous[0] || last[1] !== previous[1]) {
        activeStrokeRef.current = { points: [previous, point], brush }
      } else {
        activeStroke.points.push(point)
        activeStroke.brush = brush
      }
      drawStrokeSegment(canvas.getContext('2d'), previous, point, brush)
    },
  }), [])

  return (
    <>
      <canvas ref={committedRef} className="qn-spatial-ink qn-spatial-ink--committed" aria-hidden="true" />
      <canvas ref={activeRef} className="qn-spatial-ink qn-spatial-ink--active" aria-hidden="true" />
    </>
  )
})

export default InkCanvas
