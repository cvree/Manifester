/**
 * The page somebody is in the middle of writing, kept through a refresh.
 *
 * A saved loop lives in IndexedDB and a played one is filed there too, but
 * the words typed since — or typed and never played — lived only in memory,
 * and a reload, an update or a phone reclaiming the tab threw them away. This
 * is the smallest thing that stops that: the current draft, written to
 * `localStorage` a moment after each change and once more as the page goes.
 *
 * `localStorage` rather than the database on purpose. The write that matters
 * most is the one made while the page is being hidden, and that has to be
 * synchronous to be reliable — an IndexedDB transaction started in `pagehide`
 * is not guaranteed to commit. It also means "Delete all data" clears it with
 * everything else under `manifester:` without being told about it.
 *
 * The contents are a person's own words. They are stored on this device and
 * go nowhere else, and nothing here logs them.
 */

import { normaliseSettings, type Draft } from './loops'
import { readLocal, removeLocal, writeLocal } from './storage'
import type { LoopSettings, SavedLoop } from './types'

const KEY = 'draft'
const VERSION = 1

/** Generous for a twenty-minute script, and far inside every browser's quota. */
const MAX_TEXT_CHARS = 200_000

interface StoredDraft {
  v: number
  id: string | null
  title: string
  text: string
  settings: Partial<LoopSettings>
}

let suspended = false

/**
 * Stop writing. Called by "Delete all data" before it clears storage, so the
 * farewell write made as the page reloads cannot put the draft straight back.
 */
export function suspendDraftStore(): void {
  suspended = true
}

/** For tests, and for nothing else. */
export function resumeDraftStore(): void {
  suspended = false
}

export function saveStoredDraft(draft: Draft): void {
  if (suspended) return
  // An empty page is not worth remembering, and remembering it would send a
  // returning listener to a blank editor instead of their last loop.
  if (!draft.text.trim() && !draft.title.trim()) {
    removeLocal(KEY)
    return
  }
  const stored: StoredDraft = {
    v: VERSION,
    id: draft.id,
    title: draft.title,
    text: draft.text.slice(0, MAX_TEXT_CHARS),
    settings: draft.settings,
  }
  writeLocal(KEY, JSON.stringify(stored))
}

export function loadStoredDraft(): Draft | null {
  const raw = readLocal(KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<StoredDraft> | null
    if (!parsed || typeof parsed !== 'object') return null
    if (typeof parsed.text !== 'string') return null
    const title = typeof parsed.title === 'string' ? parsed.title : ''
    if (!parsed.text.trim() && !title.trim()) return null
    const settings =
      parsed.settings && typeof parsed.settings === 'object' ? parsed.settings : {}
    return {
      id: typeof parsed.id === 'string' ? parsed.id : null,
      title,
      text: parsed.text,
      settings: normaliseSettings(settings),
    }
  } catch {
    return null
  }
}

export function clearStoredDraft(): void {
  removeLocal(KEY)
}

export type DraftState =
  /** Nothing written. */
  | 'empty'
  /** Words on the page that are not in the library as they stand. */
  | 'unsaved'
  /** Matches a loop that was played but never deliberately kept. */
  | 'recent'
  /** Matches a loop the person saved. */
  | 'saved'

/**
 * Where the words on the page stand against the library.
 *
 * Only the words and the title are compared. Settings are adjusted far more
 * often than they are meant, and calling a page "unsaved" because a volume
 * moved would teach people to ignore the word.
 */
export function draftState(draft: Draft, loops: SavedLoop[]): DraftState {
  if (!draft.text.trim()) return 'empty'
  const bound = draft.id ? loops.find((loop) => loop.id === draft.id) : null
  if (!bound) return 'unsaved'
  const title = draft.title.trim()
  if (bound.text !== draft.text) return 'unsaved'
  if (title && title !== bound.title) return 'unsaved'
  return bound.origin === 'played' ? 'recent' : 'saved'
}
