/**
 * The background mix, as arithmetic.
 *
 * Everything in this file is pure. What is playing, how loud each part of it
 * is, what a mute does and what happens when the thing you muted is removed
 * are all decisions that can be made — and tested — without an `AudioContext`,
 * a component, or a running session. `MusicEngine` then does exactly what this
 * says, and `AmbienceMixer` draws exactly what this says.
 *
 * ── Why the mixer exists ──
 *
 * The background layer had one level for everything in it. That is fine while
 * "everything" is one soundscape, and it stops being fine the moment somebody
 * wants rain *under* a fire, or the tide two thirds as loud as the pad over it.
 * There was no way to ask for either: the sounds were a radio group, one at a
 * time, sharing a single fader with the brainwave rhythm.
 *
 * So a background source is a **layer** now, each with its own level and its
 * own mute, retained across a session and saved with the loop. The master
 * ambience fader is still there and still does what it always did — it scales
 * the whole bed at once — which is the right control to reach for nine times
 * out of ten and the wrong one for the tenth.
 */

import { findAmbientPreset, isBuiltInAmbientId } from './ambient'
import type { SoundConfig, TrackMeta } from './types'

/** Nothing in the mixer is louder than the level somebody set. */
export const MAX_LAYER_LEVEL = 1

/**
 * The level a layer nobody has touched plays at.
 *
 * Full, deliberately. A new layer arriving at half volume would be a layer
 * somebody adds, does not hear, and concludes is broken.
 */
export const DEFAULT_LAYER_LEVEL = 1

/**
 * How many generated ambiences may play at once, including the main choice.
 *
 * Each one is a live synthesis graph — filters, oscillators, and a rolling
 * scheduler laying transients onto the audio thread — so this is a real budget
 * on a mid-range phone rather than a tidiness rule. Four is comfortably more
 * combinations than anybody has asked for and comfortably inside what the
 * cheapest device this app targets can render without the rain thinning out.
 */
export const MAX_ACTIVE_LAYERS = 4

/** One row of the mixer: something making a sound, and what governs it. */
export interface MixerLayer {
  id: string
  name: string
  /** One short line, for the row's second line. */
  detail: string
  /** 0–1, as stored. Not multiplied by the master. */
  level: number
  muted: boolean
  /**
   * How this layer got into the mix.
   *
   * `primary` is the sound chosen in the Background sound panel — the one the
   * rest of the app already talks about. `layer` is one somebody stacked
   * underneath it here. The distinction matters in exactly one place: removing
   * the primary means choosing silence, so the mixer does not offer to.
   */
  kind: 'primary' | 'layer'
  /** True for imported files, which cannot be stacked. See `SoundConfig.layers`. */
  imported: boolean
}

export function clampLevel(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_LAYER_LEVEL
  return Math.min(MAX_LAYER_LEVEL, Math.max(0, value))
}

/** The stored level for one source, defaulting to full. */
export function levelOf(sound: SoundConfig, id: string): number {
  const stored = sound.levels?.[id]
  return stored == null ? DEFAULT_LAYER_LEVEL : clampLevel(stored)
}

export function isMuted(sound: SoundConfig, id: string): boolean {
  return sound.muted?.includes(id) === true
}

/**
 * What a source actually contributes: its level, or nothing while it is muted.
 *
 * The level is kept while muted rather than zeroed, which is the whole point
 * of mute being its own thing — unmuting returns you to the balance you had,
 * not to full.
 */
export function effectiveLevel(sound: SoundConfig, id: string): number {
  return isMuted(sound, id) ? 0 : levelOf(sound, id)
}

/* ── Editing ─────────────────────────────────────────────────── */

export function withLevel(sound: SoundConfig, id: string, level: number): SoundConfig {
  return {
    ...sound,
    levels: { ...sound.levels, [id]: clampLevel(level) },
    /*
     * Moving a muted layer's fader unmutes it. Anything else is a control that
     * visibly does nothing, and "why is this slider not working" is a worse
     * outcome than an unmute somebody did not explicitly ask for but plainly
     * meant.
     */
    muted: sound.muted.filter((muted) => muted !== id),
  }
}

export function withMuted(sound: SoundConfig, id: string, muted: boolean): SoundConfig {
  const without = sound.muted.filter((item) => item !== id)
  return { ...sound, muted: muted ? [...without, id] : without }
}

export function toggleMuted(sound: SoundConfig, id: string): SoundConfig {
  return withMuted(sound, id, !isMuted(sound, id))
}

/**
 * Add a generated ambience to the bed.
 *
 * Ignores anything that is already sounding — the primary choice included, so
 * "add Rain" while Rain is the main sound cannot produce two rains — and
 * anything past the budget, and anything that is not a built-in soundscape.
 */
export function withLayer(sound: SoundConfig, id: string): SoundConfig {
  if (!isBuiltInAmbientId(id)) return sound
  if (activeSourceIds(sound).includes(id)) return sound
  if (activeSourceIds(sound).length >= MAX_ACTIVE_LAYERS) return sound
  return { ...sound, layers: [...sound.layers, id] }
}

/**
 * Take a layer back out.
 *
 * Its level and mute are kept. Somebody who lifts the rain out for a minute
 * and puts it back gets the rain they had, not a fresh one at full volume.
 */
export function withoutLayer(sound: SoundConfig, id: string): SoundConfig {
  return { ...sound, layers: sound.layers.filter((layer) => layer !== id) }
}

export function hasLayer(sound: SoundConfig, id: string): boolean {
  return sound.layers.includes(id)
}

/* ── What is actually playing ────────────────────────────────── */

/**
 * The primary source id: the single sound, or the first of a playlist.
 *
 * A playlist still advances one track at a time, and the mixer shows whichever
 * is playing — see `describeMix`, which is given the live track name by the
 * player. `null` while the background is off.
 */
export function primarySourceId(sound: SoundConfig): string | null {
  if (sound.mode === 'off') return null
  if (sound.mode === 'playlist') return sound.playlist[0] ?? null
  return sound.trackId
}

/** Every id currently able to make a sound, primary first. */
export function activeSourceIds(sound: SoundConfig): string[] {
  const primary = primarySourceId(sound)
  const layers = sound.layers.filter((id) => id !== primary)
  return primary ? [primary, ...layers] : layers
}

/**
 * The mixer's rows, in the order they are drawn.
 *
 * `currentTrackId` is what the engine is playing right now, which differs from
 * `primarySourceId` only while a playlist is part-way through. Passing it in
 * rather than deriving it is what keeps the row somebody is adjusting the row
 * they are hearing.
 */
export function mixerLayers(
  sound: SoundConfig,
  tracks: TrackMeta[],
  currentTrackId?: string | null,
): MixerLayer[] {
  const primary =
    sound.mode === 'playlist' && currentTrackId
      ? currentTrackId
      : primarySourceId(sound)

  const describe = (id: string, kind: MixerLayer['kind']): MixerLayer => {
    const preset = findAmbientPreset(id)
    const track = tracks.find((item) => item.id === id)
    return {
      id,
      name: preset?.name ?? track?.name ?? 'Unknown sound',
      detail:
        preset?.description ??
        track?.description ??
        (track?.kind === 'custom' ? 'Your import' : 'Generated on this device'),
      level: levelOf(sound, id),
      muted: isMuted(sound, id),
      kind,
      imported: preset == null,
    }
  }

  const rows: MixerLayer[] = []
  if (primary) rows.push(describe(primary, 'primary'))
  for (const id of sound.layers) {
    if (id === primary) continue
    rows.push(describe(id, 'layer'))
  }
  return rows
}

/**
 * Whether two configurations differ in a way the *layer set* has to hear.
 *
 * The counterpart to `soundPlaybackChanged`, and separate from it for the same
 * reason: a level or a mute is applied to a running graph with a short ramp
 * and must never rebuild anything, while adding or removing a layer means
 * building or releasing a synthesis graph. Confusing the two is how a volume
 * slider ends up restarting the rain.
 */
export function layersChanged(a: SoundConfig, b: SoundConfig): boolean {
  if (a.layers.length !== b.layers.length) return true
  return a.layers.some((id, index) => id !== b.layers[index])
}

/** One line naming what is in the bed, for a summary row. */
export function describeMix(layers: MixerLayer[]): string {
  const audible = layers.filter((layer) => !layer.muted && layer.level > 0)
  if (layers.length === 0) return 'No background sound'
  if (audible.length === 0) return 'Every layer muted'
  return audible.map((layer) => layer.name).join(' · ')
}
