/**
 * What went wrong, kept on the device that it went wrong on.
 *
 * Manifester promises that nothing leaves the phone, and that includes its
 * errors: there is no crash reporter here and there will not be one. But "it
 * stopped working last night" is very hard to act on with nothing to look at.
 * So the last few errors are kept in a small ring in `localStorage`, and About
 * offers a button that copies them — for the person to paste into a message if
 * they choose to, and for nobody otherwise.
 *
 * Every part of this is allowed to fail silently. A diagnostics log that could
 * itself throw would be the worst kind of irony.
 */

const KEY = 'manifester:diagnostics'
const LIMIT = 20

export interface DiagnosticEntry {
  /** ISO time it happened. */
  at: string
  /** Where it was caught: `render`, `error`, `rejection`, `chunk`. */
  kind: string
  message: string
  /** The route the person was on, from the hash. */
  where: string
}

function read(): DiagnosticEntry[] {
  try {
    const raw = localStorage.getItem(KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? (parsed as DiagnosticEntry[]) : []
  } catch {
    return []
  }
}

/** Describe anything that was thrown, in one line, without throwing. */
export function describeError(error: unknown): string {
  try {
    if (error instanceof Error) {
      const top = error.stack?.split('\n').slice(0, 3).join(' | ')
      return `${error.name}: ${error.message}${top ? ` — ${top}` : ''}`.slice(0, 600)
    }
    return String(error).slice(0, 600)
  } catch {
    return 'unknown error'
  }
}

export function recordDiagnostic(kind: string, error: unknown): void {
  try {
    const entry: DiagnosticEntry = {
      at: new Date().toISOString(),
      kind,
      message: describeError(error),
      where: typeof location !== 'undefined' ? location.hash || '#/' : '',
    }
    const entries = [...read(), entry].slice(-LIMIT)
    localStorage.setItem(KEY, JSON.stringify(entries))
  } catch {
    // Storage full, blocked, or private mode. Not worth a second failure.
  }
}

export function readDiagnostics(): DiagnosticEntry[] {
  return read()
}

export function clearDiagnostics(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // Nothing to do.
  }
}

/** The log as plain text, with enough about the device to make it useful. */
export function diagnosticsReport(): string {
  const entries = read()
  const head = [
    `Manifester diagnostics — ${new Date().toISOString()}`,
    typeof navigator !== 'undefined' ? navigator.userAgent : '',
    typeof window !== 'undefined'
      ? `viewport ${window.innerWidth}×${window.innerHeight} @${window.devicePixelRatio}x`
      : '',
  ]
  const body = entries.length
    ? entries.map((e) => `${e.at} [${e.kind}] ${e.where} ${e.message}`)
    : ['No errors recorded.']
  return [...head, '', ...body].join('\n')
}

/**
 * A lazily-loaded part of the app that could not be fetched.
 *
 * After a new version is deployed, a page that was opened before it can ask
 * for a chunk by a filename that no longer exists. That is not a bug in the
 * page and there is nothing to show the person about it: the right answer is
 * to load the current version, once.
 */
export function isChunkLoadError(error: unknown): boolean {
  const text = describeError(error)
  return /ChunkLoadError|Loading chunk|dynamically imported module|Importing a module script failed|error loading dynamically/i.test(
    text,
  )
}

const RELOADED_KEY = 'manifester:chunk-reloaded'

/**
 * Reload once to pick up the current build. Returns false when a reload was
 * already tried in this tab, so a genuinely missing file cannot loop. Only
 * ever called when a person has pressed a button that says it will reload.
 */
export function reloadForFreshChunks(): boolean {
  try {
    if (sessionStorage.getItem(RELOADED_KEY)) return false
    sessionStorage.setItem(RELOADED_KEY, String(Date.now()))
  } catch {
    return false
  }
  window.location.reload()
  return true
}

/** Clears the one-reload guard once the app has run cleanly for a while. */
export function markHealthy(): void {
  try {
    sessionStorage.removeItem(RELOADED_KEY)
  } catch {
    // Nothing to do.
  }
}

let installed = false

/** Catch whatever escapes everything else. Installed once, at startup. */
export function installGlobalErrorLog(): void {
  if (installed || typeof window === 'undefined') return
  installed = true

  window.addEventListener('error', (event) => {
    recordDiagnostic('error', event.error ?? event.message)
  })

  /*
   * Recorded, never acted on. A rejection nobody handled is usually something
   * small that already failed quietly — a voice that could not be cached, a
   * permission refused — and reloading for it would end a session that was
   * otherwise going fine. The boundaries are what decide when to recover.
   */
  window.addEventListener('unhandledrejection', (event) => {
    const reason: unknown = event.reason
    recordDiagnostic(isChunkLoadError(reason) ? 'chunk' : 'rejection', reason)
  })

  // A minute of running without needing it means the guard has done its job.
  window.setTimeout(markHealthy, 60_000)
}
