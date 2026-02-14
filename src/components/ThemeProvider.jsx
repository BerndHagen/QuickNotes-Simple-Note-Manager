import { useEffect } from 'react'
import { useThemeStore } from '../store'

export function ThemeProvider({ children }) {
  const { theme } = useThemeStore()

  useEffect(() => {
    const root = window.document.documentElement
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'

    const activeTheme = theme === 'system' ? systemTheme : theme

    root.classList.remove('light', 'dark')
    root.classList.add(activeTheme)

    const metaThemeColor = document.querySelector('meta[name="theme-color"]')
    if (metaThemeColor) {
      metaThemeColor.setAttribute(
        'content',
        activeTheme === 'dark' ? '#1f2937' : '#ffffff'
      )
    }
  }, [theme])
  useEffect(() => {
    if (theme !== 'system') return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const handleChange = (e) => {
      const root = window.document.documentElement
      root.classList.remove('light', 'dark')
      root.classList.add(e.matches ? 'dark' : 'light')
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [theme])

  return children
}
