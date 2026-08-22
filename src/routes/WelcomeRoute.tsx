import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { ArrivalStep } from '../components/onboarding/ArrivalStep'
import { AttuneStep } from '../components/onboarding/AttuneStep'
import { IntentStep } from '../components/onboarding/IntentStep'
import { OnboardingFrame } from '../components/onboarding/OnboardingFrame'
import { OwnWordsGate } from '../components/onboarding/OwnWordsGate'
import { RitualStep } from '../components/onboarding/RitualStep'
import { SettlingField, type FieldTone } from '../components/onboarding/SettlingField'
import { useAudition } from '../components/onboarding/useAudition'
import { VoiceMomentStep } from '../components/onboarding/VoiceMomentStep'
import {
  blendStarters,
  findFocus,
  loopTitleFor,
  recommendedFor,
  type Focus,
} from '../lib/affirmations'
import { findPreset, type BreathPattern } from '../lib/breathing'
import { primeBreathAudio } from '../lib/breathAudio'
import { recordEngagement } from '../lib/engagement'
import { useReducedMotion } from '../lib/motion'
import {
  clearProgress,
  markOnboarded,
  readProgress,
  writeProgress,
} from '../lib/onboarding'
import { chooseSound } from '../lib/soundChoice'
import { soundtrack } from '../lib/soundtrack'
import { soundName } from '../lib/summaries'
import { tts } from '../lib/tts'
import { useBreathing } from '../lib/useBreathing'
import { useLibrary } from '../state/LibraryProvider'
import { usePreferences } from '../state/PreferencesProvider'
import { useSession } from '../state/SessionProvider'
import { useTheme } from '../state/ThemeProvider'

/**
 * Opening Manifester for the first time.
 *
 * ── The thesis ──────────────────────────────────────────────────────────────
 *
 * **A single field of concentric light that begins unresolved and settles into
 * focus as the person makes each choice — so the interface itself appears to
 * take a breath and come into clarity alongside them.**
 *
 * Everything here serves that sentence, and the motion budget is spent
 * accordingly: one atmospheric visual (`SettlingField`), one transition
 * language (steps arrive as a settled movement, words arrive like breath), a
 * handful of tactile micro-interactions, and one bloom into the first ritual.
 * There is no carousel, no second background, no particle field and no scene
 * that exists because it looked good in isolation.
 *
 * ── What is preserved ───────────────────────────────────────────────────────
 *
 * All of it. This route writes into the *same* draft the Create screen edits
 * and the Player reads — `updateDraft` and `updateSettings`, nothing else — so
 * there is no parallel onboarding model to migrate later, `Customize` can hand
 * somebody straight to the real editor mid-flow with their words intact, and
 * the session that starts at the end is an ordinary session in every respect.
 * The voice layer, the caches, the breath engine and the ambience are used
 * exactly as the rest of the app uses them.
 *
 * ── The beats ───────────────────────────────────────────────────────────────
 *
 *   arrival → what would you like to strengthen? → hear it → make it yours
 *                                                    → your sky → begin
 *
 * The first three are the original flow and are unchanged in shape: feel,
 * personal relevance, surprise. The two that follow were added for one reason,
 * which is worth stating because it is not "more features".
 *
 * A first visit that consists entirely of *being shown things* produces
 * somebody who has seen a nice app. A first visit in which somebody chooses
 * the colour of the room, the rhythm of the breath, the sound underneath and —
 * if they want it — a chart of their own produces somebody who has **made
 * something**, and that is a different relationship with the same software.
 * Every one of those choices already existed in Settings, where nearly nobody
 * found them.
 *
 * `own-words` is a sixth step that is never reached in the ordinary flow: it
 * is where "Write my own" goes when the question of *who will read those
 * words* has not been answered yet. See `OwnWordsGate` for why that question
 * cannot be skipped.
 *
 * ── Leaving, and coming back ────────────────────────────────────────────────
 *
 * Back on every step after the first. Skip on all of them, which lands in the
 * editor with whatever was chosen. Every change is written to `localStorage`,
 * so a refresh, a discarded tab or a phone that locked mid-sentence resumes
 * where it was — and the whole thing is versioned, so a future introduction
 * can be offered deliberately rather than by accident.
 */

type Step =
  | 'arrival'
  | 'intent'
  | 'voice'
  | 'own-words'
  | 'attune'
  | 'sky'
  | 'ritual'

/** The steps with a mark at the bottom. `own-words` is a detour, not a beat. */
const ORDER: Step[] = ['arrival', 'intent', 'voice', 'attune', 'sky', 'ritual']

/** How resolved the field is on each step. See `SettlingField`. */
const RESOLVE: Record<Step, number> = {
  arrival: 0,
  intent: 0.28,
  voice: 0.5,
  'own-words': 0.5,
  attune: 0.72,
  sky: 0.88,
  ritual: 1,
}

/**
 * How long the bloom runs before the player is mounted.
 *
 * Short enough that it reads as one movement rather than as a wait, and long
 * enough that the field has visibly opened. Nothing is blocked on it: the
 * session is already starting underneath.
 */
const BLOOM_MS = 460

/**
 * The one step that is code-split, for the same reason the library's Sky tab
 * is: the city list and everything behind it belong to people who want a
 * chart, not to every first-time visitor. By the time somebody reaches this
 * step they have spent thirty seconds on the four before it, so the fetch has
 * had plenty of time to finish in the background.
 */
const SkyStep = lazy(() =>
  import('../components/onboarding/SkyStep').then((module) => ({
    default: module.SkyStep,
  })),
)

export function WelcomeRoute() {
  const navigate = useNavigate()
  const {
    updateDraft,
    updateSettings,
    draft,
    prime,
    start,
    voices,
    voicesReady,
  } = useSession()
  const { preferences, update: updatePreferences } = usePreferences()
  const { hue, chroma, setPalette } = useTheme()
  const { allTracks } = useLibrary()
  const reducedMotion = useReducedMotion()
  const audition = useAudition()

  /* ── State, restored from a half-finished visit if there is one ── */

  const restored = useRef(readProgress()).current

  const [step, setStep] = useState<Step>(() =>
    restored && ORDER.includes(restored.step as Step)
      ? (restored.step as Step)
      : 'arrival',
  )
  const [focuses, setFocuses] = useState<Focus[]>(() =>
    (restored?.focusIds ?? [])
      .map((id) => findFocus(id))
      .filter((focus): focus is Focus => focus != null),
  )
  const [text, setText] = useState(() => restored?.text ?? '')
  const [style, setStyle] = useState<'feminine' | 'masculine'>(
    () => restored?.voiceStyle ?? draft.settings.voiceStyle,
  )
  const [beginning, setBeginning] = useState(false)
  /** Warms the field towards whatever the pointer is over, before a choice. */
  const [hovered, setHovered] = useState<Focus | null>(null)

  /**
   * Whether the textarea is open, and whether it is allowed to be.
   *
   * Two separate facts. `writing` is which half of the voice step is on
   * screen; `wordsUnlocked` is whether the question of who reads a typed line
   * has been answered — by installing Studio Voice, or by deliberately
   * choosing a device voice instead. Lifted here rather than kept in the step
   * because the answer is given on a *different* step and has to survive the
   * trip back. See `OwnWordsGate`.
   */
  const [writing, setWriting] = useState(false)
  const [wordsUnlocked, setWordsUnlocked] = useState(
    () => restored?.wordsUnlocked ?? false,
  )

  /*
   * A resumed journey is mid-flight, and the steps after the first assume the
   * audio was opened by a real tap on Begin. It was not — this is a fresh page
   * — so the field and the interface are correct, and the first press of a
   * line does the unlocking. `useAudition` calls `unlock()` on every play for
   * exactly this reason.
   */

  /** Everything worth not losing, written on every change. */
  useEffect(() => {
    if (step === 'arrival' && focuses.length === 0 && !text) return
    writeProgress({
      step,
      focusIds: focuses.map((focus) => focus.id),
      text,
      voiceStyle: style,
      wordsUnlocked,
    })
  }, [step, focuses, text, style, wordsUnlocked])

  /*
   * Nothing may still be speaking when this screen goes away.
   *
   * `useAudition` already stops on unmount, but the guarantee has to hold for
   * the route as a whole — an audition started on the voice step and a
   * navigation triggered from the ritual step are two different components,
   * and a line still playing over the player's own first words is the exact
   * overlap this app must never produce.
   */
  useEffect(() => () => tts.stop(), [])

  /* ── The field ── */

  /*
   * The same breath the player will run, on a silent preview clock. The field
   * is therefore already breathing at the pattern named on the last step, and
   * the first thing anybody sees is the thing they came for — and when the
   * pattern is changed on the Attune step, the change is visible immediately
   * in the light behind the page.
   */
  const breathing = useBreathing({
    pattern: preferences.breathPattern,
    active: true,
  })

  const tone: FieldTone = (hovered ?? focuses[0])?.tone ?? 'rose'
  const speaking = audition.speaking != null || audition.loading != null

  /* ── The bloom into the player ── */

  const bloomRef = useRef<HTMLDivElement>(null)
  const { contextSafe } = useGSAP({ scope: bloomRef })

  const bloom = contextSafe(() => {
    const node = bloomRef.current
    if (!node || reducedMotion) return
    gsap.fromTo(
      node,
      { opacity: 0, scale: 0.6 },
      { opacity: 1, scale: 1.9, duration: BLOOM_MS / 1000, ease: 'power2.in' },
    )
  })

  /* ── Moving between steps ── */

  const go = useCallback(
    (next: Step) => {
      audition.stop()
      setStep(next)
      // A step change is a new screen at the top, and the intent grid can be
      // taller than a phone. Instant rather than smooth: this is not a scroll
      // somebody asked for, it is the page being replaced.
      window.scrollTo({ top: 0, behavior: 'auto' })
    },
    [audition],
  )

  /** Everything the first session needs, written into the real draft. */
  const commit = useCallback(() => {
    const line = text.trim()
    if (line) {
      updateDraft({ text: line, title: loopTitleFor(focuses) })
    }
    updateSettings({ voiceStyle: style, voiceSource: 'studio' })
  }, [focuses, style, text, updateDraft, updateSettings])

  /**
   * Leave, at any point, keeping whatever has been decided.
   *
   * The editor is the right place to land rather than the player: somebody who
   * skipped did not ask for a session to start, and arriving in the middle of
   * one would be the app doing exactly the thing they just declined.
   */
  const leave = useCallback(
    (destination: '/create' = '/create') => {
      commit()
      markOnboarded()
      tts.stop()
      navigate(destination, { replace: true })
    },
    [commit, navigate],
  )

  const begin = useCallback(() => {
    if (beginning) return
    // Inside the gesture: Safari will not open the audio a beat later.
    prime()
    primeBreathAudio()
    commit()
    markOnboarded()
    clearProgress()
    setBeginning(true)
    bloom()

    /*
     * One tick for the draft to land before the session reads it.
     *
     * `start()` takes what is in the provider, and `commit()` has only just
     * queued a state update — starting synchronously would begin a session
     * with the previous draft. The bloom's duration is the same wait, which is
     * why the transition reads as continuous rather than as a pause followed
     * by a screen: by the time the player mounts, the voice is already loading
     * and the garden behind it never went away.
     */
    window.setTimeout(
      () => {
        start()
        recordEngagement()
        navigate('/player', { replace: true })
      },
      reducedMotion ? 24 : BLOOM_MS - 60,
    )
  }, [beginning, bloom, commit, navigate, prime, reducedMotion, start])

  /* ── Derived labels for the ritual preview ── */

  const breathLabel = useMemo(() => {
    if (!preferences.breathingEnabled) return 'Off'
    return findPreset(preferences.breathPattern)?.name ?? 'Custom'
  }, [preferences.breathingEnabled, preferences.breathPattern])

  const ambience = useMemo(
    () => soundName(draft.settings, allTracks),
    [draft.settings, allTracks],
  )

  /** The built-in ambience currently chosen, for the Attune step's chips. */
  const soundId = useMemo(
    () =>
      draft.settings.sound.mode === 'off'
        ? null
        : draft.settings.sound.trackId,
    [draft.settings.sound],
  )

  const index = ORDER.indexOf(step)
  /* The detour keeps the voice step's mark lit rather than clearing the row. */
  const marked = index >= 0 ? index : ORDER.indexOf('voice')

  return (
    <>
      {/*
        The field sits behind the whole route rather than inside a step, so it
        is one continuous object across all of them — the thing that settles,
        rather than several things that each animate in.
      */}
      <div className="pointer-events-none fixed inset-0 -z-[9] overflow-hidden">
        <SettlingField
          resolve={RESOLVE[step]}
          tone={tone}
          speaking={speaking}
          breath={breathing.live}
        />
      </div>

      {/* The bloom. Scaled from the centre, over the field, into the player. */}
      <div
        ref={bloomRef}
        aria-hidden="true"
        className="pointer-events-none fixed left-1/2 top-1/2 -z-[8] h-[70vmin] w-[70vmin] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-0"
        style={{
          background:
            'radial-gradient(circle, color-mix(in oklab, var(--rose) 34%, transparent) 0%, transparent 68%)',
        }}
      />

      <OnboardingFrame
        step={marked}
        total={ORDER.length}
        stepKey={step}
        width={step === 'intent' ? 'wide' : 'column'}
        onBack={
          step === 'arrival'
            ? undefined
            : step === 'own-words'
              ? () => go('voice')
              : () => go(ORDER[Math.max(0, index - 1)])
        }
        onSkip={() => leave()}
        skipLabel={step === 'arrival' ? 'Skip' : 'Skip setup'}
      >
        {step === 'arrival' && (
          <ArrivalStep
            onBegin={() => {
              // The one gesture the whole experience's responsiveness rests on.
              tts.unlock()
              /*
               * And the one the soundtrack has been waiting for. This press is
               * the only place in the app where somebody says "yes, begin"
               * before anything has happened at all, which makes it exactly the
               * right moment for the room to arrive — and the reason the first
               * screen is silent until it happens.
               */
              soundtrack.begin()
              go('intent')
            }}
          />
        )}

        {step === 'intent' && (
          <IntentStep
            chosen={focuses}
            onPreviewTone={setHovered}
            onChange={(next) => {
              setFocuses(next)
              setHovered(null)
              /*
               * Keep the line in step with the choices, unless they have moved
               * away from the suggestions. Somebody who has written their own
               * sentence and then adds a second intent must not have it
               * silently replaced.
               */
              const suggested = blendStarters(next)
              const untouched =
                text === '' || blendStarters(focuses).includes(text)
              if (untouched) {
                setText(next.length > 0 ? recommendedFor(next[0]) : '')
              } else if (suggested.length === 0) {
                setText(text)
              }
            }}
            onContinue={() => go('voice')}
          />
        )}

        {step === 'voice' && focuses.length > 0 && (
          <VoiceMomentStep
            focuses={focuses}
            value={text}
            style={style}
            audition={audition}
            writing={writing}
            onWriteOwn={() => {
              if (wordsUnlocked) {
                setWriting(true)
                return
              }
              go('own-words')
            }}
            onShowSuggestions={() => setWriting(false)}
            onChange={setText}
            onStyleChange={setStyle}
            onContinue={() => go('attune')}
          />
        )}

        {step === 'own-words' && (
          <OwnWordsGate
            style={style}
            voices={voices}
            voicesReady={voicesReady}
            selectedVoiceURI={draft.settings.voiceURI}
            onChooseDeviceVoice={(voice) => {
              updateSettings({
                voiceURI: voice.voiceURI,
                voiceName: voice.name,
                voiceSource: 'device',
              })
            }}
            onResolved={() => {
              setWordsUnlocked(true)
              setWriting(true)
              go('voice')
            }}
            onCancel={() => {
              setWriting(false)
              go('voice')
            }}
          />
        )}

        {step === 'attune' && (
          <AttuneStep
            hue={hue}
            chroma={chroma}
            onPaletteChange={setPalette}
            breathingEnabled={preferences.breathingEnabled}
            breathPattern={preferences.breathPattern}
            onBreathChange={(pattern: BreathPattern, enabled) =>
              updatePreferences({ breathPattern: pattern, breathingEnabled: enabled })
            }
            breathStyle={preferences.breathStyle}
            onBreathStyleChange={(breathStyle) => updatePreferences({ breathStyle })}
            soundId={soundId}
            onSoundChange={(id) =>
              updateSettings({
                sound: chooseSound(
                  draft.settings.sound,
                  id == null ? { kind: 'off' } : { kind: 'track', id },
                ),
              })
            }
            onContinue={() => go('sky')}
          />
        )}

        {step === 'sky' && (
          <Suspense fallback={<div className="min-h-[18rem]" />}>
            <SkyStep onDone={() => go('ritual')} />
          </Suspense>
        )}

        {step === 'ritual' && (
          <RitualStep
            text={text}
            settings={{ ...draft.settings, voiceStyle: style }}
            breathLabel={breathLabel}
            soundName={ambience}
            audition={audition}
            beginning={beginning}
            onBegin={begin}
            onCustomize={() => leave('/create')}
          />
        )}
      </OnboardingFrame>
    </>
  )
}
