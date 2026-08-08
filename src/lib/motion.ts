/**
 * Motion preferences.
 *
 * Everything animated in Manifester asks here first. When someone has reduced
 * motion turned on, or their device looks low-powered, the app renders the same
 * layout with the movement removed rather than falling back to a lesser design.
 */

import { useEffect, useState } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia(QUERY).matches
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(prefersReducedMotion)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const media = window.matchMedia(QUERY)
    const onChange = () => setReduced(media.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  return reduced
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
 */
function hasSoftwareRendering(): boolean {
  if (typeof document === 'undefined') return false
  try {
    const canvas = document.createElement('canvas')
    const gl = (canvas.getContext('webgl') ??
      canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null
    if (!gl) return true
    const info = gl.getExtension('WEBGL_debug_renderer_info')
    const renderer = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : ''
    return /swiftshader|llvmpipe|software|basic render|angle \(software/i.test(renderer)
  } catch {
    return false
  }
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
