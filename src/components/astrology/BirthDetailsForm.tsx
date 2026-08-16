import { useId, useMemo, useState } from 'react'
import type { BirthDetails } from '../../lib/astrology/profile'
import { isBirthUsable } from '../../lib/astrology/profile'
import { searchPlaces, type Place } from '../../lib/astrology/places'
import { cx } from '../../lib/cx'
import { cue } from '../../lib/feedback'
import { Button } from '../Button'
import { FieldLabel } from '../Card'
import { CheckIcon, CloseIcon } from '../Icons'
import { TextField } from '../TextArea'

/**
 * Three questions, and one of them is allowed to be answered with "I don't
 * know".
 *
 * ── Why this form is shaped the way it is ───────────────────────────────────
 *
 * Every birth-chart form on the internet asks for date, time and place, and
 * almost all of them treat the time as required — which forces the very large
 * number of people who do not know theirs to invent one. That is worse than
 * useless: a made-up time produces a confident, specific, *wrong* Ascendant,
 * and the person has no way of knowing that the most personal-looking number
 * on the page is the one made of nothing.
 *
 * So the time here has an explicit "I don't know" beside it, taking that
 * answer costs nothing, and what it changes is stated plainly rather than
 * hidden: the rising sign is left out, and the Moon is marked approximate. The
 * rest of the chart is unaffected, which is most of it.
 *
 * ── Why the place is a list ─────────────────────────────────────────────────
 *
 * Because the alternative is sending a birthplace to a geocoder. The list is
 * bundled, the search runs on the device, and the escape hatch for anywhere
 * not on it is a pair of coordinates typed in by hand. See `places.ts`.
 */

interface BirthDetailsFormProps {
  /** Prefilled when somebody is editing details they have already given. */
  initial?: BirthDetails | null
  onSave: (birth: BirthDetails) => void
  /** The label on the primary button. */
  saveLabel?: string
  /** Rendered beside Save, when there is somewhere to go instead. */
  secondary?: React.ReactNode
}

export function BirthDetailsForm({
  initial,
  onSave,
  saveLabel = 'Save',
  secondary,
}: BirthDetailsFormProps) {
  const ids = useId()

  const [date, setDate] = useState(initial?.date ?? '')
  const [time, setTime] = useState(initial?.time ?? '')
  const [knowsTime, setKnowsTime] = useState(initial ? initial.time != null : true)
  const [place, setPlace] = useState<Place | null>(initial?.place ?? null)
  const [query, setQuery] = useState(initial ? `${initial.place.name}` : '')

  const matches = useMemo(
    () => (place && query === place.name ? [] : searchPlaces(query)),
    [query, place],
  )

  const birth: BirthDetails | null = place
    ? { date, time: knowsTime && time ? time : null, place }
    : null

  const ready = birth != null && isBirthUsable(birth)

  return (
    <div className="space-y-4">
      <div>
        <FieldLabel htmlFor={`${ids}-date`}>Date of birth</FieldLabel>
        <TextField
          id={`${ids}-date`}
          type="date"
          value={date}
          min="1900-01-01"
          max="2100-12-31"
          onChange={(event) => setDate(event.target.value)}
        />
      </div>

      <div>
        <FieldLabel htmlFor={`${ids}-time`}>Time of birth</FieldLabel>
        {knowsTime ? (
          <>
            <TextField
              id={`${ids}-time`}
              type="time"
              value={time}
              onChange={(event) => setTime(event.target.value)}
            />
            <button
              type="button"
              onClick={() => {
                cue('tap')
                setKnowsTime(false)
              }}
              className="interactive mt-2 min-h-11 rounded-pill text-[0.86rem] text-ink-muted underline decoration-[var(--border-strong)] underline-offset-4 hover:text-ink"
            >
              I don&rsquo;t know what time I was born
            </button>
          </>
        ) : (
          <div className="rounded-[1.15rem] border border-dashed border-[var(--border-strong)] px-4 py-3">
            <p className="text-[0.9rem] leading-relaxed text-ink-muted">
              That is a completely fine answer. Everything except the rising
              sign still works, and your Moon is marked as approximate rather
              than quietly guessed.
            </p>
            <button
              type="button"
              onClick={() => {
                cue('tap')
                setKnowsTime(true)
              }}
              className="interactive mt-1.5 min-h-11 rounded-pill text-[0.86rem] text-ink-muted underline decoration-[var(--border-strong)] underline-offset-4 hover:text-ink"
            >
              Actually, I do know it
            </button>
          </div>
        )}
      </div>

      <div>
        <FieldLabel htmlFor={`${ids}-place`}>Place of birth</FieldLabel>

        {place ? (
          <div className="flex items-center gap-2 rounded-2xl border border-[var(--sage)] bg-[var(--sage-soft)] px-4 py-3">
            <CheckIcon
              aria-hidden="true"
              className="shrink-0 text-[0.9rem] text-[var(--sage)]"
            />
            <span className="min-w-0 grow">
              <span className="block truncate text-[0.98rem] text-ink">
                {place.name}, {place.country}
              </span>
              <span className="block truncate text-[0.78rem] text-ink-faint">
                {place.timeZone.replace(/_/g, ' ')}
              </span>
            </span>
            <button
              type="button"
              onClick={() => {
                cue('tap')
                setPlace(null)
                setQuery('')
              }}
              aria-label="Choose a different place"
              className="interactive flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-muted hover:text-ink"
            >
              <CloseIcon />
            </button>
          </div>
        ) : (
          <>
            <TextField
              id={`${ids}-place`}
              value={query}
              autoComplete="off"
              placeholder="The nearest city — Lisbon, Osaka, Detroit…"
              onChange={(event) => setQuery(event.target.value)}
            />
            {matches.length > 0 && (
              <ul className="mt-1.5 space-y-1">
                {matches.map((match) => (
                  <li key={`${match.name}-${match.country}`}>
                    <button
                      type="button"
                      onClick={() => {
                        cue('select')
                        setPlace(match)
                        setQuery(match.name)
                      }}
                      className={cx(
                        'interactive w-full rounded-[1rem] border border-[var(--border)] bg-[var(--surface-sunken)] px-3.5 py-2.5 text-left',
                        'hover:border-[var(--border-strong)]',
                      )}
                    >
                      <span className="block text-[0.94rem] text-ink">
                        {match.name}
                      </span>
                      <span className="block text-[0.78rem] text-ink-faint">
                        {match.country}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {query.length >= 2 && matches.length === 0 && (
              <p className="type-meta mt-1.5">
                Not on the list. The nearest large city in the same time zone is
                close enough — the chart moves by a fraction of a degree over
                that distance.
              </p>
            )}
          </>
        )}
      </div>

      <p className="type-meta">
        This stays on this device. It is never uploaded, and the positions are
        worked out here rather than asked for from anywhere.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="primary"
          size="md"
          disabled={!ready}
          onClick={() => {
            if (!birth) return
            cue('save')
            onSave(birth)
          }}
        >
          {saveLabel}
        </Button>
        {secondary}
      </div>
    </div>
  )
}
