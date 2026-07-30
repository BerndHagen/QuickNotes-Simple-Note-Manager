import { useEffect, useRef } from 'react'

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(',')

/**
 * Collects focusable descendants, skipping ones that are hidden.
 *
 * The visibility test deliberately avoids `offsetParent`: it is null for
 * position-fixed elements — which every dialog and menu in this app is —
 * and is null for everything under jsdom, so a trap built on it silently
 * degrades to "no focusable elements".
 */
export const getFocusable = (root) => {
  if (!root) return []
  return Array.from(root.querySelectorAll(FOCUSABLE)).filter((el) => {
    if (el.hasAttribute('hidden') || el.getAttribute('aria-hidden') === 'true') return false
    if (el.closest('[hidden], [aria-hidden="true"], [inert]')) return false
    const style = el.ownerDocument?.defaultView?.getComputedStyle?.(el)
    if (style && (style.display === 'none' || style.visibility === 'hidden')) return false
    return true
  })
}

/**
 * Traps Tab/Shift+Tab inside `ref`, moves initial focus into it, and
 * restores focus to whatever was focused before it opened.
 *
 * Restoring focus matters as much as trapping it: without it a keyboard
 * user is dumped back at the top of the document every time they close
 * a dialog.
 */
export function useFocusTrap(ref, active, { initialFocusRef } = {}) {
  const previouslyFocused = useRef(null)

  useEffect(() => {
    if (!active) return
    previouslyFocused.current = document.activeElement

    const node = ref.current
    if (!node) return

    // Defer so the dialog content has mounted before we look for targets.
    const focusFrame = requestAnimationFrame(() => {
      // Prefer the first control in the dialog *body*: landing on the
      // close button would make Enter dismiss the dialog the user just
      // opened.
      const body = node.querySelector('[data-dialog-body]')
      const target =
        initialFocusRef?.current ||
        node.querySelector('[data-autofocus]') ||
        (body && getFocusable(body)[0]) ||
        getFocusable(node)[0] ||
        node
      target?.focus?.({ preventScroll: true })
    })

    const handleKeyDown = (e) => {
      if (e.key !== 'Tab') return
      const focusable = getFocusable(node)
      if (focusable.length === 0) {
        e.preventDefault()
        node.focus?.()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const activeEl = document.activeElement

      if (e.shiftKey && (activeEl === first || !node.contains(activeEl))) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (activeEl === last || !node.contains(activeEl))) {
        e.preventDefault()
        first.focus()
      }
    }

    node.addEventListener('keydown', handleKeyDown)
    return () => {
      cancelAnimationFrame(focusFrame)
      node.removeEventListener('keydown', handleKeyDown)
      const toRestore = previouslyFocused.current
      if (toRestore && typeof toRestore.focus === 'function' && document.contains(toRestore)) {
        toRestore.focus({ preventScroll: true })
      }
    }
  }, [active, ref, initialFocusRef])
}

/**
 * Locks background scrolling while an overlay is open, compensating for
 * the removed scrollbar so the page underneath does not jump sideways.
 */
export function useScrollLock(active) {
  useEffect(() => {
    if (!active) return
    const { body } = document
    const previousOverflow = body.style.overflow
    const previousPadding = body.style.paddingRight
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth

    body.style.overflow = 'hidden'
    if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`

    return () => {
      body.style.overflow = previousOverflow
      body.style.paddingRight = previousPadding
    }
  }, [active])
}

/** Calls `onEscape` on Escape, only for the topmost open overlay. */
const escapeStack = []

export function useEscapeKey(active, onEscape) {
  useEffect(() => {
    if (!active) return
    const entry = { onEscape }
    escapeStack.push(entry)

    const handler = (e) => {
      if (e.key !== 'Escape') return
      if (escapeStack[escapeStack.length - 1] !== entry) return
      e.stopPropagation()
      entry.onEscape?.(e)
    }

    document.addEventListener('keydown', handler)
    return () => {
      document.removeEventListener('keydown', handler)
      const i = escapeStack.indexOf(entry)
      if (i !== -1) escapeStack.splice(i, 1)
    }
  }, [active, onEscape])
}
