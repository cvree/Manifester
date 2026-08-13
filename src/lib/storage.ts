/** Local-only persistence. Nothing here ever leaves the device. */

import type { LoopSettings, SavedLoop, TrackMeta } from './types'

const DB_NAME = 'manifester'
const DB_VERSION = 2
const STORE_LOOPS = 'loops'
const STORE_TRACKS = 'tracks'
const STORE_KV = 'kv'
const STORE_RECORDINGS = 'recordings'

export interface StoredTrack extends TrackMeta {
  kind: 'custom'
  blob: Blob
}

export interface StoredRecording {
  id: string
  blob: Blob
  durationSeconds: number
  mimeType: string
  createdAt: number
}

let dbPromise: Promise<IDBDatabase> | null = null

export function isStorageAvailable(): boolean {
  return typeof indexedDB !== 'undefined'
}

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    if (!isStorageAvailable()) {
      reject(new Error('IndexedDB is not available in this browser.'))
      return
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_LOOPS)) {
        db.createObjectStore(STORE_LOOPS, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(STORE_TRACKS)) {
        db.createObjectStore(STORE_TRACKS, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(STORE_KV)) {
        db.createObjectStore(STORE_KV, { keyPath: 'key' })
      }
      if (!db.objectStoreNames.contains(STORE_RECORDINGS)) {
        db.createObjectStore(STORE_RECORDINGS, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () =>
      reject(request.error ?? new Error('Could not open the local database.'))
  })
  dbPromise.catch(() => {
    dbPromise = null
  })
  return dbPromise
}

function runRequest<T>(
  storeName: string,
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(storeName, mode)
        const request = work(tx.objectStore(storeName))
        request.onsuccess = () => resolve(request.result)
        request.onerror = () =>
          reject(request.error ?? new Error('Local storage request failed.'))
      }),
  )
}

export async function listLoops(): Promise<SavedLoop[]> {
  const loops = await runRequest<SavedLoop[]>(STORE_LOOPS, 'readonly', (s) => s.getAll())
  return loops.sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function putLoop(loop: SavedLoop): Promise<void> {
  await runRequest(STORE_LOOPS, 'readwrite', (s) => s.put(loop))
}

export async function deleteLoop(id: string): Promise<void> {
  await runRequest(STORE_LOOPS, 'readwrite', (s) => s.delete(id))
}

export async function listCustomTracks(): Promise<StoredTrack[]> {
  const tracks = await runRequest<StoredTrack[]>(STORE_TRACKS, 'readonly', (s) => s.getAll())
  return tracks.sort((a, b) => a.createdAt - b.createdAt)
}

export async function putCustomTrack(track: StoredTrack): Promise<void> {
  await runRequest(STORE_TRACKS, 'readwrite', (s) => s.put(track))
}

export async function getCustomTrack(id: string): Promise<StoredTrack | undefined> {
  return runRequest<StoredTrack | undefined>(STORE_TRACKS, 'readonly', (s) => s.get(id))
}

export async function deleteCustomTrack(id: string): Promise<void> {
  await runRequest(STORE_TRACKS, 'readwrite', (s) => s.delete(id))
}

export async function listRecordings(): Promise<StoredRecording[]> {
  const recordings = await runRequest<StoredRecording[]>(
    STORE_RECORDINGS,
    'readonly',
    (s) => s.getAll(),
  )
  return recordings.sort((a, b) => a.createdAt - b.createdAt)
}

export async function putRecording(recording: StoredRecording): Promise<void> {
  await runRequest(STORE_RECORDINGS, 'readwrite', (s) => s.put(recording))
}

export async function getRecording(id: string): Promise<StoredRecording | undefined> {
  return runRequest<StoredRecording | undefined>(STORE_RECORDINGS, 'readonly', (s) => s.get(id))
}

export async function deleteRecording(id: string): Promise<void> {
  await runRequest(STORE_RECORDINGS, 'readwrite', (s) => s.delete(id))
}

/** One transaction: malformed restore data can never leave a half-restored library. */
export async function importLibrarySnapshot(input: {
  loops: SavedLoop[]
  customTracks: StoredTrack[]
  recordings: StoredRecording[]
}): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(
      [STORE_LOOPS, STORE_TRACKS, STORE_RECORDINGS],
      'readwrite',
    )
    const loops = tx.objectStore(STORE_LOOPS)
    const tracks = tx.objectStore(STORE_TRACKS)
    const recordings = tx.objectStore(STORE_RECORDINGS)
    input.loops.forEach((loop) => loops.put(loop))
    input.customTracks.forEach((track) => tracks.put(track))
    input.recordings.forEach((recording) => recordings.put(recording))
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('The backup could not be restored.'))
    tx.onabort = () => reject(tx.error ?? new Error('The backup restore was cancelled.'))
  })
}

interface KvRecord<T> {
  key: string
  value: T
}

export async function readKv<T>(key: string): Promise<T | undefined> {
  const record = await runRequest<KvRecord<T> | undefined>(STORE_KV, 'readonly', (s) =>
    s.get(key),
  )
  return record?.value
}

export async function writeKv<T>(key: string, value: T): Promise<void> {
  await runRequest(STORE_KV, 'readwrite', (s) => s.put({ key, value }))
}

const LAST_SETTINGS_KEY = 'lastSettings'

export function loadLastSettings(): Promise<Partial<LoopSettings> | undefined> {
  return readKv<Partial<LoopSettings>>(LAST_SETTINGS_KEY).catch(() => undefined)
}

export function saveLastSettings(settings: LoopSettings): Promise<void> {
  return writeKv(LAST_SETTINGS_KEY, settings).catch(() => undefined)
}

export function readLocal(key: string): string | null {
  try {
    return localStorage.getItem(`manifester:${key}`)
  } catch {
    return null
  }
}

export function writeLocal(key: string, value: string): void {
  try {
    localStorage.setItem(`manifester:${key}`, value)
  } catch {
    /* Safari private mode — preferences simply will not persist. */
  }
}

export async function estimateUsage(): Promise<{
  usageBytes: number
  quotaBytes: number
} | null> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return null
  try {
    const { usage, quota } = await navigator.storage.estimate()
    return { usageBytes: usage ?? 0, quotaBytes: quota ?? 0 }
  } catch {
    return null
  }
}
