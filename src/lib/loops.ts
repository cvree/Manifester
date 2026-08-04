import { createId } from './format'
import type { LoopSettings, SavedLoop } from './types'

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
  return { id, title, text, settings: { ...settings, sound: { ...settings.sound } } }
}
