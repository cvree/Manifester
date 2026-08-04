/**
 * Local-only persistence.
 *
 * IndexedDB holds saved loops and imported audio blobs; localStorage holds a
 * couple of tiny UI preferences. Nothing here ever leaves the device.
 */

import type { LoopSettings, SavedLoop, TrackMeta } from './types'

const DB_NAME = 'manifester'
const DB_VERSION = 1

const STORE_LOOPS = 'loops'
const STORE_TRACKS = 'tracks'
const STORE_KV = 'kv'

export interface StoredTrack extends TrackMeta {
  kind: 'custom'
  blob: Blob
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
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () =>
      reject(request.error ?? new Error('Could not open the local database.'))
  })

  // A failed open should not poison every later call.
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

/* ── Saved loops ─────────────────────────────────────────────── */

export async function listLoops(): Promise<SavedLoop[]> {
  const loops = await runRequest<SavedLoop[]>(STORE_LOOPS, 'readonly', (s) =>
    s.getAll(),
  )
  return loops.sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function putLoop(loop: SavedLoop): Promise<void> {
  await runRequest(STORE_LOOPS, 'readwrite', (s) => s.put(loop))
}

export async function deleteLoop(id: string): Promise<void> {
  await runRequest(STORE_LOOPS, 'readwrite', (s) => s.delete(id))
}

/* ── Imported audio ──────────────────────────────────────────── */

export async function listCustomTracks(): Promise<StoredTrack[]> {
  const tracks = await runRequest<StoredTrack[]>(STORE_TRACKS, 'readonly', (s) =>
    s.getAll(),
  )
  return tracks.sort((a, b) => a.createdAt - b.createdAt)
}

export async function putCustomTrack(track: StoredTrack): Promise<void> {
  await runRequest(STORE_TRACKS, 'readwrite', (s) => s.put(track))
}

export async function getCustomTrack(id: string): Promise<StoredTrack | undefined> {
  return runRequest<StoredTrack | undefined>(STORE_TRACKS, 'readonly', (s) =>
    s.get(id),
  )
}

export async function deleteCustomTrack(id: string): Promise<void> {
  await runRequest(STORE_TRACKS, 'readwrite', (s) => s.delete(id))
}

/* ── Small key/value settings ────────────────────────────────── */

interface KvRecord<T> {
  key: string
  value: T
}

export async function readKv<T>(key: string): Promise<T | undefined> {
  const record = await runRequest<KvRecord<T> | undefined>(
    STORE_KV,
    'readonly',
    (s) => s.get(key),
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

/* ── localStorage (tiny, synchronous preferences only) ───────── */

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

/** Approximate how much room the app is using, when the browser will say. */
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
