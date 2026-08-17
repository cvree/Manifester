/**
 * Put this installation back to the state a stranger's browser is in.
 *
 * One button, and it is genuinely destructive, so it is worth being precise
 * about what it means and why the app has one at all.
 *
 * "Clear site data in your browser settings" is the answer every web app gives
 * to this, and it is a bad answer for two different people. For somebody who
 * wants to start again it is four levels down a settings menu that is in a
 * different place on every browser, and it is all-or-nothing across a whole
 * origin they may not understand they own. For anybody *testing* a change to
 * this app it is a chore repeated dozens of times a day, and a chore repeated
 * dozens of times a day is a step that eventually gets skipped — which is how a
 * fix ships that only works on a device that has never seen the previous
 * version. Every stale thing that has ever made this app misbehave lived in one
 * of the five stores below, and none of them are reachable from any screen.
 *
 * ── What "everything" is ────────────────────────────────────────────────────
 *
 * All five, because leaving one behind is worse than not offering the button:
 *
 *  1. **The library.** Loops, imported sounds, recordings, last-used settings.
 *     The only irreplaceable thing here, which is why the interface that calls
 *     this offers a backup first.
 *  2. **Cached speech.** Every clip this device has heard or synthesised.
 *  3. **Preferences.** Theme, voice, onboarding, the flag that says Studio
 *     Voice is installed — everything under `manifester:` in `localStorage`.
 *  4. **The caches.** The offline app itself, the pre-generated speech, and the
 *     ninety megabytes of Studio Voice: weights, tokeniser and voice packs,
 *     which live under Hugging Face URLs and are otherwise unreachable.
 *  5. **The service worker.** Without unregistering it the *code* survives the
 *     reset, which for somebody testing a patch is the one thing that must not.
 *
 * ── Why it is written like this ─────────────────────────────────────────────
 *
 * Every step is independently guarded and nothing throws. A browser that
 * refuses one of these — a private window with no IndexedDB, an origin with no
 * service worker, a `caches` that is not there at all — must still get the
 * other four, because a reset that stops at the first refusal is a reset that
 * leaves the device in a state nobody designed.
 *
 * Deletions are also raced against a deadline. `deleteDatabase` does not fail
 * when something still holds a connection; it fires `blocked` and waits for
 * ever. Callers close what they hold first (see `releaseStorage` on the voice
 * and `closeDatabase` in `storage.ts`), and this is the belt to that pair of
 * braces: after the deadline the reset carries on and reloads, and a database
 * that survived is emptied on the way rather than left full.
 */

import { closeDatabase } from './storage'
import { tts } from './tts'

/** The databases this app owns, for browsers that cannot enumerate them. */
const KNOWN_DATABASES = ['manifester', 'manifester-tts']

/**
 * How long any one deletion may take before the reset moves on without it.
 *
 * Short on purpose. The alternative to giving up is a button that spins for
 * ever, and the fallback — clearing the contents rather than removing the
 * database — leaves the person exactly as reset as they asked to be.
 */
const STEP_TIMEOUT_MS = 4000

/** What was actually removed, for the sentence shown afterwards. */
export interface ResetReport {
  databases: number
  caches: number
  /** True when at least one store refused, so the message can be honest. */
  incomplete: boolean
}

export async function deleteAllData(): Promise<ResetReport> {
  const report: ResetReport = { databases: 0, caches: 0, incomplete: false }

  // Nothing may be writing while this runs, and nothing may be holding a
  // database open — see the note above about `blocked`.
  try {
    tts.releaseStorage()
  } catch {
    report.incomplete = true
  }
  try {
    closeDatabase()
  } catch {
    report.incomplete = true
  }

  report.caches = await deleteCaches(report)
  report.databases = await deleteDatabases(report)
  clearWebStorage(report)
  await unregisterWorkers(report)

  return report
}

/**
 * Delete everything, then start the app again from nothing.
 *
 * A reload rather than a re-render, and not for convenience: half the state
 * this removes was read once at start-up and lives in a React tree that has no
 * idea it is gone. Reloading is the only way the app can be *shown* the same
 * thing a first-time visitor is shown, which is the entire point of the button.
 *
 * `location.replace` so that Back does not return to a screen describing a
 * library that no longer exists.
 */
export async function deleteAllDataAndRestart(): Promise<void> {
  await deleteAllData()
  const home = new URL(import.meta.env.BASE_URL ?? '/', window.location.origin)
  window.location.replace(home.toString())
}

/* ── The five stores ─────────────────────────────────────────── */

async function deleteCaches(report: ResetReport): Promise<number> {
  if (typeof caches === 'undefined') return 0
  try {
    const names = await caches.keys()
    const gone = await Promise.all(
      names.map((name) =>
        caches.delete(name).catch(() => {
          report.incomplete = true
          return false
        }),
      ),
    )
    return gone.filter(Boolean).length
  } catch {
    report.incomplete = true
    return 0
  }
}

async function deleteDatabases(report: ResetReport): Promise<number> {
  if (typeof indexedDB === 'undefined') return 0

  let names = KNOWN_DATABASES
  try {
    /*
     * Ask the browser rather than trusting the list, where the browser will
     * say — Firefox will not, and Safari only recently would. Anything this app
     * adds later is then removed by this button without anybody remembering to
     * come back and edit a constant.
     */
    if (typeof indexedDB.databases === 'function') {
      const found = await indexedDB.databases()
      const listed = found
        .map((entry) => entry.name)
        .filter((name): name is string => typeof name === 'string' && name.length > 0)
      if (listed.length > 0) names = [...new Set([...KNOWN_DATABASES, ...listed])]
    }
  } catch {
    /* The hard-coded list is a complete answer for this app as it stands. */
  }

  const results = await Promise.all(
    names.map(async (name) => {
      if (await deleteDatabase(name)) return true
      /*
       * Removing it was refused — almost always because this app is open in a
       * second tab, which is the normal state of affairs while somebody is
       * testing. Emptying it needs no exclusive access and leaves the person
       * exactly as reset as they asked to be; only the empty shell survives.
       */
      const emptied = await emptyDatabase(name)
      if (!emptied) report.incomplete = true
      return false
    }),
  )
  return results.filter(Boolean).length
}

/** One database, with a deadline. See `STEP_TIMEOUT_MS`. */
function deleteDatabase(name: string): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    let settled = false
    const finish = (ok: boolean) => {
      if (settled) return
      settled = true
      resolve(ok)
    }

    try {
      const request = indexedDB.deleteDatabase(name)
      request.onsuccess = () => finish(true)
      request.onerror = () => finish(false)
      /*
       * Something in another tab still has it open. Waiting is pointless — the
       * other tab is not going to close because this one asked — so the
       * deletion is abandoned and the store is emptied instead, below.
       */
      request.onblocked = () => finish(false)
      setTimeout(() => finish(false), STEP_TIMEOUT_MS)
    } catch {
      finish(false)
    }
  })
}

/**
 * Empty every object store in a database that would not be deleted.
 *
 * Opened with no version, so it never triggers an upgrade and never blocks on
 * anybody else's connection. A database that does not exist is created and
 * immediately found empty, which is harmless — the next real open recreates its
 * stores anyway.
 */
function emptyDatabase(name: string): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    let settled = false
    const finish = (ok: boolean) => {
      if (settled) return
      settled = true
      resolve(ok)
    }

    try {
      const open = indexedDB.open(name)
      open.onerror = () => finish(false)
      open.onblocked = () => finish(false)
      open.onsuccess = () => {
        const db = open.result
        const stores = [...db.objectStoreNames]
        if (stores.length === 0) {
          db.close()
          finish(true)
          return
        }
        try {
          const tx = db.transaction(stores, 'readwrite')
          stores.forEach((store) => tx.objectStore(store).clear())
          tx.oncomplete = () => {
            db.close()
            finish(true)
          }
          tx.onerror = () => {
            db.close()
            finish(false)
          }
          tx.onabort = () => {
            db.close()
            finish(false)
          }
        } catch {
          db.close()
          finish(false)
        }
      }
      setTimeout(() => finish(false), STEP_TIMEOUT_MS)
    } catch {
      finish(false)
    }
  })
}

function clearWebStorage(report: ResetReport): void {
  try {
    localStorage.clear()
  } catch {
    report.incomplete = true
  }
  try {
    sessionStorage.clear()
  } catch {
    /* Nothing in here outlives the tab anyway. */
  }
}

async function unregisterWorkers(report: ResetReport): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.serviceWorker) return
  try {
    const registrations = await navigator.serviceWorker.getRegistrations()
    await Promise.all(
      registrations.map((registration) =>
        registration.unregister().catch(() => {
          report.incomplete = true
          return false
        }),
      ),
    )
  } catch {
    report.incomplete = true
  }
}
