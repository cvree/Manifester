import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { DEFAULT_HUE, HUE_SWEEP_MS, normaliseHue } from '../lib/hue'
import { readLocal, writeLocal } from '../lib/storage'

export type Theme = 'day' | 'night'

interface ThemeContextValue {
  theme: Theme
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
  /** Degrees added to every hue in the palette. See `lib/hue.ts`. */
  hue: number
  setHue: (hue: number) => void
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

function initialHue(): number {
  const stored = readLocal('hue')
  return stored == null ? DEFAULT_HUE : normaliseHue(stored)
}

/**
 * Flatten a resolved colour to plain sRGB.
 *
 * Once the palette rotates, `--bg-0` computes to an `oklch()` value. Every
 * browser that can produce one can also read one — but `theme-color` is
 * consumed by the operating system's window chrome rather than by the page,
 * and that is a far less predictable parser. Painting the colour onto a single
 * pixel and reading it back is the shortest conversion that cannot be wrong.
 */
function toSrgb(colour: string): string {
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    const context = canvas.getContext('2d')
    if (!context) return colour

    context.fillStyle = colour
    context.fillRect(0, 0, 1, 1)
    const [r, g, b] = context.getImageData(0, 0, 1, 1).data
    return `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, '0')).join('')}`
  } catch {
    return colour
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(initialTheme)
  const [hue, setHueState] = useState<number>(initialHue)

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', theme === 'night')
    root.style.setProperty('--hue-shift', String(hue))
    writeLocal('theme', theme)
    writeLocal('hue', String(hue))
  }, [theme, hue])

  /*
   * Keep the browser chrome in step with the app surface.
   *
   * The colour is read back off the page rather than hard-coded, because the
   * canvas now rotates with the hue dial and there is exactly one place that
   * knows what `--bg-0` currently resolves to: the element painted with it.
   * Reading it twice — once immediately for the day/night flip, which is
   * instant, and once after the palette has finished sweeping — is what makes
   * the status bar land on the colour actually on screen.
   */
  useEffect(() => {
    const paint = () => {
      const resolved = getComputedStyle(document.body).backgroundColor
      if (!resolved) return
      const colour = toSrgb(resolved)
      document
        .querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
        .forEach((meta) => {
          meta.removeAttribute('media')
          meta.content = colour
        })
    }

    paint()
    const settled = window.setTimeout(paint, HUE_SWEEP_MS + 60)
    return () => window.clearTimeout(settled)
  }, [theme, hue])

  const toggleTheme = useCallback(
    () => setTheme((current) => (current === 'day' ? 'night' : 'day')),
    [],
  )

  const setHue = useCallback(
    (next: number) => setHueState(normaliseHue(next)),
    [],
  )

  const value = useMemo(
    () => ({ theme, toggleTheme, setTheme, hue, setHue }),
    [theme, toggleTheme, hue, setHue],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used inside <ThemeProvider>')
  return context
}
