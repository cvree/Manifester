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
    request.onsuccess = () => {
      const db = request.result
      /*
       * iOS closes an IndexedDB connection on its own after an app has spent
       * a while in the background, and a newer tab of this app upgrading the
       * schema asks every older connection to step aside. Either way the
       * connection cached here is dead, and every save after it would fail
       * until the app was relaunched. So a closed connection forgets itself
       * and the next request opens a fresh one.
       */
      db.onclose = () => {
        if (dbPromise) dbPromise = null
      }
      db.onversionchange = () => {
        db.close()
        dbPromise = null
      }
      resolve(db)
    }
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
  const attempt = () =>
    openDb().then(
      (db) =>
        new Promise<T>((resolve, reject) => {
          const tx = db.transaction(storeName, mode)
          const request = work(tx.objectStore(storeName))
          request.onsuccess = () => resolve(request.result)
          request.onerror = () =>
            reject(request.error ?? new Error('Local storage request failed.'))
        }),
    )

  /*
   * A connection the system closed without telling us — Safari does not
   * always fire `close` — fails here with `InvalidStateError` on the first
   * transaction. That is not a failed save, it is a stale handle: drop it and
   * try once more on a fresh one.
   */
  return attempt().catch((error: unknown) => {
    if (!isStaleConnection(error)) throw error
    dbPromise = null
    return attempt()
  })
}

function isStaleConnection(error: unknown): boolean {
  const name = (error as { name?: string } | null)?.name
  const message = String((error as { message?: string } | null)?.message ?? '')
  return (
    name === 'InvalidStateError' ||
    /connection.*(closing|closed|lost)/i.test(message)
  )
}

export async function listLoops(): Promise<SavedLoop[]> {
  const loops = await runRequest<SavedLoop[]>(STORE_LOOPS, 'readonly', (s) => s.getAll())
  return loops.sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function putLoop(loop: SavedLoop): Promise<void> {
  await runRequest(STORE_LOOPS, 'readwrite', (s) => s.put(loop))
  requestPersistence()
}

let persistenceAsked = false

/**
 * Ask the browser to keep this app's storage rather than clear it when space
 * runs low — once there is something worth keeping, which is the first saved
 * loop. Browsers decide for themselves (installed apps and frequently-used
 * sites are usually granted it) and say nothing either way; there is nothing
 * to show anybody about the answer.
 */
function requestPersistence(): void {
  if (persistenceAsked) return
  persistenceAsked = true
  try {
    const storage = typeof navigator !== 'undefined' ? navigator.storage : undefined
    if (!storage?.persist || !storage.persisted) return
    void storage
      .persisted()
      .then((already) => (already ? true : storage.persist()))
      .catch(() => undefined)
  } catch {
    // Not offered here. Nothing to do.
  }
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

export function removeLocal(key: string): void {
  try {
    localStorage.removeItem(`manifester:${key}`)
  } catch {
    /* Same as `writeLocal`: nothing to do and nothing worth reporting. */
  }
}

/**
 * Let go of the database, so something else can delete it.
 *
 * `indexedDB.deleteDatabase` does not fail when a connection is still open — it
 * *blocks*, indefinitely and silently, which from the outside is a Delete
 * button that does nothing at all. This module holds exactly one connection and
 * holds it for the life of the tab, so nothing can remove Manifester's storage
 * without asking here first. See `lib/reset.ts`.
 *
 * The promise is cleared as well as closed: the next call to anything above
 * opens a fresh connection, which is what makes this safe to call even if the
 * deletion that prompted it never happens.
 */
export function closeDatabase(): void {
  const opening = dbPromise
  dbPromise = null
  opening?.then(
    (db) => db.close(),
    () => undefined,
  )
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
