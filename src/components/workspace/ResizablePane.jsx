import { useEffect, useRef, useState } from 'react'

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

export default function ResizablePane({
  id,
  label,
  width,
  minWidth,
  maxWidth,
  edge = 'right',
  onResizeEnd,
  className = '',
  children,
}) {
  const [currentWidth, setCurrentWidth] = useState(() => clamp(width, minWidth, maxWidth))
  const currentWidthRef = useRef(currentWidth)
  const dragRef = useRef(null)

  useEffect(() => {
    const nextWidth = clamp(width, minWidth, maxWidth)
    currentWidthRef.current = nextWidth
    setCurrentWidth(nextWidth)
  }, [maxWidth, minWidth, width])

  const commitWidth = (nextWidth) => {
    const clamped = clamp(nextWidth, minWidth, maxWidth)
    currentWidthRef.current = clamped
    setCurrentWidth(clamped)
    onResizeEnd?.(clamped)
  }

  const handlePointerMove = (event) => {
    if (!dragRef.current) return
    const direction = edge === 'right' ? 1 : -1
    const nextWidth = clamp(
      dragRef.current.width + (event.clientX - dragRef.current.x) * direction,
      minWidth,
      maxWidth
    )
    currentWidthRef.current = nextWidth
    setCurrentWidth(nextWidth)
  }

  const handlePointerEnd = (event) => {
    if (!dragRef.current) return
    dragRef.current = null
    event.currentTarget.releasePointerCapture?.(event.pointerId)
    onResizeEnd?.(currentWidthRef.current)
  }

  return (
    <div
      id={id}
      className={`qn-resizable-pane relative min-h-0 shrink-0 ${className}`}
      style={{ width: `${currentWidth}px` }}
    >
      {children}
      <div
        role="separator"
        tabIndex={0}
        aria-label={`Resize ${label}`}
        aria-orientation="vertical"
        aria-valuemin={minWidth}
        aria-valuemax={maxWidth}
        aria-valuenow={Math.round(currentWidth)}
        className={`qn-pane-resizer qn-pane-resizer--${edge}`}
        onPointerDown={(event) => {
          event.preventDefault()
          dragRef.current = { x: event.clientX, width: currentWidthRef.current }
          event.currentTarget.setPointerCapture?.(event.pointerId)
        }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onKeyDown={(event) => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
          event.preventDefault()
          if (event.key === 'Home') return commitWidth(minWidth)
          if (event.key === 'End') return commitWidth(maxWidth)
          const visualDirection = event.key === 'ArrowRight' ? 1 : -1
          const direction = edge === 'right' ? visualDirection : -visualDirection
          commitWidth(currentWidthRef.current + direction * (event.shiftKey ? 24 : 8))
        }}
      />
    </div>
  )
}

