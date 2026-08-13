import TaskItem from '@tiptap/extension-task-item'

const CHECKBOX_STYLES = new Set(['square', 'rounded', 'circle'])

const StyledTaskItem = TaskItem.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      checkboxStyle: {
        default: 'rounded',
        parseHTML: (element) => {
          const value = element.getAttribute('data-checkbox-style')
          return CHECKBOX_STYLES.has(value) ? value : 'rounded'
        },
        renderHTML: ({ checkboxStyle }) => ({
          'data-checkbox-style': CHECKBOX_STYLES.has(checkboxStyle) ? checkboxStyle : 'rounded',
        }),
      },
    }
  },
})

export default StyledTaskItem
