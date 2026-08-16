import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  DEFAULT_CHROMA,
  DEFAULT_HUE,
  DEFAULT_NIGHT_LIGHT,
  HUE_SWEEP_MS,
  nightLightFactor,
  normaliseChroma,
  normaliseHue,
  normaliseNightLight,
} from '../lib/hue'
import { readLocal, writeLocal } from '../lib/storage'

export type Theme = 'day' | 'night'

interface ThemeContextValue {
  theme: Theme
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
  /** Degrees added to every hue in the palette. See `lib/hue.ts`. */
  hue: number
  setHue: (hue: number) => void
  /**
   * How saturated the palette is, as a multiplier on every chroma.
   *
   * The second half of the palette control, and the half that makes it feel
   * like a real choice: hue alone rotates between fourteen equally-coloured
   * rooms, while chroma is the difference between a graphite instrument and
   * something lit from inside.
   */
  chroma: number
  setChroma: (chroma: number) => void
  /** Both at once, so a preset lands as a single animated change. */
  setPalette: (palette: { hue: number; chroma: number }) => void
  /**
   * How much blue is taken out of the light, 0–100. Independent of day/night:
   * one is which palette is on screen, the other is the temperature of the
   * screen itself, and someone reading in bed may well want both.
   */
  nightLight: number
  setNightLight: (amount: number) => void
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

function initialChroma(): number {
  const stored = readLocal('chroma')
  return stored == null ? DEFAULT_CHROMA : normaliseChroma(stored)
}

function initialNightLight(): number {
  const stored = readLocal('night-light')
  return stored == null ? DEFAULT_NIGHT_LIGHT : normaliseNightLight(stored)
}

/**
 * One canvas, reused.
 *
 * This is called on every frame of a hue drag, and a fresh 1×1 canvas per
 * frame is sixty throwaway DOM nodes a second to answer a question that needs
 * one pixel.
 */
let swatch: HTMLCanvasElement | null = null

/**
 * Flatten a resolved colour to plain sRGB channels.
 *
 * Once the palette rotates, `--bg-0` computes to an `oklch()` value. Every
 * browser that can produce one can also read one — but `theme-color` is
 * consumed by the operating system's window chrome rather than by the page,
 * and that is a far less predictable parser. Painting the colour onto a single
 * pixel and reading it back is the shortest conversion that cannot be wrong.
 */
function toChannels(colour: string): [number, number, number] | null {
  try {
    if (!swatch) {
      swatch = document.createElement('canvas')
      swatch.width = 1
      swatch.height = 1
    }
    const context = swatch.getContext('2d', { willReadFrequently: true })
    if (!context) return null

    context.clearRect(0, 0, 1, 1)
    context.fillStyle = colour
    context.fillRect(0, 0, 1, 1)
    const [r, g, b] = context.getImageData(0, 0, 1, 1).data
    return [r, g, b]
  } catch {
    return null
  }
}

function toHex(channels: [number, number, number]): string {
  return `#${channels
    .map((channel) =>
      Math.round(Math.min(255, Math.max(0, channel)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(initialTheme)
  const [hue, setHueState] = useState<number>(initialHue)
  const [chroma, setChromaState] = useState<number>(initialChroma)
  const [nightLight, setNightLightState] = useState<number>(initialNightLight)

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', theme === 'night')
    root.style.setProperty('--hue-shift', String(hue))
    root.style.setProperty('--chroma-scale', String(chroma))
    /*
     * As a fraction, because that is what the stylesheet's tint multiplies by
     * — and as a `0`/`1` flag, because a full-screen blended layer is worth
     * not having on the page at all while it would be a no-op.
     */
    root.style.setProperty('--night-light', String(nightLight / 100))
  }, [theme, hue, chroma, nightLight])

  /*
   * Remembering it is a separate question from showing it, and it is on a
   * different clock.
   *
   * Both of these are dragged now, which means they arrive as sixty distinct
   * values a second while a finger is down. `localStorage` is synchronous and
   * touches the disk, so writing on every one of those would put a blocking
   * write between every frame of the drag. Two hundred milliseconds after the
   * last change is long past the end of any drag and far short of anyone
   * closing the tab.
   */
  useEffect(() => {
    const id = window.setTimeout(() => {
      writeLocal('theme', theme)
      writeLocal('hue', String(hue))
      writeLocal('chroma', String(chroma))
      writeLocal('night-light', String(nightLight))
    }, 200)
    return () => window.clearTimeout(id)
  }, [theme, hue, chroma, nightLight])

  /*
   * Keep the browser chrome in step with the app surface.
   *
   * The colour is read back off the page rather than hard-coded, because the
   * canvas now rotates with the hue dial and there is exactly one place that
   * knows what `--bg-0` currently resolves to: the element painted with it.
   * Reading it twice — once immediately for the day/night flip, which is
   * instant, and once after the palette has finished sweeping — is what makes
   * the status bar land on the colour actually on screen.
   *
   * The night light is applied here rather than read off the page, because it
   * is a blend over the page and not a colour in it: the pixels the compositor
   * produces are warmed, and `getComputedStyle` will never know that. Same
   * multiply, same numbers — so the status bar warms with everything else
   * instead of staying stubbornly blue above a page that no longer is.
   */
  useEffect(() => {
    const paint = () => {
      const resolved = getComputedStyle(document.body).backgroundColor
      if (!resolved) return
      const channels = toChannels(resolved)
      if (!channels) return

      const colour = toHex([
        channels[0] * nightLightFactor(nightLight, 'red'),
        channels[1] * nightLightFactor(nightLight, 'green'),
        channels[2] * nightLightFactor(nightLight, 'blue'),
      ])

      document
        .querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
        .forEach((meta) => {
          meta.removeAttribute('media')
          meta.content = colour
        })
    }

    /*
     * Both passes are on a timer, and the first one is why: `paint` reads a
     * computed style back off the page, which forces a style recalculation of
     * the whole document — and it now runs behind a control that changes value
     * on every frame of a drag. Sixty forced recalculations a second to keep a
     * status bar in step is a strange way to pay for a colour nobody is
     * looking at mid-drag. A tenth of a second after the last change is
     * invisible on a theme toggle and free on a drag.
     */
    const soon = window.setTimeout(paint, 100)
    const settled = window.setTimeout(paint, HUE_SWEEP_MS + 60)
    return () => {
      window.clearTimeout(soon)
      window.clearTimeout(settled)
    }
  }, [theme, hue, chroma, nightLight])

  const toggleTheme = useCallback(
    () => setTheme((current) => (current === 'day' ? 'night' : 'day')),
    [],
  )

  const setHue = useCallback(
    (next: number) => setHueState(normaliseHue(next)),
    [],
  )

  const setChroma = useCallback(
    (next: number) => setChromaState(normaliseChroma(next)),
    [],
  )

  const setPalette = useCallback(
    (palette: { hue: number; chroma: number }) => {
      setHueState(normaliseHue(palette.hue))
      setChromaState(normaliseChroma(palette.chroma))
    },
    [],
  )

  const setNightLight = useCallback(
    (next: number) => setNightLightState(normaliseNightLight(next)),
    [],
  )

  const value = useMemo(
    () => ({
      theme,
      toggleTheme,
      setTheme,
      hue,
      setHue,
      chroma,
      setChroma,
      setPalette,
      nightLight,
      setNightLight,
    }),
    [
      theme,
      toggleTheme,
      hue,
      setHue,
      chroma,
      setChroma,
      setPalette,
      nightLight,
      setNightLight,
    ],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used inside <ThemeProvider>')
  return context
}
