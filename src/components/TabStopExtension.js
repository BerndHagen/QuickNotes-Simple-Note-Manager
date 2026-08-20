import { Node, mergeAttributes } from '@tiptap/core'

const TAB_TYPES = new Set(['left', 'center', 'right', 'decimal'])

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
      type: {
        default: 'left',
        parseHTML: (element) => TAB_TYPES.has(element.getAttribute('data-tab-type'))
          ? element.getAttribute('data-tab-type')
          : 'left',
        renderHTML: ({ type }) => ({ 'data-tab-type': TAB_TYPES.has(type) ? type : 'left' }),
      },
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
      'aria-label': `${TAB_TYPES.has(HTMLAttributes['data-tab-type']) ? HTMLAttributes['data-tab-type'] : 'left'} tab`,
    })]
  },

  addCommands() {
    return {
      insertTabStop: (attributes = {}) => ({ commands }) => commands.insertContent({
        type: this.name,
        attrs: {
          width: Math.max(8, Math.round(attributes.width || 48)),
          stop: Math.max(8, Math.round(attributes.stop || 48)),
          type: TAB_TYPES.has(attributes.type) ? attributes.type : 'left',
        },
      }),
    }
  },

  addNodeView() {
    return ({ node }) => {
      const tab = document.createElement('span')
      tab.contentEditable = 'false'
      tab.className = 'qn-tab-stop'
      tab.dataset.type = 'tabStop'

      let currentNode = node
      let frame = 0

      const segmentRange = (root, decimalOnly = false) => {
        const range = document.createRange()
        range.setStartAfter(tab)
        const tabs = [...root.querySelectorAll('.qn-tab-stop')]
        const nextTab = tabs[tabs.indexOf(tab) + 1]
        if (nextTab) range.setEndBefore(nextTab)
        else range.setEnd(root, root.childNodes.length)

        if (!decimalOnly) return range
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
        let afterCurrentTab = false
        while (walker.nextNode()) {
          const textNode = walker.currentNode
          if (!afterCurrentTab) {
            const relation = tab.compareDocumentPosition(textNode)
            afterCurrentTab = Boolean(relation & Node.DOCUMENT_POSITION_FOLLOWING)
          }
          if (!afterCurrentTab) continue
          if (nextTab && (nextTab.compareDocumentPosition(textNode) & Node.DOCUMENT_POSITION_FOLLOWING)) break
          const decimalIndex = textNode.nodeValue?.indexOf('.') ?? -1
          if (decimalIndex >= 0) {
            range.setEnd(textNode, decimalIndex)
            break
          }
        }
        return range
      }

      const syncWidth = () => {
        cancelAnimationFrame(frame)
        frame = requestAnimationFrame(() => {
          const root = tab.closest('p, h1, h2, h3, h4, h5, h6')
          const editor = tab.closest('.ProseMirror')
          if (!root || !editor || !tab.isConnected) return
          const editorRect = editor.getBoundingClientRect()
          const editorStyle = getComputedStyle(editor)
          const contentLeft = editorRect.left + (parseFloat(editorStyle.paddingLeft) || 0)
          const currentX = tab.getBoundingClientRect().left - contentLeft
          const type = TAB_TYPES.has(currentNode.attrs.type) ? currentNode.attrs.type : 'left'
          const followingWidth = type === 'left'
            ? 0
            : segmentRange(root, type === 'decimal').getBoundingClientRect().width
          const adjustment = type === 'center' ? followingWidth / 2 : followingWidth
          const width = Math.max(8, Number(currentNode.attrs.stop) - currentX - adjustment)
          const roundedWidth = Math.round(width)
          tab.style.width = `${roundedWidth}px`
          tab.dataset.width = String(roundedWidth)
          tab.dataset.tabType = type
          tab.dataset.stop = String(Math.round(Number(currentNode.attrs.stop) || 48))
          tab.setAttribute('aria-label', `${type} tab at ${tab.dataset.stop} pixels`)
        })
      }

      const observer = new MutationObserver(syncWidth)
      queueMicrotask(() => {
        if (tab.parentElement) observer.observe(tab.parentElement, { childList: true, subtree: true, characterData: true })
        syncWidth()
      })

      return {
        dom: tab,
        update: (updatedNode) => {
          if (updatedNode.type !== this.type) return false
          currentNode = updatedNode
          syncWidth()
          return true
        },
        destroy: () => {
          cancelAnimationFrame(frame)
          observer.disconnect()
        },
      }
    }
  },
})

export default TabStopExtension
