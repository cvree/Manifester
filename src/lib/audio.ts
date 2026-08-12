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

import {
  AMBIENCE_FADE_SECONDS,
  findAmbientPreset,
  type AmbientHandle,
  type RainCharacter,
} from './ambient'
import type { AudioBus } from './audioBus'
import { onHeartbeat, scheduleIn } from './heartbeat'
import { isLowPowerDevice } from './motion'
import type { RepeatMode } from './types'

/** How long a generated ambience plays before a playlist moves on. */
const BUILTIN_SEGMENT_MS = 150_000
const FADE_MS = AMBIENCE_FADE_SECONDS * 1000

/** Per-soundscape choices that a running ambience can be rebuilt around. */
export interface AmbienceOptions {
  rainCharacter?: RainCharacter
}

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
  private readonly bus: AudioBus
  private ambient: AmbientHandle | null = null
  private element: HTMLAudioElement | null = null
  private objectUrl: string | null = null
  /**
   * Cancels the wait before a playlist moves off a generated ambience.
   *
   * Through the heartbeat rather than `setTimeout`, because when a playlist
   * moves on is part of the sound design. A hidden tab can hold an ordinary
   * timer well past its due time, and a soundscape that was meant to hand over
   * after two and a half minutes carrying on for six is precisely the "why did
   * the sound change — or not change?" this pass is about.
   */
  private segmentCancel: (() => void) | null = null
  private fadeTimer: number | null = null
  /** Detaches the heartbeat that keeps a media-element fade smooth when hidden. */
  private fadeRelease: (() => void) | null = null

  private queue: TrackSource[] = []
  private queueIndex = 0
  private repeat: RepeatMode = 'all'
  private volume = 0.4
  private generation = 0
  private active = false
  private paused = false
  private handlers: MusicEngineHandlers = {}
  private ambienceOptions: AmbienceOptions = {}
  /** The soundscape the live `ambient` handle was built for. */
  private ambientPresetId: string | null = null

  constructor(bus: AudioBus) {
    this.bus = bus
  }

  get isActive(): boolean {
    return this.active
  }

  /**
   * Change a soundscape's character. A running ambience is rebuilt into a
   * crossfade rather than restarted, so moving the Rain slider is inaudible
   * apart from the rain itself changing.
   */
  setAmbienceOptions(options: AmbienceOptions): void {
    const changed = options.rainCharacter !== this.ambienceOptions.rainCharacter
    this.ambienceOptions = { ...options }
    if (!changed || !this.active || this.paused) return
    if (this.ambientPresetId !== 'rain-window') return

    const track = this.queue[this.queueIndex]
    if (track?.kind === 'builtin') this.crossfadeToBuiltin(track)
  }

  setHandlers(handlers: MusicEngineHandlers): void {
    this.handlers = handlers
  }

  /**
   * Call synchronously from a click/tap before any awaiting happens. Creates
   * the audio context and primes the media element so later playback is allowed.
   */
  unlock(): void {
    this.bus.ensure()

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
    this.bus.setMusicVolume(this.volume)
    // Only take over the element's volume when it is not mid-fade.
    if (this.element && this.fadeTimer == null && this.active) {
      this.element.volume = this.volume
    }
  }

  /**
   * Start (or restart) playback of an ordered list of tracks.
   *
   * Anything already playing is faded rather than cut, so choosing a different
   * sound crossfades into it.
   */
  async play(tracks: TrackSource[], repeat: RepeatMode): Promise<void> {
    // The outgoing ambience fades while the incoming one rises. An imported
    // file cannot join that crossfade — every file shares one media element,
    // and the outgoing fade would tear down the incoming track's own source.
    this.teardown(FADE_MS, 0)

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
   * Hold in place, keeping the current position, so resuming picks up
   * mid-track instead of restarting. The shared context is suspended by the
   * session, not here — the voice channel rides on it too.
   */
  suspend(): void {
    if (!this.active) return
    this.paused = true
    this.element?.pause()
  }

  /** Undo `suspend()`. */
  resumePlayback(): void {
    if (!this.active) return
    this.paused = false
    if (this.element?.src && !this.element.src.startsWith('data:')) {
      void this.element.play().catch(() => undefined)
    }
  }

  /** Recover from a lock screen or a backgrounded tab. */
  resumeIfSuspended(): void {
    if (!this.active || this.paused) return
    if (this.element?.paused && this.element.src) {
      void this.element.play().catch(() => undefined)
    }
  }

  stop(fadeMs = FADE_MS): void {
    this.active = false
    this.paused = false
    this.teardown(fadeMs, fadeMs)
    this.handlers.onTrackChange?.(null)
  }

  /** Release this engine's resources. The shared bus outlives it. */
  dispose(): void {
    this.teardown(0, 0)
    this.active = false
    this.paused = false
    this.element = null
  }

  /* ── internals ── */

  private teardown(ambientFadeMs: number, elementFadeMs: number): void {
    this.generation += 1
    this.clearSegmentTimer()

    if (this.ambient) {
      // The ambience fades itself out over the same span the next one fades in.
      this.ambient.stop(ambientFadeMs / 1000)
      this.ambient = null
      this.ambientPresetId = null
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
      if (elementFadeMs > 0) this.rampElement(element, 0, elementFadeMs, release)
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
    const ctx = this.bus.ensure()
    const destination = this.bus.musicNode
    if (!ctx || !destination) {
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

    this.bus.setMusicVolume(this.volume)
    this.ambient = preset.build(ctx, destination, {
      rainCharacter: this.ambienceOptions.rainCharacter,
      lowPower: isLowPowerDevice(),
    })
    this.ambientPresetId = preset.id

    // A generated ambience never "ends", so a playlist needs a nudge.
    const loopsForever = this.queue.length === 1 || this.repeat === 'one'
    if (!loopsForever) {
      this.segmentCancel = scheduleIn(BUILTIN_SEGMENT_MS, () => {
        this.segmentCancel = null
        this.advance(generation)
      })
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

  /** Swap one generated ambience for another without disturbing the queue. */
  private crossfadeToBuiltin(track: TrackSource): void {
    const ctx = this.bus.context
    const destination = this.bus.musicNode
    const preset = findAmbientPreset(track.presetId ?? track.id)
    if (!ctx || !destination || !preset) return

    this.ambient?.stop(AMBIENCE_FADE_SECONDS)
    this.ambient = preset.build(ctx, destination, {
      rainCharacter: this.ambienceOptions.rainCharacter,
      lowPower: isLowPowerDevice(),
    })
    this.ambientPresetId = preset.id
  }

  private advance(generation: number): void {
    if (generation !== this.generation) return

    this.clearSegmentTimer()
    if (this.ambient) {
      this.ambient.stop()
      this.ambient = null
      this.ambientPresetId = null
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

  /**
   * Linear volume ramp for media elements, which have no scheduled params.
   *
   * Every step recomputes from the wall clock, so the fade always *lands* on
   * target however badly its callbacks are throttled — only the number of steps
   * between here and there changes. The heartbeat runs alongside the timer
   * because a hidden tab clamps that timer to a second, and a 1.5-second
   * crossfade taken in two jumps is a click rather than a fade. It is a narrow
   * case — a playlist has to advance onto or off an imported file while the
   * page is out of sight — but a click is exactly the sort of "the sound
   * changed when I switched tabs" all of this exists to remove.
   *
   * A generated ambience never comes through here: it crossfades on an
   * `AudioParam`, which is sample-accurate and completely indifferent to
   * whether anybody is looking.
   */
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
        // Only the timer is re-armed; the heartbeat is already running.
        if (this.fadeTimer != null) clearTimeout(this.fadeTimer)
        this.fadeTimer = window.setTimeout(step, 30)
        return
      }
      this.clearFadeTimer()
      onDone?.()
    }

    this.fadeRelease = onHeartbeat(step)
    step()
  }

  private clearSegmentTimer(): void {
    this.segmentCancel?.()
    this.segmentCancel = null
  }

  private clearFadeTimer(): void {
    this.fadeRelease?.()
    this.fadeRelease = null
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
