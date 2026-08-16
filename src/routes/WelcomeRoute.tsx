import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { ArrivalStep } from '../components/onboarding/ArrivalStep'
import { IntentStep } from '../components/onboarding/IntentStep'
import { OnboardingFrame } from '../components/onboarding/OnboardingFrame'
import { RitualStep } from '../components/onboarding/RitualStep'
import { SettlingField, type FieldTone } from '../components/onboarding/SettlingField'
import { useAudition } from '../components/onboarding/useAudition'
import { VoiceMomentStep } from '../components/onboarding/VoiceMomentStep'
import { findFocus, recommendedFor, type Focus } from '../lib/affirmations'
import { findPreset } from '../lib/breathing'
import { primeBreathAudio } from '../lib/breathAudio'
import { recordEngagement } from '../lib/engagement'
import { useReducedMotion } from '../lib/motion'
import {
  clearProgress,
  markOnboarded,
  readProgress,
  writeProgress,
} from '../lib/onboarding'
import { soundName } from '../lib/summaries'
import { tts } from '../lib/tts'
import { useBreathing } from '../lib/useBreathing'
import { useLibrary } from '../state/LibraryProvider'
import { usePreferences } from '../state/PreferencesProvider'
import { useSession } from '../state/SessionProvider'

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
 * ── Four beats ──────────────────────────────────────────────────────────────
 *
 *     arrival  →  what would you like to strengthen?  →  hear it  →  begin
 *      feel          personal relevance                  surprise    calm
 *
 * The voice moment is folded into the third beat rather than given a screen of
 * its own, because comparing Ivy and Fen only means something when they are
 * saying the sentence you just chose. Personalising is folded in for the same
 * reason: it is the same screen, one tap, with the writing helper the app
 * already has.
 *
 * ── Leaving, and coming back ────────────────────────────────────────────────
 *
 * Back on every step after the first. Skip on all of them, which lands in the
 * editor with whatever was chosen. Every change is written to `localStorage`,
 * so a refresh, a discarded tab or a phone that locked mid-sentence resumes
 * where it was — and the whole thing is versioned, so a future introduction
 * can be offered deliberately rather than by accident.
 */

type Step = 'arrival' | 'intent' | 'voice' | 'ritual'

const ORDER: Step[] = ['arrival', 'intent', 'voice', 'ritual']

/** How resolved the field is on each step. See `SettlingField`. */
const RESOLVE: Record<Step, number> = {
  arrival: 0,
  intent: 0.34,
  voice: 0.68,
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

export function WelcomeRoute() {
  const navigate = useNavigate()
  const { updateDraft, updateSettings, draft, prime, start } = useSession()
  const { preferences } = usePreferences()
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
  const [focus, setFocus] = useState<Focus | null>(() =>
    findFocus(restored?.focusId),
  )
  const [text, setText] = useState(() => restored?.text ?? '')
  const [style, setStyle] = useState<'feminine' | 'masculine'>(
    () => restored?.voiceStyle ?? draft.settings.voiceStyle,
  )
  const [beginning, setBeginning] = useState(false)
  /** Warms the field towards whatever the pointer is over, before a choice. */
  const [hovered, setHovered] = useState<Focus | null>(null)

  /*
   * A resumed journey is mid-flight, and the steps after the first assume the
   * audio was opened by a real tap on Begin. It was not — this is a fresh page
   * — so the field and the interface are correct, and the first press of a
   * line does the unlocking. `useAudition` calls `unlock()` on every play for
   * exactly this reason.
   */

  /** Everything worth not losing, written on every change. */
  useEffect(() => {
    if (step === 'arrival' && !focus && !text) return
    writeProgress({ step, focusId: focus?.id ?? null, text, voiceStyle: style })
  }, [step, focus, text, style])

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
   * the first thing anybody sees is the thing they came for.
   */
  const breathing = useBreathing({
    pattern: preferences.breathPattern,
    active: true,
  })

  const tone: FieldTone = (hovered ?? focus)?.tone ?? 'rose'
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
      updateDraft({ text: line, title: focus?.loopTitle ?? 'My first loop' })
    }
    updateSettings({ voiceStyle: style, voiceSource: 'studio' })
  }, [focus, style, text, updateDraft, updateSettings])

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

  const index = ORDER.indexOf(step)

  return (
    <>
      {/*
        The field sits behind the whole route rather than inside a step, so it
        is one continuous object across all four — the thing that settles,
        rather than four things that each animate in.
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
        step={index}
        total={ORDER.length}
        stepKey={step}
        width={step === 'intent' ? 'wide' : 'column'}
        onBack={index > 0 ? () => go(ORDER[index - 1]) : undefined}
        onSkip={() => leave()}
        skipLabel={step === 'arrival' ? 'Skip' : 'Skip setup'}
      >
        {step === 'arrival' && (
          <ArrivalStep
            onBegin={() => {
              // The one gesture the whole experience's responsiveness rests on.
              tts.unlock()
              go('intent')
            }}
          />
        )}

        {step === 'intent' && (
          <IntentStep
            onPreviewTone={setHovered}
            onChoose={(chosen) => {
              setFocus(chosen)
              setHovered(null)
              // Pre-select the recommendation so Continue is always one press
              // away — and so the voice step opens on a real sentence rather
              // than on an empty state.
              setText(recommendedFor(chosen))
              go('voice')
            }}
          />
        )}

        {step === 'voice' && focus && (
          <VoiceMomentStep
            focus={focus}
            value={text}
            style={style}
            audition={audition}
            onChange={setText}
            onStyleChange={setStyle}
            onContinue={() => go('ritual')}
          />
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
