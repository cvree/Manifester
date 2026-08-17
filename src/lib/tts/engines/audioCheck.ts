/**
 * Is what came out of the model actually speech?
 *
 * This file exists because of the one failure mode a text-to-speech engine has
 * that nothing else in the stack can see: **it worked, and the audio is
 * rubbish**. Every other way an install can go wrong throws — a graph that will
 * not build, a runtime that will not load, a file that will not parse — and the
 * worker reports it, the page shows a sentence, and the person presses Try
 * again. A backend that runs the graph happily and returns a second of static
 * throws nothing at all. The install says *Installed*, the card says *Private ·
 * Free · Offline*, and then every line somebody writes comes back as noise.
 *
 * That is exactly what happened. Studio Voice was brought up on WebGPU with the
 * quantised weights, which onnxruntime-web will run without complaint on a
 * great many devices and produce corrupted output on a good number of them (see
 * `runtime.ts` for the full account). The worker's warm-up asked the model to
 * say one word and checked only that the call did not throw — so the broken
 * backend passed, was recorded as ready, and the *pre-generated* clips carried
 * on sounding perfect because they are static files. The only thing that
 * sounded wrong was the one thing this feature exists for: a person's own
 * words.
 *
 * So the warm-up now listens to itself. The checks below are deliberately
 * coarse — this is not a speech recogniser and must never reject a voice that
 * works — but every one of them is something a second of real speech cannot do
 * and a broken graph does constantly: samples that are not numbers, silence,
 * a solid wall of full-scale clipping, or a signal whose sign changes on nearly
 * every sample, which is the signature of noise rather than of a voice.
 */

/** What the inspection concluded, and why. */
export interface SpeechCheck {
  ok: boolean
  /** Present when `ok` is false: a short phrase for the failure message. */
  reason?: string
  /** The measurements, so a bug report can carry numbers rather than a verdict. */
  detail: {
    seconds: number
    peak: number
    rms: number
    /** Fraction of samples at or beyond full scale. */
    clipped: number
    /** Fraction of neighbouring sample pairs that change sign. */
    crossings: number
  }
}

/**
 * The thresholds, and why each one is where it is.
 *
 * All of them are set to be *hard to trip*, because the cost of the two
 * mistakes is not symmetric. A false negative here means somebody hears one bad
 * line and presses Try again; a false positive means a device that could have
 * run Studio Voice perfectly well is told it cannot, after a ninety-megabyte
 * download. So each bound sits well outside anything speech does, not at the
 * edge of it.
 */

/** Below this there is nothing to judge — a clip that short is not a word. */
const MIN_SECONDS = 0.15

/** Quiet speech peaks around 0.1; a Kokoro line peaks near 0.5. */
const MIN_PEAK = 0.01

/**
 * Speech is mostly silence between the sounds, so its RMS is low — 0.02 to 0.15
 * for a normal line. A continuous signal is the only thing that gets near this.
 */
const MAX_RMS = 0.5

/** A tenth of a clip pinned at full scale is not a voice, it is a fault. */
const MAX_CLIPPED = 0.1

/**
 * Zero crossings per sample.
 *
 * White noise sits around 0.5 — every sample is an independent coin flip about
 * the sign. Speech at 24 kHz is an order of magnitude below that, because even
 * the hissiest fricative is band-limited and the voiced parts are periodic at a
 * few hundred hertz. 0.4 is close enough to noise that nothing else reaches it.
 */
const MAX_CROSSINGS = 0.4

export function inspectSpeech(
  samples: Float32Array,
  sampleRate: number,
): SpeechCheck {
  const seconds = sampleRate > 0 ? samples.length / sampleRate : 0
  const detail = { seconds, peak: 0, rms: 0, clipped: 0, crossings: 0 }

  if (samples.length === 0 || sampleRate <= 0) {
    return { ok: false, reason: 'no audio at all', detail }
  }

  let peak = 0
  let sumSquares = 0
  let clipped = 0
  let crossings = 0
  let previous = 0

  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index]
    /*
     * A single NaN is enough, and it is the most common shape of this failure:
     * a backend that has produced garbage very often produces `NaN` rather than
     * a wrong number, and every statistic computed from it is `NaN` too — so
     * the comparisons below would all be false and a completely dead clip would
     * pass every one of them.
     */
    if (!Number.isFinite(sample)) {
      return { ok: false, reason: 'samples that are not numbers', detail }
    }

    const magnitude = sample < 0 ? -sample : sample
    if (magnitude > peak) peak = magnitude
    sumSquares += sample * sample
    if (magnitude >= 0.99) clipped += 1
    if (index > 0 && sample !== 0 && previous !== 0 && sample > 0 !== previous > 0) {
      crossings += 1
    }
    if (sample !== 0) previous = sample
  }

  detail.peak = peak
  detail.rms = Math.sqrt(sumSquares / samples.length)
  detail.clipped = clipped / samples.length
  detail.crossings = crossings / samples.length

  if (seconds < MIN_SECONDS) return { ok: false, reason: 'far too short', detail }
  if (peak < MIN_PEAK) return { ok: false, reason: 'silence', detail }
  if (detail.clipped > MAX_CLIPPED) {
    return { ok: false, reason: 'clipping from end to end', detail }
  }
  if (detail.rms > MAX_RMS) return { ok: false, reason: 'a continuous roar', detail }
  if (detail.crossings > MAX_CROSSINGS) {
    return { ok: false, reason: 'noise rather than a voice', detail }
  }

  return { ok: true, detail }
}

/** The measurements as one line, for the trail on the install card. */
export function describeCheck(check: SpeechCheck): string {
  const { seconds, peak, rms, clipped, crossings } = check.detail
  return (
    `${seconds.toFixed(2)}s peak ${peak.toFixed(3)} rms ${rms.toFixed(3)} ` +
    `clipped ${(clipped * 100).toFixed(1)}% crossings ${crossings.toFixed(3)}`
  )
}
