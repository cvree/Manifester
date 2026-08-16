import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  forgetOnboarding,
  hasOnboarded,
  markOnboarded,
  shouldOnboard,
} from './onboarding'
import type { SavedLoop } from './types'

/*
 * The whole point of this module is that the introduction happens once. The
 * two ways it could go wrong are both here: showing it twice, which is the app
 * forgetting somebody, and never showing it, which is somebody landing on an
 * empty editor with no idea what this is.
 */

const loop = (id: string): SavedLoop => ({ id }) as SavedLoop

const store = new Map<string, string>()

beforeEach(() => {
  store.clear()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    },
  })
})

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'localStorage')
})

describe('first use', () => {
  it('starts as somebody who has never been here', () => {
    expect(hasOnboarded()).toBe(false)
    expect(shouldOnboard([])).toBe(true)
  })

  it('remembers, and can be made to forget', () => {
    markOnboarded()
    expect(hasOnboarded()).toBe(true)
    expect(shouldOnboard([])).toBe(false)

    forgetOnboarding()
    expect(hasOnboarded()).toBe(false)
  })

  it('never introduces the app to somebody who already has loops', () => {
    // Storage cleared, IndexedDB intact — the two are separate stores and a
    // browser will happily wipe one without the other.
    expect(shouldOnboard([loop('a')])).toBe(false)
  })

  it('survives a browser that refuses to store anything', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: () => {
          throw new Error('denied')
        },
        setItem: () => {
          throw new Error('denied')
        },
        removeItem: () => {
          throw new Error('denied')
        },
      },
    })

    // Private-mode Safari. The introduction shows every time, which is a
    // small annoyance; throwing on the launch route would be a white screen.
    expect(() => markOnboarded()).not.toThrow()
    expect(hasOnboarded()).toBe(false)
    expect(shouldOnboard([])).toBe(true)
  })
})
