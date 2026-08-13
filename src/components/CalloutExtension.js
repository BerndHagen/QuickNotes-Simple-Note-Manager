import { mergeAttributes, Node } from '@tiptap/core'

const CALLOUT_TONES = new Set(['info', 'tip', 'warning', 'important'])

/**
 * A semantic, editable callout block. Tone is stored on the node so exported
 * HTML and synced notes retain the author's intent without relying on CSS
 * class names from the current theme.
 */
const CalloutExtension = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      tone: {
        default: 'info',
        parseHTML: (element) => {
          const value = element.getAttribute('data-tone')
          return CALLOUT_TONES.has(value) ? value : 'info'
        },
        renderHTML: ({ tone }) => ({
          'data-tone': CALLOUT_TONES.has(tone) ? tone : 'info',
        }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'aside[data-type="callout"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'aside',
      mergeAttributes(HTMLAttributes, { 'data-type': 'callout', class: 'qn-callout' }),
      ['div', { class: 'qn-callout__content' }, 0],
    ]
  },

  addCommands() {
    return {
      toggleCallout: (attributes = {}) => ({ commands }) => commands.toggleWrap(this.name, attributes),
      setCalloutTone: (tone) => ({ commands }) => (
        CALLOUT_TONES.has(tone) && commands.updateAttributes(this.name, { tone })
      ),
    }
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-8': () => this.editor.commands.toggleCallout({ tone: 'info' }),
    }
  },
})

export { CALLOUT_TONES }
export default CalloutExtension
