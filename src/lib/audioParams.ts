/**
 * Small Web Audio primitives shared by the generated-sound modules.
 *
 * Every one of them exists because a browser's own answer to the same problem
 * is not consistent enough to build on: `cancelAndHoldAtTime` for holding a
 * ramp, `setValueCurveAtTime` for shaping one, and `DynamicsCompressorNode`
 * for keeping a mix inside full scale. The replacements here are arithmetic,
 * and so behave the same on every engine.
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
 *
 * `oversample` is deliberately left at its default, `'none'`. Oversampling
 * exists to soften the aliasing a hard bend produces, but doing that resamples
 * through a filter that can ring past the curve's own peak — measured on
 * `'2x'`, pushing this exact curve with the extreme, no-real-session-does-this
 * input the tests use came back *louder than full scale*, which is precisely
 * what a safety ceiling must never do. Without oversampling, a `WaveShaperNode`
 * is specified to clamp any input outside `[-1, 1]` to the curve's own boundary
 * sample, so the output can never exceed `linearTo + knee` — full stop, on
 * every engine, at every input. This node only ever bends on inputs already
 * loud enough that a little extra aliasing is the least of it.
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
  return shaper
}

/**
 * How many linear segments an equal-power fade is traced with.
 *
 * A cosine drawn as 24 straight lines is within 0.2% of the curve everywhere,
 * which is roughly a fiftieth of a decibel — inaudible, and the error is in the
 * shape rather than in the endpoints, which land exactly.
 */
const FADE_SEGMENTS = 24

/**
 * The equal-power position between two levels.
 *
 * A linear crossfade between two *uncorrelated* sources — two different pieces
 * of music, or two moments of the same one — loses 3 dB in the middle, because
 * power adds where amplitude does not: at the halfway point both sides are at
 * 0.5 and the sum carries half the energy either side had alone. Sine and
 * cosine are the pair whose squares sum to one, so a fade out along the cosine
 * against a fade in along the sine holds the level flat all the way across.
 *
 * Anchored at `from` rather than at 0 or 1 so an interrupted fade continues
 * from wherever it had reached instead of stepping back to the start of the
 * curve.
 */
function equalPowerAt(from: number, to: number, progress: number): number {
  const shape =
    to >= from
      ? Math.sin((Math.PI / 2) * progress)
      : 1 - Math.cos((Math.PI / 2) * progress)
  return from + (to - from) * shape
}

/**
 * Fade a param to a new level along an equal-power curve, starting from
 * whatever value it had actually reached.
 *
 * `setValueCurveAtTime` is the API that looks like it is for this, and it is
 * deliberately not used: it cannot be anchored at the current value, and
 * starting one over an automation that is still running is a
 * `NotSupportedError` on some engines and a step on others — which is exactly
 * the case this function exists to survive, because a crossfade in this app is
 * interrupted every time somebody navigates twice in three seconds. A chain of
 * short linear ramps has neither problem: it begins where `holdParamAt` pins
 * it, and starting another chain simply replaces the rest of this one.
 *
 * `when` must be the context's current time, for the reason `holdParamAt`
 * gives.
 */
export function fadeParam(
  param: AudioParam,
  target: number,
  seconds: number,
  when: number,
): void {
  holdParamAt(param, when)
  if (seconds <= 0) {
    param.setValueAtTime(target, when)
    return
  }

  const from = param.value
  for (let step = 1; step <= FADE_SEGMENTS; step += 1) {
    const progress = step / FADE_SEGMENTS
    param.linearRampToValueAtTime(
      equalPowerAt(from, target, progress),
      when + seconds * progress,
    )
  }
}

/**
 * The same curve, scheduled to happen later on a param nothing else is
 * automating.
 *
 * Used for the two halves of a loop's seam, which are written onto a gain node
 * created for one repetition and thrown away after it. Because that node's
 * automation is known in full at the moment it is built, the fade can be laid
 * down ahead of time — which is what lets a repetition be scheduled four
 * seconds early and still land sample-accurately, whatever the page is doing
 * when the moment arrives.
 */
export function scheduleFade(
  param: AudioParam,
  from: number,
  to: number,
  when: number,
  seconds: number,
): void {
  param.setValueAtTime(from, when)
  if (seconds <= 0) {
    param.setValueAtTime(to, when)
    return
  }

  for (let step = 1; step <= FADE_SEGMENTS; step += 1) {
    const progress = step / FADE_SEGMENTS
    param.linearRampToValueAtTime(
      equalPowerAt(from, to, progress),
      when + seconds * progress,
    )
  }
}
