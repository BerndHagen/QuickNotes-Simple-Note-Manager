import TableHeader from '@tiptap/extension-table-header'
export const CustomTableHeader = TableHeader.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      backgroundColor: {
        default: null,
        parseHTML: element => element.style.backgroundColor || element.getAttribute('data-background-color'),
        renderHTML: attributes => {
          if (!attributes.backgroundColor) {
            return {}
          }

          return {
            'data-background-color': attributes.backgroundColor,
            style: `background-color: ${attributes.backgroundColor}`,
          }
        },
      },
      borderColor: {
        default: null,
        parseHTML: element => element.style.borderColor || element.getAttribute('data-border-color'),
        renderHTML: attributes => {
          if (!attributes.borderColor) {
            return {}
          }

          return {
            'data-border-color': attributes.borderColor,
            style: `border-color: ${attributes.borderColor}`,
          }
        },
      },
    }
  },
})

export default CustomTableHeader
