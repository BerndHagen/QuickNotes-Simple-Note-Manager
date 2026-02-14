import Image from '@tiptap/extension-image'
import { ReactNodeViewRenderer } from '@tiptap/react'
import ResizableImage from './ResizableImage'

export const ResizableImageExtension = Image.extend({
  name: 'resizableImage',
  
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: element => element.getAttribute('data-width') || element.style.width?.replace('px', '') || null,
        renderHTML: attributes => {
          if (!attributes.width) return {}
          return {
            'data-width': attributes.width,
            style: `width: ${attributes.width}px`,
          }
        },
      },
      flipH: {
        default: false,
        parseHTML: element => element.getAttribute('data-flip-h') === 'true',
        renderHTML: attributes => {
          if (!attributes.flipH) return {}
          return { 'data-flip-h': 'true' }
        },
      },
      flipV: {
        default: false,
        parseHTML: element => element.getAttribute('data-flip-v') === 'true',
        renderHTML: attributes => {
          if (!attributes.flipV) return {}
          return { 'data-flip-v': 'true' }
        },
      },
      rotation: {
        default: 0,
        parseHTML: element => parseInt(element.getAttribute('data-rotation') || '0', 10),
        renderHTML: attributes => {
          if (!attributes.rotation) return {}
          return { 'data-rotation': attributes.rotation }
        },
      },
      align: {
        default: 'center',
        parseHTML: element => element.getAttribute('data-align') || 'center',
        renderHTML: attributes => {
          return { 'data-align': attributes.align || 'center' }
        },
      },
    }
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImage)
  },
})

export default ResizableImageExtension
