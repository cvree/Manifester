import { describe, expect, it, vi } from 'vitest'
import {
  createCalendarEvent,
  createWindowEvent,
  defaultReminderValue,
} from './calendar'
import { DEFAULT_SETTINGS, type SavedLoop } from './types'

const loop: SavedLoop = {
  ...DEFAULT_SETTINGS,
  id: 'loop-1',
  title: 'Evening; rest',
  text: 'I soften, and rest.\nI am safe.',
  createdAt: 1,
  updatedAt: 1,
  lastPlayedAt: null,
  origin: 'kept',
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

/**
 * The open window from the daily reading, on its way into a real calendar.
 *
 * An .ics a phone silently refuses to open is worse than no button at all, and
 * the two ways to produce one are both mechanical: unescaped separators in the
 * description, and lines joined with anything but CRLF.
 */
describe('a window from the sky', () => {
  const window = {
    title: 'The open window',
    description: 'Moon trine your Venus. The easiest contact of the day; use it.',
    from: new Date('2026-04-02T13:10:00Z'),
    to: new Date('2026-04-02T14:00:00Z'),
  }

  it('writes an event a calendar will take', () => {
    const event = createWindowEvent(window)
    expect(event.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(event.endsWith('END:VCALENDAR\r\n')).toBe(true)
    expect(event).toContain('DTSTART:20260402T131000Z')
    expect(event).toContain('DTEND:20260402T140000Z')
    expect(event).toContain('SUMMARY:The open window')
    expect(event).toContain('the day\\; use it.')
  })

  it('does not buzz at anybody — a window is a suggestion', () => {
    expect(createWindowEvent(window)).not.toContain('BEGIN:VALARM')
  })

  it('refuses a window with no time on it', () => {
    expect(() => createWindowEvent({ ...window, from: new Date('nonsense') })).toThrow()
  })
})
