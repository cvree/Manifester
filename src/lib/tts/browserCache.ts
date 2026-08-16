/**
 * Speech that survives a reload, a flight, and a closed tab.
 *
 * This is the layer that makes the app feel like it already knows the words.
 * The encoded bytes of every clip the device has heard are kept in IndexedDB,
 * addressed by the same content hash the server and the build script use, so
 * the second time somebody plays a loop there is no network involved at all —
 * which is also what makes a saved loop work offline, in a PWA, with the
 * backend switched off.
 *
 * Deliberately its own database rather than a store inside `manifester`. The
 * app's own database holds the things a person would be upset to lose: their
 * loops, their recordings, their imported tracks. This holds bytes that can
 * always be made again, and keeping them apart means the cache can be cleared,
 * evicted by the browser, or fail to open on a locked-down device without any
 * of that being able to touch somebody's library.
 */

import type { AudioFormat } from './types'

const DB_NAME = 'manifester-tts'
const DB_VERSION = 1
const STORE = 'clips'
const INDEX_USED = 'lastUsedAt'

/** Roughly twenty minutes of Opus speech. Bytes, not clips. */
const DEFAULT_BUDGET_BYTES = 24 * 1024 * 1024

/** Evicting one clip at a time under pressure would thrash; take a slice. */
const EVICT_TARGET = 0.8

export interface CachedClip {
  /** `<key>.<format>`: one clip, one encoding. */
  id: string
  key: string
  format: AudioFormat
  bytes: ArrayBuffer
  byteLength: number
  createdAt: number
  lastUsedAt: number
}

function clipId(key: string, format: AudioFormat): string {
  return `${key}.${format}`
}

export class BrowserCache {
  private dbPromise: Promise<IDBDatabase | null> | null = null
  /**
   * Set when the browser has told us, in one way or another, that it will not
   * be storing anything: private-mode Safari, a device out of space, a locked
   * down enterprise profile. Everything below then becomes a no-op rather than
   * a stream of exceptions, and the app keeps working from the network.
   */
  private disabled = false

  private budgetBytes: number

  constructor(budgetBytes = DEFAULT_BUDGET_BYTES) {
    this.budgetBytes = budgetBytes
  }

  get available(): boolean {
    return !this.disabled && typeof indexedDB !== 'undefined'
  }

  async get(key: string, format: AudioFormat): Promise<ArrayBuffer | null> {
    const db = await this.open()
    if (!db) return null
    try {
      const record = await request<CachedClip | undefined>(
        db,
        STORE,
        'readonly',
        (store) => store.get(clipId(key, format)),
      )
      if (!record) return null
      // Touch quietly: a failed touch must not turn a cache hit into a miss.
      void this.touch(record.id).catch(() => undefined)
      return record.bytes
    } catch {
      return null
    }
  }

  /**
   * The first encoding of this clip that this device happens to hold.
   *
   * Asking for one exact format was the original shape of this, and it was
   * subtly wrong the moment a second producer existed: a line synthesised on
   * the device is stored as WAV, the resolver then asks for Opus because that
   * is what this browser prefers to download, misses, and synthesises the same
   * sentence again. Every layer above is content-addressed by what the clip
   * says rather than by how it is packed, and this is where that has to be
   * true in practice.
   */
  async find(
    key: string,
    formats: AudioFormat[],
  ): Promise<{ bytes: ArrayBuffer; format: AudioFormat } | null> {
    for (const format of formats) {
      const bytes = await this.get(key, format)
      if (bytes) return { bytes, format }
    }
    return null
  }

  async put(key: string, format: AudioFormat, bytes: ArrayBuffer): Promise<void> {
    const db = await this.open()
    if (!db) return
    const now = Date.now()
    const record: CachedClip = {
      id: clipId(key, format),
      key,
      format,
      bytes,
      byteLength: bytes.byteLength,
      createdAt: now,
      lastUsedAt: now,
    }

    try {
      await request(db, STORE, 'readwrite', (store) => store.put(record))
    } catch (error) {
      // `QuotaExceededError` is the expected failure, and it has a cure: make
      // room and try once more. Anything else means storage is not usable at
      // all, and the honest response is to stop asking.
      if (isQuotaError(error)) {
        await this.evict(this.budgetBytes * EVICT_TARGET)
        try {
          await request(db, STORE, 'readwrite', (store) => store.put(record))
          return
        } catch {
          this.disabled = true
          return
        }
      }
      this.disabled = true
      return
    }

    await this.enforceBudget()
  }

  /** Total bytes held, for the storage readout. */
  async usage(): Promise<number> {
    const db = await this.open()
    if (!db) return 0
    try {
      const all = await request<CachedClip[]>(db, STORE, 'readonly', (store) =>
        store.getAll(),
      )
      return all.reduce((total, clip) => total + clip.byteLength, 0)
    } catch {
      return 0
    }
  }

  async clear(): Promise<void> {
    const db = await this.open()
    if (!db) return
    try {
      await request(db, STORE, 'readwrite', (store) => store.clear())
    } catch {
      /* Nothing here is worth surfacing to somebody listening to a loop. */
    }
  }

  /* ── internals ── */

  private open(): Promise<IDBDatabase | null> {
    if (this.disabled) return Promise.resolve(null)
    if (this.dbPromise) return this.dbPromise

    this.dbPromise = new Promise<IDBDatabase | null>((resolve) => {
      if (typeof indexedDB === 'undefined') {
        this.disabled = true
        resolve(null)
        return
      }
      let settled = false
      const finish = (db: IDBDatabase | null) => {
        if (settled) return
        settled = true
        if (!db) this.disabled = true
        resolve(db)
      }

      try {
        const open = indexedDB.open(DB_NAME, DB_VERSION)
        open.onupgradeneeded = () => {
          const db = open.result
          if (!db.objectStoreNames.contains(STORE)) {
            const store = db.createObjectStore(STORE, { keyPath: 'id' })
            store.createIndex(INDEX_USED, 'lastUsedAt')
          }
        }
        open.onsuccess = () => finish(open.result)
        open.onerror = () => finish(null)
        open.onblocked = () => finish(null)
        /*
         * Safari has been known to leave `indexedDB.open` pending forever in a
         * private window rather than rejecting it. A cache that never answers
         * is worse than one that says no, because every lookup behind it waits.
         */
        setTimeout(() => finish(null), 3000)
      } catch {
        finish(null)
      }
    })

    return this.dbPromise
  }

  private async touch(id: string): Promise<void> {
    const db = await this.open()
    if (!db) return
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, 'readwrite')
      const store = tx.objectStore(STORE)
      const read = store.get(id)
      read.onsuccess = () => {
        const record = read.result as CachedClip | undefined
        if (record) {
          record.lastUsedAt = Date.now()
          store.put(record)
        }
      }
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
      tx.onabort = () => resolve()
    })
  }

  private async enforceBudget(): Promise<void> {
    const used = await this.usage()
    if (used <= this.budgetBytes) return
    await this.evict(this.budgetBytes * EVICT_TARGET)
  }

  /** Drop least-recently-used clips until the total is under `target`. */
  private async evict(target: number): Promise<void> {
    const db = await this.open()
    if (!db) return
    try {
      const all = await request<CachedClip[]>(db, STORE, 'readonly', (store) =>
        store.getAll(),
      )
      all.sort((a, b) => a.lastUsedAt - b.lastUsedAt)
      let total = all.reduce((sum, clip) => sum + clip.byteLength, 0)

      const doomed: string[] = []
      for (const clip of all) {
        if (total <= target) break
        doomed.push(clip.id)
        total -= clip.byteLength
      }
      if (doomed.length === 0) return

      await new Promise<void>((resolve) => {
        const tx = db.transaction(STORE, 'readwrite')
        const store = tx.objectStore(STORE)
        doomed.forEach((id) => store.delete(id))
        tx.oncomplete = () => resolve()
        tx.onerror = () => resolve()
        tx.onabort = () => resolve()
      })
    } catch {
      /* Eviction is housekeeping; failing it is not worth an error. */
    }
  }
}

function request<T>(
  db: IDBDatabase,
  storeName: string,
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(storeName, mode)
    const req = work(tx.objectStore(storeName))
    req.onsuccess = () => resolve(req.result as T)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'))
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'))
  })
}

function isQuotaError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const name = (error as { name?: string }).name
  return name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED'
}
