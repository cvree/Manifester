import { createId } from './format'
import { normaliseSettings } from './loops'
import {
  EMPTY_LISTENING_STATS,
  normaliseListeningStats,
  type ListeningStats,
} from './listening'
import type { StoredRecording, StoredTrack } from './storage'
import { MAX_TRACK_BYTES, type LoopSettings, type SavedLoop } from './types'

export const BACKUP_KIND = 'manifester-library'
export const BACKUP_VERSION = 1
const MAX_LOOPS = 2_000
const MAX_TEXT_CHARS = 500_000
const MAX_RECORDING_BYTES = 200 * 1024 * 1024
const MAX_CUSTOM_TRACKS = 500
const MAX_RECORDINGS = 500

interface EncodedTrack {
  id: string
  name: string
  mimeType: string
  sizeBytes: number
  durationSeconds: number | null
  createdAt: number
  data: string
}

interface EncodedRecording {
  id: string
  mimeType: string
  durationSeconds: number
  createdAt: number
  data: string
}

export interface LibraryBackupDocument {
  kind: typeof BACKUP_KIND
  version: typeof BACKUP_VERSION
  exportedAt: number
  loops: SavedLoop[]
  customTracks: EncodedTrack[]
  recordings: EncodedRecording[]
  listening: ListeningStats
}

export interface ParsedLibraryBackup {
  loops: SavedLoop[]
  customTracks: StoredTrack[]
  recordings: StoredRecording[]
  listening: ListeningStats
}

export interface RestoreBundle extends ParsedLibraryBackup {
  skipped: number
}

export async function createLibraryBackupJson(input: {
  loops: SavedLoop[]
  customTracks: StoredTrack[]
  recordings: StoredRecording[]
  listening: ListeningStats
}): Promise<string> {
  const customTracks = await Promise.all(
    input.customTracks.map(async (track) => ({
      id: track.id,
      name: track.name,
      mimeType: track.mimeType || track.blob.type || 'audio/mpeg',
      sizeBytes: track.blob.size,
      durationSeconds: track.durationSeconds ?? null,
      createdAt: track.createdAt,
      data: await blobToBase64(track.blob),
    })),
  )
  const recordings = await Promise.all(
    input.recordings.map(async (recording) => ({
      id: recording.id,
      mimeType: recording.mimeType || recording.blob.type || 'audio/webm',
      durationSeconds: recording.durationSeconds,
      createdAt: recording.createdAt,
      data: await blobToBase64(recording.blob),
    })),
  )
  const document: LibraryBackupDocument = {
    kind: BACKUP_KIND,
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    loops: input.loops,
    customTracks,
    recordings,
    listening: normaliseListeningStats(input.listening),
  }
  return JSON.stringify(document, null, 2)
}

/** Parse and validate everything before any IndexedDB transaction begins. */
export function parseLibraryBackup(text: string): ParsedLibraryBackup {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('That file is not a Manifester backup.')
  }
  if (!isRecord(raw) || raw.kind !== BACKUP_KIND || raw.version !== BACKUP_VERSION) {
    throw new Error('That file is not a supported Manifester backup.')
  }
  if (!Array.isArray(raw.loops) || raw.loops.length > MAX_LOOPS) {
    throw new Error('The saved loops in that backup are not valid.')
  }
  if (!Array.isArray(raw.customTracks) || !Array.isArray(raw.recordings)) {
    throw new Error('That backup is missing part of its library.')
  }
  if (
    raw.customTracks.length > MAX_CUSTOM_TRACKS ||
    raw.recordings.length > MAX_RECORDINGS
  ) {
    throw new Error('That backup is too large to restore safely.')
  }

  const loops = raw.loops.map(parseLoop)
  const customTracks = raw.customTracks.map(parseTrack)
  const recordings = raw.recordings.map(parseRecording)
  return {
    loops,
    customTracks,
    recordings,
    listening: normaliseListeningStats(raw.listening ?? EMPTY_LISTENING_STATS),
  }
}

/**
 * Merge rather than replace. Identical records are skipped; conflicting ids are
 * given new ids and references inside loops are remapped before one atomic write.
 */
export function prepareRestore(
  incoming: ParsedLibraryBackup,
  existing: {
    loops: SavedLoop[]
    customTracks: StoredTrack[]
    recordings: StoredRecording[]
  },
): RestoreBundle {
  let skipped = 0
  const existingTracks = new Map(existing.customTracks.map((item) => [item.id, item]))
  const existingRecordings = new Map(existing.recordings.map((item) => [item.id, item]))
  const existingLoops = new Map(existing.loops.map((item) => [item.id, item]))
  const usedTrackIds = new Set(existingTracks.keys())
  const usedRecordingIds = new Set(existingRecordings.keys())
  const usedLoopIds = new Set(existingLoops.keys())
  const trackIds = new Map<string, string>()
  const recordingIds = new Map<string, string>()

  const customTracks: StoredTrack[] = []
  for (const track of incoming.customTracks) {
    const current = existingTracks.get(track.id)
    if (current && sameTrack(current, track)) {
      trackIds.set(track.id, current.id)
      skipped += 1
      continue
    }
    const id = uniqueId(track.id, 'track', usedTrackIds)
    trackIds.set(track.id, id)
    customTracks.push({ ...track, id })
  }

  const recordings: StoredRecording[] = []
  for (const recording of incoming.recordings) {
    const current = existingRecordings.get(recording.id)
    if (current && sameRecording(current, recording)) {
      recordingIds.set(recording.id, current.id)
      skipped += 1
      continue
    }
    const id = uniqueId(recording.id, 'recording', usedRecordingIds)
    recordingIds.set(recording.id, id)
    recordings.push({ ...recording, id })
  }

  const loops: SavedLoop[] = []
  for (const loop of incoming.loops) {
    const remapped = remapLoop(loop, trackIds, recordingIds)
    const current = existingLoops.get(remapped.id)
    if (current && sameLoop(current, remapped)) {
      skipped += 1
      continue
    }
    loops.push({ ...remapped, id: uniqueId(remapped.id, 'loop', usedLoopIds) })
  }

  return { loops, customTracks, recordings, listening: incoming.listening, skipped }
}

function parseLoop(value: unknown): SavedLoop {
  if (!isRecord(value)) throw new Error('A saved loop in that backup is malformed.')
  const text = requiredString(value.text, 'A saved loop is missing its words.')
  if (text.length > MAX_TEXT_CHARS) throw new Error('A saved loop is too large to restore safely.')
  const settings = normaliseSettings(value as Partial<LoopSettings>)
  return {
    ...settings,
    id: safeId(value.id, 'loop'),
    title: requiredString(value.title, 'A saved loop is missing its title.').slice(0, 80),
    text,
    createdAt: safeTimestamp(value.createdAt),
    updatedAt: safeTimestamp(value.updatedAt),
    lastPlayedAt:
      value.lastPlayedAt == null ? null : safeTimestamp(value.lastPlayedAt),
    // A backup written before plays were captured holds only kept loops.
    origin: value.origin === 'played' ? 'played' : 'kept',
  }
}

function parseTrack(value: unknown): StoredTrack {
  if (!isRecord(value)) throw new Error('A saved sound in that backup is malformed.')
  const mimeType = requiredString(value.mimeType, 'A saved sound is missing its format.')
  const blob = base64Blob(value.data, mimeType, MAX_TRACK_BYTES)
  return {
    id: safeId(value.id, 'track'),
    name: requiredString(value.name, 'A saved sound is missing its name.').slice(0, 120),
    kind: 'custom',
    mimeType,
    sizeBytes: blob.size,
    durationSeconds: optionalFinite(value.durationSeconds),
    createdAt: safeTimestamp(value.createdAt),
    blob,
  }
}

function parseRecording(value: unknown): StoredRecording {
  if (!isRecord(value)) throw new Error('A voice recording in that backup is malformed.')
  const mimeType = requiredString(value.mimeType, 'A recording is missing its format.')
  const blob = base64Blob(value.data, mimeType, MAX_RECORDING_BYTES)
  return {
    id: safeId(value.id, 'recording'),
    mimeType,
    durationSeconds: optionalFinite(value.durationSeconds) ?? 0,
    createdAt: safeTimestamp(value.createdAt),
    blob,
  }
}

function remapLoop(
  loop: SavedLoop,
  trackIds: Map<string, string>,
  recordingIds: Map<string, string>,
): SavedLoop {
  const sound = {
    ...loop.sound,
    trackId: loop.sound.trackId
      ? (trackIds.get(loop.sound.trackId) ?? loop.sound.trackId)
      : null,
    playlist: loop.sound.playlist.map((id) => trackIds.get(id) ?? id),
  }
  return {
    ...loop,
    sound,
    recordingId: loop.recordingId
      ? (recordingIds.get(loop.recordingId) ?? loop.recordingId)
      : null,
  }
}

function uniqueId(original: string, prefix: string, used: Set<string>): string {
  let id = original
  while (used.has(id)) id = createId(prefix)
  used.add(id)
  return id
}

function sameLoop(a: SavedLoop, b: SavedLoop): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

function sameTrack(a: StoredTrack, b: StoredTrack): boolean {
  return a.name === b.name && a.blob.size === b.blob.size && a.mimeType === b.mimeType
}

function sameRecording(a: StoredRecording, b: StoredRecording): boolean {
  return a.blob.size === b.blob.size && a.mimeType === b.mimeType
}

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  const chunk = 0x8000
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk))
  }
  return btoa(binary)
}

function base64Blob(value: unknown, mimeType: string, maxBytes: number): Blob {
  if (typeof value !== 'string') throw new Error('A file in that backup is incomplete.')
  let binary: string
  try {
    binary = atob(value)
  } catch {
    throw new Error('A file in that backup is damaged.')
  }
  if (binary.length > maxBytes) throw new Error('A file in that backup is too large to restore safely.')
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return new Blob([bytes], { type: mimeType })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

function requiredString(value: unknown, message: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(message)
  return value
}

function safeId(value: unknown, prefix: string): string {
  return typeof value === 'string' && /^[a-zA-Z0-9._:-]{1,160}$/.test(value)
    ? value
    : createId(prefix)
}

function safeTimestamp(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : Date.now()
}

function optionalFinite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : null
}
