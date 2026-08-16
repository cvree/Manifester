import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, type SavedLoop } from '../lib/types'
import { launchDestination } from '../lib/launch'
import { markOnboarded } from '../lib/onboarding'

function loop(text = 'I am here.'): SavedLoop {
  return {
    ...DEFAULT_SETTINGS,
    id: 'loop-1',
    title: 'Calm',
    text,
    createdAt: 1,
    updatedAt: 2,
    lastPlayedAt: 3,
    origin: 'kept',
  }
}

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

describe('launchDestination', () => {
  it('opens Player when a saved loop can be restored', () => {
    expect(launchDestination([loop()])).toBe('/player')
  })

  it('introduces the app to somebody with nothing saved and nothing seen', () => {
    expect(launchDestination([])).toBe('/welcome')
  })

  it('opens Create once the introduction has been seen', () => {
    markOnboarded()
    expect(launchDestination([])).toBe('/create')
  })

  it('never introduces the app to somebody who already has loops', () => {
    // A blank loop is not resumable, so it is not the Player — but it is still
    // evidence that this person has used the app, which rules out a first-run
    // introduction even with a cleared localStorage.
    expect(launchDestination([loop('   ')])).toBe('/create')
  })
})
