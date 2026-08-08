import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

const invisibleCharactersKey = new PluginKey('quicknotesInvisibleCharacters')

const marker = (className, text) => {
  const element = document.createElement('span')
  element.className = `qn-invisible-marker ${className}`
  element.textContent = text
  element.setAttribute('aria-hidden', 'true')
  element.contentEditable = 'false'
  return element
}

export function buildInvisibleCharacterDecorations(doc) {
  const decorations = []

  doc.descendants((node, position) => {
    if (node.isText) {
      for (let index = 0; index < node.text.length; index += 1) {
        const character = node.text[index]
        if (character === ' ') {
          decorations.push(
            Decoration.inline(position + index, position + index + 1, {
              class: 'qn-invisible-character qn-invisible-space',
              'data-invisible-character': 'space',
            })
          )
        } else if (character === '\t') {
          decorations.push(
            Decoration.inline(position + index, position + index + 1, {
              class: 'qn-invisible-character qn-invisible-tab',
              'data-invisible-character': 'tab',
            })
          )
        }
      }
      return
    }

    if (node.type.name === 'hardBreak') {
      decorations.push(
        Decoration.widget(position, () => marker('qn-invisible-hard-break', '\u21b5'), {
          key: `hard-break-${position}`,
          side: -1,
        })
      )
    }

    if (node.isTextblock) {
      const boundary = position + node.nodeSize - 1
      decorations.push(
        Decoration.widget(boundary, () => marker('qn-invisible-paragraph', '\u00b6'), {
          key: `paragraph-${boundary}`,
          side: -1,
        })
      )
    }
  })

  return DecorationSet.create(doc, decorations)
}

export function getInvisibleCharacterDecorations(state) {
  return invisibleCharactersKey.getState(state)?.decorations?.find() || []
}

const InvisibleCharactersExtension = Extension.create({
  name: 'invisibleCharacters',

  addCommands() {
    return {
      setInvisibleCharacters:
        (enabled) =>
        ({ tr, dispatch }) => {
          if (dispatch) dispatch(tr.setMeta(invisibleCharactersKey, Boolean(enabled)))
          return true
        },
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: invisibleCharactersKey,
        state: {
          init: () => ({ enabled: false, decorations: DecorationSet.empty }),
          apply(transaction, previous, _oldState, nextState) {
            const requested = transaction.getMeta(invisibleCharactersKey)
            const enabled = typeof requested === 'boolean' ? requested : previous.enabled

            if (!enabled) {
              return previous.enabled
                ? { enabled: false, decorations: DecorationSet.empty }
                : previous
            }

            if (!previous.enabled || transaction.docChanged) {
              return {
                enabled: true,
                decorations: buildInvisibleCharacterDecorations(nextState.doc),
              }
            }

            return previous
          },
        },
        props: {
          decorations(state) {
            return invisibleCharactersKey.getState(state)?.decorations || DecorationSet.empty
          },
        },
      }),
    ]
  },
})

export default InvisibleCharactersExtension
