/**
 * One heartbeat, for everything that has to keep time when nobody is looking.
 *
 * ── The problem ──
 *
 * A backgrounded tab is not a paused tab, but every clock the page has is
 * treated as though it were. `requestAnimationFrame` stops outright the moment
 * the page is hidden. `setTimeout` and `setInterval` are clamped to one second
 * — and in Chrome, a page that is not making a sound is clamped to *one minute*
 * after five minutes out of sight. So anything that schedules audio by reacting
 * to a frame or a timer stops scheduling it, and the sound either holds the
 * last thing it was told or falls silent, and then lurches when you come back.
 *
 * That was exactly Manifester's bug: the breath's voice was driven from the
 * player's animation loop, so switching tabs stopped the breath cues, and
 * returning made them jump.
 *
 * ── The answer ──
 *
 * Two independent sources beating the same drum, plus look-ahead everywhere
 * downstream:
 *
 *  1. **A timer.** Half a second, degrading to one second when the page is
 *     hidden. This is the ordinary case and it is perfectly adequate — the
 *     schedulers that listen here all work a *horizon* ahead of themselves, so
 *     a beat that arrives twice as slowly changes nothing about what is heard.
 *
 *  2. **The audio clock.** A short source node scheduled to end half a second
 *     out; its `ended` event beats the drum and arms the next one. The audio
 *     thread has no idea whether a tab is visible, and `ended` is dispatched as
 *     an ordinary task rather than a timer, so nothing throttles it. This is
 *     the source that holds when a browser decides to be aggressive.
 *
 * Neither is trusted on its own. The timer keeps beating if the audio context
 * is suspended (which is what pausing a session does deliberately); the audio
 * clock keeps beating if the timer is throttled into uselessness. `beat()` is
 * idempotent, so both firing is not a problem — it is the point.
 *
 * Nothing here makes a sound. It is a clock, and the only reason it needs an
 * `AudioContext` at all is that the audio thread is the one clock in a browser
 * that a hidden tab cannot slow down.
 */

type Tick = () => void

/** How often the ordinary timer beats while the page is visible. */
const INTERVAL_MS = 500

/** How far ahead the audio-clock ticker schedules its next beat. */
const AUDIO_TICK_SECONDS = 0.5

/**
 * How long past its due time an audio tick may be before it is assumed lost
 * and re-armed. A suspended context stops advancing `currentTime` entirely, so
 * this is reached every time a session is paused.
 */
const AUDIO_TICK_GRACE_SECONDS = 2

const listeners = new Set<Tick>()

interface Alarm {
  /** `Date.now()` at which this is due. */
  at: number
  run: Tick
  timer: number | null
}

const alarms = new Set<Alarm>()

let interval: number | null = null
let clock: BaseAudioContext | null = null
let ticker: AudioScheduledSourceNode | null = null
/** `clock.currentTime` at which the armed tick is due, or 0 when none is. */
let tickerDueAt = 0
let beating = false

/**
 * Offer a context for the audio-clock ticker to run on.
 *
 * Called by every part of the app that opens one — the session bus and the
 * breath's own context — because which of them exists depends on what someone
 * is actually listening to, and the heartbeat only needs one of them. A
 * context is adopted when there is none, or when the one in hand has been
 * closed.
 */
export function registerClockSource(ctx: BaseAudioContext | null): void {
  if (!ctx) return
  if (clock && clock !== ctx && clock.state !== 'closed') return
  if (clock !== ctx) {
    clock = ctx
    ticker = null
    tickerDueAt = 0
  }
  armTicker()
}

/** Forget a context that is being closed, so nothing holds a dead clock. */
export function releaseClockSource(ctx: BaseAudioContext | null): void {
  if (!ctx || clock !== ctx) return
  clock = null
  ticker = null
  tickerDueAt = 0
}

/**
 * Run `fn` on every beat, for as long as the returned function has not been
 * called.
 *
 * A listener must be cheap and it must be idempotent: it will be called about
 * twice a second, sometimes twice in the same millisecond, and sometimes after
 * a gap far longer than it asked for. Every listener in this app answers the
 * question "given the wall clock, what should already have been scheduled?",
 * which is a question with the same answer however often it is asked.
 */
export function onHeartbeat(fn: Tick): () => void {
  listeners.add(fn)
  start()
  return () => {
    listeners.delete(fn)
    stopIfIdle()
  }
}

/**
 * Run `fn` once, as close to `at` as the platform allows, and never earlier.
 *
 * A plain `setTimeout` is armed as well as the heartbeat, because when the page
 * is visible that is accurate to the millisecond and the heartbeat is not.
 * Hidden, the timer arrives late or not at all and the heartbeat is what fires
 * it. Whichever gets there first wins; the alarm is removed before it runs, so
 * the other finds nothing to do.
 */
export function scheduleAt(at: number, fn: Tick): () => void {
  const alarm: Alarm = { at, run: fn, timer: null }
  alarms.add(alarm)
  start()

  if (typeof window !== 'undefined') {
    alarm.timer = window.setTimeout(
      () => {
        alarm.timer = null
        fire(alarm)
      },
      Math.max(0, at - Date.now()),
    )
  }

  return () => cancel(alarm)
}

/** `scheduleAt`, in milliseconds from now. */
export function scheduleIn(ms: number, fn: Tick): () => void {
  return scheduleAt(Date.now() + ms, fn)
}

/**
 * Beat the drum now.
 *
 * Called by both sources, and by anything that has just learned the page's
 * situation changed — coming back to a tab, resuming a session — so the catch-up
 * happens on the same turn rather than up to half a second later.
 */
export function beat(): void {
  // A listener that (indirectly) beats again would otherwise recurse. Every
  // listener is a catch-up, so the outer pass covers the inner one anyway.
  if (beating) return
  beating = true
  try {
    const now = Date.now()
    for (const alarm of [...alarms]) {
      if (alarm.at <= now) fire(alarm)
    }
    for (const listener of [...listeners]) {
      try {
        listener()
      } catch {
        /* One bad listener must not stop the clock for the others. */
      }
    }
    armTicker()
  } finally {
    beating = false
  }
}

/* ── internals ── */

function fire(alarm: Alarm): void {
  if (!alarms.has(alarm)) return
  cancel(alarm)
  try {
    alarm.run()
  } catch {
    /* The caller's problem, not the clock's. */
  }
}

function cancel(alarm: Alarm): void {
  alarms.delete(alarm)
  if (alarm.timer != null && typeof window !== 'undefined') {
    window.clearTimeout(alarm.timer)
    alarm.timer = null
  }
  stopIfIdle()
}

function start(): void {
  if (typeof window === 'undefined' || interval != null) return
  interval = window.setInterval(beat, INTERVAL_MS)
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('pageshow', beat)
  window.addEventListener('focus', beat)
  armTicker()
}

function stopIfIdle(): void {
  if (listeners.size > 0 || alarms.size > 0) return
  if (typeof window === 'undefined') return
  if (interval != null) {
    window.clearInterval(interval)
    interval = null
  }
  document.removeEventListener('visibilitychange', onVisibility)
  window.removeEventListener('pageshow', beat)
  window.removeEventListener('focus', beat)
  disarmTicker()
}

function onVisibility(): void {
  // Both directions. Coming back needs the catch-up; going away needs the
  // audio ticker armed before the timer is throttled out from under it.
  beat()
}

/**
 * Arm the next audio-clock tick.
 *
 * A `ConstantSourceNode` at zero offset is silence with a stop time, which is
 * all this needs — but it is connected to the destination rather than left
 * dangling, deliberately. Browsers decide whether a page is "playing audio"
 * from what reaches the output, and a page that is playing audio is the one
 * Chrome exempts from its harshest background throttling. A silent connection
 * costs nothing and buys the timer beside it a better chance.
 */
function armTicker(): void {
  const ctx = clock
  if (!ctx || (listeners.size === 0 && alarms.size === 0)) return
  if (ctx.state === 'closed') {
    clock = null
    ticker = null
    tickerDueAt = 0
    return
  }

  if (ticker) {
    // Still in flight, unless its due time went by without the event arriving —
    // which is what a suspended context looks like from here.
    if (ctx.currentTime < tickerDueAt + AUDIO_TICK_GRACE_SECONDS) return
    disarmTicker()
  }

  let node: ConstantSourceNode
  try {
    node = ctx.createConstantSource()
  } catch {
    return
  }

  node.offset.value = 0
  try {
    node.connect(ctx.destination)
  } catch {
    /* Unconnected still keeps time; it simply does not vote on "playing". */
  }

  const due = ctx.currentTime + AUDIO_TICK_SECONDS
  node.onended = () => {
    try {
      node.disconnect()
    } catch {
      /* Already gone. */
    }
    if (ticker === node) {
      ticker = null
      tickerDueAt = 0
      beat()
    }
  }

  try {
    node.start()
    node.stop(due)
  } catch {
    try {
      node.disconnect()
    } catch {
      /* Already gone. */
    }
    return
  }

  ticker = node
  tickerDueAt = due
}

function disarmTicker(): void {
  const node = ticker
  ticker = null
  tickerDueAt = 0
  if (!node) return
  node.onended = null
  try {
    node.stop()
  } catch {
    /* Never started, or already stopped. */
  }
  try {
    node.disconnect()
  } catch {
    /* Already gone. */
  }
}

/** Test-only: forget every listener, alarm and clock source. */
export function resetHeartbeat(): void {
  for (const alarm of [...alarms]) cancel(alarm)
  listeners.clear()
  disarmTicker()
  clock = null
  stopIfIdle()
}
