import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { NodeViewContent, NodeViewWrapper } from '@tiptap/react'
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  ChevronDown,
  Frame,
  Move,
  PaintBucket,
  Trash2,
  WrapText,
} from 'lucide-react'
import { useAnchoredPosition } from './ui'

const MIN_WIDTH = 120
const MIN_HEIGHT = 60
const MAX_DIMENSION = 1600

const FILLS = ['transparent', '#ffffff', '#ecfdf5', '#eff6ff', '#fff7ed', '#fdf2f8', '#f3f4f6', '#fef9c3']
const BORDERS = ['#0f172a', '#64748b', '#059669', '#2563eb', '#d97706', '#dc2626']
const LAYOUTS = [
  ['absolute', 'Free position', 'Place the box anywhere on the page.'],
  ['inline', 'In line', 'Keep the box between paragraphs.'],
  ['left', 'Wrap left', 'Flow text down the right side.'],
  ['right', 'Wrap right', 'Flow text down the left side.'],
]
const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value))

function ControlButton({ buttonRef, icon: Icon, label, active, onClick, tone, children }) {
  return (
    <button
      ref={buttonRef}
      type="button"
      aria-label={label}
      aria-pressed={active === undefined ? undefined : active}
      title={label}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={`flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-control px-2 text-ui-sm font-medium transition-colors ${
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

function Panel({ open, anchorRef, onClose, label, children, className = '' }) {
  const { floatingRef, style } = useAnchoredPosition({ anchorRef, open, placement: 'bottom-start', offset: 8 })
  useEffect(() => {
    if (!open) return undefined
    const dismiss = (event) => {
      if (floatingRef.current?.contains(event.target) || anchorRef.current?.contains(event.target)) return
      onClose()
    }
    const escape = (event) => event.key === 'Escape' && onClose()
    document.addEventListener('pointerdown', dismiss)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', dismiss)
      document.removeEventListener('keydown', escape)
    }
  }, [anchorRef, floatingRef, onClose, open])
  if (!open) return null
  return createPortal(
    <div
      ref={floatingRef}
      role="dialog"
      aria-label={label}
      contentEditable={false}
      style={style}
      className={`z-[99999] max-h-[min(28rem,calc(100dvh-1rem))] overflow-y-auto rounded-card border border-subtle bg-surface-raised p-3 shadow-lg ${className}`}
    >
      {children}
    </div>,
    document.body
  )
}

export default function TextBoxView({ node, updateAttributes, deleteNode, selected, editor, getPos }) {
  const {
    wrap,
    x,
    y,
    width,
    height,
    textAlign,
    borderStyle,
    borderColor,
    borderWidth,
    background,
  } = node.attrs
  const wrapperRef = useRef(null)
  const toolbarRef = useRef(null)
  const layoutRef = useRef(null)
  const fillRef = useRef(null)
  const borderRef = useRef(null)
  const gestureRef = useRef(null)
  const [active, setActive] = useState(!!selected)
  const [gesture, setGesture] = useState(null)
  const [panel, setPanel] = useState(null)
  const editable = editor?.isEditable !== false
  const isAbsolute = wrap === 'absolute'

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
    if (!active) setPanel(null)
  }, [active])

  const live = gesture?.live || { x, y, width, height: height || 140 }

  const startMove = useCallback((event) => {
    if (!editable || !isAbsolute) return
    if (event.target.closest('.qn-text-box__content, button, input, select')) return
    event.preventDefault()
    event.stopPropagation()
    const editorRect = wrapperRef.current?.closest('.ProseMirror')?.getBoundingClientRect()
    const nextGesture = {
      type: 'move',
      startX: event.clientX,
      startY: event.clientY,
      origin: { x, y, width, height: height || 140 },
      live: { x, y, width, height: height || 140 },
      editorWidth: editorRect?.width || MAX_DIMENSION,
    }
    gestureRef.current = nextGesture
    setGesture(nextGesture)
  }, [editable, height, isAbsolute, width, x, y])

  const startResize = useCallback((event, direction) => {
    if (!editable) return
    event.preventDefault()
    event.stopPropagation()
    const editorRect = wrapperRef.current?.closest('.ProseMirror')?.getBoundingClientRect()
    const nextGesture = {
      type: 'resize',
      direction,
      startX: event.clientX,
      startY: event.clientY,
      origin: { x, y, width, height: height || 140 },
      live: { x, y, width, height: height || 140 },
      editorWidth: editorRect?.width || MAX_DIMENSION,
    }
    gestureRef.current = nextGesture
    setGesture(nextGesture)
  }, [editable, height, width, x, y])

  const hasActiveGesture = Boolean(gesture)

  useEffect(() => {
    if (!hasActiveGesture) return undefined
    const move = (event) => {
      const current = gestureRef.current
      if (!current) return
      const dx = event.clientX - current.startX
      const dy = event.clientY - current.startY
      const origin = current.origin
      if (current.type === 'move') {
        const next = {
          ...current,
          live: {
            ...origin,
            x: clamp(origin.x + dx, 0, Math.max(0, current.editorWidth - origin.width)),
            y: Math.max(0, origin.y + dy),
          },
        }
        gestureRef.current = next
        setGesture(next)
        return
      }

      const west = current.direction.includes('w')
      const east = current.direction.includes('e')
      const north = current.direction.includes('n')
      const south = current.direction.includes('s')
      const maximumWidth = isAbsolute
        ? east
          ? Math.max(MIN_WIDTH, current.editorWidth - origin.x - 8)
          : west
            ? Math.max(MIN_WIDTH, origin.x + origin.width - 8)
            : MAX_DIMENSION
        : MAX_DIMENSION
      const nextWidth = clamp(origin.width + (east ? dx : west ? -dx : 0), MIN_WIDTH, maximumWidth)
      const nextHeight = clamp(origin.height + (south ? dy : north ? -dy : 0), MIN_HEIGHT, MAX_DIMENSION)
      const next = {
        ...current,
        live: {
          x: west ? origin.x + origin.width - nextWidth : origin.x,
          y: north ? Math.max(0, origin.y + origin.height - nextHeight) : origin.y,
          width: nextWidth,
          height: nextHeight,
        },
      }
      gestureRef.current = next
      setGesture(next)
    }
    const finish = () => {
      const current = gestureRef.current
      gestureRef.current = null
      if (current) {
        updateAttributes({
          ...(isAbsolute ? { x: Math.round(current.live.x), y: Math.round(current.live.y) } : {}),
          width: Math.round(current.live.width),
          height: Math.round(current.live.height),
        })
      }
      setGesture(null)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', finish, { once: true })
    window.addEventListener('pointercancel', finish, { once: true })
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', finish)
    }
  }, [hasActiveGesture, isAbsolute, updateAttributes])

  const { floatingRef: anchoredToolbarRef, style: toolbarStyle } = useAnchoredPosition({
    anchorRef: wrapperRef,
    open: editable && active,
    placement: 'top-start',
    offset: 32,
  })
  const setToolbarRefs = (element) => {
    toolbarRef.current = element
    anchoredToolbarRef.current = element
  }

  const wrapperStyle = {
    width: `${live.width}px`,
    height: `${live.height}px`,
    textAlign,
    background: background === 'none' || background === 'transparent' ? 'transparent' : background === 'subtle' ? 'var(--qn-surface-sunken)' : background,
    borderStyle: borderStyle === 'none' ? 'solid' : borderStyle,
    borderColor: borderStyle === 'none' ? 'transparent' : borderColor,
    borderWidth: `${borderStyle === 'none' ? 0 : borderWidth}px`,
    ...(isAbsolute ? { position: 'absolute', left: `${live.x}px`, top: `${live.y}px`, zIndex: active ? 20 : 10 } : {}),
    ...(wrap === 'left' ? { float: 'left', margin: '4px 16px 8px 0' } : {}),
    ...(wrap === 'right' ? { float: 'right', margin: '4px 0 8px 16px' } : {}),
  }

  const updateExactGeometry = (attribute, rawValue) => {
    const value = Number(rawValue) || 0
    const editorWidth = wrapperRef.current?.closest('.ProseMirror')?.getBoundingClientRect().width || MAX_DIMENSION
    if (attribute === 'x') {
      updateAttributes({ x: clamp(value, 0, Math.max(0, editorWidth - width - 8)) })
      return
    }
    if (attribute === 'y') {
      updateAttributes({ y: Math.max(0, value) })
      return
    }
    if (attribute === 'width') {
      updateAttributes({ width: clamp(value, MIN_WIDTH, Math.max(MIN_WIDTH, editorWidth - x - 8)) })
      return
    }
    updateAttributes({ height: clamp(value, MIN_HEIGHT, MAX_DIMENSION) })
  }

  return (
    <NodeViewWrapper
      ref={wrapperRef}
      data-type="textBox"
      data-wrap={wrap}
      data-border={borderStyle}
      data-bg={background}
      data-x={Math.round(live.x || 0)}
      data-y={Math.round(live.y || 0)}
      data-width={Math.round(live.width)}
      data-height={Math.round(live.height)}
      data-text-align={textAlign}
      className={`qn-text-box group/textbox ${active ? 'qn-text-box--selected' : ''} ${gesture?.type === 'move' ? 'qn-text-box--dragging' : ''}`}
      style={wrapperStyle}
      onPointerDown={startMove}
    >
      {editable && active && createPortal(
        <div
          ref={setToolbarRefs}
          role="toolbar"
          aria-label="Text box formatting"
          contentEditable={false}
          style={toolbarStyle}
          className="fixed z-[99998] flex max-w-[calc(100vw-1rem)] items-center gap-0.5 overflow-x-auto rounded-card border border-subtle bg-surface-raised p-1 shadow-lg"
        >
          <ControlButton buttonRef={layoutRef} icon={WrapText} label="Text box layout" active={panel === 'layout'} onClick={() => setPanel((value) => value === 'layout' ? null : 'layout')}>
            Position <ChevronDown className="h-3 w-3" />
          </ControlButton>
          <ControlButton buttonRef={fillRef} icon={PaintBucket} label="Text box fill" active={panel === 'fill'} onClick={() => setPanel((value) => value === 'fill' ? null : 'fill')}>
            Fill <ChevronDown className="h-3 w-3" />
          </ControlButton>
          <ControlButton buttonRef={borderRef} icon={Frame} label="Text box border" active={panel === 'border'} onClick={() => setPanel((value) => value === 'border' ? null : 'border')}>
            Border <ChevronDown className="h-3 w-3" />
          </ControlButton>
          <span className="mx-0.5 h-5 w-px bg-[var(--qn-border-subtle)]" />
          {[
            ['left', AlignLeft, 'Align text left'],
            ['center', AlignCenter, 'Align text centre'],
            ['right', AlignRight, 'Align text right'],
            ['justify', AlignJustify, 'Justify text'],
          ].map(([value, Icon, label]) => (
            <ControlButton key={value} icon={Icon} label={label} active={textAlign === value} onClick={() => updateAttributes({ textAlign: value })} />
          ))}
          <span className="mx-0.5 h-5 w-px bg-[var(--qn-border-subtle)]" />
          <ControlButton icon={Trash2} label="Delete text box" tone="danger" onClick={deleteNode} />
        </div>,
        document.body
      )}

      <Panel open={panel === 'layout'} anchorRef={layoutRef} onClose={() => setPanel(null)} label="Text box position" className="w-[min(20rem,calc(100vw-1rem))]">
        <p className="mb-2 text-ui-xs font-semibold uppercase tracking-wide text-content-subtle">Position and wrapping</p>
        {LAYOUTS.map(([value, label, description]) => (
          <button
            key={value}
            type="button"
            aria-pressed={wrap === value}
            onClick={() => {
              if (value === 'absolute' && !isAbsolute) {
                const objectRect = wrapperRef.current?.getBoundingClientRect()
                const editorRect = wrapperRef.current?.closest('.ProseMirror')?.getBoundingClientRect()
                updateAttributes({
                  wrap: value,
                  x: Math.max(0, (objectRect?.left || 0) - (editorRect?.left || 0)),
                  y: Math.max(0, (objectRect?.top || 0) - (editorRect?.top || 0)),
                })
              } else {
                updateAttributes({ wrap: value })
              }
              setPanel(null)
            }}
            className={`mb-1 flex w-full items-start gap-3 rounded-control px-3 py-2.5 text-left last:mb-0 ${wrap === value ? 'bg-accent-soft text-accent-text' : 'hover:bg-surface-hover'}`}
          >
            <span className={`mt-1 h-3 w-3 shrink-0 rounded-full border ${wrap === value ? 'border-accent bg-accent' : 'border-strong'}`} />
            <span><span className="block text-ui-md font-semibold">{label}</span><span className="mt-0.5 block text-ui-sm text-content-muted">{description}</span></span>
          </button>
        ))}
        {isAbsolute && (
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-subtle pt-3">
            {[
              ['X position', 'x', x],
              ['Y position', 'y', y],
              ['Width', 'width', width],
              ['Height', 'height', height || 140],
            ].map(([label, attribute, value]) => (
              <label key={attribute} className="text-ui-sm font-medium text-content-muted">{label}
                <input
                  type="number"
                  min="0"
                  value={Math.round(value || 0)}
                  onChange={(event) => updateExactGeometry(attribute, event.target.value)}
                  className="mt-1 h-9 w-full rounded-control border border-subtle bg-surface-raised px-2 text-content outline-none focus:border-accent"
                />
              </label>
            ))}
          </div>
        )}
      </Panel>

      <Panel open={panel === 'fill'} anchorRef={fillRef} onClose={() => setPanel(null)} label="Text box fill" className="w-[min(17rem,calc(100vw-1rem))]">
        <p className="mb-2 text-ui-xs font-semibold uppercase tracking-wide text-content-subtle">Background fill</p>
        <div className="grid grid-cols-4 gap-2">
          {FILLS.map((colour) => (
            <button
              key={colour}
              type="button"
              aria-label={colour === 'transparent' ? 'Transparent fill' : `Fill ${colour}`}
              aria-pressed={background === colour || (colour === 'transparent' && background === 'none')}
              onClick={() => updateAttributes({ background: colour })}
              className="qn-text-box-swatch h-10 rounded-control border border-subtle shadow-xs"
              style={{ background: colour === 'transparent' ? 'linear-gradient(135deg,#fff 45%,#dc2626 46%,#dc2626 54%,#fff 55%)' : colour }}
            />
          ))}
        </div>
        <label className="mt-3 flex items-center justify-between border-t border-subtle pt-3 text-ui-sm font-medium text-content-muted">
          Custom colour
          <input type="color" value={background?.startsWith?.('#') ? background : '#ffffff'} onChange={(event) => updateAttributes({ background: event.target.value })} className="h-9 w-12 rounded-control border border-subtle" />
        </label>
      </Panel>

      <Panel open={panel === 'border'} anchorRef={borderRef} onClose={() => setPanel(null)} label="Text box border" className="w-[min(18rem,calc(100vw-1rem))]">
        <p className="mb-2 text-ui-xs font-semibold uppercase tracking-wide text-content-subtle">Border style</p>
        <div className="grid grid-cols-2 gap-2">
          {['none', 'solid', 'dashed', 'dotted'].map((style) => (
            <button key={style} type="button" aria-pressed={borderStyle === style} onClick={() => updateAttributes({ borderStyle: style })} className={`rounded-control border px-3 py-2 text-ui-sm font-medium capitalize ${borderStyle === style ? 'border-accent bg-accent-soft text-accent-text' : 'border-subtle hover:bg-surface-hover'}`}>{style}</button>
          ))}
        </div>
        <p className="mb-2 mt-3 text-ui-xs font-semibold uppercase tracking-wide text-content-subtle">Colour and weight</p>
        <div className="flex flex-wrap gap-2">
          {BORDERS.map((colour) => (
            <button key={colour} type="button" aria-label={`Border ${colour}`} aria-pressed={borderColor === colour} onClick={() => updateAttributes({ borderColor: colour })} className="h-8 w-8 rounded-full border-2 border-surface-raised ring-1 ring-[var(--qn-border-strong)]" style={{ background: colour }} />
          ))}
          <input type="color" aria-label="Custom border colour" value={borderColor} onChange={(event) => updateAttributes({ borderColor: event.target.value })} className="h-8 w-10 rounded-control border border-subtle" />
        </div>
        <label className="mt-3 block text-ui-sm font-medium text-content-muted">Border width
          <input type="range" min="1" max="6" step="1" value={borderWidth} onChange={(event) => updateAttributes({ borderWidth: Number(event.target.value) })} className="mt-1 w-full accent-[var(--qn-accent)]" />
        </label>
      </Panel>

      <NodeViewContent className="qn-text-box__content h-full overflow-auto" />

      {editable && active && HANDLES.map((direction) => (
        <button
          key={direction}
          type="button"
          contentEditable={false}
          aria-label={`Resize text box ${direction}`}
          onPointerDown={(event) => startResize(event, direction)}
          className={`qn-object-resize-handle qn-object-resize-handle--${direction}`}
        />
      ))}
      {editable && active && isAbsolute && (
        <button
          type="button"
          contentEditable={false}
          aria-label="Move text box"
          title="Drag the border to move; arrow keys nudge"
          onPointerDown={(event) => {
            event.preventDefault()
            const editorRect = wrapperRef.current?.closest('.ProseMirror')?.getBoundingClientRect()
            const nextGesture = { type: 'move', startX: event.clientX, startY: event.clientY, origin: { x, y, width, height: height || 140 }, live: { x, y, width, height: height || 140 }, editorWidth: editorRect?.width || MAX_DIMENSION }
            gestureRef.current = nextGesture
            setGesture(nextGesture)
          }}
          onKeyDown={(event) => {
            if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
            event.preventDefault()
            const amount = event.shiftKey ? 10 : 1
            const editorWidth = wrapperRef.current?.closest('.ProseMirror')?.getBoundingClientRect().width || MAX_DIMENSION
            updateAttributes({
              x: clamp(
                x + (event.key === 'ArrowLeft' ? -amount : event.key === 'ArrowRight' ? amount : 0),
                0,
                Math.max(0, editorWidth - width - 8)
              ),
              y: Math.max(0, y + (event.key === 'ArrowUp' ? -amount : event.key === 'ArrowDown' ? amount : 0)),
            })
          }}
          className="absolute -left-9 top-1/2 z-30 flex h-7 w-7 -translate-y-1/2 cursor-move items-center justify-center rounded-full border-2 border-accent bg-surface-raised text-accent-text shadow-sm"
        >
          <Move className="h-3.5 w-3.5" />
        </button>
      )}
    </NodeViewWrapper>
  )
}
