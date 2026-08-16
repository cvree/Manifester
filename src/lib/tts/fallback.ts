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
    let settle!: (outcome: SpeakOutcome) => void
    const done = new Promise<SpeakOutcome>((resolve) => {
      settle = (outcome: SpeakOutcome) => {
        if (settled) return
        settled = true
        this.pending.delete(utterance)
        this.clearStall()
        this.stopKeepAlive()
        resolve(outcome)
      }
    })

    utterance.onstart = () => {
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
    this.armStallWatchdog(generation, settle)

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
    this.pending.clear()
    this.clearStall()
    this.stopKeepAlive()
    this.cancel()
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
  ): void {
    this.clearStall()
    const check = () => {
      if (generation !== this.generation) return
      const synth = window.speechSynthesis
      if (synth.speaking || synth.pending || synth.paused) {
        this.stallTimer = window.setTimeout(check, STALL_TIMEOUT_MS)
        return
      }
      settle('finished')
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
