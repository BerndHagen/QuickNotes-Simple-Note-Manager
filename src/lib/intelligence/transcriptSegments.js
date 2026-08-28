const overlapScore = (left, right) => {
  const leftStart = Number(left?.sourceTimeRange?.startMs ?? left?.startMs ?? 0)
  const leftEnd = Number(left?.sourceTimeRange?.endMs ?? left?.endMs ?? leftStart)
  const rightStart = Number(right?.startMs ?? 0)
  const rightEnd = Number(right?.endMs ?? rightStart)
  const intersection = Math.max(0, Math.min(leftEnd, rightEnd) - Math.max(leftStart, rightStart))
  const union = Math.max(leftEnd, rightEnd) - Math.min(leftStart, rightStart)
  return union > 0 ? intersection / union : leftStart === rightStart ? 1 : 0
}

export function matchTranscriptSegments(existingRows = [], segments = []) {
  const available = [...existingRows].sort((left, right) =>
    (left.sourceTimeRange?.startMs || 0) - (right.sourceTimeRange?.startMs || 0) || left.id.localeCompare(right.id)
  )
  const used = new Set()
  return segments.map((segment) => {
    let match = null
    let bestScore = 0
    for (const row of available) {
      if (used.has(row.id)) continue
      const score = overlapScore(row, segment)
      if (score > bestScore) {
        bestScore = score
        match = row
      }
    }
    if (bestScore < 0.25) {
      match = available
        .filter((row) => !used.has(row.id))
        .map((row) => ({ row, distance: Math.abs((row.sourceTimeRange?.startMs || 0) - segment.startMs) }))
        .filter(({ distance }) => distance <= 1_000)
        .sort((left, right) => left.distance - right.distance)[0]?.row || null
    }
    if (match) used.add(match.id)
    return { segment, existing: match }
  })
}
