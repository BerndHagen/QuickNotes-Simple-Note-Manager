import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { A4_RATIO, PAGE_GAP, getDocumentPageGeometry } from './editor/pageGeometry'
import { BREAKPOINTS } from '../hooks/useBreakpoint'

const paginationKey = new PluginKey('quickNotesPagination')

const sameBreaks = (first, second) => (
  first.length === second.length
  && first.every((item, index) => {
    const candidate = second[index]
    return candidate
      && item.position === candidate.position
      && item.fill === candidate.fill
      && item.pageWidth === candidate.pageWidth
      && item.paddingLeft === candidate.paddingLeft
      && item.paddingRight === candidate.paddingRight
      && item.paddingTop === candidate.paddingTop
      && item.paddingBottom === candidate.paddingBottom
      && item.manual === candidate.manual
      && item.offsetLeft === candidate.offsetLeft
      && item.insideList === candidate.insideList
      && item.inline === candidate.inline
  })
)

const createPageGap = (details) => {
  const gap = document.createElement(details.inline ? 'span' : details.insideList ? 'li' : 'div')
  const remaining = document.createElement('span')
  const gutter = document.createElement('span')
  const nextPageTop = document.createElement('span')

  gap.className = 'qn-page-gap'
  gap.contentEditable = 'false'
  gap.dataset.pageBreak = details.manual ? 'manual' : 'automatic'
  gap.setAttribute('aria-hidden', 'true')
  gap.style.width = `${details.pageWidth}px`
  gap.style.marginLeft = `${-details.offsetLeft}px`
  gap.style.listStyle = 'none'

  remaining.className = 'qn-page-gap__remaining'
  remaining.style.height = `${details.fill + details.paddingBottom}px`
  gutter.className = 'qn-page-gap__gutter'
  gutter.style.height = `${PAGE_GAP}px`
  nextPageTop.className = 'qn-page-gap__top'
  nextPageTop.style.height = `${details.paddingTop}px`
  gap.append(remaining, gutter, nextPageTop)
  return gap
}

const decorationsFor = (doc, breaks) => DecorationSet.create(
  doc,
  breaks.map((details) => Decoration.widget(
    details.position,
    () => createPageGap(details),
    { side: -100, key: `page-${details.position}-${details.manual ? 'manual' : 'auto'}` }
  ))
)

const measureBlockHeight = (view, position) => {
  const dom = view.nodeDOM(position)
  if (!(dom instanceof HTMLElement)) return 0
  const style = getComputedStyle(dom)
  const decorationHeight = [...dom.querySelectorAll('.qn-page-gap')]
    .reduce((total, gap) => total + gap.offsetHeight, 0)
  return Math.max(0, dom.offsetHeight - decorationHeight + (parseFloat(style.marginTop) || 0) + (parseFloat(style.marginBottom) || 0))
}

const listItemMeasurements = (view, node, position) => {
  const measurements = []
  node.forEach((child, offset) => {
    const childPosition = position + 1 + offset
    measurements.push({
      position: childPosition,
      height: measureBlockHeight(view, childPosition),
    })
  })
  return measurements.filter((item) => item.height > 0)
}

const mergeLineRectangles = (rectangles) => rectangles
  .sort((first, second) => first.top - second.top || first.left - second.left)
  .reduce((lines, rectangle) => {
    const line = lines[lines.length - 1]
    if (line && Math.abs(line.top - rectangle.top) <= 1) {
      line.left = Math.min(line.left, rectangle.left)
      line.right = Math.max(line.right, rectangle.right)
      line.bottom = Math.max(line.bottom, rectangle.bottom)
      line.position = Math.min(line.position, rectangle.position)
      return lines
    }
    lines.push({ ...rectangle })
    return lines
  }, [])

const characterRect = (range, textNode, offset) => {
  if (!textNode.textContent?.length) return null
  range.setStart(textNode, Math.max(0, Math.min(textNode.length - 1, offset)))
  range.setEnd(textNode, Math.max(1, Math.min(textNode.length, offset + 1)))
  return [...range.getClientRects()].find((rectangle) => rectangle.height > 0) || null
}

const firstOffsetOnLine = (range, textNode, lineTop) => {
  let low = 0
  let high = textNode.length - 1
  while (low < high) {
    const middle = Math.floor((low + high) / 2)
    const rectangle = characterRect(range, textNode, middle)
    if (!rectangle || rectangle.top < lineTop - 1) low = middle + 1
    else high = middle
  }
  return low
}

const measureTextLines = (view, node, position, height, editorRect, visualScale) => {
  const dom = view.nodeDOM(position)
  if (!(dom instanceof HTMLElement)) return []

  const range = document.createRange()
  const walker = document.createTreeWalker(dom, NodeFilter.SHOW_TEXT)
  const rectangles = []
  while (walker.nextNode()) {
    const textNode = walker.currentNode
    if (!textNode.textContent || textNode.parentElement?.closest('.qn-page-gap')) continue
    range.selectNodeContents(textNode)
    const textLines = mergeLineRectangles([...range.getClientRects()]
      .filter((rectangle) => rectangle.width > 0 && rectangle.height > 0)
      .map((rectangle) => ({
        top: rectangle.top,
        right: rectangle.right,
        bottom: rectangle.bottom,
        left: rectangle.left,
        position: Number.POSITIVE_INFINITY,
      })))
    textLines.forEach((line) => {
      const offset = firstOffsetOnLine(range, textNode, line.top)
      let linePosition
      try {
        linePosition = view.posAtDOM(textNode, offset, -1)
      } catch {
        linePosition = position + 1 + offset
      }
      rectangles.push({ ...line, position: linePosition })
    })
  }

  const lines = mergeLineRectangles(rectangles)
  if (lines.length < 2) return []
  const computedLineHeight = Number.parseFloat(getComputedStyle(dom).lineHeight)
  const lineHeight = Number.isFinite(computedLineHeight) && computedLineHeight > 0
    ? computedLineHeight
    : height / lines.length
  const minimumPosition = position + 1
  const maximumPosition = position + node.nodeSize - 1
  return lines.map((line) => ({
      position: Math.max(minimumPosition, Math.min(maximumPosition, line.position)),
      height: lineHeight,
      offsetLeft: Math.max(0, (line.left - editorRect.left) / visualScale),
    }))
    .filter((line, index, measured) => index === 0 || line.position > measured[index - 1].position)
}

const PaginationExtension = Extension.create({
  name: 'pagination',

  addProseMirrorPlugins() {
    return [new Plugin({
      key: paginationKey,
      state: {
        init: (_, state) => ({ breaks: [], decorations: DecorationSet.empty, doc: state.doc }),
        apply: (transaction, value) => {
          const measured = transaction.getMeta(paginationKey)
          if (measured) {
            return {
              breaks: measured,
              decorations: decorationsFor(transaction.doc, measured),
              doc: transaction.doc,
            }
          }
          return {
            ...value,
            decorations: value.decorations.map(transaction.mapping, transaction.doc),
            doc: transaction.doc,
          }
        },
      },
      props: {
        decorations: (state) => paginationKey.getState(state)?.decorations,
      },
      view: (view) => {
        let frame = 0
        let observer

        const measure = () => {
          cancelAnimationFrame(frame)
          frame = requestAnimationFrame(() => {
            if (!view.dom.isConnected) return
            const compact = window.matchMedia?.(BREAKPOINTS.compact).matches
            if (compact) {
              view.dom.dataset.pageCount = '1'
              view.dom.style.removeProperty('--qn-paginated-min-height')
              const current = paginationKey.getState(view.state)?.breaks || []
              if (current.length > 0) {
                view.dispatch(view.state.tr.setMeta(paginationKey, []).setMeta('addToHistory', false))
              }
              return
            }
            const style = getComputedStyle(view.dom)
            const editorRect = view.dom.getBoundingClientRect()
            // CSS workspace zoom scales the rendered editor, but pagination
            // must continue to use its stable, unscaled document geometry.
            const pageWidth = view.dom.clientWidth
            const visualScale = pageWidth > 0 ? editorRect.width / pageWidth : 1
            const paddingLeft = parseFloat(style.paddingLeft) || 0
            const paddingRight = parseFloat(style.paddingRight) || 0
            const paddingTop = parseFloat(style.paddingTop) || 0
            const paddingBottom = parseFloat(style.paddingBottom) || 0
            const contentOffsetLeft = paddingLeft + (parseFloat(style.borderLeftWidth) || 0)
            const pageGeometry = getDocumentPageGeometry({ pageWidth })
            const pageHeight = pageGeometry.pageHeight
            const contentHeight = Math.max(160, pageHeight - paddingTop - paddingBottom)
            const breaks = []
            let used = 0
            let pageCount = 1

            const addBreak = ({
              position,
              manual = false,
              offsetLeft = contentOffsetLeft,
              insideList = false,
              inline = false,
            }) => {
              breaks.push({
                position,
                // Preserve sub-pixel layout. Rounding every automatic break
                // accumulates enough error across a long document to place a
                // later line above the next page's writable top edge.
                fill: Math.max(0, contentHeight - used),
                pageWidth,
                paddingLeft,
                paddingRight,
                paddingTop,
                paddingBottom,
                offsetLeft: Math.max(0, offsetLeft),
                insideList,
                inline,
                manual,
              })
              used = 0
              pageCount += 1
            }

            const paginateOversizedBlock = ({ node, position, height, insideList = false }) => {
              if (height <= contentHeight) return false
              const lines = measureTextLines(view, node, position, height, editorRect, visualScale)
              if (lines.length < 2) return false

              lines.forEach((line, index) => {
                if (used > 0 && used + line.height > contentHeight) {
                  addBreak(index === 0
                    ? { position, offsetLeft: line.offsetLeft, insideList }
                    : { position: line.position, offsetLeft: line.offsetLeft, inline: true })
                }
                used += line.height
              })
              return true
            }

            view.state.doc.forEach((node, position) => {
              if (node.type.name === 'pageBreak') {
                addBreak({ position, manual: true })
                return
              }

              const height = measureBlockHeight(view, position)

              // A task list is one ProseMirror block even when it contains
              // hundreds of independently sized checklist rows. Treating the
              // whole list as indivisible is what let a page grow forever.
              // Paginate between its real list items so each checkbox keeps
              // its content and selection semantics while flowing to the next
              // sheet.
              if (node.type.name === 'taskList' && used + height > contentHeight) {
                const items = listItemMeasurements(view, node, position)
                const measuredItemsHeight = items.reduce((total, item) => total + item.height, 0)
                const listOverhead = Math.max(0, height - measuredItemsHeight)
                used += listOverhead / 2
                const listDom = view.nodeDOM(position)
                const offsetLeft = listDom instanceof HTMLElement
                  ? (listDom.getBoundingClientRect().left - editorRect.left) / visualScale
                  : paddingLeft

                items.forEach((item) => {
                  const itemNode = view.state.doc.nodeAt(item.position)
                  if (itemNode && paginateOversizedBlock({
                    node: itemNode,
                    position: item.position,
                    height: item.height,
                    insideList: true,
                  })) return
                  if (used > 0 && used + item.height > contentHeight) {
                    addBreak({
                      position: item.position,
                      offsetLeft,
                      insideList: true,
                    })
                  }
                  used += item.height
                })
                used += listOverhead / 2
                return
              }

              if (paginateOversizedBlock({ node, position, height })) return

              if (used > 0 && used + height > contentHeight) {
                addBreak({ position })
              }
              used += height
            })

            view.dom.dataset.pageCount = String(pageCount)
            view.dom.style.setProperty('--qn-paginated-min-height', `${getDocumentPageGeometry({ pageWidth, pageCount }).totalHeight}px`)
            const current = paginationKey.getState(view.state)?.breaks || []
            if (!sameBreaks(current, breaks)) {
              view.dispatch(view.state.tr.setMeta(paginationKey, breaks).setMeta('addToHistory', false))
            }
          })
        }

        measure()
        if (typeof ResizeObserver !== 'undefined') {
          observer = new ResizeObserver(measure)
          observer.observe(view.dom)
        }
        return {
          update: measure,
          destroy: () => {
            cancelAnimationFrame(frame)
            observer?.disconnect()
          },
        }
      },
    })]
  },
})

export { A4_RATIO, PAGE_GAP, paginationKey }
export default PaginationExtension
