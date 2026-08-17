/**
 * Speed and pitch, for a voice that is rendered audio.
 *
 * ── The problem ──
 *
 * A studio line is a clip. Once it exists, the only thing a browser will do to
 * it is play it at a different rate — and playing a clip faster raises its
 * pitch and shortens it at the same time. That is why pitch used to be a
 * device-voice-only control: the one lever available moved two things at once,
 * so a "Pitch" slider on a studio voice would silently have been a second,
 * worse Speed slider.
 *
 * ── The way out ──
 *
 * There are two levers, not one, and they move different pairs of things:
 *
 *   · the *engine's* speed, which stretches time and leaves pitch alone —
 *     Kokoro predicts durations, so asking for 0.9× is a slower reading in the
 *     same voice, not a slowed-down recording;
 *   · `playbackRate`, which moves pitch and time together.
 *
 * Run them against each other and each one gets a control of its own. Render
 * the line at `rate / pitch` and play it back at `pitch`: the two time factors
 * multiply back to `rate`, and what is left over is the pitch.
 *
 *     rate 1.0, pitch 1.15  →  rendered at 0.87×, played at 1.15×
 *                              tempo 1.0 (unchanged), voice a shade brighter
 *
 * So Fen can be lifted out of the bottom of his range without being hurried,
 * and Speed still means only speed.
 *
 * ── Why tempo is the one that is exact ──
 *
 * The engine's speed is clamped and rounded (`clampSpeed`), so `rate / pitch`
 * is not always available exactly. The playback rate is therefore derived back
 * *from the speed that was actually used*, which makes the tempo exactly what
 * was asked for at every setting and lets the pitch be the thing that gives at
 * the far corners of the range. That is the right way round: a loop's tempo is
 * part of its timing and somebody notices when it drifts, whereas the last
 * two per cent of a pitch shift is not something anybody can name.
 *
 * At pitch 1 — which is every clip this app ever generated before this file
 * existed, and every clip `npm run speech` ships — the maths collapses to
 * `speed = rate, playbackRate = 1`, so nothing is re-keyed and nothing that is
 * already on a device is orphaned.
 */

import { clampSpeed } from './cacheKey'

/**
 * How far a studio voice may be moved.
 *
 * Narrower than the device range (0.5–1.5) on purpose, and the reason is
 * audible: a neural voice pushed a long way from where it was trained stops
 * sounding like a person and starts sounding like a effect. A quarter of a
 * tone either way is enough to take the edge off a voice that reads too thin
 * or too heavy, which is the whole ask.
 */
export const STUDIO_PITCH = { min: 0.8, max: 1.25, step: 0.05 } as const

export function clampStudioPitch(value: number): number {
  if (!Number.isFinite(value)) return 1
  return Math.min(STUDIO_PITCH.max, Math.max(STUDIO_PITCH.min, value))
}

export interface VoiceShape {
  /**
   * The speed the engine is asked to render at, and therefore part of the
   * clip's address. Two different pitches are two different clips.
   */
  synthesisSpeed: number
  /** What the buffer is played at. This is where the pitch comes from. */
  playbackRate: number
}

/**
 * Split a wanted speed and pitch into a synthesis speed and a playback rate.
 *
 * Pure, and deliberately so: the same function decides the cache key, the
 * request to the engine, and what the player does with the buffer, which is
 * the only way those three can be guaranteed to agree.
 */
export function voiceShape(rate: number, pitch = 1): VoiceShape {
  const tempo = Number.isFinite(rate) ? rate : 1
  const wanted = clampStudioPitch(pitch)
  const synthesisSpeed = clampSpeed(tempo / wanted)
  // Derived from the speed that was actually used, so the tempo lands exactly
  // on `rate` even where the pitch had to be rounded off to get there.
  const playbackRate = synthesisSpeed > 0 ? tempo / synthesisSpeed : 1
  return { synthesisSpeed, playbackRate }
}

/**
 * The playback rate that makes a clip already rendered at `synthesisSpeed`
 * run at `rate`, whatever it was rendered for.
 *
 * This is what makes a speed or pitch change audible *now* rather than after
 * a re-synthesis. The line in the speakers cannot be re-rendered — it is
 * already a buffer — but it can be played at the rate that gives the new
 * tempo, and it is, on the same frame the slider moves. Its pitch goes along
 * for the ride for the rest of that one line; the line after it is rendered
 * properly and both are exactly right from then on.
 *
 * The alternative is what this app used to do: stop the line, synthesise it
 * again, and hold the silence in between. On a phone with the model on it,
 * that silence was seconds long.
 */
export function bridgeRate(rate: number, synthesisSpeed: number): number {
  const tempo = Number.isFinite(rate) ? rate : 1
  if (!(synthesisSpeed > 0)) return 1
  return clampPlaybackRate(tempo / synthesisSpeed)
}

/** Web Audio accepts far more than this; nothing here should ever want it. */
export function clampPlaybackRate(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1
  return Math.min(4, Math.max(0.25, value))
}
