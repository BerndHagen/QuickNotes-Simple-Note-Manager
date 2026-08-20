import { Node, mergeAttributes } from '@tiptap/core'

/** A durable manual page boundary. Pagination renders the visible paper gap. */
const PageBreakExtension = Node.create({
  name: 'pageBreak',
  priority: 1000,
  group: 'block',
  atom: true,
  selectable: true,
  defining: true,

  parseHTML() {
    return [{ tag: 'div[data-type="pageBreak"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, {
      'data-type': 'pageBreak',
      class: 'qn-page-break-marker',
      role: 'separator',
      'aria-label': 'Page break',
    })]
  },

  addCommands() {
    return {
      insertPageBreak: () => ({ commands }) => commands.insertContent([
        { type: this.name },
        { type: 'paragraph' },
      ]),
    }
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Enter': () => this.editor.commands.insertPageBreak(),
    }
  },
})

export default PageBreakExtension
