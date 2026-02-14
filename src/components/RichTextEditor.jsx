import React, { useEffect, useCallback, useState, useRef } from 'react'
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
import { Extension, Node, mergeAttributes } from '@tiptap/core'
import ResizableImageExtension from './ResizableImageExtension'
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
  Copy,
  Scissors,
  Clipboard,
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
  Settings
} from 'lucide-react'
import { debounce } from '../lib/utils'
import { useUIStore } from '../store'
import { useEditorSettings } from './EditorSettingsModal'

const lowlight = createLowlight(common)

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

const TextBox = Node.create({
  name: 'textBox',
  group: 'block',
  content: 'block+',
  defining: true,
  
  parseHTML() {
    return [{ tag: 'div[data-type="textBox"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'textBox',
        class: 'text-box',
        style: 'border: 2px solid #e5e7eb; background-color: #f9fafb; padding: 16px; border-radius: 8px; margin: 8px 0;',
      }),
      0,
    ]
  },

  addCommands() {
    return {
      insertTextBox: () => ({ commands }) => {
        return commands.insertContent({
          type: this.name,
          content: [{ type: 'paragraph' }],
        })
      },
    }
  },
})

export const paperStyles = {
  plain: {
    name: 'Plain',
    className: '',
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

const fontFamilies = [
  { name: 'Default', value: 'Inter, system-ui, sans-serif' },
  { name: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { name: 'Helvetica', value: 'Helvetica, sans-serif' },
  { name: 'Times New Roman', value: 'Times New Roman, serif' },
  { name: 'Georgia', value: 'Georgia, serif' },
  { name: 'Verdana', value: 'Verdana, sans-serif' },
  { name: 'Trebuchet MS', value: 'Trebuchet MS, sans-serif' },
  { name: 'Courier New', value: 'Courier New, monospace' },
  { name: 'Comic Sans MS', value: 'Comic Sans MS, cursive' },
  { name: 'Impact', value: 'Impact, sans-serif' },
  { name: 'Lucida Console', value: 'Lucida Console, monospace' },
  { name: 'Lucida Sans Unicode', value: 'Lucida Sans Unicode, sans-serif' },
  { name: 'Palatino Linotype', value: 'Palatino Linotype, serif' },
  { name: 'Book Antiqua', value: 'Book Antiqua, serif' },
  { name: 'MS Sans Serif', value: 'MS Sans Serif, sans-serif' },
  { name: 'MS Serif', value: 'MS Serif, serif' },

  { name: 'Calibri', value: 'Calibri, sans-serif' },
  { name: 'Cambria', value: 'Cambria, serif' },
  { name: 'Segoe UI', value: 'Segoe UI, sans-serif' },
  { name: 'Segoe Print', value: 'Segoe Print, sans-serif' },
  { name: 'Segoe Script', value: 'Segoe Script, cursive' },

  { name: 'Roboto', value: 'Roboto, sans-serif' },
  { name: 'Open Sans', value: 'Open Sans, sans-serif' },
  { name: 'Lato', value: 'Lato, sans-serif' },
  { name: 'Montserrat', value: 'Montserrat, sans-serif' },
  { name: 'Source Sans Pro', value: 'Source Sans Pro, sans-serif' },
  { name: 'Ubuntu', value: 'Ubuntu, sans-serif' },
  { name: 'Nunito', value: 'Nunito, sans-serif' },
  { name: 'Poppins', value: 'Poppins, sans-serif' },
  { name: 'Oswald', value: 'Oswald, sans-serif' },
  { name: 'Merriweather', value: 'Merriweather, serif' },
  { name: 'Playfair Display', value: 'Playfair Display, serif' },
  { name: 'Crimson Text', value: 'Crimson Text, serif' },
  { name: 'Libre Baskerville', value: 'Libre Baskerville, serif' },
  { name: 'PT Sans', value: 'PT Sans, sans-serif' },
  { name: 'PT Serif', value: 'PT Serif, serif' },
  { name: 'Fira Sans', value: 'Fira Sans, sans-serif' },
  { name: 'Fira Code', value: 'Fira Code, monospace' },
  { name: 'JetBrains Mono', value: 'JetBrains Mono, monospace' },
  { name: 'Inconsolata', value: 'Inconsolata, monospace' },
  { name: 'Space Mono', value: 'Space Mono, monospace' },

  { name: 'Garamond', value: 'Garamond, serif' },
  { name: 'Baskerville', value: 'Baskerville, serif' },
  { name: 'Didot', value: 'Didot, serif' },
  { name: 'Bodoni', value: 'Bodoni, serif' },
  { name: 'Futura', value: 'Futura, sans-serif' },
  { name: 'Gill Sans', value: 'Gill Sans, sans-serif' },
  { name: 'Franklin Gothic', value: 'Franklin Gothic, sans-serif' },
  { name: 'Rockwell', value: 'Rockwell, serif' },
  { name: 'Copperplate', value: 'Copperplate, serif' },

  { name: 'Avenir', value: 'Avenir, sans-serif' },
  { name: 'Proxima Nova', value: 'Proxima Nova, sans-serif' },
  { name: 'Brandon Grotesque', value: 'Brandon Grotesque, sans-serif' },
  { name: 'Akzidenz-Grotesk', value: 'Akzidenz-Grotesk, sans-serif' },
  { name: 'DIN', value: 'DIN, sans-serif' },
  { name: 'Univers', value: 'Univers, sans-serif' },

  { name: 'Papyrus', value: 'Papyrus, fantasy' },
  { name: 'Chiller', value: 'Chiller, cursive' },
  { name: 'Brush Script MT', value: 'Brush Script MT, cursive' },
  { name: 'Lucida Handwriting', value: 'Lucida Handwriting, cursive' },
]

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

export default function RichTextEditor({ noteId, content, onChange, placeholder, paperType = 'plain', onPaperTypeChange, onEditorReady, isExternalUpdate = false }) {
  const [showContextMenu, setShowContextMenu] = useState(false)
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 })
  const [currentPaper, setCurrentPaper] = useState(paperType)
  const contextMenuRef = useRef(null)
  const editorContainerRef = useRef(null)
  const isInternalUpdate = useRef(false)
  const lastKnownContent = useRef(content)
  const lastContentHash = useRef('')
  const debounceTimerRef = useRef(null)
  const isUserTyping = useRef(false)
  const typingTimeoutRef = useRef(null)
  const lastCursorPosition = useRef({ from: 0, to: 0 })
  const lastSentContent = useRef('')
  const editorSettings = useEditorSettings()

  const generateContentHash = (html) => {
    if (!html) return ''
    return html.substring(0, 100) + html.length
  }

  useEffect(() => {
    isUserTyping.current = false
    isInternalUpdate.current = false
    lastSentContent.current = null
    lastKnownContent.current = null
    lastContentHash.current = ''
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
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
    }, 2000)
  }, [])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
      }),
      Placeholder.configure({
        placeholder: placeholder || 'Start writing...',
      }),
      Link.configure({
        openOnClick: true,
        HTMLAttributes: {
          class: 'text-emerald-600 underline cursor-pointer',
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
      TextBox,
    ],
    content: content || '',
    onUpdate: ({ editor }) => {
      markUserTyping()
      isInternalUpdate.current = true
      lastKnownContent.current = editor.getHTML()
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
      },
      handleKeyDown: (view, event) => {
        markUserTyping()
        
        if (event.key === 'Tab') {
          event.preventDefault()
          
          if (event.shiftKey) {
            if (editor.can().liftListItem('listItem')) {
              editor.chain().focus().liftListItem('listItem').run()
            } else if (editor.can().outdent()) {
              editor.chain().focus().outdent().run()
            }
          } else {
            if (editor.can().sinkListItem('listItem')) {
              editor.chain().focus().sinkListItem('listItem').run()
            } else if (editor.can().indent()) {
              editor.chain().focus().indent().run()
            }
          }
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

  // Apply editor settings from EditorSettingsModal
  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    const el = editor.view.dom
    if (!el) return

    // Font family
    el.style.fontFamily = editorSettings.defaultFontFamily || 'Inter, system-ui, sans-serif'

    // Font size
    el.style.fontSize = editorSettings.defaultFontSize || '16px'

    // Line height
    el.style.lineHeight = editorSettings.defaultLineHeight || '1.5'

    // Tab size
    el.style.tabSize = editorSettings.tabSize || 4
    el.style.MozTabSize = editorSettings.tabSize || 4

    // Word wrap
    if (editorSettings.wordWrap) {
      el.style.overflowWrap = 'break-word'
      el.style.wordBreak = 'normal'
      el.style.whiteSpace = 'pre-wrap'
    } else {
      el.style.overflowWrap = 'normal'
      el.style.wordBreak = 'normal'
      el.style.whiteSpace = 'pre'
    }

    // Show invisibles (whitespace characters)
    if (editorSettings.showInvisibles) {
      el.classList.add('show-invisibles')
    } else {
      el.classList.remove('show-invisibles')
    }

    // Highlight current line
    if (editorSettings.highlightCurrentLine) {
      el.classList.add('highlight-current-line')
    } else {
      el.classList.remove('highlight-current-line')
    }

    // Spellcheck from editor settings
    el.setAttribute('spellcheck', editorSettings.spellCheck ? 'true' : 'false')

    // Autocorrect
    el.setAttribute('autocorrect', editorSettings.autoCorrect ? 'on' : 'off')

  }, [editor, editorSettings])

  const debouncedOnChange = useCallback(
    debounce((html) => {
      lastSentContent.current = html
      onChange?.(html)
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
      debounceTimerRef.current = setTimeout(() => {
        if (!isUserTyping.current) {
          isInternalUpdate.current = false
        }
      }, 1000)
    }, 300),
    [onChange]
  )

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
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
          } catch (e) {
          }
        })
      })
    }
  }, [content, editor, isExternalUpdate])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target)) {
        setShowContextMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    setCurrentPaper(paperType)
  }, [paperType])

  useEffect(() => {
    const handleInsertTranslation = (event) => {
      if (editor && event.detail?.translatedText) {
        if (event.detail.mode === 'selection') {
          editor.chain().focus().insertContent(event.detail.translatedText).run()
        } else {
          editor.commands.setContent(event.detail.translatedText)
        }
      }
    }
    
    window.addEventListener('insertTranslatedText', handleInsertTranslation)
    return () => window.removeEventListener('insertTranslatedText', handleInsertTranslation)
  }, [editor])

  const handlePaperChange = (type) => {
    setCurrentPaper(type)
    onPaperTypeChange?.(type)
  }

  if (!editor) {
    return null
  }

  const paperStyle = paperStyles[currentPaper] || paperStyles.plain

  return (
    <div className="flex flex-col h-full">
      <EditorToolbar editor={editor} currentPaper={currentPaper} onPaperChange={handlePaperChange} content={content} />
      
      <BubbleMenu 
        editor={editor} 
        tippyOptions={{ duration: 100 }}
        shouldShow={({ editor, state }) => {
          const { selection } = state
          const isImageSelected = selection.$from.parent.type.name === 'resizableImage' || 
                                   editor.isActive('resizableImage')
          if (isImageSelected) return false
          
          return !selection.empty
        }}
        className="bg-white dark:bg-gray-800 shadow-xl rounded-lg border border-[#cbd1db] dark:border-gray-700 flex items-center p-1 gap-0.5"
      >
        <BubbleButton onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive('bold')}>
          <Bold className="w-4 h-4" />
        </BubbleButton>
        <BubbleButton onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive('italic')}>
          <Italic className="w-4 h-4" />
        </BubbleButton>
        <BubbleButton onClick={() => editor.chain().focus().toggleUnderline().run()} isActive={editor.isActive('underline')}>
          <UnderlineIcon className="w-4 h-4" />
        </BubbleButton>
        <BubbleButton onClick={() => editor.chain().focus().toggleHighlight().run()} isActive={editor.isActive('highlight')}>
          <Highlighter className="w-4 h-4" />
        </BubbleButton>
        <BubbleButton onClick={() => editor.chain().focus().toggleStrike().run()} isActive={editor.isActive('strike')}>
          <Strikethrough className="w-4 h-4" />
        </BubbleButton>
        <div className="w-px h-5 mx-1 bg-gray-300 dark:bg-gray-600" />
        <BubbleButton onClick={() => {
            useUIStore.getState().setLinkModalOpen(true)
          }} isActive={editor.isActive('link')}>
          <LinkIcon className="w-4 h-4" />
        </BubbleButton>
      </BubbleMenu>

      <FloatingMenu
        editor={editor}
        tippyOptions={{ duration: 100 }}
        className="bg-white dark:bg-gray-800 shadow-xl rounded-lg border border-[#cbd1db] dark:border-gray-700 flex items-center p-1 gap-0.5"
      >
        <BubbleButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
          <Heading1 className="w-4 h-4" />
        </BubbleButton>
        <BubbleButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          <Heading2 className="w-4 h-4" />
        </BubbleButton>
        <BubbleButton onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <List className="w-4 h-4" />
        </BubbleButton>
        <BubbleButton onClick={() => editor.chain().focus().toggleTaskList().run()}>
          <CheckSquare className="w-4 h-4" />
        </BubbleButton>
        <BubbleButton onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          <Quote className="w-4 h-4" />
        </BubbleButton>
        <BubbleButton onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
          <TableIcon className="w-4 h-4" />
        </BubbleButton>
      </FloatingMenu>

      <TableBubbleMenu editor={editor} />

      {editorSettings.showRuler && (
        <EditorRuler containerRef={editorContainerRef} />
      )}

      <div 
        ref={editorContainerRef}
        className={`relative flex-1 overflow-y-auto bg-white ${paperStyle.className || ''}`}
        style={paperStyle.style}
        onContextMenu={(e) => {
          e.preventDefault()
          const { clientX, clientY } = e
          setContextMenuPos({ x: clientX, y: clientY })
          setShowContextMenu(true)
        }}
      >
        <EditorContent editor={editor} />
      </div>

      {showContextMenu && createPortal(
        <ContextMenu
          ref={contextMenuRef}
          x={contextMenuPos.x}
          y={contextMenuPos.y}
          editor={editor}
          onClose={() => setShowContextMenu(false)}
          editorBounds={editorContainerRef.current?.getBoundingClientRect()}
        />,
        document.body
      )}
    </div>
  )
}

function BubbleButton({ onClick, isActive, children }) {
  return (
    <button
      onClick={onClick}
      className={`p-1.5 rounded transition-colors ${
        isActive
          ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300'
          : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
      }`}
    >
      {children}
    </button>
  )
}

const ContextMenu = React.forwardRef(({ x, y, editor, onClose, editorBounds }, ref) => {
  const { t } = useTranslation()
  const [position, setPosition] = useState({ x, y })
  const menuRef = useRef(null)

  const menuItems = [
    { icon: <Copy className="w-4 h-4" />, label: t('common.copy') || 'Copy', shortcut: 'Ctrl+C', action: () => document.execCommand('copy') },
    { icon: <Scissors className="w-4 h-4" />, label: t('common.cut') || 'Cut', shortcut: 'Ctrl+X', action: () => document.execCommand('cut') },
    { icon: <Clipboard className="w-4 h-4" />, label: t('common.paste') || 'Paste', shortcut: 'Ctrl+V', action: () => document.execCommand('paste') },
    { icon: <Clipboard className="w-4 h-4" />, label: 'Paste as Plain Text', shortcut: 'Ctrl+Shift+V', action: async () => {
      try {
        const text = await navigator.clipboard.readText()
        if (text) {
          editor.chain().focus().insertContent(text).run()
        }
      } catch (err) {
      }
    }},
    { type: 'divider' },
    { icon: <Bold className="w-4 h-4" />, label: t('editor.bold') || 'Bold', shortcut: 'Ctrl+B', action: () => editor.chain().focus().toggleBold().run() },
    { icon: <Italic className="w-4 h-4" />, label: t('editor.italic') || 'Italic', shortcut: 'Ctrl+I', action: () => editor.chain().focus().toggleItalic().run() },
    { icon: <UnderlineIcon className="w-4 h-4" />, label: t('editor.underline') || 'Underline', shortcut: 'Ctrl+U', action: () => editor.chain().focus().toggleUnderline().run() },
    { icon: <Highlighter className="w-4 h-4" />, label: t('editor.highlight') || 'Highlight', action: () => editor.chain().focus().toggleHighlight().run() },
    { type: 'divider' },
    { icon: <AlignLeft className="w-4 h-4" />, label: t('editor.alignLeft') || 'Align Left', action: () => editor.chain().focus().setTextAlign('left').run() },
    { icon: <AlignCenter className="w-4 h-4" />, label: t('editor.alignCenter') || 'Center', action: () => editor.chain().focus().setTextAlign('center').run() },
    { icon: <AlignRight className="w-4 h-4" />, label: t('editor.alignRight') || 'Align Right', action: () => editor.chain().focus().setTextAlign('right').run() },
    { type: 'divider' },
    { icon: <Languages className="w-4 h-4" />, label: 'Translate', action: () => {
      const { from, to, empty } = editor.state.selection
      let textToTranslate = ''
      if (!empty) {
        textToTranslate = editor.state.doc.textBetween(from, to, ' ')
      } else {
        textToTranslate = editor.getText()
      }
      useUIStore.getState().openTranslateModal(textToTranslate)
    }},
    { icon: <LinkIcon className="w-4 h-4" />, label: t('editor.link') || 'Insert Link', shortcut: 'Ctrl+K', action: () => {
      useUIStore.getState().setLinkModalOpen(true)
    }},
    { icon: <TableIcon className="w-4 h-4" />, label: t('editor.table') || 'Insert Table', action: () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
    { type: 'divider' },
    { icon: <Trash2 className="w-4 h-4" />, label: t('common.delete') || 'Delete Selection', action: () => editor.chain().focus().deleteSelection().run(), danger: true },
  ]

  const handleAction = (action) => {
    action()
    onClose()
  }

  useEffect(() => {
    if (menuRef.current && editorBounds) {
      const menuRect = menuRef.current.getBoundingClientRect()
      const padding = 8
      
      let adjustedX = x
      let adjustedY = y

      const maxX = editorBounds.right - menuRect.width - padding
      const minX = editorBounds.left + padding
      
      if (adjustedX > maxX) adjustedX = maxX
      if (adjustedX < minX) adjustedX = minX

      const maxY = editorBounds.bottom - menuRect.height - padding
      const minY = editorBounds.top + padding
      
      if (adjustedY > maxY) adjustedY = maxY
      if (adjustedY < minY) adjustedY = minY

      if (adjustedX < padding) adjustedX = padding
      if (adjustedY < padding) adjustedY = padding
      if (adjustedX + menuRect.width > window.innerWidth - padding) {
        adjustedX = window.innerWidth - menuRect.width - padding
      }
      if (adjustedY + menuRect.height > window.innerHeight - padding) {
        adjustedY = window.innerHeight - menuRect.height - padding
      }

      setPosition({ x: adjustedX, y: adjustedY })
    }
  }, [x, y, editorBounds])

  return (
    <div
      ref={(node) => {
        menuRef.current = node
        if (typeof ref === 'function') ref(node)
        else if (ref) ref.current = node
      }}
      className="fixed z-[9999] bg-white dark:bg-gray-900 rounded-2xl shadow-xl shadow-black/5 dark:shadow-black/20 border border-[#cbd1db] dark:border-gray-700 py-1.5 min-w-[200px] max-h-[400px] overflow-y-auto backdrop-blur-xl"
      style={{ left: position.x, top: position.y }}
    >
      {menuItems.map((item, index) => (
        item.type === 'divider' ? (
          <div key={index} className="my-1.5 mx-3 border-t border-[#cbd1db] dark:border-gray-800" />
        ) : (
          <button
            key={index}
            onClick={() => handleAction(item.action)}
            className={`w-full px-4 py-2.5 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${
              item.danger ? 'text-red-500 dark:text-red-400' : 'text-gray-700 dark:text-gray-300'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-gray-400">{item.icon}</span>
              <span className="text-sm">{item.label}</span>
            </div>
            {item.shortcut && (
              <span className="text-xs text-gray-400">{item.shortcut}</span>
            )}
          </button>
        )
      ))}
    </div>
  )
})

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
          {shortcut && (
            <span className="ml-2 px-1.5 py-0.5 bg-gray-700 dark:bg-gray-600 rounded text-gray-300 font-mono text-[10px]">
              {shortcut}
            </span>
          )}
          <div 
            className="absolute -mt-1 -translate-x-1/2 border-4 border-transparent top-full left-1/2 border-t-gray-900 dark:border-t-gray-700" 
          />
        </div>,
        document.body
      )}
    </>
  )
}

function PortalDropdown({ isOpen, anchorRef, children, onClose, align = 'left' }) {
  const [position, setPosition] = useState({ top: 0, left: 0, right: 0 })
  const dropdownRef = useRef(null)
  
  useEffect(() => {
    if (isOpen && anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect()
      let top = rect.bottom + 4
      let left = rect.left
      let right = window.innerWidth - rect.right
      
      setPosition({ top, left, right })
      
      requestAnimationFrame(() => {
        if (dropdownRef.current) {
          const dropdownRect = dropdownRef.current.getBoundingClientRect()
          const padding = 10
          const bottomPadding = 60
          
          let adjustedTop = top
          let adjustedLeft = left
          let adjustedRight = right
          
          if (top + dropdownRect.height > window.innerHeight - bottomPadding) {
            const spaceAbove = rect.top - padding
            const spaceBelow = window.innerHeight - rect.bottom - bottomPadding
            
            if (spaceAbove > spaceBelow && spaceAbove >= dropdownRect.height) {
              adjustedTop = rect.top - dropdownRect.height - 4
            } else {
              adjustedTop = window.innerHeight - bottomPadding - dropdownRect.height
              if (adjustedTop < padding) adjustedTop = padding
            }
          }
          
          if (align === 'right') {
            if (adjustedRight + dropdownRect.width > window.innerWidth - padding) {
              adjustedRight = window.innerWidth - dropdownRect.width - padding
            }
            if (adjustedRight < padding) adjustedRight = padding
          } else {
            if (adjustedLeft + dropdownRect.width > window.innerWidth - padding) {
              adjustedLeft = window.innerWidth - dropdownRect.width - padding
            }
            if (adjustedLeft < padding) adjustedLeft = padding
          }
          
          if (adjustedTop !== top || adjustedLeft !== left || adjustedRight !== right) {
            setPosition({ top: adjustedTop, left: adjustedLeft, right: adjustedRight })
          }
        }
      })
    }
  }, [isOpen, anchorRef, align])

  useEffect(() => {
    if (isOpen) {
      const handleClickOutside = (e) => {
        if (anchorRef.current && !anchorRef.current.contains(e.target) && 
            dropdownRef.current && !dropdownRef.current.contains(e.target)) {
          onClose()
        }
      }
      const handleScroll = (e) => {
        if (dropdownRef.current && dropdownRef.current.contains(e.target)) {
          return
        }
        onClose()
      }
      
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('scroll', handleScroll, true)
      
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
        document.removeEventListener('scroll', handleScroll, true)
      }
    }
  }, [isOpen, anchorRef, onClose])

  if (!isOpen) return null

  return createPortal(
    <div
      ref={dropdownRef}
      className="fixed bg-white dark:bg-gray-900 rounded-2xl shadow-xl shadow-black/5 dark:shadow-black/20 border border-[#cbd1db] dark:border-gray-700 z-[99999] backdrop-blur-xl"
      style={{ 
        top: position.top, 
        left: align === 'right' ? 'auto' : position.left,
        right: align === 'right' ? position.right : 'auto',
      }}
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
        ref={buttonRef}
        onMouseDown={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setImageUploadOpen(true)
        }}
        className="p-2 text-gray-600 transition-all duration-150 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800/60 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
      >
        <ImageIcon className="w-4 h-4" />
      </button>
    </PortalTooltip>
  )
}

function EditorToolbar({ editor, currentPaper, onPaperChange, content }) {
  const { t } = useTranslation()
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
  const [tableRows, setTableRows] = useState(3)
  const [tableCols, setTableCols] = useState(3)
  const [showTableSizeGrid, setShowTableSizeGrid] = useState(false)
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
    setShowTableSizeGrid(false)
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
    
    const { from, to } = selection
    
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
  }, [editor])

  const ToolbarButton = ({ onClick, isActive, disabled, children, title, shortcut }) => {
    const buttonRef = useRef(null)
    
    const button = (
      <button
        ref={buttonRef}
        onMouseDown={(e) => {
          e.preventDefault()
          e.stopPropagation()
          closeAllDropdowns()
          if (!disabled && onClick) onClick()
        }}
        disabled={disabled}
        className={`toolbar-btn p-1.5 sm:p-2 rounded-lg transition-all duration-150 touch-manipulation ${
          isActive
            ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 shadow-sm'
            : 'hover:bg-gray-100 dark:hover:bg-gray-800/60 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 active:bg-gray-100 dark:active:bg-gray-700'
        } ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
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
    <div className="w-px h-5 mx-0.5 sm:mx-1 bg-gradient-to-b from-transparent via-gray-200 to-transparent dark:via-gray-700/60" />
  )

  const DropdownButton = ({ children, isOpen, onClick, title, disabled }) => {
    const buttonRef = useRef(null)
    
    const button = (
      <button
        ref={buttonRef}
        disabled={disabled}
        onMouseDown={(e) => {
          e.preventDefault()
          e.stopPropagation()
          if (!disabled && onClick) onClick()
        }}
        className={`p-1.5 rounded-lg transition-all duration-150 flex items-center gap-1 ${
          disabled
            ? 'opacity-30 cursor-not-allowed text-gray-400 dark:text-gray-600'
            : isOpen
              ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 shadow-sm'
              : 'hover:bg-gray-100 dark:hover:bg-gray-800/60 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
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
    <div ref={toolbarRef} className="editor-toolbar toolbar-premium flex flex-wrap items-center gap-0.5 sm:gap-0.5 px-2 sm:px-4 py-1.5 sm:py-2 border-b border-[#cbd1db] dark:border-gray-800/60 overflow-x-auto">
      <ToolbarButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo" shortcut="Ctrl+Z">
        <Undo className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo" shortcut="Ctrl+Y">
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
        <PortalDropdown isOpen={showFontPicker} anchorRef={fontPickerRef} onClose={() => setShowFontPicker(false)}>
          <div className="py-1.5 w-[200px] max-h-[300px] overflow-y-auto">
            {fontFamilies.map((font) => {
              const currentFont = editor.getAttributes('textStyle').fontFamily
              const isActive = currentFont === font.value
              return (
                <button
                  key={font.name}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    editor.chain().focus().setFontFamily(font.value).run()
                    setShowFontPicker(false)
                  }}
                  className={`w-full px-3 py-1.5 text-[13px] text-left hover:bg-gray-100 dark:hover:bg-gray-800/60 truncate rounded-lg transition-colors ${
                    isActive ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 font-medium' : 'text-gray-700 dark:text-gray-300'
                  }`}
                  style={{ fontFamily: font.value }}
                >
                  {font.name}
                </button>
              )
            })}
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
                  onMouseDown={(e) => {
                    e.preventDefault()
                    editor.chain().focus().setFontSize(size.value).run()
                    setShowFontSizePicker(false)
                  }}
                  className={`w-full px-3 py-1.5 text-left text-[13px] hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg transition-colors ${
                    isActive ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 font-medium' : 'text-gray-700 dark:text-gray-300'
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
                  onMouseDown={(e) => {
                    e.preventDefault()
                    editor.chain().focus().setLineHeight(lh.value).run()
                    setShowLineHeightPicker(false)
                  }}
                  className={`w-full px-3 py-1.5 text-left text-[13px] hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg transition-colors ${
                    isActive ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 font-medium' : 'text-gray-700 dark:text-gray-300'
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
          title="Headings"
        >
          <Heading1 className="w-4 h-4" />
        </DropdownButton>
        <PortalDropdown isOpen={showHeadingsPicker} anchorRef={headingsRef} onClose={() => setShowHeadingsPicker(false)}>
          <div className="py-1.5 w-[180px]">
            {[1, 2, 3, 4, 5, 6].map((level) => {
              const isActive = editor.isActive('heading', { level })
              return (
                <button
                  key={level}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    editor.chain().focus().toggleHeading({ level }).run()
                    setShowHeadingsPicker(false)
                  }}
                  className={`w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-800/60 flex items-center gap-3 rounded-lg transition-colors ${
                    isActive ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : 'text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <span className={`font-bold ${
                    level === 1 ? 'text-xl' : 
                    level === 2 ? 'text-lg' : 
                    level === 3 ? 'text-base' : 
                    level === 4 ? 'text-sm' : 
                    level === 5 ? 'text-xs' : 'text-xs'
                  }`}>H{level}</span>
                  <span className="text-[11px] text-gray-300 dark:text-gray-600 font-medium">Ctrl+Alt+{level}</span>
                </button>
              )
            })}
            <div className="h-px my-1.5 mx-2 bg-gray-100 dark:bg-gray-800/60" />
            <button
              onMouseDown={(e) => {
                e.preventDefault()
                editor.chain().focus().setParagraph().run()
                setShowHeadingsPicker(false)
              }}
              className="w-full px-3 py-2 text-left text-[13px] hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg transition-colors text-gray-700 dark:text-gray-300"
            >
              Normal text
            </button>
          </div>
        </PortalDropdown>
      </div>

      <ToolbarDivider />

      <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive('bold')} title="Bold" shortcut="Ctrl+B">
        <Bold className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive('italic')} title="Italic" shortcut="Ctrl+I">
        <Italic className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} isActive={editor.isActive('underline')} title="Underline" shortcut="Ctrl+U">
        <UnderlineIcon className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} isActive={editor.isActive('strike')} title="Strikethrough" shortcut="Ctrl+Shift+S">
        <Strikethrough className="w-4 h-4" />
      </ToolbarButton>

      <div className="relative" ref={colorPickerRef}>
        <DropdownButton isOpen={showColorPicker} onClick={() => toggleDropdown(setShowColorPicker, showColorPicker)} title="Text Color">
          <Palette className="w-4 h-4" />
        </DropdownButton>
        <PortalDropdown isOpen={showColorPicker} anchorRef={colorPickerRef} onClose={() => setShowColorPicker(false)}>
          <div className="p-4 min-w-[280px]">
            <div className="grid grid-cols-8 gap-2">
              {textColors.map((color) => {
                const isActive = editor.getAttributes('textStyle').color === color
                return (
                  <button
                    key={color}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      editor.chain().focus().setColor(color).run()
                      setShowColorPicker(false)
                    }}
                    className={`w-7 h-7 rounded-lg border-2 hover:scale-110 transition-all shadow-sm flex items-center justify-center ${
                      isActive 
                        ? 'border-emerald-500 ring-2 ring-emerald-200 dark:ring-emerald-800' 
                        : 'border-[#cbd1db] dark:border-gray-600 hover:border-emerald-500'
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
              onMouseDown={(e) => {
                e.preventDefault()
                editor.chain().focus().unsetColor().run()
                setShowColorPicker(false)
              }}
              className="w-full mt-3 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg border border-[#cbd1db] dark:border-gray-700 transition-colors"
            >
              Reset Color
            </button>
            <div className="pt-3 mt-3 border-t border-[#cbd1db] dark:border-gray-700">
              <label className="block mb-2 text-xs font-medium text-gray-600 dark:text-gray-400">Custom Color</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={customColor}
                  onChange={(e) => setCustomColor(e.target.value)}
                  className="w-10 h-8 border border-[#cbd1db] rounded cursor-pointer dark:border-gray-600"
                />
                <input
                  type="text"
                  value={customColor}
                  onChange={(e) => setCustomColor(e.target.value)}
                  className="flex-1 px-2 py-1 text-xs text-gray-900 bg-white border border-[#cbd1db] rounded dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  placeholder="#000000"
                />
                <button
                  onMouseDown={(e) => {
                    e.preventDefault()
                    editor.chain().focus().setColor(customColor).run()
                    setShowColorPicker(false)
                  }}
                  className="px-3 py-1 text-xs text-white rounded bg-primary-600 hover:bg-primary-700"
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
          <div className="p-4 min-w-[280px]">
            <div className="grid grid-cols-8 gap-2">
              {highlightColors.map((color) => {
                const isActive = editor.isActive('highlight', { color })
                return (
                  <button
                    key={color}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      editor.chain().focus().toggleHighlight({ color }).run()
                      setShowHighlightPicker(false)
                    }}
                    className={`w-7 h-7 rounded-lg border-2 hover:scale-110 transition-all shadow-sm flex items-center justify-center ${
                      isActive 
                        ? 'border-emerald-500 ring-2 ring-emerald-200 dark:ring-emerald-800' 
                        : 'border-[#cbd1db] dark:border-gray-600 hover:border-emerald-500'
                    }`}
                    style={{ backgroundColor: color }}
                    title={color}
                  >
                    {isActive && (
                      <svg className="w-4 h-4 text-gray-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    )}
                  </button>
                )
              })}
            </div>
            <button
              onMouseDown={(e) => {
                e.preventDefault()
                editor.chain().focus().unsetHighlight().run()
                setShowHighlightPicker(false)
              }}
              className="w-full mt-3 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg border border-[#cbd1db] dark:border-gray-700 transition-colors"
            >
              Remove Highlight
            </button>
            <div className="pt-3 mt-3 border-t border-[#cbd1db] dark:border-gray-700">
              <label className="block mb-2 text-xs font-medium text-gray-600 dark:text-gray-400">Custom Highlight</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={customHighlight}
                  onChange={(e) => setCustomHighlight(e.target.value)}
                  className="w-10 h-8 border border-[#cbd1db] rounded cursor-pointer dark:border-gray-600"
                />
                <input
                  type="text"
                  value={customHighlight}
                  onChange={(e) => setCustomHighlight(e.target.value)}
                  className="flex-1 px-2 py-1 text-xs text-gray-900 bg-white border border-[#cbd1db] rounded dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  placeholder="#fef08a"
                />
                <button
                  onMouseDown={(e) => {
                    e.preventDefault()
                    editor.chain().focus().toggleHighlight({ color: customHighlight }).run()
                    setShowHighlightPicker(false)
                  }}
                  className="px-3 py-1 text-xs text-white rounded bg-primary-600 hover:bg-primary-700"
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
                  onMouseDown={(e) => {
                    e.preventDefault()
                    editor.chain().focus().setLetterSpacing(spacing.value).run()
                    setShowLetterSpacing(false)
                  }}
                  className={`w-full px-3 py-1.5 text-left text-[13px] hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg transition-colors ${
                    isActive ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 font-medium' : 'text-gray-700 dark:text-gray-300'
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
        <PortalDropdown isOpen={showTableMenu} anchorRef={tableMenuRef} onClose={() => { setShowTableMenu(false); setShowTableSizeGrid(false) }}>
          <div className="py-2 min-w-[220px]">
            {!editor.isActive('table') && (
              <div className="px-3 pb-2">
                <p className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">{t('editor.insertTable')}</p>
                <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(8, 1fr)' }}>
                  {Array.from({ length: 8 * 6 }).map((_, i) => {
                    const row = Math.floor(i / 8) + 1
                    const col = (i % 8) + 1
                    const isHovered = row <= hoverCell.row && col <= hoverCell.col
                    return (
                      <button
                        key={i}
                        onMouseEnter={() => setHoverCell({ row, col })}
                        onMouseDown={(e) => {
                          e.preventDefault()
                          editor.chain().focus().insertTable({ rows: row, cols: col, withHeaderRow: true }).run()
                          setShowTableMenu(false)
                          setHoverCell({ row: 0, col: 0 })
                        }}
                        className={`w-5 h-5 rounded-sm border transition-colors ${
                          isHovered 
                            ? 'bg-primary-100 dark:bg-primary-900/50 border-primary-400' 
                            : 'border-[#cbd1db] dark:border-gray-600 hover:border-gray-400'
                        }`}
                      />
                    )
                  })}
                </div>
                <p className="mt-2 text-xs text-center text-gray-500 dark:text-gray-400">
                  {hoverCell.row > 0 ? `${hoverCell.col} × ${hoverCell.row}` : t('editor.tableSize')}
                </p>
              </div>
            )}
            
            {editor.isActive('table') && (
              <>
                <p className="px-3 mb-1 text-xs font-medium text-gray-500 dark:text-gray-400">{t('editor.table')}</p>
                <button onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().addColumnBefore().run(); setShowTableMenu(false) }} className="flex items-center w-full gap-2 px-3 py-2 text-[13px] text-left hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg transition-colors text-gray-700 dark:text-gray-300">
                  <Columns className="w-4 h-4 text-gray-400" /> {t('editor.addColumnBefore')}
                </button>
                <button onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().addColumnAfter().run(); setShowTableMenu(false) }} className="flex items-center w-full gap-2 px-3 py-2 text-[13px] text-left hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg transition-colors text-gray-700 dark:text-gray-300">
                  <Columns className="w-4 h-4 text-gray-400" /> {t('editor.addColumnAfter')}
                </button>
                <button onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().addRowBefore().run(); setShowTableMenu(false) }} className="flex items-center w-full gap-2 px-3 py-2 text-[13px] text-left hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg transition-colors text-gray-700 dark:text-gray-300">
                  <Rows className="w-4 h-4 text-gray-400" /> {t('editor.addRowBefore')}
                </button>
                <button onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().addRowAfter().run(); setShowTableMenu(false) }} className="flex items-center w-full gap-2 px-3 py-2 text-[13px] text-left hover:bg-gray-100 dark:hover:bg-gray-800/60 rounded-lg transition-colors text-gray-700 dark:text-gray-300">
                  <Rows className="w-4 h-4 text-gray-400" /> {t('editor.addRowAfter')}
                </button>
                <div className="h-px my-1.5 mx-2 bg-gray-100 dark:bg-gray-800/60" />
                <button onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().deleteColumn().run(); setShowTableMenu(false) }} className="flex items-center w-full gap-2 px-3 py-2 text-[13px] text-left text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors">
                  <X className="w-4 h-4" /> {t('editor.deleteColumn')}
                </button>
                <button onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().deleteRow().run(); setShowTableMenu(false) }} className="flex items-center w-full gap-2 px-3 py-2 text-[13px] text-left text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors">
                  <X className="w-4 h-4" /> {t('editor.deleteRow')}
                </button>
                <button onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().deleteTable().run(); setShowTableMenu(false) }} className="flex items-center w-full gap-2 px-3 py-2 text-[13px] text-left text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors">
                  <Trash2 className="w-4 h-4" /> {t('editor.deleteTable')}
                </button>
              </>
            )}
          </div>
        </PortalDropdown>
      </div>

      <ToolbarDivider />

      <ToolbarButton onClick={setLink} isActive={editor.isActive('link')} title="Insert Link (Ctrl+Shift+K)">
        <LinkIcon className="w-4 h-4" />
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
            <p className="px-3 py-2 text-[10px] font-bold tracking-[0.12em] uppercase text-gray-400 dark:text-gray-500 border-b border-[#cbd1db] dark:border-gray-700">
              Table of Contents
            </p>
            {headings.length === 0 ? (
              <p className="px-3 py-3 text-[13px] text-gray-400 dark:text-gray-500 italic">
                No headings found
              </p>
            ) : (
              headings.map((heading, index) => (
                <button
                  key={heading.id}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    scrollToHeading(index)
                  }}
                  className="w-full px-3 py-2 text-left text-[13px] hover:bg-gray-100 dark:hover:bg-gray-800/60 flex items-center gap-2 rounded-lg transition-colors text-gray-700 dark:text-gray-300"
                  style={{ paddingLeft: `${(heading.level - 1) * 12 + 12}px` }}
                >
                  <span className={`flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold ${
                    heading.level === 1 
                      ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' 
                      : heading.level === 2 
                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                        : 'bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400'
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
                onMouseDown={(e) => {
                  e.preventDefault()
                  onPaperChange(key)
                  setShowPaperPicker(false)
                }}
                className={`w-full px-3 py-2 text-left text-[13px] hover:bg-gray-100 dark:hover:bg-gray-800/60 flex items-center gap-3 rounded-lg transition-colors ${
                  currentPaper === key ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 font-medium' : 'text-gray-700 dark:text-gray-300'
                }`}
              >
                <div 
                  className="flex-shrink-0 w-5 h-5 border border-[#cbd1db] dark:border-gray-700 rounded-md"
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
