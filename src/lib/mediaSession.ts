/**
 * The lock-screen widget, connected to the session it claims to be playing.
 *
 * `audioSession.ts` explains why a silent `<audio>` element is kept playing on
 * iOS: it is the only reliable way to move the page's Web Audio off the ringer
 * channel, so that the ambience, the brainwave rhythm and the breath cues
 * survive the hardware silent switch. It names the cost in one line — "a
 * lock-screen media widget while a session is running" — and then leaves it
 * there, which is the gap this file closes.
 *
 * Because until now that widget was decorative, and worse than decorative in
 * two specific ways:
 *
 *   1. It had nothing on it. `navigator.mediaSession.metadata` was never
 *      assigned anywhere in the app, so a locked phone showed the browser's
 *      fallback — a page title, no artwork — over what is meant to be a calm,
 *      finished thing. Someone's affirmation loop looked like a stray tab.
 *
 *   2. Its buttons lied. With no action handler registered, the platform falls
 *      back to driving the element it can see, which is forty milliseconds of
 *      silence on a loop. Pressing pause on a locked phone paused *that*: the
 *      widget redrew as paused, the ambience went with the media route, and
 *      the spoken voice — which never touches Web Audio and so never noticed —
 *      carried on talking. A pause button that does not pause the voice is the
 *      worst of the three possible behaviours, because it is the one that
 *      looks like it worked.
 *
 * So the widget is wired to the session's own verbs. `bindMediaControls` takes
 * play, pause and stop and puts them behind the platform's transport, which
 * also stops the platform driving the silent element on its own — a registered
 * handler replaces the default behaviour rather than running alongside it.
 * `publishNowPlaying` puts the loop's title and the app's icon on the glass.
 * `setMediaPlaybackState` keeps the widget's play/pause symbol honest about a
 * session that was paused from inside the app, or ended on its own timer.
 *
 * Everything here is guarded twice over: `navigator.mediaSession` is missing
 * entirely on older browsers, and on the ones that have it, individual actions
 * throw rather than being ignored when they are not supported. Nothing in this
 * file is load-bearing for sound — the session plays identically on a browser
 * with no Media Session API at all — so nothing in it is worth an exception.
 */

/** What the widget's play/pause symbol should be showing. */
export type MediaPlaybackState = 'none' | 'paused' | 'playing'

/** The three verbs a lock screen can ask a session for. */
export interface MediaControls {
  play: () => void
  pause: () => void
  stop: () => void
}

/** What the glass says. */
export interface NowPlaying {
  /** The loop's own name, which is what the person recognises. */
  title: string
  /** The line beneath it: what this session is, in a few words. */
  artist: string
}

/**
 * The album line, and the one piece of text here that never varies.
 *
 * A media widget has three text slots and shows all three; leaving one empty
 * on iOS closes the gap up and leaves the layout looking clipped rather than
 * sparse. The app's name is the honest thing to put there.
 */
const APP_NAME = 'Manifester'

interface MediaSessionLike {
  metadata: MediaMetadata | null
  playbackState: MediaPlaybackState
  setActionHandler: (action: string, handler: (() => void) | null) => void
  setPositionState?: (state?: {
    duration: number
    playbackRate?: number
    position?: number
  }) => void
}

/**
 * Cast through `unknown` rather than widening `Navigator`.
 *
 * The DOM library declares `mediaSession` as always present and always a full
 * `MediaSession`, which is true of the type and false of the phones: it is
 * absent on older Android browsers and on every desktop Safari before 15, and
 * `setPositionState` is missing from implementations that otherwise have the
 * rest. An interface extending `Navigator` cannot make a required property
 * optional again, so the honest shape is described here and reached for
 * directly.
 */
function session(): MediaSessionLike | null {
  if (typeof navigator === 'undefined') return null
  const media = (navigator as unknown as { mediaSession?: MediaSessionLike })
    .mediaSession
  return media ?? null
}

/**
 * The app icon, at every size a platform might reach for.
 *
 * Absolute rather than relative on purpose. The widget is drawn by the
 * operating system out of process, and a bare `icons/icon-512.png` has no
 * document to be relative to by the time it gets there — it either resolves
 * against the wrong base or does not resolve at all, and an artwork that fails
 * to load is indistinguishable from the artwork never having been set. Built
 * from `BASE_URL` so a deploy under a sub-path still finds its own icons.
 */
function artwork(): MediaImage[] {
  if (typeof location === 'undefined') return []
  const base = import.meta.env?.BASE_URL ?? '/'
  const absolute = (path: string) => new URL(`${base}${path}`, location.href).href
  return [
    { src: absolute('icons/icon-192.png'), sizes: '192x192', type: 'image/png' },
    { src: absolute('icons/icon-512.png'), sizes: '512x512', type: 'image/png' },
  ]
}

/**
 * Actions this app deliberately does not offer.
 *
 * Registering nothing is not the same as registering `null`. iOS fills the
 * unclaimed slots with its own defaults — a fifteen-second skip pair, a track
 * scrubber — and points them at the media element it can see, which is the
 * silent track. The result is a widget offering to seek through forty
 * milliseconds of nothing, next to a progress bar that is not about the
 * session. Explicitly declining each one is what removes it from the glass.
 *
 * A loop has no next track and nowhere meaningful to scrub to: it is one set
 * of words, said again. Play, pause and stop is the whole vocabulary.
 */
const DECLINED = [
  'seekbackward',
  'seekforward',
  'seekto',
  'previoustrack',
  'nexttrack',
] as const

/** Every action this module ever touches, so unbinding can undo all of it. */
const CLAIMED = ['play', 'pause', 'stop', ...DECLINED] as const

/**
 * Set one handler, and shrug if the platform has never heard of the action.
 *
 * Unsupported actions throw a `TypeError` rather than being ignored, and the
 * set of supported ones differs between Safari, Chrome and every version of
 * both — so each one is attempted on its own and a refusal costs nothing.
 */
function claim(action: string, handler: (() => void) | null): void {
  const media = session()
  if (!media) return
  try {
    media.setActionHandler(action, handler)
  } catch {
    /* Not an action this browser knows. Nothing to do and nothing to say. */
  }
}

/**
 * Put the session's own play, pause and stop behind the lock-screen transport.
 *
 * Pass `null` to hand the controls back, which is what teardown does.
 *
 * Handlers are registered for the life of the provider rather than only while
 * a session runs, and that is deliberate: the widget outlives the moment it
 * was created — a phone that has been locked for twenty minutes is showing
 * whatever was on the glass when it locked — and a button that has quietly
 * unbound itself in the meantime falls back to driving the silent element
 * again, which is the exact bug this file exists to remove. The handlers
 * themselves are the ones that know a session is not running.
 */
export function bindMediaControls(controls: MediaControls | null): void {
  if (!session()) return

  if (!controls) {
    for (const action of CLAIMED) claim(action, null)
    return
  }

  claim('play', controls.play)
  claim('pause', controls.pause)
  claim('stop', controls.stop)
  /*
   * `pause` twice, under both names. iOS routes a headphone pinch, a car
   * stereo's play/pause and a Bluetooth remote through `pause`, but a few
   * surfaces — notably the Now Playing widget in older builds — send
   * `togglemicrophone`-style single-button events as `playpause` instead, and
   * a slot left unclaimed goes back to the silent element.
   */
  claim('playpause', () => {
    if (session()?.playbackState === 'playing') controls.pause()
    else controls.play()
  })

  for (const action of DECLINED) claim(action, null)
}

/**
 * Name what is playing.
 *
 * `null` clears the glass, which is what the end of a session should do: a
 * widget still advertising a loop that finished ten minutes ago is a small
 * lie, and the person who unlocks their phone and taps play on it deserves
 * better than a stale title.
 */
export function publishNowPlaying(now: NowPlaying | null): void {
  const media = session()
  if (!media) return
  if (typeof MediaMetadata === 'undefined') return

  if (!now) {
    try {
      media.metadata = null
    } catch {
      /* Assigning metadata is not something to fail a session over. */
    }
    return
  }

  try {
    media.metadata = new MediaMetadata({
      title: now.title,
      artist: now.artist,
      album: APP_NAME,
      artwork: artwork(),
    })
  } catch {
    /* Older constructors reject fields they do not know. */
  }
}

/**
 * Keep the widget's play/pause symbol honest.
 *
 * The platform will guess from the silent element if nothing says otherwise,
 * and its guess is about the wrong thing entirely — which is how a session
 * paused inside the app went on showing a pause button on the lock screen.
 */
export function setMediaPlaybackState(state: MediaPlaybackState): void {
  const media = session()
  if (!media) return
  try {
    media.playbackState = state
  } catch {
    /* Read-only in some builds. */
  }
}

/**
 * The progress bar, for a session that has somewhere to get to.
 *
 * Only a timed session has a duration worth drawing: an open-ended loop runs
 * until somebody stops it, and a bar creeping towards an end that does not
 * exist would be inventing one. Pass `null` for those and the platform draws
 * the widget without a timeline, the way it does for live radio.
 *
 * The clamp is not defensive tidiness. `setPositionState` throws a `TypeError`
 * when the position is past the duration, and the last tick of a timer can
 * land a rounded elapsed a hair beyond a rounded total — which would throw on
 * precisely the update that matters most.
 */
export function setMediaPosition(
  elapsedSeconds: number,
  durationSeconds: number | null,
): void {
  const media = session()
  if (!media?.setPositionState) return
  try {
    if (durationSeconds == null || !Number.isFinite(durationSeconds) || durationSeconds <= 0) {
      media.setPositionState()
      return
    }
    media.setPositionState({
      duration: durationSeconds,
      position: Math.min(Math.max(elapsedSeconds, 0), durationSeconds),
      // Never zero: a rate of zero is how a stalled stream is described, and
      // some platforms redraw the bar as broken rather than as paused. A
      // paused session is described by `playbackState`, which is its job.
      playbackRate: 1,
    })
  } catch {
    /* An implementation that dislikes these numbers simply gets no bar. */
  }
}

/**
 * Take everything down: no metadata, no transport, no state.
 *
 * Used on teardown rather than at the end of a session — a finished session
 * still wants its handlers, so that the play button on a widget the phone has
 * not redrawn yet starts the loop again instead of the silent track.
 */
export function clearMediaSession(): void {
  publishNowPlaying(null)
  setMediaPlaybackState('none')
  setMediaPosition(0, null)
  bindMediaControls(null)
}
