/**
 * The emergency voice.
 *
 * `speechSynthesis` used to be how this app spoke, and it is now what happens
 * when the studio voice cannot be had: no backend on this deployment, no
 * network on this phone, nothing cached for this line, a synthesis that took
 * too long. It is a genuine step down in quality — that is why it stopped
 * being the default — and it is a very large step up from silence, which is
 * the only other thing on offer at that point.
 *
 * Everything here is per-utterance. The looping, the gaps, the watchdogs and
 * the recovery all live one level up in `voiceLoop.ts` and are the same for
 * both voices, which is what stops the fallback from being a second
 * implementation of the feature that only gets exercised when something is
 * already going wrong.
 */

import { applyDeviceVoice } from '../deviceVoice'
import { isSpeechSupported } from '../speech'
import type { RankedVoice } from '../voiceRanking'
import type { SpeakOutcome } from './types'

/** Chrome stops speaking after ~15 seconds unless the queue is nudged. */
const KEEPALIVE_INTERVAL_MS = 9000
/** If nothing is speaking or pending for this long, the utterance is over. */
const STALL_TIMEOUT_MS = 2500
/**
 * How long an utterance may claim to be speaking without ever having started.
 *
 * `speechSynthesis` on a phone will accept a `speak()` and then never run it:
 * the queue was cancelled a moment earlier and has not finished flushing, the
 * app was in the background when the utterance was handed over, or the engine
 * simply lost it. It goes on reporting `speaking === true` throughout, so the
 * watchdog's usual test — "is anything in the queue?" — says yes forever, the
 * promise never settles, and the loop above waits on a line that is never
 * coming. That is a session that ends without ending.
 *
 * The signal that it is a ghost is `onstart` never having fired. The number is
 * deliberately far larger than any plausible start-up delay, because being
 * wrong in this direction cuts off a line that *is* being spoken — on an
 * engine that speaks without firing `onstart`, which is not supposed to exist
 * but is not worth risking a truncated affirmation over. Fifteen seconds is
 * longer than the app's own longest line and long enough that anything still
 * silent is not merely slow.
 */
const UNSTARTED_GRACE_MS = 15_000

const isAppleMobile = (): boolean =>
  typeof navigator !== 'undefined' &&
  (/iP(hone|ad|od)/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))

export interface FallbackOptions {
  style: 'feminine' | 'masculine'
  /** An exact device voice, when the person has chosen one. */
  voiceURI?: string | null
  /**
   * The language of the words, as a BCP-47 tag.
   *
   * Passed down rather than inferred, and never omitted for English content.
   * An utterance with no `lang` is resolved by the engine against the page or
   * the platform's own locale, which is how English affirmations were being
   * read aloud by a Chinese voice on a phone whose menus are in Chinese. See
   * `voiceLanguage.ts`.
   */
  lang?: string | null
  rate: number
  pitch: number
  volume: number
  onStart?: () => void
}

export interface FallbackHandle {
  done: Promise<SpeakOutcome>
  stop: () => void
}

export class FallbackVoice {
  private voices: RankedVoice[] = []
  private raw: SpeechSynthesisVoice[] = []
  /** Held so Chrome cannot collect an utterance that is still speaking. */
  private pending = new Set<SpeechSynthesisUtterance>()
  private keepAlive: number | null = null
  private stallTimer: number | null = null
  private generation = 0
  /**
   * How to end the utterance in flight, from outside its own closure.
   *
   * Without this, `stop()` cancelled the queue and *hoped* the engine would
   * fire `onerror` — which is the ordinary behaviour and is not a guarantee.
   * When it did not, the promise the loop was awaiting never settled and the
   * session stopped for good: no next line, no error, no way back. Holding the
   * settler means stopping is something this class does rather than something
   * it asks the platform to do for it.
   */
  private settleActive: ((outcome: SpeakOutcome) => void) | null = null

  get supported(): boolean {
    return isSpeechSupported()
  }

  get isSpeaking(): boolean {
    return this.pending.size > 0
  }

  setVoices(raw: SpeechSynthesisVoice[], ranked: RankedVoice[]): void {
    this.raw = raw
    this.voices = ranked
  }

  speak(text: string, options: FallbackOptions): FallbackHandle {
    if (!this.supported || !text.trim()) {
      return { done: Promise.resolve<SpeakOutcome>('failed'), stop: () => undefined }
    }

    this.stop()
    this.generation += 1
    const generation = this.generation

    const synth = window.speechSynthesis
    const utterance = new SpeechSynthesisUtterance(text)

    applyDeviceVoice(utterance, this.raw, this.voices, {
      voiceURI: options.voiceURI,
      style: options.style,
      lang: options.lang,
    })
    utterance.rate = clamp(options.rate, 0.1, 4)
    utterance.pitch = clamp(options.pitch, 0, 2)
    utterance.volume = clamp(options.volume, 0, 1)

    let settled = false
    let started = false
    let settle!: (outcome: SpeakOutcome) => void
    const done = new Promise<SpeakOutcome>((resolve) => {
      settle = (outcome: SpeakOutcome) => {
        if (settled) return
        settled = true
        this.pending.delete(utterance)
        if (this.settleActive === settle) this.settleActive = null
        this.clearStall()
        this.stopKeepAlive()
        resolve(outcome)
      }
    })
    this.settleActive = settle

    utterance.onstart = () => {
      started = true
      if (generation === this.generation) options.onStart?.()
    }
    utterance.onend = () => settle('finished')
    utterance.onerror = (event) => {
      const error = (event as SpeechSynthesisErrorEvent).error
      settle(error === 'interrupted' || error === 'canceled' ? 'interrupted' : 'failed')
    }

    this.pending.add(utterance)

    try {
      synth.speak(utterance)
    } catch {
      settle('failed')
      return { done, stop: () => undefined }
    }

    this.startKeepAlive()
    this.armStallWatchdog(generation, settle, () => started)

    return {
      done,
      stop: () => {
        if (generation !== this.generation) return
        settle('interrupted')
        this.cancel()
      },
    }
  }

  stop(): void {
    this.generation += 1
    const settle = this.settleActive
    this.settleActive = null
    this.pending.clear()
    this.clearStall()
    this.stopKeepAlive()
    this.cancel()
    // After the cancel, so an engine that does fire `onerror` has already run
    // and this is a no-op; before anything can await it again, so an engine
    // that does not cannot leave the caller waiting forever.
    settle?.('interrupted')
  }

  /**
   * Un-pause an engine that was paused by something other than this app.
   *
   * iOS suspends `speechSynthesis` when the page goes away and does not always
   * start it again on the way back; Chrome can be left paused by its own
   * keep-alive if the tab was frozen between the `pause()` and the `resume()`.
   * Either way the utterance is still there, still `paused`, and will sit like
   * that indefinitely — a session that looks like it is speaking and is not.
   *
   * Called when the app returns to the foreground. Harmless at any other time:
   * resuming an engine that is not paused does nothing.
   */
  resumeIfPaused(): void {
    if (!this.supported) return
    try {
      const synth = window.speechSynthesis
      if (synth.paused) synth.resume()
    } catch {
      /* Some engines throw on an empty queue. */
    }
  }

  /* ── internals ── */

  private cancel(): void {
    if (!this.supported) return
    try {
      window.speechSynthesis.cancel()
    } catch {
      /* Cancelling an empty queue throws on some older engines. */
    }
  }

  /**
   * Some engines drop an utterance without ever firing `onend`.
   *
   * The watchdog only fires when nothing is speaking, pending or paused, so it
   * cannot cut a live utterance short — and without it a loop would simply
   * stop, silently, on the line where the engine gave up.
   */
  private armStallWatchdog(
    generation: number,
    settle: (outcome: SpeakOutcome) => void,
    hasStarted: () => boolean,
  ): void {
    this.clearStall()
    const askedAt = Date.now()
    const check = () => {
      if (generation !== this.generation) return
      const synth = window.speechSynthesis

      /*
       * Paused is not progress.
       *
       * This used to count as "still going" and wait, which is right for the
       * fraction of a second the keep-alive spends there and wrong for every
       * other way an engine ends up paused — a phone that locked, a page that
       * was frozen between a `pause()` and its `resume()`. Those never come
       * back on their own, so the watchdog asks, and only counts it as
       * progress if the asking worked.
       */
      if (synth.paused) {
        try {
          synth.resume()
        } catch {
          /* Nothing to resume. */
        }
      }

      if (synth.speaking || synth.pending || synth.paused) {
        /*
         * Speaking, but never actually started, for long enough that the
         * engine is not merely slow. Reporting this as a finish would have the
         * loop move on as though the line had been heard; reporting it as a
         * failure is what it is, and the loop already knows how to rest and
         * try again rather than race.
         */
        if (!hasStarted() && Date.now() - askedAt >= UNSTARTED_GRACE_MS) {
          this.cancel()
          settle('failed')
          return
        }
        this.stallTimer = window.setTimeout(check, STALL_TIMEOUT_MS)
        return
      }

      // Nothing in the queue at all. If a word was ever spoken this is an end;
      // if not, the utterance was dropped before it began.
      settle(hasStarted() ? 'finished' : 'failed')
    }
    this.stallTimer = window.setTimeout(check, STALL_TIMEOUT_MS)
  }

  private clearStall(): void {
    if (this.stallTimer != null) {
      clearTimeout(this.stallTimer)
      this.stallTimer = null
    }
  }

  /**
   * Chrome on the desktop stops after roughly fifteen seconds of continuous
   * speech; a pause/resume pair resets its timer. iOS Safari reacts badly to
   * the same trick, so it is skipped there.
   */
  private startKeepAlive(): void {
    this.stopKeepAlive()
    if (isAppleMobile()) return
    this.keepAlive = window.setInterval(() => {
      const synth = window.speechSynthesis
      if (synth.speaking && !synth.paused) {
        synth.pause()
        synth.resume()
      }
    }, KEEPALIVE_INTERVAL_MS)
  }

  private stopKeepAlive(): void {
    if (this.keepAlive != null) {
      clearInterval(this.keepAlive)
      this.keepAlive = null
    }
  }
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}
