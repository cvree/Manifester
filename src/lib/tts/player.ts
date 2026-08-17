/**
 * Putting a decoded clip through the speakers, exactly once.
 *
 * This is where the difference between "the audio works" and "the audio feels
 * native" is actually made, and nearly all of it is about edges:
 *
 *  - **Nothing starts at `currentTime`.** A buffer scheduled for right now is
 *    scheduled for a moment that has already partly passed by the time the
 *    audio thread sees it, and what that sounds like is a clipped first
 *    consonant. Everything starts a fraction ahead.
 *  - **Nothing starts or stops at full gain.** A hard cut into a waveform is a
 *    step, and a step is a click — the sharpest, most obviously *wrong* noise
 *    a phone speaker can make. Ten milliseconds up, thirty down, and both are
 *    inaudible as anything but cleanliness.
 *  - **One voice at a time.** Interrupting is the common case in this app —
 *    somebody presses play, changes their mind, presses again — and two clips
 *    overlapping is the failure people describe as "it said it twice".
 *
 * The context is not created here. It belongs to `AudioBus`, which is the one
 * place in the app allowed to open the audio hardware, and it is shared with
 * the ambience and the brainwave layer so that a phone only ever sees a single
 * `AudioContext` from this app — which is also the only arrangement iOS is
 * reliably happy with.
 */

import { clampPlaybackRate } from './shape'
import type { SpeakOutcome } from './types'

/** Enough to be scheduled cleanly, short enough that nobody waits for it. */
const START_LEAD_SECONDS = 0.02
const FADE_IN_SECONDS = 0.01
const FADE_OUT_SECONDS = 0.03
/** Short enough to feel like the slider, long enough not to step. */
const LEVEL_RAMP_SECONDS = 0.08
/**
 * How long a live speed or pitch change takes to arrive.
 *
 * Longer than the level ramp, because this one is a glide in the voice rather
 * than in its loudness, and a step in playback rate is an audible lurch. A
 * tenth of a second reads as the voice settling into the new setting.
 */
const RATE_RAMP_SECONDS = 0.12

export interface PlayOptions {
  /** 0–1. The app's own gain, not the engine's. */
  volume?: number
  /**
   * How fast the buffer runs, which is also its pitch. Comes from `voiceShape`
   * — the clip was rendered at a compensating speed so that the two multiply
   * back to the tempo that was asked for. See `shape.ts`.
   */
  playbackRate?: number
  /** Fired when the first sample is due at the speakers. */
  onStart?: () => void
}

export interface PlayHandle {
  /** Resolves once, whatever ends it. */
  readonly done: Promise<SpeakOutcome>
  stop(): void
}

/** How long after a clip is due to end before the watchdog gets involved. */
const WATCHDOG_GRACE_MS = 400

interface Active {
  source: AudioBufferSourceNode
  gain: GainNode
  settle: (outcome: SpeakOutcome) => void
  /** Context time the clip is due to finish, for the stall watchdog. */
  endsAt: number
  /** Context time the first sample is due, so progress can be measured. */
  startAt: number
  /** Seconds of buffer, whatever rate it is being played at. */
  duration: number
  /** The rate in force now — changed live by `setPlaybackRate`. */
  rate: number
  startTimer: number | null
  watchdog: number | null
}

export class AudioPlayer {
  private active: Active | null = null

  /**
   * Opens or wakes the shared context. Must be reachable synchronously from a
   * gesture the first time — see `AudioBus.ensure`.
   */
  private getContext: () => AudioContext | null

  constructor(getContext: () => AudioContext | null) {
    this.getContext = getContext
  }

  get isSpeaking(): boolean {
    return this.active != null
  }

  /**
   * When the current clip is due to end, in context time.
   *
   * Used by the loop's watchdog: a context that has been interrupted stops
   * advancing `currentTime`, so comparing the two is how the app can tell
   * "still speaking" from "stopped speaking without telling anyone".
   */
  get endsAt(): number | null {
    return this.active?.endsAt ?? null
  }

  /**
   * Open the audio hardware from inside a user gesture.
   *
   * Returns whether there is now a running context, which the caller uses to
   * decide whether it is worth preparing audio at all.
   */
  unlock(): boolean {
    const ctx = this.getContext()
    return ctx != null && ctx.state !== 'closed'
  }

  /**
   * Change the level of the line that is speaking *now*.
   *
   * The reason this exists rather than the volume simply applying to the next
   * line: a person dragging a volume slider is listening to the thing they are
   * dragging it for, and a fader whose effect arrives after the sentence ends
   * is a fader that feels broken. A clip is an `AudioBufferSourceNode` through
   * a gain this class owns, so unlike the device voice — whose volume is fixed
   * at the moment the utterance is handed over — the studio voice can simply
   * be turned down while it speaks.
   *
   * Ramped rather than assigned: a step on a live waveform is a click.
   */
  setVolume(value: number, rampSeconds = LEVEL_RAMP_SECONDS): void {
    const active = this.active
    const ctx = this.getContext()
    if (!active || !ctx || ctx.state === 'closed') return

    const target = Math.max(0.0001, clamp01(value))
    const now = ctx.currentTime
    try {
      active.gain.gain.cancelScheduledValues(now)
      active.gain.gain.setValueAtTime(active.gain.gain.value, now)
      active.gain.gain.linearRampToValueAtTime(target, now + rampSeconds)
    } catch {
      /* A node released between the check and the ramp. */
    }
  }

  /**
   * Change the speed — and so the pitch — of the line speaking *now*.
   *
   * The sibling of `setVolume`, and it exists for the same reason: somebody
   * moving the Speed slider is listening to the thing they are moving it for.
   * A clip cannot be re-rendered mid-word, but it can be resampled, and that
   * is instant where a re-synthesis is seconds.
   *
   * `endsAt` is recomputed rather than left alone, because it is what the
   * stall watchdog compares against: slowing a clip down without moving its
   * due time would have the watchdog declare it finished while it was still
   * speaking. The remaining buffer is measured at the old rate and re-timed at
   * the new one, which is exact enough — the ramp below is a tenth of a second
   * against a watchdog with four tenths of grace.
   */
  setPlaybackRate(value: number, rampSeconds = RATE_RAMP_SECONDS): void {
    const active = this.active
    const ctx = this.getContext()
    if (!active || !ctx || ctx.state === 'closed') return

    const target = clampPlaybackRate(value)
    if (Math.abs(target - active.rate) < 0.001) return

    const now = ctx.currentTime
    try {
      active.source.playbackRate.cancelScheduledValues(now)
      active.source.playbackRate.setValueAtTime(
        active.source.playbackRate.value,
        now,
      )
      active.source.playbackRate.linearRampToValueAtTime(target, now + rampSeconds)
    } catch {
      /* A node released between the check and the ramp. */
      return
    }

    const playedSeconds = Math.max(0, now - active.startAt) * active.rate
    const remaining = Math.max(0, active.duration - playedSeconds)
    active.rate = target
    active.endsAt = now + remaining / target
    // The watchdog already re-arms itself whenever the clip is not due yet, so
    // a later due time is picked up on its own; an earlier one is beaten by
    // `onended`. Nothing needs re-arming here.
  }

  play(buffer: AudioBuffer, options: PlayOptions = {}): PlayHandle {
    // Whatever was speaking is over the moment something else is asked for.
    const interrupted = this.active != null
    this.stop('interrupted')

    const ctx = this.getContext()
    if (!ctx || ctx.state === 'closed') {
      return { done: Promise.resolve<SpeakOutcome>('failed'), stop: () => undefined }
    }

    const volume = clamp01(options.volume ?? 1)
    const rate = clampPlaybackRate(options.playbackRate ?? 1)
    const gain = ctx.createGain()
    gain.connect(ctx.destination)

    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.playbackRate.value = rate
    source.connect(gain)

    /*
     * A clip that interrupted another waits for that one's fade to finish.
     *
     * Thirty milliseconds, once, at the moment somebody changes their mind —
     * far below anything a person can notice, and it is the difference between
     * "one voice at a time" being a description of the design and being a
     * description of the code. Starting during the outgoing fade would be two
     * sources running at once; both would be near silent, and "near" is not a
     * property worth relying on when the failure it protects against is
     * hearing a line twice.
     */
    const lead = interrupted ? START_LEAD_SECONDS + FADE_OUT_SECONDS : START_LEAD_SECONDS
    const startAt = ctx.currentTime + lead
    const fadeIn = Math.min(FADE_IN_SECONDS, buffer.duration / (4 * rate))
    gain.gain.setValueAtTime(0.0001, startAt)
    gain.gain.linearRampToValueAtTime(volume, startAt + fadeIn)

    let settled = false
    let settle!: (outcome: SpeakOutcome) => void
    const done = new Promise<SpeakOutcome>((resolve) => {
      settle = (outcome: SpeakOutcome) => {
        if (settled) return
        settled = true
        resolve(outcome)
      }
    })

    const active: Active = {
      source,
      gain,
      settle,
      endsAt: startAt + buffer.duration / rate,
      startAt,
      duration: buffer.duration,
      rate,
      startTimer: null,
      watchdog: null,
    }

    source.onended = () => {
      // `onended` fires for a natural finish *and* for `stop()`. Only the
      // former should be reported as one, and `stop` has already settled the
      // promise by the time it reaches here.
      if (this.active === active) this.active = null
      if (active.watchdog != null) {
        clearTimeout(active.watchdog)
        active.watchdog = null
      }
      if (active.startTimer != null) {
        clearTimeout(active.startTimer)
        active.startTimer = null
      }
      disconnect(active)
      settle('finished')
    }

    try {
      source.start(startAt)
    } catch {
      disconnect(active)
      settle('failed')
      return { done, stop: () => undefined }
    }

    this.active = active
    this.armWatchdog(active)

    /*
     * "Started" is when the sound arrives, not when it was scheduled.
     *
     * The player shows the line that is being spoken, and the gap between
     * those two moments is the lead time above. It is small; announcing the
     * line before the voice reaches it is exactly the kind of small wrongness
     * that reads as the screen running ahead of the audio.
     */
    if (options.onStart) {
      const untilAudible = Math.max(0, (startAt - ctx.currentTime) * 1000)
      active.startTimer = window.setTimeout(() => {
        active.startTimer = null
        if (this.active === active) options.onStart?.()
      }, untilAudible)
    }

    return {
      done,
      stop: () => {
        if (this.active === active) this.stop('interrupted')
      },
    }
  }

  /**
   * Notice a clip that stopped without saying so.
   *
   * `onended` is reliable while the context is running and is not fired at all
   * when the context stops running — which on iOS is a phone locking, a call
   * arriving, or another app taking the audio route. Without this, the loop
   * would sit forever waiting on a promise for audio that is never going to
   * finish, and the visible symptom is the worst kind: a session that looks
   * like it is playing and makes no sound.
   *
   * The check is against the context's own clock rather than the wall clock,
   * because a suspended context's time stops advancing. Time left on the audio
   * clock means the clip is genuinely still to come, and the watchdog simply
   * waits again.
   */
  private armWatchdog(active: Active): void {
    const ctx = this.getContext()
    if (!ctx) return
    const remainingMs = Math.max(0, (active.endsAt - ctx.currentTime) * 1000)

    active.watchdog = window.setTimeout(() => {
      active.watchdog = null
      if (this.active !== active) return

      const current = this.getContext()
      if (!current || current.state === 'closed') {
        this.active = null
        disconnect(active)
        active.settle('interrupted')
        return
      }

      if (current.state !== 'running') {
        // Interrupted or suspended: the clip is not going to arrive by itself.
        // Reporting it as interrupted is what lets the session's own recovery
        // put the line back once the context is running again.
        this.stop('interrupted')
        return
      }

      if (current.currentTime + 0.01 < active.endsAt) {
        this.armWatchdog(active)
        return
      }

      this.active = null
      try {
        active.source.stop()
      } catch {
        /* Already finished. */
      }
      disconnect(active)
      active.settle('finished')
    }, remainingMs + WATCHDOG_GRACE_MS)
  }

  /** Stop whatever is speaking, without a click. */
  stop(outcome: SpeakOutcome = 'interrupted'): void {
    const active = this.active
    if (!active) return
    this.active = null

    if (active.startTimer != null) {
      clearTimeout(active.startTimer)
      active.startTimer = null
    }
    if (active.watchdog != null) {
      clearTimeout(active.watchdog)
      active.watchdog = null
    }

    const ctx = this.getContext()
    if (ctx && ctx.state !== 'closed') {
      const now = ctx.currentTime
      try {
        active.gain.gain.cancelScheduledValues(now)
        // `setValueAtTime` at the *current* value first: cancelling leaves the
        // parameter wherever the last ramp had reached, and ramping from an
        // unstated value is what puts a click in a fade-out.
        active.gain.gain.setValueAtTime(active.gain.gain.value, now)
        active.gain.gain.linearRampToValueAtTime(0.0001, now + FADE_OUT_SECONDS)
        active.source.stop(now + FADE_OUT_SECONDS)
      } catch {
        try {
          active.source.stop()
        } catch {
          /* Already stopped. */
        }
      }
    }

    active.settle(outcome)
    // The node is disconnected by `onended`, which still fires after `stop()`.
  }

  /** Release everything. Called when the session provider unmounts. */
  dispose(): void {
    this.stop('interrupted')
  }
}

function disconnect(active: Active): void {
  try {
    active.source.disconnect()
    active.gain.disconnect()
  } catch {
    /* Disconnecting twice is harmless and throws on some engines. */
  }
  active.source.onended = null
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 1
  return Math.min(1, Math.max(0, value))
}
