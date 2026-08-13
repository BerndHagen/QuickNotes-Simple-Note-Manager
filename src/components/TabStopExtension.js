import { Node, mergeAttributes } from '@tiptap/core'

const numberAttribute = (name, fallback) => ({
  default: fallback,
  parseHTML: (element) => Number(element.getAttribute(name)) || fallback,
  renderHTML: (attributes) => ({ [name]: Math.round(Number(attributes[name === 'data-width' ? 'width' : 'stop']) || fallback) }),
})

/** A real, selectable inline tab advance whose width survives HTML export. */
const TabStopExtension = Node.create({
  name: 'tabStop',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      width: numberAttribute('data-width', 48),
      stop: numberAttribute('data-stop', 48),
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-type="tabStop"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    const width = Math.max(8, Number(HTMLAttributes['data-width']) || 48)
    return ['span', mergeAttributes(HTMLAttributes, {
      'data-type': 'tabStop',
      class: 'qn-tab-stop',
      style: `display:inline-block;width:${width}px`,
      'aria-label': 'Tab',
    })]
  },

  addCommands() {
    return {
      insertTabStop: (attributes = {}) => ({ commands }) => commands.insertContent({
        type: this.name,
        attrs: {
          width: Math.max(8, Math.round(attributes.width || 48)),
          stop: Math.max(8, Math.round(attributes.stop || 48)),
        },
      }),
    }
  },
})

export default TabStopExtension
