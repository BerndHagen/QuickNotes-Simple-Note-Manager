import { lazy, Suspense, useEffect, useCallback, useMemo, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useEditor, EditorContent } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Highlight from '@tiptap/extension-highlight'
import TaskList from '@tiptap/extension-task-list'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import TextAlign from '@tiptap/extension-text-align'
import Underline from '@tiptap/extension-underline'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import { TextStyle } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import FontFamily from '@tiptap/extension-font-family'
import { Table } from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import ResizableImageExtension from './ResizableImageExtension'
import TextBoxExtension from './TextBoxExtension'
import ShapeExtension from './ShapeExtension'
import ParagraphLayoutExtension from './ParagraphLayoutExtension'
import TabStopExtension from './TabStopExtension'
import PageBreakExtension from './PageBreakExtension'
import PaginationExtension from './PaginationExtension'
import StyledTaskItem from './StyledTaskItem'
import CalloutExtension from './CalloutExtension'
import InvisibleCharactersExtension from './InvisibleCharactersExtension'
import HeadingAnchorExtension from './HeadingAnchorExtension'
import CustomTableCell from './CustomTableCell'
import CustomTableHeader from './CustomTableHeader'
import TableBubbleMenu from './TableBubbleMenu'
import { common, createLowlight } from 'lowlight'
import { BREAKPOINTS, useMediaQuery } from '../hooks/useBreakpoint'
import {
  Bold,
  Italic,
  Strikethrough,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Heading1,
  Heading2,
  Link as LinkIcon,
  Highlighter,
  Undo,
  Redo,
  FileCode,
  Minus,
  AlignLeft,
  Underline as UnderlineIcon,
  Table as TableIcon,
  Scissors,
  Copy,
  ClipboardPaste,
  MousePointer2,
  CaseSensitive,
  Calendar,
  Info,
  FilePlus2,
} from 'lucide-react'
import { debounce } from '../lib/utils'
import { formatShortcut } from '../lib/shortcuts'
import { useUIStore } from '../store'
import { useEditorSettings } from './EditorSettingsModal'
import { DEFAULT_EDITOR_FONT } from '../lib/editorFonts'
import { ensureEditorFontLoaded, ensureEditorFontsForHtml } from '../lib/editorFontLoader'
import { DropCap, FontSize, LetterSpacing, LineHeight, NoteAwareLink } from './editor/documentExtensions'
import { toggleStructuralCallout } from './editor/editorCommands'
import { DocumentPageSheets, DocumentRuler, VerticalDocumentRuler } from './editor/DocumentChrome'
import { paperStyles } from '../lib/paperStyles'
import { PaperSurface } from './workspace/WorkspaceSurface'
import toast from 'react-hot-toast'
import {
  Menu,
  MenuItem,
  MenuSeparator,
} from './ui'

const lowlight = createLowlight(common)
const EditorToolbar = lazy(() => import('./editor/EditorToolbar'))

function SlashCommandMenu({ editor, editorSettings, menu, onClose }) {
  const [activeIndex, setActiveIndex] = useState(0)
  const activeIndexRef = useRef(0)
  const optionsRef = useRef([])

  const allOptions = useMemo(() => [
    { label: 'Text', hint: 'Plain paragraph', keywords: 'paragraph normal', icon: AlignLeft, run: () => editor.chain().focus().setParagraph().run() },
    { label: 'Heading 1', hint: 'Large section heading', keywords: 'title h1', icon: Heading1, run: () => editor.chain().focus().setHeading({ level: 1 }).run() },
    { label: 'Heading 2', hint: 'Medium section heading', keywords: 'subtitle h2', icon: Heading2, run: () => editor.chain().focus().setHeading({ level: 2 }).run() },
    { label: 'Checklist', hint: 'Track actionable items', keywords: 'task todo checkbox', icon: CheckSquare, run: () => editor.chain().focus().toggleTaskList().updateAttributes('taskItem', { checkboxStyle: editorSettings.defaultCheckboxStyle, checkboxColor: editorSettings.defaultCheckboxColor, checkboxSize: editorSettings.defaultCheckboxSize, checkedStyle: editorSettings.defaultCheckedStyle }).run() },
    { label: 'Bullet list', hint: 'Create an unordered list', keywords: 'bullets list', icon: List, run: () => editor.chain().focus().toggleBulletList().run() },
    { label: 'Numbered list', hint: 'Create an ordered list', keywords: 'ordered list steps', icon: ListOrdered, run: () => editor.chain().focus().toggleOrderedList().run() },
    { label: 'Callout', hint: 'Emphasize a tip or warning', keywords: 'info alert box', icon: Info, run: () => toggleStructuralCallout(editor, 'info') },
    { label: 'Quote', hint: 'Set apart quoted text', keywords: 'blockquote citation', icon: Quote, run: () => editor.chain().focus().toggleBlockquote().run() },
    { label: 'Code block', hint: 'Monospaced code with highlighting', keywords: 'pre developer', icon: FileCode, run: () => editor.chain().focus().toggleCodeBlock().run() },
    { label: 'Divider', hint: 'Separate sections', keywords: 'line horizontal rule', icon: Minus, run: () => editor.chain().focus().setHorizontalRule().run() },
    { label: 'Page break', hint: 'Start a new A4 page', keywords: 'page break ctrl enter', icon: FilePlus2, run: () => editor.chain().focus().insertPageBreak().run() },
    { label: 'Table', hint: 'Insert a 3 by 3 table', keywords: 'grid cells', icon: TableIcon, run: () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
    { label: 'Current date', hint: 'Insert today’s local date', keywords: 'today timestamp', icon: Calendar, run: () => editor.chain().focus().insertContent(new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date())).run() },
  ], [editor, editorSettings])

  const visibleOptions = useMemo(() => {
    if (!menu) return []
    const query = menu.query.toLowerCase()
    return allOptions.filter((option) => `${option.label} ${option.keywords}`.toLowerCase().includes(query)).slice(0, 8)
  }, [allOptions, menu])

  useEffect(() => {
    optionsRef.current = visibleOptions
    if (activeIndex >= visibleOptions.length) {
      activeIndexRef.current = 0
      setActiveIndex(0)
    }
  }, [activeIndex, visibleOptions])

  const selectOption = useCallback((option) => {
    if (!menu || !option) return
    editor.chain().focus().deleteRange({ from: menu.from, to: menu.to }).run()
    option.run()
    onClose()
  }, [editor, menu, onClose])

  useEffect(() => {
    if (!editor || !menu) return undefined
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        onClose()
        return
      }
      if (!['ArrowDown', 'ArrowUp', 'Enter'].includes(event.key)) return
      event.preventDefault()
      event.stopPropagation()
      const options = optionsRef.current
      if (options.length === 0) return
      if (event.key === 'Enter') {
        selectOption(options[activeIndexRef.current])
        return
      }
      const direction = event.key === 'ArrowDown' ? 1 : -1
      const next = (activeIndexRef.current + direction + options.length) % options.length
      activeIndexRef.current = next
      setActiveIndex(next)
    }
    editor.view.dom.addEventListener('keydown', handleKeyDown, true)
    return () => {
      editor.view.dom.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [editor, menu, onClose, selectOption])

  if (!menu) return null

  return createPortal(
    <div role="listbox" aria-label="Insert block" className="qn-slash-menu fixed z-[99999] w-[min(20rem,calc(100vw-1rem))] overflow-hidden rounded-card border border-strong bg-surface-raised p-1.5 shadow-md" style={{ left: Math.max(8, menu.left), top: Math.max(8, menu.top) }}>
      <div className="flex items-center justify-between px-2.5 py-1.5">
        <span className="text-ui-xs font-semibold uppercase tracking-wide text-content-subtle">Insert block</span>
        <span className="text-ui-xs text-content-subtle">↑↓ · Enter</span>
      </div>
      <div className="max-h-80 overflow-y-auto">
        {visibleOptions.length ? visibleOptions.map((option, index) => {
          const Icon = option.icon
          return (
            <button key={option.label} type="button" role="option" aria-selected={index === activeIndex} onMouseDown={(event) => event.preventDefault()} onMouseEnter={() => { activeIndexRef.current = index; setActiveIndex(index) }} onClick={() => selectOption(option)} className={`flex w-full items-center gap-3 rounded-control px-2.5 py-2 text-left transition-colors ${index === activeIndex ? 'bg-accent-soft text-content' : 'text-content-muted hover:bg-surface-hover hover:text-content'}`}>
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-control border border-subtle bg-surface-raised"><Icon className="h-4 w-4" /></span>
              <span className="min-w-0"><span className="block text-ui-sm font-semibold">{option.label}</span><span className="block truncate text-ui-xs text-content-subtle">{option.hint}</span></span>
            </button>
          )
        }) : <p className="px-3 py-4 text-ui-sm text-content-muted">No matching blocks</p>}
      </div>
    </div>,
    document.body
  )
}

function ObjectDrawingLayer({ editor, tool, containerRef, onFinish, workspaceZoom = 1 }) {
  const [gesture, setGesture] = useState(null)
  const [bounds, setBounds] = useState(null)

  useEffect(() => {
    if (!tool) return undefined
    const sync = () => {
      const rect = containerRef.current?.getBoundingClientRect()
      if (rect) setBounds(rect)
    }
    sync()
    window.addEventListener('resize', sync)
    window.addEventListener('scroll', sync, true)
    const previousCursor = document.body.style.cursor
    document.body.style.cursor = 'crosshair'
    const cancel = (event) => {
      if (event.key !== 'Escape') return
      setGesture(null)
      onFinish()
    }
    document.addEventListener('keydown', cancel)
    return () => {
      document.body.style.cursor = previousCursor
      window.removeEventListener('resize', sync)
      window.removeEventListener('scroll', sync, true)
      document.removeEventListener('keydown', cancel)
    }
  }, [containerRef, onFinish, tool])

  if (!tool || !bounds) return null

  const pageAtPoint = (clientX, clientY) => {
    const pageRects = [...(containerRef.current?.querySelectorAll('.qn-document-page-edge') || [])]
      .map((element) => element.getBoundingClientRect())
      .filter((rect) => rect.width > 0 && rect.height > 0)
    if (pageRects.length === 0) return bounds
    return pageRects.find((rect) => (
      clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom
    )) || null
  }

  const pointInsidePage = (clientX, clientY, pageRect) => ({
    x: Math.min(pageRect.right - 2, Math.max(pageRect.left + 2, clientX)),
    y: Math.min(pageRect.bottom - 2, Math.max(pageRect.top + 2, clientY)),
  })

  const preview = gesture
    ? {
        left: Math.min(gesture.startClientX, gesture.currentClientX),
        top: Math.min(gesture.startClientY, gesture.currentClientY),
        width: Math.abs(gesture.currentClientX - gesture.startClientX),
        height: Math.abs(gesture.currentClientY - gesture.startClientY),
      }
    : null

  const finishDrawing = (event) => {
    if (!gesture) return
    const editorRect = editor.view.dom.getBoundingClientRect()
    const scale = Math.max(0.1, workspaceZoom)
    const end = pointInsidePage(event.clientX, event.clientY, gesture.pageRect)
    const rawWidth = Math.abs(end.x - gesture.startClientX) / scale
    const rawHeight = Math.abs(end.y - gesture.startClientY) / scale
    const minimumWidth = tool.kind === 'textBox' ? 160 : 96
    const preferredWidth = tool.kind === 'textBox' ? 320 : 240
    const minimumHeight = tool.kind === 'textBox' ? 80 : 56
    const preferredHeight = tool.kind === 'textBox' ? 140 : 112
    const horizontalInset = 8
    const verticalInset = 8
    const pageWidth = gesture.pageRect.width / scale
    const pageHeight = gesture.pageRect.height / scale
    const width = Math.min(
      Math.max(minimumWidth, rawWidth || preferredWidth),
      Math.max(minimumWidth, pageWidth - horizontalInset * 2)
    )
    const height = Math.min(
      Math.max(minimumHeight, rawHeight || preferredHeight),
      Math.max(minimumHeight, pageHeight - verticalInset * 2)
    )
    const left = Math.min(gesture.startClientX, rawWidth ? end.x : gesture.startClientX)
    const top = Math.min(gesture.startClientY, rawHeight ? end.y : gesture.startClientY)
    const pageOriginX = (gesture.pageRect.left - editorRect.left) / scale
    const pageOriginY = (gesture.pageRect.top - editorRect.top) / scale
    const localX = Math.min(
      Math.max(horizontalInset, (left - gesture.pageRect.left) / scale),
      Math.max(horizontalInset, pageWidth - width - horizontalInset)
    )
    const localY = Math.min(
      Math.max(verticalInset, (top - gesture.pageRect.top) / scale),
      Math.max(verticalInset, pageHeight - height - verticalInset)
    )
    const x = Math.round(pageOriginX + localX)
    const y = Math.round(pageOriginY + localY)
    const node = tool.kind === 'textBox'
      ? {
          type: 'textBox',
          attrs: { wrap: 'absolute', x, y, width: Math.round(width), height: Math.round(height), background: '#ffffff' },
          content: [{ type: 'paragraph' }],
        }
      : {
          type: 'shape',
          attrs: { shapeType: tool.shapeType, wrap: 'absolute', x, y, width: Math.round(width), height: Math.round(height) },
          content: [{ type: 'text', text: 'Add text' }],
        }

    editor.commands.insertContentAt(editor.state.doc.content.size, node, { updateSelection: true })
    editor.view.focus()
    setGesture(null)
    onFinish()
  }

  return createPortal(
    <div
      role="application"
      aria-label={tool.kind === 'textBox' ? 'Draw text box on the page' : 'Draw shape on the page'}
      className="fixed z-[99990] cursor-crosshair touch-none overflow-hidden"
      style={{ left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height }}
      onPointerDown={(event) => {
        const pageRect = pageAtPoint(event.clientX, event.clientY)
        if (!pageRect) return
        const start = pointInsidePage(event.clientX, event.clientY, pageRect)
        event.currentTarget.setPointerCapture?.(event.pointerId)
        setGesture({
          startClientX: start.x,
          startClientY: start.y,
          currentClientX: start.x,
          currentClientY: start.y,
          pageRect,
        })
      }}
      onPointerMove={(event) => {
        if (!gesture) return
        const point = pointInsidePage(event.clientX, event.clientY, gesture.pageRect)
        setGesture((current) => current ? { ...current, currentClientX: point.x, currentClientY: point.y } : null)
      }}
      onPointerUp={finishDrawing}
      onPointerCancel={() => {
        setGesture(null)
        onFinish()
      }}
    >
      <div className="pointer-events-none absolute left-3 top-3 rounded-control border border-accent bg-surface-raised px-2.5 py-1.5 text-ui-sm font-semibold text-accent-text shadow-md">
        Drag to set the {tool.kind === 'textBox' ? 'text box' : 'shape'} size · Esc cancels
      </div>
      {preview && (
        <div
          className="pointer-events-none fixed border-2 border-accent bg-accent-soft opacity-70 shadow-lg"
          style={preview}
        />
      )}
    </div>,
    document.body
  )
}

export default function RichTextEditor({
  noteId,
  content,
  onChange,
  onDraftChange,
  placeholder,
  paperType = 'plain',
  onPaperTypeChange,
  onEditorReady,
  navigationTarget = null,
  onNavigationComplete,
  isExternalUpdate = false,
  readOnly = false,
  editingBlocked = false,
  ribbonLeadingAction,
  ribbonTitle,
  ribbonActions,
  ribbonDetails,
  ribbonOverflowAction,
  focusPresentation = false,
  workspaceZoom = 1,
}) {
  const [currentPaper, setCurrentPaper] = useState(paperType)
  const [typingEpoch, setTypingEpoch] = useState(0)
  const [mobileToolbarOpen, setMobileToolbarOpen] = useState(true)
  const [editorMenuPoint, setEditorMenuPoint] = useState(null)
  const [slashMenu, setSlashMenu] = useState(null)
  const [activeRibbonTab, setActiveRibbonTab] = useState('home')
  const [drawTool, setDrawTool] = useState(null)
  const editorContainerRef = useRef(null)
  const workbenchRef = useRef(null)
  const [pageLayoutWidth, setPageLayoutWidth] = useState(0)
  const isInternalUpdate = useRef(false)
  const lastKnownContent = useRef(content)
  const lastContentHash = useRef('')
  const isUserTyping = useRef(false)
  const typingTimeoutRef = useRef(null)
  const lastCursorPosition = useRef({ from: 0, to: 0 })
  const lastSentContent = useRef('')
  const onChangeRef = useRef(onChange)
  const onDraftChangeRef = useRef(onDraftChange)
  const editorSettings = useEditorSettings()
  const isCompactViewport = useMediaQuery(BREAKPOINTS.compact)
  const hasAppliedDefaultTab = useRef(false)
  const finishObjectDrawing = useCallback(() => setDrawTool(null), [])
  const syncSlashMenu = useCallback((currentEditor) => {
    requestAnimationFrame(() => {
      if (!currentEditor || currentEditor.isDestroyed) return
      const { selection } = currentEditor.state
      if (!selection.empty || !selection.$from.parent.isTextblock) {
        setSlashMenu(null)
        return
      }
      const text = selection.$from.parent.textBetween(0, selection.$from.parentOffset, undefined, '\ufffc')
      const match = text.match(/^\/([\w -]*)$/)
      if (!match) {
        setSlashMenu(null)
        return
      }
      const coords = currentEditor.view.coordsAtPos(selection.from)
      setSlashMenu({
        query: match[1].trim(),
        from: selection.from - match[0].length,
        to: selection.from,
        left: Math.min(coords.left, window.innerWidth - 330),
        top: Math.min(coords.bottom + 8, window.innerHeight - 390),
      })
    })
  }, [])

  useEffect(() => {
    if (hasAppliedDefaultTab.current) return
    hasAppliedDefaultTab.current = true
    setActiveRibbonTab(editorSettings.defaultRibbonTab || 'home')
  }, [editorSettings.defaultRibbonTab])

  useEffect(() => {
    onChangeRef.current = onChange
    onDraftChangeRef.current = onDraftChange
  }, [onChange, onDraftChange])

  useEffect(() => {
    void ensureEditorFontLoaded(editorSettings.defaultFontFamily)
  }, [editorSettings.defaultFontFamily])

  useEffect(() => {
    void ensureEditorFontsForHtml(content)
  }, [content])

  const generateContentHash = (html) => {
    if (!html) return ''
    return html.substring(0, 100) + html.length
  }

  useEffect(() => {
    setMobileToolbarOpen(true)
    setDrawTool(null)
    setSlashMenu(null)
    isUserTyping.current = false
    isInternalUpdate.current = false
    lastSentContent.current = null
    lastKnownContent.current = null
    lastContentHash.current = ''
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }
    if (editor && !editor.isDestroyed) {
      editor.commands.setContent(content || '', { emitUpdate: false })
      lastKnownContent.current = content || ''
      lastSentContent.current = content || ''
    }
  }, [noteId]) // eslint-disable-line react-hooks/exhaustive-deps
  
  const markUserTyping = useCallback(() => {
    isUserTyping.current = true
    isInternalUpdate.current = true
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      isUserTyping.current = false
      isInternalUpdate.current = false
      setTypingEpoch((value) => value + 1)
    }, 2000)
  }, [])

  const editor = useEditor({
    editable: !readOnly && !editingBlocked,
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        link: false,
        underline: false,
      }),
      Placeholder.configure({
        placeholder: placeholder || 'Start writing...',
      }),
      NoteAwareLink.configure({
        // QuickNotes owns navigation for internal note links. Ordinary links
        // are opened through the dedicated link UI, never TipTap's implicit
        // click handler (which can create an unexpected browser tab).
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-accent-text underline cursor-pointer',
          target: null,
          rel: null,
        },
      }),
      Highlight.configure({
        multicolor: true,
      }),
      TaskList.configure({
        HTMLAttributes: {
          class: 'task-list',
        },
      }),
      StyledTaskItem.configure({
        nested: true,
        HTMLAttributes: {
          class: 'task-item',
        },
      }),
      CodeBlockLowlight.configure({
        lowlight,
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Underline,
      Subscript,
      Superscript,
      TextStyle,
      Color,
      FontFamily,
      FontSize,
      LineHeight,
      ParagraphLayoutExtension,
      TabStopExtension,
      PageBreakExtension,
      PaginationExtension,
      LetterSpacing,
      DropCap,
      Table.configure({
        resizable: true,
      }),
      TableRow,
      CustomTableHeader,
      CustomTableCell,
      ResizableImageExtension.configure({
        inline: false,
        allowBase64: true,
      }),
      HeadingAnchorExtension,
      CalloutExtension,
      TextBoxExtension,
      ShapeExtension,
      InvisibleCharactersExtension,
    ],
    content: content || '',
    onUpdate: ({ editor, transaction }) => {
      // TipTap 3 clears the schema as part of destroy(). A queued React or
      // ProseMirror update can still reach this callback while navigation is
      // tearing the component down, so serialization must only run while the
      // editor has a live schema.
      if (editor.isDestroyed || !editor.schema) return
      const nextHtml = editor.getHTML()
      // Focus, pagination measurement, decorations, and other presentation
      // transactions can emit Tiptap's update event without changing the
      // document. Treating those as edits silently rewrote legacy HTML and
      // moved a merely opened note into Today.
      if (!transaction?.docChanged || transaction.getMeta('quicknotesSystemMigration')) {
        lastKnownContent.current = nextHtml
        syncSlashMenu(editor)
        return
      }
      markUserTyping()
      isInternalUpdate.current = true
      lastKnownContent.current = nextHtml
      void ensureEditorFontsForHtml(lastKnownContent.current)
      onDraftChangeRef.current?.(lastKnownContent.current)
      lastCursorPosition.current = {
        from: editor.state.selection.from,
        to: editor.state.selection.to
      }
      debouncedOnChange(nextHtml)
      syncSlashMenu(editor)
    },
    onSelectionUpdate: ({ editor }) => {
      lastCursorPosition.current = {
        from: editor.state.selection.from,
        to: editor.state.selection.to
      }
      syncSlashMenu(editor)
    },
    editorProps: {
      attributes: {
        class: 'prose prose-lg dark:prose-invert max-w-none focus:outline-none px-4 py-2',
        spellcheck: useUIStore.getState().spellCheck ? 'true' : 'false',
        role: 'textbox',
        'aria-label': 'Note content',
        'aria-multiline': 'true',
      },
      handleKeyDown: (view, event) => {
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
          event.preventDefault()
          editor.chain().focus().insertPageBreak().run()
          return true
        }
        if (event.key === 'Tab') {
          const listType = ['taskItem', 'listItem'].find((type) => event.shiftKey
            ? editor.can().liftListItem(type)
            : editor.can().sinkListItem(type))
          if (listType) {
            event.preventDefault()
            const chain = editor.chain().focus()
            if (event.shiftKey) chain.liftListItem(listType).run()
            else chain.sinkListItem(listType).run()
            return true
          }

          const { $from } = view.state.selection
          const insideTable = Array.from({ length: $from.depth + 1 }, (_, depth) => $from.node(depth).type.name)
            .some((name) => name === 'tableCell' || name === 'tableHeader')
          if (insideTable) return false

          event.preventDefault()
          if (event.shiftKey) {
            editor.chain().focus().decreaseParagraphIndent().run()
            return true
          }

          const coords = view.coordsAtPos(view.state.selection.from)
          const editorRect = view.dom.getBoundingClientRect()
          const editorStyle = getComputedStyle(view.dom)
          const scale = view.dom.clientWidth > 0 ? editorRect.width / view.dom.clientWidth : 1
          const contentLeft = editorRect.left + ((parseFloat(editorStyle.paddingLeft) || 0) * scale)
          const currentX = Math.max(0, (coords.left - contentLeft) / scale)
          const attributes = editor.getAttributes(editor.isActive('heading') ? 'heading' : 'paragraph')
          const customStops = Array.isArray(attributes.tabStops)
            ? attributes.tabStops.map((stop) => typeof stop === 'number' ? { position: stop, type: 'left' } : stop)
            : []
          const nextStop = customStops.find((stop) => stop.position > currentX + 4)
            ?? { position: (Math.floor(currentX / 48) + 1) * 48, type: 'left' }
          editor.chain().focus().insertTabStop({
            width: Math.max(8, nextStop.position - currentX),
            stop: nextStop.position,
            type: nextStop.type,
          }).run()
          return true
        }
        
        return false
      },
    },
  })

  useEffect(() => {
    if (!editor) return undefined
    const frame = requestAnimationFrame(() => {
      if (editorContainerRef.current?.querySelector('.ProseMirror')) onEditorReady?.(editor)
    })
    return () => cancelAnimationFrame(frame)
  }, [editor, onEditorReady])

  useEffect(() => {
    if (!editor || !navigationTarget || navigationTarget.noteId !== noteId) return undefined
    const frame = requestAnimationFrame(() => {
      if (navigationTarget.anchorId) {
        const escaped = typeof CSS !== 'undefined' && CSS.escape
          ? CSS.escape(navigationTarget.anchorId)
          : navigationTarget.anchorId.replace(/[^a-zA-Z0-9_-]/g, '\\$&')
        const heading = editorContainerRef.current?.querySelector(`[data-anchor-id="${escaped}"]`)
        if (heading) {
          heading.scrollIntoView({ block: 'center', behavior: 'smooth' })
          const position = editor.view.posAtDOM(heading, 0)
          editor.chain().focus().setTextSelection(position).run()
        }
      }
      onNavigationComplete?.(navigationTarget.token)
    })
    return () => cancelAnimationFrame(frame)
  }, [editor, navigationTarget, noteId, onNavigationComplete])

  useEffect(() => {
    if (!editor) return undefined
    const syncObjectCanvasHeight = () => {
      let objectBottom = 0
      if (typeof editor.state.doc.descendants !== 'function') return
      editor.state.doc.descendants((node) => {
        if (!['textBox', 'shape'].includes(node.type.name) || node.attrs.wrap !== 'absolute') return
        objectBottom = Math.max(
          objectBottom,
          (Number(node.attrs.y) || 0) + (Number(node.attrs.height) || (node.type.name === 'textBox' ? 140 : 112))
        )
      })
      editorContainerRef.current?.querySelector('.ProseMirror')
        ?.style.setProperty('--qn-object-min-height', `${Math.max(300, objectBottom + 72)}px`)
    }
    syncObjectCanvasHeight()
    if (typeof editor.on !== 'function' || typeof editor.off !== 'function') return undefined
    editor.on('transaction', syncObjectCanvasHeight)
    return () => editor.off('transaction', syncObjectCanvasHeight)
  }, [editor])

  useEffect(() => {
    if (editor && !editor.isDestroyed) editor.setEditable(!readOnly && !editingBlocked)
  }, [editor, editingBlocked, readOnly])

  useEffect(() => {
    const applySpellCheck = () => {
      if (editor && !editor.isDestroyed) {
        const el = editorContainerRef.current?.querySelector('.ProseMirror')
        if (el) {
          el.setAttribute('spellcheck', useUIStore.getState().spellCheck ? 'true' : 'false')
        }
      }
    }
    applySpellCheck()
    const unsub = useUIStore.subscribe(applySpellCheck)
    return () => unsub()
  }, [editor])

  // Editor settings apply to the live ProseMirror DOM node, which TipTap
  // owns, so they are written as styles and classes rather than props.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    const el = editorContainerRef.current?.querySelector('.ProseMirror')
    if (!el) return

    el.style.fontFamily = editorSettings.defaultFontFamily || DEFAULT_EDITOR_FONT
    el.style.fontSize = editorSettings.defaultFontSize || '16px'
    el.style.lineHeight = editorSettings.defaultLineHeight || '1.5'
    el.style.tabSize = editorSettings.tabSize || 4
    el.style.MozTabSize = editorSettings.tabSize || 4

    if (editorSettings.wordWrap) {
      el.style.overflowWrap = 'break-word'
      el.style.wordBreak = 'normal'
      el.style.whiteSpace = 'pre-wrap'
    } else {
      el.style.overflowWrap = 'normal'
      el.style.wordBreak = 'normal'
      el.style.whiteSpace = 'pre'
    }

    if (editorSettings.showInvisibles) {
      el.classList.add('show-invisibles')
    } else {
      el.classList.remove('show-invisibles')
    }
    editor.commands.setInvisibleCharacters?.(editorSettings.showInvisibles)

    if (editorSettings.highlightCurrentLine) {
      el.classList.add('highlight-current-line')
    } else {
      el.classList.remove('highlight-current-line')
    }

    el.setAttribute('spellcheck', editorSettings.spellCheck ? 'true' : 'false')
    el.setAttribute('autocorrect', editorSettings.autoCorrect ? 'on' : 'off')

  }, [editor, editorSettings])

  const autoSaveDelay = useUIStore((s) => s.autoSaveDelay)

  const debouncedOnChange = useMemo(
    () =>
      debounce((html) => {
        lastSentContent.current = html
        onChangeRef.current?.(html)
      }, autoSaveDelay ?? 300),
    [autoSaveDelay]
  )

  useEffect(() => {
    return () => {
      // Flush the previous note before a switch or unmount. Draft state is
      // already durable in localStorage; this commits IndexedDB/cloud queue
      // work without allowing the next note to cancel the pending callback.
      debouncedOnChange.flush()
    }
  }, [noteId, debouncedOnChange])

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!editor || editor.isDestroyed || !editor.schema) return
    
    const currentEditorContent = editor.getHTML()
    const newContentHash = generateContentHash(content)
    const currentContentHash = generateContentHash(currentEditorContent)
    
    if (isUserTyping.current) {
      return
    }
    
    if (isInternalUpdate.current) {
      return
    }
    
    if (content === lastSentContent.current) {
      lastKnownContent.current = content
      return
    }
    
    if (content === lastKnownContent.current) {
      return
    }
    
    if (content === currentEditorContent) {
      lastKnownContent.current = content
      return
    }
    
    const isNoteSwitch = Math.abs((content || '').length - (currentEditorContent || '').length) > 50 ||
                         newContentHash !== currentContentHash
    
    const shouldPreserveCursor = isExternalUpdate || !isNoteSwitch
    
    const from = lastCursorPosition.current.from || editor.state.selection.from
    const to = lastCursorPosition.current.to || editor.state.selection.to
    
    editor.commands.setContent(content || '', { emitUpdate: false })
    lastKnownContent.current = content
    lastContentHash.current = newContentHash
    
    if (shouldPreserveCursor && from > 0) {
      const docLength = editor.state.doc.content.size
      const safeFrom = Math.min(from, Math.max(1, docLength - 1))
      const safeTo = Math.min(to, Math.max(1, docLength - 1))
      
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          try {
            if (editor && !editor.isDestroyed) {
              editor.commands.setTextSelection({ from: safeFrom, to: safeTo })
              lastCursorPosition.current = { from: safeFrom, to: safeTo }
            }
          } catch {
            // The document may have changed again before the deferred cursor restore.
          }
        })
      })
    }
  }, [content, editor, isExternalUpdate, typingEpoch])

  useEffect(() => {
    setCurrentPaper(paperType)
  }, [paperType])

  useEffect(() => {
    const workbench = workbenchRef.current
    if (!workbench) return undefined

    const documentMaxWidth = focusPresentation
      ? 760
      : {
          focused: 680,
          standard: 794,
          wide: 960,
          full: Number.POSITIVE_INFINITY,
        }[editorSettings.documentWidth] || 794
    const syncWidth = () => {
      const style = getComputedStyle(workbench)
      const availableWidth = Math.max(
        240,
        workbench.clientWidth
          - (parseFloat(style.paddingLeft) || 0)
          - (parseFloat(style.paddingRight) || 0)
      )
      const nextWidth = Math.floor(Math.min(availableWidth, documentMaxWidth))
      setPageLayoutWidth((current) => current === nextWidth ? current : nextWidth)
    }

    syncWidth()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(syncWidth)
    observer?.observe(workbench)
    window.addEventListener('resize', syncWidth)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', syncWidth)
    }
  }, [editor, editorSettings.documentWidth, focusPresentation])

  const handlePaperChange = (type) => {
    setCurrentPaper(type)
    onPaperTypeChange?.(type)
  }

  if (!editor) {
    return null
  }

  const paperStyle = paperStyles[currentPaper] || paperStyles.plain
  const hasSelection = !editor.state.selection.empty

  const closeEditorMenu = () => setEditorMenuPoint(null)

  const writeClipboardText = async (text) => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return
    }

    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    const copied = document.execCommand('copy')
    textarea.remove()
    if (!copied) throw new Error('Clipboard write failed')
  }

  const copySelection = async ({ cut = false } = {}) => {
    const { from, to } = editor.state.selection
    if (from === to) return
    const text = editor.state.doc.textBetween(from, to, '\n')
    try {
      await writeClipboardText(text)
      if (cut && !readOnly) editor.chain().focus().deleteSelection().run()
    } catch {
      toast.error('Clipboard access was blocked by the browser')
    }
  }

  const pasteClipboard = async () => {
    try {
      const text = await navigator.clipboard?.readText?.()
      if (typeof text !== 'string') throw new Error('Clipboard read unavailable')
      const { from, to } = editor.state.selection
      editor.view.dispatch(editor.state.tr.insertText(text, from, to))
      editor.view.focus()
    } catch {
      toast.error('Clipboard access was blocked. Use the Paste toolbar action or keyboard shortcut.')
    }
  }

  const runEditorMenuAction = async (action) => {
    closeEditorMenu()
    await action()
  }

  return (
    <div
      className="relative flex h-full min-h-0 flex-col"
      data-editor-presentation={focusPresentation ? 'focus' : 'workspace'}
    >
      {!readOnly && !focusPresentation && (
        <div className="shrink-0">
          <Suspense fallback={<div className="editor-ribbon min-h-[88px] border-b border-subtle bg-surface-toolbar" aria-label="Loading formatting tools" />}>
            <EditorToolbar
              editor={editor}
              noteId={noteId}
              currentPaper={currentPaper}
              onPaperChange={handlePaperChange}
              content={content}
              mobilePanelOpen={mobileToolbarOpen}
              onMobileOpen={() => setMobileToolbarOpen(true)}
              onMobileClose={() => setMobileToolbarOpen(false)}
              activeTab={activeRibbonTab}
              onTabChange={setActiveRibbonTab}
              onStartDrawing={setDrawTool}
              editorSettings={editorSettings}
              onCut={() => copySelection({ cut: true })}
              onCopy={() => copySelection()}
              onPaste={pasteClipboard}
              ribbonLeadingAction={ribbonLeadingAction}
              ribbonTitle={ribbonTitle}
              ribbonActions={ribbonActions}
              ribbonDetails={ribbonDetails}
              ribbonOverflowAction={ribbonOverflowAction}
            />
          </Suspense>
        </div>
      )}
      
      {!readOnly && <BubbleMenu
        editor={editor} 
        tippyOptions={{ duration: 100, aria: { expanded: false, content: 'describedby' } }}
        shouldShow={({ editor, state }) => {
          const { selection } = state
          const isImageSelected = selection.$from.parent.type.name === 'resizableImage' || 
                                   editor.isActive('resizableImage')
          if (isImageSelected) return false
          
          return !selection.empty
        }}
        className="flex items-center gap-0.5 rounded-card border border-strong bg-surface-raised p-1 shadow-md"
      >
        <BubbleButton label="Bold" onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive('bold')}>
          <Bold className="w-4 h-4" />
        </BubbleButton>
        <BubbleButton label="Italic" onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive('italic')}>
          <Italic className="w-4 h-4" />
        </BubbleButton>
        <BubbleButton label="Underline" onClick={() => editor.chain().focus().toggleUnderline().run()} isActive={editor.isActive('underline')}>
          <UnderlineIcon className="w-4 h-4" />
        </BubbleButton>
        <BubbleButton label="Highlight" onClick={() => editor.chain().focus().toggleHighlight().run()} isActive={editor.isActive('highlight')}>
          <Highlighter className="w-4 h-4" />
        </BubbleButton>
        <BubbleButton label="Strikethrough" onClick={() => editor.chain().focus().toggleStrike().run()} isActive={editor.isActive('strike')}>
          <Strikethrough className="w-4 h-4" />
        </BubbleButton>
        <div className="w-px h-5 mx-1 bg-surface-active dark:bg-surface-active" />
        <BubbleButton label="Insert link" onClick={() => {
            useUIStore.getState().setLinkModalOpen(true)
          }} isActive={editor.isActive('link')}>
          <LinkIcon className="w-4 h-4" />
        </BubbleButton>
      </BubbleMenu>}

      {!readOnly && <TableBubbleMenu editor={editor} />}

      {!readOnly && <SlashCommandMenu editor={editor} editorSettings={editorSettings} menu={slashMenu} onClose={() => setSlashMenu(null)} />}

      {!focusPresentation && editorSettings.showRuler && !isCompactViewport && (
        <DocumentRuler editor={editor} containerRef={editorContainerRef} />
      )}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div
          ref={workbenchRef}
          data-editor-canvas
          onContextMenu={(event) => {
            event.preventDefault()
            event.stopPropagation()
            setEditorMenuPoint({ x: event.clientX, y: event.clientY })
          }}
          className="qn-editor-workbench relative flex-1 overflow-y-auto"
        >
          {!focusPresentation && editorSettings.showRuler && !isCompactViewport && (
            <VerticalDocumentRuler editor={editor} containerRef={editorContainerRef} />
          )}
          <PaperSurface
            ref={editorContainerRef}
            data-editor-page
            data-document-width={editorSettings.documentWidth}
            onKeyDownCapture={(event) => {
              if ((!event.ctrlKey && !event.metaKey) || event.key !== 'Enter') return
              event.preventDefault()
              event.stopPropagation()
              editor.chain().focus().insertPageBreak().run()
            }}
            className={`qn-editor-page relative ${paperStyle.className || ''}`}
            style={{
              ...paperStyle.style,
              width: pageLayoutWidth ? `${pageLayoutWidth}px` : '100%',
              zoom: workspaceZoom,
            }}
          >
            <DocumentPageSheets
              editor={editor}
              containerRef={editorContainerRef}
              paperStyle={paperStyle.style}
            />
            <EditorContent editor={editor} />
          </PaperSurface>
        </div>
      </div>

      {!readOnly && (
        <ObjectDrawingLayer
          editor={editor}
          tool={drawTool}
          containerRef={editorContainerRef}
          onFinish={finishObjectDrawing}
          workspaceZoom={workspaceZoom}
        />
      )}

      {!readOnly && !focusPresentation && !mobileToolbarOpen && (
        <button
          type="button"
          aria-label="Show formatting tools"
          aria-controls="qn-editor-toolbar"
          aria-expanded="false"
          onClick={() => setMobileToolbarOpen(true)}
          className="qn-square-control absolute bottom-3 right-3 z-popover hidden items-center justify-center rounded-full border border-strong bg-surface-raised text-content shadow-md transition-colors hover:bg-surface-hover max-md:flex"
        >
          <CaseSensitive className="h-5 w-5" aria-hidden="true" />
        </button>
      )}

      <Menu
        open={Boolean(editorMenuPoint)}
        point={editorMenuPoint}
        onClose={closeEditorMenu}
        label="Editor actions"
        width={220}
      >
        <MenuItem
          icon={Undo}
          shortcut={formatShortcut({ key: 'z', ctrl: true })}
          disabled={readOnly || !editor.can().undo()}
          onClick={() => runEditorMenuAction(() => editor.chain().focus().undo().run())}
        >
          Undo
        </MenuItem>
        <MenuItem
          icon={Redo}
          shortcut={formatShortcut({ key: 'y', ctrl: true })}
          disabled={readOnly || !editor.can().redo()}
          onClick={() => runEditorMenuAction(() => editor.chain().focus().redo().run())}
        >
          Redo
        </MenuItem>
        <MenuSeparator />
        <MenuItem
          icon={Scissors}
          shortcut={formatShortcut({ key: 'x', ctrl: true })}
          disabled={readOnly || !hasSelection}
          onClick={() => runEditorMenuAction(() => copySelection({ cut: true }))}
        >
          Cut
        </MenuItem>
        <MenuItem
          icon={Copy}
          shortcut={formatShortcut({ key: 'c', ctrl: true })}
          disabled={!hasSelection}
          onClick={() => runEditorMenuAction(copySelection)}
        >
          Copy
        </MenuItem>
        <MenuItem
          icon={ClipboardPaste}
          shortcut={formatShortcut({ key: 'v', ctrl: true })}
          disabled={readOnly || !navigator.clipboard?.readText}
          onClick={() => runEditorMenuAction(pasteClipboard)}
        >
          Paste
        </MenuItem>
        <MenuSeparator />
        <MenuItem
          icon={MousePointer2}
          shortcut={formatShortcut({ key: 'a', ctrl: true })}
          onClick={() => runEditorMenuAction(() => editor.chain().focus().selectAll().run())}
        >
          Select all
        </MenuItem>
      </Menu>
    </div>
  )
}

function BubbleButton({ onClick, isActive, children, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`p-1.5 rounded transition-colors ${
 isActive
 ? 'bg-accent-soft text-accent-text'
          : 'hover:bg-surface-hover text-content-muted'
      }`}
    >
      {children}
    </button>
  )
}
