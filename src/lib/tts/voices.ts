/**
 * Who `female_1` and `male_1` actually are.
 *
 * One table, in one file, and it is the only place in the app that knows a
 * Kokoro voice name. Everything upstream — the settings, the player, the
 * pre-generation script, the backend — passes the logical name around and
 * never learns what it resolves to.
 *
 * Changing a mapping here is changing what a saved loop sounds like, so it
 * goes hand in hand with `VOICE_VERSION` in `versions.ts`: the old clips keep
 * their old keys, the new mapping gets new ones, and nothing has to be purged.
 */

import type { LogicalVoice } from './types.ts'

export interface VoiceProfile {
  id: LogicalVoice
  /** What the app calls this voice on screen. */
  label: string
  /** One line for the picker. */
  description: string
  /** Which of the app's two style cards this voice answers to. */
  style: 'feminine' | 'masculine'
  /** The engine's own name for it. */
  engineVoice: string
  /**
   * What `speechSynthesis` should reach for when the engine is unreachable.
   * Not a promise of a match — device voices are whatever the device has —
   * only a direction to look in.
   */
  fallbackStyle: 'feminine' | 'masculine'
}

export const VOICE_PROFILES: Record<LogicalVoice, VoiceProfile> = {
  female_1: {
    id: 'female_1',
    label: 'Ivy',
    description: 'Warm, unhurried, close to the microphone.',
    style: 'feminine',
    engineVoice: 'af_heart',
    fallbackStyle: 'feminine',
  },
  male_1: {
    id: 'male_1',
    label: 'Fen',
    description: 'Low and steady, with room around the words.',
    style: 'masculine',
    engineVoice: 'am_fenrir',
    fallbackStyle: 'masculine',
  },
}

export const LOGICAL_VOICES: LogicalVoice[] = ['female_1', 'male_1']

export function voiceProfile(voice: LogicalVoice): VoiceProfile {
  return VOICE_PROFILES[voice] ?? VOICE_PROFILES.female_1
}

/** The engine's name for a logical voice. */
export function engineVoiceFor(voice: LogicalVoice): string {
  return voiceProfile(voice).engineVoice
}

/** The app's long-standing feminine/masculine setting, as a logical voice. */
export function voiceForStyle(style: 'feminine' | 'masculine'): LogicalVoice {
  return style === 'masculine' ? 'male_1' : 'female_1'
}
