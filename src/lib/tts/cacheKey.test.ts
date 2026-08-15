import { describe, expect, it } from 'vitest'
import { assetPath, cacheKey, canonicalJson, canonicalText, clampSpeed } from './cacheKey'
import type { CacheKeyInput } from './cacheKey'

const base: CacheKeyInput = {
  text: 'I am allowed to take up space.',
  voice: 'female_1',
  voiceVersion: 1,
  speed: 0.9,
  language: 'en-us',
  modelVersion: 'kokoro-82m-v1.0',
  pronunciationVersion: 1,
  audioVersion: 1,
}

const withKey = (patch: Partial<CacheKeyInput>) => cacheKey({ ...base, ...patch })

describe('cache keys', () => {
  it('is a 64-character hex digest', () => {
    expect(cacheKey(base)).toMatch(/^[0-9a-f]{64}$/)
  })

  it('is stable — the same request is the same clip, forever', () => {
    // This is the guarantee the entire feature rests on. If this test ever
    // starts failing, every device in the world has just lost its cache.
    expect(cacheKey(base)).toBe(
      cacheKey({
        audioVersion: 1,
        pronunciationVersion: 1,
        modelVersion: 'kokoro-82m-v1.0',
        language: 'en-us',
        speed: 0.9,
        voiceVersion: 1,
        voice: 'female_1',
        text: 'I am allowed to take up space.',
      }),
    )
  })

  it('serialises its inputs in one fixed order', () => {
    // Key order is a decision rather than a habit: the browser, the server and
    // the build script all have to produce the same bytes to hash.
    expect(canonicalJson(base)).toBe(
      '{"audioVersion":1,"language":"en-us","modelVersion":"kokoro-82m-v1.0",' +
        '"pronunciationVersion":1,"speed":0.9,' +
        '"text":"I am allowed to take up space.","voice":"female_1","voiceVersion":1}',
    )
  })

  it('changes when anything about the sound changes', () => {
    const original = cacheKey(base)
    expect(withKey({ voice: 'male_1' })).not.toBe(original)
    expect(withKey({ speed: 1 })).not.toBe(original)
    expect(withKey({ language: 'en-gb' })).not.toBe(original)
    expect(withKey({ voiceVersion: 2 })).not.toBe(original)
    expect(withKey({ pronunciationVersion: 2 })).not.toBe(original)
    expect(withKey({ audioVersion: 2 })).not.toBe(original)
    expect(withKey({ modelVersion: 'kokoro-82m-v1.1' })).not.toBe(original)
    expect(withKey({ text: 'I am allowed to take up space' })).not.toBe(original)
  })

  it('treats text that only differs in whitespace as the same clip', () => {
    const original = cacheKey(base)
    expect(withKey({ text: '  I am allowed to take up space.  ' })).toBe(original)
    expect(withKey({ text: 'I am  allowed to take up space.' })).toBe(original)
    // A non-breaking space pasted from a word processor is still a space.
    expect(withKey({ text: 'I am allowed to take up space.' })).toBe(original)
  })

  it('treats the two Unicode spellings of an accent as one word', () => {
    const composed = 'café'
    const decomposed = 'café'
    expect(canonicalText(decomposed)).toBe(composed)
    expect(withKey({ text: decomposed })).toBe(withKey({ text: composed }))
  })

  it('is case- and language-tolerant only where it should be', () => {
    expect(withKey({ language: 'EN-US' })).toBe(cacheKey(base))
    expect(withKey({ text: 'I Am Allowed To Take Up Space.' })).not.toBe(
      cacheKey(base),
    )
  })

  it('rounds speed so a slider cannot invent new clips', () => {
    expect(clampSpeed(0.8999999999)).toBe(0.9)
    expect(clampSpeed(3)).toBe(2)
    expect(clampSpeed(0.1)).toBe(0.5)
    expect(clampSpeed(Number.NaN)).toBe(1)
    expect(withKey({ speed: 0.900001 })).toBe(cacheKey(base))
  })

  it('fans files out by the first two characters of the hash', () => {
    const key = cacheKey(base)
    expect(assetPath(key, 'opus')).toBe(`${key.slice(0, 2)}/${key}.opus`)
    expect(assetPath(key, 'mp3')).toBe(`${key.slice(0, 2)}/${key}.mp3`)
  })
})
