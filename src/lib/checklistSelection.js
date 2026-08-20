/**
 * Return the checklist items whose own text is covered by the current
 * selection. Looking only at each item's direct text block avoids treating a
 * parent item as selected merely because a nested checklist is selected.
 */
export const getSelectedTaskItems = (state) => {
  if (!state?.doc || !state?.selection) return []
  const { from, to, empty, $from } = state.selection

  if (empty) {
    for (let depth = $from.depth; depth > 0; depth -= 1) {
      if ($from.node(depth).type.name === 'taskItem') {
        return [{ node: $from.node(depth), pos: $from.before(depth) }]
      }
    }
    return []
  }

  const items = []
  state.doc.descendants((node, pos) => {
    if (node.type.name !== 'taskItem') return true

    let directTextStart = pos + 1
    let directTextEnd = pos + node.nodeSize - 1
    node.forEach((child, offset) => {
      if (!child.isTextblock || directTextStart !== pos + 1) return
      directTextStart = pos + 2 + offset
      directTextEnd = directTextStart + child.content.size
    })

    if (from <= directTextEnd && to >= directTextStart) items.push({ node, pos })
    return true
  })
  return items
}
