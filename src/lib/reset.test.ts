import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The button that has to work when everything else did not.
 *
 * Its whole value is that it is *complete* — the reason it exists is that
 * "clear site data" is four levels down a browser menu and that a fix which
 * only works on a device carrying nothing from the previous version is not a
 * fix. So what is tested here is not that it succeeds on a healthy browser but
 * that it keeps going on an unhealthy one: a refused cache, an IndexedDB that
 * blocks because another tab is open, a `localStorage` that throws in a private
 * window. Each of those on its own used to be enough to leave a device half
 * reset, which is a state nobody designed and nobody can debug.
 */

const { ttsRelease, closeDatabase } = vi.hoisted(() => ({
  ttsRelease: vi.fn(),
  closeDatabase: vi.fn(),
}))

vi.mock('./tts', () => ({ tts: { releaseStorage: ttsRelease } }))
vi.mock('./storage', () => ({ closeDatabase }))

/** An `indexedDB` whose deletions behave however a test wants them to. */
function fakeIndexedDb(options: {
  names?: string[]
  /** Databases whose deletion is refused, as another open tab would refuse it. */
  blocked?: string[]
} = {}) {
  const deleted: string[] = []
  const emptied: string[] = []
  const blocked = new Set(options.blocked ?? [])

  return {
    deleted,
    emptied,
    api: {
      databases: options.names
        ? async () => options.names!.map((name) => ({ name, version: 1 }))
        : undefined,
      deleteDatabase(name: string) {
        const request = { onsuccess: null, onerror: null, onblocked: null } as {
          onsuccess: (() => void) | null
          onerror: (() => void) | null
          onblocked: (() => void) | null
        }
        queueMicrotask(() => {
          if (blocked.has(name)) {
            request.onblocked?.()
            return
          }
          deleted.push(name)
          request.onsuccess?.()
        })
        return request
      },
      open(name: string) {
        const request = {
          onsuccess: null,
          onerror: null,
          onblocked: null,
          result: null as unknown,
        } as {
          onsuccess: (() => void) | null
          onerror: (() => void) | null
          onblocked: (() => void) | null
          result: unknown
        }
        queueMicrotask(() => {
          const tx = {
            objectStore: () => ({ clear: () => undefined }),
            oncomplete: null as (() => void) | null,
            onerror: null,
            onabort: null,
          }
          request.result = {
            objectStoreNames: ['loops'],
            transaction: () => tx,
            close: () => undefined,
          }
          request.onsuccess?.()
          emptied.push(name)
          queueMicrotask(() => tx.oncomplete?.())
        })
        return request
      },
    },
  }
}

let removedCaches: string[]
let unregistered: number

beforeEach(() => {
  vi.resetModules()
  ttsRelease.mockReset()
  closeDatabase.mockReset()
  removedCaches = []
  unregistered = 0

  vi.stubGlobal('caches', {
    keys: async () => ['manifester-speech', 'transformers-cache', 'kokoro-voices'],
    delete: async (name: string) => {
      removedCaches.push(name)
      return true
    },
  })

  const store = new Map<string, string>([['manifester:theme', 'dusk']])
  vi.stubGlobal('localStorage', {
    clear: () => store.clear(),
    get length() {
      return store.size
    },
  })
  vi.stubGlobal('sessionStorage', { clear: () => undefined })
  vi.stubGlobal('navigator', {
    serviceWorker: {
      getRegistrations: async () => [
        {
          unregister: async () => {
            unregistered += 1
            return true
          },
        },
      ],
    },
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('deleting everything', () => {
  it('clears all five stores and lets go of the databases first', async () => {
    const db = fakeIndexedDb()
    vi.stubGlobal('indexedDB', db.api)
    const { deleteAllData } = await import('./reset')

    const report = await deleteAllData()

    // Nothing may still be writing, and nothing may still hold a connection —
    // a delete with one open blocks for ever rather than failing.
    expect(ttsRelease).toHaveBeenCalled()
    expect(closeDatabase).toHaveBeenCalled()

    expect(db.deleted).toEqual(
      expect.arrayContaining(['manifester', 'manifester-tts']),
    )
    expect(removedCaches).toHaveLength(3)
    expect(localStorage.length).toBe(0)
    expect(unregistered).toBe(1)
    expect(report).toMatchObject({ databases: 2, caches: 3, incomplete: false })
  })

  /**
   * The everyday case while somebody is testing: the app is open in a second
   * tab. `deleteDatabase` answers `blocked` and waits, so removing it is off
   * the table — but emptying it is not, and the person is exactly as reset
   * either way.
   */
  it('empties a database another tab will not let it delete', async () => {
    const db = fakeIndexedDb({ blocked: ['manifester'] })
    vi.stubGlobal('indexedDB', db.api)
    const { deleteAllData } = await import('./reset')

    const report = await deleteAllData()

    expect(db.deleted).toEqual(['manifester-tts'])
    expect(db.emptied).toEqual(['manifester'])
    expect(report.databases).toBe(1)
  })

  it('removes databases it was never told about', async () => {
    const db = fakeIndexedDb({ names: ['manifester', 'something-added-later'] })
    vi.stubGlobal('indexedDB', db.api)
    const { deleteAllData } = await import('./reset')

    await deleteAllData()
    expect(db.deleted).toContain('something-added-later')
  })

  /**
   * One refusal must never stop the rest.
   *
   * A reset that gives up at the first store leaves the device in a state that
   * is neither the old one nor a fresh one — which is worse than not offering
   * the button, because somebody now believes their data is gone.
   */
  it('carries on past a store that refuses, and says that it did', async () => {
    const db = fakeIndexedDb()
    vi.stubGlobal('indexedDB', db.api)
    vi.stubGlobal('caches', {
      keys: async () => {
        throw new Error('no cache storage in this browser')
      },
      delete: async () => false,
    })
    vi.stubGlobal('localStorage', {
      clear: () => {
        throw new Error('private mode')
      },
    })
    const { deleteAllData } = await import('./reset')

    const report = await deleteAllData()

    expect(report.incomplete).toBe(true)
    // And the two stores that *could* be cleared were.
    expect(db.deleted).toHaveLength(2)
    expect(unregistered).toBe(1)
  })

  it('works in a browser with no storage APIs at all', async () => {
    vi.stubGlobal('indexedDB', undefined)
    vi.stubGlobal('caches', undefined)
    vi.stubGlobal('navigator', {})
    const { deleteAllData } = await import('./reset')

    await expect(deleteAllData()).resolves.toMatchObject({
      databases: 0,
      caches: 0,
    })
  })
})
