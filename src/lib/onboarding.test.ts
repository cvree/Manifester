import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ONBOARDING_VERSION,
  clearProgress,
  forgetOnboarding,
  hasOnboarded,
  hasSeenFirstLoopNudge,
  markFirstLoopNudgeSeen,
  markOnboarded,
  readProgress,
  shouldOnboard,
  writeProgress,
} from './onboarding'
import type { SavedLoop } from './types'

/*
 * Two failures matter here and they pull in opposite directions: showing the
 * introduction twice, which is the app forgetting somebody, and never showing
 * it, which is somebody landing on an empty editor with no idea what this is.
 * Everything below is one of those two, plus the half-finished journey that
 * has to survive a phone locking mid-sentence.
 */

const loop = (id: string): SavedLoop => ({ id }) as SavedLoop

const store = new Map<string, string>()

const useStore = () => {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    },
  })
}

beforeEach(() => {
  store.clear()
  useStore()
})

afterEach(() => {
  vi.useRealTimers()
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
    expect(() => writeProgress({ step: 'intent', focusId: null, text: '', voiceStyle: 'feminine' })).not.toThrow()
    expect(hasOnboarded()).toBe(false)
    expect(readProgress()).toBeNull()
    expect(shouldOnboard([])).toBe(true)
  })
})

describe('versioning', () => {
  it('reads what version 1 wrote', () => {
    // The old flag was the literal string `yes`. Anybody carrying it finished
    // an introduction, and must not be shown another one by an upgrade.
    store.set('manifester:onboarded', 'yes')
    expect(hasOnboarded()).toBe(true)
  })

  it('records the version that was actually completed', () => {
    markOnboarded()
    expect(store.get('manifester:onboarded')).toBe(String(ONBOARDING_VERSION))
  })

  it('treats an unknown future version as not-yet-introduced', () => {
    // A build from the future wrote something this build does not accept.
    // Offering the introduction is the safe answer; silently trusting a number
    // this code has never heard of is not.
    store.set('manifester:onboarded', '99')
    expect(hasOnboarded()).toBe(false)
  })

  it('ignores a garbled flag rather than throwing', () => {
    store.set('manifester:onboarded', '{{')
    expect(hasOnboarded()).toBe(false)
  })
})

describe('a half-finished journey', () => {
  const progress = {
    step: 'voice',
    focusId: 'calm',
    text: 'I am safe in this moment.',
    voiceStyle: 'masculine' as const,
  }

  it('comes back after a refresh', () => {
    writeProgress(progress)
    expect(readProgress()).toMatchObject(progress)
  })

  it('is cleared the moment the first loop starts', () => {
    writeProgress(progress)
    markOnboarded()
    expect(readProgress()).toBeNull()
  })

  it('can be cleared on its own', () => {
    writeProgress(progress)
    clearProgress()
    expect(readProgress()).toBeNull()
    // Completion is a separate fact and must not be swept up with it.
    expect(hasOnboarded()).toBe(false)
  })

  it('expires rather than asking how you were feeling yesterday', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T09:00:00Z'))
    writeProgress(progress)

    vi.setSystemTime(new Date('2026-01-01T13:00:00Z'))
    expect(readProgress()).not.toBeNull()

    vi.setSystemTime(new Date('2026-01-02T09:00:00Z'))
    expect(readProgress()).toBeNull()
  })

  it('refuses a journey saved by a different generation of the flow', () => {
    // Those step names may not exist any more, and resuming into a step that
    // renders nothing is a blank screen with a Back button.
    store.set(
      'manifester:onboarding.progress',
      JSON.stringify({ ...progress, version: 1, updatedAt: Date.now() }),
    )
    expect(readProgress()).toBeNull()
  })

  it('refuses nonsense without throwing', () => {
    store.set('manifester:onboarding.progress', 'not json')
    expect(readProgress()).toBeNull()

    store.set('manifester:onboarding.progress', JSON.stringify({ version: ONBOARDING_VERSION }))
    expect(readProgress()).toBeNull()
  })
})

describe('the one thing taught afterwards', () => {
  it('is offered once and then never again', () => {
    expect(hasSeenFirstLoopNudge()).toBe(false)
    markFirstLoopNudgeSeen()
    expect(hasSeenFirstLoopNudge()).toBe(true)
  })
})
