import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { NodeViewContent, NodeViewWrapper } from '@tiptap/react'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  FlipHorizontal,
  FlipVertical,
  RotateCcw,
  RotateCw,
  Trash2,
} from 'lucide-react'

const SHAPES = [
  { value: 'rectangle', label: 'Rectangle' },
  { value: 'rounded', label: 'Rounded rectangle' },
  { value: 'ellipse', label: 'Ellipse' },
  { value: 'diamond', label: 'Diamond' },
  { value: 'arrow', label: 'Right arrow' },
]

const FILLS = [
  { value: 'accent', label: 'Green' },
  { value: 'info', label: 'Blue' },
  { value: 'warning', label: 'Amber' },
  { value: 'neutral', label: 'Neutral' },
]

const MIN_WIDTH = 96
const MIN_HEIGHT = 56
const MAX_DIMENSION = 1200

const normalizeAngle = (value) => ((Math.round(value) % 360) + 360) % 360
const clampDimension = (value, minimum) => Math.min(MAX_DIMENSION, Math.max(minimum, value))

function ControlButton({ icon: Icon, label, active, tone, onClick }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active === undefined ? undefined : !!active}
      title={label}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-control transition-colors ${
        tone === 'danger'
          ? 'text-danger-text hover:bg-danger-soft'
          : active
            ? 'bg-accent-soft text-accent-text'
            : 'text-content-muted hover:bg-surface-hover hover:text-content'
      }`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
    </button>
  )
}

export default function ShapeView({ node, updateAttributes, deleteNode, selected, editor, getPos }) {
  const { shapeType, width, height, rotation, flipH, flipV, align, fill } = node.attrs
  const wrapperRef = useRef(null)
  const controlId = useId().replaceAll(':', '')
  const [resize, setResize] = useState(null)
  const [rotate, setRotate] = useState(null)
  const [active, setActive] = useState(selected)
  const editable = editor?.isEditable !== false

  useEffect(() => {
    if (!editor) return undefined
    const sync = () => {
      const pos = typeof getPos === 'function' ? getPos() : null
      if (!Number.isFinite(pos)) return setActive(!!selected)
      const { from, to } = editor.state.selection
      setActive(!!selected || (from >= pos && to <= pos + node.nodeSize))
    }
    sync()
    editor.on('selectionUpdate', sync)
    editor.on('transaction', sync)
    return () => {
      editor.off('selectionUpdate', sync)
      editor.off('transaction', sync)
    }
  }, [editor, getPos, node.nodeSize, selected])

  const liveWidth = resize?.currentWidth ?? width
  const liveHeight = resize?.currentHeight ?? height
  const liveRotation = rotate?.currentRotation ?? rotation

  const startResize = useCallback(
    (event) => {
      if (!editable) return
      event.preventDefault()
      event.stopPropagation()
      event.currentTarget.setPointerCapture?.(event.pointerId)
      setResize({
        startX: event.clientX,
        startY: event.clientY,
        originWidth: width,
        originHeight: height,
        currentWidth: width,
        currentHeight: height,
      })
    },
    [editable, height, width]
  )

  const startRotate = useCallback(
    (event) => {
      if (!editable) return
      event.preventDefault()
      event.stopPropagation()
      const rect = wrapperRef.current?.getBoundingClientRect()
      if (!rect) return
      const centreX = rect.left + rect.width / 2
      const centreY = rect.top + rect.height / 2
      const pointerAngle = Math.atan2(event.clientY - centreY, event.clientX - centreX) * (180 / Math.PI)
      setRotate({ centreX, centreY, offset: pointerAngle - rotation, currentRotation: rotation })
    },
    [editable, rotation]
  )

  useEffect(() => {
    if (!resize && !rotate) return undefined
    const onMove = (event) => {
      if (resize) {
        setResize((value) => {
          if (!value) return value
          const nextWidth = clampDimension(value.originWidth + event.clientX - value.startX, MIN_WIDTH)
          const nextHeight = clampDimension(value.originHeight + event.clientY - value.startY, MIN_HEIGHT)
          if (!event.shiftKey) return { ...value, currentWidth: nextWidth, currentHeight: nextHeight }
          const ratio = value.originWidth / value.originHeight
          const widthChange = Math.abs(nextWidth - value.originWidth)
          const heightChange = Math.abs(nextHeight - value.originHeight)
          return widthChange >= heightChange
            ? { ...value, currentWidth: nextWidth, currentHeight: clampDimension(nextWidth / ratio, MIN_HEIGHT) }
            : { ...value, currentWidth: clampDimension(nextHeight * ratio, MIN_WIDTH), currentHeight: nextHeight }
        })
      }
      if (rotate) {
        setRotate((value) => {
          if (!value) return value
          const pointerAngle = Math.atan2(event.clientY - value.centreY, event.clientX - value.centreX) * (180 / Math.PI)
          let next = pointerAngle - value.offset
          if (event.shiftKey) next = Math.round(next / 15) * 15
          return { ...value, currentRotation: next }
        })
      }
    }
    const onUp = () => {
      if (resize) {
        updateAttributes({ width: Math.round(resize.currentWidth), height: Math.round(resize.currentHeight) })
        setResize(null)
      }
      if (rotate) {
        updateAttributes({ rotation: normalizeAngle(rotate.currentRotation) })
        setRotate(null)
      }
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [resize, rotate, updateAttributes])

  const transform = `rotate(${liveRotation || 0}deg) scale(${flipH ? -1 : 1}, ${flipV ? -1 : 1})`

  return (
    <NodeViewWrapper
      ref={wrapperRef}
      data-type="shape"
      data-shape={shapeType}
      data-fill={fill}
      data-width={Math.round(liveWidth)}
      data-height={Math.round(liveHeight)}
      data-rotation={normalizeAngle(liveRotation || 0)}
      data-flip-h={flipH || undefined}
      data-flip-v={flipV || undefined}
      data-align={align}
      className={`qn-shape group/shape relative ${active ? 'qn-shape--selected' : ''}`}
      style={{
        '--qn-shape-width': `${liveWidth}px`,
        width: `${liveWidth}px`,
        height: `${liveHeight}px`,
        marginLeft: align === 'right' || align === 'center' ? 'auto' : 0,
        marginRight: align === 'left' || align === 'center' ? 'auto' : 0,
      }}
    >
      {editable && active && (
        <div
          contentEditable={false}
          role="toolbar"
          aria-label="Shape formatting"
          className="qn-shape-toolbar absolute bottom-full left-1/2 z-30 mb-12 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-1 overflow-x-auto rounded-control border border-subtle bg-surface-raised p-1 shadow-md"
        >
          <label className="qn-sr-only" htmlFor={`shape-type-${controlId}`}>Shape type</label>
          <select
            id={`shape-type-${controlId}`}
            aria-label="Shape type"
            value={shapeType}
            onChange={(event) => updateAttributes({ shapeType: event.target.value })}
            className="h-7 rounded-control border border-subtle bg-surface-raised px-2 text-ui-sm text-content outline-none focus:border-accent"
          >
            {SHAPES.map((shape) => <option key={shape.value} value={shape.value}>{shape.label}</option>)}
          </select>
          <label className="qn-sr-only" htmlFor={`shape-fill-${controlId}`}>Shape colour</label>
          <select
            id={`shape-fill-${controlId}`}
            aria-label="Shape colour"
            value={fill}
            onChange={(event) => updateAttributes({ fill: event.target.value })}
            className="h-7 rounded-control border border-subtle bg-surface-raised px-2 text-ui-sm text-content outline-none focus:border-accent"
          >
            {FILLS.map((colour) => <option key={colour.value} value={colour.value}>{colour.label}</option>)}
          </select>
          <label className="flex h-7 items-center gap-1 rounded-control border border-subtle bg-surface-raised px-1.5 text-ui-xs font-semibold text-content-subtle">
            W
            <input
              type="number"
              min={MIN_WIDTH}
              max={MAX_DIMENSION}
              value={Math.round(width)}
              onChange={(event) => updateAttributes({ width: clampDimension(Number(event.target.value) || MIN_WIDTH, MIN_WIDTH) })}
              aria-label="Shape width"
              className="w-12 bg-transparent text-right text-ui-sm font-medium text-content outline-none"
            />
          </label>
          <label className="flex h-7 items-center gap-1 rounded-control border border-subtle bg-surface-raised px-1.5 text-ui-xs font-semibold text-content-subtle">
            H
            <input
              type="number"
              min={MIN_HEIGHT}
              max={MAX_DIMENSION}
              value={Math.round(height)}
              onChange={(event) => updateAttributes({ height: clampDimension(Number(event.target.value) || MIN_HEIGHT, MIN_HEIGHT) })}
              aria-label="Shape height"
              className="w-12 bg-transparent text-right text-ui-sm font-medium text-content outline-none"
            />
          </label>
          <span className="h-4 w-px shrink-0 bg-[var(--qn-border-subtle)]" />
          <ControlButton icon={RotateCcw} label="Rotate left 90 degrees" onClick={() => updateAttributes({ rotation: normalizeAngle(rotation - 90) })} />
          <ControlButton icon={RotateCw} label="Rotate right 90 degrees" onClick={() => updateAttributes({ rotation: normalizeAngle(rotation + 90) })} />
          <label className="flex h-7 items-center rounded-control border border-subtle bg-surface-raised px-1.5 text-ui-xs text-content-subtle">
            <input
              type="number"
              min="0"
              max="359"
              value={normalizeAngle(rotation)}
              onChange={(event) => updateAttributes({ rotation: normalizeAngle(Number(event.target.value) || 0) })}
              aria-label="Shape rotation in degrees"
              className="w-10 bg-transparent text-right text-ui-sm font-medium text-content outline-none"
            />°
          </label>
          <ControlButton icon={FlipHorizontal} label="Flip horizontally" active={flipH} onClick={() => updateAttributes({ flipH: !flipH })} />
          <ControlButton icon={FlipVertical} label="Flip vertically" active={flipV} onClick={() => updateAttributes({ flipV: !flipV })} />
          <span className="h-4 w-px shrink-0 bg-[var(--qn-border-subtle)]" />
          <ControlButton icon={AlignLeft} label="Align shape left" active={align === 'left'} onClick={() => updateAttributes({ align: 'left' })} />
          <ControlButton icon={AlignCenter} label="Align shape centre" active={align === 'center'} onClick={() => updateAttributes({ align: 'center' })} />
          <ControlButton icon={AlignRight} label="Align shape right" active={align === 'right'} onClick={() => updateAttributes({ align: 'right' })} />
          <ControlButton icon={Trash2} label="Delete shape" tone="danger" onClick={deleteNode} />
        </div>
      )}

      <div className="qn-shape__object" style={{ transform }}>
        <div className="qn-shape__surface">
          <NodeViewContent
            className="qn-shape__content"
            style={{ transform: `scale(${flipH ? -1 : 1}, ${flipV ? -1 : 1})` }}
          />
        </div>
      </div>

      {editable && active && (
        <>
          <span contentEditable={false} className="qn-shape__rotation-line absolute left-1/2 top-0 h-0 w-px -translate-x-1/2 -translate-y-5 bg-[var(--qn-accent)]" />
          <button
            type="button"
            contentEditable={false}
            aria-label="Drag to rotate shape; hold Shift to snap to 15 degrees"
            title="Drag to rotate · Shift snaps to 15°"
            onPointerDown={startRotate}
            className="absolute left-1/2 top-0 z-20 h-3.5 w-3.5 -translate-x-1/2 -translate-y-8 cursor-grab rounded-full border-2 border-accent bg-surface-raised shadow-sm active:cursor-grabbing"
          />
          <button
            type="button"
            contentEditable={false}
            aria-label="Drag to resize shape"
            title="Drag to resize · Shift keeps the current proportions"
            onPointerDown={startResize}
            className="absolute -bottom-1.5 -right-1.5 z-20 h-4 w-4 cursor-nwse-resize rounded-control border-2 border-accent bg-surface-raised shadow-sm"
          />
          <span contentEditable={false} className="qn-shape__size absolute bottom-1 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white">
            {Math.round(liveWidth)} × {Math.round(liveHeight)}
          </span>
        </>
      )}
    </NodeViewWrapper>
  )
}
