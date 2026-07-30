import { useCallback, useEffect, useRef, useState } from 'react'
import { NodeViewContent, NodeViewWrapper } from '@tiptap/react'
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Move,
  Square,
  SquareDashedBottom,
  PaintBucket,
  Trash2,
  WrapText,
} from 'lucide-react'

const WRAP_MODES = [
  { value: 'inline', label: 'In line with text', icon: WrapText },
  { value: 'left', label: 'Wrap right of box', icon: AlignLeft },
  { value: 'right', label: 'Wrap left of box', icon: AlignRight },
  { value: 'absolute', label: 'Free position', icon: Move },
]

const ALIGNMENTS = [
  { value: 'left', label: 'Align left', icon: AlignLeft },
  { value: 'center', label: 'Align centre', icon: AlignCenter },
  { value: 'right', label: 'Align right', icon: AlignRight },
  { value: 'justify', label: 'Justify', icon: AlignJustify },
]

const MIN_WIDTH = 120
const MIN_HEIGHT = 60

/**
 * Interactive text box.
 *
 * Supports what a word processor's text box does: drag to move (in free
 * position mode), resize from the corner, choose how surrounding text
 * wraps around it, and align the text inside it.
 *
 * Drag and resize are pointer-event based so they work with mouse, pen
 * and touch, and both commit a single `updateAttributes` on release
 * rather than one per frame — otherwise every pixel of movement would
 * push a separate entry onto the undo stack and trigger an autosave.
 */
export default function TextBoxView({ node, updateAttributes, deleteNode, selected, editor, getPos }) {
  const { wrap, x, y, width, height, textAlign, borderStyle, background } = node.attrs
  const wrapperRef = useRef(null)
  const [drag, setDrag] = useState(null)
  const [resize, setResize] = useState(null)

  const editable = editor?.isEditable !== false
  const isAbsolute = wrap === 'absolute'

  /**
   * A text box holds block content, so clicking into it places a text
   * cursor rather than creating a NodeSelection — `selected` stays false
   * and the controls would never appear. Treat the box as active
   * whenever the selection sits inside this node's range.
   */
  const [active, setActive] = useState(false)
  useEffect(() => {
    if (!editor) return undefined
    const sync = () => {
      const pos = typeof getPos === 'function' ? getPos() : null
      if (pos === null || pos === undefined || Number.isNaN(pos)) return setActive(!!selected)
      const { from, to } = editor.state.selection
      return setActive(!!selected || (from >= pos && to <= pos + node.nodeSize))
    }
    sync()
    editor.on('selectionUpdate', sync)
    editor.on('transaction', sync)
    return () => {
      editor.off('selectionUpdate', sync)
      editor.off('transaction', sync)
    }
  }, [editor, getPos, node, selected])

  // Live geometry while a gesture is in flight; committed on release.
  const liveX = drag ? drag.currentX : x
  const liveY = drag ? drag.currentY : y
  const liveWidth = resize ? resize.currentWidth : width
  const liveHeight = resize ? resize.currentHeight : height

  const onDragPointerDown = useCallback(
    (e) => {
      if (!editable || !isAbsolute) return
      e.preventDefault()
      e.stopPropagation()
      e.currentTarget.setPointerCapture?.(e.pointerId)
      setDrag({
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        originX: x || 0,
        originY: y || 0,
        currentX: x || 0,
        currentY: y || 0,
      })
    },
    [editable, isAbsolute, x, y]
  )

  const onResizePointerDown = useCallback(
    (e) => {
      if (!editable) return
      e.preventDefault()
      e.stopPropagation()
      e.currentTarget.setPointerCapture?.(e.pointerId)
      const rect = wrapperRef.current?.getBoundingClientRect()
      setResize({
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        originWidth: rect?.width ?? width ?? MIN_WIDTH,
        originHeight: rect?.height ?? height ?? MIN_HEIGHT,
        currentWidth: rect?.width ?? width ?? MIN_WIDTH,
        currentHeight: rect?.height ?? height ?? MIN_HEIGHT,
      })
    },
    [editable, width, height]
  )

  useEffect(() => {
    if (!drag && !resize) return

    const onMove = (e) => {
      if (drag) {
        setDrag((d) =>
          d
            ? { ...d, currentX: d.originX + (e.clientX - d.startX), currentY: d.originY + (e.clientY - d.startY) }
            : d
        )
      }
      if (resize) {
        setResize((r) =>
          r
            ? {
                ...r,
                currentWidth: Math.max(MIN_WIDTH, r.originWidth + (e.clientX - r.startX)),
                currentHeight: Math.max(MIN_HEIGHT, r.originHeight + (e.clientY - r.startY)),
              }
            : r
        )
      }
    }

    const onUp = () => {
      if (drag) {
        updateAttributes({ x: Math.round(drag.currentX), y: Math.round(drag.currentY) })
        setDrag(null)
      }
      if (resize) {
        updateAttributes({
          width: Math.round(resize.currentWidth),
          height: Math.round(resize.currentHeight),
        })
        setResize(null)
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
  }, [drag, resize, updateAttributes])

  /**
   * The controls sit above the box by default, but a box near the top of
   * the document would put them behind the editor toolbar, which then
   * swallows the clicks. Flip below when there is not enough room.
   */
  const [controlsBelow, setControlsBelow] = useState(false)
  useEffect(() => {
    if (!active) return
    const el = wrapperRef.current
    if (!el) return
    const boxTop = el.getBoundingClientRect().top
    const toolbar = el.closest('.editor-paper')?.querySelector('.editor-toolbar')
    const limit = toolbar ? toolbar.getBoundingClientRect().bottom : 0
    setControlsBelow(boxTop - limit < 44)
  }, [active, liveY, wrap])

  const wrapperStyle = {
    width: liveWidth ? `${liveWidth}px` : undefined,
    height: liveHeight ? `${liveHeight}px` : undefined,
    textAlign,
    ...(isAbsolute
      ? { position: 'absolute', left: `${liveX}px`, top: `${liveY}px`, zIndex: active ? 20 : 10 }
      : {}),
    ...(wrap === 'left' ? { float: 'left', margin: '4px 16px 8px 0' } : {}),
    ...(wrap === 'right' ? { float: 'right', margin: '4px 0 8px 16px' } : {}),
  }

  const ToolbarButton = ({ icon: Icon, label, active, onClick, tone }) => (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active || undefined}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`flex h-6 w-6 items-center justify-center rounded transition-colors duration-fast ${
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

  return (
    <NodeViewWrapper
      ref={wrapperRef}
      data-type="textBox"
      data-wrap={wrap}
      data-border={borderStyle}
      data-bg={background}
      data-x={Math.round(liveX || 0)}
      data-y={Math.round(liveY || 0)}
      data-width={Math.round(liveWidth || 0)}
      data-height={liveHeight ? Math.round(liveHeight) : undefined}
      data-text-align={textAlign}
      className={`qn-text-box group/textbox relative ${active ? 'qn-text-box--selected' : ''} ${
        drag ? 'qn-text-box--dragging' : ''
      }`}
      style={wrapperStyle}
    >
      {editable && active && (
        <div
          contentEditable={false}
          className={`absolute left-0 z-30 flex items-center gap-0.5 rounded-control border border-subtle bg-surface-raised p-1 shadow-md ${
            controlsBelow ? 'top-full mt-2' : '-top-9'
          }`}
        >
          {WRAP_MODES.map((mode) => (
            <ToolbarButton
              key={mode.value}
              icon={mode.icon}
              label={mode.label}
              active={wrap === mode.value}
              onClick={() => updateAttributes({ wrap: mode.value })}
            />
          ))}
          <span className="mx-0.5 h-4 w-px bg-[var(--qn-border-subtle)]" />
          {ALIGNMENTS.map((a) => (
            <ToolbarButton
              key={a.value}
              icon={a.icon}
              label={a.label}
              active={textAlign === a.value}
              onClick={() => updateAttributes({ textAlign: a.value })}
            />
          ))}
          <span className="mx-0.5 h-4 w-px bg-[var(--qn-border-subtle)]" />
          <ToolbarButton
            icon={borderStyle === 'none' ? SquareDashedBottom : Square}
            label={borderStyle === 'none' ? 'Show border' : 'Hide border'}
            onClick={() => updateAttributes({ borderStyle: borderStyle === 'none' ? 'solid' : 'none' })}
          />
          <ToolbarButton
            icon={PaintBucket}
            label={background === 'none' ? 'Add background' : 'Clear background'}
            active={background !== 'none'}
            onClick={() => updateAttributes({ background: background === 'none' ? 'subtle' : 'none' })}
          />
          <span className="mx-0.5 h-4 w-px bg-[var(--qn-border-subtle)]" />
          <ToolbarButton icon={Trash2} label="Delete text box" tone="danger" onClick={deleteNode} />
        </div>
      )}

      {editable && isAbsolute && (
        <span
          contentEditable={false}
          onPointerDown={onDragPointerDown}
          title="Drag to move"
          aria-hidden="true"
          className="absolute -left-2 -top-2 z-20 flex h-6 w-6 cursor-grab items-center justify-center rounded-full border border-subtle bg-surface-raised text-content-muted opacity-0 shadow-sm transition-opacity duration-fast active:cursor-grabbing group-hover/textbox:opacity-100 [.qn-text-box--selected_&]:opacity-100"
        >
          <Move className="h-3 w-3" />
        </span>
      )}

      <NodeViewContent className="qn-text-box__content" />

      {editable && (
        <span
          contentEditable={false}
          onPointerDown={onResizePointerDown}
          title="Drag to resize"
          aria-hidden="true"
          className="absolute -bottom-1 -right-1 z-20 h-3.5 w-3.5 cursor-nwse-resize rounded-sm border border-strong bg-surface-raised opacity-0 transition-opacity duration-fast group-hover/textbox:opacity-100 [.qn-text-box--selected_&]:opacity-100"
        />
      )}
    </NodeViewWrapper>
  )
}
