/**
 * Deterministic randomness.
 *
 * Two different jobs live here, and they are deliberately separate functions.
 *
 * `mulberry32` is a *stream*: call it and it moves on. It is what builds a
 * scattering of points once, at module load, and never again.
 *
 * `hashUnit` is a *lookup*: the same coordinates always give the same number,
 * and asking for one tells you nothing about the next. That is the one that
 * matters for the living scenes, because two canvases drawing the same world —
 * the orb, and the room around it — never share a single object. They agree
 * because they are both asking the same question of the same pure function,
 * which is a far sturdier arrangement than keeping two streams in step.
 */

/**
 * A small, fast, well-distributed generator.
 *
 * `Math.random()` cannot be seeded, and an unseeded scattering means a point of
 * light can move because an unrelated piece of UI state changed. Everything in
 * this app that places something once places it from here.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * A pure hash of any number of integers into `[0, 1)`.
 *
 * The mixing is the same avalanche `mulberry32` uses, applied once per input,
 * so neighbouring coordinates — breath 41 and breath 42 — land nowhere near
 * each other. That is the whole requirement: consecutive breaths must not
 * quietly rhyme.
 */
export function hashUnit(...values: number[]): number {
  let h = 0x2f6e2b1 >>> 0
  for (const value of values) {
    h = (h + Math.imul(value | 0, 0x9e3779b1)) >>> 0
    h ^= h >>> 15
    h = Math.imul(h, 0x85ebca6b) >>> 0
    h ^= h >>> 13
    h = Math.imul(h, 0xc2b2ae35) >>> 0
    h ^= h >>> 16
  }
  return (h >>> 0) / 4294967296
}

/** `hashUnit` mapped onto a range. */
export function hashRange(min: number, max: number, ...values: number[]): number {
  return min + hashUnit(...values) * (max - min)
}

/**
 * The identity this page load draws under.
 *
 * Every living scene is a deterministic function of this number, so one
 * session's cathedral is *its* cathedral — the same bay count, the same
 * proportions, the same tone — for as long as the tab is open, and a different
 * one tomorrow. Deciding it once, at module load, is what keeps the orb and the
 * room around it in the same world without either of them telling the other.
 */
export const SESSION_SEED: number = Math.floor(Math.random() * 0xffffffff)
