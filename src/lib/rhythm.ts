/**
 * Your rhythm: which days you listened, read back kindly.
 *
 * ── The line this walks ──
 *
 * A row of days you showed up on is one of the few things that reliably brings
 * people back to a practice — and a streak counter is also one of the most
 * reliable ways to make a calm app feel like a slot machine that scolds you.
 * So this keeps the useful half and drops the other:
 *
 * - A day counts after one minute. Not twenty; the point is coming back, and a
 *   minute on a hard day is coming back.
 * - The count is alive all of today. Not having listened *yet* is not having
 *   missed it, so yesterday's run is shown, not zeroed, until today is over.
 * - Nothing is ever "lost". A broken run is never mentioned; the next time is
 *   simply welcomed, and the best run so far is kept as something to be glad
 *   of rather than something to defend.
 *
 * Pure, so the arithmetic of a week is tested without waiting for one.
 */

import { dayKey, type ListeningStats } from './listening'

/** Seconds of listening that make a day count. */
export const COUNTED_DAY_SECONDS = 60

export interface RhythmDay {
  key: string
  /** One letter, for a dot's label: "M", "T"… */
  initial: string
  /** The weekday in full, for screen readers: "Monday". */
  name: string
  seconds: number
  done: boolean
  today: boolean
}

export interface Rhythm {
  /** Days in a row, ending today if today counts, or yesterday if not yet. */
  current: number
  /** The longest run on record. */
  best: number
  doneToday: boolean
  todaySeconds: number
  /** The last seven days, oldest first, ending today. */
  week: RhythmDay[]
  /** Days counted in the last seven. */
  weekCount: number
  /** Every day with at least a counted minute, ever (within what is kept). */
  totalDays: number
}

/** The day `offset` days after the one `key` names. Local, DST-safe. */
export function shiftDay(key: string, offset: number): string {
  const [year, month, day] = key.split('-').map(Number)
  // Noon, so a daylight-saving change can never push the result across midnight.
  return dayKey(new Date(year, month - 1, day + offset, 12))
}

function counted(days: Record<string, number>, key: string): boolean {
  return (days[key] ?? 0) >= COUNTED_DAY_SECONDS
}

export function readRhythm(stats: ListeningStats, now: number = Date.now()): Rhythm {
  const days = stats.days ?? {}
  const today = dayKey(now)
  const doneToday = counted(days, today)

  let current = 0
  let cursor = doneToday ? today : shiftDay(today, -1)
  while (counted(days, cursor)) {
    current += 1
    cursor = shiftDay(cursor, -1)
  }

  const keys = Object.keys(days)
    .filter((key) => counted(days, key))
    .sort()
  let best = 0
  let run = 0
  let previous: string | null = null
  for (const key of keys) {
    run = previous != null && shiftDay(previous, 1) === key ? run + 1 : 1
    best = Math.max(best, run)
    previous = key
  }
  best = Math.max(best, current)

  const week: RhythmDay[] = []
  for (let offset = -6; offset <= 0; offset += 1) {
    const key = shiftDay(today, offset)
    const [year, month, day] = key.split('-').map(Number)
    const date = new Date(year, month - 1, day, 12)
    const name = weekday(date, 'long')
    week.push({
      key,
      initial: weekday(date, 'narrow'),
      name,
      seconds: days[key] ?? 0,
      done: counted(days, key),
      today: offset === 0,
    })
  }

  return {
    current,
    best,
    doneToday,
    todaySeconds: days[today] ?? 0,
    week,
    weekCount: week.filter((day) => day.done).length,
    totalDays: keys.length,
  }
}

function weekday(date: Date, width: 'long' | 'narrow'): string {
  try {
    return new Intl.DateTimeFormat(undefined, { weekday: width }).format(date)
  } catch {
    const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const name = names[date.getDay()]
    return width === 'long' ? name : name[0]
  }
}

/**
 * One sentence about where the rhythm stands, or `null` before there is one.
 *
 * Every branch is something a person would be glad to read. There is no
 * sentence here for "you broke it".
 */
export function rhythmSentence(rhythm: Rhythm): string | null {
  const { current, doneToday, best, totalDays } = rhythm
  if (totalDays === 0) return null
  if (doneToday) {
    if (current >= 2) return `${current} days in a row. Today’s done.`
    return totalDays > 1 ? 'Today’s done. Welcome back.' : 'Today’s done — your first day.'
  }
  if (current >= 2) return `${current} days in a row. A few minutes today keeps it going.`
  if (current === 1) return 'You listened yesterday. A few minutes today makes two.'
  if (best >= 3) return `Your best run is ${best} days. Any day is a good day to start another.`
  return 'Welcome back. A few minutes is enough.'
}

/** The short form, for a chip: "3 days" / "Today ✓" style, without symbols. */
export function rhythmChip(rhythm: Rhythm): string | null {
  if (rhythm.totalDays === 0) return null
  if (rhythm.current >= 2) return `${rhythm.current} days in a row`
  if (rhythm.doneToday) return 'Today’s done'
  return null
}

/* ── The daily nudge ─────────────────────────────────────────── */

/** "21:00" — a reminder time as stored. */
export type ReminderTime = string

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/

export function isReminderTime(value: unknown): value is ReminderTime {
  return typeof value === 'string' && TIME.test(value)
}

/** Minutes after local midnight. */
function minutesOf(time: ReminderTime): number {
  const [, hours, minutes] = TIME.exec(time) ?? []
  return Number(hours) * 60 + Number(minutes)
}

/**
 * Whether to show the in-app nudge right now.
 *
 * Only when there is something to keep — a reminder somebody asked for, or a
 * run that today would continue — only once today's time has come, only when
 * today has not happened yet, and never twice in a day once waved away.
 */
export function shouldNudge(options: {
  rhythm: Rhythm
  reminder: ReminderTime | null
  dismissedOn: string | null
  now?: number
}): boolean {
  const now = options.now ?? Date.now()
  const { rhythm, reminder, dismissedOn } = options
  if (rhythm.doneToday) return false
  if (dismissedOn === dayKey(now)) return false
  if (!reminder && rhythm.current === 0) return false
  const date = new Date(now)
  const minutesNow = date.getHours() * 60 + date.getMinutes()
  // With no time chosen, the evening: late enough not to nag at breakfast.
  const due = reminder ? minutesOf(reminder) : 18 * 60
  return minutesNow >= due
}

/** "9:00 pm", in the person's own locale. */
export function formatReminderTime(time: ReminderTime): string {
  const minutes = minutesOf(time)
  const date = new Date(2026, 0, 1, Math.floor(minutes / 60), minutes % 60)
  try {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  } catch {
    return time
  }
}
