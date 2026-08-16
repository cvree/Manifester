/**
 * The birth details, and the decision to have given them.
 *
 * ── Skipping is a real answer ───────────────────────────────────────────────
 *
 * The first visit offers this and a great many people will say no, for reasons
 * ranging from "I do not believe in it" to "I am not typing my birthday into a
 * breathing app". Both are correct answers and neither is a state to be nagged
 * out of. So a skip is *recorded* — `declined` — and the consequence is total:
 * the Sky section does not appear in the library, nothing mentions it again,
 * and the whole ephemeris is code-split so it is not even downloaded.
 *
 * It stays available in Settings for ever, where somebody who changes their
 * mind in March can find it without being asked in January.
 *
 * ── Where it lives ──────────────────────────────────────────────────────────
 *
 * `localStorage`, on the device, like every other preference in this app.
 * A birth date, time and city is a sensitive combination — it is most of what
 * an identity theft form asks for — and the design that follows from taking
 * that seriously is the one already in place everywhere else here: the data
 * never leaves, the positions are computed locally, and there is no account to
 * attach any of it to.
 */

import { readLocal, removeLocal, writeLocal } from '../storage'
import type { Place } from './places'

const KEY = 'astrology.profile'

export interface BirthDetails {
  /** `YYYY-MM-DD`, as a person would write it. */
  date: string
  /** `HH:MM` in 24-hour time, or null when they do not know. */
  time: string | null
  place: Place
}

export interface AstrologyProfile {
  birth: BirthDetails
  /** When this was first saved. Used for nothing except an honest "since". */
  savedAt: number
}

export type AstrologyState =
  /** Never asked, or asked and not answered yet. */
  | { status: 'unset' }
  /** Asked and declined. The Sky section stays hidden. */
  | { status: 'declined' }
  | { status: 'ready'; profile: AstrologyProfile }

const DECLINED = 'declined'

export function readAstrology(): AstrologyState {
  const raw = readLocal(KEY)
  if (!raw) return { status: 'unset' }
  if (raw === DECLINED) return { status: 'declined' }

  try {
    const parsed = JSON.parse(raw) as Partial<AstrologyProfile>
    const birth = parsed.birth
    if (!birth || typeof birth.date !== 'string') return { status: 'unset' }

    const place = birth.place
    if (!place || typeof place.latitude !== 'number') return { status: 'unset' }

    return {
      status: 'ready',
      profile: {
        birth: {
          date: birth.date,
          time: typeof birth.time === 'string' ? birth.time : null,
          place,
        },
        savedAt: typeof parsed.savedAt === 'number' ? parsed.savedAt : Date.now(),
      },
    }
  } catch {
    return { status: 'unset' }
  }
}

export function writeAstrology(birth: BirthDetails): AstrologyProfile {
  const existing = readAstrology()
  const profile: AstrologyProfile = {
    birth,
    savedAt:
      existing.status === 'ready' ? existing.profile.savedAt : Date.now(),
  }
  writeLocal(KEY, JSON.stringify(profile))
  return profile
}

/** "Not now." Remembered, so it is not asked again. */
export function declineAstrology(): void {
  writeLocal(KEY, DECLINED)
}

/** Back to never having been asked — what Settings' "Remove" does. */
export function forgetAstrology(): void {
  removeLocal(KEY)
}

/* ── Turning details into an instant ─────────────────────────── */

export interface ResolvedBirth {
  at: Date
  latitude: number
  longitude: number
  /** False when the time was unknown and noon was assumed. */
  precise: boolean
}

/**
 * The moment somebody was born, in UTC, from what they told us.
 *
 * Noon stands in for an unknown time, and `precise` is how every screen knows
 * not to draw an Ascendant from it. Noon rather than midnight because it is
 * the middle of the range and therefore the least wrong on average — and
 * because a midnight assumption puts about half of all births on the wrong
 * calendar day, which is a far more visible error than a blurred Moon.
 */
export async function resolveBirth(birth: BirthDetails): Promise<ResolvedBirth> {
  const [{ zonedToInstant }, { PLACES }] = await Promise.all([
    import('./zone'),
    import('./places'),
  ])

  /*
   * The stored place is re-resolved against the bundled list by name rather
   * than trusted wholesale, so that a corrected latitude or a time zone
   * renamed upstream reaches somebody who saved their details a year ago. A
   * place that has since left the list keeps working from what was stored.
   *
   * Done here rather than in `readAstrology` on purpose: reading the stored
   * state has to be cheap and synchronous, because the library calls it just
   * to decide whether a tab exists — and pulling two hundred cities into the
   * main bundle to answer that question would be a download charged to every
   * visitor who never opens this feature.
   */
  const place =
    PLACES.find(
      (entry) =>
        entry.name === birth.place.name && entry.country === birth.place.country,
    ) ?? birth.place

  const [year, month, day] = birth.date.split('-').map(Number)
  const [hour, minute] = (birth.time ?? '12:00').split(':').map(Number)

  return {
    at: zonedToInstant({ year, month, day, hour, minute }, place.timeZone),
    latitude: place.latitude,
    longitude: place.longitude,
    precise: birth.time != null,
  }
}

/** Rough validation, so an impossible date never reaches the ephemeris. */
export function isBirthUsable(birth: Partial<BirthDetails>): boolean {
  if (!birth.date || !birth.place) return false
  const [year, month, day] = birth.date.split('-').map(Number)
  if (!Number.isFinite(year) || year < 1800 || year > 2100) return false
  if (!Number.isFinite(month) || month < 1 || month > 12) return false
  if (!Number.isFinite(day) || day < 1 || day > 31) return false
  if (birth.time) {
    const [hour, minute] = birth.time.split(':').map(Number)
    if (!Number.isFinite(hour) || hour < 0 || hour > 23) return false
    if (!Number.isFinite(minute) || minute < 0 || minute > 59) return false
  }
  return true
}
