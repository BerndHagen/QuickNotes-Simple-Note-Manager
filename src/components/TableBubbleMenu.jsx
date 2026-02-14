import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { BubbleMenu } from '@tiptap/react'
import {
  Columns,
  Rows,
  Trash2,
  ChevronDown,
  Palette,
  X,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Merge,
  Split,
  TableProperties,
  Grid,
  PaintBucket
} from 'lucide-react'
import { useTranslation } from '../lib/useTranslation'
const cellColors = [
  null,
  '#ffffff', '#f3f4f6', '#e5e7eb', '#d1d5db',
  '#fee2e2', '#fecaca', '#fca5a5', '#f87171',
  '#ffedd5', '#fed7aa', '#fdba74', '#fb923c',
  '#fef9c3', '#fef08a', '#fde047', '#facc15',
  '#dcfce7', '#bbf7d0', '#86efac', '#4ade80',
  '#ccfbf1', '#99f6e4', '#5eead4', '#2dd4bf',
  '#dbeafe', '#bfdbfe', '#93c5fd', '#60a5fa',
  '#ede9fe', '#ddd6fe', '#c4b5fd', '#a78bfa',
  '#fce7f3', '#fbcfe8', '#f9a8d4', '#f472b6',
]
function PortalTooltip({ children, title, anchorRef }) {
  const [visible, setVisible] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const tooltipRef = useRef(null)

  useEffect(() => {
    if (visible && anchorRef?.current) {
      const updatePosition = () => {
        const rect = anchorRef.current.getBoundingClientRect()
        const tooltipRect = tooltipRef.current?.getBoundingClientRect()
        const tooltipWidth = tooltipRect?.width || 100
        
        let left = rect.left + rect.width / 2 - tooltipWidth / 2
        const top = rect.top - 8
        
        if (left < 8) left = 8
        if (left + tooltipWidth > window.innerWidth - 8) {
          left = window.innerWidth - tooltipWidth - 8
        }
        
        setPosition({ top, left })
      }
      
      updatePosition()
      const timeoutId = setTimeout(updatePosition, 0)
      return () => clearTimeout(timeoutId)
    }
  }, [visible, anchorRef])

  if (!title) return children

  return (
    <>
      <div
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
      >
        {children}
      </div>
      {visible && createPortal(
        <div
          ref={tooltipRef}
          className="fixed px-2.5 py-1.5 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg whitespace-nowrap z-[99999] pointer-events-none shadow-lg"
          style={{ 
            top: position.top, 
            left: position.left,
            transform: 'translateY(-100%)'
          }}
        >
          <span>{title}</span>
          <div 
            className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700" 
          />
        </div>,
        document.body
      )}
    </>
  )
}
function MenuButton({ onClick, isActive, disabled, children, title }) {
  const buttonRef = useRef(null)
  
  const button = (
    <button
      ref={buttonRef}
      onMouseDown={(e) => {
        e.preventDefault()
        e.stopPropagation()
        if (!disabled && onClick) onClick()
      }}
      disabled={disabled}
      className={`p-1.5 rounded transition-all duration-150 ${
        isActive
          ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300'
          : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {children}
    </button>
  )

  if (!title) return button

  return (
    <PortalTooltip title={title} anchorRef={buttonRef}>
      {button}
    </PortalTooltip>
  )
}
function DropdownButton({ children, isOpen, onClick, title }) {
  const buttonRef = useRef(null)
  
  const button = (
    <button
      ref={buttonRef}
      onMouseDown={(e) => {
        e.preventDefault()
        e.stopPropagation()
        if (onClick) onClick()
      }}
      className={`p-1.5 rounded transition-all duration-150 flex items-center gap-1 ${
        isOpen
          ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300'
          : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
      }`}
    >
      {children}
      <ChevronDown className="w-3 h-3" />
    </button>
  )
  
  if (!title || isOpen) return button
  
  return (
    <PortalTooltip title={title} anchorRef={buttonRef}>
      {button}
    </PortalTooltip>
  )
}
function ColorPickerDropdown({ isOpen, onClose, onSelect, currentColor, title, anchorRef }) {
  const [customColor, setCustomColor] = useState(currentColor || '#ffffff')
  const [position, setPosition] = useState({ top: 0, left: 0, openUp: false })
  const dropdownRef = useRef(null)
  
  useEffect(() => {
    if (isOpen && anchorRef?.current && dropdownRef.current) {
      const anchorRect = anchorRef.current.getBoundingClientRect()
      const dropdownRect = dropdownRef.current.getBoundingClientRect()
      const padding = 10
      const bottomPadding = 60
      const spaceBelow = window.innerHeight - anchorRect.bottom - bottomPadding
      const spaceAbove = anchorRect.top - padding
      const openUp = spaceBelow < dropdownRect.height && spaceAbove > spaceBelow
      
      let top = openUp 
        ? anchorRect.top - dropdownRect.height - 4
        : anchorRect.bottom + 4
      let left = anchorRect.left
      if (left + dropdownRect.width > window.innerWidth - padding) {
        left = window.innerWidth - dropdownRect.width - padding
      }
      if (left < padding) left = padding
      if (top < padding) top = padding
      if (top + dropdownRect.height > window.innerHeight - bottomPadding) {
        top = window.innerHeight - bottomPadding - dropdownRect.height
      }
      
      setPosition({ top, left, openUp })
    }
  }, [isOpen, anchorRef])
  
  if (!isOpen) return null

  return createPortal(
    <div 
      ref={dropdownRef}
      className="fixed bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-[#cbd1db] dark:border-gray-700 p-3 z-[99999] min-w-[240px]"
      style={{ top: position.top, left: position.left }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">{title}</p>
      <div className="grid grid-cols-8 gap-1.5">
        {cellColors.map((color, index) => (
          <button
            key={index}
            onMouseDown={(e) => {
              e.preventDefault()
              onSelect(color)
              onClose()
            }}
            className={`w-6 h-6 rounded border-2 hover:scale-110 transition-all flex items-center justify-center ${
              currentColor === color 
                ? 'border-emerald-500 ring-2 ring-emerald-200 dark:ring-emerald-800' 
                : 'border-[#cbd1db] dark:border-gray-600 hover:border-emerald-400'
            }`}
            style={{ 
              backgroundColor: color || 'transparent',
              backgroundImage: color === null ? 'linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%), linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%)' : undefined,
              backgroundSize: color === null ? '6px 6px' : undefined,
              backgroundPosition: color === null ? '0 0, 3px 3px' : undefined,
            }}
            title={color || 'No color'}
          >
            {currentColor === color && (
              <svg className="w-3 h-3" style={{ color: color && (color === '#ffffff' || color === '#f3f4f6' || color === '#fef9c3' || color === '#fef08a') ? '#374151' : '#fff' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            )}
          </button>
        ))}
      </div>
      <div className="mt-3 pt-3 border-t border-[#cbd1db] dark:border-gray-600">
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Custom Color</label>
        <div className="flex gap-2">
          <input
            type="color"
            value={customColor}
            onChange={(e) => setCustomColor(e.target.value)}
            className="w-8 h-8 rounded cursor-pointer border border-[#cbd1db] dark:border-gray-600"
          />
          <input
            type="text"
            value={customColor}
            onChange={(e) => setCustomColor(e.target.value)}
            className="flex-1 px-2 py-1 text-xs border border-[#cbd1db] dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            placeholder="#ffffff"
          />
          <button
            onMouseDown={(e) => {
              e.preventDefault()
              onSelect(customColor)
              onClose()
            }}
            className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded"
          >
            Apply
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
function DropdownMenu({ isOpen, onClose, anchorRef, children }) {
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const menuRef = useRef(null)
  
  useEffect(() => {
    if (isOpen && anchorRef?.current && menuRef.current) {
      const anchorRect = anchorRef.current.getBoundingClientRect()
      const menuRect = menuRef.current.getBoundingClientRect()
      const padding = 10
      const bottomPadding = 60
      const spaceBelow = window.innerHeight - anchorRect.bottom - bottomPadding
      const spaceAbove = anchorRect.top - padding
      const openUp = spaceBelow < menuRect.height && spaceAbove > spaceBelow
      
      let top = openUp 
        ? anchorRect.top - menuRect.height - 4
        : anchorRect.bottom + 4
      let left = anchorRect.left
      if (left + menuRect.width > window.innerWidth - padding) {
        left = window.innerWidth - menuRect.width - padding
      }
      if (left < padding) left = padding
      if (top < padding) top = padding
      if (top + menuRect.height > window.innerHeight - bottomPadding) {
        top = window.innerHeight - bottomPadding - menuRect.height
      }
      
      setPosition({ top, left })
    }
  }, [isOpen, anchorRef])
  
  if (!isOpen) return null

  return createPortal(
    <div 
      ref={menuRef}
      className="fixed bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-[#cbd1db] dark:border-gray-700 py-1 min-w-[160px] z-[99999]"
      style={{ top: position.top, left: position.left }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {children}
    </div>,
    document.body
  )
}
export default function TableBubbleMenu({ editor }) {
  const { t } = useTranslation()
  const [showCellColorPicker, setShowCellColorPicker] = useState(false)
  const [showRowColorPicker, setShowRowColorPicker] = useState(false)
  const [showColumnMenu, setShowColumnMenu] = useState(false)
  const [showRowMenu, setShowRowMenu] = useState(false)
  const menuRef = useRef(null)
  const columnButtonRef = useRef(null)
  const rowButtonRef = useRef(null)
  const cellColorButtonRef = useRef(null)
  const rowColorButtonRef = useRef(null)
  const closeAllDropdowns = () => {
    setShowCellColorPicker(false)
    setShowRowColorPicker(false)
    setShowColumnMenu(false)
    setShowRowMenu(false)
  }
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        closeAllDropdowns()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])
  const getCurrentCellColor = () => {
    const attrs = editor.getAttributes('tableCell')
    return attrs.backgroundColor || null
  }
  const setCellBackgroundColor = (color) => {
    if (color) {
      editor.chain().focus().setCellAttribute('backgroundColor', color).run()
    } else {
      editor.chain().focus().setCellAttribute('backgroundColor', null).run()
    }
  }
  const setRowBackgroundColor = (color) => {
    const { state } = editor
    const { selection } = state
    const { $from } = selection
    let depth = $from.depth
    while (depth > 0 && $from.node(depth).type.name !== 'tableRow') {
      depth--
    }
    
    if (depth > 0) {
      const row = $from.node(depth)
      const rowStart = $from.before(depth)
      const rowEnd = $from.after(depth)
      editor.chain().focus().command(({ tr, dispatch }) => {
        if (dispatch) {
          state.doc.nodesBetween(rowStart, rowEnd, (node, pos) => {
            if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
              tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                backgroundColor: color,
              })
            }
          })
        }
        return true
      }).run()
    }
  }
  const MenuDivider = () => (
    <div className="w-px h-5 bg-gray-300 dark:bg-gray-600 mx-1" />
  )

  return (
    <BubbleMenu
      editor={editor}
      pluginKey="tableBubbleMenu"
      tippyOptions={{
        duration: 100,
        placement: 'top',
        offset: [0, 8],
      }}
      shouldShow={({ editor, state }) => {
        return editor.isActive('table')
      }}
      className="bg-white dark:bg-gray-800 shadow-xl rounded-xl border border-[#cbd1db] dark:border-gray-700 flex items-center p-1.5 gap-0.5"
    >
      <div ref={menuRef} className="flex items-center gap-0.5">
        <div className="relative" ref={columnButtonRef}>
          <DropdownButton 
            isOpen={showColumnMenu} 
            onClick={() => {
              closeAllDropdowns()
              setShowColumnMenu(!showColumnMenu)
            }}
            title={t('editor.columns') || 'Columns'}
          >
            <Columns className="w-4 h-4" />
          </DropdownButton>
          
          <DropdownMenu
            isOpen={showColumnMenu}
            onClose={() => setShowColumnMenu(false)}
            anchorRef={columnButtonRef}
          >
            <button
              onMouseDown={(e) => {
                e.preventDefault()
                editor.chain().focus().addColumnBefore().run()
                setShowColumnMenu(false)
              }}
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-gray-700 dark:text-gray-300"
            >
              <ArrowLeft className="w-4 h-4" />
              {t('editor.addColumnBefore') || 'Insert Left'}
            </button>
            <button
              onMouseDown={(e) => {
                e.preventDefault()
                editor.chain().focus().addColumnAfter().run()
                setShowColumnMenu(false)
              }}
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-gray-700 dark:text-gray-300"
            >
              <ArrowRight className="w-4 h-4" />
              {t('editor.addColumnAfter') || 'Insert Right'}
            </button>
            <div className="h-px bg-gray-200 dark:bg-gray-700 my-1" />
            <button
              onMouseDown={(e) => {
                e.preventDefault()
                editor.chain().focus().deleteColumn().run()
                setShowColumnMenu(false)
              }}
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-red-600 dark:text-red-400"
            >
              <X className="w-4 h-4" />
              {t('editor.deleteColumn') || 'Delete Column'}
            </button>
          </DropdownMenu>
        </div>
        <div className="relative" ref={rowButtonRef}>
          <DropdownButton 
            isOpen={showRowMenu} 
            onClick={() => {
              closeAllDropdowns()
              setShowRowMenu(!showRowMenu)
            }}
            title={t('editor.rows') || 'Rows'}
          >
            <Rows className="w-4 h-4" />
          </DropdownButton>
          
          <DropdownMenu
            isOpen={showRowMenu}
            onClose={() => setShowRowMenu(false)}
            anchorRef={rowButtonRef}
          >
            <button
              onMouseDown={(e) => {
                e.preventDefault()
                editor.chain().focus().addRowBefore().run()
                setShowRowMenu(false)
              }}
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-gray-700 dark:text-gray-300"
            >
              <ArrowUp className="w-4 h-4" />
              {t('editor.addRowBefore') || 'Insert Above'}
            </button>
            <button
              onMouseDown={(e) => {
                e.preventDefault()
                editor.chain().focus().addRowAfter().run()
                setShowRowMenu(false)
              }}
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-gray-700 dark:text-gray-300"
            >
              <ArrowDown className="w-4 h-4" />
              {t('editor.addRowAfter') || 'Insert Below'}
            </button>
            <div className="h-px bg-gray-200 dark:bg-gray-700 my-1" />
            <button
              onMouseDown={(e) => {
                e.preventDefault()
                editor.chain().focus().deleteRow().run()
                setShowRowMenu(false)
              }}
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-red-600 dark:text-red-400"
            >
              <X className="w-4 h-4" />
              {t('editor.deleteRow') || 'Delete Row'}
            </button>
          </DropdownMenu>
        </div>

        <MenuDivider />
        <div className="relative" ref={cellColorButtonRef}>
          <DropdownButton 
            isOpen={showCellColorPicker} 
            onClick={() => {
              closeAllDropdowns()
              setShowCellColorPicker(!showCellColorPicker)
            }}
            title={t('editor.cellColor') || 'Cell Color'}
          >
            <PaintBucket className="w-4 h-4" />
          </DropdownButton>
          
          <ColorPickerDropdown
            isOpen={showCellColorPicker}
            onClose={() => setShowCellColorPicker(false)}
            onSelect={setCellBackgroundColor}
            currentColor={getCurrentCellColor()}
            title={t('editor.cellBackgroundColor') || 'Cell Background Color'}
            anchorRef={cellColorButtonRef}
          />
        </div>
        <div className="relative" ref={rowColorButtonRef}>
          <DropdownButton 
            isOpen={showRowColorPicker} 
            onClick={() => {
              closeAllDropdowns()
              setShowRowColorPicker(!showRowColorPicker)
            }}
            title={t('editor.rowColor') || 'Row Color'}
          >
            <Palette className="w-4 h-4" />
          </DropdownButton>
          
          <ColorPickerDropdown
            isOpen={showRowColorPicker}
            onClose={() => setShowRowColorPicker(false)}
            onSelect={setRowBackgroundColor}
            currentColor={null}
            title={t('editor.rowBackgroundColor') || 'Row Background Color'}
            anchorRef={rowColorButtonRef}
          />
        </div>

        <MenuDivider />
        <MenuButton
          onClick={() => editor.chain().focus().mergeCells().run()}
          disabled={!editor.can().mergeCells()}
          title={t('editor.mergeCells') || 'Merge Cells'}
        >
          <Merge className="w-4 h-4" />
        </MenuButton>

        <MenuButton
          onClick={() => editor.chain().focus().splitCell().run()}
          disabled={!editor.can().splitCell()}
          title={t('editor.splitCell') || 'Split Cell'}
        >
          <Split className="w-4 h-4" />
        </MenuButton>

        <MenuDivider />
        <MenuButton
          onClick={() => editor.chain().focus().toggleHeaderRow().run()}
          title={t('editor.toggleHeaderRow') || 'Toggle Header Row'}
        >
          <TableProperties className="w-4 h-4" />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().toggleHeaderColumn().run()}
          title={t('editor.toggleHeaderColumn') || 'Toggle Header Column'}
        >
          <Grid className="w-4 h-4" />
        </MenuButton>

        <MenuDivider />
        <MenuButton
          onClick={() => editor.chain().focus().deleteTable().run()}
          title={t('editor.deleteTable') || 'Delete Table'}
        >
          <Trash2 className="w-4 h-4 text-red-500" />
        </MenuButton>
      </div>
    </BubbleMenu>
  )
}
