import {
  whenPhrase,
  type HourBand,
  type PowerWindow,
} from '../../lib/astrology/horoscope'
import type { VoidMoon } from '../../lib/astrology/voidmoon'
import { downloadWindow } from '../../lib/calendar'
import { cx } from '../../lib/cx'
import { cue } from '../../lib/feedback'
import { Button } from '../Button'
import { ClockIcon } from '../Icons'

/**
 * The shape of the day, in six stretches.
 *
 * This is the part of the feature people will actually plan around, and it is
 * the part nobody else does honestly: the Moon's contacts to a birth chart are
 * computable to the minute, so "the open stretch is mid-afternoon" is a real
 * statement about real geometry rather than a mood assigned to a time of day.
 *
 * Drawn as bars because the useful comparison is between the stretches rather
 * than the absolute value of any of them — somebody wants to know which part
 * of *today* is the easy one, not how today rates against last Thursday.
 */

interface DayArcProps {
  hours: HourBand[]
  power: PowerWindow | null
  /** The stretch with nothing left in it, when today has one. */
  quiet?: VoidMoon | null
  /** Used to mark the stretch the clock is currently in. */
  now?: Date
}

const HEIGHTS = 'h-[3.25rem]'

function time(at: Date): string {
  return at.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

/**
 * A length of time, said the way somebody would say it.
 *
 * Minutes matter for a short stretch and are noise in a long one — "29 hours
 * and 4 minutes" is a spreadsheet reading a clock — so they are dropped past
 * six hours and the number becomes an "about".
 */
function span(hours: number): string {
  if (hours >= 6) return `about ${Math.round(hours)} hours`
  const whole = Math.floor(hours)
  const minutes = Math.round((hours - whole) * 60)
  if (whole === 0) return `${minutes} minutes`
  return `${whole} ${whole === 1 ? 'hour' : 'hours'}${
    minutes > 0 ? ` and ${minutes} minutes` : ''
  }`
}

export function DayArc({ hours, power, quiet, now = new Date() }: DayArcProps) {
  const current = hours.find((band) => now >= band.from && now <= band.to)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-6 gap-1.5">
        {hours.map((band) => {
          /* −1…1 mapped onto a bar that always has something to see. */
          const fill = Math.round(28 + ((band.score + 1) / 2) * 72)
          const isNow = current?.label === band.label

          return (
            <div key={band.label} className="flex flex-col items-center gap-1.5">
              <div
                className={cx(
                  'astro-band flex w-full items-end overflow-hidden',
                  `astro-band--${band.quality}`,
                  isNow && 'astro-band--now',
                  HEIGHTS,
                )}
              >
                <span
                  aria-hidden="true"
                  className="w-full rounded-b-[0.7rem] bg-[color-mix(in_oklab,var(--tint)_36%,transparent)] transition-[height] duration-700 ease-[var(--ease-calm)]"
                  style={{ height: `${fill}%` }}
                />
              </div>
              {/*
                "Afternoon" and "Evening" collide at 390px, so the narrow
                screen gets the hour the stretch starts at — which is the more
                useful label anyway once the words are gone.
              */}
              <span
                className={cx(
                  'w-full truncate text-center text-[0.72rem] leading-none',
                  isNow ? 'font-semibold text-ink' : 'text-ink-faint',
                )}
              >
                <span className="sm:hidden">{band.from.getHours()}</span>
                <span className="hidden sm:inline">{band.label}</span>
              </span>
            </div>
          )
        })}
      </div>

      <ul className="astro-rows space-y-2 text-[0.88rem] leading-relaxed">
        {hours.map((band) => {
          const isNow = current?.label === band.label
          return (
            <li key={band.label} className="flex gap-3 pt-2 first:pt-0">
              <span className="w-20 shrink-0 tabular-nums text-ink-faint">
                {band.from.getHours()}–{band.to.getHours() === 23 ? 24 : band.to.getHours()}
              </span>
              <span className={cx(isNow ? 'text-ink' : 'text-ink-muted')}>
                <span className="font-medium text-ink">{band.label}</span>
                {isNow && <span className="type-label ml-2 text-[var(--rose-deep)]">Now</span>}
                <br />
                {band.note}
              </span>
            </li>
          )
        })}
      </ul>

      {/*
        The void stretch.

        Placed under the bars rather than inside them because it cuts across
        them — it starts and ends at real minutes, not at the edges of a
        three-hour band — and because it is the one line here that is genuine
        classical astrology rather than this app's own reading of a chart. It
        says what it is, and it does not tell anybody not to do something.
      */}
      {quiet && (
        <div className="rounded-[1.15rem] border border-[var(--border-strong)] bg-[var(--surface-sunken)] px-4 py-3">
          <p className="type-label text-ink">
            Nothing left on the clock · {whenPhrase(quiet.from, now)}–
            {whenPhrase(quiet.to, now)}
          </p>
          <p className="type-meta mt-1 text-ink-muted">
            After {quiet.after}, the Moon makes no further contact with anything
            for {span(quiet.hours)}, until it moves into {quiet.into.name}. This is
            the void of course — traditionally a stretch that suits finishing,
            tidying and resting far better than launching something you want to
            travel.
          </p>
        </div>
      )}

      {power ? (
        <div className="rounded-[1.15rem] border border-[color-mix(in_oklab,var(--sage)_40%,transparent)] bg-[var(--sage-soft)] px-4 py-3">
          <p className="type-label text-ink">
            Best window · {time(power.from)}–{time(power.to)}
          </p>
          <p className="type-meta mt-1 text-ink-muted">
            {power.what}. {power.why}
          </p>
          {/*
            The one control on this screen that puts something in a person's
            actual day. A window worked out to the minute is worth nothing if
            it stays on a page somebody read at breakfast.
          */}
          <Button
            size="sm"
            className="mt-2.5"
            leading={<ClockIcon className="text-[0.85rem]" />}
            onClick={() => {
              cue('tap')
              downloadWindow({
                title: 'The open window',
                description: `${power.what}. ${power.why}`,
                from: power.from,
                to: power.to,
              })
            }}
          >
            Put it in my calendar
          </Button>
        </div>
      ) : (
        <p className="type-meta">
          No standout window today — the Moon makes nothing easy enough to pick
          an hour out of. An even day, which is its own useful thing to know.
        </p>
      )}
    </div>
  )
}
