import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from 'react'
import { useNavigate } from 'react-router'
import { BreathingVisualizer } from '../components/BreathingVisualizer'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { SettingsSheets, type PanelKey } from '../components/CustomizePanel'
import { DesktopPlayerPanel } from '../components/DesktopPlayerPanel'
import { EmptyState } from '../components/EmptyState'
import { PlayerAdjust } from '../components/PlayerAdjust'
import { PlayerAtmosphere } from '../components/PlayerAtmosphere'
import {
  CloseIcon,
  CollapseIcon,
  ExpandIcon,
  MuteIcon,
  PauseIcon,
  PlayIcon,
  SeedIcon,
  SparkIcon,
  StopIcon,
  TuneIcon,
  WaveIcon,
} from '../components/Icons'
import { cx } from '../lib/cx'
import { primeBreathAudio } from '../lib/breathAudio'
import { cue, primeFeedback } from '../lib/feedback'
import { countWords, formatClock } from '../lib/format'
import { useReducedMotion } from '../lib/motion'
import { affirmationLines, soundName } from '../lib/summaries'
import { useBackgroundMix } from '../lib/useBackgroundMix'
import { useSessionBreathing } from '../lib/useBreathing'
import { useFittedLine } from '../lib/useFittedLine'
import { useHeartAnchor } from '../lib/useHeartAnchor'
import { useStageExpansion } from '../lib/useStageExpansion'
import { useLibrary } from '../state/LibraryProvider'
import { usePreferences } from '../state/PreferencesProvider'
import { useSession } from '../state/SessionProvider'
import { useStage } from '../state/StageProvider'

/**
 * Player layout:
 * - phone/tablet: one focused player column, Adjust opens a sheet;
 * - wide desktop: player on the left, persistent live controls on the right;
 * - expanded mode: the player still takes the whole screen.
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
  } = useSession()
  const { preferences } = usePreferences()
  const { allTracks } = useLibrary()
  const { expanded, setExpanded } = useStage()
  const [sheet, setSheet] = useState<PanelKey | 'adjust' | null>(null)
  const reducedMotion = useReducedMotion()

  const hasText = countWords(draft.text) > 0
  const soundOn = draft.settings.sound.mode !== 'off'
  const idle = session.status === 'idle'
  const playing = session.status === 'playing'
  const paused = session.status === 'paused'
  const complete = session.status === 'complete'

  const { stageRef, slotRef, toggle, instant } = useStageExpansion({
    expanded,
    onChange: setExpanded,
    available: !complete,
  })

  const fieldRef = useRef<HTMLDivElement>(null)
  const lineRef = useRef<HTMLParagraphElement>(null)
  const orbRef = useRef<HTMLDivElement>(null)

  const breathing = useSessionBreathing({
    pattern: preferences.breathPattern,
    active: preferences.breathingEnabled && playing,
    mirrors: [stageRef, fieldRef],
  })

  const backgroundOn = preferences.backgroundVisualizer
  const fieldAmplitude =
    preferences.breathingEnabled && playing && !reducedMotion ? 1 : 0

  const mixTargets = useMemo<Array<RefObject<HTMLElement | null>>>(
    () => [fieldRef, stageRef],
    [fieldRef, stageRef],
  )
  useBackgroundMix({
    enabled: backgroundOn,
    targets: mixTargets,
    reducedMotion,
  })

  const anchorTargets = useMemo<Array<RefObject<HTMLElement | null>>>(
    () => [fieldRef],
    [fieldRef],
  )
  useHeartAnchor(orbRef, anchorTargets, `${expanded}:${backgroundOn}:${complete}`)

  const [awaken, setAwaken] = useState(false)
  useEffect(() => {
    if (!playing) return
    setAwaken(true)
    const timeout = window.setTimeout(() => setAwaken(false), 1600)
    return () => window.clearTimeout(timeout)
  }, [playing])

  const lines = useMemo(() => affirmationLines(draft.text), [draft.text])
  const currentLine = session.chunkText || draft.text.trim() || lines[0]
  useFittedLine(lineRef, currentLine, expanded)

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

  const editWords = () => {
    cue('tap')
    setSheet(null)
    navigate('/create')
  }

  return (
    <>
      <PlayerAtmosphere
        fieldRef={fieldRef}
        amplitude={fieldAmplitude}
        immersive={expanded}
        settled={complete}
        utterance={playing ? (currentLine ?? undefined) : undefined}
        mode={preferences.backgroundMode}
        breathStyle={preferences.breathStyle}
        live={breathing.live}
      />

      <div
        className={cx(
          'mx-auto grid w-full max-w-6xl gap-6',
          !expanded && 'xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start',
        )}
      >
        <div className="min-w-0">
          {session.notice && (
            <div
              role="alert"
              data-rise
              inert={expanded}
              className={cx(
                'mb-6 flex items-start gap-3 rounded-[1.25rem] border border-[var(--gold)] bg-[var(--gold-soft)] px-4 py-3.5',
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

          <div ref={slotRef}>
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
                    {session.cycles} {session.cycles === 1 ? 'pass' : 'passes'}.
                    Take a breath before you move on.
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
                style={{ '--field': fieldAmplitude } as CSSProperties}
                className={cx(
                  'surface-stage stage relative flex flex-col items-center px-5 py-8 sm:px-8 lg:py-10',
                  expanded && 'stage--immersive',
                  backgroundOn && 'stage--roomy',
                  instant && 'stage--instant',
                )}
              >
                <span aria-hidden="true" className="stage__aura" />

                <button
                  type="button"
                  onClick={() => {
                    cue('tap')
                    setSheet('sound')
                  }}
                  aria-label={`Background sound: ${soundName(draft.settings, allTracks)}. Change it.`}
                  title="Background sound"
                  className="stage__sound interactive flex h-11 w-11 items-center justify-center rounded-full border border-[var(--panel-border)] bg-[var(--panel)] text-[1.05rem] text-ink-faint hover:text-ink"
                >
                  {soundOn ? <WaveIcon /> : <MuteIcon />}
                </button>

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
                  <p className="type-label" role="status" aria-live="polite">
                    {stateLabel}
                  </p>
                  <h1 className="stage__title mt-2 max-w-full truncate text-center font-display text-[1.75rem] leading-tight text-ink sm:text-[2rem]">
                    {session.title || draft.title.trim() || 'Untitled loop'}
                  </h1>
                </div>

                <div className="stage__focus flex w-full flex-col items-center">
                  <div
                    ref={orbRef}
                    className="stage__orb relative my-6 flex items-center justify-center"
                  >
                    <BreathingVisualizer
                      runtime={breathing}
                      style={preferences.breathStyle}
                      size="stage"
                      showPhase={preferences.breathingEnabled && playing}
                      awaken={awaken}
                    />
                  </div>

                  <p
                    ref={lineRef}
                    className="stage__line text-center font-display whitespace-pre-line text-ink"
                  >
                    <span
                      key={currentLine ?? ''}
                      className="stage__line-text animate-line-in"
                    >
                      {currentLine ?? 'Ready when you are.'}
                    </span>
                  </p>
                </div>

                <div className="stage__transport mt-6 flex flex-col items-center gap-5">
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
                    {playing ? (
                      <PauseIcon />
                    ) : (
                      <PlayIcon className="translate-x-[3px]" />
                    )}
                  </button>

                  <div className="flex items-center gap-3">
                    <span
                      className="type-numeral text-[1.05rem] text-ink"
                      aria-live="polite"
                    >
                      {timeLabel}
                    </span>
                    <span className="type-meta">{timeCaption}</span>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        cue('tap')
                        setSheet('adjust')
                      }}
                      className="stage__leave interactive inline-flex min-h-11 items-center gap-2 rounded-pill border border-[var(--control-border)] px-5 text-[0.92rem] font-medium text-ink-muted hover:bg-[var(--quiet)] hover:text-ink xl:hidden"
                    >
                      <TuneIcon className="text-[0.9rem]" />
                      Adjust
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        cue('stop')
                        stop()
                      }}
                      disabled={idle}
                      className="stage__leave interactive inline-flex min-h-11 items-center gap-2 rounded-pill border border-[var(--control-border)] px-5 text-[0.92rem] font-medium text-ink-muted hover:bg-[var(--quiet)] hover:text-ink disabled:opacity-35"
                    >
                      <StopIcon className="text-[0.85rem]" />
                      End session
                    </button>
                  </div>
                </div>

                {!idle && !expanded && (
                  <div className="stage__meter mt-8 w-full max-w-sm">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="type-meta">
                        {session.delayRemaining != null
                          ? `Next pass in ${session.delayRemaining}s`
                          : session.chunkTotal > 0
                            ? `${session.chunkTotal === lines.length ? 'Line' : 'Part'} ${
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
        </div>

        {!expanded && !complete && (
          <DesktopPlayerPanel onOpenPanel={setSheet} onEditWords={editWords} />
        )}
      </div>

      <PlayerAdjust
        open={sheet === 'adjust'}
        onClose={() => setSheet(null)}
        onOpenPanel={setSheet}
        onEditWords={editWords}
      />
      <SettingsSheets
        open={sheet === 'adjust' ? null : sheet}
        onOpenChange={setSheet}
      />
    </>
  )
}
