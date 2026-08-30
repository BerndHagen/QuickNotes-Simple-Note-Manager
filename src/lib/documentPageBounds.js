const DEFAULT_INSET = 8

const finite = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback)

export const clamp = (value, minimum, maximum) => (
  Math.min(Math.max(minimum, maximum), Math.max(minimum, finite(value, minimum)))
)

export function selectDocumentPage(pages, rectangle) {
  if (!Array.isArray(pages) || pages.length === 0) return null

  const centreX = finite(rectangle?.x) + Math.max(0, finite(rectangle?.width)) / 2
  const centreY = finite(rectangle?.y) + Math.max(0, finite(rectangle?.height)) / 2
  const containing = pages.find((page) => (
    centreX >= page.left
    && centreX <= page.right
    && centreY >= page.top
    && centreY <= page.bottom
  ))
  if (containing) return containing

  return pages.reduce((nearest, page) => {
    const pageX = clamp(centreX, page.left, page.right)
    const pageY = clamp(centreY, page.top, page.bottom)
    const distance = Math.hypot(centreX - pageX, centreY - pageY)
    return !nearest || distance < nearest.distance ? { page, distance } : nearest
  }, null)?.page || pages[0]
}

export function constrainRectangleToPage(rectangle, page, {
  inset = DEFAULT_INSET,
  minimumWidth = 1,
  minimumHeight = 1,
} = {}) {
  if (!page) return { ...rectangle }

  const left = page.left + inset
  const top = page.top + inset
  const right = page.right - inset
  const bottom = page.bottom - inset
  const availableWidth = Math.max(1, right - left)
  const availableHeight = Math.max(1, bottom - top)
  const width = clamp(finite(rectangle?.width, minimumWidth), Math.min(minimumWidth, availableWidth), availableWidth)
  const height = clamp(finite(rectangle?.height, minimumHeight), Math.min(minimumHeight, availableHeight), availableHeight)

  return {
    x: clamp(finite(rectangle?.x, left), left, right - width),
    y: clamp(finite(rectangle?.y, top), top, bottom - height),
    width,
    height,
  }
}

export function measureDocumentPages(node) {
  const editorElement = node?.closest?.('.ProseMirror')
  const pageElement = node?.closest?.('.qn-editor-page')
  const editorRect = editorElement?.getBoundingClientRect?.()
  if (!editorElement || !pageElement || !editorRect) {
    return { editorElement, scaleX: 1, scaleY: 1, pages: [] }
  }

  const scaleX = Math.max(0.01, editorRect.width / Math.max(1, editorElement.offsetWidth || editorRect.width))
  const scaleY = Math.max(0.01, editorRect.height / Math.max(1, editorElement.offsetHeight || editorRect.height))
  const pages = [...pageElement.querySelectorAll('.qn-document-page-edge')]
    .map((element) => element.getBoundingClientRect())
    .filter((rect) => rect.width > 0 && rect.height > 0)
    .map((rect, index) => {
      const left = (rect.left - editorRect.left) / scaleX
      const top = (rect.top - editorRect.top) / scaleY
      const width = rect.width / scaleX
      const height = rect.height / scaleY
      return {
        index,
        left,
        top,
        right: left + width,
        bottom: top + height,
        width,
        height,
      }
    })

  return { editorElement, scaleX, scaleY, pages }
}

export function getDocumentObjectGeometry(node, rectangle) {
  const measurements = measureDocumentPages(node)
  return {
    ...measurements,
    page: selectDocumentPage(measurements.pages, rectangle),
  }
}
