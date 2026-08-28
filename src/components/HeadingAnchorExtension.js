import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'

const createAnchorId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `heading-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

const ensureHeadingAnchors = (state) => {
  let transaction = state.tr
  let changed = false
  state.doc.descendants((node, position) => {
    if (node.type.name !== 'heading' || node.attrs.anchorId) return
    transaction = transaction.setNodeMarkup(position, undefined, {
      ...node.attrs,
      anchorId: createAnchorId(),
    })
    changed = true
  })
  return changed ? transaction : null
}

const HeadingAnchorExtension = Extension.create({
  name: 'headingAnchorIdentity',

  addGlobalAttributes() {
    return [{
      types: ['heading'],
      attributes: {
        anchorId: {
          default: null,
          parseHTML: (element) => element.getAttribute('data-anchor-id'),
          renderHTML: (attributes) => attributes.anchorId
            ? { 'data-anchor-id': attributes.anchorId }
            : {},
        },
      },
    }]
  },

  addCommands() {
    return {
      ensureHeadingAnchors: () => ({ state, dispatch }) => {
        const transaction = ensureHeadingAnchors(state)
        if (!transaction) return true
        dispatch?.(transaction)
        return true
      },
    }
  },

  addProseMirrorPlugins() {
    return [new Plugin({
      key: new PluginKey('quicknotes-heading-anchor-identity'),
      appendTransaction: (transactions, _oldState, newState) =>
        transactions.some((transaction) => transaction.docChanged)
          ? ensureHeadingAnchors(newState)
          : null,
    })]
  },
})

export default HeadingAnchorExtension

