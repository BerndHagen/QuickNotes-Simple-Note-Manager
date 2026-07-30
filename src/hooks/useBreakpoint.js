import { useEffect, useState } from 'react'

/**
 * Layout breakpoints.
 *
 * These are the three *layout modes* the workspace has, not arbitrary
 * device names:
 *   compact (<768)  — one pane at a time, sidebar is an overlay drawer
 *   medium  (<1024) — list + editor, sidebar is a dismissible drawer
 *   wide    (>=1024) — all three panes persistent
 */
export const BREAKPOINTS = {
  compact: '(max-width: 767px)',
  medium: '(min-width: 768px) and (max-width: 1023px)',
  wide: '(min-width: 1024px)',
  xwide: '(min-width: 1536px)',
}

export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  )

  useEffect(() => {
    const list = window.matchMedia(query)
    const handler = (e) => setMatches(e.matches)
    setMatches(list.matches)
    list.addEventListener('change', handler)
    return () => list.removeEventListener('change', handler)
  }, [query])

  return matches
}

export function useLayoutMode() {
  const compact = useMediaQuery(BREAKPOINTS.compact)
  const medium = useMediaQuery(BREAKPOINTS.medium)
  const xwide = useMediaQuery(BREAKPOINTS.xwide)

  return {
    isCompact: compact,
    isMedium: medium,
    isWide: !compact && !medium,
    isXWide: xwide,
    /** Sidebar overlays content instead of sitting in the flow. */
    sidebarIsOverlay: compact || medium,
  }
}
