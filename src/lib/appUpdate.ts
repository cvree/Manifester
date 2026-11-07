/**
 * When a new version of the app may take over the page.
 *
 * The service worker updates quietly (`autoUpdate`, `skipWaiting`), and the
 * plugin's default on taking control is `window.location.reload()` — right
 * then, whatever is on screen. A reload in the middle of a breathing session
 * is indistinguishable from a crash: the voice stops, the orb vanishes, the
 * page flashes white. So the reload is held here until a moment when nobody
 * can lose anything to it.
 *
 * That moment is a person *coming back* to the app — the page turning visible
 * again — with no session running or paused. It looks exactly like a cold
 * launch, which is when people expect an app to be new. If that moment never
 * comes, the next real launch loads the new version anyway, because the new
 * worker is already in control.
 */

let busy = false
let pending = false
let listening = false

/** The session tells this whether reloading now would interrupt it. */
export function setSessionBusy(next: boolean): void {
  busy = next
}

function reloadIfSafe(): void {
  if (!pending || busy) return
  if (document.visibilityState !== 'visible') return
  pending = false
  window.location.reload()
}

/** Passed to `registerSW` as `onNeedReload`. */
export function deferReload(): void {
  pending = true
  if (listening || typeof document === 'undefined') return
  listening = true
  // Not now, even if idle: a reload under someone's eyes is a flicker they did
  // nothing to cause. The next time they return to the app is the moment.
  document.addEventListener('visibilitychange', reloadIfSafe)
  window.addEventListener('pageshow', reloadIfSafe)
}
