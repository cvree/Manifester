/**
 * Where everything actually is.
 *
 * This file computes real positions from real orbital mechanics. It is not a
 * lookup table of sun-sign date ranges and it is not a random number generator
 * wearing a hat — the Moon it reports is the Moon that is in the sky, to a
 * fraction of a degree, and the reason that matters is not astronomical
 * pedantry. A daily reading that people come back to has to be *about
 * something that changed*, and the only way for it to change honestly is for
 * it to be derived from a sky that changed.
 *
 * ── What is in here ─────────────────────────────────────────────────────────
 *
 *  - The Sun, from the standard low-precision solar theory. Accurate to about
 *    a hundredth of a degree, which is far beyond what anything downstream
 *    can use.
 *  - The Moon, from the largest thirty-five periodic terms of the lunar
 *    theory. Good to roughly a twentieth of a degree — comfortably enough to
 *    name its sign, its phase, and the minute it changes sign.
 *  - The seven remaining classical and modern planets, from the JPL
 *    approximate elements, solved through Kepler's equation and reduced to
 *    geocentric ecliptic longitude. Good to a few arcminutes across the range
 *    those elements are published for, which is 1800–2050.
 *  - The Ascendant and Midheaven, which need the birth *time* and *place* and
 *    are the reason this app asks for both.
 *
 * ── Conventions, stated once ────────────────────────────────────────────────
 *
 * Angles are degrees. Longitudes are ecliptic longitude of date, measured from
 * the equinox, 0–360, which is what "18° Scorpio" means: 18 degrees past 210.
 * Everything takes a Julian Day in Terrestrial Time and nobody bothers with
 * ΔT, because seventy seconds of it moves the Moon by half an arcminute and
 * moves nothing else at all.
 */

const RAD = Math.PI / 180

/** Everything this module can place. */
export type Body =
  | 'sun'
  | 'moon'
  | 'mercury'
  | 'venus'
  | 'mars'
  | 'jupiter'
  | 'saturn'
  | 'uranus'
  | 'neptune'
  | 'pluto'
  | 'node'

export const BODIES: Body[] = [
  'sun',
  'moon',
  'mercury',
  'venus',
  'mars',
  'jupiter',
  'saturn',
  'uranus',
  'neptune',
  'pluto',
  'node',
]

/* ── Time ────────────────────────────────────────────────────── */

/** Julian Day from an instant. The epoch is 1970 here and 4713 BC there. */
export function julianDay(at: Date): number {
  return at.getTime() / 86_400_000 + 2440587.5
}

export function fromJulianDay(jd: number): Date {
  return new Date((jd - 2440587.5) * 86_400_000)
}

/** Julian centuries since J2000.0, which is what every series below is in. */
function centuries(jd: number): number {
  return (jd - 2451545) / 36525
}

/** 0–360. Used everywhere; negative inputs are ordinary. */
export function norm360(degrees: number): number {
  const wrapped = degrees % 360
  return wrapped < 0 ? wrapped + 360 : wrapped
}

/** The shortest signed distance from `a` to `b`, in −180…180. */
export function angleDelta(a: number, b: number): number {
  const raw = norm360(b - a)
  return raw > 180 ? raw - 360 : raw
}

/** The separation between two longitudes, 0–180. */
export function separation(a: number, b: number): number {
  return Math.abs(angleDelta(a, b))
}

/* ── The Sun ─────────────────────────────────────────────────── */

/** Apparent geocentric ecliptic longitude of the Sun. */
export function sunLongitude(jd: number): number {
  const t = centuries(jd)

  // Geometric mean longitude and mean anomaly.
  const l0 = 280.46646 + 36000.76983 * t + 0.0003032 * t * t
  const m = 357.52911 + 35999.05029 * t - 0.0001537 * t * t
  const mRad = m * RAD

  // Equation of the centre: the difference between where a body would be on a
  // circular orbit and where an elliptical one actually puts it.
  const c =
    (1.914602 - 0.004817 * t - 0.000014 * t * t) * Math.sin(mRad) +
    (0.019993 - 0.000101 * t) * Math.sin(2 * mRad) +
    0.000289 * Math.sin(3 * mRad)

  // Aberration and nutation in longitude, folded into one correction.
  const omega = 125.04 - 1934.136 * t
  return norm360(l0 + c - 0.00569 - 0.00478 * Math.sin(omega * RAD))
}

/* ── The Moon ────────────────────────────────────────────────── */

/**
 * The thirty-five largest terms of the lunar longitude series.
 *
 * `[coefficient in millionths of a degree, D, M, M', F]`. The first line alone
 * — the principal elliptic term — is six degrees of the answer; the whole
 * table lands within about three arcminutes, which is a twentieth of the width
 * of a zodiac sign and therefore invisible to anything this app says.
 *
 * Terms in `M` (the *Sun's* anomaly) are scaled by the eccentricity factor `e`
 * below, because the Earth's orbit is slowly rounding and these terms depend
 * on it.
 */
const MOON_TERMS: [number, number, number, number, number][] = [
  [6288774, 0, 0, 1, 0],
  [1274027, 2, 0, -1, 0],
  [658314, 2, 0, 0, 0],
  [213618, 0, 0, 2, 0],
  [-185116, 0, 1, 0, 0],
  [-114332, 0, 0, 0, 2],
  [58793, 2, 0, -2, 0],
  [57066, 2, -1, -1, 0],
  [53322, 2, 0, 1, 0],
  [45758, 2, -1, 0, 0],
  [-40923, 0, 1, -1, 0],
  [-34720, 1, 0, 0, 0],
  [-30383, 0, 1, 1, 0],
  [15327, 2, 0, 0, -2],
  [-12528, 0, 0, 1, 2],
  [10980, 0, 0, 1, -2],
  [10675, 4, 0, -1, 0],
  [10034, 0, 0, 3, 0],
  [8548, 4, 0, -2, 0],
  [-7888, 2, 1, -1, 0],
  [-6766, 2, 1, 0, 0],
  [-5163, 1, 0, -1, 0],
  [4987, 1, 1, 0, 0],
  [4036, 2, -1, 1, 0],
  [3994, 2, 0, 2, 0],
  [3861, 4, 0, 0, 0],
  [3665, 2, 0, -3, 0],
  [-2689, 0, 1, -2, 0],
  [-2602, 2, 0, -1, 2],
  [2390, 2, -1, -2, 0],
  [-2348, 1, 0, 1, 0],
  [2236, 2, -2, 0, 0],
  [-2120, 0, 1, 2, 0],
  [-2069, 0, 2, 0, 0],
  [2048, 2, -2, -1, 0],
]

/** Apparent geocentric ecliptic longitude of the Moon. */
export function moonLongitude(jd: number): number {
  const t = centuries(jd)

  // Mean longitude, and the four arguments every term is built from.
  const lp =
    218.3164477 +
    481267.88123421 * t -
    0.0015786 * t * t +
    (t * t * t) / 538841 -
    (t * t * t * t) / 65194000
  const d =
    297.8501921 +
    445267.1114034 * t -
    0.0018819 * t * t +
    (t * t * t) / 545868 -
    (t * t * t * t) / 113065000
  const m = 357.5291092 + 35999.0502909 * t - 0.0001536 * t * t + (t * t * t) / 24490000
  const mp =
    134.9633964 +
    477198.8675055 * t +
    0.0087414 * t * t +
    (t * t * t) / 69699 -
    (t * t * t * t) / 14712000
  const f =
    93.272095 +
    483202.0175233 * t -
    0.0036539 * t * t -
    (t * t * t) / 3526000 +
    (t * t * t * t) / 863310000

  const e = 1 - 0.002516 * t - 0.0000074 * t * t

  let sum = 0
  for (const [coefficient, cd, cm, cmp, cf] of MOON_TERMS) {
    const argument = (cd * d + cm * m + cmp * mp + cf * f) * RAD
    // `e` once for terms linear in the Sun's anomaly, twice for quadratic.
    const scale = cm === 0 ? 1 : Math.abs(cm) === 1 ? e : e * e
    sum += coefficient * scale * Math.sin(argument)
  }

  return norm360(lp + sum / 1_000_000)
}

/** Mean longitude of the ascending lunar node. */
export function nodeLongitude(jd: number): number {
  const t = centuries(jd)
  return norm360(
    125.0445479 - 1934.1362891 * t + 0.0020754 * t * t + (t * t * t) / 467441,
  )
}

/* ── The planets ─────────────────────────────────────────────── */

/**
 * JPL's approximate orbital elements, and their rates per Julian century.
 *
 * `[a, e, I, L, longPeri, longNode]` followed by the six rates. Published for
 * 1800–2050, over which they are good to a few arcminutes in longitude for
 * everything except Pluto, which is worse and does not matter: Pluto spends
 * twelve to twenty years in a sign, so a tenth of a degree of error is never
 * the difference between one reading and another.
 */
type Elements = [number, number, number, number, number, number]

const PLANETS: Record<string, { at: Elements; rate: Elements }> = {
  mercury: {
    at: [0.38709927, 0.20563593, 7.00497902, 252.2503235, 77.45779628, 48.33076593],
    rate: [0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081],
  },
  venus: {
    at: [0.72333566, 0.00677672, 3.39467605, 181.9790995, 131.60246718, 76.67984255],
    rate: [0.0000039, -0.00004107, -0.0007889, 58517.81538729, 0.00268329, -0.27769418],
  },
  earth: {
    at: [1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0],
    rate: [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0],
  },
  mars: {
    at: [1.52371034, 0.0933941, 1.84969142, -4.55343205, -23.94362959, 49.55953891],
    rate: [0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343],
  },
  jupiter: {
    at: [5.202887, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909],
    rate: [-0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106],
  },
  saturn: {
    at: [9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448],
    rate: [-0.0012506, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794],
  },
  uranus: {
    at: [19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.9542763, 74.01692503],
    rate: [-0.00196176, -0.00004397, -0.00242939, 428.48202785, 0.40805281, 0.04240589],
  },
  neptune: {
    at: [30.06992276, 0.00859048, 1.77004347, -55.12002969, 44.96476227, 131.78422574],
    rate: [0.00026291, 0.00005105, 0.00035372, 218.45945325, -0.32241464, -0.00508664],
  },
  pluto: {
    at: [39.48211675, 0.2488273, 17.14001206, 238.92903833, 224.06891629, 110.30393684],
    rate: [-0.00031596, 0.0000517, 0.00004818, 145.20780515, -0.04062942, -0.01183482],
  },
}

/** Heliocentric rectangular ecliptic coordinates at J2000, in AU. */
function heliocentric(name: string, t: number): [number, number, number] {
  const { at, rate } = PLANETS[name]
  const [a, e, inc, l, peri, node] = at.map(
    (value, index) => value + rate[index] * t,
  ) as Elements

  // Mean anomaly, folded into −180…180 so Kepler converges from the middle.
  let mean = norm360(l - peri)
  if (mean > 180) mean -= 360

  /*
   * Kepler's equation, by Newton's method.
   *
   * `E − e·sin E = M` has no closed form. Six iterations is far more than the
   * five decimal places anything here needs, even for Pluto's eccentricity,
   * and the loop exits early on nearly every call.
   */
  const eStar = (180 / Math.PI) * e
  let anomaly = mean + eStar * Math.sin(mean * RAD)
  for (let step = 0; step < 8; step += 1) {
    const dm = mean - (anomaly - eStar * Math.sin(anomaly * RAD))
    const de = dm / (1 - e * Math.cos(anomaly * RAD))
    anomaly += de
    if (Math.abs(de) < 1e-9) break
  }

  // Position in the orbital plane, then rotated out of it.
  const xOrbit = a * (Math.cos(anomaly * RAD) - e)
  const yOrbit = a * Math.sqrt(1 - e * e) * Math.sin(anomaly * RAD)

  const argument = (peri - node) * RAD
  const cosArg = Math.cos(argument)
  const sinArg = Math.sin(argument)
  const cosNode = Math.cos(node * RAD)
  const sinNode = Math.sin(node * RAD)
  const cosInc = Math.cos(inc * RAD)
  const sinInc = Math.sin(inc * RAD)

  return [
    (cosArg * cosNode - sinArg * sinNode * cosInc) * xOrbit +
      (-sinArg * cosNode - cosArg * sinNode * cosInc) * yOrbit,
    (cosArg * sinNode + sinArg * cosNode * cosInc) * xOrbit +
      (-sinArg * sinNode + cosArg * cosNode * cosInc) * yOrbit,
    sinArg * sinInc * xOrbit + cosArg * sinInc * yOrbit,
  ]
}

/**
 * Geocentric ecliptic longitude of a planet, referred to the equinox of date.
 *
 * The elements are J2000, so the result is precessed forward. Without that
 * correction everything would be about a third of a degree behind by the
 * 2020s, which is small — and is exactly the size of error that puts a planet
 * in the wrong sign on the one day a year it is changing sign, which is the
 * day somebody would notice.
 */
export function planetLongitude(name: string, jd: number): number {
  const t = centuries(jd)
  const [px, py] = heliocentric(name, t)
  const [ex, ey] = heliocentric('earth', t)
  const longitude = Math.atan2(py - ey, px - ex) / RAD
  const precession = 1.396971 * t + 0.0003086 * t * t
  return norm360(longitude + precession)
}

/** Every body this module knows, at one instant. */
export function longitudeOf(body: Body, jd: number): number {
  switch (body) {
    case 'sun':
      return sunLongitude(jd)
    case 'moon':
      return moonLongitude(jd)
    case 'node':
      return nodeLongitude(jd)
    default:
      return planetLongitude(body, jd)
  }
}

/**
 * Whether a body appears to be moving backwards.
 *
 * Measured rather than tabulated: one longitude now, one a day later, and the
 * sign of the difference. That is also literally what retrograde *is* — an
 * appearance produced by two orbits overtaking each other — so computing it
 * this way is both the simplest implementation and the honest one.
 *
 * The Sun and Moon never retrograde. The node always does.
 */
export function isRetrograde(body: Body, jd: number): boolean {
  if (body === 'sun' || body === 'moon') return false
  if (body === 'node') return true
  return angleDelta(longitudeOf(body, jd), longitudeOf(body, jd + 1)) < 0
}

/* ── The horizon ─────────────────────────────────────────────── */

/** Greenwich mean sidereal time in degrees: which way the Earth is facing. */
export function siderealTime(jd: number): number {
  const t = centuries(jd)
  return norm360(
    280.46061837 +
      360.98564736629 * (jd - 2451545) +
      0.000387933 * t * t -
      (t * t * t) / 38710000,
  )
}

/** Obliquity of the ecliptic: the tilt that gives us seasons and signs. */
export function obliquity(jd: number): number {
  const t = centuries(jd)
  return 23.439291 - 0.0130042 * t - 0.00000016 * t * t + 0.000000504 * t * t * t
}

export interface Angles {
  /** The degree of the zodiac rising in the east. */
  ascendant: number
  /** The degree culminating overhead. */
  midheaven: number
}

/**
 * The Ascendant and Midheaven, which is the whole reason birth time and place
 * are asked for.
 *
 * The Sun's sign is a date. These two are a *minute and a place*: they move a
 * degree every four minutes and they are completely different in Sydney and in
 * Reykjavík at the same instant. It is why "what time were you born?" is the
 * question that separates a real chart from a magazine column, and why this
 * app treats an unknown birth time as a real answer rather than making
 * somebody guess — see `chart.ts`.
 */
export function angles(jd: number, latitude: number, longitude: number): Angles {
  const ramc = norm360(siderealTime(jd) + longitude)
  const eps = obliquity(jd) * RAD
  const ramcRad = ramc * RAD
  const lat = latitude * RAD

  const midheaven = norm360(
    Math.atan2(Math.sin(ramcRad), Math.cos(ramcRad) * Math.cos(eps)) / RAD,
  )

  const ascendant = norm360(
    Math.atan2(
      Math.cos(ramcRad),
      -(Math.sin(ramcRad) * Math.cos(eps) + Math.tan(lat) * Math.sin(eps)),
    ) / RAD,
  )

  return { ascendant, midheaven }
}

/* ── The Moon's month ────────────────────────────────────────── */

export interface MoonPhase {
  /** 0 at new, 180 at full, 360 back at new. */
  angle: number
  /** 0–1. What fraction of the disc is lit. */
  illumination: number
  /** 0–1 through the cycle, for drawing. */
  cycle: number
  name: string
  waxing: boolean
}

const PHASE_NAMES: [number, string][] = [
  [22.5, 'New Moon'],
  [67.5, 'Waxing Crescent'],
  [112.5, 'First Quarter'],
  [157.5, 'Waxing Gibbous'],
  [202.5, 'Full Moon'],
  [247.5, 'Waning Gibbous'],
  [292.5, 'Last Quarter'],
  [337.5, 'Waning Crescent'],
]

export function moonPhase(jd: number): MoonPhase {
  const angle = norm360(moonLongitude(jd) - sunLongitude(jd))
  const illumination = (1 - Math.cos(angle * RAD)) / 2
  const name = PHASE_NAMES.find(([limit]) => angle < limit)?.[1] ?? 'New Moon'
  return {
    angle,
    illumination,
    cycle: angle / 360,
    name,
    waxing: angle < 180,
  }
}

/**
 * When a body next crosses into the following sign.
 *
 * Bisection rather than an analytic solve, because every body here moves
 * monotonically over the hours involved and thirty halvings of a search
 * interval is accurate to under a second — which is far more than a sentence
 * saying "at about four this afternoon" can use, and costs a few dozen
 * evaluations of a series that takes microseconds.
 *
 * Returns `null` when the crossing is further away than `withinDays`, which is
 * the ordinary answer for everything slower than the Moon.
 */
export function nextSignChange(
  body: Body,
  jd: number,
  withinDays = 3,
): number | null {
  const startSign = Math.floor(longitudeOf(body, jd) / 30)

  let low = jd
  let high = jd
  const step = body === 'moon' ? 0.05 : 0.5

  while (high < jd + withinDays) {
    high = Math.min(high + step, jd + withinDays)
    if (Math.floor(longitudeOf(body, high) / 30) !== startSign) break
    low = high
    if (high >= jd + withinDays) return null
  }

  if (Math.floor(longitudeOf(body, high) / 30) === startSign) return null

  for (let step = 0; step < 30; step += 1) {
    const middle = (low + high) / 2
    if (Math.floor(longitudeOf(body, middle) / 30) === startSign) low = middle
    else high = middle
  }

  return high
}
