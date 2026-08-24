import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

const A4_RATIO = 297 / 210
const PAGE_GAP = 24
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
  })
)

const createPageGap = (details) => {
  const gap = document.createElement(details.insideList ? 'li' : 'div')
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
  const rect = dom.getBoundingClientRect()
  const style = getComputedStyle(dom)
  const decorationHeight = [...dom.querySelectorAll('.qn-page-gap')]
    .reduce((total, gap) => total + gap.getBoundingClientRect().height, 0)
  return Math.max(0, rect.height - decorationHeight + (parseFloat(style.marginTop) || 0) + (parseFloat(style.marginBottom) || 0))
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
            const compact = window.matchMedia?.('(max-width: 767px)').matches
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
            const pageWidth = editorRect.width
            const paddingLeft = parseFloat(style.paddingLeft) || 0
            const paddingRight = parseFloat(style.paddingRight) || 0
            const paddingTop = parseFloat(style.paddingTop) || 0
            const paddingBottom = parseFloat(style.paddingBottom) || 0
            const contentOffsetLeft = paddingLeft + (parseFloat(style.borderLeftWidth) || 0)
            const pageHeight = pageWidth * A4_RATIO
            const contentHeight = Math.max(160, pageHeight - paddingTop - paddingBottom)
            const breaks = []
            let used = 0
            let pageCount = 1

            const addBreak = ({ position, manual = false, offsetLeft = contentOffsetLeft, insideList = false }) => {
              breaks.push({
                position,
                fill: Math.max(0, Math.round(contentHeight - used)),
                pageWidth,
                paddingLeft,
                paddingRight,
                paddingTop,
                paddingBottom,
                offsetLeft: Math.max(0, Math.round(offsetLeft)),
                insideList,
                manual,
              })
              used = 0
              pageCount += 1
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
                  ? listDom.getBoundingClientRect().left - editorRect.left
                  : paddingLeft

                items.forEach((item) => {
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

              if (used > 0 && used + height > contentHeight) {
                addBreak({ position })
              }
              used += height
            })

            view.dom.dataset.pageCount = String(pageCount)
            view.dom.style.setProperty('--qn-paginated-min-height', `${Math.round(pageCount * pageHeight + (pageCount - 1) * PAGE_GAP)}px`)
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
