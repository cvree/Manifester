import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { AffirmationStep } from '../components/onboarding/AffirmationStep'
import { FocusStep } from '../components/onboarding/FocusStep'
import { OnboardingFrame } from '../components/onboarding/OnboardingFrame'
import { VoiceStep } from '../components/onboarding/VoiceStep'
import { WelcomeStep } from '../components/onboarding/WelcomeStep'
import type { Focus } from '../lib/affirmations'
import { primeBreathAudio } from '../lib/breathAudio'
import { recordEngagement } from '../lib/engagement'
import { useReducedMotion } from '../lib/motion'
import { markOnboarded } from '../lib/onboarding'
import { tts } from '../lib/tts'
import { useSession } from '../state/SessionProvider'

/**
 * Opening Manifester for the first time.
 *
 * Four steps, and the shape of them is the argument: welcome, what matters to
 * you, hear a line in Manifester's own voice, choose who reads it and begin.
 * Nothing is configured that the app could not have guessed, nothing is
 * explained that would be better discovered, and every step can be left.
 *
 * Two decisions worth defending:
 *
 * **The voice is heard on step three, not step four.** The Studio Voice offer
 * only makes sense to somebody who already knows what they are being offered,
 * so the sound comes first and the ~90 MB question comes after.
 *
 * **Skip is real.** It marks the introduction as seen and drops straight into
 * the editor, with whatever was chosen so far carried across. A first-run
 * experience somebody has to escape is one they resent, and the whole thing is
 * short enough that most people will not want to.
 */

type Step = 'welcome' | 'focus' | 'affirmation' | 'voice'

const ORDER: Step[] = ['welcome', 'focus', 'affirmation', 'voice']

/** Long enough for the button to settle before the route changes. */
const START_TRANSITION_MS = 320

export function WelcomeRoute() {
  const navigate = useNavigate()
  const { updateDraft, updateSettings, draft, prime, start } = useSession()
  const reducedMotion = useReducedMotion()

  const [step, setStep] = useState<Step>('welcome')
  const [focus, setFocus] = useState<Focus | null>(null)
  const [text, setText] = useState('')
  const [style, setStyle] = useState<'feminine' | 'masculine'>(
    draft.settings.voiceStyle,
  )
  const [beginning, setBeginning] = useState(false)

  /*
   * Nothing may still be speaking when this screen goes away.
   *
   * `useAudition` already stops on unmount, but the guarantee has to hold for
   * the whole route rather than for one step — an audition started on the
   * affirmation step and a navigation triggered from the voice step are two
   * different components, and a line still playing over the player's own first
   * words is the exact overlap this app must never produce.
   */
  useEffect(() => () => tts.stop(), [])

  /** Everything the first session needs, written into the draft. */
  const commit = useCallback(() => {
    const line = text.trim()
    if (line) {
      updateDraft({
        text: line,
        title: focus?.loopTitle ?? 'My first loop',
      })
    }
    updateSettings({ voiceStyle: style, voiceSource: 'studio' })
    markOnboarded()
  }, [focus, style, text, updateDraft, updateSettings])

  /**
   * Leave, at any point, keeping whatever has been decided.
   *
   * The editor is the right place to land rather than the player: somebody who
   * skipped did not ask for a session to start, and arriving in the middle of
   * one would be the app doing exactly the thing they just declined.
   */
  const skip = useCallback(() => {
    commit()
    tts.stop()
    navigate('/create', { replace: true })
  }, [commit, navigate])

  const begin = useCallback(() => {
    if (beginning) return
    // Inside the gesture: Safari will not open the audio a beat later.
    prime()
    primeBreathAudio()
    commit()
    setBeginning(true)

    /*
     * One frame for the draft to land before the session reads it.
     *
     * `start()` takes what is in the provider, and `commit()` has only just
     * queued a state update — starting synchronously would begin a session
     * with the previous, empty draft. The delay that makes the button feel
     * settled is the same delay that makes this correct, which is a happy
     * accident worth writing down so nobody removes it as decoration.
     */
    window.setTimeout(
      () => {
        start()
        recordEngagement()
        navigate('/player', { replace: true })
      },
      reducedMotion ? 24 : START_TRANSITION_MS,
    )
  }, [beginning, commit, navigate, prime, reducedMotion, start])

  return (
    <OnboardingFrame
      step={ORDER.indexOf(step)}
      total={ORDER.length}
      stepKey={step}
      width={step === 'focus' ? 'wide' : 'column'}
      onSkip={skip}
      skipLabel={step === 'welcome' ? 'Skip' : 'Skip setup'}
    >
      {step === 'welcome' && (
        <WelcomeStep
          onBegin={() => {
            // The one gesture the whole screen's responsiveness rests on.
            tts.unlock()
            setStep('focus')
          }}
        />
      )}

      {step === 'focus' && (
        <FocusStep
          onChoose={(chosen) => {
            setFocus(chosen)
            setText(chosen.lines[0])
            setStep('affirmation')
          }}
        />
      )}

      {step === 'affirmation' && focus && (
        <AffirmationStep
          focus={focus}
          style={style}
          value={text}
          onChange={setText}
          onContinue={() => setStep('voice')}
        />
      )}

      {step === 'voice' && (
        <VoiceStep
          style={style}
          onStyleChange={setStyle}
          onBegin={begin}
          beginning={beginning}
        />
      )}
    </OnboardingFrame>
  )
}
