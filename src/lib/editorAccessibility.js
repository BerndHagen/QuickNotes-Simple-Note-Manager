const VAGUE_LINK_TEXT = new Set(['click here', 'here', 'learn more', 'more', 'read more', 'link'])

const issue = (id, title, description, position, nodeType = 'text') => ({
  id,
  title,
  description,
  position,
  nodeType,
})

const hasTableHeader = (table) => {
  const firstRow = table.firstChild
  if (!firstRow) return false
  let foundHeader = false
  firstRow.forEach((cell) => {
    if (cell.type.name === 'tableHeader') foundHeader = true
  })
  return foundHeader
}

export const inspectEditorAccessibility = (doc) => {
  if (!doc?.descendants) return []

  const issues = []
  let previousHeadingLevel = null

  doc.descendants((node, position) => {
    if (node.type.name === 'heading') {
      const level = Number(node.attrs.level) || 1
      if (!node.textContent.trim()) {
        issues.push(issue(
          `empty-heading-${position}`,
          'Empty heading',
          'Remove the heading or add descriptive text so screen-reader navigation stays useful.',
          position,
          'heading'
        ))
      }
      if (previousHeadingLevel && level > previousHeadingLevel + 1) {
        issues.push(issue(
          `heading-order-${position}`,
          `Heading level jumps from H${previousHeadingLevel} to H${level}`,
          'Use consecutive heading levels to preserve a meaningful document outline.',
          position,
          'heading'
        ))
      }
      previousHeadingLevel = level
    }

    if (node.type.name === 'resizableImage' && !String(node.attrs.alt || '').trim()) {
      issues.push(issue(
        `image-alt-${position}`,
        'Image is missing alternative text',
        'Add a concise description in the image properties, or mark the image as decorative.',
        position,
        'resizableImage'
      ))
    }

    if (node.type.name === 'table' && !hasTableHeader(node)) {
      issues.push(issue(
        `table-header-${position}`,
        'Table has no header row',
        'Add a header row so assistive technology can identify each column.',
        position,
        'table'
      ))
    }

    if (!node.isText) return
    const link = node.marks.find((mark) => mark.type.name === 'link')
    if (!link) return
    const label = node.text.trim().toLowerCase()
    if (VAGUE_LINK_TEXT.has(label)) {
      issues.push(issue(
        `link-label-${position}`,
        `Link text “${node.text.trim()}” is not descriptive`,
        'Use link text that explains the destination when it is read out of context.',
        position,
        'text'
      ))
    }
  })

  return issues
}
