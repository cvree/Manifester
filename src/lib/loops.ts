import { isRainCharacter } from './ambient'
import { normaliseBrainwave } from './brainwaveAudio'
import { createId } from './format'
import { clampVoiceVolume } from './speech'
import { DEFAULT_SETTINGS, type LoopSettings, type SavedLoop } from './types'

/** The in-progress loop the Create tab edits. */
export interface Draft {
  /** Set once the draft has been saved, so editing updates rather than copies. */
  id: string | null
  title: string
  text: string
  settings: LoopSettings
}

/** Turn the current draft into a storable loop. */
export function draftToLoop(draft: Draft, existing?: SavedLoop | null): SavedLoop {
  const now = Date.now()
  return {
    ...draft.settings,
    sound: { ...draft.settings.sound },
    brainwave: { ...draft.settings.brainwave },
    id: draft.id ?? existing?.id ?? createId('loop'),
    title: draft.title.trim() || 'Untitled loop',
    text: draft.text,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    lastPlayedAt: existing?.lastPlayedAt ?? null,
  }
}

/** Split a saved loop back into the draft shape. */
export function loopToDraft(loop: SavedLoop): Draft {
  const {
    id,
    title,
    text,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    lastPlayedAt: _lastPlayedAt,
    ...settings
  } = loop
  return { id, title, text, settings: normaliseSettings(settings) }
}

/**
 * The launch loop. A played loop outranks an edited one; before anything has
 * been played, the most recently updated saved loop is the least surprising.
 */
export function pickLaunchLoop(loops: SavedLoop[]): SavedLoop | null {
  const usable = loops.filter((loop) => loop.text.trim().length > 0)
  if (usable.length === 0) return null
  const hasPlayed = usable.some((loop) => loop.lastPlayedAt != null)
  return [...usable].sort((a, b) => {
    const aTime = hasPlayed ? (a.lastPlayedAt ?? -1) : a.updatedAt
    const bTime = hasPlayed ? (b.lastPlayedAt ?? -1) : b.updatedAt
    return bTime - aTime
  })[0]
}

/** Fill in anything a loop saved by an older version is missing. */
export function normaliseSettings(settings: Partial<LoopSettings>): LoopSettings {
  const sound = { ...DEFAULT_SETTINGS.sound, ...settings.sound }
  return {
    ...DEFAULT_SETTINGS,
    ...settings,
    voiceVolume: clampVoiceVolume(
      settings.voiceVolume ?? DEFAULT_SETTINGS.voiceVolume,
    ),
    sound: {
      ...sound,
      rainCharacter: isRainCharacter(sound.rainCharacter)
        ? sound.rainCharacter
        : DEFAULT_SETTINGS.sound.rainCharacter,
    },
    brainwave: normaliseBrainwave(settings.brainwave),
  }
}
