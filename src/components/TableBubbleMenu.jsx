import { useState, useRef, useEffect } from 'react'
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

  return (
    <>
      <div
        onMouseEnter={() => title && setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => title && setVisible(true)}
        onBlur={() => setVisible(false)}
      >
        {children}
      </div>
      {title && visible && createPortal(
        <div
          ref={tooltipRef}
          className="fixed px-2.5 py-1.5 bg-surface-sunken dark:bg-surface-sunken text-white text-xs rounded-lg whitespace-nowrap z-[99999] pointer-events-none shadow-lg"
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
      type="button"
      aria-label={title}
      onMouseDown={(e) => {
        e.preventDefault()
        e.stopPropagation()
      }}
      onClick={(e) => {
        e.stopPropagation()
        if (!disabled && onClick) onClick()
      }}
      disabled={disabled}
      className={`p-1.5 rounded transition-all duration-150 ${
 isActive
 ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300'
          : 'hover:bg-surface-hover text-content-muted hover:text-content dark:hover:text-white'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {children}
    </button>
  )

  return (
    <PortalTooltip title={title} anchorRef={buttonRef}>
      {button}
    </PortalTooltip>
  )
}
function DropdownButton({ children, isOpen, onClick, title, popupRole = 'menu' }) {
  const buttonRef = useRef(null)
  
  const button = (
    <button
      ref={buttonRef}
      type="button"
      aria-label={title}
      aria-expanded={isOpen}
      aria-haspopup={popupRole}
      onMouseDown={(e) => {
        e.preventDefault()
        e.stopPropagation()
      }}
      onClick={(e) => {
        e.stopPropagation()
        onClick?.()
      }}
      className={`p-1.5 rounded transition-all duration-150 flex items-center gap-1 ${
 isOpen
 ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300'
          : 'hover:bg-surface-hover text-content-muted hover:text-content dark:hover:text-white'
      }`}
    >
      {children}
      <ChevronDown className="w-3 h-3" />
    </button>
  )
  
  return (
    <PortalTooltip title={isOpen ? null : title} anchorRef={buttonRef}>
      {button}
    </PortalTooltip>
  )
}
function ColorPickerDropdown({ isOpen, onClose, onSelect, currentColor, title, anchorRef }) {
  const [customColor, setCustomColor] = useState(currentColor || '#ffffff')
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const dropdownRef = useRef(null)
  const customColorValid = /^#[0-9a-f]{6}$/i.test(customColor)

  useEffect(() => {
    if (isOpen) setCustomColor(currentColor || '#ffffff')
  }, [currentColor, isOpen])
  
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
      
      setPosition({ top, left })
    }
  }, [isOpen, anchorRef])
  
  if (!isOpen) return null

  return createPortal(
    <div 
      ref={dropdownRef}
      role="dialog"
      aria-label={title}
      className="fixed z-[99999] w-[min(18rem,calc(100vw-1.25rem))] rounded-xl border border-subtle bg-surface-raised p-3 shadow-2xl"
      style={{ top: position.top, left: position.left }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <p className="text-xs font-medium text-content-muted mb-2">{title}</p>
      <div className="grid grid-cols-6 gap-1 sm:grid-cols-8">
        {cellColors.map((color, index) => (
          <button
            key={index}
            type="button"
            aria-label={color || 'No colour'}
            aria-pressed={currentColor === color}
            onMouseDown={(e) => {
              e.preventDefault()
            }}
            onClick={(e) => {
              e.stopPropagation()
              onSelect(color)
              onClose()
            }}
            className={`qn-format-colour h-6 w-6 rounded border-2 hover:scale-110 transition-all flex items-center justify-center ${
 currentColor === color 
 ? 'border-emerald-500 ring-2 ring-emerald-200 dark:ring-emerald-800' 
                : 'border-subtle  hover:border-emerald-400'
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
      <div className="mt-3 pt-3 border-t border-subtle ">
        <label className="block text-xs font-medium text-content-muted mb-2">Custom Color</label>
        <div className="flex gap-2">
          <input
            type="color"
            aria-label="Choose custom colour"
            value={customColor}
            onChange={(e) => setCustomColor(e.target.value)}
            className="qn-format-colour h-8 w-8 cursor-pointer rounded border border-subtle"
          />
          <input
            type="text"
            aria-label="Custom colour value"
            value={customColor}
            onChange={(e) => setCustomColor(e.target.value)}
            aria-invalid={!customColorValid}
            aria-describedby={!customColorValid ? 'table-custom-colour-error' : undefined}
            className="min-w-0 flex-1 px-2 py-1 text-xs border border-subtle rounded bg-white dark:bg-surface-sunken text-content"
            placeholder="#ffffff"
          />
          <button
            type="button"
            disabled={!customColorValid}
            onMouseDown={(e) => {
              e.preventDefault()
            }}
            onClick={(e) => {
              e.stopPropagation()
              onSelect(customColor)
              onClose()
            }}
            className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded disabled:cursor-not-allowed disabled:opacity-50"
          >
            Apply
          </button>
        </div>
        {!customColorValid && (
          <p id="table-custom-colour-error" role="alert" className="mt-1.5 text-xs text-danger-text">
            Enter a six-digit hex colour, such as #10b981.
          </p>
        )}
      </div>
    </div>,
    document.body
  )
}
function DropdownMenu({ isOpen, anchorRef, children }) {
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
      role="menu"
      className="fixed bg-surface-raised rounded-xl shadow-2xl border border-subtle py-1 min-w-[160px] z-[99999]"
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
    const handleEscape = (event) => {
      if (event.key !== 'Escape') return
      setShowCellColorPicker(false)
      setShowRowColorPicker(false)
      setShowColumnMenu(false)
      setShowRowMenu(false)
    }
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
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
    <div aria-hidden="true" className="w-px h-5 bg-surface-active dark:bg-surface-active mx-1" />
  )
  const handleToolbarKeyDown = (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    const buttons = Array.from(event.currentTarget.querySelectorAll('button:not(:disabled)'))
    const currentIndex = buttons.indexOf(event.target.closest('button'))
    if (currentIndex < 0 || buttons.length === 0) return
    event.preventDefault()
    let nextIndex
    if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = buttons.length - 1
    else if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % buttons.length
    else nextIndex = (currentIndex - 1 + buttons.length) % buttons.length
    buttons[nextIndex].focus()
  }

  return (
    <BubbleMenu
      editor={editor}
      pluginKey="tableBubbleMenu"
      tippyOptions={{
        duration: 100,
        placement: 'top',
        offset: [0, 8],
        aria: { expanded: false, content: 'describedby' },
      }}
      shouldShow={({ editor }) => {
        return editor.isActive('table')
      }}
      className="flex max-w-[calc(100vw-1rem)] items-center gap-0.5 overflow-x-auto rounded-xl border border-subtle bg-surface-raised p-1.5 shadow-xl"
    >
      <div
        ref={menuRef}
        role="toolbar"
        aria-label="Table tools"
        onKeyDown={handleToolbarKeyDown}
        className="flex items-center gap-0.5"
      >
        <div className="relative" ref={columnButtonRef}>
          <DropdownButton 
            isOpen={showColumnMenu} 
            onClick={() => {
              closeAllDropdowns()
              setShowColumnMenu(!showColumnMenu)
            }}
            title={t('editor.columns', 'Columns')}
          >
            <Columns className="w-4 h-4" />
          </DropdownButton>
          
          <DropdownMenu
            isOpen={showColumnMenu}
            anchorRef={columnButtonRef}
          >
            <button
              type="button"
              role="menuitem"
              onMouseDown={(e) => {
                e.preventDefault()
              }}
              onClick={() => {
                editor.chain().focus().addColumnBefore().run()
                setShowColumnMenu(false)
              }}
              className="w-full px-3 py-2 text-left text-sm hover:bg-surface-hover flex items-center gap-2 text-content-muted"
            >
              <ArrowLeft className="w-4 h-4" />
              {t('editor.addColumnBefore', 'Insert Left')}
            </button>
            <button
              type="button"
              role="menuitem"
              onMouseDown={(e) => {
                e.preventDefault()
              }}
              onClick={() => {
                editor.chain().focus().addColumnAfter().run()
                setShowColumnMenu(false)
              }}
              className="w-full px-3 py-2 text-left text-sm hover:bg-surface-hover flex items-center gap-2 text-content-muted"
            >
              <ArrowRight className="w-4 h-4" />
              {t('editor.addColumnAfter', 'Insert Right')}
            </button>
            <div className="h-px bg-surface-sunken dark:bg-surface-sunken my-1" />
            <button
              type="button"
              role="menuitem"
              onMouseDown={(e) => {
                e.preventDefault()
              }}
              onClick={() => {
                editor.chain().focus().deleteColumn().run()
                setShowColumnMenu(false)
              }}
              className="w-full px-3 py-2 text-left text-sm hover:bg-surface-hover flex items-center gap-2 text-red-600 dark:text-red-400"
            >
              <X className="w-4 h-4" />
              {t('editor.deleteColumn', 'Delete Column')}
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
            title={t('editor.rows', 'Rows')}
          >
            <Rows className="w-4 h-4" />
          </DropdownButton>
          
          <DropdownMenu
            isOpen={showRowMenu}
            anchorRef={rowButtonRef}
          >
            <button
              type="button"
              role="menuitem"
              onMouseDown={(e) => {
                e.preventDefault()
              }}
              onClick={() => {
                editor.chain().focus().addRowBefore().run()
                setShowRowMenu(false)
              }}
              className="w-full px-3 py-2 text-left text-sm hover:bg-surface-hover flex items-center gap-2 text-content-muted"
            >
              <ArrowUp className="w-4 h-4" />
              {t('editor.addRowBefore', 'Insert Above')}
            </button>
            <button
              type="button"
              role="menuitem"
              onMouseDown={(e) => {
                e.preventDefault()
              }}
              onClick={() => {
                editor.chain().focus().addRowAfter().run()
                setShowRowMenu(false)
              }}
              className="w-full px-3 py-2 text-left text-sm hover:bg-surface-hover flex items-center gap-2 text-content-muted"
            >
              <ArrowDown className="w-4 h-4" />
              {t('editor.addRowAfter', 'Insert Below')}
            </button>
            <div className="h-px bg-surface-sunken dark:bg-surface-sunken my-1" />
            <button
              type="button"
              role="menuitem"
              onMouseDown={(e) => {
                e.preventDefault()
              }}
              onClick={() => {
                editor.chain().focus().deleteRow().run()
                setShowRowMenu(false)
              }}
              className="w-full px-3 py-2 text-left text-sm hover:bg-surface-hover flex items-center gap-2 text-red-600 dark:text-red-400"
            >
              <X className="w-4 h-4" />
              {t('editor.deleteRow', 'Delete Row')}
            </button>
          </DropdownMenu>
        </div>

        <MenuDivider />
        <div className="relative" ref={cellColorButtonRef}>
          <DropdownButton 
            isOpen={showCellColorPicker} 
            popupRole="dialog"
            onClick={() => {
              closeAllDropdowns()
              setShowCellColorPicker(!showCellColorPicker)
            }}
            title={t('editor.cellColor', 'Cell Color')}
          >
            <PaintBucket className="w-4 h-4" />
          </DropdownButton>
          
          <ColorPickerDropdown
            isOpen={showCellColorPicker}
            onClose={() => setShowCellColorPicker(false)}
            onSelect={setCellBackgroundColor}
            currentColor={getCurrentCellColor()}
            title={t('editor.cellBackgroundColor', 'Cell Background Color')}
            anchorRef={cellColorButtonRef}
          />
        </div>
        <div className="relative" ref={rowColorButtonRef}>
          <DropdownButton 
            isOpen={showRowColorPicker} 
            popupRole="dialog"
            onClick={() => {
              closeAllDropdowns()
              setShowRowColorPicker(!showRowColorPicker)
            }}
            title={t('editor.rowColor', 'Row Color')}
          >
            <Palette className="w-4 h-4" />
          </DropdownButton>
          
          <ColorPickerDropdown
            isOpen={showRowColorPicker}
            onClose={() => setShowRowColorPicker(false)}
            onSelect={setRowBackgroundColor}
            currentColor={null}
            title={t('editor.rowBackgroundColor', 'Row Background Color')}
            anchorRef={rowColorButtonRef}
          />
        </div>

        <MenuDivider />
        <MenuButton
          onClick={() => editor.chain().focus().mergeCells().run()}
          disabled={!editor.can().mergeCells()}
          title={t('editor.mergeCells', 'Merge Cells')}
        >
          <Merge className="w-4 h-4" />
        </MenuButton>

        <MenuButton
          onClick={() => editor.chain().focus().splitCell().run()}
          disabled={!editor.can().splitCell()}
          title={t('editor.splitCell', 'Split Cell')}
        >
          <Split className="w-4 h-4" />
        </MenuButton>

        <MenuDivider />
        <MenuButton
          onClick={() => editor.chain().focus().toggleHeaderRow().run()}
          title={t('editor.toggleHeaderRow', 'Toggle Header Row')}
        >
          <TableProperties className="w-4 h-4" />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().toggleHeaderColumn().run()}
          title={t('editor.toggleHeaderColumn', 'Toggle Header Column')}
        >
          <Grid className="w-4 h-4" />
        </MenuButton>

        <MenuDivider />
        <MenuButton
          onClick={() => editor.chain().focus().deleteTable().run()}
          title={t('editor.deleteTable', 'Delete Table')}
        >
          <Trash2 className="w-4 h-4 text-red-500" />
        </MenuButton>
      </div>
    </BubbleMenu>
  )
}
