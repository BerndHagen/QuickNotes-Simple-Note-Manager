import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  DEFAULT_SHORTCUTS,
  isCustomisable,
  loadShortcuts,
  saveShortcuts,
  matchesShortcut,
  isTypingTarget,
  formatShortcut,
} from './shortcuts'

const keyEvent = (key, mods = {}) => ({
  key,
  ctrlKey: !!mods.ctrl,
  metaKey: !!mods.meta,
  altKey: !!mods.alt,
  shiftKey: !!mods.shift,
})

describe('shortcuts', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  // Ctrl+N is documented in the welcome note, the settings screen and the
  // shortcuts dialog, so it has to be bound.
  it('defines a binding for the quick-note action', () => {
    expect(DEFAULT_SHORTCUTS.newNote).toMatchObject({ key: 'n', ctrl: true, owner: 'app' })
  })

  it('marks editor-owned keys as non-customisable', () => {
    expect(isCustomisable('newNote')).toBe(true)
    expect(isCustomisable('italic')).toBe(false)
    expect(isCustomisable('bold')).toBe(false)
  })

  it('round-trips a custom binding through storage', () => {
    const shortcuts = loadShortcuts()
    shortcuts.globalSearch = { ...shortcuts.globalSearch, key: 'p' }
    saveShortcuts(shortcuts)
    expect(loadShortcuts().globalSearch.key).toBe('p')
  })

  it('persists only the bindings that differ from the defaults', () => {
    saveShortcuts(loadShortcuts())
    expect(JSON.parse(localStorage.getItem('quicknotes-shortcuts'))).toEqual({})
  })

  it('ignores stored overrides for editor-owned actions', () => {
    localStorage.setItem('quicknotes-shortcuts', JSON.stringify({ italic: { key: 'q', ctrl: true } }))
    expect(loadShortcuts().italic.key).toBe(DEFAULT_SHORTCUTS.italic.key)
  })

  it('falls back to defaults when stored data is corrupt', () => {
    localStorage.setItem('quicknotes-shortcuts', 'not json')
    expect(loadShortcuts().newNote.key).toBe('n')
  })

  it('treats Cmd and Ctrl as the same modifier slot', () => {
    const binding = { key: 'k', ctrl: true }
    expect(matchesShortcut(keyEvent('k', { ctrl: true }), binding)).toBe(true)
    expect(matchesShortcut(keyEvent('k', { meta: true }), binding)).toBe(true)
    expect(matchesShortcut(keyEvent('k'), binding)).toBe(false)
  })

  it('uses readable Apple key names when an iPhone user agent is emulated', () => {
    vi.spyOn(window.navigator, 'platform', 'get').mockReturnValue('Win32')
    vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue('Mobile Safari iPhone')

    expect(formatShortcut({ key: 'n', ctrl: true, shift: true })).toBe('Command + Shift + N')

  })

  it('does not match when an extra modifier is held', () => {
    const binding = { key: 'f', ctrl: true }
    expect(matchesShortcut(keyEvent('f', { ctrl: true, shift: true }), binding)).toBe(false)
  })

  it('never matches an unbound action', () => {
    expect(matchesShortcut(keyEvent('a', { ctrl: true }), { key: '' })).toBe(false)
  })

  // Global handlers must stay out of the way while the user is typing, or
  // they hijack the editor's own keys.
  it('recognises text-entry targets', () => {
    const input = document.createElement('input')
    const textarea = document.createElement('textarea')
    const div = document.createElement('div')
    const prose = document.createElement('div')
    prose.className = 'ProseMirror'
    const inProse = document.createElement('p')
    prose.appendChild(inProse)
    document.body.append(prose)

    expect(isTypingTarget(input)).toBe(true)
    expect(isTypingTarget(textarea)).toBe(true)
    expect(isTypingTarget(div)).toBe(false)
    expect(isTypingTarget(inProse)).toBe(true)
  })

  it('formats bindings for display', () => {
    expect(formatShortcut({ key: 'n', ctrl: true })).toMatch(/N$/)
    expect(formatShortcut({ key: '' })).toBe('—')
  })
})
