import { useState, useRef, useCallback, useEffect } from 'react'
import { NodeViewWrapper } from '@tiptap/react'
import {
  FlipHorizontal,
  FlipVertical,
  RotateCw,
  RotateCcw,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Trash2,
  Download,
  Copy
} from 'lucide-react'

export default function ResizableImage({ node, updateAttributes, deleteNode, selected }) {
  const [isResizing, setIsResizing] = useState(false)
  const [showControls, setShowControls] = useState(false)
  const imageRef = useRef(null)
  const startPos = useRef({ x: 0, y: 0, width: 0 })
  const resizeCleanupRef = useRef(() => {})

  const { src, alt, title, width, flipH, flipV, rotation, align } = node.attrs
  const getTransformStyle = () => {
    let transform = ''
    if (flipH) transform += 'scaleX(-1) '
    if (flipV) transform += 'scaleY(-1) '
    if (rotation) transform += `rotate(${rotation}deg) `
    return transform.trim() || 'none'
  }
  const getAlignmentClasses = () => {
    switch (align) {
      case 'left': return 'mr-auto'
      case 'right': return 'ml-auto'
      default: return 'mx-auto'
    }
  }
  const handleResizeStart = useCallback((e, direction) => {
    e.preventDefault()
    e.stopPropagation()
    setIsResizing(true)
    
    const img = imageRef.current
    if (!img) return

    startPos.current = {
      x: e.clientX,
      y: e.clientY,
      width: img.offsetWidth,
      direction
    }

    e.currentTarget.setPointerCapture?.(e.pointerId)

    const handlePointerMove = (e) => {
      const deltaX = e.clientX - startPos.current.x
      const delta = startPos.current.direction === 'left' ? -deltaX : deltaX
      const newWidth = Math.max(100, Math.min(startPos.current.width + delta, 1200))
      updateAttributes({ width: newWidth })
    }

    resizeCleanupRef.current()

    const cleanup = () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
      resizeCleanupRef.current = () => {}
    }
    const handlePointerUp = () => {
      setIsResizing(false)
      cleanup()
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)
    resizeCleanupRef.current = cleanup
  }, [updateAttributes])
  useEffect(() => () => resizeCleanupRef.current(), [])
  const presetSizes = [
    { label: 'S', width: 200 },
    { label: 'M', width: 400 },
    { label: 'L', width: 600 },
    { label: 'XL', width: 800 },
    { label: '100%', width: null },
  ]
  const handleFlipH = () => updateAttributes({ flipH: !flipH })
  const handleFlipV = () => updateAttributes({ flipV: !flipV })
  const handleRotateCW = () => updateAttributes({ rotation: ((rotation || 0) + 90) % 360 })
  const handleRotateCCW = () => updateAttributes({ rotation: ((rotation || 0) - 90 + 360) % 360 })
  const handleAlign = (newAlign) => updateAttributes({ align: newAlign })
  const handleSetWidth = (newWidth) => updateAttributes({ width: newWidth })

  const handleDownload = () => {
    const link = document.createElement('a')
    link.href = src
    link.download = alt || 'image'
    link.click()
  }

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(src)
  }
  return (
    <NodeViewWrapper className="relative my-4">
      <div 
        className={`relative inline-block ${getAlignmentClasses()} group`}
        onMouseEnter={() => setShowControls(true)}
        onMouseLeave={() => setShowControls(false)}
        style={{ width: width || 'auto', maxWidth: '100%' }}
      >
        <img
          ref={imageRef}
          src={src}
          alt={alt || ''}
          title={title || ''}
          className={`rounded-lg shadow-md transition-[width,transform,box-shadow] duration-base ${
 selected ? 'ring-2 ring-accent ring-offset-2' : ''
 } ${isResizing ? 'select-none' : ''}`}
          style={{
            width: width ? `${width}px` : '100%',
            maxWidth: '100%',
            height: 'auto',
            transform: getTransformStyle(),
          }}
          draggable={false}
        />
        {(showControls || selected) && (
          <>
            <div
              className="qn-image-resize-handle absolute left-0 top-1/2 h-12 w-3 -translate-x-1/2 -translate-y-1/2 touch-none cursor-ew-resize rounded-full bg-accent opacity-0 shadow-lg transition-opacity hover:bg-accent-hover group-hover:opacity-100"
              onPointerDown={(e) => handleResizeStart(e, 'left')}
              aria-hidden="true"
            />
            <div
              className="qn-image-resize-handle absolute right-0 top-1/2 h-12 w-3 translate-x-1/2 -translate-y-1/2 touch-none cursor-ew-resize rounded-full bg-accent opacity-0 shadow-lg transition-opacity hover:bg-accent-hover group-hover:opacity-100"
              onPointerDown={(e) => handleResizeStart(e, 'right')}
              aria-hidden="true"
            />
          </>
        )}
        {(showControls || selected) && (
          <div className="image-menu absolute left-0 top-full z-10 mt-2 flex max-w-[calc(100vw-2rem)] items-center gap-1 overflow-x-auto overscroll-x-contain rounded-lg border border-subtle bg-surface-raised p-1.5 opacity-100 shadow-xl transition-opacity sm:-top-12 sm:left-1/2 sm:mt-0 sm:max-w-none sm:-translate-x-1/2 sm:overflow-visible sm:opacity-0 sm:group-hover:opacity-100">
            <div className="flex items-center gap-0.5 px-1 border-r border-subtle">
              {presetSizes.map((size) => (
                <button
                  key={size.label}
                  onClick={() => handleSetWidth(size.width)}
                  aria-label={`Set image width to ${size.label}`}
                  aria-pressed={(size.width === null && !width) || width === size.width}
                  className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
 (size.width === null && !width) || width === size.width
 ? 'bg-accent-soft text-accent-text'
                      : 'hover:bg-surface-hover text-content-muted'
                  }`}
                  title={`Set width to ${size.label}`}
                >
                  {size.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-0.5 px-1 border-r border-subtle">
              <button
                onClick={handleFlipH}
                aria-label="Flip image horizontally"
                className={`p-1.5 rounded transition-colors ${
 flipH ? 'bg-accent-soft text-accent-text' : 'hover:bg-surface-hover text-content-muted'
 }`}
                title="Flip horizontal"
              >
                <FlipHorizontal className="w-4 h-4" />
              </button>
              <button
                onClick={handleFlipV}
                aria-label="Flip image vertically"
                className={`p-1.5 rounded transition-colors ${
 flipV ? 'bg-accent-soft text-accent-text' : 'hover:bg-surface-hover text-content-muted'
 }`}
                title="Flip vertical"
              >
                <FlipVertical className="w-4 h-4" />
              </button>
              <button
                onClick={handleRotateCCW}
                aria-label="Rotate image left"
                className="p-1.5 rounded hover:bg-surface-hover text-content-muted transition-colors"
                title="Rotate left"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={handleRotateCW}
                aria-label="Rotate image right"
                className="p-1.5 rounded hover:bg-surface-hover text-content-muted transition-colors"
                title="Rotate right"
              >
                <RotateCw className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center gap-0.5 px-1 border-r border-subtle">
              <button
                onClick={() => handleAlign('left')}
                aria-label="Align image left"
                className={`p-1.5 rounded transition-colors ${
 align === 'left' ? 'bg-accent-soft text-accent-text' : 'hover:bg-surface-hover text-content-muted'
 }`}
                title="Align left"
              >
                <AlignLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleAlign('center')}
                aria-label="Align image center"
                className={`p-1.5 rounded transition-colors ${
 align === 'center' || !align ? 'bg-accent-soft text-accent-text' : 'hover:bg-surface-hover text-content-muted'
 }`}
                title="Align center"
              >
                <AlignCenter className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleAlign('right')}
                aria-label="Align image right"
                className={`p-1.5 rounded transition-colors ${
 align === 'right' ? 'bg-accent-soft text-accent-text' : 'hover:bg-surface-hover text-content-muted'
 }`}
                title="Align right"
              >
                <AlignRight className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center gap-0.5 px-1">
              <button
                onClick={handleDownload}
                aria-label="Download image"
                className="p-1.5 rounded hover:bg-surface-hover text-content-muted transition-colors"
                title="Download image"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                onClick={handleCopyUrl}
                aria-label="Copy image URL"
                className="p-1.5 rounded hover:bg-surface-hover text-content-muted transition-colors"
                title="Copy image URL"
              >
                <Copy className="w-4 h-4" />
              </button>
              <button
                onClick={deleteNode}
                aria-label="Delete image"
                className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/50 text-red-500 transition-colors"
                title="Delete image"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
        {isResizing && (
          <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/75 text-white text-xs rounded">
            {width || imageRef.current?.offsetWidth}px
          </div>
        )}
        {selected && (
          <div className="mt-2 text-center">
            <input
              type="text"
              placeholder="Add caption..."
              value={alt || ''}
              onChange={(e) => updateAttributes({ alt: e.target.value })}
              className="text-sm text-content-muted bg-transparent border-b border-dashed border-subtle focus:border-accent focus:outline-none text-center px-2 py-1"
            />
          </div>
        )}
      </div>
    </NodeViewWrapper>
  )
}
