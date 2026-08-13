import { describe, expect, it, vi } from 'vitest'
import {
  EMPTY_LISTENING_STATS,
  addListening,
  formatListeningDuration,
  listeningSentence,
  mergeListeningStats,
  normaliseListeningStats,
} from './listening'

describe('listening totals', () => {
  it('only moves forward and counts a session once when asked', () => {
    const first = addListening(EMPTY_LISTENING_STATS, 65, true, Date.UTC(2026, 2, 4))
    const next = addListening(first, 35, false, Date.UTC(2026, 2, 4))
    expect(next).toEqual({
      totalSeconds: 100,
      sessionCount: 1,
      firstListenedAt: Date.UTC(2026, 2, 4),
    })
  })

  it('restores by taking the larger totals rather than double-counting', () => {
    expect(
      mergeListeningStats(
        { totalSeconds: 500, sessionCount: 4, firstListenedAt: 20 },
        { totalSeconds: 300, sessionCount: 8, firstListenedAt: 10 },
      ),
    ).toEqual({ totalSeconds: 500, sessionCount: 8, firstListenedAt: 10 })
  })

  it('normalises malformed persisted values safely', () => {
    expect(normaliseListeningStats({ totalSeconds: -4, sessionCount: Number.NaN })).toEqual(
      EMPTY_LISTENING_STATS,
    )
  })

  it('formats small and large totals quietly', () => {
    expect(formatListeningDuration(8)).toBe('less than a minute')
    expect(formatListeningDuration(90)).toBe('2 minutes')
    expect(formatListeningDuration(9 * 3600)).toBe('9 hours')
  })

  it('includes the first listening month without streak language', () => {
    expect(
      listeningSentence({
        totalSeconds: 9 * 3600,
        sessionCount: 20,
        firstListenedAt: Date.UTC(2026, 2, 4),
      }),
    ).toBe('You’ve listened for 9 hours since March.')
  })
})

describe('listening persistence', () => {
  it('round-trips through the existing local storage convention', async () => {
    const values = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    })
    const { readListeningStats, writeListeningStats } = await import('./listening')
    const stats = { totalSeconds: 42, sessionCount: 2, firstListenedAt: 10 }
    writeListeningStats(stats)
    expect(readListeningStats()).toEqual(stats)
    vi.unstubAllGlobals()
  })
})
