/** Shared domain types for Manifester. */

import type { RainCharacter } from './ambient'
import { DEFAULT_BRAINWAVE, type BrainwaveSettings } from './brainwaveAudio'

/** How the background sound layer is configured for a loop. */
export type SoundMode = 'off' | 'single' | 'playlist'

/** What happens when a playlist track finishes. */
export type RepeatMode = 'one' | 'all'

export interface SoundConfig {
  mode: SoundMode
  /** Track id used when `mode === 'single'`. */
  trackId: string | null
  /** Ordered track ids used when `mode === 'playlist'`. */
  playlist: string[]
  repeat: RepeatMode
  /** Density and brightness of Rain on Window, when that sound is chosen. */
  rainCharacter: RainCharacter
}

/** A background sound the user can pick. */
export interface TrackMeta {
  id: string
  name: string
  /** `builtin` tracks are generated live in the browser; `custom` are user files. */
  kind: 'builtin' | 'custom'
  /** Short line shown under the name in the Sounds tab. */
  description?: string
  mimeType?: string
  sizeBytes?: number
  durationSeconds?: number | null
  createdAt: number
}

/** Everything needed to recreate a listening session. */
export interface LoopSettings {
  /**
   * The headline choice.
   *
   * With the studio voice it names one specific person — `female_1` or
   * `male_1`, the same on every device. With a device voice it resolves to the
   * best-ranked voice of that style the device happens to have, which is what
   * it has always meant and why the two are worth telling apart.
   */
  voiceStyle: 'feminine' | 'masculine'
  /**
   * Who is reading: the app's own voice, or the platform's.
   *
   * `studio` is the default and is the same voice everywhere — it is
   * synthesised by this project's own service and cached as audio. `device`
   * is the browser's built-in speech, which differs on every phone and is also
   * what `studio` quietly falls back to when the service cannot be reached.
   */
  voiceSource: 'studio' | 'device'
  /**
   * Manual override for a device voice. When null, the ranked pick for
   * `voiceStyle` wins. Ignored entirely while `voiceSource` is `studio`.
   */
  voiceURI: string | null
  voiceName: string | null
  /**
   * A recording of the user's own voice, held in IndexedDB. Speech synthesis
   * cannot be captured by a browser, so this is what makes a real exported
   * audio file possible.
   */
  recordingId: string | null
  /** 0.5 – 1.6 */
  rate: number
  /** 0.5 – 1.5 */
  pitch: number
  /**
   * 0 – `MAX_VOICE_VOLUME` (see `speech.ts`), which is 1: the browser's own
   * ceiling on a spoken utterance, and so the app's. Some platforms ignore the
   * level entirely — see the README. A loop saved when this ran to 2 is brought
   * back into range by `normaliseSettings`.
   */
  voiceVolume: number
  /** 0 – `MAX_MUSIC_VOLUME` (see `audioBus.ts`). */
  musicVolume: number
  /** Silence between repetitions, in seconds. */
  repeatPauseSeconds: number
  /** `null` means "keep going until I stop it". */
  timerMinutes: number | null
  sound: SoundConfig
  /**
   * The generated brainwave rhythm. Off by default, and independent of `sound`
   * so either layer can play without the other.
   */
  brainwave: BrainwaveSettings
}

export interface SavedLoop extends LoopSettings {
  id: string
  title: string
  text: string
  createdAt: number
  updatedAt: number
  lastPlayedAt: number | null
}

/** The player's lifecycle. */
export type SessionStatus = 'idle' | 'playing' | 'paused' | 'complete'

export const DEFAULT_SOUND: SoundConfig = {
  mode: 'single',
  trackId: 'moon-garden',
  playlist: [],
  repeat: 'all',
  rainCharacter: 'steady',
}

export const DEFAULT_SETTINGS: LoopSettings = {
  voiceStyle: 'feminine',
  voiceSource: 'studio',
  voiceURI: null,
  voiceName: null,
  recordingId: null,
  rate: 0.9,
  pitch: 1,
  // Clear, but not full-volume on the first use in a dark room.
  voiceVolume: 0.82,
  // Present without arriving loudly in a dark room.
  musicVolume: 0.4,
  repeatPauseSeconds: 3,
  timerMinutes: 10,
  sound: DEFAULT_SOUND,
  brainwave: DEFAULT_BRAINWAVE,
}

/** Roughly the largest file worth holding in browser storage. */
export const MAX_TRACK_BYTES = 40 * 1024 * 1024

export const TIMER_PRESETS: Array<{ label: string; minutes: number | null }> = [
  { label: '5 min', minutes: 5 },
  { label: '10 min', minutes: 10 },
  { label: '20 min', minutes: 20 },
  { label: '30 min', minutes: 30 },
  { label: 'Until I stop', minutes: null },
]
