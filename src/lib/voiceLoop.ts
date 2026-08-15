/**
 * The looping speaker.
 *
 * One written line is one utterance and one clip — see `chunkText` — and this
 * is what walks that list, holds the deliberate silence between passes, and
 * survives everything a phone does to an app that is talking: a lock screen, a
 * phone call, a tab in the background, somebody pressing pause and play four
 * times in a second.
 *
 * It replaces the old `SpeechLooper`, and the thing that changed is smaller
 * than it looks. The timing, the generation tokens and the recovery are the
 * same ideas, because they were right; what is different is that a line is now
 * *audio* — fetched, cached, and played through this app's own audio graph —
 * rather than a request handed to the platform and hoped for. That turns two
 * of the old workarounds into ordinary code: the keep-alive nudge for Chrome's
 * fifteen-second cut-off is gone, because an `AudioBufferSourceNode` has no
 * such cut-off, and the announcement of which line is being spoken is now
 * exact rather than a race between `onstart` and a timer.
 *
 * The one addition is the preload. The loop always knows its next line, so it
 * fetches it while the current one is still speaking; by the time the gap ends
 * the audio is decoded and in memory, and the next line starts in the time it
 * takes to schedule a buffer.
 */

import { scheduleAt } from './heartbeat'
import { chunkText } from './speech'
import { tts } from './tts'
import type { SpeakSettings } from './tts'
import type { LogicalVoice, SpeakOutcome } from './tts/types'

/**
 * The part of the voice layer this loop actually uses.
 *
 * Narrow on purpose. The loop is where the timing lives — gaps, generations,
 * recovery after an interruption — and all of that is worth testing without a
 * browser, an audio context, or a model. Four methods is a thing a test can
 * write in ten lines; the singleton is not.
 */
export interface Speaker {
  speak(text: string, options?: SpeakSettings): Promise<SpeakOutcome>
  preload(text: string, options?: SpeakSettings): Promise<void>
  stop(): void
  readonly isSpeaking: boolean
}

export interface VoiceLoopOptions {
  text: string
  /** The logical voice: the same person on every device. */
  voice: LogicalVoice
  /** Use the device's own voice instead of the studio one. */
  preferDevice?: boolean
  /** An exact device voice, when one has been chosen. */
  deviceVoiceURI?: string | null
  /** 0.5–2.0 */
  rate: number
  /** Fallback voices only; no neural engine has a pitch control. */
  pitch: number
  volume: number
  /** Silence between repetitions. */
  repeatPauseMs: number
  /** A small settling silence before the first word. */
  initialDelayMs?: number
  /** When false the text is spoken once and then finishes. */
  loop: boolean
}

export interface VoiceLoopHandlers {
  /** The words being spoken *now*, at the moment they reach the speakers. */
  onChunk?: (index: number, total: number, text: string) => void
  onCycle?: (completedCycles: number) => void
  onFinish?: () => void
  onError?: (message: string) => void
}

/**
 * How many lines in a row may fail before the app says something.
 *
 * One failure is a line that could not be fetched and was skipped, which is
 * not worth a notice. A whole pass of failures means the voice is not working
 * at all, and saying so is better than a silent session.
 */
const FAILURES_BEFORE_NOTICE = 3

export class VoiceLooper {
  private voice: Speaker
  private generation = 0
  private chunks: string[] = []
  private index = 0
  private cycles = 0
  private options: VoiceLoopOptions | null = null
  private handlers: VoiceLoopHandlers = {}
  private running = false
  private paused = false
  /** True between asking for a line and that line ending. */
  private speaking = false
  private failures = 0
  private noticed = false

  /** Cancels the silence between repetitions. See `scheduleAt`. */
  private gapCancel: (() => void) | null = null
  private gapEndsAt = 0
  private gapVisible = true
  private pausedGapMs: number | null = null
  private pausedGapVisible = true

  /** The singleton in the app; a fake in a test. */
  constructor(voice: Speaker = tts) {
    this.voice = voice
  }

  get isRunning(): boolean {
    return this.running
  }

  get chunkCount(): number {
    return this.chunks.length
  }

  /** Seconds left in the silence between passes, or `null` while speaking. */
  get delayRemainingSeconds(): number | null {
    if (!this.running) return null
    if (this.pausedGapMs != null) {
      return this.pausedGapVisible ? this.pausedGapMs / 1000 : null
    }
    if (this.gapCancel != null && this.gapEndsAt > 0) {
      return this.gapVisible ? Math.max(0, (this.gapEndsAt - Date.now()) / 1000) : null
    }
    return null
  }

  /** Live-update rate/volume/voice; takes effect on the next line. */
  updateOptions(patch: Partial<VoiceLoopOptions>): void {
    if (!this.options) return
    this.options = { ...this.options, ...patch }
    // The next line is already being fetched under the old settings, so a
    // change of voice or speed makes that preload worthless. Fetching the new
    // one now means the change is heard on the next line rather than the one
    // after it.
    this.preloadNext()
  }

  start(options: VoiceLoopOptions, handlers: VoiceLoopHandlers = {}): boolean {
    const chunks = chunkText(options.text)
    if (chunks.length === 0) {
      handlers.onError?.('Add some words first, then press play.')
      return false
    }

    this.stop()
    this.generation += 1
    this.chunks = chunks
    this.index = 0
    this.cycles = 0
    this.options = options
    this.handlers = handlers
    this.running = true
    this.paused = false
    this.failures = 0
    this.noticed = false

    // The first line is wanted in a moment; the second is wanted after it.
    this.preload(0)
    this.preload(1)

    const initialDelay = Math.max(0, options.initialDelayMs ?? 0)
    if (initialDelay > 0) this.startGap(this.generation, initialDelay, false)
    else void this.speakCurrent(this.generation)
    return true
  }

  pause(): void {
    if (!this.running || this.paused) return
    this.paused = true

    if (this.gapCancel != null) {
      this.pausedGapMs = Math.max(0, this.gapEndsAt - Date.now())
      this.pausedGapVisible = this.gapVisible
    }

    // Invalidate every callback belonging to the line being cut short.
    // Resuming deliberately restarts the current line rather than trying to
    // continue one part-spoken, which is both simpler and kinder to listen to.
    this.generation += 1
    this.speaking = false
    this.clearGap()
    this.voice.stop()
  }

  resume(): void {
    if (!this.running || !this.paused) return
    this.paused = false
    this.generation += 1
    const generation = this.generation

    if (this.pausedGapMs != null) {
      const remaining = this.pausedGapMs
      const visible = this.pausedGapVisible
      this.pausedGapMs = null
      this.pausedGapVisible = true
      this.startGap(generation, remaining, visible)
      return
    }

    void this.speakCurrent(generation)
  }

  stop(): void {
    this.generation += 1
    this.running = false
    this.paused = false
    this.speaking = false
    this.gapEndsAt = 0
    this.gapVisible = true
    this.pausedGapMs = null
    this.pausedGapVisible = true
    this.clearGap()
    this.voice.stop()
  }

  /**
   * Check that the voice is still going, and start it again if it is not.
   *
   * Called when the app comes back to the foreground. A locked phone, a call,
   * or another app taking the audio route can all leave a clip that will never
   * finish and never report that it has not, and the symptom is a session that
   * looks like it is playing in silence.
   *
   * Every case where something *is* happening is a no-op, including the
   * deliberate gap between passes, so this can never double-speak.
   */
  recover(): void {
    if (!this.running || this.paused) return
    if (this.gapCancel != null || this.pausedGapMs != null) return
    if (this.speaking && this.voice.isSpeaking) return
    if (!this.speaking) return
    this.generation += 1
    void this.speakCurrent(this.generation)
  }

  /* ── internals ── */

  private async speakCurrent(generation: number): Promise<void> {
    if (generation !== this.generation || !this.options || this.paused) return

    const options = this.options
    const index = this.index
    const text = this.chunks[index]
    if (!text) return

    this.speaking = true
    // Fetch the next line while this one is speaking. This is the whole
    // preload: by the time the gap ends, it is decoded and in memory.
    this.preload(index + 1)

    const outcome = await this.voice.speak(text, {
      voice: options.voice,
      speed: options.rate,
      pitch: options.pitch,
      volume: options.volume,
      priority: 'interrupt',
      prefer: options.preferDevice ? 'device' : 'studio',
      deviceVoiceURI: options.deviceVoiceURI ?? null,
      onStart: () => {
        if (generation !== this.generation) return
        this.handlers.onChunk?.(index, this.chunks.length, text)
      },
    })

    if (generation !== this.generation) return
    this.speaking = false

    if (outcome === 'interrupted') return

    if (outcome === 'failed') {
      this.failures += 1
      if (this.failures >= FAILURES_BEFORE_NOTICE && !this.noticed) {
        this.noticed = true
        this.handlers.onError?.(
          'The voice could not be reached, so these words are not being spoken. Everything else keeps playing.',
        )
      }
      /*
       * A failed line still takes its turn. Rushing through a broken pass as
       * fast as the failures arrive would spin the loop, empty the battery,
       * and hammer whatever is failing; a short rest keeps a broken voice
       * looking like a quiet one.
       */
      await delay(600)
      if (generation !== this.generation) return
    } else {
      this.failures = 0
    }

    this.advance(generation)
  }

  private advance(generation: number): void {
    if (generation !== this.generation || !this.options || this.paused) return

    if (this.index < this.chunks.length - 1) {
      this.index += 1
      void this.speakCurrent(generation)
      return
    }

    this.cycles += 1
    this.handlers.onCycle?.(this.cycles)

    if (!this.options.loop) {
      this.running = false
      this.handlers.onFinish?.()
      return
    }

    this.index = 0
    // The first line of the next pass is wanted after the gap; ask for it now
    // so the gap is doing double duty.
    this.preload(0)
    this.startGap(generation, Math.max(0, this.options.repeatPauseMs))
  }

  /** Hold a deliberate silence, then begin again. */
  private startGap(generation: number, durationMs: number, visible = true): void {
    this.clearGap()
    this.gapVisible = visible
    this.gapEndsAt = Date.now() + durationMs

    /*
     * `scheduleAt` rather than `setTimeout`, because the gap is part of the
     * sound design and a hidden tab clamps timers to a second or worse. It
     * arms a timer *and* an audio-clock heartbeat, so whichever the browser is
     * still honouring is the one that fires. See `heartbeat.ts`.
     */
    this.gapCancel = scheduleAt(this.gapEndsAt, () => {
      this.gapCancel = null
      this.gapEndsAt = 0
      this.gapVisible = true
      if (!this.paused) void this.speakCurrent(generation)
    })
  }

  private clearGap(): void {
    this.gapCancel?.()
    this.gapCancel = null
  }

  /** Warm the cache for a line, wrapping around at the end of a pass. */
  private preload(index: number): void {
    const options = this.options
    if (!options || !options.loop && index >= this.chunks.length) return
    const wrapped = this.chunks.length > 0 ? index % this.chunks.length : 0
    const text = this.chunks[wrapped]
    if (!text) return
    void this.voice.preload(text, {
      voice: options.voice,
      speed: options.rate,
      prefer: options.preferDevice ? 'device' : 'studio',
    })
  }

  private preloadNext(): void {
    this.preload(this.index + 1)
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
