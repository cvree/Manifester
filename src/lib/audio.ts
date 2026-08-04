/**
 * The background sound layer.
 *
 * Two kinds of source share one engine:
 *  - built-in ambiences, synthesised live through an `AudioContext`;
 *  - imported files, played through a single reused `HTMLAudioElement`.
 *
 * Keeping imported files on a media element (rather than routing them through
 * the audio graph) avoids a class of iOS Safari decoding problems and lets very
 * long files stream instead of decoding fully into memory.
 *
 * iOS note: both an `AudioContext` and a media element must be started from a
 * real user gesture. `unlock()` does that synchronously inside the tap; the
 * actual track can then be loaded asynchronously afterwards.
 */

import { findAmbientPreset, type AmbientHandle } from './ambient'
import type { RepeatMode } from './types'

/** How long a generated ambience plays before a playlist moves on. */
const BUILTIN_SEGMENT_MS = 150_000
const FADE_MS = 900

/** A valid, zero-sample WAV — used only to unlock playback on iOS. */
const SILENT_WAV =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YQAAAAA='

export interface TrackSource {
  id: string
  name: string
  kind: 'builtin' | 'custom'
  /** Present when `kind === 'builtin'`. */
  presetId?: string
  /** Present when `kind === 'custom'`. */
  blob?: Blob
}

export interface MusicEngineHandlers {
  onTrackChange?: (track: TrackSource | null) => void
  onError?: (message: string) => void
}

export class MusicEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private ambient: AmbientHandle | null = null
  private element: HTMLAudioElement | null = null
  private objectUrl: string | null = null
  private segmentTimer: number | null = null
  private fadeTimer: number | null = null

  private queue: TrackSource[] = []
  private queueIndex = 0
  private repeat: RepeatMode = 'all'
  private volume = 0.4
  private generation = 0
  private active = false
  private paused = false
  private handlers: MusicEngineHandlers = {}

  get isActive(): boolean {
    return this.active
  }

  setHandlers(handlers: MusicEngineHandlers): void {
    this.handlers = handlers
  }

  /**
   * Call synchronously from a click/tap before any awaiting happens. Creates
   * the audio context and primes the media element so later playback is allowed.
   */
  unlock(): void {
    this.ensureContext()

    if (!this.element) {
      const element = new Audio()
      element.preload = 'auto'
      // Keeps iOS from taking audio-only playback fullscreen.
      element.setAttribute('playsinline', '')
      this.element = element
    }

    const element = this.element
    if (!element.src) {
      element.src = SILENT_WAV
      element.volume = 0
      void element
        .play()
        .then(() => element.pause())
        .catch(() => undefined)
    }
  }

  setVolume(value: number): void {
    this.volume = Math.min(1, Math.max(0, value))
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.08)
    }
    // Only take over the element's volume when it is not mid-fade.
    if (this.element && this.fadeTimer == null && this.active) {
      this.element.volume = this.volume
    }
  }

  /** Start (or restart) playback of an ordered list of tracks. */
  async play(tracks: TrackSource[], repeat: RepeatMode): Promise<void> {
    this.teardown(0)

    if (tracks.length === 0) {
      this.active = false
      return
    }

    this.generation += 1
    this.queue = tracks
    this.queueIndex = 0
    this.repeat = repeat
    this.active = true
    this.paused = false

    await this.playCurrent(this.generation)
  }

  /**
   * Hold everything in place, keeping the current position. Used when the
   * session is paused, so resuming picks up mid-track instead of restarting.
   */
  suspend(): void {
    if (!this.active) return
    this.paused = true
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend()
    this.element?.pause()
  }

  /** Undo `suspend()`. */
  resumePlayback(): void {
    if (!this.active) return
    this.paused = false
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume()
    if (this.element?.src && !this.element.src.startsWith('data:')) {
      void this.element.play().catch(() => undefined)
    }
  }

  /** Wake a context suspended by a lock screen or a backgrounded tab. */
  resumeIfSuspended(): void {
    if (!this.active || this.paused) return
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume()
    if (this.element?.paused && this.element.src) {
      void this.element.play().catch(() => undefined)
    }
  }

  stop(fadeMs = FADE_MS): void {
    this.active = false
    this.paused = false
    this.teardown(fadeMs)
    this.handlers.onTrackChange?.(null)
  }

  /** Release every resource. Called when the app unmounts. */
  dispose(): void {
    this.teardown(0)
    this.active = false
    this.paused = false
    this.element = null
    if (this.ctx) {
      void this.ctx.close().catch(() => undefined)
      this.ctx = null
      this.master = null
    }
  }

  /* ── internals ── */

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext
      if (!Ctor) return null
      this.ctx = new Ctor()
      this.master = this.ctx.createGain()
      this.master.gain.value = this.volume
      this.master.connect(this.ctx.destination)
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    return this.ctx
  }

  private teardown(fadeMs: number): void {
    this.generation += 1
    this.clearSegmentTimer()

    if (this.ambient) {
      this.ambient.stop()
      this.ambient = null
    }

    const element = this.element
    const url = this.objectUrl
    this.objectUrl = null

    if (element && element.src && !element.src.startsWith('data:')) {
      const release = () => {
        element.pause()
        element.removeAttribute('src')
        element.load()
        if (url) URL.revokeObjectURL(url)
      }
      if (fadeMs > 0) this.rampElement(element, 0, fadeMs, release)
      else {
        this.clearFadeTimer()
        release()
      }
    } else if (url) {
      URL.revokeObjectURL(url)
    }
  }

  private async playCurrent(generation: number): Promise<void> {
    if (generation !== this.generation) return

    const track = this.queue[this.queueIndex]
    if (!track) return

    this.handlers.onTrackChange?.(track)

    if (track.kind === 'builtin') this.playBuiltin(track, generation)
    else await this.playFile(track, generation)
  }

  private playBuiltin(track: TrackSource, generation: number): void {
    const ctx = this.ensureContext()
    if (!ctx || !this.master) {
      this.handlers.onError?.(
        'This browser will not let the app generate sound. You can still import your own audio in Sounds.',
      )
      return
    }

    const preset = findAmbientPreset(track.presetId ?? track.id)
    if (!preset) {
      this.advance(generation)
      return
    }

    this.master.gain.setTargetAtTime(this.volume, ctx.currentTime, 0.5)
    this.ambient = preset.build(ctx, this.master)

    // A generated ambience never "ends", so a playlist needs a nudge.
    const loopsForever = this.queue.length === 1 || this.repeat === 'one'
    if (!loopsForever) {
      this.segmentTimer = window.setTimeout(() => {
        this.segmentTimer = null
        this.advance(generation)
      }, BUILTIN_SEGMENT_MS)
    }
  }

  private async playFile(track: TrackSource, generation: number): Promise<void> {
    if (!track.blob) {
      this.advance(generation)
      return
    }

    this.unlock()
    const element = this.element
    if (!element) {
      this.handlers.onError?.('This browser cannot play audio files.')
      return
    }

    const url = URL.createObjectURL(track.blob)
    this.objectUrl = url

    element.onended = () => {
      if (generation !== this.generation || element.loop) return
      this.advance(generation)
    }

    element.onerror = () => {
      if (generation !== this.generation) return
      this.handlers.onError?.(
        `“${track.name}” could not be played on this device. Try an MP3, M4A, or WAV file.`,
      )
      if (this.queue.length > 1) this.advance(generation)
      else this.stop(0)
    }

    element.loop = this.queue.length === 1 || this.repeat === 'one'
    element.volume = 0
    element.src = url

    try {
      await element.play()
      if (generation !== this.generation) return
      this.rampElement(element, this.volume, FADE_MS)
    } catch {
      if (generation !== this.generation) return
      this.handlers.onError?.(
        'Your device blocked background audio. Tap play once more to allow it.',
      )
    }
  }

  private advance(generation: number): void {
    if (generation !== this.generation) return

    this.clearSegmentTimer()
    if (this.ambient) {
      this.ambient.stop()
      this.ambient = null
    }
    if (this.element && this.objectUrl) {
      const url = this.objectUrl
      this.objectUrl = null
      this.element.pause()
      this.element.removeAttribute('src')
      URL.revokeObjectURL(url)
    }

    const next = this.queueIndex + 1
    if (next >= this.queue.length) {
      if (this.repeat === 'all') {
        this.queueIndex = 0
      } else {
        this.stop()
        return
      }
    } else {
      this.queueIndex = next
    }

    void this.playCurrent(generation)
  }

  /** Linear volume ramp for media elements, which have no scheduled params. */
  private rampElement(
    element: HTMLAudioElement,
    target: number,
    durationMs: number,
    onDone?: () => void,
  ): void {
    this.clearFadeTimer()
    const start = element.volume
    const startedAt = performance.now()

    const step = () => {
      const progress = Math.min(1, (performance.now() - startedAt) / durationMs)
      element.volume = Math.min(1, Math.max(0, start + (target - start) * progress))
      if (progress < 1) {
        this.fadeTimer = window.setTimeout(step, 30)
      } else {
        this.fadeTimer = null
        onDone?.()
      }
    }

    step()
  }

  private clearSegmentTimer(): void {
    if (this.segmentTimer != null) {
      clearTimeout(this.segmentTimer)
      this.segmentTimer = null
    }
  }

  private clearFadeTimer(): void {
    if (this.fadeTimer != null) {
      clearTimeout(this.fadeTimer)
      this.fadeTimer = null
    }
  }
}

/** Read an imported file's duration without keeping it in memory. */
export function readAudioDuration(blob: Blob): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob)
    const element = new Audio()
    let settled = false
    const done = (value: number | null) => {
      if (settled) return
      settled = true
      URL.revokeObjectURL(url)
      element.removeAttribute('src')
      resolve(value)
    }
    element.preload = 'metadata'
    element.onloadedmetadata = () =>
      done(Number.isFinite(element.duration) ? element.duration : null)
    element.onerror = () => done(null)
    element.src = url
    // Some browsers never settle either handler for unusual containers.
    window.setTimeout(() => done(null), 6000)
  })
}
