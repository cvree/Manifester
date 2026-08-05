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
 * "Sound volume" still governs both. Everything then passes through one
 * protective ceiling before the speakers:
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

/** Short enough to feel immediate on a slider, long enough not to step. */
const RAMP_SECONDS = 0.12

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
  generated.gain.value = clamp01(soundVolume)
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

    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext
      if (!Ctor) return null

      this.ctx = new Ctor()
      this.graph = buildBusGraph(this.ctx, this.ctx.destination, this.musicLevel)
    }

    if (this.ctx.state === 'suspended') void this.ctx.resume()
    return this.ctx
  }

  setMusicVolume(value: number): void {
    this.musicLevel = clamp01(value)
    if (this.graph && this.ctx) {
      // A short ramp rather than an assignment: a live volume change is one of
      // the easiest ways to put a click in a running mix.
      rampParam(
        this.graph.generated.gain,
        this.musicLevel,
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
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend()
  }

  resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume()
  }

  close(): void {
    if (!this.ctx) return
    void this.ctx.close().catch(() => undefined)
    this.ctx = null
    this.graph = null
  }
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}
