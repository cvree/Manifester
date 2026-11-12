import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  clearStoredDraft,
  draftState,
  loadStoredDraft,
  resumeDraftStore,
  saveStoredDraft,
  suspendDraftStore,
} from './draftStore'
import { launchDestination } from './launch'
import { normaliseSettings, type Draft } from './loops'
import { markOnboarded } from './onboarding'
import { timerSummary } from './summaries'
import { DEFAULT_SETTINGS, type SavedLoop } from './types'

const store = new Map<string, string>()

beforeEach(() => {
  store.clear()
  resumeDraftStore()
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

function draft(patch: Partial<Draft> = {}): Draft {
  return {
    id: null,
    title: '',
    text: 'I am steady.\nI am here.',
    settings: { ...DEFAULT_SETTINGS, repeat: false },
    ...patch,
  }
}

function loop(patch: Partial<SavedLoop> = {}): SavedLoop {
  return {
    ...DEFAULT_SETTINGS,
    id: 'loop-1',
    title: 'Calm',
    text: 'I am steady.\nI am here.',
    createdAt: 1,
    updatedAt: 2,
    lastPlayedAt: 3,
    origin: 'kept',
    ...patch,
  }
}

describe('the stored draft', () => {
  it('survives a round trip with its words, title and settings', () => {
    saveStoredDraft(draft({ title: 'Morning', id: 'loop-9' }))
    const restored = loadStoredDraft()
    expect(restored?.text).toBe('I am steady.\nI am here.')
    expect(restored?.title).toBe('Morning')
    expect(restored?.id).toBe('loop-9')
    expect(restored?.settings.repeat).toBe(false)
    expect(restored?.settings.rate).toBe(DEFAULT_SETTINGS.rate)
  })

  it('does not remember an empty page, and forgets one that was emptied', () => {
    saveStoredDraft(draft())
    expect(loadStoredDraft()).not.toBeNull()
    saveStoredDraft(draft({ text: '   \n ' }))
    expect(loadStoredDraft()).toBeNull()
  })

  it('reads damaged or foreign data as nothing rather than throwing', () => {
    store.set('manifester:draft', '{not json')
    expect(loadStoredDraft()).toBeNull()
    store.set('manifester:draft', JSON.stringify({ v: 1, text: 42 }))
    expect(loadStoredDraft()).toBeNull()
    store.set('manifester:draft', JSON.stringify({ v: 1, text: 'Hello.', settings: 'x' }))
    expect(loadStoredDraft()?.settings.voiceStyle).toBe(DEFAULT_SETTINGS.voiceStyle)
  })

  it('writes nothing once suspended, so a reset cannot be undone by the page closing', () => {
    saveStoredDraft(draft())
    suspendDraftStore()
    clearStoredDraft()
    saveStoredDraft(draft())
    expect(loadStoredDraft()).toBeNull()
  })
})

describe('draftState', () => {
  it('is empty without words and unsaved without a loop', () => {
    expect(draftState(draft({ text: ' ' }), [])).toBe('empty')
    expect(draftState(draft(), [])).toBe('unsaved')
  })

  it('tells a kept loop from one that was only played', () => {
    expect(draftState(draft({ id: 'loop-1' }), [loop()])).toBe('saved')
    expect(draftState(draft({ id: 'loop-1' }), [loop({ origin: 'played' })])).toBe('recent')
  })

  it('notices edited words and a changed title, but not a blank title', () => {
    const loops = [loop()]
    expect(draftState(draft({ id: 'loop-1', text: 'I am steady.' }), loops)).toBe('unsaved')
    expect(draftState(draft({ id: 'loop-1', title: 'Other' }), loops)).toBe('unsaved')
    expect(draftState(draft({ id: 'loop-1', title: '' }), loops)).toBe('saved')
  })
})

describe('launching with unsaved words', () => {
  it('returns to the editor instead of the player', () => {
    markOnboarded()
    expect(launchDestination([loop()], true)).toBe('/create')
    expect(launchDestination([loop()], false)).toBe('/player')
  })

  it('still introduces the app to somebody who has never seen it', () => {
    expect(launchDestination([], true)).toBe('/welcome')
  })
})

describe('repeat', () => {
  it('treats everything saved before the setting existed as a loop', () => {
    const { repeat: _repeat, ...legacy } = DEFAULT_SETTINGS
    expect(normaliseSettings(legacy).repeat).toBe(true)
    expect(normaliseSettings({ ...legacy, repeat: false }).repeat).toBe(false)
  })

  it('summarises a single read without mentioning a length', () => {
    expect(timerSummary(10, false)).toBe('Once through')
    expect(timerSummary(10, true)).toBe('10 minutes')
    expect(timerSummary(null)).toBe('Until I stop it')
  })
})
