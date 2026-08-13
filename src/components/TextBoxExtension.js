import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import TextBoxView from './TextBoxView'

/**
 * Word-style text box.
 *
 * Geometry and layout mode are stored on the node, so a box can be moved,
 * resized, aligned and wrapped the way it is in a word processor:
 *
 *   wrap: 'inline'  — sits in the text flow as a block
 *        'left'     — floats left, text wraps down the right side
 *        'right'    — floats right, text wraps down the left side
 *        'absolute' — pinned at (x, y) relative to the page, text ignores it
 *
 * Geometry is persisted as data-attributes so it survives the HTML
 * round-trip through storage, export and import.
 */
const num = (value, fallback = null) => {
  const parsed = parseFloat(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export const TextBoxExtension = Node.create({
  name: 'textBox',
  group: 'block',
  content: 'block+',
  defining: true,
  draggable: true,
  isolating: true,

  addAttributes() {
    return {
      wrap: {
        default: 'absolute',
        parseHTML: (el) => el.getAttribute('data-wrap') || 'absolute',
        renderHTML: (attrs) => ({ 'data-wrap': attrs.wrap || 'absolute' }),
      },
      x: {
        default: 0,
        parseHTML: (el) => num(el.getAttribute('data-x'), 0),
        renderHTML: (attrs) => ({ 'data-x': attrs.x ?? 0 }),
      },
      y: {
        default: 0,
        parseHTML: (el) => num(el.getAttribute('data-y'), 0),
        renderHTML: (attrs) => ({ 'data-y': attrs.y ?? 0 }),
      },
      width: {
        default: 320,
        parseHTML: (el) => num(el.getAttribute('data-width'), 320),
        renderHTML: (attrs) => ({ 'data-width': attrs.width ?? 320 }),
      },
      height: {
        default: null,
        parseHTML: (el) => num(el.getAttribute('data-height'), null),
        renderHTML: (attrs) => (attrs.height ? { 'data-height': attrs.height } : {}),
      },
      textAlign: {
        default: 'left',
        parseHTML: (el) => el.getAttribute('data-text-align') || 'left',
        renderHTML: (attrs) => ({ 'data-text-align': attrs.textAlign || 'left' }),
      },
      borderStyle: {
        default: 'solid',
        parseHTML: (el) => el.getAttribute('data-border') || 'solid',
        renderHTML: (attrs) => ({ 'data-border': attrs.borderStyle || 'solid' }),
      },
      borderColor: {
        default: '#64748b',
        parseHTML: (el) => el.getAttribute('data-border-color') || '#64748b',
        renderHTML: (attrs) => ({ 'data-border-color': attrs.borderColor || '#64748b' }),
      },
      borderWidth: {
        default: 1,
        parseHTML: (el) => num(el.getAttribute('data-border-width'), 1),
        renderHTML: (attrs) => ({ 'data-border-width': attrs.borderWidth ?? 1 }),
      },
      background: {
        default: '#ffffff',
        parseHTML: (el) => el.getAttribute('data-bg') || '#ffffff',
        renderHTML: (attrs) => ({ 'data-bg': attrs.background || '#ffffff' }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="textBox"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    // Inline styles are emitted so exported HTML and the read-only
    // previews keep the geometry without the editor running.
    const wrap = HTMLAttributes['data-wrap'] || 'absolute'
    const width = HTMLAttributes['data-width'] ?? 320
    const height = HTMLAttributes['data-height']
    const x = HTMLAttributes['data-x'] ?? 0
    const y = HTMLAttributes['data-y'] ?? 0

    const style = [
      `width:${width}px`,
      height ? `height:${height}px` : null,
      `text-align:${HTMLAttributes['data-text-align'] || 'left'}`,
      `background:${HTMLAttributes['data-bg'] === 'none' ? 'transparent' : HTMLAttributes['data-bg'] || '#ffffff'}`,
      `border:${HTMLAttributes['data-border'] === 'none' ? '0' : `${HTMLAttributes['data-border-width'] || 1}px ${HTMLAttributes['data-border'] || 'solid'} ${HTMLAttributes['data-border-color'] || '#64748b'}`}`,
      wrap === 'absolute' ? `position:absolute;left:${x}px;top:${y}px` : null,
      wrap === 'left' ? 'float:left;margin:4px 16px 8px 0' : null,
      wrap === 'right' ? 'float:right;margin:4px 0 8px 16px' : null,
    ]
      .filter(Boolean)
      .join(';')

    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'textBox',
        class: 'qn-text-box',
        style,
      }),
      0,
    ]
  },

  addCommands() {
    return {
      insertTextBox:
        (attrs = {}) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { wrap: 'absolute', width: 320, height: 140, background: '#ffffff', ...attrs },
            content: [{ type: 'paragraph' }],
          }),

      updateTextBox:
        (attrs) =>
        ({ commands }) =>
          commands.updateAttributes(this.name, attrs),

      removeTextBox:
        () =>
        ({ commands }) =>
          commands.deleteNode(this.name),
    }
  },

  addNodeView() {
    return ReactNodeViewRenderer(TextBoxView)
  },
})

export default TextBoxExtension
