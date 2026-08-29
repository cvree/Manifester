import { useCallback, useEffect, useMemo, useState } from 'react'
import { buildChart, momentChart, type Chart, type Where } from './chart'
import { horoscopeOf, type Horoscope } from './horoscope'
import { portraitOf, type Portrait } from './natal'
import { readAstrology, resolveBirth, type AstrologyState } from './profile'
import { dayKey, vitalsOf, type Vital } from './reading'

/**
 * The sky, as a React value.
 *
 * Three things are worth knowing about how this behaves, and all three come
 * from what the feature is *for* rather than from anything technical.
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
 *
 * **The expensive readings are not computed here.** The daily horoscope and
 * the portrait are wanted the moment the section opens, so they are built up
 * front. The cycles, the care plan and the bonds are each a panel deeper in,
 * and each is built by the panel that shows it — which keeps opening the
 * section as fast as it was before any of them existed.
 */

export interface Astrology {
  state: AstrologyState
  /** The birth chart, once it has been computed. */
  natal: Chart | null
  /** The sky right now, over their birthplace. Live, unlike the reading. */
  now: Chart | null
  /** Where the chart is being read from — needed by the deeper panels. */
  where: Where | null
  /** Today, at length. */
  horoscope: Horoscope | null
  /** Them, at length. */
  portrait: Portrait | null
  vitals: Vital[]
  /** The calendar day everything is computed for; changes at midnight. */
  day: string
  /** True while the first computation is in flight. */
  loading: boolean
  /** Re-read the stored profile — call after saving or clearing it. */
  refresh: () => void
}

/** How often to check whether the calendar day has rolled over. */
const DAY_CHECK_MS = 60_000

export function useAstrology(): Astrology {
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

  const horoscope = useMemo(
    () => (natal ? horoscopeOf(natal, where) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `day` is the clock
    [natal, where, day],
  )

  const portrait = useMemo(() => (natal ? portraitOf(natal) : null), [natal])
  const vitals = useMemo(() => (natal ? vitalsOf(natal) : []), [natal])

  return { state, natal, now, where, horoscope, portrait, vitals, day, loading, refresh }
}
