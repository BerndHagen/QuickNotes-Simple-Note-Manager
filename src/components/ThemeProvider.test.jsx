import { act, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useThemeStore, useUIStore } from '../store'
import { ThemeProvider } from './ThemeProvider'

describe('ThemeProvider', () => {
  afterEach(() => {
    document.documentElement.classList.remove('light', 'dark')
    document.documentElement.lang = 'en'
    document.documentElement.dir = 'ltr'
    document.querySelector('meta[name="theme-color"]')?.remove()
    vi.restoreAllMocks()
  })

  it('updates the document language and writing direction', () => {
    useThemeStore.setState({ theme: 'light' })
    useUIStore.setState({ language: 'ar' })

    const { rerender } = render(
      <ThemeProvider>
        <span>Workspace</span>
      </ThemeProvider>
    )

    expect(document.documentElement).toHaveAttribute('lang', 'ar')
    expect(document.documentElement).toHaveAttribute('dir', 'rtl')

    act(() => useUIStore.setState({ language: 'de' }))
    rerender(
      <ThemeProvider>
        <span>Workspace</span>
      </ThemeProvider>
    )

    expect(document.documentElement).toHaveAttribute('lang', 'de')
    expect(document.documentElement).toHaveAttribute('dir', 'ltr')
  })

  it('keeps the document and browser chrome in sync with the system theme', () => {
    const mediaQuery = {
      matches: false,
      media: '(prefers-color-scheme: dark)',
      onchange: null,
      addEventListener: vi.fn((event, callback) => {
        if (event === 'change') mediaQuery.listener = callback
      }),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }
    vi.spyOn(window, 'matchMedia').mockReturnValue(mediaQuery)

    const themeColor = document.createElement('meta')
    themeColor.name = 'theme-color'
    document.head.appendChild(themeColor)
    useThemeStore.setState({ theme: 'system' })

    render(
      <ThemeProvider>
        <span>Workspace</span>
      </ThemeProvider>
    )

    expect(document.documentElement).toHaveClass('light')
    expect(themeColor).toHaveAttribute('content', '#ffffff')

    act(() => {
      mediaQuery.matches = true
      mediaQuery.listener?.({ matches: true })
    })

    expect(document.documentElement).toHaveClass('dark')
    expect(document.documentElement).not.toHaveClass('light')
    expect(themeColor).toHaveAttribute('content', '#0b0f14')
  })
})
