import { useEffect, useMemo, useState } from 'react'
import {
  COMMON_ZONES,
  nearestPlace,
  placeFromZone,
  searchPlaces,
  searchZones,
  zoneLabel,
  zoneRegion,
  type Place,
} from '../../lib/astrology/places'
import { localZone, zoneSupported } from '../../lib/astrology/zone'
import { cx } from '../../lib/cx'
import { cue } from '../../lib/feedback'
import { Button } from '../Button'
import { CheckIcon, CloseIcon } from '../Icons'
import { TextField } from '../TextArea'

/**
 * Where somebody was born, and the promise that this question always has an
 * answer.
 *
 * ── The failure this replaces ───────────────────────────────────────────────
 *
 * The first version searched a bundled list of two hundred cities and, when it
 * found nothing, said so and left the Save button disabled. Somebody born in
 * Oxnard — a city of two hundred thousand people — typed their own birthplace,
 * was told it was "not on the list", and could not continue. There was no
 * other field, no override, and nothing to press.
 *
 * That is not a missing-data problem, it is a **trust** problem, and it is the
 * worst possible one to have on this particular screen: the app has just
 * finished promising that a birth date and time never leave the device, and
 * the very next thing it does is refuse to believe where somebody is from.
 *
 * ── Why it can always answer now ────────────────────────────────────────────
 *
 * Because the city list was never the thing the chart needed. What it needs is
 * a **time zone** and a rough latitude, and the browser ships the entire IANA
 * time zone database for free. So the list is now a convenience — the fast
 * path for the four hundred cities most people will type — and behind it sit
 * three fallbacks that between them cannot fail:
 *
 *  1. **Their own device's zone**, offered by name, because a great many people
 *     still live near where they were born.
 *  2. **Any time zone at all**, searchable, from the browser's own list.
 *  3. **Where they are standing**, if they choose to share it.
 *
 * Whichever is used, the place keeps the name *they typed*. Somebody who wrote
 * Oxnard is shown Oxnard, not Los Angeles: the app borrowed a nearby city's
 * coordinates and that is its business, not a correction of their birthplace.
 *
 * ── Why the results area never changes height ───────────────────────────────
 *
 * Because this form is vertically centred inside the onboarding frame, so a
 * suggestion list that grows from nothing to six rows shoves the entire page —
 * the field being typed into included — several centimetres up the screen,
 * repeatedly, on alternate keystrokes. The results live in a fixed-height
 * region that is reserved the moment the field has focus and scrolls
 * internally, so the page under a moving cursor stays exactly where it was.
 */

interface PlaceFieldProps {
  id: string
  place: Place | null
  onChange: (place: Place | null) => void
}

/** Tall enough for four rows. Fixed, so nothing below it ever moves. */
const RESULTS_HEIGHT = 'h-[13.5rem]'

export function PlaceField({ id, place, onChange }: PlaceFieldProps) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(false)
  const [zonePicker, setZonePicker] = useState(false)
  const [zoneQuery, setZoneQuery] = useState('')
  const [locating, setLocating] = useState(false)
  const [device, setDevice] = useState<string | null>(null)

  useEffect(() => {
    /*
     * Asked of the browser, not looked up in a list.
     *
     * This was `allZones().includes(zone)` and it silently dropped the device
     * zone whenever the browser reported one its own catalogue omits — `UTC`
     * is the common case, and `Intl.supportedValuesOf('timeZone')` does not
     * contain it. The effect was the exact dead end this whole component
     * exists to remove, reappearing one layer down. The question here is "will
     * this zone convert a date", so that is what gets asked.
     */
    const zone = localZone()
    if (zoneSupported(zone)) setDevice(zone)
  }, [])

  const cities = useMemo(() => searchPlaces(query), [query])

  /**
   * The zones on offer when the city list has nothing.
   *
   * Never empty. A name search first, because a birthplace often shares a name
   * with its zone; then whatever they type into the zone box; and underneath
   * both, a standing list that covers most of the world's population. A
   * fallback that can return nothing is not a fallback.
   */
  const zones = useMemo(() => {
    const found = [
      ...searchZones(zoneQuery || query, 6),
      ...(device ? [device] : []),
      ...COMMON_ZONES,
    ]
    return [...new Set(found)].slice(0, 12)
  }, [query, zoneQuery, device])

  const choose = (chosen: Place) => {
    cue('select')
    onChange(chosen)
    setActive(false)
    setZonePicker(false)
    setQuery('')
  }

  const useLocation = () => {
    if (!navigator.geolocation) return
    cue('tap')
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false)
        choose(
          nearestPlace(position.coords.latitude, position.coords.longitude),
        )
      },
      () => setLocating(false),
      { timeout: 8000, maximumAge: 600_000 },
    )
  }

  /* ── Already chosen ── */

  if (place) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-[var(--sage)] bg-[var(--sage-soft)] px-4 py-3">
        <CheckIcon
          aria-hidden="true"
          className="shrink-0 text-[0.9rem] text-[var(--sage)]"
        />
        <span className="min-w-0 grow">
          <span className="block truncate text-[0.98rem] text-ink">
            {place.name}
            {place.country && place.country !== place.name && `, ${place.country}`}
          </span>
          <span className="block truncate text-[0.78rem] text-ink-faint">
            {place.timeZone.replace(/_/g, ' ')}
          </span>
        </span>
        <button
          type="button"
          onClick={() => {
            cue('tap')
            onChange(null)
            setActive(true)
          }}
          aria-label="Choose a different place"
          className="interactive flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-muted hover:text-ink"
        >
          <CloseIcon />
        </button>
      </div>
    )
  }

  const typed = query.trim()
  const searching = typed.length >= 2

  return (
    <div>
      <TextField
        id={id}
        value={query}
        autoComplete="off"
        placeholder="The town or city — anywhere at all"
        onFocus={() => setActive(true)}
        onChange={(event) => {
          setQuery(event.target.value)
          setActive(true)
          setZonePicker(false)
        }}
      />

      {/*
        Reserved the moment the field is in use, and a fixed height from then
        on. Everything below — the privacy line, Save — therefore never moves
        while somebody is typing.
      */}
      {active && (
        <div
          className={cx(
            RESULTS_HEIGHT,
            'scroll-quiet mt-1.5 overflow-y-auto overscroll-contain rounded-[1rem]',
          )}
          data-lenis-prevent
        >
          {!searching ? (
            <div className="space-y-1.5">
              <p className="type-meta px-1 py-1">
                Two letters is enough to start.
              </p>
              {device && (
                <Row
                  title={zoneLabel(device)}
                  detail={`Where this device is — ${device.replace(/_/g, ' ')}`}
                  onClick={() => choose(placeFromZone(zoneLabel(device), device))}
                />
              )}
              {navigator.geolocation && (
                <Row
                  title={locating ? 'Asking your browser…' : 'Use where I am now'}
                  detail="Only if you want to. It is never sent anywhere."
                  onClick={useLocation}
                />
              )}
            </div>
          ) : cities.length > 0 && !zonePicker ? (
            <ul className="space-y-1.5">
              {cities.map((match) => (
                <li key={`${match.name}-${match.country}-${match.timeZone}`}>
                  <Row
                    title={match.name}
                    detail={match.country}
                    onClick={() => choose(match)}
                  />
                </li>
              ))}
              <li>
                <Row
                  muted
                  title="Somewhere else"
                  detail="Pick the time zone instead"
                  onClick={() => {
                    cue('tap')
                    setZonePicker(true)
                  }}
                />
              </li>
            </ul>
          ) : (
            /*
              The path that used to be a dead end. It leads with the person's
              own words — "Keep Wagga Wagga" — because the thing they typed is
              the answer, and all the app is missing is which clocks it was on.
            */
            <div className="space-y-1.5">
              <p className="type-meta px-1 py-1">
                {cities.length === 0
                  ? `No city called “${typed}” in the built-in list — so say which time zone it was in, and the name stays yours.`
                  : 'Say which time zone it was in, and the name stays yours.'}
              </p>

              <input
                type="text"
                value={zoneQuery}
                autoComplete="off"
                aria-label="Search time zones"
                placeholder="Search zones — Sydney, Denver, Paris…"
                onChange={(event) => setZoneQuery(event.target.value)}
                className={cx(
                  'min-h-11 w-full rounded-[1rem] border border-[var(--border)] bg-[var(--surface-strong)] px-3.5',
                  'text-[0.92rem] text-ink placeholder:text-ink-faint',
                  'transition-colors duration-200 focus:border-[var(--border-strong)]',
                )}
              />

              {zones.map((zone) => (
                <Row
                  key={zone}
                  title={`Keep “${typed}”`}
                  detail={
                    zone === device
                      ? `Same time zone as this device — ${zone.replace(/_/g, ' ')}`
                      : zone.includes('/')
                        ? `${zoneLabel(zone)} · ${zoneRegion(zone)}`
                        : zoneLabel(zone)
                  }
                  onClick={() => choose(placeFromZone(typed, zone))}
                />
              ))}

              <Row
                muted
                title="Search the city list again"
                detail="Try a larger town nearby"
                onClick={() => {
                  cue('tap')
                  setZonePicker(false)
                  setZoneQuery('')
                }}
              />
            </div>
          )}
        </div>
      )}

      {active && (
        <Button
          size="sm"
          variant="ghost"
          className="mt-1 -ml-2"
          onClick={() => {
            cue('tap')
            setActive(false)
          }}
        >
          Close suggestions
        </Button>
      )}
    </div>
  )
}

/** One tappable suggestion. Uniform, so the fixed region packs predictably. */
function Row({
  title,
  detail,
  onClick,
  muted = false,
}: {
  title: string
  detail: string
  onClick: () => void
  muted?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'interactive w-full rounded-[1rem] border px-3.5 py-2.5 text-left transition-colors duration-200',
        muted
          ? 'border-dashed border-[var(--border-strong)] hover:bg-[var(--surface-sunken)]'
          : 'border-[var(--border)] bg-[var(--surface-sunken)] hover:border-[var(--border-strong)]',
      )}
    >
      <span className="block truncate text-[0.94rem] text-ink">{title}</span>
      <span className="block truncate text-[0.78rem] text-ink-faint">{detail}</span>
    </button>
  )
}
