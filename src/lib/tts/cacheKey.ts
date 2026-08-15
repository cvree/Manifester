/**
 * The address of a piece of speech.
 *
 * Every clip this app has ever produced is named by the hash of everything
 * that decides how it sounds, and by nothing else. Two consequences follow,
 * and between them they are most of why the voice feels instant:
 *
 *  - The same sentence in the same voice is only ever synthesised once, on one
 *    device, ever — and every device after that finds it already made.
 *  - A file at `<key>.opus` can be served `immutable`, cached for a year, and
 *    put behind a CDN without a single invalidation rule, because the name can
 *    never come to mean different audio. Changing the audio changes the name.
 *
 * The inputs are canonicalised before hashing, so two callers that mean the
 * same thing agree on the key without having to coordinate: the browser
 * computing a key to look in IndexedDB, the backend computing one to look on
 * disk, and the build script computing one to name a file all run this code
 * and all land on the same 64 characters.
 */

import { sha256HexOfString } from './sha256.ts'
import type { LogicalVoice } from './types.ts'

export interface CacheKeyInput {
  /** The words, exactly as they will be handed to the engine. */
  text: string
  voice: LogicalVoice
  voiceVersion: number
  speed: number
  language: string
  modelVersion: string
  pronunciationVersion: number
  audioVersion: number
}

/** Speeds are compared at this resolution, so 0.8999999 and 0.9 are one clip. */
const SPEED_PLACES = 2

export const MIN_SPEED = 0.5
export const MAX_SPEED = 2

export function clampSpeed(value: number): number {
  if (!Number.isFinite(value)) return 1
  const bounded = Math.min(MAX_SPEED, Math.max(MIN_SPEED, value))
  return Number(bounded.toFixed(SPEED_PLACES))
}

/**
 * The text as the key should see it.
 *
 * Trailing spaces, a stray double space, a line pasted from a word processor
 * with a non-breaking space in it, and the same line typed by hand are all the
 * same sentence out loud, and making them the same key means the second person
 * to ask for it waits for a network round trip rather than for a model.
 *
 * NFC because "é" has two spellings in Unicode and only one of them can be the
 * name of a file.
 */
export function canonicalText(text: string): string {
  return text
    .normalize('NFC')
    .replace(/[   ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * The exact bytes that get hashed.
 *
 * Written out by hand in a fixed order rather than by `JSON.stringify` of an
 * object literal, because the key ordering of an object literal is a property
 * of whoever wrote it. A canonical form has to be a decision, not a habit —
 * this one is alphabetical, and a test holds it there.
 */
export function canonicalJson(input: CacheKeyInput): string {
  const canonical = {
    audioVersion: input.audioVersion,
    language: input.language.trim().toLowerCase(),
    modelVersion: input.modelVersion,
    pronunciationVersion: input.pronunciationVersion,
    speed: clampSpeed(input.speed),
    text: canonicalText(input.text),
    voice: input.voice,
    voiceVersion: input.voiceVersion,
  }

  return JSON.stringify(canonical, [
    'audioVersion',
    'language',
    'modelVersion',
    'pronunciationVersion',
    'speed',
    'text',
    'voice',
    'voiceVersion',
  ])
}

/** 64 lower-case hex characters. Safe as a filename on every platform. */
export function cacheKey(input: CacheKeyInput): string {
  return sha256HexOfString(canonicalJson(input))
}

/**
 * Where a key's file lives, relative to the speech asset root.
 *
 * Two characters of the hash become a directory. A flat folder of ten thousand
 * files is fine on a modern filesystem and unpleasant everywhere else — in a
 * git diff, in a file listing, in an object-store console — and the fan-out
 * costs nothing.
 */
export function assetPath(key: string, format: string): string {
  return `${key.slice(0, 2)}/${key}.${format}`
}
