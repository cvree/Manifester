/**
 * One-line summaries of every advanced setting.
 *
 * These are what let the Customize list stay collapsed: each row states its
 * own value, so you never have to open a panel to find out what it is set to.
 * They live here rather than in the components because the ritual preview and
 * the setting rows have to agree word for word.
 */

import { findVoice, type BreathSound } from './breathAudio'
import {
  cycleSeconds,
  findPreset,
  findStyle,
  formatSeconds,
  type BreathPattern,
  type BreathStyleId,
} from './breathing'
import {
  BRAINWAVE_LIST,
  formatHz,
  resolveMode,
  type BrainwaveSettings,
} from './brainwaveAudio'
import { backgroundChoiceName, type BackgroundChoice } from './environment'
import { hapticsSupported } from './feedback'
import { VOICE_PROFILES, voiceForStyle } from './tts/voices'
import type { LoopSettings, TrackMeta } from './types'
import type { RankedVoice } from './voiceRanking'

export function voiceSummary(
  settings: LoopSettings,
  resolved: RankedVoice | null,
): string {
  /*
   * The studio voice has a name of its own, which is most of why it exists:
   * "Ivy · 0.90×" is a description of a loop that will read the same way for
   * anybody who plays it, and "Samantha · 0.90×" was only ever a description
   * of one phone.
   */
  if (settings.voiceSource === 'studio') {
    return `${VOICE_PROFILES[voiceForStyle(settings.voiceStyle)].label} · ${settings.rate.toFixed(2)}×`
  }
  const name =
    settings.voiceName ??
    resolved?.name ??
    (settings.voiceStyle === 'feminine' ? 'Warm feminine' : 'Warm masculine')
  return `${name} · ${settings.rate.toFixed(2)}×`
}

/**
 * What is playing behind the words, without the level.
 *
 * The player's corner control is labelled with this rather than the full
 * summary: a screen reader should not have to hear a percentage that changes
 * every time the slider moves in order to find out which sound is on.
 */
export function soundName(settings: LoopSettings, tracks: TrackMeta[]): string {
  const { sound } = settings
  if (sound.mode === 'off') return 'No background sound'

  if (sound.mode === 'playlist') {
    const count = sound.playlist.length
    return count === 0
      ? 'Playlist · empty'
      : `Playlist · ${count} sound${count === 1 ? '' : 's'}`
  }

  const track = tracks.find((item) => item.id === sound.trackId)
  return track ? track.name : 'Choose a sound'
}

export function soundSummary(settings: LoopSettings, tracks: TrackMeta[]): string {
  const { sound, musicVolume } = settings
  const name = soundName(settings, tracks)
  if (sound.mode === 'off' || name === 'Choose a sound') return name
  if (sound.mode === 'playlist' && sound.playlist.length === 0) return name
  return `${name} · ${Math.round(musicVolume * 100)}%`
}

/** e.g. `"Alpha Waves · 10 Hz · Rhythmic modulation"`. */
export function brainwaveSummary(brainwave: BrainwaveSettings): string {
  if (!brainwave.enabled) return 'Off'
  const meta = BRAINWAVE_LIST.find((item) => item.id === brainwave.preset)
  if (!meta) return 'Off'
  const mode = resolveMode(brainwave.preset, brainwave.mode)
  return [
    meta.label,
    formatHz(meta.targetHz),
    mode === 'binaural' ? 'Binaural headphones' : 'Rhythmic modulation',
  ].join(' · ')
}

export function breathingSummary(
  enabled: boolean,
  pattern: BreathPattern,
  style?: BreathStyleId,
  sound?: BreathSound,
  background?: boolean,
  room?: BackgroundChoice,
): string {
  /*
   * The background visualiser has its own switch inside this panel and does
   * not need the guide, so "Off" on its own would be a lie the one time the
   * room is on and the guide is not.
   */
  if (!enabled) {
    return background
      ? `Guide off · ${room ? backgroundChoiceName(room) : 'background visualiser on'}`
      : 'Off'
  }
  const preset = findPreset(pattern)
  const shape = `${formatSeconds(pattern.inhale)} in / ${formatSeconds(pattern.exhale)} out`
  return [
    preset ? `${preset.name} · ${shape}` : `Custom · ${formatSeconds(cycleSeconds(pattern))}s`,
    style ? findStyle(style).name : null,
    // Worth its own word in the summary: it is the part that works when your
    // eyes are shut, and the part nobody expects a breathing guide to have.
    sound && sound !== 'off' ? findVoice(sound)?.name : null,
    // Which room is behind the player. Last, because it is the one part of
    // this row that is scenery rather than practice.
    background && room ? backgroundChoiceName(room) : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

export function delaySummary(seconds: number): string {
  if (seconds === 0) return 'No delay between loops'
  return `${seconds}-second delay`
}

export function timerSummary(minutes: number | null): string {
  return minutes == null ? 'Until I stop it' : `${minutes} minutes`
}

export function recordingSummary(recordingId: string | null): string {
  return recordingId
    ? 'Your voice is recorded'
    : 'Optional, for downloadable audio'
}

export function feelSummary(_uiSounds: boolean, uiHaptics: boolean): string {
  return uiHaptics && hapticsSupported() ? 'On' : 'Off'
}

export function exportSummary(
  settings: LoopSettings,
  hasRecording: boolean,
): string {
  if (hasRecording) return 'Your voice and sound, as a file'
  if (settings.sound.mode !== 'off') return 'Background sound only'
  return 'Nothing to include yet'
}

/**
 * The first sentence or line of a draft, for previews and the player. Falls
 * back to a placeholder rather than rendering an empty space.
 */
export function firstLine(text: string, fallback = 'Your words will appear here'): string {
  const line = text
    .split(/\n+/)
    .map((part) => part.trim())
    .find(Boolean)
  return line || fallback
}

/** Every non-empty line, for the preview's slow rotation. */
export function affirmationLines(text: string): string[] {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
}
