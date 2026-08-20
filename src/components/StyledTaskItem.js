import TaskItem from '@tiptap/extension-task-item'
import { mergeAttributes } from '@tiptap/core'

const CHECKBOX_STYLES = new Set(['square', 'rounded', 'circle'])
const CHECKBOX_COLORS = new Set(['accent', 'blue', 'purple', 'amber', 'rose', 'slate'])
const CHECKBOX_SIZES = new Set(['compact', 'standard', 'large'])
const CHECKED_STYLES = new Set(['strike', 'fade', 'keep'])

const checkboxVisualSpec = () => [
  'span',
  { class: 'qn-task-checkbox-visual', 'aria-hidden': 'true' },
  [
    'svg',
    { viewBox: '0 0 16 16', focusable: 'false' },
    ['path', {
      d: 'M3.25 8.25 6.35 11.25 12.75 4.85',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '2.15',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    }],
  ],
]

const StyledTaskItem = TaskItem.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      checkboxStyle: {
        default: 'rounded',
        keepOnSplit: true,
        parseHTML: (element) => {
          const value = element.getAttribute('data-checkbox-style')
          return CHECKBOX_STYLES.has(value) ? value : 'rounded'
        },
        renderHTML: ({ checkboxStyle }) => ({
          'data-checkbox-style': CHECKBOX_STYLES.has(checkboxStyle) ? checkboxStyle : 'rounded',
        }),
      },
      checkboxColor: {
        default: 'accent',
        keepOnSplit: true,
        parseHTML: (element) => {
          const value = element.getAttribute('data-checkbox-color')
          return CHECKBOX_COLORS.has(value) ? value : 'accent'
        },
        renderHTML: ({ checkboxColor }) => ({
          'data-checkbox-color': CHECKBOX_COLORS.has(checkboxColor) ? checkboxColor : 'accent',
        }),
      },
      checkboxSize: {
        default: 'standard',
        keepOnSplit: true,
        parseHTML: (element) => {
          const value = element.getAttribute('data-checkbox-size')
          return CHECKBOX_SIZES.has(value) ? value : 'standard'
        },
        renderHTML: ({ checkboxSize }) => ({
          'data-checkbox-size': CHECKBOX_SIZES.has(checkboxSize) ? checkboxSize : 'standard',
        }),
      },
      checkedStyle: {
        default: 'strike',
        keepOnSplit: true,
        parseHTML: (element) => {
          const value = element.getAttribute('data-checked-style')
          return CHECKED_STYLES.has(value) ? value : 'strike'
        },
        renderHTML: ({ checkedStyle }) => ({
          'data-checked-style': CHECKED_STYLES.has(checkedStyle) ? checkedStyle : 'strike',
        }),
      },
    }
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'li',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': this.name,
      }),
      [
        'label',
        { class: 'qn-task-checkbox' },
        ['input', {
          type: 'checkbox',
          checked: node.attrs.checked ? 'checked' : null,
        }],
        checkboxVisualSpec(),
      ],
      ['div', 0],
    ]
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      const listItem = document.createElement('li')
      const checkboxWrapper = document.createElement('label')
      const checkboxStyler = document.createElement('span')
      const checkbox = document.createElement('input')
      const content = document.createElement('div')
      const checkmark = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      const checkmarkPath = document.createElementNS('http://www.w3.org/2000/svg', 'path')

      checkboxWrapper.contentEditable = 'false'
      checkboxWrapper.className = 'qn-task-checkbox'
      checkboxStyler.className = 'qn-task-checkbox-visual'
      checkboxStyler.ariaHidden = 'true'
      checkbox.type = 'checkbox'
      checkmark.setAttribute('viewBox', '0 0 16 16')
      checkmark.setAttribute('focusable', 'false')
      checkmarkPath.setAttribute('d', 'M3.25 8.25 6.35 11.25 12.75 4.85')
      checkmarkPath.setAttribute('fill', 'none')
      checkmarkPath.setAttribute('stroke', 'currentColor')
      checkmarkPath.setAttribute('stroke-width', '2.15')
      checkmarkPath.setAttribute('stroke-linecap', 'round')
      checkmarkPath.setAttribute('stroke-linejoin', 'round')
      checkmark.append(checkmarkPath)
      checkboxStyler.append(checkmark)
      checkboxWrapper.append(checkbox, checkboxStyler)
      listItem.append(checkboxWrapper, content)

      Object.entries(this.options.HTMLAttributes || {}).forEach(([key, value]) => {
        listItem.setAttribute(key, value)
      })
      listItem.setAttribute('data-type', this.name)

      const syncAttributes = (currentNode) => {
        const {
          checked,
          checkboxStyle,
          checkboxColor,
          checkboxSize,
          checkedStyle,
        } = currentNode.attrs
        listItem.dataset.checked = String(Boolean(checked))
        listItem.dataset.checkboxStyle = CHECKBOX_STYLES.has(checkboxStyle) ? checkboxStyle : 'rounded'
        listItem.dataset.checkboxColor = CHECKBOX_COLORS.has(checkboxColor) ? checkboxColor : 'accent'
        listItem.dataset.checkboxSize = CHECKBOX_SIZES.has(checkboxSize) ? checkboxSize : 'standard'
        listItem.dataset.checkedStyle = CHECKED_STYLES.has(checkedStyle) ? checkedStyle : 'strike'
        checkbox.checked = Boolean(checked)
        checkbox.ariaLabel = this.options.a11y?.checkboxLabel?.(currentNode, checkbox.checked)
          || `Task item checkbox for ${currentNode.textContent || 'empty task item'}`
      }

      const handleChange = (event) => {
        if (!editor.isEditable && !this.options.onReadOnlyChecked) {
          checkbox.checked = !checkbox.checked
          return
        }
        const checked = event.target.checked
        if (editor.isEditable && typeof getPos === 'function') {
          editor.chain().focus(undefined, { scrollIntoView: false }).command(({ tr }) => {
            const position = getPos()
            if (typeof position !== 'number') return false
            const currentNode = tr.doc.nodeAt(position)
            if (!currentNode) return false
            tr.setNodeMarkup(position, undefined, { ...currentNode.attrs, checked })
            return true
          }).run()
        } else if (this.options.onReadOnlyChecked && !this.options.onReadOnlyChecked(node, checked)) {
          checkbox.checked = !checkbox.checked
        }
      }

      const preventMouseSelection = (event) => event.preventDefault()
      checkbox.addEventListener('mousedown', preventMouseSelection)
      checkbox.addEventListener('change', handleChange)
      syncAttributes(node)

      return {
        dom: listItem,
        contentDOM: content,
        update: (updatedNode) => {
          if (updatedNode.type !== this.type) return false
          syncAttributes(updatedNode)
          return true
        },
        destroy: () => {
          checkbox.removeEventListener('mousedown', preventMouseSelection)
          checkbox.removeEventListener('change', handleChange)
        },
      }
    }
  },
})

export default StyledTaskItem
