/**
 * The soundtrack, as the rest of the app is allowed to see it.
 *
 *     soundtrack.attach(bus)          // once, from the provider that owns it
 *     soundtrack.begin()              // from a real tap: this is what starts it
 *     soundtrack.setScene('shaping')  // the route and the session, combined
 *     soundtrack.setDucked(true)      // a voice is speaking
 *
 * ── What this is for ──
 *
 * A quiet layer under the whole app that changes with what somebody is doing
 * and is never, at any point, a thing they operate. There is no transport, no
 * track list and no "now playing"; the only controls are on and how loud, and
 * they live in a panel most people will never open. If it is working, nobody
 * thinks about it.
 *
 * ── The rules it keeps ──
 *
 * **Nothing on load.** Browsers refuse audio outside a gesture, and would be
 * right to: arriving at a page that starts playing music is the web at its
 * worst. So `begin()` is reached from the same taps that already open the
 * audio hardware for the voice — the Begin button, pressing play — and until
 * one of them happens this does nothing at all. Somebody who has deliberately
 * turned the music on before is met halfway: their first touch anywhere starts
 * it again, because they have already answered the question.
 *
 * **One piece at a time.** Scenes crossfade over `CROSSFADE_SECONDS`; a scene
 * that changes twice in that window crossfades from wherever the first one had
 * reached rather than stacking a third voice on the first two. Every fade is
 * anchored at the value the gain has actually arrived at, so no sequence of
 * navigations, mutes and ducks can race into a level nobody asked for.
 *
 * **Its own channel.** The music has its own branch of the bus, its own
 * ceiling and its own volume — see `audioBus.ts`. Turning the ambience down
 * does not turn the music down, and ducking under a spoken line does not touch
 * either.
 *
 * **Where it came from.** Leaving a scene remembers how far into the piece it
 * had got, so walking to the library and back is one continuous piece rather
 * than two visits to its opening.
 */

import type { AudioBus } from '../audioBus'
import { fadeParam } from '../audioParams'
import { onHeartbeat, scheduleIn } from '../heartbeat'
import { BufferLibrary } from './buffers'
import { LoopVoice } from './loop'
import { likelyNextTrack, trackForScene, type SoundtrackScene } from './scene'
import { findTrack, type SoundtrackTrackId } from './tracks'

/**
 * The loudest the music is ever allowed to be, as a fraction of full scale.
 *
 * The slider reads 0–100% of *this*, not of the hardware. These files are
 * mastered to within a decibel of full scale, so at the default level of 40%
 * the music peaks around 0.12 — the "you can hear it if you listen for it"
 * that the design asks for — and even somebody who pushes the slider to the
 * top lands well under the spoken voice, which does not pass through here and
 * is not attenuated by anything.
 */
export const MAX_SOUNDTRACK_GAIN = 0.3

/** Where the slider starts: about 12% of full scale. */
export const DEFAULT_SOUNDTRACK_LEVEL = 0.4

/** How long one piece takes to become another. */
const CROSSFADE_SECONDS = 2.5
/** Muting and unmuting: shorter, because it is an answer to a press. */
const MUTE_FADE_SECONDS = 0.8
/** Arriving for the first time, which should feel like the room settling. */
const ENTRY_FADE_SECONDS = 3
/** Leaving because the page went away. */
const HIDDEN_FADE_SECONDS = 1.2

/**
 * How long a new scene has to hold before the music acts on it.
 *
 * Scenes are made of two moving parts — the route and the session — and they
 * do not always change on the same render. Pressing Start on the editor puts
 * the app on the player a beat before the session reports itself as playing,
 * so for one frame the honest answer is "the player, idle", which is the
 * threshold and a different piece. Acting on that would crossfade to a piece
 * for a third of a second and then crossfade away from it.
 *
 * A short settle removes the whole class of them — that one, a route that
 * redirects, and somebody tapping through four tabs looking for something —
 * without ever being felt: it is a sixth of the crossfade it precedes.
 */
const SCENE_SETTLE_MS = 400

/**
 * How far the music steps back under a spoken line, and how quickly.
 *
 * A third of its level is enough that the words sit clearly on top and little
 * enough that the room does not disappear from under them. The attack is
 * deliberately slower than a limiter's — this is not gain control, it is the
 * music making space — and the recovery is slower still, so the end of a line
 * is not a swell.
 */
const DUCK_LEVEL = 0.3
const DUCK_ATTACK_SECONDS = 0.4
const DUCK_RELEASE_SECONDS = 1.8

/**
 * How long the duck is held after a line finishes, before it starts to lift.
 *
 * Without this the music would swell between every phrase of an affirmation
 * and step back again a second later, which is far more noticeable than simply
 * staying quiet — the same reason the interface cues duck on the session
 * rather than on the utterance, in `feedback.ts`.
 *
 * Sized to bridge the gaps *inside* a repetition and not the one between them:
 * the pause between loops is three seconds by default and is a composed part
 * of the ritual, so the music is meant to come back up and fill it.
 */
const DUCK_HOLD_MS = 1200

/** The name this holds the bus open under. See `AudioBus.hold`. */
const HOLD_ID = 'soundtrack'

export interface SoundtrackStatus {
  /** What is sounding, if anything. */
  track: SoundtrackTrackId | null
  /** Its title, for the expanded settings panel and nowhere else. */
  title: string | null
  /** True once a gesture has opened the audio and something is playing. */
  playing: boolean
}

interface Playing {
  id: SoundtrackTrackId
  voice: LoopVoice
}

const IDLE: SoundtrackStatus = { track: null, title: null, playing: false }

class Soundtrack {
  private bus: AudioBus | null = null
  private library = new BufferLibrary(() => this.bus?.context ?? null)

  /** Narration ducking, then the user's level. Built with the first voice. */
  private duck: GainNode | null = null
  private level: GainNode | null = null

  private playing: Playing | null = null
  private leaving = new Set<Playing>()
  /** The piece being decoded on its way in, protected before it arrives. */
  private incoming: SoundtrackTrackId | null = null
  /** What the prefetch has been asked for, so the cache can protect it. */
  private queued: SoundtrackTrackId | null = null
  /** Where each piece had got to when it was last left. */
  private phases = new Map<SoundtrackTrackId, number>()

  /** The scene the music is actually playing for. */
  private scene: SoundtrackScene | null = null
  /** The scene the app has most recently reported, before it has settled. */
  private pendingScene: SoundtrackScene | null = null
  private sceneSettle: (() => void) | null = null
  private enabled = true
  private chosen = false
  private userLevel = DEFAULT_SOUNDTRACK_LEVEL
  /**
   * What is currently asking the music to step back.
   *
   * Named sources rather than a boolean, because there is more than one voice
   * in this app — the affirmation being spoken, and somebody auditioning the
   * recording they just made — and two callers sharing one flag is how the
   * music ends up ducked forever after the second one stops.
   */
  private ducking = new Set<string>()
  private ducked = false
  /** Cancels a duck release that is waiting out `DUCK_HOLD_MS`. */
  private duckRelease: (() => void) | null = null
  /** True once a gesture has opened the audio hardware. */
  private started = false
  private hidden = false
  private recording = false
  /** True while a session is actually playing, which changes the hidden rule. */
  private listening = false

  /** Bumped by every change of intent, so a slow decode cannot arrive late. */
  private generation = 0
  private detachHeartbeat: (() => void) | null = null
  private detachGesture: (() => void) | null = null
  private detachVisibility: (() => void) | null = null

  private listeners = new Set<(status: SoundtrackStatus) => void>()
  private status: SoundtrackStatus = IDLE

  /* ── Wiring ───────────────────────────────────────────────── */

  /**
   * Hand the soundtrack the app's one `AudioContext`, exactly as the voice
   * layer is handed it. Idempotent; the bus outlives this.
   */
  attach(bus: AudioBus): void {
    if (this.bus === bus) return
    this.bus = bus
    this.duck = null
    this.level = null
  }

  subscribe(listener: (status: SoundtrackStatus) => void): () => void {
    this.listeners.add(listener)
    listener(this.status)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /**
   * What is sounding right now, without waiting to be told.
   *
   * For the first render of a panel that has only just been mounted:
   * subscribing delivers the same answer, but a render later, and the panel
   * would spend that render saying nothing is playing while something is.
   */
  getStatus(): SoundtrackStatus {
    return this.status
  }

  /* ── What the person has chosen ───────────────────────────── */

  /**
   * Whether there is music at all, and whether that is a decision or a
   * default.
   *
   * `chosen` is why both arrive together. Somebody who has deliberately turned
   * the music on has answered the "may this page make a sound" question, and
   * their next visit can start it on their first touch rather than making them
   * find the switch again. Somebody who has never touched it gets the design's
   * answer — on, but only from a press that was already about starting
   * something.
   */
  setEnabled(enabled: boolean, chosen = this.chosen): void {
    const changed = this.enabled !== enabled
    this.enabled = enabled
    this.chosen = chosen

    if (enabled && chosen) this.armFirstGesture()
    if (!changed) return
    this.apply(MUTE_FADE_SECONDS)
  }

  /** 0–1, against `MAX_SOUNDTRACK_GAIN`. */
  setLevel(value: number): void {
    this.userLevel = Math.min(1, Math.max(0, value))
    this.applyLevel(0.18)
  }

  /* ── What the app is doing ────────────────────────────────── */

  /**
   * The scene, or `null` to hold whatever is playing. See `scene.ts`.
   *
   * Safe to call on every render: an unchanged scene is free, and a scene that
   * changes twice inside `SCENE_SETTLE_MS` produces one crossfade rather than
   * two. Through the heartbeat rather than a plain timer for the reason
   * everything in this app is: a throttled tab must not be able to strand the
   * music on a scene the person has already left.
   */
  setScene(scene: SoundtrackScene | null): void {
    if (scene === null || scene === this.pendingScene) return
    this.pendingScene = scene

    this.sceneSettle?.()
    this.sceneSettle = scheduleIn(SCENE_SETTLE_MS, () => {
      this.sceneSettle = null
      this.commitScene(CROSSFADE_SECONDS)
    })
  }

  private commitScene(fadeSeconds: number): void {
    if (this.pendingScene === null || this.pendingScene === this.scene) return
    this.scene = this.pendingScene
    this.apply(fadeSeconds)
  }

  /**
   * Step the music back while something is being spoken.
   *
   * Its own gain node, so this can arrive in the middle of a crossfade, a
   * volume drag or a mute without any of them fighting: each one owns a
   * different node, and all four ramps are anchored at the value their param
   * has actually reached.
   */
  setDucked(ducked: boolean, source = 'voice'): void {
    if (ducked) this.ducking.add(source)
    else this.ducking.delete(source)

    const wanted = this.ducking.size > 0

    // Whatever happens next, a release that was waiting is no longer the
    // answer. Cancelling first is what makes rapid play, pause and voice
    // changes safe: there is only ever one pending decision.
    this.duckRelease?.()
    this.duckRelease = null

    if (wanted) {
      this.ducked = true
      this.rampDuck()
      return
    }
    if (!this.ducked) return

    // Through the heartbeat rather than a plain timer: a hidden tab clamps
    // `setTimeout` to a second and then to a minute, and the music coming back
    // a minute after somebody stopped speaking is not a subtlety.
    this.duckRelease = scheduleIn(DUCK_HOLD_MS, () => {
      this.duckRelease = null
      this.ducked = false
      this.rampDuck()
    })
  }

  private rampDuck(): void {
    const ctx = this.bus?.context
    if (!ctx || !this.duck) return
    fadeParam(
      this.duck.gain,
      this.ducked ? DUCK_LEVEL : 1,
      this.ducked ? DUCK_ATTACK_SECONDS : DUCK_RELEASE_SECONDS,
      ctx.currentTime,
    )
  }

  /**
   * Whether a microphone is open.
   *
   * The one place silence is deliberate. Recording your own voice puts the
   * room into the take, and this is the only thing in the app loud enough for
   * that to matter — so it leaves entirely, and comes back when the recorder
   * closes. Not a scene, because it is true of the hardware rather than of
   * where somebody is standing.
   */
  setRecording(recording: boolean): void {
    if (this.recording === recording) return
    this.recording = recording
    this.apply(MUTE_FADE_SECONDS)
  }

  /**
   * Whether a session is actually running.
   *
   * Only used to decide what a hidden page means. A phone that has locked
   * during a session is somebody listening with their eyes shut, and stopping
   * the music then would be the app misreading the whole point of itself. A
   * hidden tab with nothing running is a tab somebody has left, and music from
   * one of those is the web being rude.
   */
  setListening(listening: boolean): void {
    if (this.listening === listening) return
    this.listening = listening
    if (this.hidden) this.apply(HIDDEN_FADE_SECONDS)
  }

  /**
   * Open the audio and start, from inside a user gesture.
   *
   * Safe to call on every tap — this is reached from `prime()`, which the app
   * already calls from every press that could lead to a sound.
   */
  begin(): void {
    if (this.started) return
    this.started = true
    this.watchVisibility()
    /*
     * Arriving does not wait out the settle. This is a press, the scene has
     * been sitting there since the shell mounted, and a third of a second of
     * silence after somebody asks for something is a third of a second of
     * wondering whether the button worked.
     */
    this.sceneSettle?.()
    this.sceneSettle = null
    if (this.pendingScene) this.scene = this.pendingScene
    this.apply(ENTRY_FADE_SECONDS)
  }

  /** Everything: sources, timers, listeners, buffers. */
  dispose(): void {
    this.generation += 1
    this.duckRelease?.()
    this.duckRelease = null
    this.sceneSettle?.()
    this.sceneSettle = null
    this.ducking.clear()
    this.playing?.voice.dispose()
    this.playing = null
    for (const leaving of this.leaving) leaving.voice.dispose()
    this.leaving.clear()
    this.incoming = null
    this.queued = null
    this.stopHeartbeat()
    this.detachGesture?.()
    this.detachGesture = null
    this.detachVisibility?.()
    this.detachVisibility = null
    this.bus?.releaseHold(HOLD_ID)
    this.library.clear()
    try {
      this.duck?.disconnect()
      this.level?.disconnect()
    } catch {
      /* Already released. */
    }
    this.duck = null
    this.level = null
    this.started = false
    this.publish(IDLE)
  }

  /* ── The machine ──────────────────────────────────────────── */

  /** What should be sounding right now, or `null` for silence. */
  private wanted(): SoundtrackTrackId | null {
    if (!this.started || !this.enabled || !this.scene) return null
    if (this.recording) return null
    // A hidden page with nothing playing has nobody in front of it.
    if (this.hidden && !this.listening) return null
    return trackForScene(this.scene)
  }

  private apply(fadeSeconds: number): void {
    const bus = this.bus
    if (!bus || !this.started) return

    const wanted = this.wanted()
    if (wanted === this.playing?.id) return

    this.generation += 1
    const generation = this.generation

    if (this.playing) this.retire(this.playing, fadeSeconds)

    /*
     * The working set is declared *before* anything is fetched, not after.
     *
     * Both of these have to be protected from the moment the decision is made
     * rather than from the moment the music starts: the incoming piece,
     * because a decode that finishes while nothing is holding it can be
     * evicted by its own arrival; and the piece after it, because it is
     * usually still in the cache from an earlier scene and would otherwise be
     * thrown away a beat before being asked for again.
     */
    this.incoming = wanted
    const next = wanted && this.scene ? likelyNextTrack(this.scene) : null
    this.queued = next && next !== wanted && this.mayPrefetch() ? next : null
    this.keepWorkingSet()

    if (!wanted) {
      this.publish(IDLE)
      return
    }

    const ctx = this.context(bus)
    if (!ctx) return

    const ready = this.library.peek(wanted)
    if (ready) {
      this.enter(wanted, ready, fadeSeconds, generation)
      return
    }

    /*
     * Not decoded yet, so the fade in starts when it arrives rather than now.
     * The piece being left is already fading, which is what makes the wait
     * inaudible: the room empties on time and fills a moment later.
     */
    void this.library.load(wanted).then((buffer) => {
      if (generation !== this.generation || !buffer) return
      this.enter(wanted, buffer, fadeSeconds, generation)
    })
  }

  private enter(
    id: SoundtrackTrackId,
    buffer: AudioBuffer,
    fadeSeconds: number,
    generation: number,
  ): void {
    const bus = this.bus
    const ctx = bus ? this.context(bus) : null
    if (!bus || !ctx || generation !== this.generation) return

    /*
     * The hold comes first, before a single sample is scheduled.
     *
     * If a session is paused underneath, the context is not running and its
     * clock is stopped — so a voice started before the hold would schedule
     * everything against a frozen `currentTime` and arrive late. Holding wakes
     * the clock, and only then is there a meaningful "now" to start at.
     */
    bus.hold(HOLD_ID)

    const destination = this.mix(ctx, bus)
    if (!destination) return

    const voice = new LoopVoice(ctx, buffer, findTrack(id).loopSeconds)
    voice.output.connect(destination)
    voice.start(ctx.currentTime, this.phases.get(id) ?? 0)
    fadeParam(voice.output.gain, 1, fadeSeconds, ctx.currentTime)

    this.playing = { id, voice }
    this.incoming = null
    this.startHeartbeat()
    this.publish({ track: id, title: findTrack(id).title, playing: true })

    /*
     * And now the piece they are most likely to reach next, fetched with
     * nothing waiting on it — after this one is sounding rather than
     * alongside it, so a slow connection spends its bandwidth on the music
     * somebody is about to hear.
     */
    if (this.queued) this.library.prefetch(this.queued)
  }

  /** Everything the cache must not evict: playing, arriving, leaving, queued. */
  private keepWorkingSet(): void {
    const ids: SoundtrackTrackId[] = []
    if (this.playing) ids.push(this.playing.id)
    if (this.incoming) ids.push(this.incoming)
    for (const leaving of this.leaving) ids.push(leaving.id)
    if (this.queued) ids.push(this.queued)
    this.library.keep(ids)
  }

  /**
   * Whether warming the next piece up is a good trade here.
   *
   * Not on a metered connection, and not on a phone that has told us it is
   * short of memory: a hundred megabytes of decoded audio held for a
   * navigation somebody might not make is a bad bargain on a device that will
   * drop the tab for it. The crossfade there simply starts a moment later.
   */
  private mayPrefetch(): boolean {
    if (prefersReducedData()) return false
    const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
    return !(typeof memory === 'number' && memory > 0 && memory < 4)
  }

  private retire(playing: Playing, fadeSeconds: number): void {
    const ctx = this.bus?.context
    this.playing = null
    this.phases.set(playing.id, playing.voice.phaseSeconds)

    if (!ctx) {
      playing.voice.dispose()
      this.keepWorkingSet()
      return
    }

    fadeParam(playing.voice.output.gain, 0, fadeSeconds, ctx.currentTime)
    playing.voice.stop(fadeSeconds)
    this.leaving.add(playing)

    // A little after the fade, so nothing is torn down mid-ramp.
    setTimeout(
      () => {
        playing.voice.dispose()
        this.leaving.delete(playing)
        this.keepWorkingSet()
        // Nothing left playing: let the bus park properly if it wants to.
        if (!this.playing && this.leaving.size === 0) {
          this.bus?.releaseHold(HOLD_ID)
          this.stopHeartbeat()
        }
      },
      (fadeSeconds + 0.3) * 1000,
    )
  }

  /** The two nodes between every voice and the bus, built once. */
  private mix(ctx: AudioContext, bus: AudioBus): GainNode | null {
    const soundtrackNode = bus.soundtrackNode
    if (!soundtrackNode) return null

    if (!this.level) {
      this.level = ctx.createGain()
      this.level.gain.value = this.absoluteLevel()
      this.level.connect(soundtrackNode)
    }
    if (!this.duck) {
      this.duck = ctx.createGain()
      this.duck.gain.value = this.ducked ? DUCK_LEVEL : 1
      this.duck.connect(this.level)
    }
    return this.duck
  }

  /**
   * The shared context, without ever claiming to be the session.
   *
   * `AudioBus.ensure()` means "the app is about to make a sound on purpose"
   * and un-parks a session that has been paused. The music is not the session
   * and must never do that — so it only reaches for `ensure()` when there is
   * no context at all, which happens exactly once, inside the press that
   * starts everything. After that it takes what is there and asks `hold()` for
   * the clock, which wakes the context without pretending the pause is over.
   */
  private context(bus: AudioBus): AudioContext | null {
    return bus.context ?? bus.ensure()
  }

  private absoluteLevel(): number {
    return this.userLevel * MAX_SOUNDTRACK_GAIN
  }

  private applyLevel(seconds: number): void {
    const ctx = this.bus?.context
    if (!ctx || !this.level) return
    fadeParam(this.level.gain, this.absoluteLevel(), seconds, ctx.currentTime)
  }

  private startHeartbeat(): void {
    if (this.detachHeartbeat) return
    // One listener for however many voices are sounding. See `LoopVoice.tick`.
    this.detachHeartbeat = onHeartbeat(() => {
      this.playing?.voice.tick()
      for (const leaving of this.leaving) leaving.voice.tick()
    })
  }

  private stopHeartbeat(): void {
    this.detachHeartbeat?.()
    this.detachHeartbeat = null
  }

  /**
   * Start on the first touch, for somebody who has already said yes.
   *
   * Passive and once only. This never intercepts anything — it listens, starts
   * the music, and removes itself.
   */
  private armFirstGesture(): void {
    if (this.started || this.detachGesture || typeof window === 'undefined') return

    const onGesture = () => {
      this.detachGesture?.()
      this.detachGesture = null
      this.begin()
    }
    window.addEventListener('pointerdown', onGesture, { passive: true, once: true })
    window.addEventListener('keydown', onGesture, { once: true })
    this.detachGesture = () => {
      window.removeEventListener('pointerdown', onGesture)
      window.removeEventListener('keydown', onGesture)
    }
  }

  private watchVisibility(): void {
    if (this.detachVisibility || typeof document === 'undefined') return
    const onChange = () => {
      const hidden = document.visibilityState === 'hidden'
      if (hidden === this.hidden) return
      this.hidden = hidden
      this.apply(HIDDEN_FADE_SECONDS)
    }
    document.addEventListener('visibilitychange', onChange)
    this.detachVisibility = () =>
      document.removeEventListener('visibilitychange', onChange)
  }

  private publish(status: SoundtrackStatus): void {
    if (
      status.track === this.status.track &&
      status.playing === this.status.playing
    ) {
      return
    }
    this.status = status
    this.listeners.forEach((listener) => listener(status))
  }
}

/**
 * Whether the person has asked their browser to use less data.
 *
 * Respected for the *prefetch* rather than for the music itself: somebody who
 * pressed Begin asked for this experience and should get it, but nothing is
 * downloaded here on a guess about where they might go next.
 */
export function prefersReducedData(): boolean {
  if (typeof navigator === 'undefined') return false
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } })
    .connection
  return connection?.saveData === true
}

/**
 * One soundtrack for the whole app, for the reason `tts` is a singleton: the
 * thing it owns is one pair of speakers, and two of these would be two pieces
 * of music playing at once — which is the single most obvious way this feature
 * can fail.
 */
export const soundtrack = new Soundtrack()

export type { SoundtrackScene } from './scene'
export { sceneFor } from './scene'
export type { SoundtrackTrackId } from './tracks'
