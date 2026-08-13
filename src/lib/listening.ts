import { readLocal, writeLocal } from './storage'

export interface ListeningStats {
  totalSeconds: number
  sessionCount: number
  firstListenedAt: number | null
}

const KEY = 'listeningStats'

export const EMPTY_LISTENING_STATS: ListeningStats = {
  totalSeconds: 0,
  sessionCount: 0,
  firstListenedAt: null,
}

export function normaliseListeningStats(value: unknown): ListeningStats {
  if (!value || typeof value !== 'object') return { ...EMPTY_LISTENING_STATS }
  const candidate = value as Partial<ListeningStats>
  const totalSeconds = finiteNonNegative(candidate.totalSeconds)
  const sessionCount = Math.floor(finiteNonNegative(candidate.sessionCount))
  const firstListenedAt =
    typeof candidate.firstListenedAt === 'number' &&
    Number.isFinite(candidate.firstListenedAt) &&
    candidate.firstListenedAt > 0
      ? candidate.firstListenedAt
      : null
  return { totalSeconds, sessionCount, firstListenedAt }
}

export function readListeningStats(): ListeningStats {
  const raw = readLocal(KEY)
  if (!raw) return { ...EMPTY_LISTENING_STATS }
  try {
    return normaliseListeningStats(JSON.parse(raw))
  } catch {
    return { ...EMPTY_LISTENING_STATS }
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
): ListeningStats {
  const safe = normaliseListeningStats(current)
  const added = Math.floor(finiteNonNegative(seconds))
  if (added === 0 && !countSession) return safe
  return {
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
  return {
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
