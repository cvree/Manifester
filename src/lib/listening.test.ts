import { describe, expect, it, vi } from 'vitest'
import {
  DAYS_KEPT,
  EMPTY_LISTENING_STATS,
  addListening,
  dayKey,
  formatListeningDuration,
  listeningSentence,
  mergeListeningStats,
  normaliseListeningStats,
} from './listening'

describe('listening totals', () => {
  it('only moves forward and counts a session once when asked', () => {
    const at = new Date(2026, 2, 4, 21).getTime()
    const first = addListening(EMPTY_LISTENING_STATS, 65, true, at, at)
    const next = addListening(first, 35, false, at, at + 60_000)
    expect(next).toEqual({
      totalSeconds: 100,
      sessionCount: 1,
      firstListenedAt: at,
      days: { '2026-03-04': 100 },
    })
  })

  it('restores by taking the larger totals rather than double-counting', () => {
    expect(
      mergeListeningStats(
        {
          totalSeconds: 500,
          sessionCount: 4,
          firstListenedAt: 20,
          days: { '2026-03-01': 60, '2026-03-02': 200 },
        },
        {
          totalSeconds: 300,
          sessionCount: 8,
          firstListenedAt: 10,
          days: { '2026-03-02': 90, '2026-03-03': 40 },
        },
      ),
    ).toEqual({
      totalSeconds: 500,
      sessionCount: 8,
      firstListenedAt: 10,
      days: { '2026-03-01': 60, '2026-03-02': 200, '2026-03-03': 40 },
    })
  })

  it('normalises malformed persisted values safely', () => {
    expect(normaliseListeningStats({ totalSeconds: -4, sessionCount: Number.NaN })).toEqual(
      EMPTY_LISTENING_STATS,
    )
  })

  it('credits each day separately, across midnight', () => {
    const evening = new Date(2026, 4, 1, 23, 59).getTime()
    const after = new Date(2026, 4, 2, 0, 1).getTime()
    const one = addListening(EMPTY_LISTENING_STATS, 120, true, evening, evening)
    const two = addListening(one, 60, false, evening, after)
    expect(two.days).toEqual({ '2026-05-01': 120, '2026-05-02': 60 })
  })

  it('drops malformed days and keeps only the most recent ones', () => {
    const days: Record<string, unknown> = { nonsense: 5, '2026-01-01': -3 }
    for (let i = 0; i < 450; i += 1) {
      days[dayKey(new Date(2025, 0, 1 + i))] = 30
    }
    const safe = normaliseListeningStats({ totalSeconds: 1, days })
    expect(Object.keys(safe.days)).toHaveLength(DAYS_KEPT)
    expect(safe.days.nonsense).toBeUndefined()
    expect(safe.days[dayKey(new Date(2025, 0, 1))]).toBeUndefined()
    expect(safe.days[dayKey(new Date(2025, 0, 450))]).toBe(30)
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
        days: {},
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
    const stats = {
      totalSeconds: 42,
      sessionCount: 2,
      firstListenedAt: 10,
      days: { '2026-01-02': 42 },
    }
    writeListeningStats(stats)
    expect(readListeningStats()).toEqual(stats)
    vi.unstubAllGlobals()
  })
})
