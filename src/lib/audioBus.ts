/**
 * Owns the app's `AudioContext` and the background sound channel.
 *
 * Having one place responsible for creating, unlocking and suspending the
 * context means a session can pause every generated sound at once, and the
 * Sounds tab can audition a track on a completely separate context without
 * touching a live session.
 */

const RAMP_SECONDS = 0.08

export class AudioBus {
  private ctx: AudioContext | null = null
  private music: GainNode | null = null
  private musicLevel = 0.4

  get context(): AudioContext | null {
    return this.ctx
  }

  get musicNode(): GainNode | null {
    return this.music
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
      this.music = this.ctx.createGain()
      this.music.gain.value = this.musicLevel
      this.music.connect(this.ctx.destination)
    }

    if (this.ctx.state === 'suspended') void this.ctx.resume()
    return this.ctx
  }

  setMusicVolume(value: number): void {
    this.musicLevel = clamp01(value)
    if (this.music && this.ctx) {
      this.music.gain.setTargetAtTime(
        this.musicLevel,
        this.ctx.currentTime,
        RAMP_SECONDS,
      )
    }
  }

  get musicVolume(): number {
    return this.musicLevel
  }

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
    this.music = null
  }
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}
