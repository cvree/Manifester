import { useId, useState } from 'react'
import type { BirthDetails } from '../../lib/astrology/profile'
import { isBirthUsable } from '../../lib/astrology/profile'
import type { Place } from '../../lib/astrology/places'
import { cue } from '../../lib/feedback'
import { Button } from '../Button'
import { FieldLabel } from '../Card'
import { TextField } from '../TextArea'
import { PlaceField } from './PlaceField'

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
        <PlaceField id={`${ids}-place`} place={place} onChange={setPlace} />
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
