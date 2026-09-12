export const A4_RATIO = 297 / 210
export const PAGE_GAP = 24

const positiveNumber = (value, fallback = 1) => {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : fallback
}

export const getDocumentPageGeometry = ({
  pageWidth,
  pageCount = 1,
  scale = 1,
  pageTop = 0,
} = {}) => {
  const width = positiveNumber(pageWidth)
  const count = Math.max(1, Math.trunc(positiveNumber(pageCount)))
  const visualScale = positiveNumber(scale)
  const pageHeight = width * A4_RATIO
  const pageGap = PAGE_GAP * visualScale

  return {
    pageWidth: width,
    pageHeight,
    pageCount: count,
    pageGap,
    pageTop: Number.isFinite(Number(pageTop)) ? Number(pageTop) : 0,
    totalHeight: (count * pageHeight) + ((count - 1) * pageGap),
  }
}

export const getDocumentPageTop = (pageIndex, geometry) => (
  geometry.pageTop + (Math.max(0, pageIndex) * (geometry.pageHeight + geometry.pageGap))
)

export const getDocumentPageCount = (editorElement) => {
  if (!editorElement) return 1
  const declared = Number.parseInt(editorElement.dataset.pageCount || '1', 10) || 1
  const decorated = editorElement.querySelectorAll?.('.qn-page-gap').length + 1 || 1
  return Math.max(1, declared, decorated)
}
