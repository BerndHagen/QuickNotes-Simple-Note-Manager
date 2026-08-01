import { useEffect } from 'react'
import { useThemeStore, useUIStore } from '../store'
import { LANGUAGES } from '../lib/i18n'

const THEME_COLORS = {
  light: '#ffffff',
  dark: '#0b0f14',
}

function applyTheme(theme) {
  const root = window.document.documentElement
  root.classList.remove('light', 'dark')
  root.classList.add(theme)

  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', THEME_COLORS[theme])
}

export function ThemeProvider({ children }) {
  const { theme } = useThemeStore()
  const language = useUIStore((state) => state.language)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const resolveTheme = () => (theme === 'system' ? (mediaQuery.matches ? 'dark' : 'light') : theme)
    const handleChange = () => applyTheme(resolveTheme())

    handleChange()
    if (theme !== 'system') return undefined

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [theme])

  useEffect(() => {
    const selectedLanguage = LANGUAGES.find(({ code }) => code === language) || LANGUAGES[0]
    const root = window.document.documentElement
    root.lang = selectedLanguage.code
    root.dir = selectedLanguage.dir
  }, [language])

  return children
}
