/**
 * Picking a background sound, as one decision rather than three settings.
 *
 * The sound layer is configured by a mode, a track id and a playlist, and
 * choosing "Ocean Tide" has always meant setting two of those at once. Every
 * screen that offered the choice did that arithmetic itself, which is how the
 * player and the library ended up disagreeing about what a tap means.
 *
 * It is one function now, and it is pure — the player can ask what a tap would
 * produce before deciding whether the change is worth disturbing live audio
 * for.
 */

import type { SoundConfig } from './types'

/** One thing a person can pick: silence, a sound, or the queued list. */
export type SoundChoice =
  | { kind: 'off' }
  | { kind: 'track'; id: string }
  | { kind: 'playlist' }

/** Which choice a configuration currently represents. */
export function currentSoundChoice(sound: SoundConfig): SoundChoice {
  if (sound.mode === 'off') return { kind: 'off' }
  if (sound.mode === 'playlist') return { kind: 'playlist' }
  return sound.trackId ? { kind: 'track', id: sound.trackId } : { kind: 'off' }
}

/** True when this choice is the one already in force. */
export function isSoundChoiceActive(
  sound: SoundConfig,
  choice: SoundChoice,
): boolean {
  const current = currentSoundChoice(sound)
  if (current.kind !== choice.kind) return false
  return current.kind === 'track' && choice.kind === 'track'
    ? current.id === choice.id
    : true
}

/**
 * The configuration one tap on a choice should produce.
 *
 * Picking a sound leaves the playlist untouched, so switching to a single
 * sound for a while and going back to the queue costs two taps rather than
 * rebuilding the list.
 */
export function chooseSound(sound: SoundConfig, choice: SoundChoice): SoundConfig {
  switch (choice.kind) {
    case 'off':
      return { ...sound, mode: 'off' }
    case 'playlist':
      return { ...sound, mode: 'playlist' }
    case 'track':
      return { ...sound, mode: 'single', trackId: choice.id }
  }
}

/**
 * Whether two configurations would put different audio through the engine.
 *
 * This is what keeps a live change surgical. Rain's character has its own
 * crossfade inside the engine — rebuilding the queue for it would restart the
 * ambience audibly — and repeat only reaches the engine when there is a queue
 * to repeat, so neither counts as a different sound.
 */
export function soundPlaybackChanged(a: SoundConfig, b: SoundConfig): boolean {
  if (a.mode !== b.mode) return true
  if (b.mode === 'off') return false
  if (b.mode === 'single') return a.trackId !== b.trackId
  return (
    a.repeat !== b.repeat ||
    a.playlist.length !== b.playlist.length ||
    a.playlist.some((id, index) => id !== b.playlist[index])
  )
}
