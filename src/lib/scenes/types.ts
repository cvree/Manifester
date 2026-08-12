/**
 * The living forms.
 *
 * Five of the app's six original breathing forms are drawn by the stylesheet:
 * a handful of elements, one transform each, and no JavaScript at all per
 * frame. That is the right way to build a shape that opens and closes, and it
 * is why those five cost nothing.
 *
 * These two are not shapes that open and close. Ink Cathedral builds an
 * architecture on the way up and lets it come apart into vapour on the way
 * down; Moonpool is water with inertia of its own, seen from underneath. Both
 * need geometry that changes with every breath and a few hundred points of
 * light that are somewhere different each frame, and neither of those is a
 * thing CSS can be asked for honestly. So they are drawn on a canvas.
 *
 * What they are *not* is a second clock. Every one of them reads the same
 * `LiveBreath` the stylesheet reads, written by `useBreathing` on the same
 * frame from the same `breathStateAt` call. A living scene never asks what
 * time it is; it is told, and it draws that.
 */

import type { LiveBreath } from '../useBreathing'

/**
 * Deliberately its own union rather than a slice of `BreathStyleId`: this
 * module is the renderers' vocabulary and knows nothing about the settings
 * that choose between them. `isLivingStyle`, in `breathing.ts`, is the one
 * place the two vocabularies meet.
 */
export type LivingStyleId = 'cathedral' | 'moonpool'

/**
 * Where a scene is being drawn, and how much of itself it should show.
 *
 * The same world is drawn twice at once: once inside the orb, as a portal a
 * few hundred pixels across, and once across the whole viewport as the room
 * around it. Everything a scene draws is measured against `radius`, so the two
 * are the same world at two scales rather than two drawings that resemble each
 * other.
 */
export interface SceneView {
  /** CSS pixels. The context is already scaled by the device ratio. */
  width: number
  height: number
  /** Where the world is centred, in CSS pixels. The orb's own middle. */
  cx: number
  cy: number
  /** The orb's radius: the unit everything in the scene is measured in. */
  radius: number
  /**
   * How much of itself the scene is showing, 0 → 1. The orb is always 1; the
   * room reads the background visualiser's mix, so it can be switched on
   * halfway through an in-breath and simply fade in at that value.
   */
  mix: number
  /** True for the viewport-wide room, false for the orb's portal. */
  field: boolean
  /** Whether the app is in its night palette. */
  dark: boolean
  /** False on a modest device: fewer points, and no second glow pass. */
  rich: boolean
  /** Parallax offset in CSS pixels, already smoothed. Zero in the orb. */
  driftX: number
  driftY: number
}

/**
 * A world that can be advanced and drawn.
 *
 * `update` is where a scene's own life happens — the drift of vapour, the
 * inertia of water — and it is the only place a scene is allowed to keep state
 * that the breath does not determine. `draw` must be a pure function of that
 * state and the view, so the same world drawn into two canvases is the same
 * world.
 */
export interface LivingScene {
  update(dt: number, breath: LiveBreath, view: SceneView): void
  draw(ctx: CanvasRenderingContext2D, view: SceneView): void
}

/* ── Shared shaping ─────────────────────────────────────────── */

export function clamp(value: number, min = 0, max = 1): number {
  return value < min ? min : value > max ? max : value
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** 0 below `edge0`, 1 above `edge1`, smooth in between. */
export function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp((value - edge0) / (edge1 - edge0 || 1e-6))
  return t * t * (3 - 2 * t)
}

/** Slower at both ends than `smoothstep`. The shape a held breath has. */
export function smootherstep(edge0: number, edge1: number, value: number): number {
  const t = clamp((value - edge0) / (edge1 - edge0 || 1e-6))
  return t * t * t * (t * (t * 6 - 15) + 10)
}

/**
 * A first-order lag, framerate-independent.
 *
 * This is where water gets its inertia. Following the breath curve exactly is
 * what a diagram does; a real surface is still catching up when the breath has
 * already turned, and that half-second of disagreement is most of the reason
 * Moonpool reads as a body of water rather than as a circle being scaled.
 */
export function approach(current: number, target: number, rate: number, dt: number): number {
  const k = 1 - Math.exp(-rate * dt)
  return current + (target - current) * k
}

/**
 * Two sines at an irrational ratio: a wobble with no period a viewer can find.
 *
 * Everything in these scenes that moves on its own moves on one of these
 * rather than on a single sine, because a single sine at four seconds against
 * a four-second breath resolves into a pulse within about a minute.
 */
export function wander(t: number, a: number, b: number): number {
  return Math.sin(t * a) * 0.62 + Math.sin(t * b * 1.61803 + 1.7) * 0.38
}

/* ── Colour ─────────────────────────────────────────────────── */

export type Rgb = readonly [number, number, number]

export function rgba(colour: Rgb, alpha: number): string {
  const a = alpha < 0 ? 0 : alpha > 1 ? 1 : alpha
  return `rgba(${colour[0]},${colour[1]},${colour[2]},${a.toFixed(4)})`
}

export function mixRgb(a: Rgb, b: Rgb, t: number): Rgb {
  return [
    Math.round(lerp(a[0], b[0], t)),
    Math.round(lerp(a[1], b[1], t)),
    Math.round(lerp(a[2], b[2], t)),
  ]
}

/**
 * Manifester's own accents, as numbers.
 *
 * Taken from the night palette in `theme.css` rather than invented, because
 * these two rooms have to look like they belong to the same app as the other
 * four. A scene may shift its tone within this set from session to session; it
 * may not wander outside it.
 */
export const PALETTE = {
  /** `--ink` at night: the pearl these scenes are mostly made of. */
  pearl: [243, 236, 226] as Rgb,
  /** `--gold-base` at night. */
  gold: [231, 203, 148] as Rgb,
  /** `--rose-base` at night. */
  rose: [229, 170, 177] as Rgb,
  /** `--twilight-base` at night: the cold end of the range. */
  twilight: [183, 195, 230] as Rgb,
  /** Moonlight, cooler and whiter than pearl. */
  moon: [226, 232, 248] as Rgb,
  /** `--bg-0-base` at night: the ground everything is drawn over. */
  night: [20, 17, 31] as Rgb,
  /** The deep water Moonpool sits in. */
  abyss: [8, 12, 26] as Rgb,
} as const

/**
 * A soft round brush, drawn once and stamped thousands of times.
 *
 * A radial gradient per particle is a gradient object allocated, built and
 * thrown away sixty times a second times two hundred particles, and it is by
 * some distance the most expensive thing a naive canvas scene does. One
 * pre-rendered sprite scaled by `drawImage` is a texture upload the GPU
 * already has.
 */
export function softSprite(colour: Rgb, hardness = 0.16): HTMLCanvasElement {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  const gradient = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  )
  gradient.addColorStop(0, rgba(colour, 1))
  gradient.addColorStop(hardness, rgba(colour, 0.62))
  gradient.addColorStop(0.5, rgba(colour, 0.16))
  gradient.addColorStop(1, rgba(colour, 0))
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)
  return canvas
}

/** Stamp a `softSprite` centred on a point, at a radius in CSS pixels. */
export function stamp(
  ctx: CanvasRenderingContext2D,
  sprite: HTMLCanvasElement,
  x: number,
  y: number,
  radius: number,
  alpha: number,
): void {
  if (alpha <= 0.002 || radius <= 0.15) return
  ctx.globalAlpha = alpha > 1 ? 1 : alpha
  ctx.drawImage(sprite, x - radius, y - radius, radius * 2, radius * 2)
}
