import { isBuiltInAmbientId, isRainCharacter } from './ambient'
import { normaliseBrainwave } from './brainwaveAudio'
import { createId } from './format'
import { clampLevel, MAX_ACTIVE_LAYERS } from './soundMixer'
import { clampVoiceVolume } from './speech'
import {
  DEFAULT_SETTINGS,
  type LoopOrigin,
  type LoopSettings,
  type SavedLoop,
  type SoundConfig,
} from './types'

/**
 * How many captured plays the library holds. Enough that last week's session
 * is still there, few enough that the section never becomes a log to scroll.
 * Kept loops are never counted here and never pruned.
 */
export const MAX_PLAYED_LOOPS = 12

/** Roughly one line of a card's title, before the ellipsis earns its place. */
const TITLE_CHARS = 44

/** The in-progress loop the Create tab edits. */
export interface Draft {
  /** Set once the draft has been saved, so editing updates rather than copies. */
  id: string | null
  title: string
  text: string
  settings: LoopSettings
}

/**
 * Turn the current draft into a storable loop.
 *
 * Saving is also how a captured play graduates: whatever the record used to
 * be, coming through this function makes it kept, and kept records are never
 * pruned or reordered by a later play.
 */
export function draftToLoop(draft: Draft, existing?: SavedLoop | null): SavedLoop {
  const now = Date.now()
  return {
    ...draft.settings,
    sound: { ...draft.settings.sound },
    brainwave: { ...draft.settings.brainwave },
    id: draft.id ?? existing?.id ?? createId('loop'),
    title: draft.title.trim() || existing?.title || autoTitle(draft.text),
    text: draft.text,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    lastPlayedAt: existing?.lastPlayedAt ?? null,
    origin: 'kept',
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
    origin: _origin,
    ...settings
  } = loop
  return { id, title, text, settings: normaliseSettings(settings) }
}

/**
 * A name for words nobody has named.
 *
 * Captured plays need a title the moment they are captured, and "Untitled
 * loop" three times over is a list you cannot read. The opening words are
 * what somebody would have called it themselves.
 */
export function autoTitle(text: string): string {
  const line = text
    .trim()
    .split('\n')
    .map((part) => part.trim())
    .find((part) => part.length > 0)
  if (!line) return 'Untitled loop'
  const words = line.replace(/\s+/g, ' ').split(' ')
  let title = ''
  let used = 0
  for (const word of words) {
    const next = title ? `${title} ${word}` : word
    if (title && next.length > TITLE_CHARS) break
    title = next
    used += 1
    if (title.length >= TITLE_CHARS) break
  }
  const shortened = used < words.length || title.length > TITLE_CHARS
  const trimmed = title.slice(0, TITLE_CHARS).replace(/[\s,;:—–-]+$/, '')
  if (!trimmed) return 'Untitled loop'
  return shortened ? `${trimmed}…` : trimmed
}

/** Fill in anything a loop saved by an older version is missing. */
export function normaliseLoop(loop: SavedLoop): SavedLoop {
  return {
    ...loop,
    ...normaliseSettings(loop),
    origin: loop.origin === 'played' ? 'played' : 'kept',
  }
}

/**
 * Library order: what you chose to keep, then what you happened to play.
 *
 * Kept loops sort by when they were last edited, so saving one brings it to
 * the front. Captured plays sort by when they were played, which is the only
 * thing about them anyone is looking for.
 */
export function sortLibrary(loops: SavedLoop[]): SavedLoop[] {
  return [...loops].sort((a, b) => {
    const aKept = a.origin !== 'played'
    const bKept = b.origin !== 'played'
    if (aKept !== bKept) return aKept ? -1 : 1
    if (aKept) return b.updatedAt - a.updatedAt
    return playedAt(b) - playedAt(a)
  })
}

/** The same order, split into the two groups the Loops section draws. */
export function splitLibrary(loops: SavedLoop[]): {
  kept: SavedLoop[]
  played: SavedLoop[]
} {
  const sorted = sortLibrary(loops)
  return {
    kept: sorted.filter((loop) => loop.origin !== 'played'),
    played: sorted.filter((loop) => loop.origin === 'played'),
  }
}

/** Everything a play knows about itself as it starts. */
export interface PlayRecord {
  /** The library record this play is already bound to, when there is one. */
  id: string | null
  title: string
  text: string
  settings: LoopSettings
}

/** One library write: the record to store, and any stale captures to drop. */
export interface PlayPlan {
  save: SavedLoop
  /** Ids of captured plays that have aged out of the history. */
  drop: string[]
  /** True when this play added a record rather than refreshing one. */
  created: boolean
  origin: LoopOrigin
}

/**
 * What playing these words should do to the library.
 *
 * The words are the identity. Play something the library already holds and
 * that record is simply marked as played again — no second copy, and a kept
 * loop is never rewritten by a play, only stamped. Play something new and it
 * is captured, so nothing anybody listened to is lost to a forgotten Save.
 * Returns null when there is nothing worth keeping.
 */
export function planPlay(
  loops: SavedLoop[],
  play: PlayRecord,
  at: number = Date.now(),
): PlayPlan | null {
  if (!play.text.trim()) return null
  const key = textKey(play.text)
  const existing =
    loops.find((loop) => loop.id === play.id && textKey(loop.text) === key) ??
    loops.find((loop) => textKey(loop.text) === key) ??
    null

  // Words already kept stay exactly as they were kept. Only the play time moves.
  if (existing && existing.origin !== 'played') {
    return {
      save: { ...existing, lastPlayedAt: at },
      drop: [],
      created: false,
      origin: 'kept',
    }
  }

  /*
   * A play whose words have moved on from the record it was bound to — an
   * edit in Create that was never saved — is a new capture, never a write
   * over the old record. Reusing the id here would let an unsaved edit
   * silently replace the loop it started from.
   */
  const reusableId =
    play.id != null && !loops.some((loop) => loop.id === play.id) ? play.id : null

  const save: SavedLoop = {
    ...play.settings,
    sound: { ...play.settings.sound },
    brainwave: { ...play.settings.brainwave },
    id: existing?.id ?? reusableId ?? createId('loop'),
    title: play.title.trim() || existing?.title || autoTitle(play.text),
    text: play.text,
    createdAt: existing?.createdAt ?? at,
    updatedAt: at,
    lastPlayedAt: at,
    origin: 'played',
  }

  return {
    save,
    drop: expiredPlays(loops, save),
    created: existing == null,
    origin: 'played',
  }
}

/** Captured plays past the history limit, oldest first out. */
function expiredPlays(loops: SavedLoop[], keeping: SavedLoop): string[] {
  const played = loops
    .filter((loop) => loop.origin === 'played' && loop.id !== keeping.id)
    .sort((a, b) => playedAt(b) - playedAt(a))
  return played.slice(MAX_PLAYED_LOOPS - 1).map((loop) => loop.id)
}

function playedAt(loop: SavedLoop): number {
  return loop.lastPlayedAt ?? loop.updatedAt
}

/** Two sets of words are the same loop when they read the same. */
function textKey(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase()
}

/**
 * Captures of words that have just been saved under another record.
 *
 * Saving absorbs its own shadow: the copy in Recent plays says nothing the
 * saved loop above it does not already say, and leaving it there is how a
 * library starts looking like a log.
 */
export function absorbedBySave(loops: SavedLoop[], saved: SavedLoop): string[] {
  const key = textKey(saved.text)
  if (!key) return []
  return loops
    .filter(
      (loop) =>
        loop.id !== saved.id && loop.origin === 'played' && textKey(loop.text) === key,
    )
    .map((loop) => loop.id)
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
    /*
     * Loops saved before the studio voice existed have no `voiceSource` at
     * all, and they get `studio` from the defaults above — which is the right
     * answer rather than a convenient one. A loop saved on a phone whose best
     * device voice was a 2011 formant synth was never asking for *that* voice
     * specifically; it was asking for a feminine one. It gets a better one.
     * Anyone who did choose an exact voice still has `voiceURI` set, and the
     * line below keeps them on it.
     */
    voiceSource:
      settings.voiceSource === 'device' ||
      (settings.voiceSource == null && settings.voiceURI)
        ? 'device'
        : 'studio',
    voiceVolume: clampVoiceVolume(
      settings.voiceVolume ?? DEFAULT_SETTINGS.voiceVolume,
    ),
    sound: normaliseSound(sound),
    brainwave: normaliseBrainwave(settings.brainwave),
  }
}

/**
 * Bring a stored sound configuration up to date.
 *
 * Everything the mixer added is optional on the way in, because every loop
 * saved before it existed has none of it — and the absence has to read as
 * "one sound, at full level, nothing muted", which is exactly what those loops
 * sounded like. Levels are clamped and mutes de-duplicated on the way through,
 * so a hand-edited backup cannot produce a layer at 40× or a mute that can
 * never be lifted.
 */
function normaliseSound(sound: SoundConfig): SoundConfig {
  const layers = Array.isArray(sound.layers)
    ? [...new Set(sound.layers.filter(isBuiltInAmbientId))].slice(0, MAX_ACTIVE_LAYERS)
    : []

  const levels: Record<string, number> = {}
  if (sound.levels && typeof sound.levels === 'object') {
    for (const [id, value] of Object.entries(sound.levels)) {
      if (typeof value !== 'number' || !Number.isFinite(value)) continue
      levels[id] = clampLevel(value)
    }
  }

  return {
    ...sound,
    rainCharacter: isRainCharacter(sound.rainCharacter)
      ? sound.rainCharacter
      : DEFAULT_SETTINGS.sound.rainCharacter,
    layers,
    levels,
    muted: Array.isArray(sound.muted)
      ? [...new Set(sound.muted.filter((id) => typeof id === 'string'))]
      : [],
  }
}
