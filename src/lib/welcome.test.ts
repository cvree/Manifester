import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  FEATURED_FOCUSES,
  FOCUS_AREAS,
  recommendedFor,
  startersFor,
} from './affirmations'
import { launchDestination } from './launch'
import { markOnboarded, writeProgress, readProgress } from './onboarding'
import { cacheKey } from './tts/cacheKey'
import { KOKORO_MODEL_VERSION } from './tts/engines/kokoroModel'
import {
  AUDIO_VERSION,
  DEFAULT_LANGUAGE,
  PRONUNCIATION_VERSION,
  VOICE_VERSION,
} from './tts/versions'
import { LOGICAL_VOICES } from './tts/voices'
import manifest from '../../public/speech/manifest.json' with { type: 'json' }
import { DEFAULT_SETTINGS, type SavedLoop } from './types'

/**
 * The promises the first minute makes, as assertions.
 *
 * Everything here is a claim the welcome experience is built on and that a
 * later edit could quietly break without any test failing: a starter that has
 * no pre-generated audio reads in a device voice, a recommendation that is not
 * on screen cannot be recommended, and an intent grid that outgrows a phone
 * turns "choose what matters to you" into "scroll to find yourself".
 */

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

const clips = (manifest as { clips: Record<string, unknown> }).clips

function hasAudio(text: string, voice: 'female_1' | 'male_1'): boolean {
  return Boolean(
    clips[
      cacheKey({
        text,
        voice,
        voiceVersion: VOICE_VERSION,
        // The rate the welcome experience auditions at. See `useAudition`.
        speed: DEFAULT_SETTINGS.rate,
        language: DEFAULT_LANGUAGE,
        modelVersion: KOKORO_MODEL_VERSION,
        pronunciationVersion: PRONUNCIATION_VERSION,
        audioVersion: AUDIO_VERSION,
      })
    ],
  )
}

describe('the first thing anybody hears', () => {
  /*
   * The single most important guarantee in the flow: a brand-new visitor taps
   * a suggested line and Ivy or Fen says it, with no model installed, no
   * backend, and a cold cache. That is only true if every line the welcome
   * experience can put on screen was pre-generated in *both* voices at the
   * speed it auditions at.
   */
  it('has studio audio for every starter, in both voices', () => {
    const missing: string[] = []
    for (const focus of FOCUS_AREAS) {
      for (const line of startersFor(focus)) {
        for (const voice of LOGICAL_VOICES) {
          if (!hasAudio(line, voice)) missing.push(`${focus.id} · ${voice} · ${line}`)
        }
      }
    }
    expect(missing).toEqual([])
  })

  it('recommends a line it is actually showing', () => {
    for (const focus of FOCUS_AREAS) {
      expect(startersFor(focus), focus.id).toContain(recommendedFor(focus))
      // It is pre-selected on arrival, so it is also the line the ritual step
      // quotes and the first loop plays if nobody touches anything.
      expect(startersFor(focus)[0], focus.id).toBe(recommendedFor(focus))
    }
  })

  it('keeps the opening grid small enough to be a decision', () => {
    // Ten intents plus the "Something else" tile. Three columns on a phone,
    // four rows — the browser check that this needs no scrolling lives in the
    // verification pass; this is the input that makes it possible.
    expect(FEATURED_FOCUSES).toHaveLength(10)
    expect(FEATURED_FOCUSES.length + 1).toBeLessThanOrEqual(12)
  })
})

describe('where a visitor lands', () => {
  const loop = (text: string): SavedLoop =>
    ({ ...DEFAULT_SETTINGS, id: 'a', text, origin: 'kept' }) as SavedLoop

  it('introduces the app exactly once', () => {
    expect(launchDestination([])).toBe('/welcome')
    markOnboarded()
    expect(launchDestination([])).toBe('/create')
  })

  it('never delays a returning listener', () => {
    markOnboarded()
    // The fast returning-user route is untouched by any of this: a resumable
    // loop still opens the player directly.
    expect(launchDestination([loop('I am steady.')])).toBe('/player')
  })

  it('resumes a half-finished introduction', () => {
    writeProgress({
      step: 'voice',
      focusId: 'calm',
      text: 'I am safe in this moment, and this moment is enough.',
      voiceStyle: 'masculine',
    })
    // Still not onboarded — a saved journey is not a completed one.
    expect(launchDestination([])).toBe('/welcome')
    expect(readProgress()?.step).toBe('voice')
  })
})
