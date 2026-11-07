import { useMemo, useState } from 'react'
import { downloadDailyReminder } from '../lib/calendar'
import { cx } from '../lib/cx'
import { cue } from '../lib/feedback'
import { dayKey, formatListeningDuration } from '../lib/listening'
import {
  formatReminderTime,
  readRhythm,
  rhythmSentence,
  shouldNudge,
  type Rhythm,
} from '../lib/rhythm'
import { useLibrary } from '../state/LibraryProvider'
import { usePreferences } from '../state/PreferencesProvider'
import { Button } from './Button'
import { ClockIcon, CloseIcon, PlayIcon } from './Icons'

/**
 * Your rhythm, on screen: the last seven days, the run you are on, and the
 * reminder that keeps it going. See `lib/rhythm` for the rules it keeps —
 * chiefly that it never tells anybody they broke something.
 */

/** Today's rhythm, recomputed when the listening record or the day changes. */
export function useRhythm(): Rhythm {
  const { listeningStats } = useLibrary()
  const today = dayKey(Date.now())
  // `today` is a dependency so the week rolls over at midnight on its own.
  return useMemo(() => readRhythm(listeningStats), [listeningStats, today])
}

/** Seven dots, oldest first, today ringed. */
export function RhythmWeek({
  rhythm,
  size = 'md',
  tone = 'page',
}: {
  rhythm: Rhythm
  size?: 'sm' | 'md'
  tone?: 'page' | 'card'
}) {
  const dot = size === 'sm' ? 'h-6 w-6' : 'h-8 w-8'
  return (
    <ol
      className="flex items-end justify-between gap-1.5"
      aria-label={`Last seven days: ${rhythm.weekCount} of 7 with listening`}
    >
      {rhythm.week.map((day) => (
        <li key={day.key} className="flex flex-col items-center gap-1.5">
          <span
            className={cx(
              'relative flex items-center justify-center rounded-full border transition-colors duration-300',
              dot,
              day.done
                ? 'border-[var(--rose-deep)] bg-[var(--rose-deep)]'
                : day.seconds > 0
                  ? 'border-[var(--rose)] bg-[var(--rose-soft)]'
                  : tone === 'card'
                    ? 'border-[var(--border-strong)] bg-transparent'
                    : 'border-[var(--border)] bg-[var(--surface-sunken)]',
              day.today &&
                'ring-2 ring-[var(--rose)] ring-offset-2 ring-offset-[var(--bg-0)]',
            )}
          >
            <span className="sr-only">
              {day.name}
              {day.today ? ' (today)' : ''}:{' '}
              {day.done
                ? `listened ${formatListeningDuration(day.seconds)}`
                : day.seconds > 0
                  ? 'under a minute'
                  : 'no listening'}
            </span>
          </span>
          <span
            aria-hidden="true"
            className={cx(
              'text-[0.72rem] font-medium uppercase',
              day.today ? 'text-ink' : 'text-ink-faint',
            )}
          >
            {day.initial}
          </span>
        </li>
      ))}
    </ol>
  )
}

/**
 * The rhythm as a card, for the library: the week, the run, the totals, and
 * the daily reminder.
 */
export function RhythmCard() {
  const rhythm = useRhythm()
  const { listeningStats } = useLibrary()
  const sentence = rhythmSentence(rhythm)

  return (
    <section
      data-rise
      aria-labelledby="rhythm-heading"
      className="surface-panel space-y-5 p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="rhythm-heading" className="type-subheading">
          Your rhythm
        </h2>
        {rhythm.totalDays > 0 && (
          <p className="type-meta">
            {rhythm.best > 1 ? `Best run · ${rhythm.best} days · ` : ''}
            {formatListeningDuration(listeningStats.totalSeconds)} in all
          </p>
        )}
      </div>

      <RhythmWeek rhythm={rhythm} />

      <p className="type-body">
        {sentence ??
          'Listen for a minute on any day and it lights up here. Nothing is ever taken away.'}
      </p>

      <ReminderControl />
    </section>
  )
}

/** Set, change or clear the daily reminder. */
function ReminderControl() {
  const { preferences, update } = usePreferences()
  const [editing, setEditing] = useState(false)
  const [time, setTime] = useState(preferences.dailyReminder ?? '21:00')
  const [note, setNote] = useState<string | null>(null)
  const current = preferences.dailyReminder

  const save = () => {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
      setNote('Choose a time first.')
      return
    }
    downloadDailyReminder(time)
    update({ dailyReminder: time })
    cue('select')
    setEditing(false)
    setNote(
      'Your calendar will ask to add it. It repeats every day, with an alert, even when this app is closed.',
    )
  }

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center gap-3 border-t border-[var(--quiet-border)] pt-4">
        <span
          aria-hidden="true"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--quiet)] text-ink-muted"
        >
          <ClockIcon />
        </span>
        <span className="min-w-0 grow text-[0.95rem] text-ink">
          {current ? `Daily reminder · ${formatReminderTime(current)}` : 'A daily reminder'}
          <span className="block text-[0.82rem] text-ink-muted">
            {current
              ? 'In your calendar, and a quiet nudge here if the day gets away.'
              : 'One repeating event in your own calendar. No account, no notifications from us.'}
          </span>
        </span>
        <Button
          variant={current ? 'ghost' : 'secondary'}
          onClick={() => {
            cue('tap')
            setNote(null)
            setEditing(true)
          }}
        >
          {current ? 'Change' : 'Set one'}
        </Button>
        {note && (
          <p className="type-meta w-full" role="status">
            {note}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4 border-t border-[var(--quiet-border)] pt-4">
      <label className="block">
        <span className="type-label mb-2 block">Remind me every day at</span>
        <input
          type="time"
          value={time}
          onChange={(event) => setTime(event.target.value)}
          className="surface-control min-h-12 w-full max-w-[12rem] px-4 text-ink"
        />
      </label>
      <div className="flex flex-wrap gap-3">
        <Button variant="primary" onClick={save} leading={<ClockIcon />}>
          Add to my calendar
        </Button>
        {current && (
          <Button
            variant="ghost"
            onClick={() => {
              cue('tap')
              update({ dailyReminder: null })
              setEditing(false)
              setNote(
                'The nudge here is off. To stop the calendar alert, delete the event in your calendar.',
              )
            }}
          >
            Turn off
          </Button>
        )}
        <Button variant="ghost" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </div>
      {note && (
        <p className="type-meta" role="status">
          {note}
        </p>
      )}
    </div>
  )
}

/**
 * The nudge: one line, once a day at most, only when there is something to
 * keep and the day is getting on. See `shouldNudge`.
 */
export function DailyNudge({
  onPlay,
  className,
}: {
  onPlay: () => void
  className?: string
}) {
  const rhythm = useRhythm()
  const { preferences, update } = usePreferences()
  const visible = shouldNudge({
    rhythm,
    reminder: preferences.dailyReminder,
    dismissedOn: preferences.nudgeDismissedOn,
  })
  if (!visible) return null

  const line =
    rhythm.current >= 2
      ? `${rhythm.current} days in a row. A few minutes now keeps it going.`
      : rhythm.current === 1
        ? 'You listened yesterday. A few minutes now makes two.'
        : 'Your few minutes for today. Even five counts.'

  return (
    <div
      role="status"
      className={cx(
        'surface-panel flex items-center gap-3 px-4 py-3 shadow-none',
        className,
      )}
    >
      <div className="hidden shrink-0 sm:block">
        <RhythmWeek rhythm={rhythm} size="sm" tone="card" />
      </div>
      <p className="min-w-0 grow text-[0.9rem] leading-snug text-ink">{line}</p>
      <button
        type="button"
        onClick={() => {
          cue('start')
          onPlay()
        }}
        aria-label="Play now"
        className="interactive flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--rose-deep)] text-[0.95rem] text-[var(--bg-0)]"
      >
        <PlayIcon className="translate-x-[1px]" />
      </button>
      <button
        type="button"
        onClick={() => {
          cue('tap')
          update({ nudgeDismissedOn: dayKey(Date.now()) })
        }}
        aria-label="Not today"
        title="Not today"
        className="interactive flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-faint hover:text-ink"
      >
        <CloseIcon />
      </button>
    </div>
  )
}
