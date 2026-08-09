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
 * It is also, on its own, not enough, and this is where the first attempt at
 * this fix stopped. `navigator.audioSession` is implemented by Safari alone,
 * it arrived in 16.4 with only *part* of it enabled and the rest behind an
 * experimental feature flag, and on a phone where it is missing or inert the
 * assignment above is a silent no-op — the property is set, nothing changes,
 * and the mix stays on the ringer channel exactly as before. Which is the bug
 * being reported for the second time.
 *
 * So there is a second, older mechanism underneath it, and on iOS it always
 * runs rather than being skipped when the API *claims* to have worked:
 * `claimMediaChannel()` keeps a silent `<audio>` element playing for as long
 * as the app means to make a sound. An `HTMLMediaElement` is categorised as
 * media playback rather than as ambient noise, and while one is playing the
 * page's Web Audio goes out over the same route — so the ambience, the rhythm
 * and the breath cues become as audible as a podcast is, silent switch or not.
 * It is a hack, it is the hack every audio library on the web has converged
 * on, and the honest reason it is here is that the standard answer does not
 * yet work on the phones people actually have.
 *
 * The visible cost is a lock-screen media widget while a session is running,
 * which for a thirty-minute spoken loop is arguably where it belongs.
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

/* ── The media channel ──────────────────────────────────────── */

/**
 * Only iOS files Web Audio under a category the silent switch can mute, so
 * only iOS pays for the workaround. Everywhere else a permanently-playing
 * media element would buy nothing and cost a lock-screen widget and the
 * hardware media keys.
 *
 * iPadOS reports itself as a Mac, hence the touch-points test — the same one
 * `detectPlatform` uses, kept local so this module stays free of imports it
 * would only need for one line.
 */
function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  if (/iP(hone|ad|od)/.test(navigator.userAgent)) return true
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
}

let channel: HTMLAudioElement | null = null
let channelWanted = false

/**
 * A fraction of a second of digital silence, built rather than shipped.
 *
 * It has to be a real, decodable file: iOS decides how to route a page's audio
 * from what an element is actually playing, and an element with no source is
 * an element playing nothing. Constructing forty-four bytes of header and a
 * run of zero samples is smaller than the base64 of the same thing and far
 * easier to read than either.
 *
 * Full rate and full bit depth on purpose. The route is chosen from the media
 * being played, and there is no reason to hand the platform something that
 * looks like a notification blip.
 */
export function silentWavBytes(seconds = 0.4): ArrayBuffer {
  const rate = 44100
  const frames = Math.round(rate * seconds)
  const dataBytes = frames * 2
  const buffer = new ArrayBuffer(44 + dataBytes)
  const view = new DataView(buffer)

  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) {
      view.setUint8(offset + i, text.charCodeAt(i))
    }
  }

  ascii(0, 'RIFF')
  view.setUint32(4, 36 + dataBytes, true)
  ascii(8, 'WAVE')
  ascii(12, 'fmt ')
  view.setUint32(16, 16, true) // PCM header length
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, rate, true)
  view.setUint32(28, rate * 2, true) // byte rate
  view.setUint16(32, 2, true) // block align
  view.setUint16(34, 16, true) // bits per sample
  ascii(36, 'data')
  view.setUint32(40, dataBytes, true)
  // The samples themselves are already zero, which is what silence is.

  return buffer
}

/**
 * Split from the bytes above so the file itself can be handed to a decoder in
 * a test. A silent track that is silent because the browser could not parse it
 * would look exactly like one that works, right up until the phone.
 */
function silentTrackUrl(): string {
  return URL.createObjectURL(
    new Blob([silentWavBytes()], { type: 'audio/wav' }),
  )
}

/**
 * Hold the page on the media audio route.
 *
 * Must be reached from a user gesture the first time, exactly like starting an
 * `AudioContext` — which it is, because both are called from the same press.
 */
export function claimMediaChannel(): void {
  if (!isIOS() || typeof document === 'undefined') return

  if (!channel) {
    const element = document.createElement('audio')
    element.src = silentTrackUrl()
    element.loop = true
    element.preload = 'auto'
    // Never full-screen this, and never let it near the accessibility tree.
    element.setAttribute('playsinline', '')
    element.setAttribute('aria-hidden', 'true')
    element.volume = 1

    /*
     * In the document, not merely constructed.
     *
     * A detached media element plays perfectly well on a desktop, which is
     * exactly what makes this an easy thing to leave out and never notice.
     * iOS decides a page's audio route from the media it is actually
     * presenting, and an element that is not in the document is not
     * presenting anything — so the route never moves and the whole workaround
     * silently buys nothing. Kept out of layout rather than `display: none`,
     * because a hidden media element is a media element some browsers feel
     * entitled to stop.
     */
    element.style.cssText =
      'position:fixed;width:0;height:0;opacity:0;pointer-events:none;left:-1px;top:-1px'
    document.body.appendChild(element)

    /*
     * iOS pauses the element when a call arrives or the app goes away, and it
     * does not start it again. The same three signals `keepAwake` watches for
     * the context serve here — and they have to, because a context that is
     * running on the ringer channel is not much better than one that is not
     * running at all.
     */
    const recover = () => {
      if (channelWanted && channel?.paused) {
        void channel.play().catch(() => undefined)
      }
    }
    element.addEventListener('pause', recover)
    document.addEventListener('visibilitychange', recover)
    window.addEventListener('pointerdown', recover, { passive: true })
    window.addEventListener('touchstart', recover, { passive: true })

    channel = element
  }

  /*
   * The flag is set by *success*, not by the request, and that ordering is
   * what keeps this honest.
   *
   * The breath's voice builds its context the moment the player mounts — long
   * before anyone has pressed anything — so this is reached without a gesture
   * behind it, and `play()` is refused. Arming the recovery on the request
   * would then mean the first stray tap anywhere on the page started a silent
   * track, and put a lock-screen widget on a session nobody had begun. Setting
   * it here means recovery is only ever armed by a play that actually
   * happened, which is only ever one a gesture allowed.
   */
  channel
    .play()
    .then(() => {
      channelWanted = true
    })
    .catch(() => undefined)
}

/**
 * Let the route go.
 *
 * Called when the app stops meaning to make a sound, so a paused or finished
 * session does not leave a lock-screen widget behind claiming otherwise.
 */
export function releaseMediaChannel(): void {
  channelWanted = false
  channel?.pause()
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
