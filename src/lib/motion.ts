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
 * A conservative guess at whether continuous canvas animation is a good idea.
 * Used to drop the drifting particle layer on modest phones.
 */
export function isLowPowerDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
  if (typeof memory === 'number' && memory > 0 && memory < 4) return true
  if (typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency <= 4) {
    return true
  }
  return false
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
