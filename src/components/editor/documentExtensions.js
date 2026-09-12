import Link from '@tiptap/extension-link'
import { Extension } from '@tiptap/core'

export const NoteAwareLink = Link.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      'data-note-id': {
        default: null,
        parseHTML: (element) => element.getAttribute('data-note-id'),
        renderHTML: (attributes) => (
          attributes['data-note-id']
            ? { 'data-note-id': attributes['data-note-id'] }
            : {}
        ),
      },
      'data-note-anchor-id': {
        default: null,
        parseHTML: (element) => element.getAttribute('data-note-anchor-id'),
        renderHTML: (attributes) => attributes['data-note-anchor-id']
          ? { 'data-note-anchor-id': attributes['data-note-anchor-id'] }
          : {},
      },
      'data-note-object-id': {
        default: null,
        parseHTML: (element) => element.getAttribute('data-note-object-id'),
        renderHTML: (attributes) => attributes['data-note-object-id']
          ? { 'data-note-object-id': attributes['data-note-object-id'] }
          : {},
      },
    }
  },
})

export const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() {
    return { types: ['textStyle'] }
  },
  addGlobalAttributes() {
    return [{
      types: this.options.types,
      attributes: {
        fontSize: {
          default: null,
          parseHTML: (element) => element.style.fontSize?.replace(/['"]+/g, ''),
          renderHTML: (attributes) => attributes.fontSize
            ? { style: `font-size: ${attributes.fontSize}` }
            : {},
        },
      },
    }]
  },
  addCommands() {
    return {
      setFontSize: (fontSize) => ({ chain }) => chain().setMark('textStyle', { fontSize }).run(),
      unsetFontSize: () => ({ chain }) => chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run(),
    }
  },
})

export const LineHeight = Extension.create({
  name: 'lineHeight',
  addOptions() {
    return { types: ['paragraph', 'heading'], defaultLineHeight: '1.5' }
  },
  addGlobalAttributes() {
    return [{
      types: this.options.types,
      attributes: {
        lineHeight: {
          default: this.options.defaultLineHeight,
          parseHTML: (element) => element.style.lineHeight || this.options.defaultLineHeight,
          renderHTML: (attributes) => (
            !attributes.lineHeight || attributes.lineHeight === this.options.defaultLineHeight
              ? {}
              : { style: `line-height: ${attributes.lineHeight}` }
          ),
        },
      },
    }]
  },
  addCommands() {
    return {
      setLineHeight: (lineHeight) => ({ commands }) => (
        this.options.types.every((type) => commands.updateAttributes(type, { lineHeight }))
      ),
      unsetLineHeight: () => ({ commands }) => (
        this.options.types.every((type) => commands.resetAttributes(type, 'lineHeight'))
      ),
    }
  },
})

export const LetterSpacing = Extension.create({
  name: 'letterSpacing',
  addOptions() {
    return { types: ['textStyle'], defaultSpacing: 'normal' }
  },
  addGlobalAttributes() {
    return [{
      types: this.options.types,
      attributes: {
        letterSpacing: {
          default: this.options.defaultSpacing,
          parseHTML: (element) => element.style.letterSpacing || this.options.defaultSpacing,
          renderHTML: (attributes) => (
            !attributes.letterSpacing || attributes.letterSpacing === this.options.defaultSpacing
              ? {}
              : { style: `letter-spacing: ${attributes.letterSpacing}` }
          ),
        },
      },
    }]
  },
  addCommands() {
    return {
      setLetterSpacing: (letterSpacing) => ({ chain }) => chain().setMark('textStyle', { letterSpacing }).run(),
      unsetLetterSpacing: () => ({ chain }) => chain().setMark('textStyle', { letterSpacing: null }).removeEmptyTextStyle().run(),
    }
  },
})

export const DropCap = Extension.create({
  name: 'dropCap',
  addOptions() {
    return { types: ['paragraph'] }
  },
  addGlobalAttributes() {
    return [{
      types: this.options.types,
      attributes: {
        dropCap: {
          default: false,
          parseHTML: (element) => element.hasAttribute('data-drop-cap'),
          renderHTML: (attributes) => attributes.dropCap
            ? { 'data-drop-cap': '', class: 'drop-cap' }
            : {},
        },
      },
    }]
  },
  addCommands() {
    return {
      setDropCap: () => ({ commands }) => commands.updateAttributes('paragraph', { dropCap: true }),
      unsetDropCap: () => ({ commands }) => commands.updateAttributes('paragraph', { dropCap: false }),
    }
  },
})
