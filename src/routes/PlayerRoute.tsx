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
import { CinematicBreathType } from '../components/CinematicBreathType'
import { FirstLoopNudge } from '../components/FirstLoopNudge'
import { Card } from '../components/Card'
import { SettingsSheets, type PanelKey } from '../components/CustomizePanel'
import { DesktopPlayerPanel } from '../components/DesktopPlayerPanel'
import { EmptyState } from '../components/EmptyState'
import { Notice } from '../components/Notice'
import { AmbienceMixer } from '../components/AmbienceMixer'
import { PlayerAdjust } from '../components/PlayerAdjust'
import { PlayerAtmosphere } from '../components/PlayerAtmosphere'
import {
  CollapseIcon,
  ExpandIcon,
  MixerIcon,
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
import { formatBreathRate, isPatternValid } from '../lib/breathing'
import { voiceForStyle } from '../lib/tts'
import { useWarmVoice } from '../lib/tts/useWarmVoice'
import { cue } from '../lib/feedback'
import { countWords, formatClock } from '../lib/format'
import { listeningSentence } from '../lib/listening'
import { autoTitle } from '../lib/loops'
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
  const { allTracks, listeningStats } = useLibrary()
  const { expanded, setExpanded } = useStage()
  const [sheet, setSheet] = useState<PanelKey | 'adjust' | 'mixer' | null>(null)
  const reducedMotion = useReducedMotion()

  const hasText = countWords(draft.text) > 0
  /*
   * Manifester with nothing written in it is a breathwork app.
   *
   * The player used to answer an empty draft with an empty state and a button
   * back to the editor, which was true of a player for *words* and false of
   * this one: the breath, the room, the ambience, the rhythm and the timer are
   * all here and all work with nothing to say. So a wordless session is a real
   * session — it simply has no voice in it — and the only thing it needs from
   * this screen is a guide worth following, which is the next line.
   */
  const breathReady =
    preferences.breathingEnabled && isPatternValid(preferences.breathPattern)
  const canPlay = hasText || breathReady
  const soundOn = draft.settings.sound.mode !== 'off'
  const idle = session.status === 'idle'
  const playing = session.status === 'playing'
  const paused = session.status === 'paused'
  const complete = session.status === 'complete'
  /*
   * Whether *this screen* is a breathwork screen.
   *
   * Read off the draft while nothing is running, because that is what the play
   * button is about to start — and off the session once something is, because
   * somebody can walk to Create mid-practice, type a line and walk back, and
   * the session they are still in has no voice in it whatever the draft now
   * says. One of the two is always the honest answer; neither is on its own.
   */
  const wordless = idle ? !hasText : session.breathOnly
  const lifetime = listeningSentence(listeningStats)

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

  /*
   * The opening lines, fetched while somebody is still deciding to press play.
   * It is the one line of a session that has nothing in front of it to hide a
   * synthesis behind — see `useWarmVoice`.
   */
  useWarmVoice({
    text: draft.text,
    voice: voiceForStyle(draft.settings.voiceStyle),
    rate: draft.settings.rate,
    pitch: draft.settings.pitch,
    preferDevice: draft.settings.voiceSource === 'device',
    enabled: idle && hasText,
  })

  /*
   * Cinematic typography: the breath said in words, at the size of the screen.
   *
   * It replaces the orb's own small caption rather than joining it — two
   * countdowns and two phase words on one screen is not twice the guidance, it
   * is a screen that cannot decide what it is. See `CinematicBreathType`.
   */
  const cinematic =
    preferences.cinematicTypography && preferences.breathingEnabled && playing

  /** How slow the breath is, said once, quietly, inside the orb. */
  const breathRate = preferences.breathingEnabled
    ? formatBreathRate(preferences.breathPattern)
    : null

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
  /*
   * `null` in a breath-only session, and the whole paragraph goes with it —
   * rather than an empty box holding open the height of three lines of type
   * that nobody wrote. What fills that room instead is the breath itself.
   */
  const currentLine = wordless
    ? null
    : session.chunkText || draft.text.trim() || lines[0]
  /*
   * A breath-only session says what it is, until it starts. Then it says
   * nothing at all and the breath has the room — but the *box* stays either
   * way, because it is what holds the orb where it is. Emptying a fixed-height
   * box is a silence; removing it is the whole composition jumping the moment
   * somebody presses play.
   */
  const invitation = !wordless
    ? null
    : playing
      ? ''
      : paused
        ? 'Held. Press play when you are ready.'
        : 'No words today — just the breath. Press play.'
  useFittedLine(lineRef, currentLine ?? invitation, expanded)

  /*
   * The one case that is still genuinely empty: no words *and* no breathing
   * guide, which leaves the play button with nothing to start.
   */
  if (idle && !canPlay) {
    return (
      <>
        <Card data-rise level="stage" className="mx-auto mt-6 max-w-xl">
          <EmptyState
            icon={<SeedIcon />}
            title="Nothing to play yet"
            description="Write the words you would like to hear — or turn the breathing guide back on, and use Manifester as a breathing practice on its own."
            action={
              <div className="flex flex-wrap justify-center gap-3">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => navigate('/create')}
                >
                  Write your words
                </Button>
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={() => {
                    cue('tap')
                    setSheet('breathing')
                  }}
                >
                  Turn on breathing
                </Button>
              </div>
            }
          />
        </Card>
        {/*
          The sheets have to come with the empty state, not only with the
          stage. The second button above is the way out of this screen for
          somebody who has no words and has turned the guide off, and without
          this it sets a piece of state that nothing is mounted to read.
        */}
        <SettingsSheets
          open={sheet === 'adjust' || sheet === 'mixer' ? null : sheet}
          onOpenChange={setSheet}
        />
      </>
    )
  }

  const timeLabel = complete
    ? formatClock(session.elapsedSeconds)
    : session.remainingSeconds != null
      ? formatClock(session.remainingSeconds)
      : formatClock(session.elapsedSeconds)

  const timeCaption = complete
    ? wordless
      ? 'breathed'
      : 'listened'
    : session.remainingSeconds != null
      ? 'remaining'
      : 'elapsed'

  const stateLabel = complete
    ? 'Complete'
    : paused
      ? 'Paused'
      : playing
        ? wordless
          ? 'Breathing'
          : session.delayRemaining != null
            ? `Resting · ${session.delayRemaining}s`
            : session.voicePreparing
              ? 'Preparing the voice…'
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
      primeBreathAudio()
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
            <div data-rise inert={expanded}>
              <Notice
                onDismiss={dismissNotice}
                className={cx(
                  'mb-6 transition-opacity duration-[620ms] ease-[var(--ease-breath)]',
                  expanded && 'pointer-events-none opacity-0',
                )}
              >
                {session.notice}
              </Notice>
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
                  <h1 className="type-title">
                    {wordless ? 'That is the practice.' : 'Your loop is complete.'}
                  </h1>
                  <p className="type-body mt-3 max-w-[34ch] text-center">
                    {wordless ? (
                      <>
                        You breathed for {formatClock(session.elapsedSeconds)}.
                        Sit with it a moment before you move on.
                      </>
                    ) : (
                      <>
                        You listened for {formatClock(session.elapsedSeconds)} across{' '}
                        {session.cycles} {session.cycles === 1 ? 'pass' : 'passes'}.
                        Take a breath before you move on.
                      </>
                    )}
                  </p>
                  {lifetime && <p className="type-meta mt-3">{lifetime}</p>}
                  <div className="mt-7 flex flex-wrap justify-center gap-3">
                    <Button variant="primary" size="lg" onClick={() => start()}>
                      {wordless ? 'Breathe again' : 'Listen again'}
                    </Button>
                    <Button variant="secondary" size="lg" onClick={() => stop()}>
                      Done for now
                    </Button>
                  </div>

                  {/*
                    One thing to learn, once, at the one moment somebody is
                    sitting still and pleased. See `FirstLoopNudge` — it shows
                    itself only if it has never been shown.
                  */}
                  {!wordless && (
                    <FirstLoopNudge
                      className="mt-8 w-full max-w-md"
                      onChangeSound={() => setSheet('sound')}
                    />
                  )}
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
                  cinematic && 'stage--cinema',
                  wordless && 'stage--wordless',
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

                {/*
                  The mixer, one tap from the stage and never more than one.
                  It sits in the stage's own corner beside the sound button
                  rather than inside Adjust, because the whole point of it is
                  that balancing what you are hearing should not mean opening a
                  settings sheet and finding a row in it.
                */}
                <button
                  type="button"
                  onClick={() => {
                    cue('tap')
                    setSheet('mixer')
                  }}
                  aria-label="Open the audio mixer: a level for every layer"
                  title="Mixer"
                  className="stage__mixer interactive flex h-11 w-11 items-center justify-center rounded-full border border-[var(--panel-border)] bg-[var(--panel)] text-[1.05rem] text-ink-faint hover:text-ink"
                >
                  <MixerIcon />
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
                    {session.title ||
                      draft.title.trim() ||
                      (wordless ? 'Breathwork' : autoTitle(draft.text))}
                  </h1>
                </div>

                <div className="stage__focus relative flex w-full flex-col items-center">
                  <div
                    ref={orbRef}
                    className="stage__orb relative my-6 flex items-center justify-center"
                  >
                    <BreathingVisualizer
                      runtime={breathing}
                      style={preferences.breathStyle}
                      size="stage"
                      showPhase={
                        preferences.breathingEnabled && playing && !cinematic
                      }
                      rateLabel={cinematic ? null : breathRate}
                      awaken={awaken}
                    />
                  </div>

                  {/*
                    The title card, over the whole focus region rather than
                    inside the orb — it is the one layer here that is language,
                    and language wants the width of the composition. It is
                    `aria-hidden` and `pointer-events: none`: the orb already
                    carries the guide's accessible name and the transport below
                    is still entirely clickable through it.
                  */}
                  {cinematic && (
                    <CinematicBreathType
                      runtime={breathing}
                      immersive={expanded}
                      wordless={wordless}
                    />
                  )}

                  <p
                    ref={lineRef}
                    className={cx(
                      'stage__line text-center font-display whitespace-pre-line',
                      wordless
                        ? 'stage__line--invitation text-ink-muted'
                        : 'text-ink',
                    )}
                  >
                    <span
                      key={currentLine ?? invitation ?? ''}
                      className="stage__line-text animate-line-in"
                    >
                      {wordless
                        ? invitation
                        : (currentLine ?? 'Ready when you are.')}
                    </span>
                  </p>
                </div>

                <div className="stage__transport mt-6 flex flex-col items-center gap-5">
                  <button
                    type="button"
                    onClick={primaryAction}
                    disabled={!canPlay}
                    aria-label={
                      wordless
                        ? playing
                          ? 'Pause the breathing session'
                          : paused
                            ? 'Resume the breathing session'
                            : 'Start a breathing session'
                        : playing
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

                {!idle && !expanded && !wordless && (
                  <div className="stage__meter mt-8 w-full max-w-sm">
                    {/*
                      Only the thing the bar underneath is measuring. Resting
                      and preparing are already said, larger and higher up, by
                      the state label at the top of the stage — printing them
                      again eighteen inches lower does not make them twice as
                      true. When there is nothing to count, the row goes with
                      it rather than holding open a line of empty type.
                    */}
                    {(session.chunkTotal > 0 || session.trackName) && (
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <span className="type-meta">
                          {session.chunkTotal > 0
                            ? `${session.chunkTotal === lines.length ? 'Line' : 'Part'} ${
                                session.chunkIndex + 1
                              } of ${session.chunkTotal}`
                            : ''}
                        </span>
                        {session.trackName && (
                          <span className="type-meta truncate">
                            {session.trackName}
                          </span>
                        )}
                      </div>
                    )}
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
          <DesktopPlayerPanel
            onOpenPanel={setSheet}
            onEditWords={editWords}
            onOpenMixer={() => setSheet('mixer')}
          />
        )}
      </div>

      <PlayerAdjust
        open={sheet === 'adjust'}
        onClose={() => setSheet(null)}
        onOpenPanel={setSheet}
        onEditWords={editWords}
        onOpenMixer={() => setSheet('mixer')}
      />
      <AmbienceMixer open={sheet === 'mixer'} onClose={() => setSheet(null)} />
      <SettingsSheets
        open={sheet === 'adjust' || sheet === 'mixer' ? null : sheet}
        onOpenChange={setSheet}
      />
    </>
  )
}
