/**
 * The first place the app looks, and the only one that costs nothing.
 *
 * Decoded audio is expensive twice over: it takes a few milliseconds of main
 * thread to produce, and it is large — 24 kHz mono float PCM is about 96 KB
 * per second, so a thirty-second budget is a couple of megabytes. Both facts
 * matter here. Holding decoded buffers is what makes a repeated line
 * instantaneous; bounding how many are held is what keeps a two-hour session
 * on a four-year-old phone from being slowly strangled by its own cache.
 *
 * Least-recently-used, bounded by *bytes* rather than by count, because clips
 * in this app range from a two-word title to a long affirmation and counting
 * them would make the budget meaningless.
 */

/** Roughly 90 seconds of decoded speech. */
const DEFAULT_BUDGET_BYTES = 8 * 1024 * 1024

interface Entry {
  buffer: AudioBuffer
  bytes: number
}

export class MemoryCache {
  private entries = new Map<string, Entry>()
  private bytes = 0

  private budgetBytes: number

  constructor(budgetBytes = DEFAULT_BUDGET_BYTES) {
    this.budgetBytes = budgetBytes
  }

  get size(): number {
    return this.entries.size
  }

  get byteLength(): number {
    return this.bytes
  }

  has(key: string): boolean {
    return this.entries.has(key)
  }

  /** Reading promotes: a `Map` preserves insertion order, so re-insert. */
  get(key: string): AudioBuffer | null {
    const entry = this.entries.get(key)
    if (!entry) return null
    this.entries.delete(key)
    this.entries.set(key, entry)
    return entry.buffer
  }

  set(key: string, buffer: AudioBuffer): void {
    const bytes = estimateBytes(buffer)
    // A single clip larger than the whole budget is held anyway — it is the
    // one that was just asked for — but it will be first out next time.
    const existing = this.entries.get(key)
    if (existing) this.bytes -= existing.bytes
    this.entries.set(key, { buffer, bytes })
    this.bytes += bytes
    this.evict()
  }

  delete(key: string): void {
    const entry = this.entries.get(key)
    if (!entry) return
    this.entries.delete(key)
    this.bytes -= entry.bytes
  }

  clear(): void {
    this.entries.clear()
    this.bytes = 0
  }

  private evict(): void {
    while (this.bytes > this.budgetBytes && this.entries.size > 1) {
      const oldest = this.entries.keys().next()
      if (oldest.done) return
      this.delete(oldest.value)
    }
  }
}

/** Float32 samples, one array per channel, plus a little for the object. */
export function estimateBytes(buffer: AudioBuffer): number {
  return buffer.length * buffer.numberOfChannels * 4 + 128
}
