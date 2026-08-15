import { describe, expect, it } from 'vitest'
import { MemoryCache, estimateBytes } from './memoryCache'

/*
 * Decoded speech is about 96 KB per second, so this cache is the one place in
 * the voice layer that can quietly eat a phone. What is guarded here is that
 * it is bounded by *bytes* rather than by clip count — a two-word title and a
 * long affirmation are not the same amount of memory — and that the clip
 * thrown away is the one nobody has asked for in the longest time.
 */

/** A buffer of a given length, without a Web Audio implementation. */
const clip = (seconds: number): AudioBuffer =>
  ({
    length: Math.round(seconds * 24_000),
    numberOfChannels: 1,
    sampleRate: 24_000,
    duration: seconds,
  }) as AudioBuffer

describe('the memory cache', () => {
  it('hands back exactly what it was given', () => {
    const cache = new MemoryCache()
    const buffer = clip(1)
    cache.set('a', buffer)
    expect(cache.get('a')).toBe(buffer)
    expect(cache.has('a')).toBe(true)
    expect(cache.get('b')).toBeNull()
  })

  it('counts bytes rather than clips', () => {
    const cache = new MemoryCache()
    cache.set('a', clip(1))
    expect(cache.byteLength).toBe(estimateBytes(clip(1)))
    cache.set('b', clip(2))
    expect(cache.byteLength).toBeGreaterThan(estimateBytes(clip(2)))
  })

  it('evicts the least recently used clip when it runs out of room', () => {
    // Room for roughly three one-second clips.
    const cache = new MemoryCache(estimateBytes(clip(1)) * 3 + 1)
    cache.set('a', clip(1))
    cache.set('b', clip(1))
    cache.set('c', clip(1))
    expect(cache.size).toBe(3)

    // Reading `a` promotes it, so `b` becomes the oldest.
    cache.get('a')
    cache.set('d', clip(1))

    expect(cache.has('b')).toBe(false)
    expect(cache.has('a')).toBe(true)
    expect(cache.has('c')).toBe(true)
    expect(cache.has('d')).toBe(true)
  })

  it('keeps the clip that was just asked for, even if it is huge', () => {
    // The alternative is evicting the thing somebody is about to hear, which
    // is the one clip that definitely cannot be spared.
    const cache = new MemoryCache(1024)
    cache.set('enormous', clip(60))
    expect(cache.get('enormous')).not.toBeNull()
    expect(cache.size).toBe(1)
  })

  it('does not count a replaced clip twice', () => {
    const cache = new MemoryCache()
    cache.set('a', clip(1))
    const once = cache.byteLength
    cache.set('a', clip(1))
    expect(cache.byteLength).toBe(once)
    expect(cache.size).toBe(1)
  })

  it('forgets everything on request', () => {
    const cache = new MemoryCache()
    cache.set('a', clip(1))
    cache.clear()
    expect(cache.size).toBe(0)
    expect(cache.byteLength).toBe(0)
  })
})
