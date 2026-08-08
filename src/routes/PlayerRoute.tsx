import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { BreathingVisualizer } from '../components/BreathingVisualizer'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { SettingsSheets, type PanelKey } from '../components/CustomizePanel'
import { EmptyState } from '../components/EmptyState'
import {
  BreathIcon,
  CloseIcon,
  CollapseIcon,
  ExpandIcon,
  PauseIcon,
  PlayIcon,
  PulseIcon,
  SeedIcon,
  SparkIcon,
  StopIcon,
  TuneIcon,
} from '../components/Icons'
import { SettingRow } from '../components/SettingRow'
import { Slider } from '../components/Slider'
import { MAX_MUSIC_VOLUME } from '../lib/audioBus'
import { cx } from '../lib/cx'
import { primeBreathAudio } from '../lib/breathAudio'
import { cue, primeFeedback } from '../lib/feedback'
import { countWords, formatClock } from '../lib/format'
import { MAX_VOICE_VOLUME } from '../lib/speech'
import {
  affirmationLines,
  brainwaveSummary,
  breathingSummary,
  feelSummary,
} from '../lib/summaries'
import { useBreathing } from '../lib/useBreathing'
import { useStageExpansion } from '../lib/useStageExpansion'
import { usePreferences } from '../state/PreferencesProvider'
import { useSession } from '../state/SessionProvider'
import { useStage } from '../state/StageProvider'

/**
 * The player.
 *
 * A calm ritual space rather than a media dashboard: one large breathing
 * guide, the line you are hearing, and the two controls that matter. Levels
 * and settings are present but quiet, below the fold of the stage.
 *
 * The stage can also grow to fill the screen. That is one class and one tween
 * on this same markup — see `useStageExpansion` — rather than a second player:
 * the words, the pass, the clock, the breath and the audio are the same ones,
 * still running, and the only thing that changes is how much room they have.
 */
export function PlayerRoute() {
  const navigate = useNavigate()
  const {
    draft,
    session,
    start,
    pause,
    resume,
    stop,
    prime,
    dismissNotice,
    setLiveVoiceVolume,
    setLiveMusicVolume,
  } = useSession()
  const { preferences } = usePreferences()
  const { expanded, setExpanded } = useStage()
  const [sheet, setSheet] = useState<PanelKey | null>(null)

  const hasText = countWords(draft.text) > 0
  const idle = session.status === 'idle'
  const playing = session.status === 'playing'
  const paused = session.status === 'paused'
  const complete = session.status === 'complete'

  // Expanded mode. The completion card replaces the stage, so it takes the
  // expansion with it rather than leaving a full-screen box with no orb in it.
  const { stageRef, slotRef, toggle, instant } = useStageExpansion({
    expanded,
    onChange: setExpanded,
    available: !complete,
  })

  // The guide follows the session: it breathes while you listen and holds
  // still the moment you pause.
  const breathing = useBreathing({
    pattern: preferences.breathPattern,
    active: preferences.breathingEnabled && playing,
    sound: preferences.breathSound,
    soundVolume: preferences.breathSoundVolume,
    hapticCues: preferences.breathHapticCues,
  })

  // Bloom the orb once, as the session comes to life.
  const [awaken, setAwaken] = useState(false)
  useEffect(() => {
    if (!playing) return
    setAwaken(true)
    const timeout = window.setTimeout(() => setAwaken(false), 1600)
    return () => window.clearTimeout(timeout)
  }, [playing])

  const lines = useMemo(() => affirmationLines(draft.text), [draft.text])

  /*
   * The words on screen are the words the voice engine says it is speaking,
   * reported as each line starts — not a line looked up by a chunk number.
   *
   * That lookup was the bug. Speech was chunked to a character budget while
   * the display was indexed by line, so the two only agreed by coincidence:
   * a handful of short affirmations went out as one utterance and the screen
   * showed line one throughout, and a longer loop drifted a line further out
   * with every pass. Now one line is one utterance and the engine names it,
   * so there is nothing left to get wrong.
   *
   * Before anything has been spoken — idle, or the breath before the first
   * line — the whole draft is shown, which is the honest answer to "what is
   * this loop?" when the answer to "what am I hearing?" is "nothing yet".
   */
  const currentLine = session.chunkText || draft.text.trim() || lines[0]

  if (idle && !hasText) {
    return (
      <Card data-rise level="stage" className="mx-auto mt-6 max-w-xl">
        <EmptyState
          icon={<SeedIcon />}
          title="Nothing to play yet"
          description="Write or paste the words you would like to hear, then come back here and press play."
          action={
            <Button variant="primary" size="lg" onClick={() => navigate('/create')}>
              Write your words
            </Button>
          }
        />
      </Card>
    )
  }

  const timeLabel = complete
    ? formatClock(session.elapsedSeconds)
    : session.remainingSeconds != null
      ? formatClock(session.remainingSeconds)
      : formatClock(session.elapsedSeconds)

  const timeCaption = complete
    ? 'listened'
    : session.remainingSeconds != null
      ? 'remaining'
      : 'elapsed'

  const stateLabel = complete
    ? 'Complete'
    : paused
      ? 'Paused'
      : playing
        ? session.delayRemaining != null
          ? `Resting · ${session.delayRemaining}s`
          : 'Now looping'
        : 'Ready when you are'

  const passProgress =
    session.chunkTotal > 0
      ? ((session.chunkIndex + 1) / session.chunkTotal) * 100
      : 0

  const primaryAction = () => {
    if (playing) {
      cue('stop')
      pause()
    } else if (paused) {
      cue('start')
      resume()
    } else {
      prime()
      primeFeedback()
      primeBreathAudio()
      cue('start')
      start()
    }
  }

  return (
    <>
      <div className="mx-auto grid max-w-xl grid-cols-[minmax(0,1fr)] gap-6 lg:max-w-none lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-8 xl:grid-cols-[minmax(0,1fr)_26rem]">
        {session.notice && (
          <div
            role="alert"
            data-rise
            inert={expanded}
            className={cx(
              'flex items-start gap-3 rounded-[1.25rem] border border-[var(--gold)] bg-[var(--gold-soft)] px-4 py-3.5 lg:col-span-2',
              'transition-opacity duration-[620ms] ease-[var(--ease-breath)]',
              expanded && 'pointer-events-none opacity-0',
            )}
          >
            <p className="grow text-[0.92rem] leading-relaxed text-ink">
              {session.notice}
            </p>
            <button
              type="button"
              onClick={dismissNotice}
              aria-label="Dismiss this message"
              className="interactive -mt-1 -mr-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-muted hover:text-ink"
            >
              <CloseIcon />
            </button>
          </div>
        )}

        {/* ── The stage ── */}
        {/*
          The slot holds the stage's place in the page. While the stage is
          expanded it is lifted out of the flow, and without this the column
          beside it would collapse upward and the page would scroll under it.
        */}
        <div ref={slotRef} className="lg:col-start-1">
          {complete ? (
            <Card data-rise level="stage">
              <div className="flex flex-col items-center px-2 py-8 text-center">
                <span
                  aria-hidden="true"
                  className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--gold-soft)] text-[1.7rem] text-[var(--gold)]"
                >
                  <SparkIcon />
                </span>
                <h1 className="type-title">Your loop is complete.</h1>
                <p className="type-body mt-3 max-w-[34ch] text-center">
                  You listened for {formatClock(session.elapsedSeconds)} across{' '}
                  {session.cycles} {session.cycles === 1 ? 'pass' : 'passes'}. Take a
                  breath before you move on.
                </p>
                <div className="mt-7 flex flex-wrap justify-center gap-3">
                  <Button variant="primary" size="lg" onClick={() => start()}>
                    Listen again
                  </Button>
                  <Button variant="secondary" size="lg" onClick={() => stop()}>
                    Done for now
                  </Button>
                </div>
              </div>
            </Card>
          ) : (
            <section
              ref={stageRef}
              data-rise
              className={cx(
                'surface-stage stage relative flex flex-col items-center px-5 py-8 sm:px-8 lg:py-10',
                expanded && 'stage--immersive',
                instant && 'stage--instant',
              )}
            >
              {/* A pool of light under the orb, lit only while expanded. */}
              <span aria-hidden="true" className="stage__aura" />

              {/*
                One button for both directions, in one place. Keeping it the
                same element means the focus ring never moves, so expanding and
                collapsing from the keyboard leaves you exactly where you were.
              */}
              <button
                type="button"
                onClick={() => {
                  cue('tap')
                  toggle()
                }}
                aria-label={
                  expanded
                    ? 'Collapse the visualiser back into the page'
                    : 'Expand the visualiser to fill the screen'
                }
                aria-expanded={expanded}
                title={expanded ? 'Collapse' : 'Expand'}
                className="stage__toggle interactive flex h-11 w-11 items-center justify-center rounded-full border border-[var(--panel-border)] bg-[var(--panel)] text-[1.05rem] text-ink-faint hover:text-ink"
              >
                {expanded ? <CollapseIcon /> : <ExpandIcon />}
              </button>

              <div className="stage__top flex w-full flex-col items-center">
                <p className="type-label">{stateLabel}</p>
                <h1 className="stage__title mt-2 max-w-full truncate text-center font-display text-[1.75rem] leading-tight text-ink sm:text-[2rem]">
                  {session.title || draft.title.trim() || 'Untitled loop'}
                </h1>
              </div>

              {/*
                The orb and the words it is saying, as one block: expanded, this
                is what takes all the room that is going, and it stays centred
                in it.
              */}
              <div className="stage__focus flex w-full flex-col items-center">
                <div className="stage__orb relative my-8 flex items-center justify-center">
                  <BreathingVisualizer
                    runtime={breathing}
                    style={preferences.breathStyle}
                    size={expanded ? 'stage' : 'lg'}
                    showPhase={preferences.breathingEnabled && playing}
                    awaken={awaken}
                  />
                </div>

                {/* The line you are hearing. */}
                <p className="stage__line line-clamp-5 min-h-[4rem] max-w-[32ch] text-center font-display text-[1.25rem] leading-snug whitespace-pre-line text-ink sm:text-[1.4rem]">
                  {currentLine ?? 'Ready when you are.'}
                </p>
              </div>

              {/* Transport: one large control, one small one. */}
              <div className="stage__transport mt-8 flex flex-col items-center gap-5">
                <button
                  type="button"
                  onClick={primaryAction}
                  disabled={!hasText}
                  aria-label={
                    playing
                      ? 'Pause the loop'
                      : paused
                        ? 'Resume the loop'
                        : 'Start the loop'
                  }
                  className={cx(
                    'stage__play interactive relative flex h-[5.5rem] w-[5.5rem] items-center justify-center rounded-full',
                    'text-[2rem] text-[var(--bg-0)]',
                    'bg-[linear-gradient(175deg,color-mix(in_oklab,var(--rose-deep)_88%,white)_0%,var(--rose-deep)_64%)]',
                    'shadow-[inset_0_1px_0_rgb(255_255_255/0.32),0_18px_44px_-16px_var(--glow)]',
                    'disabled:cursor-not-allowed disabled:opacity-40',
                  )}
                >
                  {playing ? <PauseIcon /> : <PlayIcon className="translate-x-[3px]" />}
                </button>

                <div className="flex items-center gap-3">
                  <span
                    className="type-numeral text-[1.05rem] text-ink"
                    aria-live="polite"
                  >
                    {timeLabel}
                  </span>
                  <span className="type-meta">{timeCaption}</span>
                  {!idle && (
                    <>
                      <span aria-hidden="true" className="text-ink-faint">
                        ·
                      </span>
                      <span className="type-meta">
                        Pass {session.cycles + 1}
                      </span>
                    </>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    cue('stop')
                    stop()
                  }}
                  disabled={idle}
                  className="interactive inline-flex min-h-11 items-center gap-2 rounded-pill border border-[var(--control-border)] px-5 text-[0.92rem] font-medium text-ink-muted hover:bg-[var(--quiet)] hover:text-ink disabled:opacity-35"
                >
                  <StopIcon className="text-[0.85rem]" />
                  End session
                </button>
              </div>

              {/* Progress through this pass. */}
              {!idle && (
                <div className="stage__meter mt-8 w-full max-w-sm">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="type-meta">
                      {session.delayRemaining != null
                        ? `Next pass in ${session.delayRemaining}s`
                        : session.chunkTotal > 0
                          ? // "Line" only when a chunk really is a line. A line
                            // too long to speak in one breath is split, and then
                            // this is counting parts of it.
                            `${session.chunkTotal === lines.length ? 'Line' : 'Part'} ${
                              session.chunkIndex + 1
                            } of ${session.chunkTotal}`
                          : 'Speaking'}
                    </span>
                    {session.trackName && (
                      <span className="type-meta truncate">{session.trackName}</span>
                    )}
                  </div>
                  <div
                    className="h-1.5 w-full overflow-hidden rounded-pill bg-[var(--control-sunken)]"
                    role="progressbar"
                    aria-label="Progress through this pass"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(passProgress)}
                  >
                    <div
                      className="h-full rounded-pill bg-[var(--rose)] transition-[width] duration-500 ease-[var(--ease-calm)]"
                      style={{ width: `${passProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </section>
          )}
        </div>

        {/* ── The quiet column ── */}
        {/*
          It slides quietly out of the way while the stage has the screen, and
          goes inert with it: nothing behind an expanded stage should be
          reachable by tab, or announced to a screen reader, while it is there.
        */}
        <div
          data-rise
          inert={expanded}
          aria-hidden={expanded || undefined}
          className={cx(
            'space-y-4 lg:col-start-2 lg:sticky lg:top-6 lg:self-start',
            'transition-[opacity,transform] duration-[620ms] ease-[var(--ease-breath)]',
            expanded && 'pointer-events-none translate-y-4 opacity-0',
          )}
        >
          <Card level="panel" title="Levels">
            <div className="space-y-5">
              <Slider
                label="Voice"
                min={0}
                max={MAX_VOICE_VOLUME}
                step={0.05}
                value={draft.settings.voiceVolume}
                display={`${Math.round(draft.settings.voiceVolume * 100)}%`}
                hint={
                  draft.settings.voiceVolume > 1
                    ? 'The spoken voice itself is capped at 100% by your device.'
                    : undefined
                }
                onChange={setLiveVoiceVolume}
              />
              <Slider
                label="Sound"
                min={0}
                max={MAX_MUSIC_VOLUME}
                step={0.05}
                value={draft.settings.musicVolume}
                display={`${Math.round(draft.settings.musicVolume * 100)}%`}
                onChange={setLiveMusicVolume}
              />
            </div>
            {!idle && (
              <p className="type-meta mt-4">
                Voice level takes effect on the next line.
              </p>
            )}
          </Card>

          <div className="surface-panel overflow-hidden">
            <SettingRow
              icon={<PulseIcon />}
              title="Brainwave rhythm"
              summary={brainwaveSummary(draft.settings.brainwave)}
              onClick={() => {
                cue('tap')
                setSheet('brainwave')
              }}
              accent={draft.settings.brainwave.enabled}
            />
            <SettingRow
              icon={<BreathIcon />}
              title="Breathing"
              summary={breathingSummary(
                preferences.breathingEnabled,
                preferences.breathPattern,
                preferences.breathStyle,
                preferences.breathSound,
              )}
              onClick={() => {
                cue('tap')
                setSheet('breathing')
              }}
              accent={preferences.breathingEnabled}
            />
            <SettingRow
              icon={<TuneIcon />}
              title="Haptics and sounds"
              summary={feelSummary(preferences.uiSounds, preferences.uiHaptics)}
              onClick={() => {
                cue('tap')
                setSheet('feel')
              }}
            />
          </div>

          <div className="flex justify-center lg:justify-start">
            <Button variant="ghost" onClick={() => navigate('/create')}>
              Edit these words
            </Button>
          </div>
        </div>
      </div>

      <SettingsSheets open={sheet} onOpenChange={setSheet} />
    </>
  )
}
