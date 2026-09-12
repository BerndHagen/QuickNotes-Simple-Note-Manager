import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { TextSelection } from '@tiptap/pm/state'
import {
  Accessibility,
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  AlertTriangle,
  BarChart3,
  Bold,
  Calendar,
  Check,
  CheckSquare,
  ChevronDown,
  Code,
  Columns,
  Copy,
  ClipboardPaste,
  Clock,
  FileCode,
  FilePlus2,
  Focus,
  Highlighter,
  History as VersionHistory,
  Image as ImageIcon,
  Indent,
  Info,
  Italic,
  Keyboard,
  Languages,
  Lightbulb,
  Link as LinkIcon,
  List,
  ListOrdered,
  ListPlus,
  ListTree,
  Mic,
  Minus,
  MoveVertical,
  Outdent,
  Paintbrush,
  Palette,
  PanelTop,
  Pilcrow,
  Plus,
  Quote,
  Redo,
  RemoveFormatting,
  Rows,
  Ruler,
  Scissors,
  Search,
  Shapes,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  SpellCheck,
  Square,
  Strikethrough,
  Subscript as SubscriptIcon,
  Superscript as SuperscriptIcon,
  Table as TableIcon,
  Trash2,
  Type as TypeIcon,
  Underline as UnderlineIcon,
  Undo,
  X,
} from 'lucide-react'
import ShapeGeometry, { SHAPE_GROUPS, SHAPE_OPTIONS } from '../ShapeGeometry'
import { formatShortcut } from '../../lib/shortcuts'
import { useUIStore } from '../../store'
import { updateEditorSettings } from '../EditorSettingsModal'
import { DEFAULT_EDITOR_FONT, EDITOR_FONT_GROUPS } from '../../lib/editorFonts'
import { ensureEditorFontLoaded } from '../../lib/editorFontLoader'
import { paperStyles } from '../../lib/paperStyles'
import { getSelectedTaskItems } from '../../lib/checklistSelection'
import { inspectEditorAccessibility } from '../../lib/editorAccessibility'
import { BREAKPOINTS, useMediaQuery } from '../../hooks/useBreakpoint'
import { useTranslation } from '../../lib/useTranslation'
import {
  getFocusable,
  useAnchoredPosition,
  useEscapeKey,
} from '../ui'
import { toggleStructuralCallout } from './editorCommands'

const COMMON_SHAPE_TYPES = ['rectangle', 'ellipse', 'triangle', 'arrow-right', 'callout']
const COMMON_SHAPES = COMMON_SHAPE_TYPES.map((type) => SHAPE_OPTIONS.find((shape) => shape.value === type)).filter(Boolean)
const fontGroups = EDITOR_FONT_GROUPS
const fontSizes = [
  { name: '10', value: '10px' },
  { name: '12', value: '12px' },
  { name: '14', value: '14px' },
  { name: '16', value: '16px' },
  { name: '18', value: '18px' },
  { name: '20', value: '20px' },
  { name: '24', value: '24px' },
  { name: '28', value: '28px' },
  { name: '32', value: '32px' },
  { name: '36', value: '36px' },
  { name: '48', value: '48px' },
  { name: '64', value: '64px' },
  { name: '72', value: '72px' },
]
const lineHeights = [
  { name: '1.0', value: '1' },
  { name: '1.15', value: '1.15' },
  { name: '1.5', value: '1.5' },
  { name: '2.0', value: '2' },
  { name: '2.5', value: '2.5' },
  { name: '3.0', value: '3' },
]
const letterSpacings = [
  { name: 'Tight', value: '-0.05em' },
  { name: 'Normal', value: 'normal' },
  { name: 'Wide', value: '0.05em' },
  { name: 'Extra Wide', value: '0.1em' },
]
const textColors = [
  '#000000', '#374151', '#4b5563', '#6b7280', '#9ca3af', '#d1d5db', '#f3f4f6', '#ffffff',
  '#7f1d1d', '#b91c1c', '#dc2626', '#ef4444', '#f87171', '#fca5a5', '#fecaca', '#fee2e2',
  '#7c2d12', '#c2410c', '#ea580c', '#f97316', '#fb923c', '#fdba74', '#fed7aa', '#ffedd5',
  '#713f12', '#a16207', '#ca8a04', '#eab308', '#facc15', '#fde047', '#fef08a', '#fef9c3',
  '#14532d', '#166534', '#15803d', '#22c55e', '#4ade80', '#86efac', '#bbf7d0', '#dcfce7',
  '#134e4a', '#115e59', '#0d9488', '#14b8a6', '#2dd4bf', '#5eead4', '#99f6e4', '#ccfbf1',
  '#1e3a8a', '#1e40af', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#dbeafe',
  '#4c1d95', '#5b21b6', '#7c3aed', '#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe', '#ede9fe',
  '#831843', '#9d174d', '#db2777', '#ec4899', '#f472b6', '#f9a8d4', '#fbcfe8', '#fce7f3',
]
const highlightColors = [
  '#fef9c3', '#fef08a', '#fde047',
  '#dcfce7', '#bbf7d0', '#86efac',
  '#ccfbf1', '#99f6e4', '#5eead4',
  '#dbeafe', '#bfdbfe', '#93c5fd',
  '#ede9fe', '#ddd6fe', '#c4b5fd',
  '#fce7f3', '#fbcfe8', '#f9a8d4',
  '#ffedd5', '#fed7aa', '#fdba74',
  '#fee2e2', '#fecaca', '#fca5a5',
]
function PortalTooltip({ children, title, shortcut, anchorRef }) {
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
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
      >
        {children}
      </div>
      {visible && createPortal(
        <div
          ref={tooltipRef}
          role="tooltip"
          className="qn-editor-tooltip pointer-events-none fixed z-[99999] whitespace-nowrap rounded-control border border-strong bg-[var(--qn-text)] px-2.5 py-1.5 text-xs text-content-inverted shadow-sm"
          style={{
            top: position.top,
            left: position.left,
            transform: 'translateY(-100%)'
          }}
        >
          <span>{title}</span>
          {shortcut && (
            <span className="ml-2 px-1.5 py-0.5 bg-surface-sunken dark:bg-surface-active rounded text-content-subtle font-mono text-[10px]">
              {shortcut}
            </span>
          )}
          <div className="qn-editor-tooltip-arrow absolute left-1/2 top-full -mt-px -translate-x-1/2 border-4 border-transparent" />
        </div>,
        document.body
      )}
    </>
  )
}

function PortalDropdown({ isOpen, anchorRef, children, onClose, align = 'left', label = 'Formatting options' }) {
  const { floatingRef: dropdownRef, style } = useAnchoredPosition({
    anchorRef,
    open: isOpen,
    placement: align === 'right' ? 'bottom-end' : 'bottom-start',
    offset: 4,
  })

  const closeAndRestoreFocus = useCallback(() => {
    onClose()
    requestAnimationFrame(() => anchorRef.current?.querySelector?.('button')?.focus?.() || anchorRef.current?.focus?.())
  }, [anchorRef, onClose])

  useEscapeKey(isOpen, closeAndRestoreFocus)

  useEffect(() => {
    if (isOpen) {
      const dropdown = dropdownRef.current
      const focusFrame = requestAnimationFrame(() => getFocusable(dropdown)[0]?.focus())
      const handleClickOutside = (e) => {
        if (anchorRef.current && !anchorRef.current.contains(e.target) &&
            dropdownRef.current && !dropdownRef.current.contains(e.target)) {
          onClose()
        }
      }
      const handleKeyDown = (e) => {
        if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return
        const controls = getFocusable(dropdownRef.current)
        if (controls.length === 0) return
        e.preventDefault()
        const current = controls.indexOf(document.activeElement)
        const delta = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1
        const next = e.key === 'Home'
          ? 0
          : e.key === 'End'
            ? controls.length - 1
            : (current + delta + controls.length) % controls.length
        controls[next].focus()
      }

      document.addEventListener('pointerdown', handleClickOutside)
      dropdown?.addEventListener('keydown', handleKeyDown)

      return () => {
        cancelAnimationFrame(focusFrame)
        document.removeEventListener('pointerdown', handleClickOutside)
        dropdown?.removeEventListener('keydown', handleKeyDown)
      }
    }
  }, [isOpen, anchorRef, dropdownRef, onClose])

  if (!isOpen) return null

  return createPortal(
    <div
      ref={dropdownRef}
      role="dialog"
      aria-label={label}
      className="fixed z-[99999] overflow-x-hidden overflow-y-auto overscroll-contain rounded-card border border-strong bg-surface-raised p-1 shadow-md"
      style={style}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {children}
    </div>,
    document.body
  )
}

function ImageToolbarButton() {
  const { setImageUploadOpen } = useUIStore()
  const buttonRef = useRef(null)

  return (
    <PortalTooltip title="Insert Image" anchorRef={buttonRef}>
      <button
        type="button"
        ref={buttonRef}
        aria-label="Insert image"
        onMouseDown={(e) => {
          e.preventDefault()
          e.stopPropagation()
        }}
        onClick={() => setImageUploadOpen(true)}
        className="rounded-lg p-2 text-content-muted transition-colors duration-fast hover:bg-surface-hover hover:text-content dark:text-content-subtle dark:hover:text-white"
      >
        <ImageIcon className="w-4 h-4" />
      </button>
    </PortalTooltip>
  )
}

const ToolbarActionContext = createContext(() => {})

function ToolbarButton({ onClick, isActive, disabled, children, title, shortcut, className = '' }) {
  const buttonRef = useRef(null)
  const beforeActivate = useContext(ToolbarActionContext)
  const activate = () => {
    beforeActivate()
    if (!disabled) onClick?.()
  }

  const button = (
    <button
      type="button"
      ref={buttonRef}
      onMouseDown={(event) => {
        event.preventDefault()
        event.stopPropagation()
      }}
      onClick={activate}
      disabled={disabled}
      aria-pressed={isActive || undefined}
      aria-label={title}
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-control transition-colors duration-fast ${
        isActive
          ? 'bg-accent-soft text-accent-text'
          : 'text-content-muted hover:bg-surface-hover hover:text-content'
      } ${disabled ? 'cursor-not-allowed opacity-40' : ''} ${className}`}
    >
      {children}
    </button>
  )

  if (!title) return button

  return (
    <PortalTooltip title={title} shortcut={shortcut} anchorRef={buttonRef}>
      {button}
    </PortalTooltip>
  )
}

function DropdownButton({ children, isOpen, onClick, title, disabled, className = '' }) {
  const buttonRef = useRef(null)
  const button = (
    <button
      type="button"
      ref={buttonRef}
      disabled={disabled}
      aria-label={title}
      aria-expanded={isOpen}
      aria-haspopup="dialog"
      onMouseDown={(event) => {
        event.preventDefault()
        event.stopPropagation()
      }}
      onClick={() => {
        if (!disabled) onClick?.()
      }}
      className={`flex items-center gap-1 rounded-lg p-1.5 transition-[background-color,color,box-shadow,opacity] duration-fast ${
        disabled
          ? 'opacity-30 cursor-not-allowed text-content-subtle dark:text-content-muted'
          : isOpen
            ? 'bg-accent-soft text-accent-text shadow-sm'
            : 'hover:bg-surface-hover text-content-muted hover:text-content dark:hover:text-content-subtle'
      } ${className}`}
    >
      {children}
      <ChevronDown className="w-3 h-3 opacity-50" />
    </button>
  )

  if (!title || isOpen || disabled) return button

  return (
    <PortalTooltip title={title} anchorRef={buttonRef}>
      {button}
    </PortalTooltip>
  )
}

export default function EditorToolbar({
  editor,
  noteId,
  currentPaper,
  onPaperChange,
  content,
  mobilePanelOpen,
  onMobileOpen,
  onMobileClose,
  activeTab,
  onTabChange,
  onStartDrawing,
  editorSettings,
  onCut,
  onCopy,
  onPaste,
  ribbonLeadingAction,
  ribbonTitle,
  ribbonActions,
  ribbonDetails,
  ribbonOverflowAction,
}) {
  const { t } = useTranslation()
  const spellCheck = useUIStore((state) => state.spellCheck)
  const showNoteStatistics = useUIStore((state) => state.showNoteStatistics)
  const voiceInputActive = useUIStore((state) => state.voiceInputActive)
  const isCompactViewport = useMediaQuery(BREAKPOINTS.compact)
  const shortcut = (key, modifiers = {}) =>
    formatShortcut({ key, ctrl: true, ...modifiers })
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [showHighlightPicker, setShowHighlightPicker] = useState(false)
  const [showFontPicker, setShowFontPicker] = useState(false)
  const [showFontSizePicker, setShowFontSizePicker] = useState(false)
  const [showLineHeightPicker, setShowLineHeightPicker] = useState(false)
  const [showPaperPicker, setShowPaperPicker] = useState(false)
  const [showTableMenu, setShowTableMenu] = useState(false)
  const [showTableOfContents, setShowTableOfContents] = useState(false)
  const [showHeadingsPicker, setShowHeadingsPicker] = useState(false)
  const [showShapePicker, setShowShapePicker] = useState(false)
  const [showChecklistMenu, setShowChecklistMenu] = useState(false)
  const [showAccessibilityCheck, setShowAccessibilityCheck] = useState(false)
  const [accessibilityIssues, setAccessibilityIssues] = useState([])
  const [showDocumentWidth, setShowDocumentWidth] = useState(false)
  const [checklistFeedback, setChecklistFeedback] = useState('')
  const [showCalloutMenu, setShowCalloutMenu] = useState(false)
  const [showParagraphSpacing, setShowParagraphSpacing] = useState(false)
  const [customColor, setCustomColor] = useState('#000000')
  const [customHighlight, setCustomHighlight] = useState('#fef08a')
  const [hoverCell, setHoverCell] = useState({ row: 0, col: 0 })
  const [headings, setHeadings] = useState([])

  const [formatPainterActive, setFormatPainterActive] = useState(false)
  const [copiedFormat, setCopiedFormat] = useState(null)

  const [showLetterSpacing, setShowLetterSpacing] = useState(false)

  const colorPickerRef = useRef(null)
  const highlightPickerRef = useRef(null)
  const fontPickerRef = useRef(null)
  const fontSizePickerRef = useRef(null)
  const lineHeightPickerRef = useRef(null)
  const paperPickerRef = useRef(null)
  const tableMenuRef = useRef(null)
  const tocRef = useRef(null)
  const headingsRef = useRef(null)
  const shapePickerRef = useRef(null)
  const checklistRef = useRef(null)
  const accessibilityRef = useRef(null)
  const documentWidthRef = useRef(null)
  const calloutRef = useRef(null)
  const paragraphSpacingRef = useRef(null)

  const letterSpacingRef = useRef(null)

  const toolbarRef = useRef(null)
  const rovingButtonRef = useRef(null)

  const ribbonGroupClass = (tab) => tab === activeTab ? 'qn-ribbon-group' : 'hidden'

  useEffect(() => {
    const buttons = getFocusable(toolbarRef.current).filter((element) => element.tagName === 'BUTTON')
    if (buttons.length === 0) return
    const current = buttons.includes(rovingButtonRef.current) ? rovingButtonRef.current : buttons[0]
    rovingButtonRef.current = current
    buttons.forEach((button) => {
      button.tabIndex = button === current ? 0 : -1
    })
  })

  const handleToolbarFocus = (event) => {
    if (!(event.target instanceof HTMLButtonElement)) return
    const buttons = getFocusable(toolbarRef.current).filter((element) => element.tagName === 'BUTTON')
    rovingButtonRef.current = event.target
    buttons.forEach((button) => {
      button.tabIndex = button === event.target ? 0 : -1
    })
  }

  const handleToolbarKeyDown = (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    const buttons = getFocusable(toolbarRef.current).filter((element) => element.tagName === 'BUTTON')
    if (buttons.length === 0) return
    event.preventDefault()

    const currentIndex = Math.max(0, buttons.indexOf(document.activeElement))
    const isRtl = document.documentElement.dir === 'rtl'
    const forwardKey = isRtl ? 'ArrowLeft' : 'ArrowRight'
    const nextIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? buttons.length - 1
        : event.key === forwardKey
          ? (currentIndex + 1) % buttons.length
          : (currentIndex - 1 + buttons.length) % buttons.length
    buttons[nextIndex].focus()
    buttons[nextIndex].scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }

  useEffect(() => {
    if (!editor) return

    const updateHeadings = () => {
      const json = editor.getJSON()
      const extractedHeadings = []

      const traverse = (node, path = []) => {
        if (node.type === 'heading' && node.attrs?.level) {
          const text = node.content?.map(c => c.text || '').join('') || ''
          if (text.trim()) {
            extractedHeadings.push({
              level: node.attrs.level,
              text: text.trim(),
              id: node.attrs.anchorId || `heading-${extractedHeadings.length}`,
            })
          }
        }
        if (node.content) {
          node.content.forEach((child, i) => traverse(child, [...path, i]))
        }
      }

      traverse(json)
      setHeadings(extractedHeadings)
    }

    const timeoutId = setTimeout(updateHeadings, 50)
    editor.on('update', updateHeadings)

    return () => {
      clearTimeout(timeoutId)
      editor.off('update', updateHeadings)
    }
  }, [editor, content])

  const scrollToHeading = useCallback((headingIdentity, headingIndex) => {
    if (!editor) return

    const editorElement = editor.view.dom
    const headingElements = editorElement.querySelectorAll('h1, h2, h3, h4, h5, h6')
    const escapedIdentity = typeof CSS !== 'undefined' && CSS.escape
      ? CSS.escape(headingIdentity)
      : headingIdentity.replace(/[^a-zA-Z0-9_-]/g, '\\$&')
    const headingElement = editorElement.querySelector(`[data-anchor-id="${escapedIdentity}"]`) || headingElements[headingIndex]

    if (headingElement) {
      headingElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
      const pos = editor.view.posAtDOM(headingElement, 0)
      editor.chain().focus().setTextSelection(pos).run()
    }

    setShowTableOfContents(false)
  }, [editor])

  const closeAllDropdowns = useCallback(() => {
    setShowColorPicker(false)
    setShowHighlightPicker(false)
    setShowFontPicker(false)
    setShowFontSizePicker(false)
    setShowLineHeightPicker(false)
    setShowPaperPicker(false)
    setShowTableMenu(false)
    setShowTableOfContents(false)
    setShowHeadingsPicker(false)
    setShowShapePicker(false)
    setShowChecklistMenu(false)
    setShowAccessibilityCheck(false)
    setShowDocumentWidth(false)
    setShowCalloutMenu(false)
    setShowParagraphSpacing(false)
  }, [])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target)) {
        closeAllDropdowns()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [closeAllDropdowns])

  const toggleDropdown = (setter, currentValue) => {
    closeAllDropdowns()
    setter(!currentValue)
  }

  const openAccessibilityCheck = () => {
    closeAllDropdowns()
    setAccessibilityIssues(inspectEditorAccessibility(editor.state.doc))
    setShowAccessibilityCheck(true)
  }

  const focusAccessibilityIssue = (issueItem) => {
    setShowAccessibilityCheck(false)
    const maximum = Math.max(1, editor.state.doc.content.size - 1)
    editor.chain().focus(Math.min(issueItem.position + 1, maximum)).run()
  }

  const copyFormat = useCallback(() => {
    if (!editor) return

    const attrs = editor.getAttributes('textStyle')
    const format = {
      bold: editor.isActive('bold'),
      italic: editor.isActive('italic'),
      underline: editor.isActive('underline'),
      strike: editor.isActive('strike'),
      highlight: editor.isActive('highlight'),
      highlightColor: editor.getAttributes('highlight')?.color,
      color: attrs.color,
      fontFamily: attrs.fontFamily,
      fontSize: attrs.fontSize,
      subscript: editor.isActive('subscript'),
      superscript: editor.isActive('superscript'),
    }

    setCopiedFormat(format)
    setFormatPainterActive(true)
  }, [editor])

  const applyFormat = useCallback(() => {
    if (!editor || !copiedFormat) return

    const { selection } = editor.state

    if (selection.empty) return

    let chain = editor.chain().focus()

    if (editor.isActive('bold')) chain = chain.unsetBold()
    if (editor.isActive('italic')) chain = chain.unsetItalic()
    if (editor.isActive('underline')) chain = chain.unsetUnderline()
    if (editor.isActive('strike')) chain = chain.unsetStrike()
    if (editor.isActive('subscript')) chain = chain.unsetSubscript()
    if (editor.isActive('superscript')) chain = chain.unsetSuperscript()
    if (editor.isActive('highlight')) chain = chain.unsetHighlight()

    if (copiedFormat.bold) chain = chain.setBold()
    if (copiedFormat.italic) chain = chain.setItalic()
    if (copiedFormat.underline) chain = chain.setUnderline()
    if (copiedFormat.strike) chain = chain.setStrike()
    if (copiedFormat.subscript) chain = chain.setSubscript()
    if (copiedFormat.superscript) chain = chain.setSuperscript()
    if (copiedFormat.highlight) {
      chain = chain.setHighlight({ color: copiedFormat.highlightColor || '#fef08a' })
    }
    if (copiedFormat.color) chain = chain.setColor(copiedFormat.color)
    if (copiedFormat.fontFamily) chain = chain.setFontFamily(copiedFormat.fontFamily)
    if (copiedFormat.fontSize) chain = chain.setFontSize(copiedFormat.fontSize)

    chain.run()
    setFormatPainterActive(false)
    setCopiedFormat(null)
  }, [editor, copiedFormat])

  useEffect(() => {
    if (!formatPainterActive || !editor) return

    const handleMouseUp = () => {
      setTimeout(() => {
        const { selection } = editor.state
        if (!selection.empty && formatPainterActive) {
          applyFormat()
        }
      }, 50)
    }

    const handleClick = (e) => {
      if (e.detail === 1) {
        setTimeout(() => {
          const { selection } = editor.state
          if (!selection.empty && formatPainterActive) {
            applyFormat()
          }
        }, 100)
      }
    }

    const editorElement = editor.view.dom
    editorElement.addEventListener('mouseup', handleMouseUp)
    editorElement.addEventListener('click', handleClick)

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setFormatPainterActive(false)
        setCopiedFormat(null)
      }
    }
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      editorElement.removeEventListener('mouseup', handleMouseUp)
      editorElement.removeEventListener('click', handleClick)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [formatPainterActive, editor, applyFormat])

  const setLink = useCallback(() => {
    useUIStore.getState().setLinkModalOpen(true)
  }, [])

  const openTranslation = useCallback(() => {
    const { from, to, empty } = editor.state.selection
    const text = empty ? editor.getText() : editor.state.doc.textBetween(from, to, ' ')
    useUIStore.getState().openTranslateModal(text)
  }, [editor])

  const taskItemContexts = useCallback(
    () => getSelectedTaskItems(editor.state),
    [editor]
  )

  const taskItemContext = useCallback(
    () => taskItemContexts()[0] || null,
    [taskItemContexts]
  )

  const updateTaskItem = useCallback((attributes) => {
    const contexts = taskItemContexts()
    if (contexts.length === 0) return 0
    const transaction = contexts.reduce(
      (nextTransaction, context) => nextTransaction.setNodeMarkup(
        context.pos,
        undefined,
        { ...context.node.attrs, ...attributes }
      ),
      editor.state.tr
    )
    editor.view.dispatch(transaction)
    editor.view.focus()
    return contexts.length
  }, [editor, taskItemContexts])

  const updateChecklistAppearance = useCallback((attributes, description) => {
    const count = updateTaskItem(attributes)
    if (count > 0) {
      setChecklistFeedback(`Applied ${description} to ${count === 1 ? 'this item' : `${count} selected items`}.`)
      return
    }

    const settingKeys = {
      checkboxStyle: 'defaultCheckboxStyle',
      checkboxColor: 'defaultCheckboxColor',
      checkboxSize: 'defaultCheckboxSize',
      checkedStyle: 'defaultCheckedStyle',
    }
    const patch = Object.fromEntries(
      Object.entries(attributes)
        .filter(([key]) => settingKeys[key])
        .map(([key, value]) => [settingKeys[key], value])
    )
    updateEditorSettings(patch)
    setChecklistFeedback(`New checklist items will use ${description}.`)
  }, [updateTaskItem])

  const createChecklist = useCallback(() => {
    const chain = editor.chain().focus()
    if (editor.isActive('taskList')) {
      chain.toggleTaskList().run()
      return
    }
    chain
      .toggleTaskList()
      .updateAttributes('taskItem', {
        checkboxStyle: editorSettings.defaultCheckboxStyle,
        checkboxColor: editorSettings.defaultCheckboxColor,
        checkboxSize: editorSettings.defaultCheckboxSize,
        checkedStyle: editorSettings.defaultCheckedStyle,
      })
      .run()
  }, [editor, editorSettings])

  const addTaskItem = useCallback((placement) => {
    const context = taskItemContext()
    if (!context) return
    const target = placement === 'above' ? context.pos + 1 : context.pos + context.node.nodeSize - 1
    const selection = TextSelection.near(editor.state.doc.resolve(target), placement === 'above' ? 1 : -1)
    editor.view.dispatch(editor.state.tr.setSelection(selection))
    editor.chain().focus().splitListItem('taskItem').run()
  }, [editor, taskItemContext])

  const selectedTaskItems = taskItemContexts()
  const checklistControlValue = (attribute, defaultSetting) => {
    if (selectedTaskItems.length === 0) return editorSettings[defaultSetting]
    const values = new Set(selectedTaskItems.map(({ node }) => node.attrs[attribute]))
    return values.size === 1 ? values.values().next().value : 'mixed'
  }
  const checklistScope = selectedTaskItems.length === 0
    ? 'New checklist defaults'
    : selectedTaskItems.length === 1
      ? 'Current item'
      : `${selectedTaskItems.length} selected items`
  const activeCheckboxStyle = checklistControlValue('checkboxStyle', 'defaultCheckboxStyle')
  const activeCheckboxColor = checklistControlValue('checkboxColor', 'defaultCheckboxColor')
  const activeCheckboxSize = checklistControlValue('checkboxSize', 'defaultCheckboxSize')
  const activeCheckedStyle = checklistControlValue('checkedStyle', 'defaultCheckedStyle')
  const activeTextStyle = editor.getAttributes('textStyle')
  const activeFontValue = activeTextStyle.fontFamily || editorSettings.defaultFontFamily || DEFAULT_EDITOR_FONT
  const activeFontName = fontGroups
    .flatMap((group) => group.fonts)
    .find((font) => font.value === activeFontValue)?.name || 'Font'
  const activeFontSize = String(activeTextStyle.fontSize || editorSettings.defaultFontSize || '16px').replace(/px$/, '')
  const activeLineHeight = editor.getAttributes('paragraph').lineHeight || editorSettings.defaultLineHeight || '1.5'

  const insertDateOrTime = useCallback((kind) => {
    const now = new Date()
    const value = kind === 'date'
      ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(now)
      : new Intl.DateTimeFormat(undefined, { timeStyle: 'short' }).format(now)
    editor.chain().focus().insertContent(value).run()
  }, [editor])

  const ToolbarDivider = () => (
    <div role="separator" aria-orientation="vertical" className="mx-1 h-5 w-px shrink-0 bg-[var(--qn-border-subtle)]" />
  )

  return (
    <ToolbarActionContext.Provider value={closeAllDropdowns}>
      <div
        className="editor-ribbon border-b border-subtle"
        data-density={editorSettings.ribbonDensity}
      >
      <div className="qn-ribbon-note-bar grid min-h-11 items-center gap-x-2 px-2 sm:gap-x-3 sm:px-3">
        <div className="qn-ribbon-leading-action min-w-0 justify-self-start">
          {ribbonLeadingAction}
        </div>
        {ribbonTitle && (
          <div className="qn-ribbon-title min-w-0 justify-self-center px-1">
            {ribbonTitle}
          </div>
        )}
        <div className="qn-ribbon-note-actions flex min-w-0 items-center justify-end justify-self-end">
          {ribbonActions && (
            <div className="flex shrink-0 items-center gap-0.5" aria-label="Note actions">
              {ribbonActions}
            </div>
          )}
          <button
            type="button"
            aria-label="Customize editor"
            title="Customize editor"
            onClick={() => useUIStore.getState().setEditorSettingsOpen(true)}
            className="qn-square-control ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-control text-content-muted transition-colors hover:bg-surface-hover hover:text-content"
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          </button>
          {ribbonOverflowAction}
        </div>
      </div>
      {ribbonDetails}
      <div className="qn-ribbon-tabs flex min-h-10 items-center border-b border-subtle px-2 sm:px-3">
        <div role="tablist" aria-label="Editor ribbon" className="flex min-w-0 flex-1 items-stretch overflow-x-auto">
          {[
            ['home', 'Home'],
            ['insert', 'Insert'],
            ['layout', 'Layout'],
            ['review', 'Review'],
            ['view', 'View'],
          ].map(([value, label]) => (
            <button
              key={value}
              id={`qn-ribbon-tab-${value}`}
              type="button"
              role="tab"
              aria-selected={activeTab === value}
              aria-controls="qn-editor-ribbon-panel"
              tabIndex={activeTab === value ? 0 : -1}
              onKeyDown={(event) => {
                if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
                event.preventDefault()
                const tabs = [...event.currentTarget.parentElement.querySelectorAll('[role="tab"]')]
                const current = tabs.indexOf(event.currentTarget)
                const next = event.key === 'Home'
                  ? tabs[0]
                  : event.key === 'End'
                    ? tabs.at(-1)
                    : tabs[(current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length]
                next?.focus()
                next?.click()
              }}
              onClick={() => {
                closeAllDropdowns()
                onTabChange(value)
                onMobileOpen?.()
              }}
              className={`qn-ribbon-tab relative h-10 shrink-0 px-3 text-ui-sm font-semibold transition-colors ${
                activeTab === value
                  ? 'text-accent-text after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-accent'
                  : 'text-content-muted hover:bg-surface-hover hover:text-content'
              }`}
            >
              {label}
            </button>
            ))}
        </div>
        {mobilePanelOpen && (
          <button
            type="button"
            onClick={onMobileClose}
            aria-label="Hide formatting tools"
            className="qn-square-control ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-control text-content-muted transition-colors hover:bg-surface-hover hover:text-content md:hidden"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
      <div
        id="qn-editor-ribbon-panel"
        role="tabpanel"
        aria-labelledby={`qn-ribbon-tab-${activeTab}`}
        className={`${mobilePanelOpen ? 'block' : 'hidden'} md:block`}
      >
        <div
          id="qn-editor-toolbar"
          ref={toolbarRef}
          role="toolbar"
          aria-label={`${activeTab[0].toUpperCase()}${activeTab.slice(1)} ribbon commands`}
          onFocusCapture={handleToolbarFocus}
          onKeyDown={handleToolbarKeyDown}
          className="editor-toolbar flex min-h-[58px] flex-nowrap items-stretch gap-1 overflow-x-auto overflow-y-hidden overscroll-x-contain px-2 sm:px-3"
        >
      <div className={ribbonGroupClass('home')} style={{ order: -5 }}>
      <span className="qn-ribbon-group-label">Editing</span>
      <ToolbarButton onClick={() => useUIStore.getState().setFindReplaceOpen(true)} title="Find and replace" shortcut={shortcut('f')}>
        <Search className="h-4 w-4" />
      </ToolbarButton>
      </div>

      <div className={`${ribbonGroupClass('home')} qn-ribbon-font-group`} style={{ order: -9 }}>
      <span className="qn-ribbon-group-label">Font</span>

      <div className="relative" ref={fontPickerRef}>
        <DropdownButton isOpen={showFontPicker} onClick={() => toggleDropdown(setShowFontPicker, showFontPicker)} title="Font family" className="min-w-[104px] justify-between px-2">
          <span className="max-w-[80px] truncate text-ui-sm font-medium" style={{ fontFamily: activeFontValue }}>{activeFontName}</span>
        </DropdownButton>
        <PortalDropdown
          isOpen={showFontPicker}
          anchorRef={fontPickerRef}
          onClose={() => setShowFontPicker(false)}
          label="Font families"
        >
          <div className="max-h-[min(19rem,60vh)] w-[208px] overflow-y-auto py-1">
            {fontGroups.map((group) => (
              <div key={group.name}>
                <p className="sticky top-0 z-10 bg-surface-raised px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wide text-content-subtle">
                  {group.name}
                </p>
                {group.fonts.map((font) => {
                  const currentFont = editor.getAttributes('textStyle').fontFamily
                  const isActive = currentFont === font.value
                  return (
                    <button
                      key={font.name}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        void ensureEditorFontLoaded(font.value)
                        editor.chain().focus().setFontFamily(font.value).run()
                        setShowFontPicker(false)
                      }}
                      className={`w-full truncate rounded-lg px-3 py-1.5 text-left text-[13px] transition-colors hover:bg-surface-hover ${
                        isActive
                          ? 'bg-accent-soft font-medium text-accent-text'
                          : 'text-content-muted'
                      }`}
                      style={{ fontFamily: font.value }}
                    >
                      {font.name}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </PortalDropdown>
      </div>

      <div className="relative" ref={fontSizePickerRef}>
        <DropdownButton isOpen={showFontSizePicker} onClick={() => toggleDropdown(setShowFontSizePicker, showFontSizePicker)} title="Font size" className="min-w-[44px] justify-between px-2">
          <span className="text-ui-sm font-medium tabular-nums">{activeFontSize}</span>
        </DropdownButton>
        <PortalDropdown isOpen={showFontSizePicker} anchorRef={fontSizePickerRef} onClose={() => setShowFontSizePicker(false)}>
          <div className="max-h-[240px] w-[96px] overflow-y-auto py-1">
            {fontSizes.map((size) => {
              const currentSize = editor.getAttributes('textStyle').fontSize
              const isActive = currentSize === size.value
              return (
                <button
                  key={size.name}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    editor.chain().focus().setFontSize(size.value).run()
                    setShowFontSizePicker(false)
                  }}
                  className={`w-full px-3 py-1.5 text-left text-[13px] hover:bg-surface-hover rounded-lg transition-colors ${
 isActive ? 'bg-accent-soft text-accent-text font-medium' : 'text-content-muted'
 }`}
                >
                  {size.name}px
                </button>
              )
            })}
          </div>
        </PortalDropdown>
      </div>

      <div className="relative" ref={headingsRef}>
        <DropdownButton
          isOpen={showHeadingsPicker}
          onClick={() => toggleDropdown(setShowHeadingsPicker, showHeadingsPicker)}
          title="Block style"
        >
          <span className="min-w-[68px] whitespace-nowrap text-left text-ui-md font-medium">
            {[1, 2, 3, 4, 5, 6].reduce(
              (label, level) => (editor.isActive('heading', { level }) ? `Heading ${level}` : label),
              'Normal text'
            )}
          </span>
        </DropdownButton>
        <PortalDropdown isOpen={showHeadingsPicker} anchorRef={headingsRef} onClose={() => setShowHeadingsPicker(false)}>
          <div className="py-1.5 w-[180px]">
            {[1, 2, 3, 4, 5, 6].map((level) => {
              const isActive = editor.isActive('heading', { level })
              return (
                <button
                  key={level}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    editor.chain().focus().toggleHeading({ level }).run()
                    setShowHeadingsPicker(false)
                  }}
                  className={`w-full px-3 py-2 text-left hover:bg-surface-hover flex items-center gap-3 rounded-lg transition-colors ${
 isActive ? 'bg-accent-soft text-accent-text' : 'text-content-muted'
 }`}
                >
                  <span className={`font-bold ${
 level === 1 ? 'text-xl' :
 level === 2 ? 'text-lg' :
                    level === 3 ? 'text-base' :
                    level === 4 ? 'text-sm' :
                    level === 5 ? 'text-xs' : 'text-xs'
                  }`}>H{level}</span>
                  <span className="text-[11px] text-content-subtle dark:text-content-muted font-medium">{shortcut(String(level), { alt: true })}</span>
                </button>
              )
            })}
            <div className="h-px my-1.5 mx-2 bg-surface-sunken" />
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                editor.chain().focus().setParagraph().run()
                setShowHeadingsPicker(false)
              }}
              className="w-full px-3 py-2 text-left text-[13px] hover:bg-surface-hover rounded-lg transition-colors text-content-muted"
            >
              Normal text
            </button>
          </div>
        </PortalDropdown>
      </div>

      <ToolbarDivider />

      <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive('bold')} title="Bold" shortcut={shortcut('b')}>
        <Bold className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive('italic')} title="Italic" shortcut={shortcut('i')}>
        <Italic className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} isActive={editor.isActive('underline')} title="Underline" shortcut={shortcut('u')}>
        <UnderlineIcon className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} isActive={editor.isActive('strike')} title="Strikethrough" shortcut={shortcut('s', { shift: true })}>
        <Strikethrough className="w-4 h-4" />
      </ToolbarButton>
      <div className="relative" ref={colorPickerRef}>
        <DropdownButton isOpen={showColorPicker} onClick={() => toggleDropdown(setShowColorPicker, showColorPicker)} title="Text Color">
          <Palette className="w-4 h-4" />
        </DropdownButton>
        <PortalDropdown isOpen={showColorPicker} anchorRef={colorPickerRef} onClose={() => setShowColorPicker(false)}>
          <div className="w-[240px] p-2">
            <div className="grid grid-cols-8 gap-1">
              {textColors.map((color) => {
                const isActive = editor.getAttributes('textStyle').color === color
                return (
                  <button
                    key={color}
                    aria-label={`Set text color to ${color}`}
                    aria-pressed={isActive}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      editor.chain().focus().setColor(color).run()
                      setShowColorPicker(false)
                    }}
                    className={`qn-format-colour flex h-6 w-6 items-center justify-center rounded-control border shadow-xs transition-[border-color,box-shadow,transform] duration-fast hover:scale-105 ${
 isActive
 ? 'border-accent ring-2 ring-[var(--qn-accent-soft)]'
                        : 'border-subtle hover:border-accent'
                    }`}
                    style={{ backgroundColor: color }}
                    title={color}
                  >
                    {isActive && (
                      <svg className="w-4 h-4" style={{ color: color === '#000000' || color === '#374151' ? '#fff' : '#000' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    )}
                  </button>
                )
              })}
            </div>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                editor.chain().focus().unsetColor().run()
                setShowColorPicker(false)
              }}
              className="qn-touch-target mt-3 w-full rounded-lg border border-subtle px-3 py-1.5 text-xs text-content-muted transition-colors hover:bg-surface-hover"
            >
              Reset Color
            </button>
            <div className="pt-3 mt-3 border-t border-subtle">
              <label className="block mb-2 text-xs font-medium text-content-muted">Custom Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  aria-label="Choose custom text color"
                  value={customColor}
                  onChange={(e) => setCustomColor(e.target.value)}
                  className="qn-format-colour h-8 w-10 shrink-0 cursor-pointer rounded border border-subtle"
                />
                <input
                  type="text"
                  aria-label="Custom text color value"
                  value={customColor}
                  onChange={(e) => setCustomColor(e.target.value)}
                  className="min-w-0 flex-1 rounded border border-subtle bg-white px-2 py-1 text-xs text-content dark:bg-surface-sunken dark:text-white"
                  placeholder="#000000"
                />
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    editor.chain().focus().setColor(customColor).run()
                    setShowColorPicker(false)
                  }}
                  className="qn-touch-target shrink-0 rounded bg-accent px-3 py-1 text-xs text-accent-on hover:bg-accent-hover"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </PortalDropdown>
      </div>

      <div className="relative" ref={highlightPickerRef}>
        <DropdownButton isOpen={showHighlightPicker} onClick={() => toggleDropdown(setShowHighlightPicker, showHighlightPicker)} title="Highlight">
          <Highlighter className="w-4 h-4" />
        </DropdownButton>
        <PortalDropdown isOpen={showHighlightPicker} anchorRef={highlightPickerRef} onClose={() => setShowHighlightPicker(false)}>
          <div className="w-[240px] p-2">
            <div className="grid grid-cols-8 gap-1">
              {highlightColors.map((color) => {
                const isActive = editor.isActive('highlight', { color })
                return (
                  <button
                    key={color}
                    aria-label={`Toggle highlight color ${color}`}
                    aria-pressed={isActive}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      editor.chain().focus().toggleHighlight({ color }).run()
                      setShowHighlightPicker(false)
                    }}
                    className={`qn-format-colour flex h-6 w-6 items-center justify-center rounded-control border shadow-xs transition-[border-color,box-shadow,transform] duration-fast hover:scale-105 ${
 isActive
 ? 'border-accent ring-2 ring-[var(--qn-accent-soft)]'
                        : 'border-subtle hover:border-accent'
                    }`}
                    style={{ backgroundColor: color }}
                    title={color}
                  >
                    {isActive && (
                      <svg className="w-4 h-4 text-content" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    )}
                  </button>
                )
              })}
            </div>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                editor.chain().focus().unsetHighlight().run()
                setShowHighlightPicker(false)
              }}
              className="qn-touch-target mt-3 w-full rounded-lg border border-subtle px-3 py-1.5 text-xs text-content-muted transition-colors hover:bg-surface-hover"
            >
              Remove Highlight
            </button>
            <div className="pt-3 mt-3 border-t border-subtle">
              <label className="block mb-2 text-xs font-medium text-content-muted">Custom Highlight</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  aria-label="Choose custom highlight color"
                  value={customHighlight}
                  onChange={(e) => setCustomHighlight(e.target.value)}
                  className="qn-format-colour h-8 w-10 shrink-0 cursor-pointer rounded border border-subtle"
                />
                <input
                  type="text"
                  aria-label="Custom highlight color value"
                  value={customHighlight}
                  onChange={(e) => setCustomHighlight(e.target.value)}
                  className="min-w-0 flex-1 rounded border border-subtle bg-white px-2 py-1 text-xs text-content dark:bg-surface-sunken dark:text-white"
                  placeholder="#fef08a"
                />
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    editor.chain().focus().toggleHighlight({ color: customHighlight }).run()
                    setShowHighlightPicker(false)
                  }}
                  className="qn-touch-target shrink-0 rounded bg-accent px-3 py-1 text-xs text-accent-on hover:bg-accent-hover"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </PortalDropdown>
      </div>

      <ToolbarButton onClick={() => editor.chain().focus().toggleSubscript().run()} isActive={editor.isActive('subscript')} title="Subscript">
        <SubscriptIcon className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleSuperscript().run()} isActive={editor.isActive('superscript')} title="Superscript">
        <SuperscriptIcon className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleCode().run()} isActive={editor.isActive('code')} title="Inline Code">
        <Code className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()} title="Clear formatting">
        <RemoveFormatting className="h-4 w-4" />
      </ToolbarButton>
      </div>

      <div className={ribbonGroupClass('home')} style={{ order: -8 }}>
      <span className="qn-ribbon-group-label">Paragraph</span>

      <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('left').run()} isActive={editor.isActive({ textAlign: 'left' })} title="Align Left">
        <AlignLeft className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('center').run()} isActive={editor.isActive({ textAlign: 'center' })} title="Align Center">
        <AlignCenter className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('right').run()} isActive={editor.isActive({ textAlign: 'right' })} title="Align Right">
        <AlignRight className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('justify').run()} isActive={editor.isActive({ textAlign: 'justify' })} title="Justify">
        <AlignJustify className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive('bulletList')} title="Bullet List">
        <List className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive('orderedList')} title="Numbered List">
        <ListOrdered className="w-4 h-4" />
      </ToolbarButton>
      <div className="qn-checklist-split relative flex items-center" ref={checklistRef}>
        <ToolbarButton
          onClick={() => {
            createChecklist()
            setShowChecklistMenu(true)
          }}
          isActive={editor.isActive('taskList')}
          title={editor.isActive('taskList') ? 'Turn off checklist and show options' : 'Create checklist with current style'}
          className="qn-checklist-primary"
        >
          <CheckSquare className="w-4 h-4" />
        </ToolbarButton>
        <DropdownButton
          isOpen={showChecklistMenu}
          onClick={() => toggleDropdown(setShowChecklistMenu, showChecklistMenu)}
          title="Checklist options"
          className="qn-checklist-menu-trigger"
        >
          <span className="qn-sr-only">Checklist options</span>
        </DropdownButton>
        <PortalDropdown isOpen={showChecklistMenu} anchorRef={checklistRef} onClose={() => setShowChecklistMenu(false)} label="Checklist options">
          <div className="w-[min(22rem,calc(100vw-1rem))] p-2">
            <div className="mb-1 rounded-control border border-[var(--qn-accent-border)] bg-accent-soft px-3 py-2">
              <p className="text-ui-xs font-semibold uppercase tracking-wide text-accent-text">{checklistScope}</p>
              <p className="mt-0.5 text-ui-xs leading-relaxed text-content-muted">
                {selectedTaskItems.length === 0
                  ? 'Choose the appearance first, then create a checklist with those defaults.'
                  : selectedTaskItems.length === 1
                    ? 'Appearance changes apply immediately to the item at the cursor.'
                    : 'Appearance changes apply immediately to every selected checklist item.'}
              </p>
            </div>
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                createChecklist()
                setShowChecklistMenu(false)
              }}
              className="flex w-full items-center gap-3 rounded-control px-3 py-2 text-left text-ui-md font-medium text-content hover:bg-surface-hover"
            >
              <CheckSquare className="h-4 w-4" /> {editor.isActive('taskList') ? 'Turn off checklist' : 'Create checklist'}
            </button>
            {selectedTaskItems.length > 0 && (
              <>
                <div className="my-1 h-px bg-[var(--qn-border-subtle)]" />
                <p className="px-3 py-1 text-ui-xs font-semibold uppercase tracking-wide text-content-subtle">Item actions</p>
                <div className="grid grid-cols-2 gap-1">
                  <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => {
                    const checked = !selectedTaskItems.every(({ node }) => node.attrs.checked)
                    const count = updateTaskItem({ checked })
                    setChecklistFeedback(`${checked ? 'Completed' : 'Reopened'} ${count === 1 ? 'this item' : `${count} selected items`}.`)
                  }} className="flex items-center gap-2 rounded-control px-3 py-2 text-left text-ui-sm text-content-muted hover:bg-surface-hover hover:text-content">
                    <Check className="h-4 w-4" /> Toggle complete
                  </button>
                  {selectedTaskItems.length === 1 && (
                    <>
                      <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => addTaskItem('above')} className="flex items-center gap-2 rounded-control px-3 py-2 text-left text-ui-sm text-content-muted hover:bg-surface-hover hover:text-content">
                        <ListPlus className="h-4 w-4" /> Add above
                      </button>
                      <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => addTaskItem('below')} className="flex items-center gap-2 rounded-control px-3 py-2 text-left text-ui-sm text-content-muted hover:bg-surface-hover hover:text-content">
                        <Plus className="h-4 w-4" /> Add below
                      </button>
                      <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => editor.chain().focus().liftListItem('taskItem').run()} className="flex items-center gap-2 rounded-control px-3 py-2 text-left text-ui-sm text-content-muted hover:bg-surface-hover hover:text-content">
                        <AlignLeft className="h-4 w-4" /> Remove this checkbox
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
            <div className="my-1 h-px bg-[var(--qn-border-subtle)]" />
            <div className="grid gap-3 p-2 sm:grid-cols-2">
              <fieldset className="sm:col-span-2">
                <legend className="mb-1 text-ui-xs font-semibold uppercase tracking-wide text-content-subtle">Shape</legend>
                <div className="flex gap-1">
                  {[['square', 'Square'], ['rounded', 'Rounded'], ['circle', 'Circle']].map(([value, label]) => (
                    <button key={value} type="button" aria-label={`${label} checkbox`} aria-pressed={activeCheckboxStyle === value} title={label} onMouseDown={(event) => event.preventDefault()} onClick={() => updateChecklistAppearance({ checkboxStyle: value }, `${label.toLowerCase()} boxes`)} className="qn-check-option relative flex h-9 flex-1 items-center justify-center rounded-control border border-subtle hover:bg-surface-hover">
                      <span className={`qn-check-style-preview qn-check-style-preview--${value}`} />
                      {activeCheckboxStyle === value && <Check className="absolute right-1 top-1 h-3 w-3 text-accent-text" aria-hidden="true" />}
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset className="sm:col-span-2">
                <legend className="mb-1 text-ui-xs font-semibold uppercase tracking-wide text-content-subtle">Tick colour</legend>
                <div className="flex gap-1">
                  {['accent', 'blue', 'purple', 'amber', 'rose', 'slate'].map((value) => (
                    <button key={value} type="button" aria-label={`${value} tick colour`} aria-pressed={activeCheckboxColor === value} title={value} onMouseDown={(event) => event.preventDefault()} onClick={() => updateChecklistAppearance({ checkboxColor: value }, `${value === 'accent' ? 'QuickNotes teal' : value} tick colour`)} className={`qn-check-colour qn-check-colour--${value}`}>
                      {activeCheckboxColor === value && <Check className="h-3.5 w-3.5 text-white drop-shadow-sm" aria-hidden="true" />}
                    </button>
                  ))}
                </div>
              </fieldset>
              <div>
                <label htmlFor="checklist-size" className="mb-1 block text-ui-xs font-semibold uppercase tracking-wide text-content-subtle">Size</label>
                <select id="checklist-size" value={activeCheckboxSize === 'mixed' ? '' : activeCheckboxSize} onChange={(event) => updateChecklistAppearance({ checkboxSize: event.target.value }, `${event.target.value} boxes`)} className="w-full rounded-control border border-subtle bg-surface-raised px-2 py-1.5 text-ui-sm text-content">
                  {activeCheckboxSize === 'mixed' && <option value="" disabled>Mixed</option>}
                  <option value="compact">Compact</option>
                  <option value="standard">Standard</option>
                  <option value="large">Large</option>
                </select>
              </div>
              <div>
                <label htmlFor="checklist-completed-style" className="mb-1 block text-ui-xs font-semibold uppercase tracking-wide text-content-subtle">Completed text</label>
                <select id="checklist-completed-style" value={activeCheckedStyle === 'mixed' ? '' : activeCheckedStyle} onChange={(event) => updateChecklistAppearance({ checkedStyle: event.target.value }, `${event.target.options[event.target.selectedIndex].text.toLowerCase()} completed text`)} className="w-full rounded-control border border-subtle bg-surface-raised px-2 py-1.5 text-ui-sm text-content">
                  {activeCheckedStyle === 'mixed' && <option value="" disabled>Mixed</option>}
                  <option value="strike">Strike through</option>
                  <option value="fade">Fade</option>
                  <option value="keep">Keep unchanged</option>
                </select>
              </div>
            </div>
            <p className="min-h-5 px-3 pb-1 text-ui-xs leading-relaxed text-content-subtle" role="status" aria-live="polite">
              {checklistFeedback || (activeCheckboxStyle === 'mixed' || activeCheckboxColor === 'mixed'
                ? 'The selected items currently use mixed styles.'
                : selectedTaskItems.length === 0
                  ? 'Your selection will be used for every newly created checklist item.'
                  : 'Changes are saved with the note and can be adjusted later.')}
            </p>
          </div>
        </PortalDropdown>
      </div>
      </div>

      <div className={ribbonGroupClass('home')} style={{ order: -10 }}>
      <span className="qn-ribbon-group-label">Clipboard</span>
      <ToolbarButton onClick={onCut} disabled={editor.state.selection.empty} title="Cut" shortcut={shortcut('x')}>
        <Scissors className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton onClick={onCopy} disabled={editor.state.selection.empty} title="Copy" shortcut={shortcut('c')}>
        <Copy className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton onClick={onPaste} title="Paste" shortcut={shortcut('v')}>
        <ClipboardPaste className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={formatPainterActive ? () => { setFormatPainterActive(false); setCopiedFormat(null) } : copyFormat}
        isActive={formatPainterActive}
        title={formatPainterActive ? 'Cancel format painter' : 'Format painter'}
      >
        <Paintbrush className={`h-4 w-4 ${formatPainterActive ? 'animate-pulse' : ''}`} />
      </ToolbarButton>
      </div>

      <div className={ribbonGroupClass('home')} style={{ order: -4 }}>
      <span className="qn-ribbon-group-label">History</span>
      <ToolbarButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo" shortcut={shortcut('z')}>
        <Undo className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo" shortcut={shortcut('y')}>
        <Redo className="w-4 h-4" />
      </ToolbarButton>
      </div>

      <div className={ribbonGroupClass('layout')} style={{ order: -9 }}>
      <span className="qn-ribbon-group-label">Indent</span>
      <ToolbarButton
        onClick={() => {
          const listType = ['taskItem', 'listItem'].find((type) => editor.can().sinkListItem(type))
          if (listType) {
            editor.chain().focus().sinkListItem(listType).run()
          } else {
            editor.chain().focus().increaseParagraphIndent().run()
          }
        }}
        disabled={!editor.can().sinkListItem('listItem') && !editor.can().sinkListItem('taskItem') && !editor.can().increaseParagraphIndent()}
        title="Increase Indent"
      >
        <Indent className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => {
          const listType = ['taskItem', 'listItem'].find((type) => editor.can().liftListItem(type))
          if (listType) {
            editor.chain().focus().liftListItem(listType).run()
          } else {
            editor.chain().focus().decreaseParagraphIndent().run()
          }
        }}
        disabled={!editor.can().liftListItem('listItem') && !editor.can().liftListItem('taskItem') && !editor.can().decreaseParagraphIndent()}
        title="Decrease Indent"
      >
        <Outdent className="w-4 h-4" />
      </ToolbarButton>
      </div>

      <div className={ribbonGroupClass('layout')} style={{ order: -8 }}>
      <span className="qn-ribbon-group-label">Spacing</span>

      <div className="relative" ref={lineHeightPickerRef}>
        <DropdownButton isOpen={showLineHeightPicker} onClick={() => toggleDropdown(setShowLineHeightPicker, showLineHeightPicker)} title="Line height" className="min-w-[58px] justify-between px-2">
          <MoveVertical className="h-4 w-4" />
          <span className="text-ui-xs font-medium tabular-nums">{activeLineHeight}</span>
        </DropdownButton>
        <PortalDropdown isOpen={showLineHeightPicker} anchorRef={lineHeightPickerRef} onClose={() => setShowLineHeightPicker(false)}>
          <div className="w-[100px] py-1.5">
            {lineHeights.map((lineHeight) => {
              const isActive = editor.isActive('paragraph', { lineHeight: lineHeight.value })
              return (
                <button
                  key={lineHeight.name}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    editor.chain().focus().setLineHeight(lineHeight.value).run()
                    setShowLineHeightPicker(false)
                  }}
                  className={`w-full rounded-lg px-3 py-1.5 text-left text-[13px] transition-colors hover:bg-surface-hover ${
                    isActive ? 'bg-accent-soft font-medium text-accent-text' : 'text-content-muted'
                  }`}
                >
                  {lineHeight.name}
                </button>
              )
            })}
          </div>
        </PortalDropdown>
      </div>

      <div className="relative" ref={letterSpacingRef}>
        <DropdownButton isOpen={showLetterSpacing} onClick={() => toggleDropdown(setShowLetterSpacing, showLetterSpacing)} title="Letter Spacing">
          <TypeIcon className="w-4 h-4" />
        </DropdownButton>
        <PortalDropdown isOpen={showLetterSpacing} anchorRef={letterSpacingRef} onClose={() => setShowLetterSpacing(false)}>
          <div className="py-1.5 w-[140px]">
            {letterSpacings.map((spacing) => {
              const isActive = editor.isActive('textStyle', { letterSpacing: spacing.value })
              return (
                <button
                  key={spacing.value}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    editor.chain().focus().setLetterSpacing(spacing.value).run()
                    setShowLetterSpacing(false)
                  }}
                  className={`w-full px-3 py-1.5 text-left text-[13px] hover:bg-surface-hover rounded-lg transition-colors ${
 isActive ? 'bg-accent-soft text-accent-text font-medium' : 'text-content-muted'
 }`}
                >
                  {spacing.name}
                </button>
              )
            })}
          </div>
        </PortalDropdown>
      </div>

      <ToolbarButton
        onClick={() => editor.chain().focus().setDropCap().run()}
        isActive={editor.isActive('paragraph', { dropCap: true })}
        title="Drop Cap - Make first letter large"
      >
        <Sparkles className="w-4 h-4" />
      </ToolbarButton>

      <div className="relative" ref={paragraphSpacingRef}>
        <DropdownButton isOpen={showParagraphSpacing} onClick={() => toggleDropdown(setShowParagraphSpacing, showParagraphSpacing)} title="Paragraph spacing">
          <MoveVertical className="h-4 w-4" />
        </DropdownButton>
        <PortalDropdown isOpen={showParagraphSpacing} anchorRef={paragraphSpacingRef} onClose={() => setShowParagraphSpacing(false)} label="Paragraph spacing">
          <div className="w-64 p-3">
            <p className="mb-2 text-ui-xs font-semibold uppercase tracking-wide text-content-subtle">Paragraph spacing</p>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-ui-xs font-medium text-content-muted">
                Before
                <input type="number" min="0" max="160" step="4" value={editor.getAttributes(editor.isActive('heading') ? 'heading' : 'paragraph').spaceBefore || 0} onChange={(event) => editor.chain().focus().setParagraphLayout({ spaceBefore: Number(event.target.value) }).run()} className="mt-1 w-full rounded-control border border-subtle bg-surface-raised px-2 py-1.5 text-ui-sm text-content" />
              </label>
              <label className="text-ui-xs font-medium text-content-muted">
                After
                <input type="number" min="0" max="160" step="4" value={editor.getAttributes(editor.isActive('heading') ? 'heading' : 'paragraph').spaceAfter || 0} onChange={(event) => editor.chain().focus().setParagraphLayout({ spaceAfter: Number(event.target.value) }).run()} className="mt-1 w-full rounded-control border border-subtle bg-surface-raised px-2 py-1.5 text-ui-sm text-content" />
              </label>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-1">
              {[
                ['Compact', 0, 4],
                ['Normal', 0, 12],
                ['Relaxed', 8, 16],
                ['Section', 20, 8],
              ].map(([label, before, after]) => (
                <button key={label} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => editor.chain().focus().setParagraphLayout({ spaceBefore: before, spaceAfter: after }).run()} className="rounded-control px-2 py-1.5 text-left text-ui-sm text-content-muted hover:bg-surface-hover hover:text-content">{label}</button>
              ))}
            </div>
          </div>
        </PortalDropdown>
      </div>
      </div>

      <div className={ribbonGroupClass('insert')}>
      <span className="qn-ribbon-group-label">Content blocks</span>

      <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} isActive={editor.isActive('blockquote')} title="Quote">
        <Quote className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleCodeBlock().run()} isActive={editor.isActive('codeBlock')} title="Code Block">
        <FileCode className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal Line">
        <Minus className="w-4 h-4" />
      </ToolbarButton>
      <div className="relative" ref={calloutRef}>
        <DropdownButton isOpen={showCalloutMenu} onClick={() => toggleDropdown(setShowCalloutMenu, showCalloutMenu)} title="Callout">
          <Info className="h-4 w-4" />
        </DropdownButton>
        <PortalDropdown isOpen={showCalloutMenu} anchorRef={calloutRef} onClose={() => setShowCalloutMenu(false)} label="Callout styles">
          <div className="w-60 p-2">
            <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { toggleStructuralCallout(editor, 'info'); setShowCalloutMenu(false) }} className="flex w-full items-center gap-3 rounded-control px-3 py-2 text-left text-ui-md font-medium text-content hover:bg-surface-hover">
              <Info className="h-4 w-4" /> {editor.isActive('callout') ? 'Turn into paragraph' : 'Create callout'}
            </button>
            {editor.isActive('callout') && <div className="my-1 h-px bg-[var(--qn-border-subtle)]" />}
            {editor.isActive('callout') && [
              ['info', 'Information', Info],
              ['tip', 'Tip', Lightbulb],
              ['warning', 'Warning', AlertTriangle],
              ['important', 'Important', ShieldAlert],
            ].map(([tone, label, Icon]) => (
              <button key={tone} type="button" aria-pressed={editor.isActive('callout', { tone })} onMouseDown={(event) => event.preventDefault()} onClick={() => editor.chain().focus().setCalloutTone(tone).run()} className="flex w-full items-center gap-3 rounded-control px-3 py-2 text-left text-ui-sm text-content-muted hover:bg-surface-hover hover:text-content">
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
          </div>
        </PortalDropdown>
      </div>
      </div>

      <div className={ribbonGroupClass('insert')}>
      <span className="qn-ribbon-group-label">Tables</span>
      <div className="relative" ref={tableMenuRef}>
        <DropdownButton isOpen={showTableMenu} onClick={() => toggleDropdown(setShowTableMenu, showTableMenu)} title="Table">
          <TableIcon className="w-4 h-4" />
        </DropdownButton>
        <PortalDropdown isOpen={showTableMenu} anchorRef={tableMenuRef} onClose={() => setShowTableMenu(false)}>
          <div className="py-2 min-w-[220px]">
            {!editor.isActive('table') && (
              <div className="px-3 pb-2">
                <p className="mb-2 text-xs font-medium text-content-muted">{t('editor.insertTable')}</p>
                <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(8, 1fr)' }}>
                  {Array.from({ length: 8 * 6 }).map((_, i) => {
                    const row = Math.floor(i / 8) + 1
                    const col = (i % 8) + 1
                    const isHovered = row <= hoverCell.row && col <= hoverCell.col
                    return (
                      <button
                        key={i}
                        onMouseEnter={() => setHoverCell({ row, col })}
                        onFocus={() => setHoverCell({ row, col })}
                        aria-label={`Insert a ${row} by ${col} table`}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          editor.chain().focus().insertTable({ rows: row, cols: col, withHeaderRow: true }).run()
                          setShowTableMenu(false)
                          setHoverCell({ row: 0, col: 0 })
                        }}
                        className={`h-6 w-6 rounded-sm border transition-colors ${
                          isHovered
                            ? 'bg-accent-soft border-accent'
                            : 'border-subtle hover:border-strong'
                        }`}
                      />
                    )
                  })}
                </div>
                <p className="mt-2 text-xs text-center text-content-muted">
                  {hoverCell.row > 0 ? `${hoverCell.col} × ${hoverCell.row}` : t('editor.tableSize')}
                </p>
              </div>
            )}

            {editor.isActive('table') && (
              <>
                <p className="px-3 mb-1 text-xs font-medium text-content-muted">{t('editor.table')}</p>
                <button onMouseDown={(e) => e.preventDefault()} onClick={() => { editor.chain().focus().addColumnBefore().run(); setShowTableMenu(false) }} className="flex items-center w-full gap-2 px-3 py-2 text-[13px] text-left hover:bg-surface-hover rounded-lg transition-colors text-content-muted">
                  <Columns className="w-4 h-4 text-content-subtle" /> {t('editor.addColumnBefore')}
                </button>
                <button onMouseDown={(e) => e.preventDefault()} onClick={() => { editor.chain().focus().addColumnAfter().run(); setShowTableMenu(false) }} className="flex items-center w-full gap-2 px-3 py-2 text-[13px] text-left hover:bg-surface-hover rounded-lg transition-colors text-content-muted">
                  <Columns className="w-4 h-4 text-content-subtle" /> {t('editor.addColumnAfter')}
                </button>
                <button onMouseDown={(e) => e.preventDefault()} onClick={() => { editor.chain().focus().addRowBefore().run(); setShowTableMenu(false) }} className="flex items-center w-full gap-2 px-3 py-2 text-[13px] text-left hover:bg-surface-hover rounded-lg transition-colors text-content-muted">
                  <Rows className="w-4 h-4 text-content-subtle" /> {t('editor.addRowBefore')}
                </button>
                <button onMouseDown={(e) => e.preventDefault()} onClick={() => { editor.chain().focus().addRowAfter().run(); setShowTableMenu(false) }} className="flex items-center w-full gap-2 px-3 py-2 text-[13px] text-left hover:bg-surface-hover rounded-lg transition-colors text-content-muted">
                  <Rows className="w-4 h-4 text-content-subtle" /> {t('editor.addRowAfter')}
                </button>
                <div className="h-px my-1.5 mx-2 bg-surface-sunken" />
                <button onMouseDown={(e) => e.preventDefault()} onClick={() => { editor.chain().focus().deleteColumn().run(); setShowTableMenu(false) }} className="flex items-center w-full gap-2 px-3 py-2 text-[13px] text-left text-danger-text hover:bg-danger-soft rounded-lg transition-colors">
                  <X className="w-4 h-4" /> {t('editor.deleteColumn')}
                </button>
                <button onMouseDown={(e) => e.preventDefault()} onClick={() => { editor.chain().focus().deleteRow().run(); setShowTableMenu(false) }} className="flex items-center w-full gap-2 px-3 py-2 text-[13px] text-left text-danger-text hover:bg-danger-soft rounded-lg transition-colors">
                  <X className="w-4 h-4" /> {t('editor.deleteRow')}
                </button>
                <button onMouseDown={(e) => e.preventDefault()} onClick={() => { editor.chain().focus().deleteTable().run(); setShowTableMenu(false) }} className="flex items-center w-full gap-2 px-3 py-2 text-[13px] text-left text-danger-text hover:bg-danger-soft rounded-lg transition-colors">
                  <Trash2 className="w-4 h-4" /> {t('editor.deleteTable')}
                </button>
              </>
            )}
          </div>
        </PortalDropdown>
      </div>
      </div>

      <div className={ribbonGroupClass('insert')}>
      <span className="qn-ribbon-group-label">Links</span>
      <ToolbarButton onClick={setLink} isActive={editor.isActive('link')} title={`Insert Link (${shortcut('k', { shift: true })})`}>
        <LinkIcon className="w-4 h-4" />
      </ToolbarButton>
      </div>

      <div className={ribbonGroupClass('insert')}>
      <span className="qn-ribbon-group-label">Illustrations</span>
      <ImageToolbarButton />

      <ToolbarButton
        onClick={() => onStartDrawing({ kind: 'textBox' })}
        isActive={editor.isActive('textBox')}
        title="Draw text box"
      >
        <Square className="w-4 h-4" />
      </ToolbarButton>

      <div className="relative" ref={shapePickerRef}>
        <DropdownButton
          isOpen={showShapePicker}
          onClick={() => toggleDropdown(setShowShapePicker, showShapePicker)}
          title="More shapes"
        >
          <Shapes className="h-4 w-4" />
        </DropdownButton>
        <PortalDropdown
          isOpen={showShapePicker}
          anchorRef={shapePickerRef}
          onClose={() => setShowShapePicker(false)}
          align="right"
          label="Insert a shape"
        >
          <div className="max-h-[min(34rem,calc(100vh-2rem))] w-[min(20rem,calc(100vw-1rem))] overflow-y-auto pb-2">
            <div className="qn-shape-gallery-heading">Recently used shapes</div>
            <div className="grid grid-cols-10 gap-1 px-2 py-1.5">
              {COMMON_SHAPES.map((shape) => (
                <button
                  key={`recent-${shape.value}`}
                  type="button"
                  aria-label={`Insert ${shape.label.toLowerCase()}`}
                  title={shape.label}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setShowShapePicker(false)
                    onStartDrawing({ kind: 'shape', shapeType: shape.value })
                  }}
                  className="qn-shape-gallery-item"
                >
                  <ShapeGeometry shapeType={shape.value} className="h-4 w-4" />
                </button>
              ))}
            </div>
            {SHAPE_GROUPS.map((group) => (
              <div key={group.label}>
                <div className="qn-shape-gallery-heading">{group.label}</div>
                <div className="grid grid-cols-10 gap-1 px-2 py-1.5">
                  {group.options.map((shape) => (
                    <button
                      key={shape.value}
                      type="button"
                      aria-label={`Insert ${shape.label.toLowerCase()}`}
                      title={shape.label}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        setShowShapePicker(false)
                        onStartDrawing({ kind: 'shape', shapeType: shape.value })
                      }}
                      className="qn-shape-gallery-item"
                    >
                      <ShapeGeometry shapeType={shape.value} className="h-4 w-4" />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </PortalDropdown>
      </div>
      </div>

      <div className={ribbonGroupClass('review')}>
      <span className="qn-ribbon-group-label">Language</span>
      <ToolbarButton onClick={openTranslation} title="Translate selected text or note">
        <Languages className="w-4 h-4" />
      </ToolbarButton>
      </div>

      <div className={ribbonGroupClass('insert')}>
      <span className="qn-ribbon-group-label">Date & time</span>
      <ToolbarButton onClick={() => insertDateOrTime('date')} title="Insert current date">
        <Calendar className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => insertDateOrTime('time')} title="Insert current time">
        <Clock className="h-4 w-4" />
      </ToolbarButton>
      </div>

      <div className={ribbonGroupClass('view')}>
      <span className="qn-ribbon-group-label">Navigation</span>
      <div className="relative" ref={tocRef}>
        <DropdownButton
          isOpen={showTableOfContents}
          onClick={() => toggleDropdown(setShowTableOfContents, showTableOfContents)}
          title="Document outline"
          disabled={headings.length === 0}
        >
          <ListTree className="w-4 h-4" />
        </DropdownButton>
        <PortalDropdown isOpen={showTableOfContents} anchorRef={tocRef} onClose={() => setShowTableOfContents(false)}>
          <div className="max-h-[280px] w-[260px] overflow-y-auto py-1">
            <p className="px-3 py-2 text-[10px] font-bold tracking-[0.12em] uppercase text-content-subtle border-b border-subtle">
              Document outline
            </p>
            {headings.length === 0 ? (
              <p className="px-3 py-3 text-[13px] text-content-subtle italic">
                No headings found
              </p>
            ) : (
              headings.map((heading, index) => (
                <button
                  key={heading.id}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    scrollToHeading(heading.id, index)
                  }}
                  className="w-full px-3 py-2 text-left text-[13px] hover:bg-surface-hover flex items-center gap-2 rounded-lg transition-colors text-content-muted"
                  style={{ paddingLeft: `${(heading.level - 1) * 12 + 12}px` }}
                >
                  <span className={`flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold ${
 heading.level === 1
 ? 'bg-accent-soft text-accent-text'
                      : heading.level === 2
                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                        : 'bg-surface-sunken text-content-muted'
                  }`}>
                    H{heading.level}
                  </span>
                  <span className="truncate">{heading.text}</span>
                </button>
              ))
            )}
          </div>
        </PortalDropdown>
      </div>
      </div>

      <div className={ribbonGroupClass('layout')} style={{ order: -10 }}>
      <span className="qn-ribbon-group-label">Page setup</span>
      <ToolbarButton onClick={() => editor.chain().focus().insertPageBreak().run()} title={`Insert page break (${shortcut('Enter')})`}>
        <FilePlus2 className="h-4 w-4" />
      </ToolbarButton>
      <div className="relative" ref={paperPickerRef}>
        <DropdownButton isOpen={showPaperPicker} onClick={() => toggleDropdown(setShowPaperPicker, showPaperPicker)} title="Paper Style">
          <span className="text-xs font-medium">{paperStyles[currentPaper]?.name || 'Plain'}</span>
        </DropdownButton>
        <PortalDropdown isOpen={showPaperPicker} anchorRef={paperPickerRef} onClose={() => setShowPaperPicker(false)} align="right">
          <div className="py-1.5 w-[200px]">
            {Object.entries(paperStyles).map(([key, paper]) => (
              <button
                key={key}
                type="button"
                aria-pressed={currentPaper === key}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onPaperChange(key)
                  setShowPaperPicker(false)
                }}
                className={`qn-focus-inset w-full px-3 py-2 text-left text-[13px] hover:bg-surface-hover flex items-center gap-3 rounded-lg transition-colors ${
 currentPaper === key ? 'bg-accent-soft text-accent-text font-medium' : 'text-content-muted'
 }`}
              >
                <div
                  className="flex-shrink-0 w-5 h-5 border border-subtle rounded-md"
                  style={paper.preview || paper.style}
                />
                <span className="truncate">{paper.name}</span>
              </button>
            ))}
          </div>
        </PortalDropdown>
      </div>
      </div>

      <div className={ribbonGroupClass('review')}>
      <span className="qn-ribbon-group-label">Proofing</span>
      <ToolbarButton
        onClick={() => useUIStore.getState().setSpellCheck(!spellCheck)}
        isActive={spellCheck}
        title={spellCheck ? 'Turn off spell check' : 'Turn on spell check'}
      >
        <SpellCheck className="h-4 w-4" />
      </ToolbarButton>
      <div className="relative" ref={accessibilityRef}>
        <ToolbarButton
          onClick={openAccessibilityCheck}
          isActive={showAccessibilityCheck}
          title="Accessibility checker"
        >
          <Accessibility className="h-4 w-4" />
        </ToolbarButton>
        <PortalDropdown
          isOpen={showAccessibilityCheck}
          anchorRef={accessibilityRef}
          onClose={() => setShowAccessibilityCheck(false)}
          align="right"
          label="Accessibility checker"
        >
          <div className="w-[min(20rem,calc(100vw-1rem))] p-2.5">
            <div className="flex items-start gap-3 border-b border-subtle pb-3">
              <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full ${accessibilityIssues.length === 0 ? 'bg-success-soft text-success-text' : 'bg-warning-soft text-warning-text'}`}>
                {accessibilityIssues.length === 0 ? <Check className="h-4 w-4" /> : <Accessibility className="h-4 w-4" />}
              </span>
              <div>
                <p className="font-semibold text-content">
                  {accessibilityIssues.length === 0
                    ? 'No accessibility issues found'
                    : `${accessibilityIssues.length} ${accessibilityIssues.length === 1 ? 'issue' : 'issues'} found`}
                </p>
                <p className="mt-0.5 text-ui-xs leading-relaxed text-content-muted">
                  Checks heading order, image descriptions, table headers, and descriptive link text.
                </p>
              </div>
            </div>
            {accessibilityIssues.length > 0 && (
              <div className="max-h-72 overflow-y-auto py-2">
                {accessibilityIssues.map((issueItem) => (
                  <button
                    key={issueItem.id}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => focusAccessibilityIssue(issueItem)}
                    className="w-full rounded-control px-2.5 py-2 text-left hover:bg-surface-hover"
                  >
                    <span className="block text-ui-sm font-semibold text-content">{issueItem.title}</span>
                    <span className="mt-0.5 block text-ui-xs leading-relaxed text-content-muted">{issueItem.description}</span>
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setAccessibilityIssues(inspectEditorAccessibility(editor.state.doc))}
              className="mt-2 w-full rounded-control border border-subtle px-3 py-2 text-ui-sm font-medium text-content-muted hover:bg-surface-hover hover:text-content"
            >
              Check again
            </button>
          </div>
        </PortalDropdown>
      </div>
      </div>

      <div className={ribbonGroupClass('review')}>
      <span className="qn-ribbon-group-label">Insights</span>
      <ToolbarButton
        onClick={() => useUIStore.getState().setShowNoteStatistics(!showNoteStatistics)}
        isActive={showNoteStatistics}
        title={showNoteStatistics ? 'Hide document statistics' : 'Show document statistics'}
      >
        <BarChart3 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => useUIStore.getState().setVersionHistoryOpen(true, noteId)}
        title="Version history"
      >
        <VersionHistory className="h-4 w-4" />
      </ToolbarButton>
      </div>

      <div className={ribbonGroupClass('view')}>
      <span className="qn-ribbon-group-label">Show</span>
      <ToolbarButton
        onClick={() => updateEditorSettings({ showRuler: !editorSettings.showRuler })}
        isActive={!isCompactViewport && editorSettings.showRuler}
        disabled={isCompactViewport}
        title={isCompactViewport ? 'Ruler is available on larger screens' : editorSettings.showRuler ? 'Hide ruler' : 'Show ruler'}
      >
        <Ruler className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => updateEditorSettings({ showInvisibles: !editorSettings.showInvisibles })} isActive={editorSettings.showInvisibles} title={editorSettings.showInvisibles ? 'Hide formatting marks' : 'Show formatting marks'}>
        <Pilcrow className="h-4 w-4" />
      </ToolbarButton>
      </div>

      <div className={ribbonGroupClass('view')}>
      <span className="qn-ribbon-group-label">Page view</span>
      <div className="relative" ref={documentWidthRef}>
        <DropdownButton isOpen={showDocumentWidth} onClick={() => toggleDropdown(setShowDocumentWidth, showDocumentWidth)} title="Document width">
          <PanelTop className="h-4 w-4" />
        </DropdownButton>
        <PortalDropdown isOpen={showDocumentWidth} anchorRef={documentWidthRef} onClose={() => setShowDocumentWidth(false)} align="right" label="Document width">
          <div className="w-48 p-1.5">
            {[
              ['focused', 'Focused', 'Comfortable reading column'],
              ['standard', 'Standard', 'Balanced writing space'],
              ['wide', 'Wide', 'More room for tables'],
              ['full', 'Full width', 'Use all available space'],
            ].map(([value, label, description]) => (
              <button key={value} type="button" aria-pressed={editorSettings.documentWidth === value} onMouseDown={(event) => event.preventDefault()} onClick={() => { updateEditorSettings({ documentWidth: value }); setShowDocumentWidth(false) }} className={`flex w-full items-start justify-between gap-3 rounded-control px-2.5 py-2 text-left hover:bg-surface-hover ${editorSettings.documentWidth === value ? 'text-accent-text' : 'text-content-muted'}`}>
                <span><span className="block text-ui-sm font-semibold">{label}</span><span className="block text-ui-xs font-normal text-content-subtle">{description}</span></span>
                {editorSettings.documentWidth === value && <Check className="mt-0.5 h-4 w-4 shrink-0" />}
              </button>
            ))}
          </div>
        </PortalDropdown>
      </div>
      </div>

      <div className={ribbonGroupClass('view')}>
      <span className="qn-ribbon-group-label">Focus</span>
      <ToolbarButton onClick={() => useUIStore.getState().setFocusModeOpen(true)} title="Open focus mode">
        <Focus className="h-4 w-4" />
      </ToolbarButton>
      </div>

      <div className={ribbonGroupClass('review')} style={{ order: -2 }}>
      <span className="qn-ribbon-group-label">Speech</span>
      <ToolbarButton onClick={() => useUIStore.getState().setVoiceInputActive(!voiceInputActive)} isActive={voiceInputActive} title={voiceInputActive ? 'Stop dictation' : 'Start dictation'}>
        <Mic className="h-4 w-4" />
      </ToolbarButton>
      </div>

      <div className={ribbonGroupClass('view')}>
      <span className="qn-ribbon-group-label">Advanced</span>
      <ToolbarButton
        onClick={() => useUIStore.getState().setHTMLEditorOpen(true)}
        title="Edit HTML Source"
      >
        <FileCode className="w-4 h-4" />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => useUIStore.getState().setShortcutsModalOpen(true)}
        title="Keyboard shortcuts"
      >
        <Keyboard className="h-4 w-4" />
      </ToolbarButton>
      </div>
      </div>
      </div>
      </div>
    </ToolbarActionContext.Provider>
  )
}
