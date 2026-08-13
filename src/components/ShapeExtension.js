import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import ShapeView from './ShapeView'
import { getShapeDomSpec } from './ShapeGeometry'

const numberAttribute = (name, fallback) => ({
  default: fallback,
  parseHTML: (element) => {
    const value = Number.parseFloat(element.getAttribute(name))
    return Number.isFinite(value) ? value : fallback
  },
  renderHTML: (attributes) => ({ [name]: attributes[name.replace('data-', '')] ?? fallback }),
})

/**
 * A document-native shape, modelled after the useful subset of Word's shape
 * tools. Geometry and transforms are stored as HTML data attributes so the
 * object survives autosave, export/import, and read-only rendering.
 */
export const ShapeExtension = Node.create({
  name: 'shape',
  group: 'block',
  content: 'inline*',
  defining: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      shapeType: {
        default: 'rounded',
        parseHTML: (element) => element.getAttribute('data-shape') || 'rounded',
        renderHTML: (attributes) => ({ 'data-shape': attributes.shapeType || 'rounded' }),
      },
      width: numberAttribute('data-width', 240),
      height: numberAttribute('data-height', 112),
      rotation: numberAttribute('data-rotation', 0),
      wrap: {
        default: 'absolute',
        parseHTML: (element) => element.getAttribute('data-wrap') || 'absolute',
        renderHTML: (attributes) => ({ 'data-wrap': attributes.wrap || 'absolute' }),
      },
      x: numberAttribute('data-x', 0),
      y: numberAttribute('data-y', 0),
      flipH: {
        default: false,
        parseHTML: (element) => element.getAttribute('data-flip-h') === 'true',
        renderHTML: (attributes) => (attributes.flipH ? { 'data-flip-h': 'true' } : {}),
      },
      flipV: {
        default: false,
        parseHTML: (element) => element.getAttribute('data-flip-v') === 'true',
        renderHTML: (attributes) => (attributes.flipV ? { 'data-flip-v': 'true' } : {}),
      },
      align: {
        default: 'center',
        parseHTML: (element) => element.getAttribute('data-align') || 'center',
        renderHTML: (attributes) => ({ 'data-align': attributes.align || 'center' }),
      },
      fill: {
        default: 'accent',
        parseHTML: (element) => element.getAttribute('data-fill') || 'accent',
        renderHTML: (attributes) => ({ 'data-fill': attributes.fill || 'accent' }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="shape"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    const width = HTMLAttributes['data-width'] ?? 240
    const height = HTMLAttributes['data-height'] ?? 112
    const rotation = HTMLAttributes['data-rotation'] ?? 0
    const scaleX = HTMLAttributes['data-flip-h'] === 'true' ? -1 : 1
    const scaleY = HTMLAttributes['data-flip-v'] === 'true' ? -1 : 1
    const align = HTMLAttributes['data-align'] || 'center'
    const wrap = HTMLAttributes['data-wrap'] || 'absolute'
    const x = HTMLAttributes['data-x'] ?? 0
    const y = HTMLAttributes['data-y'] ?? 0
    const margin = align === 'left' ? '12px auto 12px 0' : align === 'right' ? '12px 0 12px auto' : '12px auto'
    const layout = wrap === 'left'
      ? 'float:left;margin:4px 16px 12px 0'
      : wrap === 'right'
        ? 'float:right;margin:4px 0 12px 16px'
        : wrap === 'absolute' || wrap === 'free'
          ? `position:absolute;left:${x}px;top:${y}px;z-index:2;margin:0`
          : `margin:${margin}`

    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'shape',
        class: 'qn-shape',
        style: `width:${width}px;height:${height}px;${layout}`,
      }),
      [
        'div',
        {
          class: 'qn-shape__object',
          style: `transform:rotate(${rotation}deg) scale(${scaleX},${scaleY})`,
        },
        [
          'div',
          { class: 'qn-shape__surface' },
          [
            'svg',
            {
              class: 'qn-shape__geometry',
              viewBox: '0 0 100 100',
              preserveAspectRatio: 'none',
              'aria-hidden': 'true',
              focusable: 'false',
              xmlns: 'http://www.w3.org/2000/svg',
            },
            getShapeDomSpec(HTMLAttributes['data-shape']),
          ],
          [
            'div',
            { class: 'qn-shape__content', style: `transform:scale(${scaleX},${scaleY})` },
            0,
          ],
        ],
      ],
    ]
  },

  addCommands() {
    return {
      insertShape:
        (attrs = {}) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { shapeType: 'rounded', width: 240, height: 112, wrap: 'absolute', x: 0, y: 0, ...attrs },
            content: [{ type: 'text', text: attrs.label || 'Add text' }],
          }),
      updateShape:
        (attrs) =>
        ({ commands }) =>
          commands.updateAttributes(this.name, attrs),
      removeShape:
        () =>
        ({ commands }) =>
          commands.deleteNode(this.name),
    }
  },

  addNodeView() {
    return ReactNodeViewRenderer(ShapeView)
  },
})

export default ShapeExtension
