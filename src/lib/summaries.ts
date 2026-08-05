/**
 * One-line summaries of every advanced setting.
 *
 * These are what let the Customize list stay collapsed: each row states its
 * own value, so you never have to open a panel to find out what it is set to.
 * They live here rather than in the components because the ritual preview and
 * the setting rows have to agree word for word.
 */

import { cycleSeconds, findPreset, type BreathPattern } from './breathing'
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

export function breathingSummary(
  enabled: boolean,
  pattern: BreathPattern,
): string {
  if (!enabled) return 'Off'
  const preset = findPreset(pattern)
  const shape = `${pattern.inhale} in / ${pattern.exhale} out`
  return preset ? `${preset.name} · ${shape}` : `Custom · ${cycleSeconds(pattern)}s`
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
