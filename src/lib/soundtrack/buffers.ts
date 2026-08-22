/**
 * Fetching and decoding the music, once each.
 *
 * Eleven megabytes of MP3 decode to about a hundred and seventy megabytes of
 * float samples, which is more than a phone will give a web page for a
 * background layer. So this is a cache with a budget rather than a map: the
 * pieces in use are held, the rest are let go, and coming back to one costs a
 * decode of something the browser already has in its HTTP cache rather than a
 * download.
 *
 * Three separate promises are kept apart on purpose:
 *
 *  - **the network**, which the service worker turns into a one-time cost per
 *    piece per device (see the `manifester-music` rule in `vite.config.ts`);
 *  - **the decode**, which is CPU and memory and is what the budget governs;
 *  - **the request in flight**, so that a scene changed twice in a second
 *    fetches each piece once rather than once per change.
 *
 * Nothing here throws. A piece that cannot be had is `null`, and the manager's
 * answer to `null` is silence — which is the correct behaviour for a layer
 * whose entire promise is that you do not notice it.
 */

import { findTrack, trackUrl, type SoundtrackTrackId } from './tracks'

/**
 * How much decoded audio may be held at once, in seconds.
 *
 * Stereo at 44.1 kHz is about 350 kB per second, so this is a little over a
 * hundred megabytes — and it is that number rather than a round one because it
 * is the size of the largest working set the app can legitimately ask for: the
 * three-minute listening piece and the two-minute editing piece, which are
 * exactly what "current and likely next" means on the editor. Anything smaller
 * and that pair would thrash, decoding a piece and evicting it moments later.
 *
 * The pieces the app is actually holding are exempt, so a crossfade may exceed
 * this for the two and a half seconds it lasts rather than being starved
 * halfway through. Everything else is evicted least-recently-used.
 */
const BUDGET_SECONDS = 300

export class BufferLibrary {
  private readonly getContext: () => BaseAudioContext | null
  private readonly decoded = new Map<SoundtrackTrackId, AudioBuffer>()
  private readonly inFlight = new Map<SoundtrackTrackId, Promise<AudioBuffer | null>>()
  /** Insertion order is eviction order; touched on every use. */
  private readonly used: SoundtrackTrackId[] = []
  private readonly held = new Set<SoundtrackTrackId>()
  /** Pieces that failed, so a broken deployment is not retried on every route. */
  private readonly failed = new Set<SoundtrackTrackId>()

  constructor(getContext: () => BaseAudioContext | null) {
    this.getContext = getContext
  }

  /** The decoded piece if it is already here, without starting any work. */
  peek(id: SoundtrackTrackId): AudioBuffer | null {
    const buffer = this.decoded.get(id)
    if (buffer) this.touch(id)
    return buffer ?? null
  }

  /**
   * The decoded piece, fetching and decoding it if necessary.
   *
   * Resolves to `null` rather than rejecting: there is no audio context yet,
   * or the file is missing, or the decoder refused it. Every one of those is a
   * reason to be quiet, and none of them is a reason to interrupt somebody.
   */
  load(id: SoundtrackTrackId): Promise<AudioBuffer | null> {
    const ready = this.decoded.get(id)
    if (ready) {
      this.touch(id)
      return Promise.resolve(ready)
    }
    if (this.failed.has(id)) return Promise.resolve(null)

    const existing = this.inFlight.get(id)
    if (existing) return existing

    const work = this.fetchAndDecode(id).finally(() => {
      this.inFlight.delete(id)
    })
    this.inFlight.set(id, work)
    return work
  }

  /**
   * Warm a piece up without waiting for it.
   *
   * Used for the one move the person is most likely to make next, so that
   * pressing play crossfades rather than pausing to download. Deliberately
   * fire-and-forget: nothing depends on it finishing, and if it does not, the
   * scene change that needed it simply waits a moment longer.
   */
  prefetch(id: SoundtrackTrackId): void {
    if (this.decoded.has(id) || this.inFlight.has(id) || this.failed.has(id)) return
    void this.load(id)
  }

  /**
   * Declare the working set: what is playing, what is fading out, and what is
   * most likely to be wanted next.
   *
   * Wholesale rather than one at a time, because the failure it prevents is a
   * *pair* going out of sync — a piece fetched for the next scene and evicted
   * by the piece playing now, then fetched again on the next navigation. The
   * manager knows the whole set at once, so it says the whole set at once.
   */
  keep(ids: readonly SoundtrackTrackId[]): void {
    this.held.clear()
    for (const id of ids) this.held.add(id)
    this.trim()
  }

  /** Let go of everything. The music has been turned off, or the page is going. */
  clear(): void {
    this.decoded.clear()
    this.used.length = 0
    this.held.clear()
  }

  private async fetchAndDecode(id: SoundtrackTrackId): Promise<AudioBuffer | null> {
    const ctx = this.getContext()
    if (!ctx) return null

    try {
      const response = await fetch(trackUrl(findTrack(id)))
      if (!response.ok) throw new Error(`${response.status}`)
      const bytes = await response.arrayBuffer()
      const buffer = await ctx.decodeAudioData(bytes)

      this.decoded.set(id, buffer)
      this.touch(id)
      this.trim()
      return buffer
    } catch {
      /*
       * Marked rather than retried. A missing file is missing on every route,
       * and a decoder that refused this container will refuse it again — so
       * retrying costs a download per navigation and buys nothing. A reload is
       * the recovery, which is also when a deployment gets fixed.
       */
      this.failed.add(id)
      return null
    }
  }

  private touch(id: SoundtrackTrackId): void {
    const at = this.used.indexOf(id)
    if (at >= 0) this.used.splice(at, 1)
    this.used.push(id)
  }

  /** Drop the least recently used pieces until the budget is met again. */
  private trim(): void {
    let total = 0
    for (const buffer of this.decoded.values()) total += buffer.duration

    for (const id of [...this.used]) {
      if (total <= BUDGET_SECONDS) return
      if (this.held.has(id)) continue
      const buffer = this.decoded.get(id)
      if (!buffer) continue
      total -= buffer.duration
      this.decoded.delete(id)
      this.used.splice(this.used.indexOf(id), 1)
    }
  }
}
