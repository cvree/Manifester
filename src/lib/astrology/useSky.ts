import { useCallback, useEffect, useMemo, useState } from 'react'
import { buildChart, momentChart, type Chart, type Where } from './chart'
import { readAstrology, resolveBirth, type AstrologyState } from './profile'
import { dayKey, readToday, vitalsOf, type DailyReading, type Vital } from './reading'

/**
 * The sky, as a React value.
 *
 * Two things are worth knowing about how this behaves, and both come from what
 * the feature is *for* rather than from anything technical.
 *
 * **It recomputes when the day turns over.** A reading is about a calendar day
 * and somebody may well leave the tab open across midnight — or, far more
 * commonly on a phone, leave it open for three days and come back to it. A
 * page still showing Tuesday's reading on Thursday is the exact failure a
 * daily feature cannot have, so the day is checked on an interval and on every
 * return to the tab.
 *
 * **Nothing loads until somebody has given their details.** The whole
 * astrology module — ephemeris, city list, interpretations — is behind a
 * dynamic import that only runs for people who have opted in, so a person who
 * skipped it in onboarding never downloads a byte of it.
 */

export interface Sky {
  state: AstrologyState
  /** The birth chart, once it has been computed. */
  natal: Chart | null
  /** The sky right now, over their birthplace. */
  now: Chart | null
  reading: DailyReading | null
  vitals: Vital[]
  /** True while the first computation is in flight. */
  loading: boolean
  /** Re-read the stored profile — call after saving or clearing it. */
  refresh: () => void
}

/** How often to check whether the calendar day has rolled over. */
const DAY_CHECK_MS = 60_000

export function useSky(): Sky {
  const [state, setState] = useState<AstrologyState>(() => readAstrology())
  const [natal, setNatal] = useState<Chart | null>(null)
  const [where, setWhere] = useState<Where | null>(null)
  const [loading, setLoading] = useState(false)
  const [day, setDay] = useState(() => dayKey(new Date()))

  const refresh = useCallback(() => setState(readAstrology()), [])

  /* The natal chart: computed once per profile, and never again. */
  useEffect(() => {
    if (state.status !== 'ready') {
      setNatal(null)
      setWhere(null)
      return
    }

    let live = true
    setLoading(true)

    void resolveBirth(state.profile.birth)
      .then((resolved) => {
        if (!live) return
        setNatal(
          buildChart(
            resolved.at,
            { latitude: resolved.latitude, longitude: resolved.longitude },
            resolved.precise,
          ),
        )
        setWhere({ latitude: resolved.latitude, longitude: resolved.longitude })
      })
      .finally(() => {
        if (live) setLoading(false)
      })

    return () => {
      live = false
    }
  }, [state])

  /* The date, watched rather than assumed. */
  useEffect(() => {
    const check = () => {
      const today = dayKey(new Date())
      setDay((current) => (current === today ? current : today))
    }
    const timer = window.setInterval(check, DAY_CHECK_MS)
    document.addEventListener('visibilitychange', check)
    window.addEventListener('focus', check)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', check)
      window.removeEventListener('focus', check)
    }
  }, [])

  /*
   * Everything derived, rebuilt when the chart or the calendar day changes and
   * at no other time.
   *
   * The memo matters more than it looks. Without it every render produces a
   * new `Chart` object, and the wheel underneath — which memoises its layout
   * on chart identity, because decluttering a dozen glyphs is real work — would
   * recompute its geometry on every keystroke anywhere on the page.
   */
  const now = useMemo(
    () => (natal ? momentChart(where) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `day` is the clock
    [natal, where, day],
  )

  const reading = useMemo(
    () => (natal ? readToday(natal, where) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `day` is the clock
    [natal, where, day],
  )

  const vitals = useMemo(() => (natal ? vitalsOf(natal) : []), [natal])

  return { state, natal, now, reading, vitals, loading, refresh }
}
