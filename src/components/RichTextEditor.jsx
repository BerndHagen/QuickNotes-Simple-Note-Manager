import { useEffect, useCallback, useMemo, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useEditor, EditorContent, BubbleMenu, FloatingMenu } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import Highlight from '@tiptap/extension-highlight'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import TextAlign from '@tiptap/extension-text-align'
import Underline from '@tiptap/extension-underline'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import TextStyle from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import FontFamily from '@tiptap/extension-font-family'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import { Extension } from '@tiptap/core'
import ResizableImageExtension from './ResizableImageExtension'
import TextBoxExtension from './TextBoxExtension'
import InvisibleCharactersExtension from './InvisibleCharactersExtension'
import CustomTableCell from './CustomTableCell'
import CustomTableHeader from './CustomTableHeader'
import TableBubbleMenu from './TableBubbleMenu'
import { common, createLowlight } from 'lowlight'
import { useTranslation } from '../lib/useTranslation'
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
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
  AlignCenter,
  AlignRight,
  AlignJustify,
  Underline as UnderlineIcon,
  Subscript as SubscriptIcon,
  Superscript as SuperscriptIcon,
  Palette,
  Type,
  Table as TableIcon,
  Trash2,
  ChevronDown,
  Rows,
  Columns,
  X,
  Image as ImageIcon,
  CaseSensitive,
  MoveVertical,
  Square,
  Languages,
  ListTree,
  Paintbrush,
  RemoveFormatting,
  Indent,
  Outdent,
  Sparkles,
  Type as TypeIcon,
  Settings,
  Scissors,
  Copy,
  ClipboardPaste,
  MousePointer2,
} from 'lucide-react'
import { debounce } from '../lib/utils'
import { formatShortcut } from '../lib/shortcuts'
import { useUIStore } from '../store'
import { useEditorSettings } from './EditorSettingsModal'
import { DEFAULT_EDITOR_FONT, EDITOR_FONT_GROUPS } from '../lib/editorFonts'
import toast from 'react-hot-toast'
import {
  getFocusable,
  Menu,
  MenuItem,
  MenuSeparator,
  useAnchoredPosition,
  useEscapeKey,
} from './ui'

const lowlight = createLowlight(common)

const NoteAwareLink = Link.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      'data-note-id': {
        default: null,
        parseHTML: (element) => element.getAttribute('data-note-id'),
        renderHTML: (attributes) => (
          attributes['data-note-id']
            ? { 'data-note-id': attributes['data-note-id'] }
            : {}
        ),
      },
    }
  },
})

const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() {
    return {
      types: ['textStyle'],
    }
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: element => element.style.fontSize?.replace(/['"]+/g, ''),
            renderHTML: attributes => {
              if (!attributes.fontSize) {
                return {}
              }
              return {
                style: `font-size: ${attributes.fontSize}`,
              }
            },
          },
        },
      },
    ]
  },
  addCommands() {
    return {
      setFontSize: fontSize => ({ chain }) => {
        return chain()
          .setMark('textStyle', { fontSize })
          .run()
      },
      unsetFontSize: () => ({ chain }) => {
        return chain()
          .setMark('textStyle', { fontSize: null })
          .removeEmptyTextStyle()
          .run()
      },
    }
  },
})

const LineHeight = Extension.create({
  name: 'lineHeight',
  addOptions() {
    return {
      types: ['paragraph', 'heading'],
      defaultLineHeight: '1.5',
    }
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          lineHeight: {
            default: this.options.defaultLineHeight,
            parseHTML: element => element.style.lineHeight || this.options.defaultLineHeight,
            renderHTML: attributes => {
              if (!attributes.lineHeight || attributes.lineHeight === this.options.defaultLineHeight) {
                return {}
              }
              return {
                style: `line-height: ${attributes.lineHeight}`,
              }
            },
          },
        },
      },
    ]
  },
  addCommands() {
    return {
      setLineHeight: lineHeight => ({ commands }) => {
        return this.options.types.every(type => commands.updateAttributes(type, { lineHeight }))
      },
      unsetLineHeight: () => ({ commands }) => {
        return this.options.types.every(type => commands.resetAttributes(type, 'lineHeight'))
      },
    }
  },
})

const TextIndent = Extension.create({
  name: 'textIndent',
  addOptions() {
    return {
      types: ['paragraph'],
      defaultIndent: '0px',
      indentSize: '40px',
    }
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          textIndent: {
            default: this.options.defaultIndent,
            parseHTML: element => element.style.textIndent || this.options.defaultIndent,
            renderHTML: attributes => {
              if (!attributes.textIndent || attributes.textIndent === this.options.defaultIndent) {
                return {}
              }
              return {
                style: `text-indent: ${attributes.textIndent}`,
              }
            },
          },
        },
      },
    ]
  },
  addCommands() {
    return {
      indent: () => ({ commands, state }) => {
        const { from, to } = state.selection
        const nodes = []

        state.doc.nodesBetween(from, to, (node, pos) => {
          if (this.options.types.includes(node.type.name)) {
            nodes.push({ node, pos })
          }
        })

        if (nodes.length === 0) return false

        return commands.updateAttributes('paragraph', {
          textIndent: this.options.indentSize
        })
      },
      outdent: () => ({ commands, state }) => {
        const { from, to } = state.selection
        const nodes = []

        state.doc.nodesBetween(from, to, (node, pos) => {
          if (this.options.types.includes(node.type.name)) {
            nodes.push({ node, pos })
          }
        })

        if (nodes.length === 0) return false

        return commands.updateAttributes('paragraph', {
          textIndent: this.options.defaultIndent
        })
      },
    }
  },
})

const LetterSpacing = Extension.create({
  name: 'letterSpacing',
  addOptions() {
    return {
      types: ['textStyle'],
      defaultSpacing: 'normal',
    }
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          letterSpacing: {
            default: this.options.defaultSpacing,
            parseHTML: element => element.style.letterSpacing || this.options.defaultSpacing,
            renderHTML: attributes => {
              if (!attributes.letterSpacing || attributes.letterSpacing === this.options.defaultSpacing) {
                return {}
              }
              return {
                style: `letter-spacing: ${attributes.letterSpacing}`,
              }
            },
          },
        },
      },
    ]
  },
  addCommands() {
    return {
      setLetterSpacing: letterSpacing => ({ chain }) => {
        return chain()
          .setMark('textStyle', { letterSpacing })
          .run()
      },
      unsetLetterSpacing: () => ({ chain }) => {
        return chain()
          .setMark('textStyle', { letterSpacing: null })
          .removeEmptyTextStyle()
          .run()
      },
    }
  },
})

const DropCap = Extension.create({
  name: 'dropCap',
  addOptions() {
    return {
      types: ['paragraph'],
    }
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          dropCap: {
            default: false,
            parseHTML: element => element.hasAttribute('data-drop-cap'),
            renderHTML: attributes => {
              if (!attributes.dropCap) {
                return {}
              }
              return {
                'data-drop-cap': '',
                class: 'drop-cap',
              }
            },
          },
        },
      },
    ]
  },
  addCommands() {
    return {
      setDropCap: () => ({ commands }) => {
        return commands.updateAttributes('paragraph', { dropCap: true })
      },
      unsetDropCap: () => ({ commands }) => {
        return commands.updateAttributes('paragraph', { dropCap: false })
      },
    }
  },
})

export const paperStyles = {
  plain: {
    name: 'Plain',
    className: 'paper-plain',
    style: {},
    preview: { backgroundColor: '#ffffff', border: '1px solid #e5e7eb' },
  },
  lined: {
    name: 'Lined',
    className: 'paper-lined',
    style: {
      backgroundImage: 'repeating-linear-gradient(transparent, transparent 31px, #e5e7eb 31px, #e5e7eb 32px)',
      backgroundSize: '100% 32px',
      backgroundAttachment: 'local',
      lineHeight: '32px',
    },
    preview: { backgroundImage: 'repeating-linear-gradient(transparent, transparent 3px, #d1d5db 3px, #d1d5db 4px)', backgroundSize: '100% 4px' },
  },
  linedMargin: {
    name: 'Lined + Margin',
    className: 'paper-lined-margin',
    style: {
      backgroundImage: `
        linear-gradient(90deg, transparent 60px, #ef4444 60px, #ef4444 62px, transparent 62px),
        repeating-linear-gradient(transparent, transparent 31px, #e5e7eb 31px, #e5e7eb 32px)
      `,
      backgroundSize: '100% 32px',
      backgroundAttachment: 'local',
      lineHeight: '32px',
      paddingLeft: '70px',
    },
    preview: { backgroundImage: 'linear-gradient(90deg, transparent 4px, #ef4444 4px, #ef4444 5px, transparent 5px), repeating-linear-gradient(transparent, transparent 3px, #d1d5db 3px, #d1d5db 4px)', backgroundSize: '100% 4px' },
  },
  college: {
    name: 'College Rule',
    className: 'paper-college',
    style: {
      backgroundImage: `
        linear-gradient(90deg, transparent 40px, #3b82f6 40px, #3b82f6 42px, transparent 42px),
        repeating-linear-gradient(transparent, transparent 27px, #93c5fd 27px, #93c5fd 28px)
      `,
      backgroundSize: '100% 28px',
      backgroundAttachment: 'local',
      lineHeight: '28px',
      paddingLeft: '50px',
    },
    preview: { backgroundImage: 'linear-gradient(90deg, transparent 4px, #3b82f6 4px, #3b82f6 5px, transparent 5px), repeating-linear-gradient(transparent, transparent 3px, #93c5fd 3px, #93c5fd 4px)', backgroundSize: '100% 4px' },
  },
  grid: {
    name: 'Grid',
    className: 'paper-grid',
    style: {
      backgroundImage: `linear-gradient(#e5e7eb 1px, transparent 1px), linear-gradient(90deg, #e5e7eb 1px, transparent 1px)`,
      backgroundSize: '24px 24px',
      backgroundAttachment: 'local',
    },
    preview: { backgroundImage: 'linear-gradient(#d1d5db 1px, transparent 1px), linear-gradient(90deg, #d1d5db 1px, transparent 1px)', backgroundSize: '5px 5px' },
  },
  gridSmall: {
    name: 'Grid (Small)',
    className: 'paper-grid-small',
    style: {
      backgroundImage: `linear-gradient(#e5e7eb 1px, transparent 1px), linear-gradient(90deg, #e5e7eb 1px, transparent 1px)`,
      backgroundSize: '12px 12px',
      backgroundAttachment: 'local',
    },
    preview: { backgroundImage: 'linear-gradient(#d1d5db 1px, transparent 1px), linear-gradient(90deg, #d1d5db 1px, transparent 1px)', backgroundSize: '3px 3px' },
  },
  dotted: {
    name: 'Dotted',
    className: 'paper-dotted',
    style: {
      backgroundImage: 'radial-gradient(circle, #d1d5db 1px, transparent 1px)',
      backgroundSize: '24px 24px',
      backgroundAttachment: 'local',
    },
    preview: { backgroundImage: 'radial-gradient(circle, #9ca3af 1px, transparent 1px)', backgroundSize: '5px 5px' },
  },
  dottedDense: {
    name: 'Dotted (Dense)',
    className: 'paper-dotted-dense',
    style: {
      backgroundImage: 'radial-gradient(circle, #d1d5db 1.5px, transparent 1.5px)',
      backgroundSize: '16px 16px',
      backgroundAttachment: 'local',
    },
    preview: { backgroundImage: 'radial-gradient(circle, #9ca3af 1px, transparent 1px)', backgroundSize: '3px 3px' },
  },
  sepia: {
    name: 'Sepia',
    className: 'paper-sepia',
    style: {
      backgroundColor: '#fef3c7',
      backgroundImage: 'repeating-linear-gradient(transparent, transparent 31px, #fde68a 31px, #fde68a 32px)',
      backgroundSize: '100% 32px',
      backgroundAttachment: 'local',
      lineHeight: '32px',
    },
    preview: { backgroundColor: '#fef3c7' },
  },
  blueprint: {
    name: 'Blueprint',
    className: 'paper-blueprint',
    style: {
      backgroundColor: '#1e3a5f',
      backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
      backgroundSize: '24px 24px',
      backgroundAttachment: 'local',
      color: '#e0e7ff',
    },
    preview: { backgroundColor: '#1e3a5f', backgroundImage: 'linear-gradient(rgba(255,255,255,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.2) 1px, transparent 1px)', backgroundSize: '5px 5px' },
  },
  dark: {
    name: 'Dark',
    className: 'paper-dark',
    style: {
      backgroundColor: '#1f2937',
      color: '#e5e7eb',
    },
    preview: { backgroundColor: '#1f2937' },
  },
  darkLined: {
    name: 'Dark Lined',
    className: 'paper-dark-lined',
    style: {
      backgroundColor: '#1f2937',
      backgroundImage: 'repeating-linear-gradient(transparent, transparent 31px, #374151 31px, #374151 32px)',
      backgroundSize: '100% 32px',
      backgroundAttachment: 'local',
      lineHeight: '32px',
      color: '#e5e7eb',
    },
    preview: { backgroundColor: '#1f2937', backgroundImage: 'repeating-linear-gradient(transparent, transparent 3px, #4b5563 3px, #4b5563 4px)', backgroundSize: '100% 4px' },
  },
}

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

// Realistic cm/mm ruler component that fills the editor width
function EditorRuler({ containerRef }) {
  const [cmCount, setCmCount] = useState(40)

  useEffect(() => {
    const updateWidth = () => {
      const el = containerRef?.current
      if (el) {
        const widthPx = el.clientWidth - 32 // subtract padding
        // 1cm ≈ 37.8px at 96dpi
        const cms = Math.ceil(widthPx / 37.8) + 1
        setCmCount(cms)
      }
    }
    updateWidth()
    window.addEventListener('resize', updateWidth)
    return () => window.removeEventListener('resize', updateWidth)
  }, [containerRef])

  // Build tick marks: 10 mm per cm
  const ticks = []
  for (let cm = 0; cm < cmCount; cm++) {
    for (let mm = 0; mm < 10; mm++) {
      const isCm = mm === 0
      const isHalf = mm === 5
      if (isCm) {
        ticks.push(
          <div key={`${cm}-${mm}`} className="editor-ruler-tick editor-ruler-tick--cm">
            {cm > 0 && <span className="editor-ruler-number">{cm}</span>}
          </div>
        )
      } else if (isHalf) {
        ticks.push(
          <div key={`${cm}-${mm}`} className="editor-ruler-tick editor-ruler-tick--half" />
        )
      } else {
        ticks.push(
          <div key={`${cm}-${mm}`} className="editor-ruler-tick editor-ruler-tick--mm" />
        )
      }
    }
  }

  return (
    <div className="editor-ruler" aria-hidden="true">
      <div className="editor-ruler-inner">
        {ticks}
      </div>
    </div>
  )
}

// Vertical cm/mm ruler component on the left side of the editor
function VerticalEditorRuler({ containerRef }) {
  const [cmCount, setCmCount] = useState(60)

  useEffect(() => {
    const updateHeight = () => {
      const el = containerRef?.current
      if (el) {
        const heightPx = el.scrollHeight || el.clientHeight
        const cms = Math.ceil(heightPx / 37.8) + 1
        setCmCount(cms)
      }
    }
    updateHeight()
    const observer = new ResizeObserver(updateHeight)
    if (containerRef?.current) observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [containerRef])

  const ticks = []
  for (let cm = 0; cm < cmCount; cm++) {
    for (let mm = 0; mm < 10; mm++) {
      const isCm = mm === 0
      const isHalf = mm === 5
      if (isCm) {
        ticks.push(
          <div key={`${cm}-${mm}`} className="editor-vruler-tick editor-vruler-tick--cm">
            {cm > 0 && <span className="editor-vruler-number">{cm}</span>}
          </div>
        )
      } else if (isHalf) {
        ticks.push(
          <div key={`${cm}-${mm}`} className="editor-vruler-tick editor-vruler-tick--half" />
        )
      } else {
        ticks.push(
          <div key={`${cm}-${mm}`} className="editor-vruler-tick editor-vruler-tick--mm" />
        )
      }
    }
  }

  return (
    <div className="editor-vruler" aria-hidden="true">
      <div className="editor-vruler-inner">
        {ticks}
      </div>
    </div>
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
  isExternalUpdate = false,
  readOnly = false,
}) {
  const [currentPaper, setCurrentPaper] = useState(paperType)
  const [typingEpoch, setTypingEpoch] = useState(0)
  const [mobileToolbarOpen, setMobileToolbarOpen] = useState(false)
  const [editorMenuPoint, setEditorMenuPoint] = useState(null)
  const editorContainerRef = useRef(null)
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

  useEffect(() => {
    onChangeRef.current = onChange
    onDraftChangeRef.current = onDraftChange
  }, [onChange, onDraftChange])

  const generateContentHash = (html) => {
    if (!html) return ''
    return html.substring(0, 100) + html.length
  }

  useEffect(() => {
    setMobileToolbarOpen(false)
    isUserTyping.current = false
    isInternalUpdate.current = false
    lastSentContent.current = null
    lastKnownContent.current = null
    lastContentHash.current = ''
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }
    if (editor && !editor.isDestroyed) {
      editor.commands.setContent(content || '', false)
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
    editable: !readOnly,
    extensions: [
      StarterKit.configure({
        codeBlock: false,
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
          class: 'text-emerald-600 underline cursor-pointer',
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
      TaskItem.configure({
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
      TextIndent,
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
      TextBoxExtension,
      InvisibleCharactersExtension,
    ],
    content: content || '',
    onUpdate: ({ editor }) => {
      markUserTyping()
      isInternalUpdate.current = true
      lastKnownContent.current = editor.getHTML()
      onDraftChangeRef.current?.(lastKnownContent.current)
      lastCursorPosition.current = {
        from: editor.state.selection.from,
        to: editor.state.selection.to
      }
      debouncedOnChange(editor.getHTML())
    },
    onSelectionUpdate: ({ editor }) => {
      lastCursorPosition.current = {
        from: editor.state.selection.from,
        to: editor.state.selection.to
      }
    },
    editorProps: {
      attributes: {
        class: 'prose prose-lg dark:prose-invert max-w-none focus:outline-none min-h-[300px] px-4 py-2',
        spellcheck: useUIStore.getState().spellCheck ? 'true' : 'false',
        role: 'textbox',
        'aria-label': 'Note content',
        'aria-multiline': 'true',
      },
      handleKeyDown: (view, event) => {
        if (event.key === 'Tab') {
          let command = null
          if (event.shiftKey) {
            if (editor.can().liftListItem('listItem')) {
              command = () => editor.chain().focus().liftListItem('listItem').run()
            }
          } else {
            if (editor.can().sinkListItem('listItem')) {
              command = () => editor.chain().focus().sinkListItem('listItem').run()
            }
          }

          if (!command) return false
          event.preventDefault()
          command()
          return true
        }
        
        return false
      },
    },
  })

  useEffect(() => {
    if (editor && onEditorReady) {
      onEditorReady(editor)
    }
  }, [editor, onEditorReady])

  useEffect(() => {
    if (editor && !editor.isDestroyed) editor.setEditable(!readOnly)
  }, [editor, readOnly])

  useEffect(() => {
    const applySpellCheck = () => {
      if (editor && !editor.isDestroyed) {
        const el = editor.view.dom
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
    const el = editor.view.dom
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
    if (!editor) return
    
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
    
    editor.commands.setContent(content || '', false)
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
    <div className="relative flex h-full flex-col">
      {!readOnly && (
        <div className={`${mobileToolbarOpen ? 'block' : 'hidden'} shrink-0 md:block`}>
          <EditorToolbar
            editor={editor}
            currentPaper={currentPaper}
            onPaperChange={handlePaperChange}
            content={content}
            onMobileClose={() => setMobileToolbarOpen(false)}
          />
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
        className="bg-surface-raised shadow-xl rounded-lg border border-subtle flex items-center p-1 gap-0.5"
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

      {!readOnly && <FloatingMenu
        editor={editor}
        tippyOptions={{ duration: 100, aria: { expanded: false, content: 'describedby' } }}
        shouldShow={({ state }) => state.selection.empty && state.doc.textContent.length === 0}
        className="bg-surface-raised shadow-xl rounded-lg border border-subtle flex items-center p-1 gap-0.5"
      >
        <BubbleButton label="Heading 1" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
          <Heading1 className="w-4 h-4" />
        </BubbleButton>
        <BubbleButton label="Heading 2" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          <Heading2 className="w-4 h-4" />
        </BubbleButton>
        <BubbleButton label="Bullet list" onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <List className="w-4 h-4" />
        </BubbleButton>
        <BubbleButton label="Checklist" onClick={() => editor.chain().focus().toggleTaskList().run()}>
          <CheckSquare className="w-4 h-4" />
        </BubbleButton>
        <BubbleButton label="Quote" onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          <Quote className="w-4 h-4" />
        </BubbleButton>
        <BubbleButton label="Insert table" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
          <TableIcon className="w-4 h-4" />
        </BubbleButton>
      </FloatingMenu>}

      {!readOnly && <TableBubbleMenu editor={editor} />}

      {editorSettings.showRuler && (
        <div className="flex">
          <div className="editor-ruler-corner" aria-hidden="true" />
          <EditorRuler containerRef={editorContainerRef} />
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {editorSettings.showRuler && (
          <VerticalEditorRuler containerRef={editorContainerRef} />
        )}
        <div 
          ref={editorContainerRef}
          data-editor-canvas
          onContextMenu={(event) => {
            event.preventDefault()
            event.stopPropagation()
            setEditorMenuPoint({ x: event.clientX, y: event.clientY })
          }}
          className={`relative flex-1 overflow-y-auto bg-surface-raised ${paperStyle.className || ''}`}
          style={paperStyle.style}
        >
          <EditorContent editor={editor} />
        </div>
      </div>

      {!readOnly && !mobileToolbarOpen && (
        <button
          type="button"
          aria-label="Show formatting tools"
          aria-controls="qn-editor-toolbar"
          aria-expanded="false"
          onClick={() => setMobileToolbarOpen(true)}
          className="qn-square-control absolute bottom-3 right-3 z-popover hidden items-center justify-center rounded-full border border-strong bg-surface-raised text-content shadow-lg transition-colors hover:bg-surface-hover max-md:flex"
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
          className="qn-editor-tooltip fixed z-[99999] whitespace-nowrap rounded-lg border border-strong bg-[var(--qn-text)] px-2.5 py-1.5 text-xs text-content-inverted shadow-lg pointer-events-none"
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
      className="fixed z-[99999] overflow-y-auto overscroll-contain rounded-2xl border border-subtle bg-surface-raised p-1 shadow-xl shadow-black/5 backdrop-blur-xl dark:shadow-black/20"
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
        className="p-2 text-content-muted transition-all duration-150 rounded-lg hover:bg-surface-hover dark:text-content-subtle hover:text-content dark:hover:text-white"
      >
        <ImageIcon className="w-4 h-4" />
      </button>
    </PortalTooltip>
  )
}

function EditorToolbar({ editor, currentPaper, onPaperChange, content, onMobileClose }) {
  const { t } = useTranslation()
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

  const letterSpacingRef = useRef(null)
  
  const toolbarRef = useRef(null)
  const rovingButtonRef = useRef(null)

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
              id: `heading-${extractedHeadings.length}`,
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

  const scrollToHeading = useCallback((headingIndex) => {
    if (!editor) return
    
    const editorElement = editor.view.dom
    const headingElements = editorElement.querySelectorAll('h1, h2, h3, h4, h5, h6')
    
    if (headingElements[headingIndex]) {
      headingElements[headingIndex].scrollIntoView({ behavior: 'smooth', block: 'start' })
      const pos = editor.view.posAtDOM(headingElements[headingIndex], 0)
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

  const ToolbarButton = ({ onClick, isActive, disabled, children, title, shortcut }) => {
    const buttonRef = useRef(null)
    const activate = () => {
      closeAllDropdowns()
      if (!disabled) onClick?.()
    }
    
    const button = (
      <button
        type="button"
        ref={buttonRef}
        onMouseDown={(e) => {
          e.preventDefault()
          e.stopPropagation()
        }}
        onClick={activate}
        disabled={disabled}
        aria-pressed={isActive || undefined}
        aria-label={title}
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-control transition-colors duration-fast ${
 isActive
 ? 'bg-accent-soft text-accent-text'
            : 'text-content-muted hover:bg-surface-hover hover:text-content'
        } ${disabled ? 'cursor-not-allowed opacity-40' : ''}`}
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

  const ToolbarDivider = () => (
    <div role="separator" aria-orientation="vertical" className="mx-1 h-5 w-px shrink-0 bg-[var(--qn-border-subtle)]" />
  )

  const DropdownButton = ({ children, isOpen, onClick, title, disabled }) => {
    const buttonRef = useRef(null)
    
    const button = (
      <button
        type="button"
        ref={buttonRef}
        disabled={disabled}
        aria-label={title}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        onMouseDown={(e) => {
          e.preventDefault()
          e.stopPropagation()
        }}
        onClick={() => {
          if (!disabled) onClick?.()
        }}
        className={`p-1.5 rounded-lg transition-all duration-150 flex items-center gap-1 ${
 disabled
 ? 'opacity-30 cursor-not-allowed text-content-subtle dark:text-content-muted'
            : isOpen
              ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 shadow-sm'
              : 'hover:bg-surface-hover text-content-muted hover:text-content dark:hover:text-content-subtle'
        }`}
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

  return (
    <div
      id="qn-editor-toolbar"
      ref={toolbarRef}
      role="toolbar"
      aria-label="Text formatting"
      onFocusCapture={handleToolbarFocus}
      onKeyDown={handleToolbarKeyDown}
      className="editor-toolbar flex flex-nowrap items-center gap-0.5 overflow-x-auto overflow-y-hidden overscroll-x-contain border-b border-subtle bg-surface px-2 py-1.5 sm:px-3 md:flex-wrap md:overflow-visible md:overscroll-auto"
    >
      <button
        type="button"
        onClick={onMobileClose}
        aria-label="Hide formatting tools"
        className="qn-square-control flex h-8 w-8 shrink-0 items-center justify-center rounded-control text-content-muted transition-colors hover:bg-surface-hover hover:text-content md:hidden"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
      <div role="separator" aria-orientation="vertical" className="qn-toolbar-sep mx-1 w-px shrink-0 bg-[var(--qn-border-subtle)] md:hidden" />
      <ToolbarButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo" shortcut={shortcut('z')}>
        <Undo className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo" shortcut={shortcut('y')}>
        <Redo className="w-4 h-4" />
      </ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton 
        onClick={formatPainterActive ? () => { setFormatPainterActive(false); setCopiedFormat(null) } : copyFormat}
        isActive={formatPainterActive}
        title={formatPainterActive ? "Cancel Format Painter (Esc)" : "Format Painter - Copy formatting"}
      >
        <Paintbrush className={`w-4 h-4 ${formatPainterActive ? 'text-emerald-600 animate-pulse' : ''}`} />
      </ToolbarButton>

      <ToolbarButton 
        onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
        title="Clear Formatting"
      >
        <RemoveFormatting className="w-4 h-4" />
      </ToolbarButton>

      <ToolbarDivider />

      <div className="relative" ref={fontPickerRef}>
        <DropdownButton isOpen={showFontPicker} onClick={() => toggleDropdown(setShowFontPicker, showFontPicker)} title="Font">
          <Type className="w-4 h-4" />
        </DropdownButton>
        <PortalDropdown
          isOpen={showFontPicker}
          anchorRef={fontPickerRef}
          onClose={() => setShowFontPicker(false)}
          label="Font families"
        >
          <div className="max-h-[min(26rem,70vh)] w-[240px] overflow-y-auto py-1.5">
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
        <DropdownButton isOpen={showFontSizePicker} onClick={() => toggleDropdown(setShowFontSizePicker, showFontSizePicker)} title="Font Size">
          <CaseSensitive className="w-4 h-4" />
        </DropdownButton>
        <PortalDropdown isOpen={showFontSizePicker} anchorRef={fontSizePickerRef} onClose={() => setShowFontSizePicker(false)}>
          <div className="py-1.5 w-[100px] max-h-[300px] overflow-y-auto">
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
 isActive ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 font-medium' : 'text-content-muted'
 }`}
                >
                  {size.name}px
                </button>
              )
            })}
          </div>
        </PortalDropdown>
      </div>

      <div className="relative" ref={lineHeightPickerRef}>
        <DropdownButton isOpen={showLineHeightPicker} onClick={() => toggleDropdown(setShowLineHeightPicker, showLineHeightPicker)} title="Line Height">
          <MoveVertical className="w-4 h-4" />
        </DropdownButton>
        <PortalDropdown isOpen={showLineHeightPicker} anchorRef={lineHeightPickerRef} onClose={() => setShowLineHeightPicker(false)}>
          <div className="py-1.5 w-[100px]">
            {lineHeights.map((lh) => {
              const isActive = editor.isActive('paragraph', { lineHeight: lh.value })
              return (
                <button
                  key={lh.name}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    editor.chain().focus().setLineHeight(lh.value).run()
                    setShowLineHeightPicker(false)
                  }}
                  className={`w-full px-3 py-1.5 text-left text-[13px] hover:bg-surface-hover rounded-lg transition-colors ${
 isActive ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 font-medium' : 'text-content-muted'
 }`}
                >
                  {lh.name}
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
          <span className="min-w-[74px] whitespace-nowrap text-left text-ui-md font-medium">
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
 isActive ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : 'text-content-muted'
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
          <div className="min-w-[280px] p-3 sm:p-4">
            <div className="grid grid-cols-6 gap-0.5 sm:grid-cols-8 sm:gap-2">
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
                    className={`qn-format-colour h-7 w-7 rounded-lg border-2 hover:scale-110 transition-all shadow-sm flex items-center justify-center ${
 isActive 
 ? 'border-emerald-500 ring-2 ring-emerald-200 dark:ring-emerald-800' 
                        : 'border-subtle  hover:border-emerald-500'
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
              <div className="flex gap-2">
                <input
                  type="color"
                  aria-label="Choose custom text color"
                  value={customColor}
                  onChange={(e) => setCustomColor(e.target.value)}
                  className="qn-format-colour h-8 w-10 cursor-pointer rounded border border-subtle"
                />
                <input
                  type="text"
                  aria-label="Custom text color value"
                  value={customColor}
                  onChange={(e) => setCustomColor(e.target.value)}
                  className="flex-1 px-2 py-1 text-xs text-content bg-white border border-subtle rounded dark:bg-surface-sunken dark:text-white"
                  placeholder="#000000"
                />
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    editor.chain().focus().setColor(customColor).run()
                    setShowColorPicker(false)
                  }}
                  className="qn-touch-target rounded bg-accent px-3 py-1 text-xs text-accent-on hover:bg-accent-hover"
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
          <div className="min-w-[280px] p-3 sm:p-4">
            <div className="grid grid-cols-6 gap-0.5 sm:grid-cols-8 sm:gap-2">
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
                    className={`qn-format-colour h-7 w-7 rounded-lg border-2 hover:scale-110 transition-all shadow-sm flex items-center justify-center ${
 isActive 
 ? 'border-emerald-500 ring-2 ring-emerald-200 dark:ring-emerald-800' 
                        : 'border-subtle  hover:border-emerald-500'
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
              <div className="flex gap-2">
                <input
                  type="color"
                  aria-label="Choose custom highlight color"
                  value={customHighlight}
                  onChange={(e) => setCustomHighlight(e.target.value)}
                  className="qn-format-colour h-8 w-10 cursor-pointer rounded border border-subtle"
                />
                <input
                  type="text"
                  aria-label="Custom highlight color value"
                  value={customHighlight}
                  onChange={(e) => setCustomHighlight(e.target.value)}
                  className="flex-1 px-2 py-1 text-xs text-content bg-white border border-subtle rounded dark:bg-surface-sunken dark:text-white"
                  placeholder="#fef08a"
                />
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    editor.chain().focus().toggleHighlight({ color: customHighlight }).run()
                    setShowHighlightPicker(false)
                  }}
                  className="qn-touch-target rounded bg-accent px-3 py-1 text-xs text-accent-on hover:bg-accent-hover"
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

      <ToolbarDivider />

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

      <ToolbarDivider />

      <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive('bulletList')} title="Bullet List">
        <List className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive('orderedList')} title="Numbered List">
        <ListOrdered className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleTaskList().run()} isActive={editor.isActive('taskList')} title="Checklist">
        <CheckSquare className="w-4 h-4" />
      </ToolbarButton>

      <ToolbarButton 
        onClick={() => {
          if (editor.can().sinkListItem('listItem')) {
            editor.chain().focus().sinkListItem('listItem').run()
          } else {
            editor.chain().focus().indent().run()
          }
        }} 
        disabled={!editor.can().sinkListItem('listItem') && !editor.can().indent()}
        title="Increase Indent"
      >
        <Indent className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton 
        onClick={() => {
          if (editor.can().liftListItem('listItem')) {
            editor.chain().focus().liftListItem('listItem').run()
          } else {
            editor.chain().focus().outdent().run()
          }
        }} 
        disabled={!editor.can().liftListItem('listItem') && !editor.can().outdent()}
        title="Decrease Indent"
      >
        <Outdent className="w-4 h-4" />
      </ToolbarButton>

      <ToolbarDivider />

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
 isActive ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 font-medium' : 'text-content-muted'
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

      <ToolbarDivider />

      <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} isActive={editor.isActive('blockquote')} title="Quote">
        <Quote className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleCodeBlock().run()} isActive={editor.isActive('codeBlock')} title="Code Block">
        <FileCode className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal Line">
        <Minus className="w-4 h-4" />
      </ToolbarButton>

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

      <ToolbarDivider />

      <ToolbarButton onClick={setLink} isActive={editor.isActive('link')} title={`Insert Link (${shortcut('k', { shift: true })})`}>
        <LinkIcon className="w-4 h-4" />
      </ToolbarButton>

      <ToolbarButton onClick={openTranslation} title="Translate selected text or note">
        <Languages className="w-4 h-4" />
      </ToolbarButton>

      <ImageToolbarButton />

      <ToolbarButton 
        onClick={() => editor.chain().focus().insertTextBox().run()} 
        isActive={editor.isActive('textBox')} 
        title="Text Box"
      >
        <Square className="w-4 h-4" />
      </ToolbarButton>

      <div className="relative" ref={tocRef}>
        <DropdownButton 
          isOpen={showTableOfContents} 
          onClick={() => toggleDropdown(setShowTableOfContents, showTableOfContents)} 
          title="Table of Contents"
          disabled={headings.length === 0}
        >
          <ListTree className="w-4 h-4" />
        </DropdownButton>
        <PortalDropdown isOpen={showTableOfContents} anchorRef={tocRef} onClose={() => setShowTableOfContents(false)}>
          <div className="py-1.5 min-w-[220px] max-w-[320px] max-h-[400px] overflow-y-auto">
            <p className="px-3 py-2 text-[10px] font-bold tracking-[0.12em] uppercase text-content-subtle border-b border-subtle">
              Table of Contents
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
                    scrollToHeading(index)
                  }}
                  className="w-full px-3 py-2 text-left text-[13px] hover:bg-surface-hover flex items-center gap-2 rounded-lg transition-colors text-content-muted"
                  style={{ paddingLeft: `${(heading.level - 1) * 12 + 12}px` }}
                >
                  <span className={`flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold ${
 heading.level === 1 
 ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' 
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

      <div className="relative ml-auto" ref={paperPickerRef}>
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
 currentPaper === key ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 font-medium' : 'text-content-muted'
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

      <ToolbarButton 
        onClick={() => useUIStore.getState().setHTMLEditorOpen(true)}
        title="Edit HTML Source"
      >
        <FileCode className="w-4 h-4" />
      </ToolbarButton>

      <ToolbarButton 
        onClick={() => useUIStore.getState().setEditorSettingsOpen(true)}
        title="Editor Settings"
      >
        <Settings className="w-4 h-4" />
      </ToolbarButton>
    </div>
  )
}
