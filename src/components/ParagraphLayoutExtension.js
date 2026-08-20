import { Extension } from '@tiptap/core'

const INDENT_STEP = 40
const MAX_INDENT = 480
const TEXT_BLOCK_TYPES = new Set(['paragraph', 'heading'])
const TAB_TYPES = new Set(['left', 'center', 'right', 'decimal'])

const clamp = (value, minimum = 0, maximum = MAX_INDENT) =>
  Math.min(maximum, Math.max(minimum, Math.round(Number(value) || 0)))

const parseNumber = (value) => clamp(parseFloat(value) || 0)
const parseSpacing = (value) => clamp(parseFloat(value) || 0, 0, 160)

const normalizeTabStops = (stops) => {
  if (!Array.isArray(stops)) return []
  const normalized = stops.map((stop) => ({
    position: clamp(typeof stop === 'number' ? stop : stop?.position, 8, 2000),
    type: TAB_TYPES.has(stop?.type) ? stop.type : 'left',
  }))
  return normalized
    .filter((stop, index) => normalized.findIndex((candidate) => (
      candidate.position === stop.position && candidate.type === stop.type
    )) === index)
    .sort((first, second) => first.position - second.position)
}

const parseTabStops = (value) => {
  if (!value) return []
  try {
    return normalizeTabStops(JSON.parse(value))
  } catch {
    return []
  }
}

const paragraphPositions = (state) => {
  const positions = new Set()
  const { from, to, $from } = state.selection
  state.doc.nodesBetween(from, to, (node, pos) => {
    if (TEXT_BLOCK_TYPES.has(node.type.name)) positions.add(pos)
  })

  if (positions.size === 0) {
    for (let depth = $from.depth; depth > 0; depth -= 1) {
      if (TEXT_BLOCK_TYPES.has($from.node(depth).type.name)) {
        positions.add($from.before(depth))
        break
      }
    }
  }
  return [...positions]
}

const updateParagraphs = (state, dispatch, updater) => {
  const positions = paragraphPositions(state)
  if (positions.length === 0) return false
  if (!dispatch) return true

  const tr = state.tr
  positions.forEach((pos) => {
    const node = tr.doc.nodeAt(pos)
    if (!node) return
    tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...updater(node.attrs) })
  })
  dispatch(tr)
  return true
}

/**
 * Persistent paragraph geometry used by both ribbon commands and the ruler.
 * Values are stored as node attributes so they round-trip through HTML.
 */
const ParagraphLayoutExtension = Extension.create({
  name: 'paragraphLayout',

  addGlobalAttributes() {
    return [{
      types: ['paragraph', 'heading'],
      attributes: {
        leftIndent: {
          default: 0,
          parseHTML: (element) => parseNumber(element.getAttribute('data-left-indent') || element.style.marginLeft),
          renderHTML: ({ leftIndent }) => leftIndent
            ? { 'data-left-indent': leftIndent, style: `margin-left:${leftIndent}px` }
            : {},
        },
        rightIndent: {
          default: 0,
          parseHTML: (element) => parseNumber(element.getAttribute('data-right-indent') || element.style.marginRight),
          renderHTML: ({ rightIndent }) => rightIndent
            ? { 'data-right-indent': rightIndent, style: `margin-right:${rightIndent}px` }
            : {},
        },
        firstLineIndent: {
          default: 0,
          parseHTML: (element) => parseFloat(element.getAttribute('data-first-line-indent') || element.style.textIndent) || 0,
          renderHTML: ({ firstLineIndent }) => firstLineIndent
            ? { 'data-first-line-indent': firstLineIndent, style: `text-indent:${firstLineIndent}px` }
            : {},
        },
        tabStops: {
          default: [],
          parseHTML: (element) => parseTabStops(element.getAttribute('data-tab-stops')),
          renderHTML: ({ tabStops }) => Array.isArray(tabStops) && tabStops.length
            ? { 'data-tab-stops': JSON.stringify(tabStops) }
            : {},
        },
        spaceBefore: {
          default: 0,
          parseHTML: (element) => parseSpacing(element.getAttribute('data-space-before') || element.style.marginTop),
          renderHTML: ({ spaceBefore }) => spaceBefore
            ? { 'data-space-before': spaceBefore, style: `margin-top:${spaceBefore}px` }
            : {},
        },
        spaceAfter: {
          default: 0,
          parseHTML: (element) => parseSpacing(element.getAttribute('data-space-after') || element.style.marginBottom),
          renderHTML: ({ spaceAfter }) => spaceAfter
            ? { 'data-space-after': spaceAfter, style: `margin-bottom:${spaceAfter}px` }
            : {},
        },
      },
    }]
  },

  addCommands() {
    return {
      increaseParagraphIndent: () => ({ state, dispatch }) =>
        updateParagraphs(state, dispatch, (attrs) => ({
          leftIndent: clamp((attrs.leftIndent || 0) + INDENT_STEP),
        })),
      decreaseParagraphIndent: () => ({ state, dispatch }) =>
        updateParagraphs(state, dispatch, (attrs) => ({
          leftIndent: clamp((attrs.leftIndent || 0) - INDENT_STEP),
        })),
      setParagraphLayout: (attributes) => ({ state, dispatch }) =>
        updateParagraphs(state, dispatch, () => ({
          ...(attributes.leftIndent !== undefined ? { leftIndent: clamp(attributes.leftIndent) } : {}),
          ...(attributes.rightIndent !== undefined ? { rightIndent: clamp(attributes.rightIndent) } : {}),
          ...(attributes.firstLineIndent !== undefined
            ? { firstLineIndent: clamp(attributes.firstLineIndent, -MAX_INDENT, MAX_INDENT) }
            : {}),
          ...(attributes.tabStops !== undefined
            ? { tabStops: normalizeTabStops(attributes.tabStops) }
            : {}),
          ...(attributes.spaceBefore !== undefined
            ? { spaceBefore: parseSpacing(attributes.spaceBefore) }
            : {}),
          ...(attributes.spaceAfter !== undefined
            ? { spaceAfter: parseSpacing(attributes.spaceAfter) }
            : {}),
        })),
    }
  },
})

export { INDENT_STEP, MAX_INDENT, normalizeTabStops }
export default ParagraphLayoutExtension
