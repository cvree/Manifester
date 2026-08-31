import type { SavedLoop } from './types'

export function defaultReminderValue(now = new Date()): string {
  const next = new Date(now)
  next.setDate(next.getDate() + 1)
  next.setHours(21, 0, 0, 0)
  return toLocalInputValue(next)
}

export function calendarFilename(title: string): string {
  const safe = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `${safe || 'manifester-loop'}-reminder.ics`
}

export function createCalendarEvent(
  loop: SavedLoop,
  startsAt: Date,
  durationMinutes = loop.timerMinutes ?? 20,
): string {
  if (!Number.isFinite(startsAt.getTime())) throw new Error('Choose a valid time.')
  const duration = Math.min(8 * 60, Math.max(5, Math.round(durationMinutes)))
  const endsAt = new Date(startsAt.getTime() + duration * 60_000)
  const description = loop.text.trim().slice(0, 800)
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Manifester//Quiet reminder//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${escapeIcs(`${loop.id}-${startsAt.getTime()}@manifester.local`)}`,
    `DTSTAMP:${formatUtc(new Date())}`,
    `DTSTART:${formatUtc(startsAt)}`,
    `DTEND:${formatUtc(endsAt)}`,
    `SUMMARY:${escapeIcs(`Listen: ${loop.title}`)}`,
    `DESCRIPTION:${escapeIcs(description)}`,
    'BEGIN:VALARM',
    'TRIGGER:PT0M',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeIcs(loop.title)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n')
}

/**
 * Any stretch of a day, as a calendar event.
 *
 * The daily reading works out an open window to the minute — "the easiest
 * contact of the day is exact between ten past two and three" — and a fact
 * like that is worth nothing sitting on a screen somebody read at breakfast.
 * Getting it into the calendar they actually plan from is the difference
 * between a horoscope and a tool, and it is eleven lines of iCalendar.
 *
 * No alarm on this one, unlike a loop reminder. A window is a suggestion about
 * when to have a conversation; being buzzed at by a planet is not the
 * relationship this app wants with anybody.
 */
export function createWindowEvent(event: {
  title: string
  description: string
  from: Date
  to: Date
}): string {
  if (!Number.isFinite(event.from.getTime()) || !Number.isFinite(event.to.getTime())) {
    throw new Error('That window has no time on it.')
  }
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Manifester//Sky//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${escapeIcs(`sky-${event.from.getTime()}@manifester.local`)}`,
    `DTSTAMP:${formatUtc(new Date())}`,
    `DTSTART:${formatUtc(event.from)}`,
    `DTEND:${formatUtc(event.to)}`,
    `SUMMARY:${escapeIcs(event.title)}`,
    `DESCRIPTION:${escapeIcs(event.description)}`,
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n')
}

/** The same, handed to whatever the device opens `.ics` files with. */
export function downloadWindow(event: {
  title: string
  description: string
  from: Date
  to: Date
}): void {
  offerFile(createWindowEvent(event), `${slug(event.title)}.ics`)
}

export function downloadCalendarReminder(loop: SavedLoop, startsAt: Date): void {
  offerFile(createCalendarEvent(loop, startsAt), calendarFilename(loop.title))
}

function offerFile(body: string, filename: string): void {
  const blob = new Blob([body], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

function slug(title: string): string {
  return (
    title
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'manifester'
  )
}

function formatUtc(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

function escapeIcs(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
}

function toLocalInputValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`
}
