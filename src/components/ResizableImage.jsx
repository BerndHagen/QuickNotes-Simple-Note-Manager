import React, { useState, useRef, useCallback, useEffect } from 'react'
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
  const [showMenu, setShowMenu] = useState(false)
  const imageRef = useRef(null)
  const startPos = useRef({ x: 0, y: 0, width: 0 })

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

    const handleMouseMove = (e) => {
      const deltaX = e.clientX - startPos.current.x
      const delta = startPos.current.direction === 'left' ? -deltaX : deltaX
      const newWidth = Math.max(100, Math.min(startPos.current.width + delta, 1200))
      updateAttributes({ width: newWidth })
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [updateAttributes])
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
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showMenu && !e.target.closest('.image-menu')) {
        setShowMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showMenu])

  return (
    <NodeViewWrapper className="relative my-4">
      <div 
        className={`relative inline-block ${getAlignmentClasses()} group`}
        onMouseEnter={() => setShowControls(true)}
        onMouseLeave={() => !showMenu && setShowControls(false)}
        style={{ width: width || 'auto', maxWidth: '100%' }}
      >
        <img
          ref={imageRef}
          src={src}
          alt={alt || ''}
          title={title || ''}
          className={`rounded-lg shadow-md transition-all duration-200 ${
            selected ? 'ring-2 ring-primary-500 ring-offset-2' : ''
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
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-12 bg-primary-500 rounded-full cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary-600 shadow-lg"
              onMouseDown={(e) => handleResizeStart(e, 'left')}
            />
            <div
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3 h-12 bg-primary-500 rounded-full cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary-600 shadow-lg"
              onMouseDown={(e) => handleResizeStart(e, 'right')}
            />
          </>
        )}
        {(showControls || selected) && (
          <div className="absolute -top-12 left-1/2 -translate-x-1/2 flex items-center gap-1 p-1.5 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 opacity-0 group-hover:opacity-100 transition-opacity z-10 image-menu">
            <div className="flex items-center gap-0.5 px-1 border-r border-gray-200 dark:border-gray-700">
              {presetSizes.map((size) => (
                <button
                  key={size.label}
                  onClick={() => handleSetWidth(size.width)}
                  className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                    (size.width === null && !width) || width === size.width
                      ? 'bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
                  }`}
                  title={`Set width to ${size.label}`}
                >
                  {size.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-0.5 px-1 border-r border-gray-200 dark:border-gray-700">
              <button
                onClick={handleFlipH}
                className={`p-1.5 rounded transition-colors ${
                  flipH ? 'bg-primary-100 dark:bg-primary-900/50 text-primary-600' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
                }`}
                title="Flip horizontal"
              >
                <FlipHorizontal className="w-4 h-4" />
              </button>
              <button
                onClick={handleFlipV}
                className={`p-1.5 rounded transition-colors ${
                  flipV ? 'bg-primary-100 dark:bg-primary-900/50 text-primary-600' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
                }`}
                title="Flip vertical"
              >
                <FlipVertical className="w-4 h-4" />
              </button>
              <button
                onClick={handleRotateCCW}
                className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors"
                title="Rotate left"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={handleRotateCW}
                className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors"
                title="Rotate right"
              >
                <RotateCw className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center gap-0.5 px-1 border-r border-gray-200 dark:border-gray-700">
              <button
                onClick={() => handleAlign('left')}
                className={`p-1.5 rounded transition-colors ${
                  align === 'left' ? 'bg-primary-100 dark:bg-primary-900/50 text-primary-600' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
                }`}
                title="Align left"
              >
                <AlignLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleAlign('center')}
                className={`p-1.5 rounded transition-colors ${
                  align === 'center' || !align ? 'bg-primary-100 dark:bg-primary-900/50 text-primary-600' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
                }`}
                title="Align center"
              >
                <AlignCenter className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleAlign('right')}
                className={`p-1.5 rounded transition-colors ${
                  align === 'right' ? 'bg-primary-100 dark:bg-primary-900/50 text-primary-600' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
                }`}
                title="Align right"
              >
                <AlignRight className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center gap-0.5 px-1">
              <button
                onClick={handleDownload}
                className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors"
                title="Download image"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                onClick={handleCopyUrl}
                className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors"
                title="Copy image URL"
              >
                <Copy className="w-4 h-4" />
              </button>
              <button
                onClick={deleteNode}
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
              className="text-sm text-gray-500 dark:text-gray-400 bg-transparent border-b border-dashed border-gray-300 dark:border-gray-600 focus:border-primary-500 focus:outline-none text-center px-2 py-1"
            />
          </div>
        )}
      </div>
    </NodeViewWrapper>
  )
}
