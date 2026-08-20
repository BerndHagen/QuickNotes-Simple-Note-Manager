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
      && item.paddingTop === candidate.paddingTop
      && item.paddingBottom === candidate.paddingBottom
      && item.manual === candidate.manual
  })
)

const createPageGap = (details) => {
  const gap = document.createElement('div')
  const remaining = document.createElement('span')
  const gutter = document.createElement('span')
  const nextPageTop = document.createElement('span')

  gap.className = 'qn-page-gap'
  gap.contentEditable = 'false'
  gap.dataset.pageBreak = details.manual ? 'manual' : 'automatic'
  gap.setAttribute('aria-hidden', 'true')
  gap.style.width = `${details.pageWidth}px`
  gap.style.marginLeft = `${-details.paddingLeft}px`

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
            const style = getComputedStyle(view.dom)
            const pageWidth = view.dom.clientWidth
            const paddingLeft = parseFloat(style.paddingLeft) || 0
            const paddingRight = parseFloat(style.paddingRight) || 0
            const paddingTop = parseFloat(style.paddingTop) || 0
            const paddingBottom = parseFloat(style.paddingBottom) || 0
            const pageHeight = pageWidth * A4_RATIO
            const contentHeight = Math.max(160, pageHeight - paddingTop - paddingBottom)
            const breaks = []
            let used = 0
            let pageCount = 1

            view.state.doc.forEach((node, position) => {
              if (node.type.name === 'pageBreak') {
                breaks.push({
                  position,
                  fill: Math.max(0, Math.round(contentHeight - used)),
                  pageWidth,
                  paddingLeft,
                  paddingRight,
                  paddingTop,
                  paddingBottom,
                  manual: true,
                })
                used = 0
                pageCount += 1
                return
              }

              const height = measureBlockHeight(view, position)
              if (used > 0 && used + height > contentHeight) {
                breaks.push({
                  position,
                  fill: Math.max(0, Math.round(contentHeight - used)),
                  pageWidth,
                  paddingLeft,
                  paddingRight,
                  paddingTop,
                  paddingBottom,
                  manual: false,
                })
                used = height
                pageCount += 1
              } else {
                used += height
              }
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
