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
 * Fill in anything a loop saved by an older version is missing, so adding a
 * setting never breaks someone's existing library.
 *
 * Three values are rebuilt rather than merged. A rhythm's `targetHz` is derived
 * from its preset, because a stale or hand-edited frequency must never reach the
 * audio graph; an unrecognised rain character falls back to the middle setting
 * rather than indexing a table with `undefined`; and the voice level is brought
 * back inside its ceiling.
 *
 * That last one is a migration. The voice setting used to run to 2, on the
 * theory that an exported recording could use the headroom even though the
 * spoken voice never could — so a loop saved then can carry a level no control
 * in the app is able to show any more. It comes back at 100%, which is what it
 * always sounded like.
 */
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
