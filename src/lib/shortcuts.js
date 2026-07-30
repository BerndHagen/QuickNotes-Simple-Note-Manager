import { useEffect } from 'react'

const STORAGE_KEY = 'quicknotes-shortcuts'

/**
 * Application shortcuts.
 *
 * `owner: 'app'`    — bound by useAppShortcuts and user-customisable.
 * `owner: 'editor'` — provided by TipTap's own keymap. Listed so the
 *                     shortcuts dialog is complete, but not rebindable:
 *                     the editor owns those keys, and registering them
 *                     at document level is what previously made Ctrl+I
 *                     open the Import dialog mid-sentence.
 *
 * `whileTyping: true` means the shortcut still fires when focus is in a
 * text field or the editor. Everything else is suppressed there so
 * typing never triggers navigation.
 */
export const DEFAULT_SHORTCUTS = {
  newNote: { key: 'n', ctrl: true, owner: 'app', whileTyping: true, description: 'New quick note' },
  globalSearch: { key: 'k', ctrl: true, owner: 'app', whileTyping: true, description: 'Search all notes' },
  findReplace: { key: 'f', ctrl: true, owner: 'app', whileTyping: true, description: 'Find & replace in note' },
  toggleSidebar: { key: '\\', ctrl: true, owner: 'app', whileTyping: true, description: 'Toggle sidebar' },
  focusMode: { key: 'f', ctrl: true, shift: true, owner: 'app', whileTyping: true, description: 'Focus mode' },
  settings: { key: ',', ctrl: true, owner: 'app', description: 'Open settings' },
  shortcuts: { key: '/', ctrl: true, owner: 'app', description: 'Keyboard shortcuts' },
  templates: { key: 't', ctrl: true, owner: 'app', description: 'Insert template' },
  export: { key: 'e', ctrl: true, shift: true, owner: 'app', description: 'Export note' },
  import: { key: 'i', ctrl: true, shift: true, owner: 'app', description: 'Import notes' },
  duplicate: { key: 'd', ctrl: true, shift: true, owner: 'app', description: 'Duplicate note' },
  archive: { key: 'a', ctrl: true, shift: true, owner: 'app', description: 'Archive note' },
  insertLink: { key: 'k', ctrl: true, shift: true, owner: 'app', whileTyping: true, description: 'Insert note link' },

  bold: { key: 'b', ctrl: true, owner: 'editor', description: 'Bold' },
  italic: { key: 'i', ctrl: true, owner: 'editor', description: 'Italic' },
  underline: { key: 'u', ctrl: true, owner: 'editor', description: 'Underline' },
  strikethrough: { key: 'x', ctrl: true, shift: true, owner: 'editor', description: 'Strikethrough' },
  undo: { key: 'z', ctrl: true, owner: 'editor', description: 'Undo' },
  redo: { key: 'y', ctrl: true, owner: 'editor', description: 'Redo' },
  heading1: { key: '1', ctrl: true, alt: true, owner: 'editor', description: 'Heading 1' },
  heading2: { key: '2', ctrl: true, alt: true, owner: 'editor', description: 'Heading 2' },
  heading3: { key: '3', ctrl: true, alt: true, owner: 'editor', description: 'Heading 3' },
  bulletList: { key: '8', ctrl: true, shift: true, owner: 'editor', description: 'Bullet list' },
  numberedList: { key: '7', ctrl: true, shift: true, owner: 'editor', description: 'Numbered list' },
  taskList: { key: '9', ctrl: true, shift: true, owner: 'editor', description: 'Task list' },
  quote: { key: 'b', ctrl: true, shift: true, owner: 'editor', description: 'Block quote' },
  codeBlock: { key: 'c', ctrl: true, alt: true, owner: 'editor', description: 'Code block' },
}

export const isCustomisable = (action) => DEFAULT_SHORTCUTS[action]?.owner === 'app'

export const loadShortcuts = () => {
  const merged = {}
  for (const [action, def] of Object.entries(DEFAULT_SHORTCUTS)) merged[action] = { ...def }
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    for (const [action, override] of Object.entries(saved)) {
      // Editor-owned keys are not ours to rebind, and unknown actions
      // from an older build must not resurrect dead handlers.
      if (!isCustomisable(action)) continue
      merged[action] = { ...merged[action], ...override, owner: 'app' }
    }
  } catch {
    /* corrupt payload — fall back to defaults */
  }
  return merged
}

export const saveShortcuts = (shortcuts) => {
  const overrides = {}
  for (const [action, shortcut] of Object.entries(shortcuts)) {
    if (!isCustomisable(action)) continue
    const def = DEFAULT_SHORTCUTS[action]
    const changed =
      shortcut.key !== def.key ||
      !!shortcut.ctrl !== !!def.ctrl ||
      !!shortcut.alt !== !!def.alt ||
      !!shortcut.shift !== !!def.shift
    if (changed) {
      overrides[action] = {
        key: shortcut.key,
        ctrl: !!shortcut.ctrl,
        alt: !!shortcut.alt,
        shift: !!shortcut.shift,
      }
    }
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides))
  window.dispatchEvent(new CustomEvent('quicknotes:shortcuts-changed'))
}

const isApple = () =>
  typeof navigator !== 'undefined' && /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent)

export const formatShortcut = (shortcut) => {
  if (!shortcut?.key) return '—'
  const apple = isApple()
  const parts = []
  if (shortcut.ctrl) parts.push(apple ? '⌘' : 'Ctrl')
  if (shortcut.alt) parts.push(apple ? '⌥' : 'Alt')
  if (shortcut.shift) parts.push(apple ? '⇧' : 'Shift')

  const named = {
    ' ': 'Space',
    Escape: 'Esc',
    Delete: 'Del',
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
    '\\': '\\',
  }
  const key = named[shortcut.key] || (shortcut.key.length === 1 ? shortcut.key.toUpperCase() : shortcut.key)
  parts.push(key)
  return parts.join(apple ? '' : ' + ')
}

export const matchesShortcut = (event, shortcut) => {
  if (!shortcut?.key) return false
  // Cmd on Apple keyboards maps to the same slot as Ctrl elsewhere.
  const ctrl = event.ctrlKey || event.metaKey
  return (
    !!shortcut.ctrl === ctrl &&
    !!shortcut.alt === event.altKey &&
    !!shortcut.shift === event.shiftKey &&
    event.key.toLowerCase() === shortcut.key.toLowerCase()
  )
}

export const isTypingTarget = (target) => {
  if (!target) return false
  const tag = target.tagName
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target.isContentEditable === true ||
    !!target.closest?.('.ProseMirror')
  )
}

/**
 * Binds `handlers` (keyed by action name) to the user's current
 * bindings and keeps them in sync when the shortcuts dialog saves.
 */
export function useAppShortcuts(handlers, { enabled = true } = {}) {
  useEffect(() => {
    if (!enabled) return
    let shortcuts = loadShortcuts()

    const reload = () => {
      shortcuts = loadShortcuts()
    }

    const onKeyDown = (event) => {
      if (event.defaultPrevented) return
      const typing = isTypingTarget(event.target)

      for (const [action, handler] of Object.entries(handlers)) {
        if (!handler) continue
        const shortcut = shortcuts[action]
        if (!shortcut || shortcut.owner !== 'app') continue
        if (typing && !shortcut.whileTyping) continue
        if (!matchesShortcut(event, shortcut)) continue

        event.preventDefault()
        handler(event)
        return
      }
    }

    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('quicknotes:shortcuts-changed', reload)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('quicknotes:shortcuts-changed', reload)
    }
  }, [handlers, enabled])
}
