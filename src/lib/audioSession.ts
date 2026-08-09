/**
 * Keeping the app's audio audible on a phone.
 *
 * Two things go wrong on mobile that never go wrong on a desktop, and they
 * share a symptom that makes them easy to misread: the affirmation is spoken
 * perfectly and *everything else* — the ambience, the brainwave rhythm, the
 * breath cues — is silent. Every one of those runs through Web Audio, and the
 * voice does not: speech synthesis renders outside the page entirely. So when
 * only the voice survives, the thing that has failed is the `AudioContext`.
 *
 * ── 1. The silent switch ──
 *
 * By default iOS files a page's Web Audio under the `ambient` audio session
 * category, which is muted by the hardware ring/silent switch and by Silent
 * Mode. `SpeechSynthesis` is not: it goes out over the system speech route and
 * ignores the switch completely. A phone on silent therefore plays the words
 * and none of the sound around them — precisely the report — and no amount of
 * turning the Sound slider up makes any difference, because the mix is being
 * muted after this app is finished with it.
 *
 * The Audio Session API is the supported answer. Declaring `playback` says
 * "this is primary media content, not an interface noise", which is honestly
 * what a thirty-minute affirmation loop is, and it plays through the silent
 * switch the same way a podcast does. It is only claimed when someone has
 * actually asked for sound — never on load.
 *
 * ── 2. The interrupted context ──
 *
 * iOS has a fourth `AudioContext.state` that the specification does not:
 * `interrupted`. A call, an alarm, another app taking the audio route, or the
 * screen locking can all leave a context there, and it does not come back on
 * its own. Code that resumes only when the state is `suspended` — which is the
 * obvious thing to write, and what this app used to do — steps straight past
 * it, and the session plays on with a running clock, a moving orb, a spoken
 * voice, and no sound. `wake()` resumes anything that is not already running
 * and is not closed, which covers the documented states and that one.
 *
 * `keepAwake()` then watches for it happening again: on the context's own
 * `statechange`, on coming back to the page, and — as the last resort, because
 * some interruptions are only clearable inside a gesture — on the next touch.
 */

interface AudioSessionCapableNavigator extends Navigator {
  audioSession?: { type: string }
}

/**
 * A context in a state the specification does not name.
 *
 * `AudioContextState` is `suspended | running | closed`, so `interrupted` has
 * to be admitted by hand rather than compared against — TypeScript is right
 * that it cannot happen, and Safari does it anyway.
 */
type ContextState = AudioContextState | 'interrupted'

/**
 * Ask the platform to treat this app's sound as media rather than as interface
 * noise, so the hardware silent switch does not mute it.
 *
 * Safe to call repeatedly and safe to call anywhere: every browser that does
 * not implement the API simply has no `audioSession` to assign to, and every
 * browser that does not have a silent switch is unaffected by the category.
 */
export function claimPlaybackSession(): void {
  if (typeof navigator === 'undefined') return
  const session = (navigator as AudioSessionCapableNavigator).audioSession
  if (!session) return
  try {
    // Only ever widened, never narrowed: if something has already asked for
    // `play-and-record` for the voice recorder, taking it back to `playback`
    // here would drop the microphone out from under it.
    if (session.type === 'auto' || session.type === 'ambient') {
      session.type = 'playback'
    }
  } catch {
    /* Read-only in some builds. Nothing here is worth an exception. */
  }
}

/**
 * Hand the audio route back after recording.
 *
 * Asking for a microphone puts iOS into `play-and-record`, which stays there
 * once the stream is closed — and while it does, playback is quieter and can
 * come out of the earpiece rather than the speaker. `claimPlaybackSession()`
 * deliberately will not widen out of that category, because doing so while a
 * recording is live would take the microphone away mid-take. So the recorder
 * says when it is finished, and this is that.
 */
export function releaseRecordingSession(): void {
  if (typeof navigator === 'undefined') return
  const session = (navigator as AudioSessionCapableNavigator).audioSession
  if (!session) return
  try {
    if (session.type === 'play-and-record') session.type = 'playback'
  } catch {
    /* Read-only in some builds. */
  }
}

/** Resume a context that is suspended, interrupted, or otherwise not running. */
export function wake(ctx: AudioContext | null | undefined): void {
  if (!ctx) return
  const state = ctx.state as ContextState
  if (state === 'running' || state === 'closed') return
  void ctx.resume().catch(() => undefined)
}

/**
 * Keep a context running for as long as it exists — unless the app has parked
 * it on purpose.
 *
 * That second clause is the whole subtlety. Pausing a session suspends the bus
 * deliberately, because a suspended context stops advancing `currentTime` and
 * so every oscillator resumes at exactly the phase it held. A recovery watcher
 * that cannot tell that apart from an iOS interruption will see the
 * `statechange`, helpfully resume, and the ambience will play straight through
 * a paused session. So the caller says when the context is *meant* to be
 * running, and nothing here second-guesses it.
 *
 * Returns a teardown function. Attaching twice to the same context is harmless
 * but wasteful, so callers hold on to it — see `AudioBus`.
 */
export function keepAwake(
  ctx: AudioContext,
  shouldRun: () => boolean = () => true,
): () => void {
  const recover = () => {
    if (shouldRun()) wake(ctx)
  }

  ctx.addEventListener('statechange', recover)

  // Everything below is a browser affordance. The context's own `statechange`
  // is the part that works anywhere, including under a test runner with no DOM.
  const hasDom = typeof document !== 'undefined' && typeof window !== 'undefined'

  const onVisibility = () => {
    if (document.visibilityState === 'visible') recover()
  }

  if (hasDom) {
    document.addEventListener('visibilitychange', onVisibility)
    /*
     * A gesture is the one thing that can clear an interruption a browser will
     * not clear by itself. This never intercepts anything — it is passive, it
     * only ever calls `resume()`, and on a context that is already running it
     * returns immediately.
     */
    window.addEventListener('pointerdown', recover, { passive: true })
    window.addEventListener('touchstart', recover, { passive: true })
  }

  return () => {
    ctx.removeEventListener('statechange', recover)
    if (!hasDom) return
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('pointerdown', recover)
    window.removeEventListener('touchstart', recover)
  }
}
