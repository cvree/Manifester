import { afterEach, describe, expect, it, vi } from 'vitest'
import { motionLevel, prefersReducedMotion, setAppMotion } from './motion'

function deviceReduces(reduced: boolean) {
  vi.stubGlobal('window', {
    matchMedia: () => ({
      matches: reduced,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  })
}

afterEach(() => {
  setAppMotion('full')
  vi.unstubAllGlobals()
})

describe('the Motion setting', () => {
  it('follows the device when left on Full', () => {
    deviceReduces(false)
    setAppMotion('full')
    expect(prefersReducedMotion()).toBe(false)
    expect(motionLevel()).toBe('full')

    deviceReduces(true)
    expect(prefersReducedMotion()).toBe(true)
    expect(motionLevel()).toBe('still')
  })

  it('holds everything still when Still is chosen, whatever the device says', () => {
    deviceReduces(false)
    setAppMotion('still')
    expect(prefersReducedMotion()).toBe(true)
    expect(motionLevel()).toBe('still')
  })

  it('keeps Gentle as its own level, which is not reduced motion', () => {
    deviceReduces(false)
    setAppMotion('gentle')
    expect(prefersReducedMotion()).toBe(false)
    expect(motionLevel()).toBe('gentle')
  })

  it('never lets the app turn motion back on over the device', () => {
    deviceReduces(true)
    setAppMotion('gentle')
    expect(motionLevel()).toBe('still')
  })
})
