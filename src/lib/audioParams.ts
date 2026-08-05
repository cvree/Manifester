/**
 * Small Web Audio primitives shared by the generated-sound modules.
 *
 * Both of these exist because a browser's own answer to the same problem is not
 * consistent enough to build on.
 */

/**
 * Cancel a param's future automation and pin it to the value it has reached.
 *
 * This is the operation that decides whether retargeting a sound clicks: drop
 * the scheduled ramp without pinning first and the value snaps back to whatever
 * the previous event left, which is audible.
 *
 * `cancelAndHoldAtTime` is nominally the API for exactly this, and it is
 * deliberately *not* used. Measured against `node-web-audio-api`, interrupting
 * one ramp and starting another through it leaves the param at roughly double
 * its target and then steps hard on the next change — where this spelling
 * renders a continuous envelope whose largest sample-to-sample jump is the
 * carrier's own slew rate. Both engines report the in-progress automation value
 * from `param.value`, which is all this needs, and this is the pattern that has
 * been deployed for a decade.
 *
 * `when` must be the context's current time, because `param.value` is a reading
 * of *now*.
 */
export function holdParamAt(param: AudioParam, when: number): void {
  param.cancelScheduledValues(when)
  param.setValueAtTime(param.value, when)
}

/**
 * Move a param to a new value over `seconds`, starting from whatever value it
 * had actually reached.
 *
 * Every audible gain change in the app goes through here, which is what keeps
 * them all click-free: the hold pins the current value, and a linear ramp takes
 * it somewhere else without a step.
 *
 * `when` must be the context's current time, for the reason `holdParamAt` gives.
 * The app has no reason to want otherwise: every one of these is a response to
 * something the user just did.
 */
export function rampParam(
  param: AudioParam,
  target: number,
  seconds: number,
  when: number,
): void {
  holdParamAt(param, when)
  if (seconds <= 0) param.setValueAtTime(target, when)
  else param.linearRampToValueAtTime(target, when + seconds)
}

/** Below this a soft ceiling is exactly the identity function. */
export const CEILING_LINEAR_TO = 0.7
/** How hard it bends above that, and so where it tops out: 0.7 + 0.25. */
export const CEILING_KNEE = 0.25

/**
 * A soft-clip ceiling: perfectly linear up to `linearTo`, then bending to a hard
 * stop at `linearTo + knee`.
 *
 * Deliberately a fixed curve rather than a `DynamicsCompressorNode`. A
 * compressor is the more musical answer to a stacked mix, but how it behaves is
 * up to the engine, and the differences are not small — `node-web-audio-api`
 * applies about 2.5 dB of makeup gain below its own threshold where Chrome
 * applies none, which would make the whole app louder on one engine than
 * another. A waveshaper is arithmetic: the same input gives the same output
 * everywhere, and the output cannot exceed the curve's own maximum no matter
 * what arrives.
 *
 * It is also transparent where it matters. Ordinary listening peaks around 0.11
 * and the loudest single soundscape at full volume reaches about 0.33 — all
 * inside the linear region, where this is exactly the identity. That is what
 * lets it sit in the path of a binaural pair without touching the channel
 * separation the beat depends on.
 */
export function createSoftCeiling(
  ctx: BaseAudioContext,
  linearTo = CEILING_LINEAR_TO,
  knee = CEILING_KNEE,
  points = 4096,
): WaveShaperNode {
  const curve = new Float32Array(points)
  for (let i = 0; i < points; i += 1) {
    const x = (i / (points - 1)) * 2 - 1
    const magnitude = Math.abs(x)
    const shaped =
      magnitude <= linearTo
        ? magnitude
        : linearTo + Math.tanh((magnitude - linearTo) / knee) * knee
    curve[i] = Math.sign(x) * shaped
  }

  const shaper = ctx.createWaveShaper()
  shaper.curve = curve
  // The curve only bends near the top, so oversampling costs little and keeps
  // that bend from folding harmonics back down into the audible range.
  shaper.oversample = '2x'
  return shaper
}
