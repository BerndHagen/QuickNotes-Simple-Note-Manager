const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Builds the expression used by the editor's find controls. The result is
 * explicit about invalid input so the UI can explain why search stopped.
 */
export function createEditorSearchPattern(
  query,
  { caseSensitive = false, wholeWord = false, useRegex = false } = {}
) {
  if (!query) return { pattern: null, error: '' }

  try {
    let source = useRegex ? query : escapeRegExp(query)
    if (wholeWord) {
      source = `(?<![\\p{L}\\p{N}_])(?:${source})(?![\\p{L}\\p{N}_])`
    }

    return {
      pattern: new RegExp(source, caseSensitive ? 'gu' : 'giu'),
      error: '',
    }
  } catch (error) {
    return {
      pattern: null,
      error: error instanceof SyntaxError ? 'Enter a valid regular expression.' : 'Search failed.',
    }
  }
}
const collectTextRuns = (doc) => {
  const runs = []

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return

    const previous = runs[runs.length - 1]
    if (previous && previous.end === pos) {
      previous.text += node.text
      previous.end += node.text.length
      return
    }

    runs.push({ from: pos, end: pos + node.text.length, text: node.text })
  })

  return runs
}

/**
 * Maps text matches back to ProseMirror positions. Adjacent text nodes are
 * searched as one run so a mark boundary does not make a word unfindable;
 * block boundaries remain separate runs.
 */
export function findEditorMatches(doc, pattern) {
  if (!doc || !pattern) return { matches: [], error: '' }

  const matches = []
  let foundEmptyMatch = false

  for (const run of collectTextRuns(doc)) {
    const expression = new RegExp(pattern.source, pattern.flags)
    let match

    while ((match = expression.exec(run.text)) !== null) {
      if (match[0].length === 0) {
        foundEmptyMatch = true
        expression.lastIndex += 1
        continue
      }

      matches.push({
        from: run.from + match.index,
        to: run.from + match.index + match[0].length,
        text: match[0],
      })
    }
  }

  return {
    matches,
    error: foundEmptyMatch ? 'Patterns that match an empty position are not supported.' : '',
  }
}
