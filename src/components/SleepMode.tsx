import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cue } from '../lib/feedback'
import { formatClock } from '../lib/format'
import { setAppMotion } from '../lib/motion'
import {
  SLEEP_EXTEND_MINUTES,
  SLEEP_PRESETS,
  fadeWindowMs,
  formatClockTime,
} from '../lib/sleep'
import { usePreferences } from '../state/PreferencesProvider'
import { useSession, useSessionClock } from '../state/SessionProvider'
import { Button } from './Button'
import { MoonIcon } from './Icons'
import { Chip } from './SegmentedControl'
import { Sheet } from './Sheet'

/**
 * Sleep mode's two surfaces: the sheet that sets it, and the veil that dims
 * the screen while it runs.
 *
 * ── What sleep mode is ──
 *
 * A timer that ends the session *by fading everything to nothing* rather than
 * by stopping it. Voice, background, rhythm, breath and music all play as
 * usual, then spend the last stretch — most of a short timer, up to twenty-five
 * minutes of a long one — sinking on a curve with no corners, so there is no
 * moment anybody could hear as "it is ending". When it reaches silence the
 * session stops itself, and the music, which outlives sessions, stays silent.
 *
 * The screen is let go of — the session stops holding it awake — and dimmed
 * until it does go dark, with the animation underneath stilled so a phone face
 * down on a bedside table is not drawing an orb for nobody all night.
 */

/** The sheet: pick a length, or adjust the one that is running. */
export function SleepSheet({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const { session } = useSession()

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Sleep"
      description={
        session.sleep
          ? 'Everything is set to fade out on its own.'
          : 'Fall asleep to it. Everything fades so slowly you will not notice it end.'
      }
    >
      {session.sleep ? <SleepRunning onDone={onClose} /> : <SleepChooser onDone={onClose} />}
    </Sheet>
  )
}

function SleepChooser({ onDone }: { onDone: () => void }) {
  const { startSleep, prime, session } = useSession()
  const [minutes, setMinutes] = useState<number>(30)
  const fadeMinutes = Math.round(fadeWindowMs(minutes * 60_000) / 60_000)
  const idle = session.status === 'idle' || session.status === 'complete'

  return (
    <div className="space-y-6">
      <div>
        <p className="type-label mb-2.5">Fall asleep in</p>
        <div role="radiogroup" aria-label="Sleep timer length" className="flex flex-wrap gap-2">
          {SLEEP_PRESETS.map((value) => (
            <Chip
              key={value}
              selected={minutes === value}
              onClick={() => {
                cue('select')
                setMinutes(value)
              }}
            >
              {value < 60 ? `${value} min` : value === 60 ? '1 hour' : `${value / 60} hours`}
            </Chip>
          ))}
        </div>
      </div>

      <ol className="space-y-3 rounded-[1.15rem] border border-[var(--border)] bg-[var(--surface-sunken)] p-4">
        <SleepStep n={1}>
          Plays as normal for {minutes - fadeMinutes} min.
        </SleepStep>
        <SleepStep n={2}>
          Then everything — voice, sound, rhythm, music — fades over the last{' '}
          {fadeMinutes} min, too slowly to notice.
        </SleepStep>
        <SleepStep n={3}>
          The session stops itself. The screen dims, and is free to turn off.
        </SleepStep>
      </ol>

      <Button
        variant="primary"
        size="lg"
        className="w-full"
        onClick={() => {
          if (idle) prime()
          cue('start')
          startSleep(minutes)
          onDone()
        }}
      >
        <MoonIcon className="text-[1rem]" />
        {idle ? `Start · sleep in ${minutes} min` : `Sleep in ${minutes} min`}
      </Button>
    </div>
  )
}

function SleepStep({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex gap-3 text-[0.92rem] leading-snug text-ink-muted">
      <span
        aria-hidden="true"
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--rose-soft)] text-[0.78rem] font-semibold text-[var(--rose-deep)]"
      >
        {n}
      </span>
      <span>{children}</span>
    </li>
  )
}

function SleepRunning({ onDone }: { onDone: () => void }) {
  const { extendSleep, cancelSleep } = useSession()
  const remaining = useSessionClock((clock) => clock.remainingSeconds) ?? 0

  return (
    <div className="space-y-6">
      <SleepReadout remaining={remaining} />
      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="secondary"
          size="lg"
          onClick={() => {
            cue('tap')
            extendSleep(SLEEP_EXTEND_MINUTES)
          }}
        >
          +{SLEEP_EXTEND_MINUTES} min
        </Button>
        <Button
          variant="ghost"
          size="lg"
          onClick={() => {
            cue('tap')
            cancelSleep()
            onDone()
          }}
        >
          Stay awake
        </Button>
      </div>
    </div>
  )
}

/** The time left, when it ends, and whether the fade has begun. */
function SleepReadout({
  remaining,
  tone = 'page',
}: {
  remaining: number
  tone?: 'page' | 'night'
}) {
  const { session } = useSession()
  const totalMs = session.sleep?.totalMs ?? 0
  const fading = remaining * 1000 <= fadeWindowMs(totalMs)
  const endsAt = Date.now() + remaining * 1000
  const night = tone === 'night'

  return (
    <div className="text-center">
      <p
        className={
          night
            ? 'font-display text-[3.2rem] leading-none tabular-nums text-white/80'
            : 'font-display text-[2.6rem] leading-none tabular-nums text-ink'
        }
        role="timer"
      >
        {formatClock(remaining)}
      </p>
      <p className={night ? 'mt-3 text-[0.95rem] text-white/50' : 'type-meta mt-2'}>
        {fading ? 'Fading out' : 'Playing'} · ends around {formatClockTime(endsAt)}
      </p>
    </div>
  )
}

/** How long the controls stay up after a tap on the dimmed screen. */
const REVEAL_MS = 8000

/**
 * The dark over everything while sleep mode runs.
 *
 * Dim by default, reaching near-black over most of a minute so that pressing
 * "sleep" is not a light going out. A tap anywhere lifts it a little and shows
 * three things — more time, stay awake, end — and it sinks back on its own.
 */
export function SleepVeil() {
  const { session, extendSleep, cancelSleep, stop } = useSession()
  const { preferences } = usePreferences()
  const [revealed, setRevealed] = useState(false)
  const hideTimer = useRef<number | null>(null)
  const active =
    session.sleep != null &&
    (session.status === 'playing' || session.status === 'paused')

  const remaining = useSessionClock((clock) => clock.remainingSeconds) ?? 0

  const reveal = () => {
    setRevealed(true)
    if (hideTimer.current != null) window.clearTimeout(hideTimer.current)
    hideTimer.current = window.setTimeout(() => setRevealed(false), REVEAL_MS)
  }

  useEffect(() => {
    if (!active) setRevealed(false)
    return () => {
      if (hideTimer.current != null) window.clearTimeout(hideTimer.current)
    }
  }, [active])

  /*
   * Under the dark, nothing needs to move. The breath, the room and the orb
   * are drawn every frame for as long as they are on screen; asleep, that is
   * battery spent on a picture nobody is looking at. Stilled while dim, and
   * given back the moment the controls come up or sleep ends.
   */
  useEffect(() => {
    if (!active) return
    setAppMotion(revealed ? preferences.motion : 'still')
    return () => setAppMotion(preferences.motion)
  }, [active, revealed, preferences.motion])

  if (!active || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="sleep-veil"
      data-revealed={revealed || undefined}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          if (revealed) setRevealed(false)
          else reveal()
        }
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') setRevealed(false)
      }}
    >
      {!revealed ? (
        <button
          type="button"
          onClick={reveal}
          className="sleep-veil__hint"
          aria-label={`Sleeping. ${formatClock(remaining)} left. Show sleep controls.`}
        >
          <MoonIcon aria-hidden="true" className="text-[1.1rem]" />
          <span className="tabular-nums">{formatClock(remaining)}</span>
        </button>
      ) : (
        <div
          role="dialog"
          aria-label="Sleep controls"
          className="sleep-veil__panel"
          onPointerDown={reveal}
        >
          <SleepReadout remaining={remaining} tone="night" />
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              className="sleep-veil__action"
              onClick={() => {
                cue('tap')
                extendSleep(SLEEP_EXTEND_MINUTES)
                reveal()
              }}
            >
              +{SLEEP_EXTEND_MINUTES} min
            </button>
            <button
              type="button"
              className="sleep-veil__action"
              onClick={() => {
                cue('tap')
                cancelSleep()
              }}
            >
              Stay awake
            </button>
            <button
              type="button"
              className="sleep-veil__action sleep-veil__action--quiet"
              onClick={() => {
                cue('stop')
                stop()
              }}
            >
              End now
            </button>
          </div>
          <p className="mt-6 text-[0.82rem] text-white/35">
            Tap anywhere to dim again.
          </p>
        </div>
      )}
    </div>,
    document.body,
  )
}
