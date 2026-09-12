import { Fragment, useEffect, useRef, useState } from 'react'
import {
  PAGE_GAP,
  getDocumentPageCount,
  getDocumentPageGeometry,
  getDocumentPageTop,
} from './pageGeometry'
const TAB_STOP_TYPES = ['left', 'center', 'right', 'decimal']
const tabTypeLabel = (type) => `${type[0].toUpperCase()}${type.slice(1)}`

function DocumentRuler({ editor, containerRef }) {
  const rulerRef = useRef(null)
  const trackRef = useRef(null)
  const dragRef = useRef(null)
  const geometryRef = useRef(null)
  const layoutRef = useRef(null)
  const [geometry, setGeometry] = useState({
    pageLeft: 40,
    pageWidth: 794,
    contentWidth: 642,
    paddingLeft: 76,
    paddingRight: 76,
    scale: 1,
  })
  const [tabType, setTabType] = useState('left')
  const [layout, setLayout] = useState({ leftIndent: 0, rightIndent: 0, firstLineIndent: 0, tabStops: [] })
  const [drag, setDrag] = useState(null)
  geometryRef.current = geometry
  layoutRef.current = layout

  useEffect(() => {
    if (!editor) return undefined
    const sync = () => {
      const attrs = editor.getAttributes(editor.isActive('heading') ? 'heading' : 'paragraph')
      setLayout({
        leftIndent: Number(attrs.leftIndent) || 0,
        rightIndent: Number(attrs.rightIndent) || 0,
        firstLineIndent: Number(attrs.firstLineIndent) || 0,
        tabStops: Array.isArray(attrs.tabStops)
          ? attrs.tabStops.map((stop) => typeof stop === 'number' ? { position: stop, type: 'left' } : stop)
          : [],
      })
    }
    sync()
    editor.on('selectionUpdate', sync)
    editor.on('transaction', sync)
    return () => {
      editor.off('selectionUpdate', sync)
      editor.off('transaction', sync)
    }
  }, [editor])

  useEffect(() => {
    const ruler = rulerRef.current
    const pageElement = containerRef.current
    const editorElement = pageElement?.querySelector('.ProseMirror')
    if (!ruler || !editorElement || !pageElement || typeof ResizeObserver === 'undefined') return undefined
    const sync = () => {
      const rulerRect = ruler.getBoundingClientRect()
      const pageRect = pageElement.getBoundingClientRect()
      const styles = getComputedStyle(editorElement)
      const scale = pageElement.clientWidth > 0 ? pageRect.width / pageElement.clientWidth : 1
      const paddingLeft = (parseFloat(styles.paddingLeft) || 0) * scale
      const paddingRight = (parseFloat(styles.paddingRight) || 0) * scale
      setGeometry({
        pageLeft: pageRect.left - rulerRect.left,
        pageWidth: pageRect.width,
        contentWidth: Math.max(120, (editorElement.clientWidth * scale) - paddingLeft - paddingRight),
        paddingLeft,
        paddingRight,
        scale,
      })
    }
    sync()
    const observer = new ResizeObserver(sync)
    observer.observe(editorElement)
    observer.observe(pageElement)
    const workbench = pageElement.parentElement
    workbench?.addEventListener('scroll', sync)
    window.addEventListener('resize', sync)
    return () => {
      observer.disconnect()
      workbench?.removeEventListener('scroll', sync)
      window.removeEventListener('resize', sync)
    }
  }, [containerRef, editor])

  const hasActiveDrag = Boolean(drag)
  useEffect(() => {
    if (!hasActiveDrag) return undefined
    const move = (event) => {
      const rect = trackRef.current?.getBoundingClientRect()
      const current = dragRef.current
      if (!rect || !current || (current.pointerId !== undefined && event.pointerId !== current.pointerId)) return
      const currentGeometry = geometryRef.current
      const currentLayout = layoutRef.current
      const raw = event.clientX - rect.left
      const snapped = event.shiftKey ? raw : Math.round(raw / 4) * 4
      const minimumTextWidth = 40
      const minimum = current.type === 'right'
        ? (currentLayout.leftIndent + minimumTextWidth) * currentGeometry.scale
        : 0
      const maximum = current.type === 'left'
        ? currentGeometry.contentWidth - ((currentLayout.rightIndent + minimumTextWidth) * currentGeometry.scale)
        : current.type === 'first' || current.type === 'tab'
          ? currentGeometry.contentWidth - (currentLayout.rightIndent * currentGeometry.scale)
          : currentGeometry.contentWidth
      const removalDistance = current.pointerType === 'touch' ? 48 : 28
      const next = {
        ...current,
        current: Math.round(Math.max(minimum, Math.min(maximum, snapped))),
        outside: event.clientY < rect.top - removalDistance || event.clientY > rect.bottom + removalDistance,
      }
      dragRef.current = next
      setDrag(next)
    }
    const finish = (event) => {
      const current = dragRef.current
      if (!current || (current.pointerId !== undefined && event.pointerId !== current.pointerId)) return
      const currentGeometry = geometryRef.current
      const currentLayout = layoutRef.current
      const cancelled = event.type === 'pointercancel'
      if (!cancelled && current.type === 'left') editor.commands.setParagraphLayout({ leftIndent: current.current / currentGeometry.scale })
      if (!cancelled && current.type === 'right') editor.commands.setParagraphLayout({ rightIndent: (currentGeometry.contentWidth - current.current) / currentGeometry.scale })
      if (!cancelled && current.type === 'first') editor.commands.setParagraphLayout({ firstLineIndent: (current.current / currentGeometry.scale) - currentLayout.leftIndent })
      if (current.type === 'tab') {
        if (!cancelled) {
          const next = current.outside
            ? currentLayout.tabStops.filter((_, index) => index !== current.index)
            : currentLayout.tabStops.map((stop, index) => index === current.index ? { ...stop, position: current.current / currentGeometry.scale } : stop)
          editor.commands.setParagraphLayout({ tabStops: next })
        }
      }
      dragRef.current = null
      setDrag(null)
      if (!cancelled) editor.view.focus()
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', finish)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', finish)
    }
  }, [editor, hasActiveDrag])

  const startDrag = (event, value) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    const next = {
      ...value,
      pointerId: event.pointerId,
      pointerType: event.pointerType,
    }
    dragRef.current = next
    setDrag(next)
  }
  const cycleTabType = (currentType) => TAB_STOP_TYPES[(TAB_STOP_TYPES.indexOf(currentType) + 1) % TAB_STOP_TYPES.length]
  const markerPosition = (type, fallback) => drag?.type === type ? drag.current : fallback * geometry.scale
  const rightMarkerPosition = drag?.type === 'right'
    ? drag.current
    : geometry.contentWidth - (layout.rightIndent * geometry.scale)
  const tickCount = Math.ceil(geometry.contentWidth / (40 * geometry.scale))

  return (
    <div ref={rulerRef} className="qn-document-ruler relative h-6 shrink-0 border-b border-subtle" aria-label="Paragraph ruler">
      <button
        type="button"
        data-tab-selector
        aria-label={`Tab stop type: ${tabTypeLabel(tabType)}. Activate to choose ${tabTypeLabel(cycleTabType(tabType))}.`}
        title={`${tabTypeLabel(tabType)} tab stop`}
        onClick={() => setTabType(cycleTabType(tabType))}
        className="qn-tab-selector absolute inset-y-0 left-0 flex w-6 items-center justify-center border-r border-subtle text-ui-xs font-bold text-content-muted hover:bg-surface-hover"
      >
        {tabType === 'decimal' ? 'D.' : tabType[0].toUpperCase()}
      </button>
      <div
        data-ruler-page
        className="qn-ruler-page absolute inset-y-0 overflow-hidden"
        style={{ left: `${geometry.pageLeft}px`, width: `${geometry.pageWidth}px` }}
      >
        <span className="qn-ruler-margin qn-ruler-margin--left" style={{ width: `${geometry.paddingLeft}px` }} />
        <span className="qn-ruler-margin qn-ruler-margin--right" style={{ width: `${geometry.paddingRight}px` }} />
        <div
          ref={trackRef}
          data-ruler-track
          className="absolute inset-y-0 cursor-crosshair"
          style={{ left: `${geometry.paddingLeft}px`, width: `${geometry.contentWidth}px` }}
          onPointerDown={(event) => {
            if (event.target !== event.currentTarget) return
            const rect = event.currentTarget.getBoundingClientRect()
            const stop = Math.round((event.clientX - rect.left) / geometry.scale)
            editor.commands.setParagraphLayout({ tabStops: [...layout.tabStops, { position: stop, type: tabType }] })
            editor.view.focus()
          }}
        >
          {Array.from({ length: tickCount + 1 }, (_, index) => (
            <span key={index} className="qn-ruler-tick" style={{ left: `${index * 40 * geometry.scale}px` }}>
              {index > 0 && <span>{index}</span>}
            </span>
          ))}
          <button type="button" aria-label={`First-line indent ${Math.round(layout.firstLineIndent)} pixels`} className="qn-ruler-marker qn-ruler-marker--first" style={{ left: `${markerPosition('first', layout.leftIndent + layout.firstLineIndent)}px` }} onPointerDown={(event) => startDrag(event, { type: 'first', current: (layout.leftIndent + layout.firstLineIndent) * geometry.scale })} />
          <button type="button" aria-label={`Left paragraph indent ${Math.round(layout.leftIndent)} pixels`} className="qn-ruler-marker qn-ruler-marker--left" style={{ left: `${markerPosition('left', layout.leftIndent)}px` }} onPointerDown={(event) => startDrag(event, { type: 'left', current: layout.leftIndent * geometry.scale })} />
          <button type="button" aria-label={`Right paragraph indent ${Math.round(layout.rightIndent)} pixels`} className="qn-ruler-marker qn-ruler-marker--right" style={{ left: `${rightMarkerPosition}px` }} onPointerDown={(event) => startDrag(event, { type: 'right', current: rightMarkerPosition })} />
          {layout.tabStops.map((stop, index) => {
            const position = drag?.type === 'tab' && drag.index === index ? drag.current : stop.position * geometry.scale
            return (
              <button
                key={`${stop.position}-${stop.type}-${index}`}
                type="button"
                data-tab-type={stop.type}
                aria-label={`${tabTypeLabel(stop.type)} tab stop at ${Math.round(stop.position)} pixels. Press Enter to change type or Delete to remove.`}
                className={`qn-ruler-tab-stop ${drag?.type === 'tab' && drag.index === index && drag.outside ? 'opacity-40' : ''}`}
                style={{ left: `${position}px` }}
                onDoubleClick={() => editor.commands.setParagraphLayout({ tabStops: layout.tabStops.map((item, itemIndex) => itemIndex === index ? { ...item, type: cycleTabType(item.type) } : item) })}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    editor.commands.setParagraphLayout({ tabStops: layout.tabStops.map((item, itemIndex) => itemIndex === index ? { ...item, type: cycleTabType(item.type) } : item) })
                    return
                  }
                  if (event.key !== 'Delete' && event.key !== 'Backspace') return
                  event.preventDefault()
                  editor.commands.setParagraphLayout({ tabStops: layout.tabStops.filter((_, itemIndex) => itemIndex !== index) })
                }}
                onPointerDown={(event) => startDrag(event, { type: 'tab', index, current: stop.position * geometry.scale, outside: false })}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

function VerticalDocumentRuler({ editor, containerRef }) {
  const [geometry, setGeometry] = useState({
    height: 1147,
    pageTop: 24,
    pageHeight: 1123,
    pageCount: 1,
    paddingTop: 68,
    paddingBottom: 68,
    pageGap: PAGE_GAP,
    scale: 1,
  })

  useEffect(() => {
    const pageElement = containerRef.current
    const editorElement = pageElement?.querySelector('.ProseMirror')
    if (!pageElement || !editorElement || typeof ResizeObserver === 'undefined') return undefined

    const sync = () => {
      const pageRect = pageElement.getBoundingClientRect()
      const workbench = pageElement.parentElement
      const workbenchRect = workbench?.getBoundingClientRect()
      const pageWidth = pageRect.width
      const scale = pageElement.clientWidth > 0 ? pageWidth / pageElement.clientWidth : 1
      const styles = getComputedStyle(editorElement)
      const pageTop = workbenchRect
        ? pageRect.top - workbenchRect.top + workbench.scrollTop
        : pageElement.offsetTop * scale
      const pageCount = getDocumentPageCount(editorElement)
      const pageGeometry = getDocumentPageGeometry({ pageWidth, pageCount, scale, pageTop })
      setGeometry({
        height: pageTop + pageGeometry.totalHeight,
        pageTop,
        pageHeight: pageGeometry.pageHeight,
        pageCount,
        paddingTop: (parseFloat(styles.paddingTop) || 0) * scale,
        paddingBottom: (parseFloat(styles.paddingBottom) || 0) * scale,
        pageGap: pageGeometry.pageGap,
        scale,
      })
    }

    sync()
    const observer = new ResizeObserver(sync)
    observer.observe(pageElement)
    observer.observe(editorElement)
    const pageCountObserver = new MutationObserver(sync)
    pageCountObserver.observe(editorElement, {
      attributes: true,
      attributeFilter: ['data-page-count'],
      childList: true,
      subtree: true,
    })
    window.addEventListener('resize', sync)
    return () => {
      observer.disconnect()
      pageCountObserver.disconnect()
      window.removeEventListener('resize', sync)
    }
  }, [containerRef, editor])

  const contentHeight = Math.max(120, geometry.pageHeight - geometry.paddingTop - geometry.paddingBottom)
  const tickCount = Math.ceil(contentHeight / (40 * geometry.scale))

  return (
    <div
      data-vertical-ruler
      aria-label="Vertical page ruler"
      className="qn-vertical-ruler absolute left-0 top-0 z-10"
      style={{ height: `${geometry.height}px` }}
    >
      {Array.from({ length: geometry.pageCount }, (_, pageIndex) => (
        <div
          key={pageIndex}
          className="qn-vertical-ruler__page absolute inset-x-0 overflow-hidden"
          style={{
            top: `${geometry.pageTop + pageIndex * (geometry.pageHeight + geometry.pageGap)}px`,
            height: `${geometry.pageHeight}px`,
          }}
        >
          <span className="qn-vertical-ruler__margin qn-vertical-ruler__margin--top" style={{ height: `${geometry.paddingTop}px` }} />
          <div
            className="qn-vertical-ruler__track absolute inset-x-0"
            style={{ top: `${geometry.paddingTop}px`, height: `${contentHeight}px` }}
          >
            {Array.from({ length: tickCount + 1 }, (_, index) => (
              <span key={index} className="qn-vertical-ruler__tick" style={{ top: `${index * 40 * geometry.scale}px` }}>
                {index > 0 && <span>{index}</span>}
              </span>
            ))}
          </div>
          <span className="qn-vertical-ruler__margin qn-vertical-ruler__margin--bottom" style={{ height: `${geometry.paddingBottom}px` }} />
        </div>
      ))}
    </div>
  )
}

function DocumentPageSheets({ editor, containerRef, paperStyle }) {
  const [geometry, setGeometry] = useState({ pageCount: 1, pageHeight: 1123 })

  useEffect(() => {
    const pageElement = containerRef.current
    const editorElement = pageElement?.querySelector('.ProseMirror')
    if (!pageElement || !editorElement) return undefined

    const sync = () => {
      const pageWidth = pageElement.clientWidth
      const pageCount = getDocumentPageCount(editorElement)
      setGeometry((current) => {
        const { pageHeight } = getDocumentPageGeometry({ pageWidth, pageCount })
        return current.pageCount === pageCount && Math.abs(current.pageHeight - pageHeight) < 0.5
          ? current
          : { pageCount, pageHeight }
      })
    }

    sync()
    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(sync)
    resizeObserver?.observe(pageElement)
    const pageCountObserver = new MutationObserver(sync)
    pageCountObserver.observe(editorElement, {
      attributes: true,
      attributeFilter: ['data-page-count'],
    })
    window.addEventListener('resize', sync)
    return () => {
      resizeObserver?.disconnect()
      pageCountObserver.disconnect()
      window.removeEventListener('resize', sync)
    }
  }, [containerRef, editor])

  return (
    <div className="qn-document-page-sheets" aria-hidden="true">
      {Array.from({ length: geometry.pageCount }, (_, pageIndex) => {
        const pageGeometry = { ...geometry, pageTop: 0, pageGap: PAGE_GAP }
        const pageTop = getDocumentPageTop(pageIndex, pageGeometry)
        const pagePosition = {
          top: `${pageTop}px`,
          height: `${geometry.pageHeight}px`,
        }
        return (
          <Fragment key={pageIndex}>
            <span
              className="qn-document-page-sheet"
              data-page-number={pageIndex + 1}
              style={{ ...paperStyle, ...pagePosition }}
            />
            <span
              className="qn-document-page-edge"
              data-page-number={pageIndex + 1}
              style={pagePosition}
            />
            {pageIndex < geometry.pageCount - 1 && (
              <span
                className="qn-document-page-gutter"
                data-after-page={pageIndex + 1}
                style={{
                  top: `${pageTop + geometry.pageHeight}px`,
                  height: `${PAGE_GAP}px`,
                }}
              />
            )}
          </Fragment>
        )
      })}
    </div>
  )
}
export { DocumentPageSheets, DocumentRuler, VerticalDocumentRuler }
