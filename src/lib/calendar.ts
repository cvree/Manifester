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

export function downloadCalendarReminder(loop: SavedLoop, startsAt: Date): void {
  const blob = new Blob([createCalendarEvent(loop, startsAt)], {
    type: 'text/calendar;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = calendarFilename(loop.title)
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
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
