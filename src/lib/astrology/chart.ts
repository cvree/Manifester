/**
 * A chart: everything in the sky at one instant, seen from one place.
 *
 * Two of these are ever built. The **natal** chart is the sky at somebody's
 * birth and never changes again. The **moment** chart is the sky right now,
 * rebuilt whenever it is looked at, and is the thing the daily reading is
 * about — it is the same object the "chart of the moment" pages elsewhere on
 * the web draw, computed here rather than fetched, because sending somebody's
 * birth data to a third party would break the one promise this app makes on
 * every screen.
 *
 * ── Unknown birth time ──────────────────────────────────────────────────────
 *
 * A great many people do not know what time they were born, and the usual
 * treatment of that is to make them guess or to quietly assume noon and print
 * an Ascendant as if it were a fact. Both are lies of different sizes: the
 * Ascendant moves a degree every four minutes, so a guessed time produces a
 * confidently wrong rising sign, and the Moon can move seven degrees across a
 * day, which is enough to change its sign about one day in four.
 *
 * So an unknown time is a first-class answer here. The chart is built for noon
 * — the position least wrong on average — `precise` is false, the Ascendant
 * and Midheaven are simply absent rather than fabricated, and every screen
 * that shows the Moon says how far it could have moved. Somebody who later
 * finds their birth certificate can add the time and watch the chart sharpen,
 * which is a better experience than never having been told it was blurred.
 */

import {
  BODIES,
  angles,
  isRetrograde,
  julianDay,
  longitudeOf,
  moonPhase,
  nextSignChange,
  type Body,
  type MoonPhase,
} from './ephemeris'
import {
  BODY_PROFILES,
  aspectBetween,
  signOf,
  type AspectKind,
  type Point,
  type Sign,
} from './signs'

export interface Placement {
  body: Body
  longitude: number
  sign: Sign
  retrograde: boolean
  /** Whole-sign house, 1–12, when the chart has an Ascendant. */
  house: number | null
}

export interface Chart {
  /** The instant, in UTC. */
  at: Date
  julian: number
  placements: Placement[]
  /** Absent when the birth time is unknown. */
  ascendant: number | null
  midheaven: number | null
  /** False when this was built from a date without a time. */
  precise: boolean
  phase: MoonPhase
}

export interface Where {
  latitude: number
  longitude: number
}

/**
 * Build a chart for an instant and a place.
 *
 * `where` may be omitted, which is what "I know the date but not where" means
 * in practice — the planets are identical from anywhere on Earth to well
 * inside the precision of anything here, and only the Ascendant needs a
 * horizon to be measured against.
 */
export function buildChart(
  at: Date,
  where: Where | null,
  precise: boolean,
): Chart {
  const julian = julianDay(at)

  const horizon =
    precise && where ? angles(julian, where.latitude, where.longitude) : null

  const ascendantSign = horizon ? Math.floor(horizon.ascendant / 30) : null

  const placements: Placement[] = BODIES.map((body) => {
    const longitude = longitudeOf(body, julian)
    return {
      body,
      longitude,
      sign: signOf(longitude),
      retrograde: isRetrograde(body, julian),
      house:
        ascendantSign == null
          ? null
          : /*
             * Whole-sign houses: the Ascendant's sign is the first house and
             * every sign after it is the next. Chosen over Placidus for two
             * reasons — it is the oldest system and still in wide use, and it
             * does not fall apart above the Arctic Circle, where Placidus
             * produces houses of literally zero width and charts that cannot
             * be drawn.
             */
            ((Math.floor(longitude / 30) - ascendantSign + 12) % 12) + 1,
    }
  })

  return {
    at,
    julian,
    placements,
    ascendant: horizon?.ascendant ?? null,
    midheaven: horizon?.midheaven ?? null,
    precise,
    phase: moonPhase(julian),
  }
}

/** The sky as it is, wherever the person is standing now. */
export function momentChart(where: Where | null, at: Date = new Date()): Chart {
  return buildChart(at, where, where != null)
}

export function placementOf(chart: Chart, body: Body): Placement {
  return chart.placements.find((entry) => entry.body === body)!
}

/** Everything the chart holds, including the two angles, as addressable points. */
export function longitudeOfPoint(chart: Chart, point: Point): number | null {
  if (point === 'ascendant') return chart.ascendant
  if (point === 'midheaven') return chart.midheaven
  return placementOf(chart, point).longitude
}

/* ── Transits ────────────────────────────────────────────────── */

export interface Transit {
  /** The moving body, in today's sky. */
  from: Body
  /** The point in the natal chart it is contacting. */
  to: Point
  kind: AspectKind
  /** Degrees from exact. */
  orb: number
  /** 0–1, where 1 is exact. */
  exactness: number
  /** How much this one deserves to lead a reading. See `rank`. */
  significance: number
  /** True while the transiting body is still closing in on exact. */
  applying: boolean
}

/**
 * Which natal points are worth reporting contacts to.
 *
 * The personal points and the angles. Contacts between two slow planets are
 * real and are also the same for everybody born within a few years, which
 * makes them the least *personal* thing a chart contains — exactly the wrong
 * thing to lead a daily reading with.
 */
const NATAL_TARGETS: Point[] = [
  'sun',
  'moon',
  'mercury',
  'venus',
  'mars',
  'ascendant',
  'midheaven',
  'jupiter',
  'saturn',
]

/** Bodies whose motion makes a transit worth mentioning at all. */
const TRANSITING: Body[] = [
  'moon',
  'sun',
  'mercury',
  'venus',
  'mars',
  'jupiter',
  'saturn',
  'uranus',
  'neptune',
  'pluto',
]


/**
 * Every contact between today's sky and a natal chart, strongest first.
 *
 * "Strongest" is a real ranking rather than a sort by orb, and the weighting
 * is the difference between a reading that says something and one that says
 * *the Moon is trine your Mercury* every third day. Three things multiply:
 * how close to exact the contact is, how slow the transiting body is, and how
 * hard the aspect is felt. A Saturn square within a degree wins over a
 * near-exact Moon sextile every time, which is also how it feels.
 */
export function transits(natal: Chart, sky: Chart): Transit[] {
  const found: Transit[] = []

  for (const body of TRANSITING) {
    const moving = placementOf(sky, body)

    for (const target of NATAL_TARGETS) {
      const natalLongitude = longitudeOfPoint(natal, target)
      if (natalLongitude == null) continue

      const aspect = aspectBetween(moving.longitude, natalLongitude)
      if (!aspect) continue

      /*
       * Applying or separating.
       *
       * A transit that is closing in is on its way and is the one worth
       * naming; one that has passed is already being remembered rather than
       * lived. Measured the same way retrogradation is — by looking at
       * tomorrow — because that is the definition rather than an estimate of it.
       */
      const tomorrow = longitudeOf(body, sky.julian + 0.25)
      const after = aspectBetween(tomorrow, natalLongitude)
      const applying = after != null && after.orb < aspect.orb

      found.push({
        from: body,
        to: target,
        kind: aspect.kind,
        orb: aspect.orb,
        exactness: aspect.exactness,
        applying,
        significance:
          aspect.exactness *
          BODY_PROFILES[body].weight *
          aspect.kind.weight *
          // A contact to the Sun, Moon or Ascendant is about the person; one
          // to their Jupiter is about a corner of them.
          (target === 'sun' || target === 'moon' || target === 'ascendant'
            ? 1
            : 0.82) *
          (applying ? 1 : 0.85),
      })
    }
  }

  return found.sort((a, b) => b.significance - a.significance)
}

/**
 * When the Moon next changes sign.
 *
 * The one piece of genuine timing in the whole feature, and the reason it is
 * worth computing rather than describing: "the mood shifts at about ten past
 * four this afternoon" is checkable, specific, and true, and it is the sort of
 * thing somebody opens an app again to look at.
 */
export function moonIngress(sky: Chart): { at: Date; sign: Sign } | null {
  const jd = nextSignChange('moon', sky.julian, 2.5)
  if (jd == null) return null
  const at = new Date((jd - 2440587.5) * 86_400_000)
  return { at, sign: signOf(longitudeOf('moon', jd + 0.01)) }
}
