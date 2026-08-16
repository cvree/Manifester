/**
 * Turning "half past three in the afternoon, in Lisbon, in 1994" into an
 * instant.
 *
 * This is the least glamorous file in the feature and the one most likely to
 * quietly ruin it. A chart is a photograph of the sky at a moment, and the
 * moment somebody gives you is a *wall clock reading in a place*, which is not
 * a moment at all until you know what that place's clocks were doing that day.
 * Portugal was on summer time. Britain ran on Berlin time for two years during
 * the war. India is half an hour off the hour. Get this wrong by sixty minutes
 * and the Ascendant is fifteen degrees out, which is half a sign, which is a
 * different chart.
 *
 * The good news is that the browser already contains the entire IANA time zone
 * database, historical rules included, and `Intl` will consult it. It just
 * will not answer this question directly — it converts instants to wall
 * clocks, and this needs the inverse. So the inverse is done the way it always
 * is: guess an instant, ask what the clock said there, correct by the
 * difference, and repeat once because the correction can itself cross a
 * daylight-saving boundary.
 */

/** How far ahead of UTC a zone was at a given instant, in minutes. */
export function zoneOffsetMinutes(timeZone: string, instant: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant)

  const read = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? '0')

  /*
   * `hour: '2-digit'` with `hour12: false` reports midnight as 24 in some
   * engines rather than 00 — a long-standing quirk that, left alone, moves a
   * midnight birth a whole day.
   */
  const hour = read('hour') % 24

  const asIfUtc = Date.UTC(
    read('year'),
    read('month') - 1,
    read('day'),
    hour,
    read('minute'),
    read('second'),
  )

  return Math.round((asIfUtc - instant.getTime()) / 60_000)
}

export interface WallClock {
  year: number
  /** 1–12, the way a person says it. */
  month: number
  day: number
  hour: number
  minute: number
}

/**
 * The instant at which the clocks in `timeZone` read `wall`.
 *
 * Two passes. The first uses the offset in force at the naive guess, which is
 * right except within an hour or so of a clock change; the second uses the
 * offset in force at the corrected instant, which is right. A third pass would
 * never change anything, because a correction of at most an hour cannot cross
 * two boundaries.
 *
 * Ambiguous local times — the hour that happens twice each autumn — resolve to
 * the first of the two, and times that never happened at all resolve to the
 * instant an hour either side. Both are unavoidable and both are, at a degree
 * of Ascendant every four minutes, well inside the honest error of somebody
 * remembering what their mother told them.
 */
export function zonedToInstant(wall: WallClock, timeZone: string): Date {
  const naive = Date.UTC(
    wall.year,
    wall.month - 1,
    wall.day,
    wall.hour,
    wall.minute,
  )

  let instant = naive
  for (let pass = 0; pass < 2; pass += 1) {
    const offset = zoneOffsetMinutes(timeZone, new Date(instant))
    instant = naive - offset * 60_000
  }

  return new Date(instant)
}

/** Whatever zone this device believes it is in. The default for "where now". */
export function localZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

/** True when the browser will actually honour a named zone. */
export function zoneSupported(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date())
    return true
  } catch {
    return false
  }
}
