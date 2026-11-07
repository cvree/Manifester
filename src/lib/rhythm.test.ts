import { describe, expect, it } from 'vitest'
import { createDailyReminder } from './calendar'
import { EMPTY_LISTENING_STATS, dayKey, type ListeningStats } from './listening'
import {
  COUNTED_DAY_SECONDS,
  isReminderTime,
  readRhythm,
  rhythmSentence,
  shiftDay,
  shouldNudge,
} from './rhythm'

/** Evening of Saturday 7 November 2026, local time. */
const NOW = new Date(2026, 10, 7, 20, 30).getTime()

function statsWith(daysAgo: Record<number, number>): ListeningStats {
  const days: Record<string, number> = {}
  for (const [ago, seconds] of Object.entries(daysAgo)) {
    days[shiftDay(dayKey(NOW), -Number(ago))] = seconds
  }
  return { ...EMPTY_LISTENING_STATS, totalSeconds: 1, days }
}

describe('shiftDay', () => {
  it('crosses months and years', () => {
    expect(shiftDay('2026-03-01', -1)).toBe('2026-02-28')
    expect(shiftDay('2026-12-31', 1)).toBe('2027-01-01')
  })
})

describe('readRhythm', () => {
  it('is empty before anything', () => {
    const rhythm = readRhythm(EMPTY_LISTENING_STATS, NOW)
    expect(rhythm).toMatchObject({ current: 0, best: 0, doneToday: false, totalDays: 0 })
    expect(rhythm.week).toHaveLength(7)
    expect(rhythm.week[6].today).toBe(true)
  })

  it('counts a run ending today', () => {
    const rhythm = readRhythm(statsWith({ 0: 300, 1: 120, 2: 600 }), NOW)
    expect(rhythm.current).toBe(3)
    expect(rhythm.doneToday).toBe(true)
  })

  it('keeps yesterday’s run alive all of today', () => {
    const rhythm = readRhythm(statsWith({ 1: 120, 2: 600 }), NOW)
    expect(rhythm.current).toBe(2)
    expect(rhythm.doneToday).toBe(false)
  })

  it('does not count a day under a minute', () => {
    const rhythm = readRhythm(
      statsWith({ 0: COUNTED_DAY_SECONDS - 1, 1: 600 }),
      NOW,
    )
    expect(rhythm.doneToday).toBe(false)
    expect(rhythm.current).toBe(1)
    expect(rhythm.todaySeconds).toBe(COUNTED_DAY_SECONDS - 1)
  })

  it('remembers the best run after a gap', () => {
    const rhythm = readRhythm(statsWith({ 0: 90, 3: 90, 4: 90, 5: 90, 6: 90 }), NOW)
    expect(rhythm.current).toBe(1)
    expect(rhythm.best).toBe(4)
    expect(rhythm.weekCount).toBe(5)
  })
})

describe('rhythmSentence', () => {
  it('never speaks of a broken run', () => {
    const lapsed = readRhythm(statsWith({ 5: 90, 6: 90, 7: 90, 8: 90 }), NOW)
    const sentence = rhythmSentence(lapsed) ?? ''
    expect(sentence).not.toMatch(/lost|broke|miss/i)
    expect(sentence).toMatch(/best run is 4 days/)
  })

  it('says nothing before the first day', () => {
    expect(rhythmSentence(readRhythm(EMPTY_LISTENING_STATS, NOW))).toBeNull()
  })

  it('names a run and whether today is done', () => {
    expect(rhythmSentence(readRhythm(statsWith({ 0: 90, 1: 90, 2: 90 }), NOW))).toBe(
      '3 days in a row. Today’s done.',
    )
  })
})

describe('shouldNudge', () => {
  const alive = readRhythm(statsWith({ 1: 300 }), NOW)

  it('nudges a run that today would continue, in the evening', () => {
    expect(shouldNudge({ rhythm: alive, reminder: null, dismissedOn: null, now: NOW })).toBe(true)
  })

  it('waits for the chosen time', () => {
    expect(
      shouldNudge({ rhythm: alive, reminder: '21:00', dismissedOn: null, now: NOW }),
    ).toBe(false)
  })

  it('stops once today is done, or once waved away today', () => {
    const done = readRhythm(statsWith({ 0: 300, 1: 300 }), NOW)
    expect(shouldNudge({ rhythm: done, reminder: null, dismissedOn: null, now: NOW })).toBe(false)
    expect(
      shouldNudge({ rhythm: alive, reminder: null, dismissedOn: dayKey(NOW), now: NOW }),
    ).toBe(false)
  })

  it('leaves somebody with no run and no reminder alone', () => {
    const none = readRhythm(EMPTY_LISTENING_STATS, NOW)
    expect(shouldNudge({ rhythm: none, reminder: null, dismissedOn: null, now: NOW })).toBe(false)
  })
})

describe('daily reminder', () => {
  it('validates times', () => {
    expect(isReminderTime('21:00')).toBe(true)
    expect(isReminderTime('24:00')).toBe(false)
    expect(isReminderTime('9pm')).toBe(false)
  })

  it('repeats daily at a floating local time, starting at the next occurrence', () => {
    const ics = createDailyReminder('21:00', new Date(NOW))
    expect(ics).toContain('RRULE:FREQ=DAILY')
    expect(ics).toContain('DTSTART:20261107T210000\r\n')
    expect(ics).toContain('BEGIN:VALARM')
    const tomorrow = createDailyReminder('07:15', new Date(NOW))
    expect(tomorrow).toContain('DTSTART:20261108T071500\r\n')
  })
})
