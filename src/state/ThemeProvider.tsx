import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { readLocal, writeLocal } from '../lib/storage'

export type Theme = 'day' | 'night'

interface ThemeContextValue {
  theme: Theme
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function initialTheme(): Theme {
  const stored = readLocal('theme')
  if (stored === 'day' || stored === 'night') return stored
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'night' : 'day'
  }
  return 'day'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(initialTheme)

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', theme === 'night')
    writeLocal('theme', theme)

    // Keep the browser chrome in step with the app surface.
    const colour = theme === 'night' ? '#171423' : '#EFE7DC'
    document
      .querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
      .forEach((meta) => {
        meta.removeAttribute('media')
        meta.content = colour
      })
  }, [theme])

  const toggleTheme = useCallback(
    () => setTheme((current) => (current === 'day' ? 'night' : 'day')),
    [],
  )

  const value = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used inside <ThemeProvider>')
  return context
}
