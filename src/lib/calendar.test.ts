import { describe, expect, it, vi } from 'vitest'
import { createCalendarEvent, defaultReminderValue } from './calendar'
import { DEFAULT_SETTINGS, type SavedLoop } from './types'

const loop: SavedLoop = {
  ...DEFAULT_SETTINGS,
  id: 'loop-1',
  title: 'Evening; rest',
  text: 'I soften, and rest.\nI am safe.',
  createdAt: 1,
  updatedAt: 1,
  lastPlayedAt: null,
}

describe('calendar reminders', () => {
  it('creates a portable event with escaped words and a reminder', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-01T00:00:00Z'))
    const event = createCalendarEvent(loop, new Date('2026-08-02T04:00:00Z'), 20)
    expect(event).toContain('DTSTART:20260802T040000Z')
    expect(event).toContain('SUMMARY:Listen: Evening\\; rest')
    expect(event).toContain('DESCRIPTION:I soften\\, and rest.\\nI am safe.')
    expect(event).toContain('BEGIN:VALARM')
    vi.useRealTimers()
  })

  it('suggests nine tomorrow evening without scheduling anything itself', () => {
    expect(defaultReminderValue(new Date(2026, 7, 1, 23, 30))).toBe('2026-08-02T21:00')
  })
})
