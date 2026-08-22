/**
 * Owns the app's `AudioContext` and the generated-sound mix.
 *
 * Having one place responsible for creating, unlocking and suspending the
 * context means a session can pause every generated sound at once, and the
 * Sounds tab can audition a track on a completely separate context without
 * touching a live session.
 *
 * The mix has two sibling inputs — ambience and brainwave rhythm — so either
 * can be turned off without touching the other, while the user's single
 * "Sound volume" still governs both, up to `MAX_MUSIC_VOLUME`. Everything then
 * passes through one protective ceiling before the speakers:
 *
 *     ambience ─┐
 *               ├─→ generated (sound volume) ─→ ceiling ─→ master ─┐
 *      rhythm ──┘                                                  ├─→ output
 *                          soundtrack ─→ soundtrack ceiling ───────┘
 *
 * Two things reach the output without joining that sum, and for the same
 * reason in both cases: they are not part of the ritual's mix and must not be
 * governed by its volume.
 *
 * The spoken affirmation does not travel through here at all — speech
 * synthesis happens outside the page — so the voice is never squashed by the
 * ceiling and stays the clearest thing in the room.
 *
 * The soundtrack has its own branch and its own ceiling. Joining the generated
 * mix would tie the music to the Sound slider, which is a different control
 * about a different thing; worse, it would add level to the one path that has
 * to stay under `CEILING_LINEAR_TO` for the brainwave rhythm's channel
 * separation to survive. A separate branch keeps both promises: the music is
 * independently faded, ducked and muted, and the rhythm never notices it is
 * there. See `lib/soundtrack`.
 */

import { createSoftCeiling, fadeParam, rampParam } from './audioParams'
import {
  claimMediaChannel,
  claimPlaybackSession,
  keepAwake,
  releaseMediaChannel,
  wake,
} from './audioSession'
import { registerClockSource, releaseClockSource } from './heartbeat'

/** Short enough to feel immediate on a slider, long enough not to step. */
const RAMP_SECONDS = 0.12

/**
 * How long the ritual's mix takes to leave when a session is paused while
 * something else is still meant to be heard.
 *
 * Close to the fade a session's own sounds use, so a pause with the soundtrack
 * running sounds like the ambience stepping back rather than like a switch.
 */
const PARK_FADE_SECONDS = 0.5

/**
 * The ceiling for the "Sound" volume setting.
 *
 * Unlike the spoken voice, ambience and the brainwave rhythm are both fully
 * inside this app's own Web Audio graph, so there is no platform limit stopping
 * this from going past 1 — the soft-clip ceiling `createSoftCeiling` builds
 * below is what keeps the result from ever clipping, however loud the setting.
 */
export const MAX_MUSIC_VOLUME = 2

/**
 * A fixed boost applied to everything generated, on top of the user's setting.
 *
 * The mix was built conservatively and left most of its headroom unused: the
 * loudest soundscape at 100% peaked around 0.33 against a ceiling that stays
 * perfectly linear all the way to 0.7. That is roughly 6 dB of room nobody was
 * using, and it made the app feel quiet even with the slider at the top —
 * especially on a phone, where the ambience competes with a room.
 *
 * 1.5 is the largest boost that keeps normal listening *entirely inside* that
 * linear region, and staying inside it is not merely a nicety about
 * distortion. The ceiling is transparent below 0.7, which is what allows it to
 * sit in the path of a binaural pair without altering the channel separation
 * the beat depends on — see `createSoftCeiling`. Push ordinary content into
 * the knee and the brainwave rhythm is the thing that quietly degrades. So the
 * boost stops where transparency does; only someone deliberately at the very
 * top of the slider reaches the knee, and the ceiling guarantees even that
 * cannot clip.
 *
 * It lives here rather than in the presets so every generated source — every
 * ambience, the rhythm, and anything added later — gets it in one place.
 */
export const MUSIC_MAKEUP_GAIN = 1.5

export interface BusGraph {
  /** Final trim, wired to the context's output. */
  master: GainNode
  /** The arithmetic guarantee that nothing leaves above full scale. */
  ceiling: WaveShaperNode
  /** Carries the user's master sound volume. */
  generated: GainNode
  /** Where ambient soundscapes connect. */
  music: GainNode
  /** Where the brainwave rhythm connects. */
  rhythm: GainNode
  /** Where the adaptive soundtrack connects, outside the ritual's mix. */
  soundtrack: GainNode
  /** The soundtrack branch's own arithmetic guarantee. */
  soundtrackCeiling: WaveShaperNode
}

/**
 * Build the mix graph. Split out from the class so it can be rendered and
 * asserted on inside an `OfflineAudioContext`.
 */
export function buildBusGraph(
  ctx: BaseAudioContext,
  destination: AudioNode,
  soundVolume: number,
): BusGraph {
  const master = ctx.createGain()
  master.gain.value = 1
  master.connect(destination)

  const ceiling = createSoftCeiling(ctx)
  ceiling.connect(master)

  const generated = ctx.createGain()
  generated.gain.value = busGainFor(soundVolume)
  generated.connect(ceiling)

  const music = ctx.createGain()
  music.gain.value = 1
  music.connect(generated)

  const rhythm = ctx.createGain()
  rhythm.gain.value = 1
  rhythm.connect(generated)

  const soundtrackCeiling = createSoftCeiling(ctx)
  soundtrackCeiling.connect(destination)

  const soundtrack = ctx.createGain()
  soundtrack.gain.value = 1
  soundtrack.connect(soundtrackCeiling)

  return { master, ceiling, generated, music, rhythm, soundtrack, soundtrackCeiling }
}

export class AudioBus {
  private ctx: AudioContext | null = null
  private graph: BusGraph | null = null
  private musicLevel = 0.4
  /** Removes the listeners that keep the context running. */
  private release: (() => void) | null = null
  /**
   * True while the app has deliberately suspended the context — which is what
   * pausing a session does, so that `currentTime` stops and every oscillator
   * resumes on the phase it held. The recovery watcher reads this so it can
   * tell a pause from an interruption; without it, pausing would be undone by
   * the very `statechange` it causes.
   */
  private parked = false
  /**
   * Things outside the session that are still meant to be heard.
   *
   * Pausing a session parks the bus, and parking used to mean suspending the
   * context outright — which is the right answer when the only sound in the
   * room belongs to the session. The soundtrack does not: it is a layer under
   * the whole app that nobody asked to stop, and stopping the context would
   * take it with the ambience. So a holder asks for the clock to keep running,
   * and the ritual's own mix is faded out instead. Everything the session owns
   * hangs off `master`, and the soundtrack does not, which is what makes that
   * one ramp the whole of it.
   *
   * A set of names rather than a counter so that a holder released twice, or
   * registered twice, cannot leave the bus permanently awake.
   */
  private holds = new Set<string>()
  /** True while `master` is being held down by a park rather than by a start. */
  private parkedQuietly = false

  get context(): AudioContext | null {
    return this.ctx
  }

  /** Where ambient soundscapes connect. `null` until `ensure()` has run. */
  get musicNode(): GainNode | null {
    return this.graph?.music ?? null
  }

  /** Where the brainwave rhythm connects. `null` until `ensure()` has run. */
  get rhythmNode(): GainNode | null {
    return this.graph?.rhythm ?? null
  }

  /**
   * Where the adaptive soundtrack connects. `null` until `ensure()` has run.
   *
   * Deliberately outside `generated`: the music is its own channel, with its
   * own level, its own ducking and its own ceiling. See the diagram above.
   */
  get soundtrackNode(): GainNode | null {
    return this.graph?.soundtrack ?? null
  }

  /** The node carrying the user's master sound volume. */
  get generatedNode(): GainNode | null {
    return this.graph?.generated ?? null
  }

  get isReady(): boolean {
    return this.ctx !== null
  }

  /**
   * Create or wake the context. Must be reached synchronously from a user
   * gesture the first time, or browsers refuse to start any audio at all.
   */
  ensure(): AudioContext | null {
    if (typeof window === 'undefined') return null

    /*
     * Before anything else, and every time: on iOS these two are what stop the
     * hardware silent switch muting the entire generated mix while the spoken
     * voice — which never touches this graph — carries on regardless.
     *
     * Two of them rather than one, and not as a belt-and-braces flourish: the
     * first is the standards answer and is a no-op on every phone where Safari
     * has not enabled it, which is most of them. The second is what actually
     * moves the page onto the media route. Both are reached from the press
     * that starts the sound, because a media element needs a gesture for the
     * same reason an `AudioContext` does. See `audioSession.ts`.
     */
    claimPlaybackSession()
    claimMediaChannel()

    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext
      if (!Ctor) return null

      this.ctx = new Ctor()
      this.graph = buildBusGraph(this.ctx, this.ctx.destination, this.musicLevel)
      this.release = keepAwake(this.ctx, () => this.wantsClock())
    }

    // The audio thread is the one clock a hidden tab cannot slow down, and
    // everything that has to keep time out of sight runs on it. See `heartbeat`.
    registerClockSource(this.ctx)

    // Not `state === 'suspended'`: iOS has an `interrupted` state as well, and
    // a context left in it never comes back on its own.
    this.parked = false
    /*
     * And the ritual's mix comes back with it.
     *
     * `resume()` is not the only way out of a pause: the session provider
     * brings a paused session back with `ensure()` alone, because before there
     * was anything to park quietly, clearing `parked` and waking the context
     * was the whole of it. It is not any more — a pause that fades `master`
     * instead of stopping the clock has to raise it again — and putting that
     * here rather than only in `resume()` is what keeps the two paths from
     * disagreeing. Nothing that merely wants the context calls this: see
     * `Soundtrack`, which asks for `context` and only falls back to `ensure()`
     * when there is none.
     */
    this.holdMasterDown(false)
    wake(this.ctx)
    return this.ctx
  }

  beginGentleStart(durationSeconds = 1.15): void {
    const ctx = this.ensure()
    const master = this.graph?.master
    if (!ctx || !master) return
    // This *is* the mix coming back, so a park that was holding it down is
    // over — and saying so here stops a later resume from ramping a master
    // this is already raising.
    this.parkedQuietly = false
    const now = ctx.currentTime
    master.gain.cancelScheduledValues(now)
    master.gain.setValueAtTime(0.0001, now)
    master.gain.exponentialRampToValueAtTime(1, now + durationSeconds)
  }

  setMusicVolume(value: number): void {
    this.musicLevel = clampMusicVolume(value)
    if (this.graph && this.ctx) {
      // A short ramp rather than an assignment: a live volume change is one of
      // the easiest ways to put a click in a running mix.
      rampParam(
        this.graph.generated.gain,
        busGainFor(this.musicLevel),
        RAMP_SECONDS,
        this.ctx.currentTime,
      )
    }
  }

  get musicVolume(): number {
    return this.musicLevel
  }

  /**
   * Freeze everything generated. `currentTime` stops advancing while suspended,
   * so every oscillator resumes at exactly the phase it held — which is what
   * lets a paused session pick a rhythm back up rather than restart it.
   */
  suspend(): void {
    this.parked = true

    if (this.holds.size > 0) {
      /*
       * Something outside the session — the soundtrack — is still playing, so
       * the clock has to keep running and the media route has to stay claimed.
       * The ritual's mix leaves on a ramp instead.
       *
       * The cost is honest and worth naming: every generated ambience under a
       * paused session goes on being synthesised into a gain of zero. It is a
       * handful of oscillators and filters, it only happens while somebody has
       * both paused a session and left the music on, and the alternative is
       * tearing the ambience down and rebuilding it on resume — which is a
       * restart, and restarts are the thing this whole file exists to avoid.
       */
      this.holdMasterDown(true)
      return
    }

    // And let the media route go with it, so a paused session does not leave a
    // lock-screen widget behind insisting that something is still playing.
    releaseMediaChannel()
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend()
  }

  resume(): void {
    this.parked = false
    claimPlaybackSession()
    claimMediaChannel()
    wake(this.ctx)
    this.holdMasterDown(false)
  }

  /**
   * Ask for the audio clock to keep running while the session is parked.
   *
   * Idempotent, and paired with `releaseHold`. Anything that holds is responsible
   * for letting go the moment it stops making a sound, or a paused session
   * keeps a phone's audio hardware open for nothing.
   */
  hold(id: string): void {
    this.holds.add(id)
    if (!this.parked) return
    // The session parked while this was silent, so the clock is stopped and
    // the mix is down. Bring the clock back and leave the mix where it is.
    claimPlaybackSession()
    claimMediaChannel()
    wake(this.ctx)
    this.holdMasterDown(true)
  }

  releaseHold(id: string): void {
    if (!this.holds.delete(id)) return
    if (!this.parked || this.holds.size > 0) return
    // The last thing that wanted the room has stopped, and the session it was
    // playing over is still paused. Park properly.
    this.suspend()
  }

  /** Whether the audio clock should be running right now. */
  private wantsClock(): boolean {
    return !this.parked || this.holds.size > 0
  }

  /**
   * Take the ritual's mix down, or bring it back, without touching the clock.
   *
   * Guarded by its own flag so that a resume can never raise a `master` that a
   * gentle start is still in the middle of raising.
   */
  private holdMasterDown(down: boolean): void {
    if (this.parkedQuietly === down) return
    const ctx = this.ctx
    const master = this.graph?.master
    if (!ctx || !master) return
    this.parkedQuietly = down
    fadeParam(master.gain, down ? 0 : 1, PARK_FADE_SECONDS, ctx.currentTime)
  }

  close(): void {
    releaseMediaChannel()
    // The graph is going, so nothing can be holding it open or held down by it.
    this.holds.clear()
    this.parked = false
    this.parkedQuietly = false
    if (!this.ctx) return
    this.release?.()
    this.release = null
    releaseClockSource(this.ctx)
    void this.ctx.close().catch(() => undefined)
    this.ctx = null
    this.graph = null
  }
}

function clampMusicVolume(value: number): number {
  return Math.min(MAX_MUSIC_VOLUME, Math.max(0, value))
}

/**
 * The setting as the mix should hear it. The clamp is on the user's value, so
 * the slider still reads 0–200%; the boost is applied after, where it cannot
 * be mistaken for something the person chose.
 */
function busGainFor(value: number): number {
  return clampMusicVolume(value) * MUSIC_MAKEUP_GAIN
}
