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
 *               ├─→ generated (sound volume) ─→ ceiling ─→ master ─→ output
 *      rhythm ──┘
 *
 * The spoken affirmation does not travel through here at all: speech synthesis
 * happens outside the page, so the voice is never squashed by the ceiling and
 * stays the clearest thing in the room.
 */

import { createSoftCeiling, rampParam } from './audioParams'
import { claimPlaybackSession, keepAwake, wake } from './audioSession'

/** Short enough to feel immediate on a slider, long enough not to step. */
const RAMP_SECONDS = 0.12

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

  return { master, ceiling, generated, music, rhythm }
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
     * Before anything else, and every time: on iOS this is what stops the
     * hardware silent switch muting the entire generated mix while the spoken
     * voice — which never touches this graph — carries on regardless. See
     * `audioSession.ts`; it is a no-op everywhere it is not needed.
     */
    claimPlaybackSession()

    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext
      if (!Ctor) return null

      this.ctx = new Ctor()
      this.graph = buildBusGraph(this.ctx, this.ctx.destination, this.musicLevel)
      this.release = keepAwake(this.ctx, () => !this.parked)
    }

    // Not `state === 'suspended'`: iOS has an `interrupted` state as well, and
    // a context left in it never comes back on its own.
    this.parked = false
    wake(this.ctx)
    return this.ctx
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
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend()
  }

  resume(): void {
    this.parked = false
    claimPlaybackSession()
    wake(this.ctx)
  }

  close(): void {
    if (!this.ctx) return
    this.release?.()
    this.release = null
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
