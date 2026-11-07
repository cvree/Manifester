import { readLocal, writeLocal } from './storage'

export interface ListeningStats {
  totalSeconds: number
  sessionCount: number
  firstListenedAt: number | null
  /**
   * Seconds listened on each local calendar day, keyed `YYYY-MM-DD`.
   *
   * The totals above say how much; this says *when*, which is what a rhythm is
   * made of — the last seven days, the days in a row, whether today has
   * happened yet. Kept for the most recent `DAYS_KEPT` days with any listening
   * in them, which is a few kilobytes at most and needs no server.
   */
  days: Record<string, number>
}

/** How many days with listening in them are remembered. */
export const DAYS_KEPT = 400

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/

/** The local calendar day `time` falls on, as `YYYY-MM-DD`. */
export function dayKey(time: number | Date): string {
  const date = time instanceof Date ? time : new Date(time)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function normaliseDays(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object') return {}
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(
      (entry): entry is [string, number] =>
        DAY_KEY.test(entry[0]) &&
        typeof entry[1] === 'number' &&
        Number.isFinite(entry[1]) &&
        entry[1] > 0,
    )
    .map(([key, seconds]) => [key, Math.floor(seconds)] as const)
    .filter(([, seconds]) => seconds > 0)
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .slice(0, DAYS_KEPT)
  return Object.fromEntries(entries)
}

const KEY = 'listeningStats'

export const EMPTY_LISTENING_STATS: ListeningStats = {
  totalSeconds: 0,
  sessionCount: 0,
  firstListenedAt: null,
  days: {},
}

export function normaliseListeningStats(value: unknown): ListeningStats {
  if (!value || typeof value !== 'object') return { ...EMPTY_LISTENING_STATS, days: {} }
  const candidate = value as Partial<ListeningStats>
  const totalSeconds = finiteNonNegative(candidate.totalSeconds)
  const sessionCount = Math.floor(finiteNonNegative(candidate.sessionCount))
  const firstListenedAt =
    typeof candidate.firstListenedAt === 'number' &&
    Number.isFinite(candidate.firstListenedAt) &&
    candidate.firstListenedAt > 0
      ? candidate.firstListenedAt
      : null
  return {
    totalSeconds,
    sessionCount,
    firstListenedAt,
    days: normaliseDays(candidate.days),
  }
}

export function readListeningStats(): ListeningStats {
  const raw = readLocal(KEY)
  if (!raw) return normaliseListeningStats(null)
  try {
    return normaliseListeningStats(JSON.parse(raw))
  } catch {
    return normaliseListeningStats(null)
  }
}

export function writeListeningStats(stats: ListeningStats): void {
  writeLocal(KEY, JSON.stringify(normaliseListeningStats(stats)))
}

export function addListening(
  current: ListeningStats,
  seconds: number,
  countSession: boolean,
  startedAt: number,
  /** When the seconds were heard; they are credited to this local day. */
  now: number = Date.now(),
): ListeningStats {
  const safe = normaliseListeningStats(current)
  const added = Math.floor(finiteNonNegative(seconds))
  if (added === 0 && !countSession) return safe
  const today = dayKey(now)
  const days =
    added > 0
      ? normaliseDays({ ...safe.days, [today]: (safe.days[today] ?? 0) + added })
      : safe.days
  return {
    days,
    totalSeconds: safe.totalSeconds + added,
    sessionCount: safe.sessionCount + (countSession ? 1 : 0),
    firstListenedAt:
      safe.firstListenedAt ??
      (Number.isFinite(startedAt) && startedAt > 0 ? startedAt : Date.now()),
  }
}

/** Restore a backup without double-counting a backup restored twice. */
export function mergeListeningStats(
  current: ListeningStats,
  incoming: ListeningStats,
): ListeningStats {
  const here = normaliseListeningStats(current)
  const there = normaliseListeningStats(incoming)
  const dates = [here.firstListenedAt, there.firstListenedAt].filter(
    (value): value is number => value != null,
  )
  // Per day, the larger of the two: the same day restored twice is one day.
  const days: Record<string, number> = { ...here.days }
  for (const [key, seconds] of Object.entries(there.days)) {
    days[key] = Math.max(days[key] ?? 0, seconds)
  }
  return {
    days: normaliseDays(days),
    totalSeconds: Math.max(here.totalSeconds, there.totalSeconds),
    sessionCount: Math.max(here.sessionCount, there.sessionCount),
    firstListenedAt: dates.length > 0 ? Math.min(...dates) : null,
  }
}

export function formatListeningDuration(totalSeconds: number): string {
  const seconds = finiteNonNegative(totalSeconds)
  if (seconds < 60) return 'less than a minute'
  const minutes = Math.max(1, Math.round(seconds / 60))
  if (minutes < 60) return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  if (hours < 3 && remainder >= 5) {
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} ${remainder} minutes`
  }
  return `${hours} ${hours === 1 ? 'hour' : 'hours'}`
}

export function listeningSentence(
  stats: ListeningStats,
  locale = 'en-US',
): string | null {
  const safe = normaliseListeningStats(stats)
  if (safe.totalSeconds <= 0) return null
  const since = safe.firstListenedAt
    ? ` since ${new Intl.DateTimeFormat(locale, { month: 'long' }).format(
        new Date(safe.firstListenedAt),
      )}`
    : ''
  return `You’ve listened for ${formatListeningDuration(safe.totalSeconds)}${since}.`
}

function finiteNonNegative(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, value)
    : 0
}
