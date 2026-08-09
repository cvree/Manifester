import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
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
import { EmptyState } from '../components/EmptyState'
import { PlayerAtmosphere } from '../components/PlayerAtmosphere'
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
import { useReducedMotion } from '../lib/motion'
import { MAX_VOICE_VOLUME } from '../lib/speech'
import {
  affirmationLines,
  brainwaveSummary,
  breathingSummary,
  feelSummary,
} from '../lib/summaries'
import { useBackgroundMix } from '../lib/useBackgroundMix'
import { useBreathing } from '../lib/useBreathing'
import { useFittedLine } from '../lib/useFittedLine'
import { useStageExpansion } from '../lib/useStageExpansion'
import { usePreferences } from '../state/PreferencesProvider'
import { useSession } from '../state/SessionProvider'
import { useStage } from '../state/StageProvider'

/**
 * How long the room waits before letting the parts of it that are only
 * information step back. Long enough that reading the pass counter is never a
 * race; short enough that settling in is answered within one breath.
 */
const QUIET_AFTER_MS = 4200

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
 *
 * Around all of it is `PlayerAtmosphere`, and the one thing worth knowing
 * about it is that it is not a separate animation. The breathing hook writes
 * the breath onto the orb, the stage and the atmosphere on the same frame,
 * from the same clock — so the light beyond the glass fills as the orb fills,
 * to the millisecond, because it is the same number. There is exactly one
 * breath in this room and everything in it is following that one.
 *
 * How much of that room is on show is a second, entirely separate number: the
 * mix, in `useBackgroundMix`. Everything environmental is the product of the
 * two, which is what lets the Background visualiser setting be switched on
 * halfway through an in-breath without the breath ever learning that it was.
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
  const reducedMotion = useReducedMotion()

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

  const fieldRef = useRef<HTMLDivElement>(null)
  const lineRef = useRef<HTMLParagraphElement>(null)

  /*
   * The guide follows the session: it breathes while you listen and holds
   * still the moment you pause.
   *
   * `mirrors` is what makes the room breathe with it. Both the stage and the
   * atmosphere behind it receive the same `--e` and `--p` the orb does, on the
   * same frame, from this one clock — which is the only arrangement in which
   * "everything inhales together" is a fact rather than a hope.
   */
  const breathing = useBreathing({
    pattern: preferences.breathPattern,
    active: preferences.breathingEnabled && playing,
    sound: preferences.breathSound,
    soundVolume: preferences.breathSoundVolume,
    hapticCues: preferences.breathHapticCues,
    mirrors: [stageRef, fieldRef],
  })

  /*
   * ── The two numbers behind the room, and why they are two ──
   *
   * `fieldAmplitude` is *is there a live breath to follow*: the guide is on, a
   * session is actually playing, and motion is wanted. It is a registered,
   * eased custom property (`--field` in `theme.css`), so pausing settles the
   * room over a second instead of stopping it dead.
   *
   * The mix is *how much of the environment is on show*, and it is deliberately
   * not part of that condition. Keeping them apart is what makes the setting
   * safe to change mid-session: turning the visualiser on halfway through an
   * in-breath animates the mix from 0 to 1 while the breath carries straight on
   * at whatever value it was already at, so the room fades in *already* at 63%
   * of an inhale rather than starting one of its own. Every environmental
   * calculation in the stylesheet is the product of the two — see `--drive`.
   */
  const backgroundOn = preferences.backgroundVisualizer

  const fieldAmplitude =
    preferences.breathingEnabled && playing && !reducedMotion ? 1 : 0

  /*
   * The stage as well as the atmosphere, because the stage is not a descendant
   * of it and its own pool of light has to agree with the light beyond the
   * glass.
   */
  const mixTargets = useMemo<Array<RefObject<HTMLElement | null>>>(
    () => [fieldRef, stageRef],
    [fieldRef, stageRef],
  )
  useBackgroundMix({
    enabled: backgroundOn,
    targets: mixTargets,
    reducedMotion,
  })

  // Bloom the orb once, as the session comes to life.
  const [awaken, setAwaken] = useState(false)
  useEffect(() => {
    if (!playing) return
    setAwaken(true)
    const timeout = window.setTimeout(() => setAwaken(false), 1600)
    return () => window.clearTimeout(timeout)
  }, [playing])

  /*
   * ── Letting the room go quiet ──
   *
   * With the stage on the screen and nothing happening for a few seconds, the
   * parts of it that are only information step back and leave the words, the
   * orb, play/pause, the clock and the way out. Any sign of life brings them
   * straight back.
   *
   * The flag is mirrored in a ref so that waking is free: a pointer crossing
   * the screen restarts a timer and nothing else — it only ever reaches React
   * on the one move that actually changes the state. Sixty re-renders a second
   * to keep a control at the opacity it already had would be a strange way to
   * pay for stillness.
   */
  const [quiet, setQuiet] = useState(false)
  const quietRef = useRef(false)

  useEffect(() => {
    if (!expanded || !playing) {
      quietRef.current = false
      setQuiet(false)
      return
    }

    let timer = 0
    const settle = () => {
      quietRef.current = true
      setQuiet(true)
    }
    const wake = () => {
      if (quietRef.current) {
        quietRef.current = false
        setQuiet(false)
      }
      window.clearTimeout(timer)
      timer = window.setTimeout(settle, QUIET_AFTER_MS)
    }

    wake()

    const events = [
      'pointermove',
      'pointerdown',
      'keydown',
      'touchstart',
      'wheel',
      'focusin',
    ] as const
    for (const event of events) {
      window.addEventListener(event, wake, { passive: true })
    }

    return () => {
      window.clearTimeout(timer)
      for (const event of events) window.removeEventListener(event, wake)
      quietRef.current = false
    }
  }, [expanded, playing])

  /*
   * ── Entering the room ──
   *
   * The rectangle's own journey belongs to `useStageExpansion`, and everything
   * measured in the stylesheet — the padding, the radius, the orb's size, the
   * type — travels on the CSS clock beside it. What is left for GSAP is the
   * part neither of those can express: the order things arrive in.
   *
   * The atmosphere opens first and slowest, because it is the room; the title
   * settles, then the words, then the controls, each a little after the last;
   * and the fine detail — the motes — is the last thing to appear, once
   * everything else has come to rest. About 900ms end to end, all of it eased
   * out and none of it overshooting, so it reads as walking into a space
   * rather than as a modal being enlarged.
   *
   * Only transforms and opacities, and only on properties the stylesheet is
   * not already transitioning — a GSAP tween and a CSS transition on the same
   * property is a tug of war that the transition wins slowly and visibly.
   */
  useGSAP(
    () => {
      const stage = stageRef.current
      const field = fieldRef.current
      if (!stage || instant) return

      const find = (selector: string) => stage.querySelector(selector)
      const top = find('.stage__top')
      const line = find('.stage__line')
      const transport = find('.stage__transport')
      const meter = find('.stage__meter')

      const timeline = gsap.timeline({ defaults: { ease: 'power2.out' } })

      if (!expanded) {
        // Coming back is the same movement, briefer: the room closes around
        // you rather than being taken away.
        if (field) {
          timeline.fromTo(
            field,
            { opacity: 0.55 },
            { opacity: 1, duration: 0.45 },
            0,
          )
        }
        return
      }

      if (field) {
        timeline.fromTo(
          field,
          { opacity: 0.2, scale: 1.06 },
          { opacity: 1, scale: 1, duration: 0.9, ease: 'power2.inOut' },
          0.1,
        )
      }
      if (top) {
        timeline.fromTo(top, { y: 12 }, { y: 0, duration: 0.5 }, 0.28)
      }
      if (line) {
        timeline.fromTo(
          line,
          { y: 10, opacity: 0.45 },
          { y: 0, opacity: 1, duration: 0.55 },
          0.34,
        )
      }
      if (transport) {
        timeline.fromTo(transport, { y: 14 }, { y: 0, duration: 0.5 }, 0.42)
      }
      if (meter) {
        timeline.fromTo(meter, { y: 10 }, { y: 0, duration: 0.5 }, 0.46)
      }

      /*
       * The far half of the room arrives last, once everything else has come
       * to rest: the colour and haze band, then the points of light, then the
       * depth at the edges. Each of these is a wrapper carrying nothing but a
       * plain opacity, which is the only reason they can be tweened at all —
       * the layers inside them are recomputing opacity from the breath every
       * frame, and a tween on the same property would be a tug of war.
       */
      const reveal = (selector: string, at: number, duration: number) => {
        const target = field?.querySelector(selector)
        if (target) {
          timeline.fromTo(target, { opacity: 0.3 }, { opacity: 1, duration }, at)
        }
      }

      reveal('.player-field__clouds', 0.4, 0.6)
      reveal('.player-field__motes', 0.5, 0.6)
      reveal('.player-field__depth', 0.58, 0.62)
    },
    { dependencies: [expanded, instant], revertOnUpdate: true },
  )

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

  /*
   * The words are set to fit a box that never changes size, rather than the box
   * being sized to fit the words. That is the whole of what keeps the orb still
   * while the lines change length underneath it.
   */
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

  return (
    <>
      {/*
        The room. It sits behind the page rather than inside the stage, so the
        light is not something the card is wearing — it is the air the card is
        in, and expanding the stage does not have to hand it over to anything.
      */}
      <PlayerAtmosphere
        fieldRef={fieldRef}
        amplitude={fieldAmplitude}
        immersive={expanded}
        settled={complete}
        utterance={playing ? (currentLine ?? undefined) : undefined}
        mode={preferences.backgroundMode}
      />

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
              data-quiet={quiet ? 'true' : undefined}
              style={{ '--field': fieldAmplitude } as CSSProperties}
              className={cx(
                'surface-stage stage relative flex flex-col items-center px-5 py-8 sm:px-8 lg:py-10',
                expanded && 'stage--immersive',
                // The card grows and its edge softens once the room around it
                // is awake, so the player is immersive before Expand is ever
                // pressed. Expanded mode has its own sizing and wins outright.
                backgroundOn && 'stage--roomy',
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
                {/*
                  One size in both states, and deliberately so. `stage` reads
                  `--stage-orb`, which the stylesheet gives a value in the card
                  as well as on the expanded stage — and because `--size` is a
                  registered property, the orb *grows* between the two rather
                  than being swapped for a bigger one.
                */}
                <div className="stage__orb relative my-6 flex items-center justify-center">
                  <BreathingVisualizer
                    runtime={breathing}
                    style={preferences.breathStyle}
                    size="stage"
                    showPhase={preferences.breathingEnabled && playing}
                    awaken={awaken}
                  />
                </div>

                {/*
                  The line you are hearing.

                  The paragraph holds the space and the span holds the words,
                  so a new line can arrive with a fade of its own while the
                  block around it — its size, its width, its reserved height —
                  carries on transitioning undisturbed. Keying the paragraph
                  itself would remount it, and a remount mid-expansion is a
                  jump in type size rather than a change of words.

                  The box is a fixed height and the type shrinks to meet it —
                  see `useFittedLine`. That is what stops a two-line
                  affirmation moving the orb, and it is why none of the
                  typography is set here any more: the size has to be one
                  number the fit can multiply.
                */}
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

              {/*
                Transport: one large control, one small one.

                The air around it is tighter than it was, and deliberately: the
                orb took the room, which is the point. Play, the clock and the
                words all still land above the fold on an ordinary laptop
                window — that is the bar this spacing is set against.
              */}
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
                  {playing ? <PauseIcon /> : <PlayIcon className="translate-x-[3px]" />}
                </button>

                {/*
                  The clock, and nothing beside it.

                  The pass counter used to sit here. It was the one number on
                  this screen that answered a question nobody listening is
                  asking — how many times round have I been — and it changed
                  under the eye every few minutes for no reason anyone acts on.
                  The time left is the whole of what is worth knowing here.
                */}
                <div className="flex items-center gap-3">
                  <span
                    className="type-numeral text-[1.05rem] text-ink"
                    aria-live="polite"
                  >
                    {timeLabel}
                  </span>
                  <span className="type-meta">{timeCaption}</span>
                </div>

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

              {/*
                Progress through this pass — in the card only.

                Expanded, this is the last piece of technical information left
                on a screen whose whole job is to have none, and it is saying
                what the state label at the top already says: the countdown to
                the next pass is up there as "Resting · 6s". Its height is not
                free either — the words' box below the orb has to come out of
                the same budget, and this is the part of the composition that
                is easiest to lose and hardest to miss.
              */}
              {!idle && !expanded && (
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
                preferences.backgroundVisualizer,
                preferences.backgroundMode,
              )}
              onClick={() => {
                cue('tap')
                setSheet('breathing')
              }}
              accent={preferences.breathingEnabled || backgroundOn}
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
