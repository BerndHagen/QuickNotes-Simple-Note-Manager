import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { NodeViewContent, NodeViewWrapper } from '@tiptap/react'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ChevronDown,
  FlipHorizontal,
  FlipVertical,
  Maximize2,
  Move,
  PaintBucket,
  RotateCcw,
  RotateCw,
  Shapes,
  Trash2,
  WrapText,
} from 'lucide-react'
import ShapeGeometry, { SHAPE_GROUPS } from './ShapeGeometry'
import { useAnchoredPosition } from './ui'

const FILLS = [
  { value: 'accent', label: 'Green' },
  { value: 'info', label: 'Blue' },
  { value: 'warning', label: 'Amber' },
  { value: 'neutral', label: 'Neutral' },
]

const LAYOUTS = [
  { value: 'inline', label: 'In line', description: 'Moves with the surrounding text.' },
  { value: 'left', label: 'Wrap left', description: 'Text flows along the right side.' },
  { value: 'right', label: 'Wrap right', description: 'Text flows along the left side.' },
  { value: 'absolute', label: 'Free position', description: 'Place and move the shape anywhere on the page.' },
]

const MIN_WIDTH = 96
const MIN_HEIGHT = 56
const MAX_DIMENSION = 1200
const RESIZE_HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

const normalizeAngle = (value) => ((Math.round(value) % 360) + 360) % 360
const clampDimension = (value, minimum) => Math.min(MAX_DIMENSION, Math.max(minimum, value))
const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value))

function useAnchoredLayer(open, anchorRef, layerRef, gap = 8, refreshKey = '') {
  const [position, setPosition] = useState({ left: 8, top: 8 })

  useLayoutEffect(() => {
    if (!open) return undefined
    const update = () => {
      const anchor = anchorRef.current?.getBoundingClientRect()
      const layer = layerRef.current?.getBoundingClientRect()
      if (!anchor || !layer) return
      const viewportPadding = 8
      const roomBelow = window.innerHeight - anchor.bottom
      const top = roomBelow >= layer.height + gap
        ? anchor.bottom + gap
        : Math.max(viewportPadding, anchor.top - layer.height - gap)
      setPosition({
        left: clamp(anchor.left + anchor.width / 2 - layer.width / 2, viewportPadding, window.innerWidth - layer.width - viewportPadding),
        top,
      })
    }
    update()
    const frame = requestAnimationFrame(update)
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [anchorRef, gap, layerRef, open, refreshKey])

  return position
}

function FloatingPanel({ open, anchorRef, onClose, label, className = '', children }) {
  const { floatingRef: panelRef, style } = useAnchoredPosition({
    anchorRef,
    open,
    placement: 'bottom-start',
    offset: 8,
  })

  useEffect(() => {
    if (!open) return undefined
    const dismiss = (event) => {
      if (panelRef.current?.contains(event.target) || anchorRef.current?.contains(event.target)) return
      onClose()
    }
    const escape = (event) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('pointerdown', dismiss)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', dismiss)
      document.removeEventListener('keydown', escape)
    }
  }, [anchorRef, onClose, open, panelRef])

  if (!open) return null
  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label={label}
      className={`fixed z-[99999] max-h-[min(28rem,calc(100dvh-1rem))] overflow-y-auto rounded-card border border-subtle bg-surface-raised p-2 shadow-lg ${className}`}
      style={style}
      contentEditable={false}
    >
      {children}
    </div>,
    document.body
  )
}

function ControlButton({ icon: Icon, label, active, tone, onClick, children, buttonRef }) {
  return (
    <button
      ref={buttonRef}
      type="button"
      aria-label={label}
      aria-pressed={active === undefined ? undefined : !!active}
      title={label}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={`flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-control px-2 text-ui-sm font-medium leading-none transition-colors ${
        tone === 'danger'
          ? 'text-danger-text hover:bg-danger-soft'
          : active
            ? 'bg-accent-soft text-accent-text'
            : 'text-content-muted hover:bg-surface-hover hover:text-content'
      }`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {children}
    </button>
  )
}

export default function ShapeView({ node, updateAttributes, deleteNode, selected, editor, getPos }) {
  const { shapeType, width, height, rotation, flipH, flipV, align, fill, wrap, x, y } = node.attrs
  const wrapperRef = useRef(null)
  const toolbarRef = useRef(null)
  const shapeButtonRef = useRef(null)
  const layoutButtonRef = useRef(null)
  const fillButtonRef = useRef(null)
  const formatButtonRef = useRef(null)
  const resizeRef = useRef(null)
  const rotateRef = useRef(null)
  const moveRef = useRef(null)
  const [resize, setResize] = useState(null)
  const [rotate, setRotate] = useState(null)
  const [move, setMove] = useState(null)
  const [active, setActive] = useState(selected)
  const [openPanel, setOpenPanel] = useState(null)
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

  useEffect(() => {
    if (!active) setOpenPanel(null)
  }, [active])

  const liveWidth = resize?.currentWidth ?? width
  const liveHeight = resize?.currentHeight ?? height
  const liveRotation = rotate?.currentRotation ?? rotation
  const liveX = resize?.currentX ?? move?.currentX ?? x ?? 0
  const liveY = resize?.currentY ?? move?.currentY ?? y ?? 0
  const effectiveWrap = move ? 'absolute' : wrap

  const startMove = useCallback((event) => {
    if (!editable) return
    event.preventDefault()
    event.stopPropagation()
    setOpenPanel(null)
    event.currentTarget.setPointerCapture?.(event.pointerId)
    const shapeRect = wrapperRef.current?.getBoundingClientRect()
    const editorRect = wrapperRef.current?.closest('.ProseMirror')?.getBoundingClientRect()
    const originX = wrap === 'absolute' || wrap === 'free'
      ? x || 0
      : shapeRect && editorRect ? shapeRect.left - editorRect.left : 0
    const originY = wrap === 'absolute' || wrap === 'free'
      ? y || 0
      : shapeRect && editorRect ? shapeRect.top - editorRect.top : 0
    const nextMove = {
      startX: event.clientX,
      startY: event.clientY,
      originX,
      originY,
      currentX: originX,
      currentY: originY,
      minDeltaX: shapeRect && editorRect ? editorRect.left + 8 - shapeRect.left : -MAX_DIMENSION,
      maxDeltaX: shapeRect && editorRect ? editorRect.right - 8 - shapeRect.right : MAX_DIMENSION,
      minDeltaY: shapeRect && editorRect ? editorRect.top + 8 - shapeRect.top : -MAX_DIMENSION,
      maxDeltaY: MAX_DIMENSION,
    }
    moveRef.current = nextMove
    setMove(nextMove)
  }, [editable, wrap, x, y])

  const startResize = useCallback((event, direction = 'se') => {
    if (!editable) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    const editorRect = wrapperRef.current?.closest('.ProseMirror')?.getBoundingClientRect()
    const nextResize = {
      startX: event.clientX,
      startY: event.clientY,
      originWidth: width,
      originHeight: height,
      originX: x || 0,
      originY: y || 0,
      currentX: x || 0,
      currentY: y || 0,
      direction,
      currentWidth: width,
      currentHeight: height,
      editorWidth: editorRect?.width || MAX_DIMENSION,
    }
    resizeRef.current = nextResize
    setResize(nextResize)
  }, [editable, height, width, x, y])

  const startRotate = useCallback((event) => {
    if (!editable) return
    event.preventDefault()
    event.stopPropagation()
    const rect = wrapperRef.current?.getBoundingClientRect()
    if (!rect) return
    const centreX = rect.left + rect.width / 2
    const centreY = rect.top + rect.height / 2
    const pointerAngle = Math.atan2(event.clientY - centreY, event.clientX - centreX) * (180 / Math.PI)
    const nextRotate = { centreX, centreY, offset: pointerAngle - rotation, currentRotation: rotation }
    rotateRef.current = nextRotate
    setRotate(nextRotate)
  }, [editable, rotation])

  const hasActiveGesture = Boolean(resize || rotate || move)

  useEffect(() => {
    if (!hasActiveGesture) return undefined
    const onMove = (event) => {
      if (moveRef.current) {
        const value = moveRef.current
        const deltaX = clamp(event.clientX - value.startX, value.minDeltaX, value.maxDeltaX)
        const next = {
          ...value,
          currentX: value.originX + deltaX,
          currentY: value.originY + clamp(event.clientY - value.startY, value.minDeltaY, value.maxDeltaY),
        }
        moveRef.current = next
        setMove(next)
      }
      if (resizeRef.current) {
          const value = resizeRef.current
          const dx = event.clientX - value.startX
          const dy = event.clientY - value.startY
          const west = value.direction.includes('w')
          const east = value.direction.includes('e')
          const north = value.direction.includes('n')
          const south = value.direction.includes('s')
          const maximumWidth = wrap === 'absolute' || wrap === 'free'
            ? east
              ? Math.max(MIN_WIDTH, value.editorWidth - value.originX - 8)
              : west
                ? Math.max(MIN_WIDTH, value.originX + value.originWidth - 8)
                : MAX_DIMENSION
            : MAX_DIMENSION
          const nextWidth = Math.min(
            maximumWidth,
            clampDimension(value.originWidth + (east ? dx : west ? -dx : 0), MIN_WIDTH)
          )
          const nextHeight = clampDimension(value.originHeight + (south ? dy : north ? -dy : 0), MIN_HEIGHT)
          const geometry = {
            ...value,
            currentWidth: nextWidth,
            currentHeight: nextHeight,
            currentX: west ? value.originX + value.originWidth - nextWidth : value.originX,
            currentY: north ? Math.max(0, value.originY + value.originHeight - nextHeight) : value.originY,
          }
          const ratio = value.originWidth / value.originHeight
          const next = !event.shiftKey || (!east && !west) || (!north && !south)
            ? geometry
            : Math.abs(nextWidth - value.originWidth) >= Math.abs(nextHeight - value.originHeight)
            ? { ...geometry, currentWidth: nextWidth, currentHeight: clampDimension(nextWidth / ratio, MIN_HEIGHT) }
            : { ...geometry, currentWidth: clampDimension(nextHeight * ratio, MIN_WIDTH), currentHeight: nextHeight }
          resizeRef.current = next
          setResize(next)
      }
      if (rotateRef.current) {
          const value = rotateRef.current
          const pointerAngle = Math.atan2(event.clientY - value.centreY, event.clientX - value.centreX) * (180 / Math.PI)
          let next = pointerAngle - value.offset
          if (event.shiftKey) next = Math.round(next / 15) * 15
          const nextRotate = { ...value, currentRotation: next }
          rotateRef.current = nextRotate
          setRotate(nextRotate)
      }
    }
    const onUp = () => {
      if (moveRef.current) {
        const value = moveRef.current
        moveRef.current = null
        updateAttributes({ wrap: 'absolute', x: Math.round(value.currentX), y: Math.round(value.currentY) })
        setMove(null)
      }
      if (resizeRef.current) {
        const value = resizeRef.current
        resizeRef.current = null
        updateAttributes({
          width: Math.round(value.currentWidth),
          height: Math.round(value.currentHeight),
          ...((wrap === 'absolute' || wrap === 'free') ? { x: Math.round(value.currentX), y: Math.round(value.currentY) } : {}),
        })
        setResize(null)
      }
      if (rotateRef.current) {
        const value = rotateRef.current
        rotateRef.current = null
        updateAttributes({ rotation: normalizeAngle(value.currentRotation) })
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
  }, [hasActiveGesture, updateAttributes, wrap])

  // Leave room for the rotation stem and handle instead of covering them with
  // the contextual toolbar.
  const toolbarPosition = useAnchoredLayer(
    editable && active,
    wrapperRef,
    toolbarRef,
    44,
    `${liveX}:${liveY}:${liveWidth}:${liveHeight}`
  )
  const transform = `rotate(${liveRotation || 0}deg) scale(${flipH ? -1 : 1}, ${flipV ? -1 : 1})`
  const wrapperStyle = {
    '--qn-shape-width': `${liveWidth}px`,
    width: `${liveWidth}px`,
    height: `${liveHeight}px`,
    ...((effectiveWrap === 'absolute' || effectiveWrap === 'free')
      ? {
          position: 'absolute',
          left: `${liveX}px`,
          top: `${liveY}px`,
          zIndex: active ? 20 : 10,
          margin: 0,
        }
      : {}),
    ...(effectiveWrap === 'left' ? { float: 'left', margin: '4px 16px 12px 0' } : {}),
    ...(effectiveWrap === 'right' ? { float: 'right', margin: '4px 0 12px 16px' } : {}),
    ...(effectiveWrap === 'inline'
      ? {
          marginLeft: align === 'right' || align === 'center' ? 'auto' : 0,
          marginRight: align === 'left' || align === 'center' ? 'auto' : 0,
        }
      : {}),
  }

  const selectLayout = (nextWrap) => {
    if (nextWrap === 'absolute' && wrap !== 'absolute' && wrap !== 'free') {
      const objectRect = wrapperRef.current?.getBoundingClientRect()
      const editorRect = wrapperRef.current?.closest('.ProseMirror')?.getBoundingClientRect()
      updateAttributes({
        wrap: nextWrap,
        x: Math.max(0, (objectRect?.left || 0) - (editorRect?.left || 0)),
        y: Math.max(0, (objectRect?.top || 0) - (editorRect?.top || 0)),
      })
    } else {
      updateAttributes({ wrap: nextWrap, ...(nextWrap === 'absolute' ? {} : { x: 0, y: 0 }) })
    }
    setOpenPanel(null)
  }

  return (
    <NodeViewWrapper
      ref={wrapperRef}
      data-type="shape"
      data-shape={shapeType}
      data-fill={fill}
      data-wrap={effectiveWrap}
      data-x={Math.round(liveX)}
      data-y={Math.round(liveY)}
      data-width={Math.round(liveWidth)}
      data-height={Math.round(liveHeight)}
      data-rotation={normalizeAngle(liveRotation || 0)}
      data-flip-h={flipH || undefined}
      data-flip-v={flipV || undefined}
      data-align={align}
      className={`qn-shape group/shape ${active ? 'qn-shape--selected' : ''} ${move ? 'qn-shape--moving' : ''}`}
      style={wrapperStyle}
    >
      <div className="qn-shape__object" style={{ transform }}>
        <div
          className="qn-shape__surface"
          onPointerDown={(event) => {
            if (event.target.closest('.qn-shape__content')) return
            startMove(event)
          }}
        >
          <ShapeGeometry shapeType={shapeType} />
          <NodeViewContent
            className="qn-shape__content"
            style={{ transform: `scale(${flipH ? -1 : 1}, ${flipV ? -1 : 1})` }}
          />
        </div>
      </div>

      {editable && active && (
        <>
          {createPortal(
            <div
              ref={toolbarRef}
              role="toolbar"
              aria-label="Shape formatting"
              className="qn-shape-toolbar fixed z-[99998] flex max-w-[calc(100vw-1rem)] items-center gap-0.5 overflow-x-auto rounded-card border border-subtle bg-surface-raised p-1 shadow-lg"
              style={toolbarPosition}
              contentEditable={false}
            >
              <ControlButton
                buttonRef={shapeButtonRef}
                icon={Shapes}
                label="Change shape"
                active={openPanel === 'shape'}
                onClick={() => setOpenPanel((value) => value === 'shape' ? null : 'shape')}
              >
                Shape <ChevronDown className="h-3 w-3" aria-hidden="true" />
              </ControlButton>
              <ControlButton
                buttonRef={layoutButtonRef}
                icon={WrapText}
                label="Layout options"
                active={openPanel === 'layout'}
                onClick={() => setOpenPanel((value) => value === 'layout' ? null : 'layout')}
              >
                Layout <ChevronDown className="h-3 w-3" aria-hidden="true" />
              </ControlButton>
              <ControlButton
                buttonRef={fillButtonRef}
                icon={PaintBucket}
                label="Shape fill"
                active={openPanel === 'fill'}
                onClick={() => setOpenPanel((value) => value === 'fill' ? null : 'fill')}
              />
              <ControlButton
                buttonRef={formatButtonRef}
                icon={Maximize2}
                label="Size and rotation"
                active={openPanel === 'format'}
                onClick={() => setOpenPanel((value) => value === 'format' ? null : 'format')}
              />
              <span className="mx-0.5 h-5 w-px shrink-0 bg-[var(--qn-border-subtle)]" />
              <ControlButton icon={Trash2} label="Delete shape" tone="danger" onClick={deleteNode} />
            </div>,
            document.body
          )}

          <FloatingPanel open={openPanel === 'shape'} anchorRef={shapeButtonRef} onClose={() => setOpenPanel(null)} label="Shape gallery" className="w-[min(22rem,calc(100vw-1rem))] p-3">
            {SHAPE_GROUPS.map((group) => (
              <div key={group.label} className="mb-3 last:mb-0">
                <p className="mb-1.5 text-ui-xs font-semibold uppercase tracking-wide text-content-subtle">{group.label}</p>
                <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
                  {group.options.map((shape) => (
                    <button
                      key={shape.value}
                      type="button"
                      aria-label={shape.label}
                      aria-pressed={shapeType === shape.value}
                      title={shape.label}
                      onClick={() => {
                        updateAttributes({ shapeType: shape.value })
                        setOpenPanel(null)
                      }}
                      className={`qn-shape-gallery-item flex aspect-square items-center justify-center rounded-control border p-2 transition-colors ${shapeType === shape.value ? 'border-accent bg-accent-soft' : 'border-subtle hover:border-strong hover:bg-surface-hover'}`}
                    >
                      <ShapeGeometry shapeType={shape.value} className="h-full w-full" />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </FloatingPanel>

          <FloatingPanel open={openPanel === 'layout'} anchorRef={layoutButtonRef} onClose={() => setOpenPanel(null)} label="Shape layout options" className="w-[min(20rem,calc(100vw-1rem))] p-2">
            <p className="px-2 pb-1.5 pt-1 text-ui-xs font-semibold uppercase tracking-wide text-content-subtle">Position and text wrapping</p>
            {LAYOUTS.map((layout) => (
              <button
                key={layout.value}
                type="button"
                aria-pressed={wrap === layout.value}
                onClick={() => selectLayout(layout.value)}
                className={`flex w-full items-start gap-3 rounded-control px-3 py-2.5 text-left transition-colors ${wrap === layout.value ? 'bg-accent-soft text-accent-text' : 'hover:bg-surface-hover'}`}
              >
                <span className={`mt-1 h-3 w-3 shrink-0 rounded-full border ${wrap === layout.value ? 'border-accent bg-accent' : 'border-strong'}`} />
                <span>
                  <span className="block text-ui-md font-semibold">{layout.label}</span>
                  <span className="mt-0.5 block text-ui-sm leading-snug text-content-muted">{layout.description}</span>
                </span>
              </button>
            ))}
          </FloatingPanel>

          <FloatingPanel open={openPanel === 'fill'} anchorRef={fillButtonRef} onClose={() => setOpenPanel(null)} label="Shape fill colours" className="w-[min(15rem,calc(100vw-1rem))] p-3">
            <p className="mb-2 text-ui-xs font-semibold uppercase tracking-wide text-content-subtle">Shape style</p>
            <div className="grid grid-cols-2 gap-2">
              {FILLS.map((colour) => (
                <button
                  key={colour.value}
                  type="button"
                  aria-pressed={fill === colour.value}
                  onClick={() => {
                    updateAttributes({ fill: colour.value })
                    setOpenPanel(null)
                  }}
                  className={`qn-shape-swatch qn-shape-swatch--${colour.value} flex items-center gap-2 rounded-control border p-2 text-ui-sm font-medium ${fill === colour.value ? 'border-accent ring-1 ring-accent' : 'border-subtle hover:border-strong'}`}
                >
                  <span className="h-5 w-5 rounded-control border border-current bg-[var(--shape-fill)]" />
                  {colour.label}
                </button>
              ))}
            </div>
          </FloatingPanel>

          <FloatingPanel open={openPanel === 'format'} anchorRef={formatButtonRef} onClose={() => setOpenPanel(null)} label="Shape size and rotation" className="w-[min(19rem,calc(100vw-1rem))] p-3">
            <p className="mb-2 text-ui-xs font-semibold uppercase tracking-wide text-content-subtle">Exact size</p>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-ui-sm font-medium text-content-muted">Width
                <input type="number" min={MIN_WIDTH} max={MAX_DIMENSION} value={Math.round(width)} onChange={(event) => {
                  const editorWidth = wrapperRef.current?.closest('.ProseMirror')?.getBoundingClientRect().width || MAX_DIMENSION
                  const maximum = wrap === 'absolute' || wrap === 'free' ? Math.max(MIN_WIDTH, editorWidth - (x || 0) - 8) : MAX_DIMENSION
                  updateAttributes({ width: Math.min(maximum, clampDimension(Number(event.target.value) || MIN_WIDTH, MIN_WIDTH)) })
                }} aria-label="Shape width" className="mt-1 h-9 w-full rounded-control border border-subtle bg-surface-raised px-2 text-content outline-none focus:border-accent" />
              </label>
              <label className="text-ui-sm font-medium text-content-muted">Height
                <input type="number" min={MIN_HEIGHT} max={MAX_DIMENSION} value={Math.round(height)} onChange={(event) => updateAttributes({ height: clampDimension(Number(event.target.value) || MIN_HEIGHT, MIN_HEIGHT) })} aria-label="Shape height" className="mt-1 h-9 w-full rounded-control border border-subtle bg-surface-raised px-2 text-content outline-none focus:border-accent" />
              </label>
            </div>
            <div className="my-3 h-px bg-[var(--qn-border-subtle)]" />
            <p className="mb-2 text-ui-xs font-semibold uppercase tracking-wide text-content-subtle">Arrange</p>
            <div className="flex flex-wrap gap-1">
              <ControlButton icon={RotateCcw} label="Rotate left 90 degrees" onClick={() => updateAttributes({ rotation: normalizeAngle(rotation - 90) })} />
              <ControlButton icon={RotateCw} label="Rotate right 90 degrees" onClick={() => updateAttributes({ rotation: normalizeAngle(rotation + 90) })} />
              <label className="flex h-8 items-center rounded-control border border-subtle px-2 text-ui-sm text-content-muted">
                <input type="number" min="0" max="359" value={normalizeAngle(rotation)} onChange={(event) => updateAttributes({ rotation: normalizeAngle(Number(event.target.value) || 0) })} aria-label="Shape rotation in degrees" className="w-12 bg-transparent text-right font-medium text-content outline-none" />°
              </label>
              <ControlButton icon={FlipHorizontal} label="Flip horizontally" active={flipH} onClick={() => updateAttributes({ flipH: !flipH })} />
              <ControlButton icon={FlipVertical} label="Flip vertically" active={flipV} onClick={() => updateAttributes({ flipV: !flipV })} />
            </div>
            {wrap === 'inline' && (
              <div className="mt-2 flex gap-1 border-t border-subtle pt-2">
                <ControlButton icon={AlignLeft} label="Align shape left" active={align === 'left'} onClick={() => updateAttributes({ align: 'left' })} />
                <ControlButton icon={AlignCenter} label="Align shape centre" active={align === 'center'} onClick={() => updateAttributes({ align: 'center' })} />
                <ControlButton icon={AlignRight} label="Align shape right" active={align === 'right'} onClick={() => updateAttributes({ align: 'right' })} />
              </div>
            )}
          </FloatingPanel>

          <button
            type="button"
            contentEditable={false}
            aria-label="Drag to move shape"
            title="Drag to move shape; arrow keys nudge after selecting Free position"
            onPointerDown={startMove}
            onKeyDown={(event) => {
              if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
              event.preventDefault()
              const amount = event.shiftKey ? 10 : 1
              const editorWidth = wrapperRef.current?.closest('.ProseMirror')?.getBoundingClientRect().width || MAX_DIMENSION
              updateAttributes({
                wrap: 'absolute',
                x: clamp(
                  (x || 0) + (event.key === 'ArrowLeft' ? -amount : event.key === 'ArrowRight' ? amount : 0),
                  0,
                  Math.max(0, editorWidth - width - 8)
                ),
                y: Math.max(0, (y || 0) + (event.key === 'ArrowUp' ? -amount : event.key === 'ArrowDown' ? amount : 0)),
              })
            }}
            className="absolute -left-9 top-1/2 z-30 flex h-7 w-7 -translate-y-1/2 cursor-move items-center justify-center rounded-full border-2 border-accent bg-surface-raised text-accent-text shadow-sm"
          >
            <Move className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <span contentEditable={false} className="qn-shape__rotation-line absolute left-1/2 top-0 w-px -translate-x-1/2 -translate-y-5 bg-[var(--qn-accent)]" />
          <button type="button" contentEditable={false} aria-label="Drag to rotate shape; hold Shift to snap to 15 degrees" title="Drag to rotate; Shift snaps to 15°" onPointerDown={startRotate} className="absolute left-1/2 top-0 z-20 h-3.5 w-3.5 -translate-x-1/2 -translate-y-8 cursor-grab rounded-full border-2 border-accent bg-surface-raised shadow-sm active:cursor-grabbing" />
          {RESIZE_HANDLES.map((direction) => (
            <button
              key={direction}
              type="button"
              contentEditable={false}
              aria-label={`Resize shape ${direction}`}
              title="Drag to resize; Shift keeps proportions from a corner"
              onPointerDown={(event) => startResize(event, direction)}
              className={`qn-object-resize-handle qn-object-resize-handle--${direction}`}
            />
          ))}
          <span contentEditable={false} className="qn-shape__size absolute bottom-1 right-2 rounded bg-black/75 px-1.5 py-0.5 text-[10px] leading-none text-white">{Math.round(liveWidth)} × {Math.round(liveHeight)}</span>
        </>
      )}
    </NodeViewWrapper>
  )
}
