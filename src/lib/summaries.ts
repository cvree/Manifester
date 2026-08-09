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
import { hapticsSupported } from './feedback'
import type { LoopSettings, TrackMeta } from './types'
import type { RankedVoice } from './voiceRanking'

export function voiceSummary(
  settings: LoopSettings,
  resolved: RankedVoice | null,
): string {
  const name =
    settings.voiceName ??
    resolved?.name ??
    (settings.voiceStyle === 'feminine' ? 'Warm feminine' : 'Warm masculine')
  return `${name} · ${settings.rate.toFixed(2)}×`
}

export function soundSummary(settings: LoopSettings, tracks: TrackMeta[]): string {
  const { sound, musicVolume } = settings
  if (sound.mode === 'off') return 'No background sound'

  const level = `${Math.round(musicVolume * 100)}%`

  if (sound.mode === 'playlist') {
    const count = sound.playlist.length
    return count === 0
      ? 'Playlist · empty'
      : `Playlist · ${count} sound${count === 1 ? '' : 's'} · ${level}`
  }

  const track = tracks.find((item) => item.id === sound.trackId)
  return track ? `${track.name} · ${level}` : 'Choose a sound'
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
): string {
  /*
   * The background visualiser has its own switch inside this panel and does
   * not need the guide, so "Off" on its own would be a lie the one time the
   * room is on and the guide is not.
   */
  if (!enabled) return background ? 'Guide off · background visualiser on' : 'Off'
  const preset = findPreset(pattern)
  const shape = `${formatSeconds(pattern.inhale)} in / ${formatSeconds(pattern.exhale)} out`
  return [
    preset ? `${preset.name} · ${shape}` : `Custom · ${formatSeconds(cycleSeconds(pattern))}s`,
    style ? findStyle(style).name : null,
    // Worth its own word in the summary: it is the part that works when your
    // eyes are shut, and the part nobody expects a breathing guide to have.
    sound && sound !== 'off' ? findVoice(sound)?.name : null,
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

export function feelSummary(uiSounds: boolean, uiHaptics: boolean): string {
  const parts = [
    uiSounds ? 'Interface sounds on' : null,
    uiHaptics && hapticsSupported() ? 'Haptics on' : null,
  ].filter(Boolean)
  return parts.length > 0 ? parts.join(' · ') : 'Quiet'
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
