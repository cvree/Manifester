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
  /**
   * Change the level of the line already speaking, where the voice can.
   *
   * Optional: a fake in a test does not have to implement it, and the device
   * voice genuinely cannot — see `TTS.setLiveVolume`.
   */
  setLiveVolume?(value: number): void
  /**
   * Change the speed of the line already speaking, and say whether it took.
   *
   * `false` means the line has to be spoken again to be heard at the new
   * speed, which is the device voice's answer and the answer whenever nothing
   * of this app's own is in the speakers. See `TTS.setLiveRate`.
   */
  setLiveRate?(value: number): boolean
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
  /**
   * How high the voice reads. Applies to both paths now — the studio voice
   * gets it from `shape.ts` rather than from the engine, which has no pitch
   * control of its own.
   */
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

/**
 * How long a live voice change settles before the line is spoken again.
 *
 * The whole budget of this number is "instant to a person, but only once per
 * gesture". A slider fires a change per pixel and a select fires one per
 * arrow-key press; 140 ms is below the ~200 ms at which a response stops
 * feeling immediate, and comfortably above the interval between two events
 * from one continuous drag — so the fastest possible dragging still costs one
 * restart, at the value the finger stopped on.
 */
const RESTART_SETTLE_MS = 140

/**
 * How many lines beyond the one speaking are fetched in advance.
 *
 * One was the old answer and it was one short of enough. It is exactly right
 * while nothing changes — each line's successor is fetched during it, and by
 * the time it is wanted it is decoded and in memory. What it does not survive
 * is a *change*: the moment somebody moves the speed, every clip prepared
 * under the old setting is worthless, and a window of one means the loop
 * re-enters the "fetch, then speak" pattern it spends the rest of its life
 * avoiding — a synthesis-shaped hole before every line for the rest of the
 * pass, which is the delay people report after touching a slider.
 *
 * Two is the smallest window that outlives a change: the line being prepared
 * to replace the current one, and the one after it, so the loop is a line
 * ahead again by the time the change has landed. Larger is not better — an
 * on-device model synthesises one line at a time, so a deep queue is only a
 * way of putting work the loop needs *now* behind work it needs later.
 */
const PRELOAD_AHEAD = 2

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
  /** Settles a burst of live voice changes into one restart. See `updateOptions`. */
  private restartTimer: number | null = null
  /** Settles a burst of live changes into one round of preloading. */
  private primeTimer: number | null = null
  /** Invalidates a swap that was being prepared when a newer one arrived. */
  private swapToken = 0

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

  /**
   * Change how the voice sounds, while it is speaking.
   *
   * ── Why this is not simply "takes effect on the next line" ──
   *
   * It used to be, and that is a perfectly defensible answer for a loop of
   * four-second affirmations — right up until somebody opens the voice
   * controls *because* the voice is wrong. Then the interface says "Samantha",
   * the previous voice carries on for the rest of the line, and the gap
   * between the two is the exact confusing state this is meant to remove.
   * With a long line and a three-second rest after it, "the next line" can be
   * eight seconds away, which nobody reads as a setting having applied.
   *
   * So a change that alters *how the current line sounds* stops it and speaks
   * it again from the top, at the same index, in the same pass. Three things
   * are deliberately preserved: the position in the affirmation, the completed
   * cycle count, and everything else about the session — this restarts a line,
   * never a ritual.
   *
   * Three changes are handled differently, and all of them for the same
   * reason: a restart that has to wait for a synthesis is a *silence*, and a
   * silence is the one thing worse than a setting arriving late.
   *
   *  - **Volume** does not restart anything. The studio voice's level is a
   *    gain node this app owns, so it can simply be turned down mid-word.
   *  - **Speed** does not restart anything either, where the studio voice is
   *    speaking. A clip is a buffer, and a buffer can be resampled — so the
   *    new tempo arrives within a tenth of a second, with no gap at all, and
   *    the following lines are rendered at the new speed properly. This is
   *    what used to cost seconds of silence per drag. See `TTS.setLiveRate`.
   *  - **Everything else** (`repeatPauseMs`, `loop`) does not change the sound
   *    of the line being spoken, so interrupting it would be damage with no
   *    benefit.
   *
   * What is left — a different voice, a different pitch, the device instead of
   * the studio — genuinely cannot be bent mid-word, so those do restart the
   * line. But they restart it *after* the replacement is ready rather than
   * before, so the old line plays until the new one can take over. See
   * `swapCurrentLine`.
   *
   * All of it is debounced. A slider being dragged produces a change per
   * pixel, and re-synthesising a line per pixel is how you turn a fader into a
   * stutter; a short settle means the fastest drag costs exactly one restart,
   * on the value the finger came to rest at.
   */
  updateOptions(patch: Partial<VoiceLoopOptions>): void {
    if (!this.options) return

    const before = this.options
    const after = { ...before, ...patch }
    this.options = after

    if (patch.volume != null && patch.volume !== before.volume) {
      this.voice.setLiveVolume?.(patch.volume)
    }

    /*
     * Speed, on a line this app is playing itself: no restart, no silence, no
     * wait. Only when the voice says it could not take it — the device voice,
     * or nothing currently speaking — does this fall through to saying the
     * line again.
     */
    if (
      onlySpeedChanged(before, after) &&
      this.speaking &&
      this.voice.setLiveRate?.(after.rate) === true
    ) {
      this.schedulePrime()
      return
    }

    if (this.reshapesCurrentLine(before, after)) {
      this.restartCurrentLine(voiceIdentityChanged(before, after))
      return
    }

    // The next lines are already being fetched under the old settings, so a
    // change of voice or speed makes those preloads worthless. Fetching the
    // new ones now means the change is heard on the next line rather than the
    // one after it.
    this.schedulePrime()
  }

  /**
   * True when a change alters the sound of the line currently being spoken.
   *
   * Rate and pitch are here as well as the voice itself: a studio line is
   * rendered audio, so its speed is baked into the clip, and a device
   * utterance's rate and pitch are fixed when it is handed to the platform.
   * Neither can be bent mid-word by anybody, so the only honest way to make
   * them instant is to say the line again.
   */
  private reshapesCurrentLine(
    before: VoiceLoopOptions,
    after: VoiceLoopOptions,
  ): boolean {
    return (
      before.voice !== after.voice ||
      before.preferDevice !== after.preferDevice ||
      (before.deviceVoiceURI ?? null) !== (after.deviceVoiceURI ?? null) ||
      before.rate !== after.rate ||
      before.pitch !== after.pitch
    )
  }

  /**
   * Say the current line again under the settings that are in force — as soon
   * as there is something to say it with.
   *
   * Nothing about the session moves: `index` and `cycles` are untouched, the
   * timer keeps running, the ambience keeps playing, and the gap between
   * passes — if the change arrived during one — is left alone, because
   * restarting a line during a deliberate silence would mean speaking in it.
   *
   * `eager` is true for the changes that arrive as a single deliberate choice
   * — picking a voice from a list — where fetching the replacement on the same
   * tick is exactly right. It is false for the ones that arrive as a drag,
   * where fetching on every event would queue a synthesis per pixel; those
   * settle first. Either way the restart itself waits for the audio.
   */
  private restartCurrentLine(eager: boolean): void {
    if (!this.running || this.paused || !this.options) return

    if (eager) this.primePreload()
    else this.schedulePrime()

    // Mid-gap: the change is already applied to the options and the line the
    // gap ends on will be spoken under them. Nothing to interrupt.
    if (this.gapCancel != null || this.pausedGapMs != null) return

    const index = this.index
    const cycles = this.cycles
    this.clearRestart()
    this.restartTimer = setTimeout(() => {
      this.restartTimer = null
      void this.swapCurrentLine(index, cycles)
    }, RESTART_SETTLE_MS) as unknown as number
  }

  /**
   * Wait for the replacement, then put it in — the whole point of which is
   * that there is no gap in between.
   *
   * ── Why the wait comes first ──
   *
   * This used to stop the line and then ask for the new one, which reads as
   * the obvious order and is the wrong one. A studio line under new settings
   * is a *new clip*: nothing has it, so it has to be synthesised, and on a
   * phone running the model itself that is a second or three. All of it was
   * spent in silence, with the interface showing a line nobody was reading —
   * the exact "massive delay after changing the speed" this is here to remove.
   *
   * Turned round, the cost disappears. The outgoing line keeps speaking while
   * its replacement is prepared, and the swap happens at the moment the audio
   * is in memory, which is a crossfade rather than a hole. Preparing it is
   * never wasted either: if it takes longer than the line has left, the loop
   * has simply moved on under the new settings by then, and the clip that was
   * being prepared is the one the next pass wants.
   *
   * Three guards decide whether the swap still makes sense when the audio
   * lands, and between them they cover everything that can happen while
   * waiting: a newer change (`swapToken`), the line ending on its own
   * (`index`/`cycles`), and the session stopping, pausing or entering its rest
   * between passes.
   */
  private async swapCurrentLine(index: number, cycles: number): Promise<void> {
    if (!this.running || this.paused || !this.options) return
    if (this.index !== index || this.cycles !== cycles) return

    const text = this.chunks[index]
    if (!text) return

    const token = (this.swapToken += 1)
    await this.voice
      .preload(text, this.speakSettings(this.options))
      .catch(() => undefined)

    if (token !== this.swapToken) return
    if (!this.running || this.paused || !this.options) return
    if (this.index !== index || this.cycles !== cycles) return
    if (this.gapCancel != null || this.pausedGapMs != null) return

    // Invalidate the line in flight, then say it again from the top. The
    // outgoing clip is stopped by `speak`'s own interrupt, which fades it
    // rather than cutting it.
    this.generation += 1
    this.speaking = false
    void this.speakCurrent(this.generation)
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

    // The first line is wanted in a moment; the ones behind it are wanted
    // after it, and the settling silence below is time to fetch them in.
    this.preloadAhead(0)

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
    this.clearRestart()
    this.clearPrime()
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
    this.clearRestart()
    this.clearPrime()
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

    /*
     * Ask for this line *before* asking for the ones after it.
     *
     * The order matters more than it looks, and only on the path that hurts.
     * An on-device model synthesises one line at a time, so whatever reaches
     * it first is what everything behind it waits for — and preloading first
     * meant the line somebody is waiting to hear was queued behind the line
     * they would want in four seconds' time. On a cold pass that doubled the
     * wait before the first word, every time.
     *
     * The call is started rather than awaited so the lookahead below is still
     * issued during this line rather than after it.
     */
    const speaking = this.voice.speak(text, this.speakSettings(options, {
      onStart: () => {
        if (generation !== this.generation) return
        this.handlers.onChunk?.(index, this.chunks.length, text)
      },
    }))

    // Fetch what comes next while this one is speaking. This is the whole
    // preload: by the time the gap ends, it is decoded and in memory.
    this.preloadAhead(index + 1)

    const outcome = await speaking

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
    // The opening of the next pass is wanted after the gap; ask for it now so
    // the gap is doing double duty.
    this.preloadAhead(0)
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

  private clearRestart(): void {
    if (this.restartTimer != null) {
      clearTimeout(this.restartTimer)
      this.restartTimer = null
    }
    // A swap that has not been made yet belongs to the restart that scheduled
    // it, so cancelling one cancels the other.
    this.swapToken += 1
  }

  private clearPrime(): void {
    if (this.primeTimer != null) {
      clearTimeout(this.primeTimer)
      this.primeTimer = null
    }
  }

  /**
   * Everything the voice needs to say a line the way it is currently set.
   *
   * One place, because `speak`, the preload that runs ahead of it and the
   * preload a swap waits on all have to describe the *same* audio — they are
   * addressed by a hash of exactly these values, so a field present in one and
   * missing from another is a cache that silently never hits, and a cache that
   * never hits is a synthesis before every line.
   */
  private speakSettings(
    options: VoiceLoopOptions,
    extra: Pick<SpeakSettings, 'onStart'> = {},
  ): SpeakSettings {
    return {
      voice: options.voice,
      speed: options.rate,
      pitch: options.pitch,
      volume: options.volume,
      priority: 'interrupt',
      prefer: options.preferDevice ? 'device' : 'studio',
      deviceVoiceURI: options.deviceVoiceURI ?? null,
      ...extra,
    }
  }

  /** Warm the cache for a line, wrapping around at the end of a pass. */
  private preload(index: number): void {
    const options = this.options
    if (!options || (!options.loop && index >= this.chunks.length)) return
    const wrapped = this.chunks.length > 0 ? index % this.chunks.length : 0
    const text = this.chunks[wrapped]
    if (!text) return
    void this.voice.preload(text, this.speakSettings(options))
  }

  /** The line at `from`, and the ones behind it, in the order they are wanted. */
  private preloadAhead(from: number): void {
    for (let step = 0; step < PRELOAD_AHEAD; step += 1) {
      this.preload(from + step)
    }
  }

  /** The line being spoken and the window after it, under the current settings. */
  private primePreload(): void {
    this.clearPrime()
    this.preloadAhead(this.index)
  }

  /**
   * The same, once the settings have stopped moving.
   *
   * A drag reports a value per frame, and each distinct speed or pitch is a
   * different clip — so priming on every event would queue sixty syntheses to
   * throw away fifty-nine of them, which on a phone is the model doing nothing
   * but wasted work at the exact moment the loop needs it.
   */
  private schedulePrime(): void {
    this.clearPrime()
    this.primeTimer = setTimeout(() => {
      this.primeTimer = null
      if (!this.running || this.paused) return
      this.preloadAhead(this.index)
    }, RESTART_SETTLE_MS) as unknown as number
  }
}

/**
 * True when the only thing that moved is the speed.
 *
 * Speed has a live answer that nothing else has — resampling the buffer — so
 * it is worth telling apart from a change that happens to include it.
 */
function onlySpeedChanged(
  before: VoiceLoopOptions,
  after: VoiceLoopOptions,
): boolean {
  return (
    before.rate !== after.rate &&
    before.voice === after.voice &&
    before.pitch === after.pitch &&
    before.preferDevice === after.preferDevice &&
    (before.deviceVoiceURI ?? null) === (after.deviceVoiceURI ?? null)
  )
}

/**
 * True when *who* is reading changed, as opposed to how they are reading.
 *
 * The distinction is about the shape of the gesture rather than the sound: a
 * voice is picked once from a list, so its replacement is worth fetching on
 * the same tick; a speed or a pitch is dragged, so it is worth waiting for the
 * finger to stop.
 */
function voiceIdentityChanged(
  before: VoiceLoopOptions,
  after: VoiceLoopOptions,
): boolean {
  return (
    before.voice !== after.voice ||
    before.preferDevice !== after.preferDevice ||
    (before.deviceVoiceURI ?? null) !== (after.deviceVoiceURI ?? null)
  )
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
