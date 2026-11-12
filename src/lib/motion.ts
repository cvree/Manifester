/**
 * Motion preferences.
 *
 * Everything animated in Manifester asks here first. When someone has reduced
 * motion turned on — on the device, or with the app's own Motion setting — or
 * their device looks low-powered, the app renders the same layout with the
 * movement removed rather than falling back to a lesser design.
 */

import { useEffect, useState } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

/**
 * How much the app moves, as chosen inside the app.
 *
 * The operating system's Reduce Motion is a setting most people have never
 * found, and it is all-or-nothing. So the app has its own, in Appearance:
 *
 *  - **Full** — everything, unless the device asks for less. The device's
 *    Reduce Motion always wins; nothing here can turn motion back *on*.
 *  - **Gentle** — the breath still moves the orb, at half the swing, and the
 *    full-screen room behind it holds still. The title's letters arrive with a
 *    fade rather than out of blur. For people who like the guide alive but
 *    find a whole breathing screen too much.
 *  - **Still** — exactly what the device's Reduce Motion gives, through the
 *    same code paths: a phase ring, words that change, and nothing travelling.
 *
 * Set from `PreferencesProvider`, and written onto `<html>` as `data-motion`
 * so the stylesheet can answer it as well.
 */
export type MotionLevel = 'full' | 'gentle' | 'still'

let appLevel: MotionLevel = 'full'
const levelListeners = new Set<() => void>()

export function setAppMotion(level: MotionLevel): void {
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.motion = level
  }
  if (level === appLevel) return
  appLevel = level
  for (const listener of levelListeners) listener()
}

/**
 * Gamer mode: the app as a quiet background process.
 *
 * Somebody listening while they play something else wants every frame and
 * every megabyte for the game, so this is Still with nothing left to argue
 * about — it outranks the Motion setting the same way the device's Reduce
 * Motion does, and it goes through the same code paths, which is what keeps
 * it honest: every canvas, clock and tween in the app already asks
 * `prefersReducedMotion()` before it moves. The stylesheet answers
 * `data-gamer` on `<html>` for what a script cannot reach — the blurred glass
 * and the painted room behind it. See `PreferencesProvider` for the rest of
 * what the mode switches off.
 */
let gamer = false

export function setGamerMode(on: boolean): void {
  if (typeof document !== 'undefined') {
    if (on) document.documentElement.dataset.gamer = 'on'
    else delete document.documentElement.dataset.gamer
  }
  if (on === gamer) return
  gamer = on
  for (const listener of levelListeners) listener()
}

export function isGamerMode(): boolean {
  return gamer
}

export function useGamerMode(): boolean {
  const [on, setOn] = useState(isGamerMode)

  useEffect(() => {
    const onChange = () => setOn(isGamerMode())
    onChange()
    return subscribeMotion(onChange)
  }, [])

  return on
}

function systemReduced(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia(QUERY).matches
}

export function prefersReducedMotion(): boolean {
  return gamer || appLevel === 'still' || systemReduced()
}

/** The level in force: the device's Reduce Motion counts as Still. */
export function motionLevel(): MotionLevel {
  return prefersReducedMotion() ? 'still' : appLevel
}

/** Calls back when either the device's setting or the app's changes. */
function subscribeMotion(onChange: () => void): () => void {
  levelListeners.add(onChange)
  let media: MediaQueryList | null = null
  if (typeof window !== 'undefined' && window.matchMedia) {
    media = window.matchMedia(QUERY)
    media.addEventListener('change', onChange)
  }
  return () => {
    levelListeners.delete(onChange)
    media?.removeEventListener('change', onChange)
  }
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(prefersReducedMotion)

  useEffect(() => {
    const onChange = () => setReduced(prefersReducedMotion())
    onChange()
    return subscribeMotion(onChange)
  }, [])

  return reduced
}

/** The device's own Reduce Motion alone, for the control that explains it. */
export function useSystemReducedMotion(): boolean {
  const [reduced, setReduced] = useState(systemReduced)

  useEffect(() => {
    const onChange = () => setReduced(systemReduced())
    onChange()
    return subscribeMotion(onChange)
  }, [])

  return reduced
}

export function useMotionLevel(): MotionLevel {
  const [level, setLevel] = useState(motionLevel)

  useEffect(() => {
    const onChange = () => setLevel(motionLevel())
    onChange()
    return subscribeMotion(onChange)
  }, [])

  return level
}

/**
 * True below the desktop breakpoint, where navigation lives in the floating
 * bar rather than the header. Immersive mode keys off this: hiding the header
 * on a desktop would take away the only way out of the player.
 */
export function useIsCompact(): boolean {
  const [compact, setCompact] = useState(() =>
    typeof window === 'undefined' || !window.matchMedia
      ? false
      : window.matchMedia('(max-width: 1023px)').matches,
  )

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const media = window.matchMedia('(max-width: 1023px)')
    const onChange = () => setCompact(media.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  return compact
}

/**
 * Whether the compositor is running on the CPU rather than the GPU — the
 * state Chrome falls back to when "Use hardware acceleration" is switched off
 * in its own settings, or when the platform has no usable GPU driver at all.
 *
 * Software compositing turns an animated stack of blurred, filtered,
 * simultaneously-changing layers from a GPU footnote into real CPU work every
 * frame, and Chromium's software rasteriser has a documented history of
 * crashing outright under that load rather than merely running slowly.
 *
 * Detected from the WebGL renderer string rather than any permissions or
 * device-memory signal, because it is the one thing that actually answers the
 * question: a powerful desktop with acceleration disabled in `chrome://settings`
 * reports here exactly like a phone with no GPU at all. The context is thrown
 * away immediately either way — this never keeps a WebGL context open.
 *
 * "Thrown away" has to be said out loud. Dropping the reference is not enough:
 * a context lives until the collector gets round to it, browsers cap how many
 * may be alive at once (Safari quietly kills the oldest), and this used to run
 * on every call — several per session start, and again on every expansion of
 * the stage. So it runs once per page, and the context is released explicitly
 * the moment the renderer string has been read.
 */
let softwareAnswer: boolean | null = null

function hasSoftwareRendering(): boolean {
  if (softwareAnswer !== null) return softwareAnswer
  if (typeof document === 'undefined') return false
  let gl: WebGLRenderingContext | null = null
  try {
    const canvas = document.createElement('canvas')
    gl = (canvas.getContext('webgl') ??
      canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null
    if (!gl) {
      softwareAnswer = true
      return true
    }
    const info = gl.getExtension('WEBGL_debug_renderer_info')
    const renderer = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : ''
    softwareAnswer = /swiftshader|llvmpipe|software|basic render|angle \(software/i.test(
      renderer,
    )
  } catch {
    softwareAnswer = false
  } finally {
    try {
      gl?.getExtension('WEBGL_lose_context')?.loseContext()
    } catch {
      // Nothing to release, or already gone. Either way, done with it.
    }
  }
  return softwareAnswer
}

/**
 * A conservative guess at whether continuous animation and heavy compositing
 * are a good idea here. Used to drop the drifting particle layer on modest
 * phones, and to make the player's stage snap to its expanded shape instead
 * of travelling there when the renderer cannot be trusted with the trip.
 */
export function isLowPowerDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
  if (typeof memory === 'number' && memory > 0 && memory < 4) return true
  if (typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency <= 4) {
    return true
  }
  return hasSoftwareRendering()
}

/** True when the app is running from the home screen rather than a browser tab. */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export type Platform = 'ios' | 'android' | 'desktop'

export function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'desktop'
  const ua = navigator.userAgent
  if (/iP(hone|ad|od)/.test(ua)) return 'ios'
  if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) return 'ios'
  if (/Android/i.test(ua)) return 'android'
  return 'desktop'
}
