/**
 * Ink Cathedral.
 *
 * Almost-black space. Luminous ink rises through it as you fill — tendrils
 * that wander, branch, meet and brighten — and by the top of the breath they
 * have built something with piers, arches and a vault: a cathedral, drawn in
 * light, at the scale of a room.
 *
 * The single most important thing about it is what happens on the way down.
 *
 * An in-breath that plays backwards is not an out-breath, it is a rewind, and
 * a rewind is the one thing the eye refuses to read as breathing. So the
 * exhale is a *different event*. The architecture does not retract along the
 * path it grew; it loosens. Strands release in an order of their own, come
 * away from the structure they were holding, and turn into vapour that drifts
 * up and outward and thins into nothing. What is left at the bottom is a dark
 * room with a few motes still in the air — which is where the next breath
 * starts, and why the room reads as one place rather than as a loop.
 *
 * ── Never the same twice, and never a different world ──
 *
 * Two kinds of randomness, kept strictly apart.
 *
 * The *session* seed decides what this cathedral is: how many bays, how far
 * apart, how high the arches spring, how warm the ink runs. It is fixed for as
 * long as the tab is open, so the place you are breathing in is somewhere you
 * are returning to breath after breath.
 *
 * The *breath* index perturbs it. Every value the session chose is nudged by a
 * hash of `(seed, breath)` — a few percent, never more — and the branching, the
 * tendril count and the highlights are redrawn from that hash. So no two
 * breaths build the same building, and every one of them is recognisably the
 * same cathedral. Occasionally the hash lands on something rarer: a rose
 * window, a ceiling of constellations, one perfect twin arch, a fall of light
 * down the central axis.
 *
 * Both canvases drawing this world — the orb, and the room around it — build
 * from the same two numbers and therefore build the same thing, without ever
 * exchanging a byte. See `hashUnit` in `random.ts`.
 */

import { easeInOut } from '../breathing'
import { hashUnit, mulberry32 } from '../random'
import type { LiveBreath } from '../useBreathing'
import {
  clamp,
  lerp,
  mixRgb,
  PALETTE,
  rgba,
  smoothstep,
  smootherstep,
  softSprite,
  stamp,
  type LivingScene,
  type Rgb,
  type SceneView,
} from './types'

/* ── The world this session is in ───────────────────────────── */

export interface CathedralWorld {
  /**
   * Piers either side of the axis. Three is a chapel; six is a nave that runs
   * off both edges of the screen, which is the one the room wants.
   */
  bays: number
  /** Distance between piers, in orb radii. */
  spacing: number
  /** The springing line: the height every arch in the arcade starts from. */
  spring: number
  /** The arch's rise, as a multiple of the bay width. */
  loft: number
  /** 0 is pearl, 1 is gold. Where this session's ink sits between them. */
  tone: number
  /** How willing the tendrils are to branch. */
  vigour: number
}

/*
 * The proportions, and why they are these proportions.
 *
 * Everything is measured in one unit, and the whole building is about two and
 * a half of them tall. The piers take the lower half, the arch above them is
 * taller than it is wide, and the vault gathers a little above that. Those
 * three facts are the difference between a cathedral and a row of croquet
 * hoops — which is what the first version of this drew, because the arches
 * were as wide as they were high and sprang from wherever each tendril
 * happened to stop.
 *
 * They spring from a *line* now. Real arcades have one springing height across
 * the whole nave, and the eye knows it even when it could not name it: a
 * shared horizontal is what turns separate arches into an arcade.
 */
export function worldFor(seed: number): CathedralWorld {
  return {
    bays: 3 + Math.floor(hashUnit(seed, 11) * 4),
    spacing: 0.55 + hashUnit(seed, 12) * 0.3,
    spring: 1.05 + hashUnit(seed, 13) * 0.35,
    /** As a multiple of the bay width. Above 1 is Gothic; this never goes below. */
    loft: 1.05 + hashUnit(seed, 14) * 0.45,
    tone: 0.38 + hashUnit(seed, 15) * 0.54,
    vigour: 0.4 + hashUnit(seed, 16) * 0.34,
  }
}

/* ── What this particular breath builds ─────────────────────── */

/**
 * The rare moments.
 *
 * Rare on purpose, and rare in the way weather is rare rather than in the way
 * a slot machine is: about one breath in six brings something, which over a
 * ten-minute session is a handful of them. Often enough to be worth staying
 * for, seldom enough that none of them ever becomes the thing the form does.
 */
export type Rarity = 'none' | 'rose' | 'constellation' | 'twin' | 'lightfall'

export function rarityFor(seed: number, breath: number): Rarity {
  const roll = hashUnit(seed, breath, 0x51)
  if (roll < 0.045) return 'rose'
  if (roll < 0.085) return 'constellation'
  if (roll < 0.125) return 'twin'
  if (roll < 0.165) return 'lightfall'
  return 'none'
}

interface Node {
  x: number
  y: number
  /** 0 → 1: how far into the growth this point appears. */
  t: number
  /** Half-width of the ink here, in orb radii. */
  w: number
}

interface Strand {
  points: Node[]
  /** Its own extent in world units, so an off-screen strand costs one compare. */
  minX: number
  maxX: number
  /** 0 → 1: when this strand lets go on the way down. */
  release: number
  /** Back of the room to front of it. Decides brightness and blur. */
  depth: number
  bright: number
}

interface Arch {
  /** Sampled once, apex at the middle of the array. */
  points: Node[]
  apexX: number
  apexY: number
  depth: number
  release: number
}

interface Rib {
  x0: number
  y0: number
  x1: number
  y1: number
  release: number
  depth: number
}

export interface Cathedral {
  strands: Strand[]
  arches: Arch[]
  ribs: Rib[]
  rarity: Rarity
  /** Where the vault gathers. */
  vaultY: number
  /** This breath's own tint, a small wander around the session's tone. */
  tone: number
  /** Points of the constellation ceiling, when there is one. */
  ceiling: Array<{ x: number; y: number; size: number }>
  roseY: number
  roseR: number
  rosePetals: number
}

/** How tall the tallest tendril reaches before the arches take over. */
const STRAND_TOP = 0.78

/* ── The two rules an exhale is made of ─────────────────────── */

/**
 * How much of the architecture has been revealed, given where the breath is.
 *
 * The single most important function in this file, and the one it would be
 * easiest to get wrong by writing nothing at all: tie the reveal to `--e` and
 * an out-breath un-draws the arches from the keystone back down to the
 * springing, which every viewer reads instantly as a video being scrubbed
 * backwards rather than as a breath leaving.
 *
 * So the reveal rises with the in-breath, holds at the top, and *does not move*
 * for the whole of the exhale — during which the building comes apart instead.
 * A new in-breath starts it from nothing.
 */
export function revealFor(
  phase: LiveBreath['phase'],
  expansion: number,
  previous: number,
): number {
  // `expansion` rises monotonically through an in-breath, so following it is
  // itself the high-water mark; the point is that nothing may lower it.
  if (phase === 'inhale') return expansion
  if (phase === 'holdIn') return 1
  return previous
}

/**
 * And how far it should have come apart.
 *
 * Zero all the way up and through the hold. On the way down it runs a little
 * *ahead* of the breath — the multiplier — so the structure is already letting
 * go while it is still bright, which is what makes an exhale read as a release
 * rather than as a fade-out.
 */
export function dissolveFor(phase: LiveBreath['phase'], progress: number): number {
  if (phase === 'exhale') return clamp(easeInOut(progress) * 1.18)
  return phase === 'holdOut' ? 1 : 0
}

/**
 * Grow one tendril, and whatever it decides to branch into.
 *
 * Angles are measured from straight up, so a tendril leaves the floor at zero
 * and leans. It wanders a little each step — never enough to look drawn by
 * hand, always enough that no two piers are the same pier — and every point
 * carries the growth value at which it appears, which is the whole reveal
 * mechanism: drawing a strand is walking it until `t` passes the front.
 */
function grow(
  into: Strand[],
  random: () => number,
  x: number,
  y: number,
  angle: number,
  length: number,
  width: number,
  t0: number,
  t1: number,
  depth: number,
  generation: number,
  vigour: number,
): void {
  const steps = 6 + Math.floor(random() * 5)
  const points: Node[] = [{ x, y, t: t0, w: width }]
  let px = x
  let py = y
  let a = angle
  /*
   * A pier wanders barely at all; a branch off one wanders freely. That
   * asymmetry is load-bearing: ink that meanders on its way up is a vine, and
   * this is not a vine. What makes it read as *grown* rather than as drafted is
   * the tracery hanging off it, not the shaft itself.
   */
  const curl = generation === 0 ? 0.045 : 0.2 + random() * 0.26

  for (let s = 1; s <= steps; s += 1) {
    const f = s / steps
    a += (random() - 0.5) * curl
    const step = length / steps
    px += Math.sin(a) * step
    py += Math.cos(a) * step
    const t = lerp(t0, t1, f)
    points.push({ x: px, y: py, t, w: width * (1 - f * 0.55) })

    // Branching happens above the base and below the tip: a fork at the very
    // top reads as a broken line, and one at the floor as a puddle.
    if (generation < 2 && f > 0.32 && f < 0.86 && random() < vigour * 0.5) {
      const side = random() < 0.5 ? -1 : 1
      grow(
        into,
        random,
        px,
        py,
        a + side * (0.34 + random() * 0.52),
        length * (0.4 + random() * 0.34),
        width * 0.56,
        t,
        Math.min(t1, t + (t1 - t0) * 0.62),
        depth,
        generation + 1,
        vigour,
      )
    }
  }

  let minX = points[0].x
  let maxX = points[0].x
  for (const node of points) {
    if (node.x < minX) minX = node.x
    if (node.x > maxX) maxX = node.x
  }

  into.push({
    points,
    minX,
    maxX,
    release: random(),
    depth,
    bright: 0.7 + random() * 0.5,
  })
}

/**
 * An arch, sampled into a polyline that carries its own reveal.
 *
 * Two quadratic halves meeting at a point rather than one curve through a
 * rounded top, because the difference between a Roman arch and a Gothic one is
 * the whole difference between a tunnel and a cathedral: a pointed apex pulls
 * the eye up, and up is the direction this entire form is about.
 *
 * `t` is distance from whichever spring is nearer, so drawing everything below
 * a threshold closes the arch from both sides toward the keystone at once —
 * which is how an arch is actually built, and why the moment it meets reads as
 * the structure *connecting* rather than as a line finishing.
 */
function archPoints(
  x0: number,
  y0: number,
  apexX: number,
  apexY: number,
  x1: number,
  y1: number,
  width: number,
): Node[] {
  const half = 13
  const points: Node[] = []

  for (let i = 0; i <= half * 2; i += 1) {
    const side = i <= half ? 0 : 1
    const u = side === 0 ? i / half : (i - half) / half
    const inv = 1 - u
    // The control point sits directly above the spring, which is what leans
    // the curve inward and brings the two halves to a point at the top.
    const sx = side === 0 ? x0 : x1
    const sy = side === 0 ? y0 : y1
    const cxp = sx + (apexX - sx) * 0.14
    const cyp = sy + (apexY - sy) * 0.86
    const fromSpring = side === 0 ? u : 1 - u
    const x = side === 0
      ? inv * inv * sx + 2 * inv * u * cxp + u * u * apexX
      : inv * inv * apexX + 2 * inv * u * cxp + u * u * sx
    const y = side === 0
      ? inv * inv * sy + 2 * inv * u * cyp + u * u * apexY
      : inv * inv * apexY + 2 * inv * u * cyp + u * u * sy

    points.push({
      x,
      y,
      t: fromSpring,
      // Heavier at the springing than at the keystone: an arch carries its
      // load at the bottom, and drawing it that way is most of what makes a
      // line read as stone rather than as wire.
      w: width * (1.15 - 0.5 * (side === 0 ? u : 1 - u)),
    })
  }

  return points
}

export function buildCathedral(seed: number, breath: number, world: CathedralWorld): Cathedral {
  const random = mulberry32((seed ^ Math.imul(breath + 1, 0x9e3779b1)) >>> 0)
  const rarity = rarityFor(seed, breath)
  const twin = rarity === 'twin'

  /*
   * The breath's own perturbation of the session's world. Small numbers on
   * purpose: this is the difference between a cathedral that is never the same
   * twice and a cathedral that is a different building every four seconds.
   */
  const bays = twin ? 1 : world.bays + (hashUnit(seed, breath, 3) < 0.22 ? 1 : 0)
  const spacing = world.spacing * lerp(0.92, 1.1, hashUnit(seed, breath, 4)) * (twin ? 1.5 : 1)
  const springY = world.spring * lerp(0.94, 1.08, hashUnit(seed, breath, 5))
  const loft =
    spacing * world.loft * lerp(0.9, 1.14, hashUnit(seed, breath, 6)) * (twin ? 1.3 : 1)
  // Perfect mirror symmetry is itself one of the rare moments; ordinarily the
  // two sides of the nave lean a few percent differently, which is what stops
  // the whole thing reading as a stencil.
  const symmetry = twin ? 1 : 0.72 + hashUnit(seed, breath, 7) * 0.24
  const tone = clamp(world.tone + (hashUnit(seed, breath, 8) - 0.5) * 0.34)

  const strands: Strand[] = []
  /*
   * Where each pier stands. Only the x matters: every arch springs from the
   * shared line rather than from wherever its own tendril happened to stop, so
   * the height a shaft actually reached is not part of the architecture.
   */
  const piers: number[] = []

  for (let i = -bays; i <= bays; i += 1) {
    if (twin && i === 0) continue
    const near = 1 - Math.abs(i) / (bays + 1)
    const jitter = (random() - 0.5) * (1 - symmetry) * 0.5
    const baseX = i * spacing + jitter * spacing
    // Within a few percent of the springing line, never far from it: an
    // arcade's verticals all reach the same height, and the small differences
    // are what stop it looking printed.
    const height = springY * lerp(0.97, 1.03, random())

    /*
     * A pier is a *cluster*, not a line.
     *
     * Gothic columns are bundles of shafts, and the first version of this drew
     * one tendril each — which is why it read as a row of twigs rather than as
     * a nave. Two or three strands rising within a few percent of one another,
     * at slightly different heights and slightly different leans, is the whole
     * difference: close enough that the eye fuses them into a column, separate
     * enough that the column has grain.
     */
    const shafts = 2 + (random() < 0.55 ? 1 : 0)

    for (let s = 0; s < shafts; s += 1) {
      const lead = s === 0
      const offset = lead ? 0 : (random() - 0.5) * 0.14
      grow(
        strands,
        random,
        baseX + offset,
        0,
        i * 0.012 + (random() - 0.5) * 0.05,
        height * (lead ? 1 : 0.72 + random() * 0.26),
        (lead ? 0.05 : 0.028) * lerp(0.68, 1.2, near),
        0,
        lead ? STRAND_TOP : STRAND_TOP * (0.7 + random() * 0.24),
        near * (lead ? 1 : 0.82),
        lead ? 0 : 1,
        world.vigour,
      )
    }
    piers.push(baseX)
  }

  piers.sort((a, b) => a - b)

  /*
   * The rise is capped against the springing line, and it has to be.
   *
   * `loft` is a multiple of the bay width, and the bays are themselves varied
   * per session and per breath — so on a wide-bayed session with a lofty roll
   * the two multiply into a vault nearly twice as tall as the scene expects,
   * and the ribs, the keystones and the rose window are drawn off the top of
   * the orb. Which is to say: on those seeds the entire reward for finishing
   * the in-breath happened somewhere nobody could see it.
   *
   * The scene also scales itself to whatever this returns, so the cap is not
   * what keeps the vault on screen — it is what keeps the *proportions* the
   * ones this form is about. Without it a tall cathedral is not more dramatic,
   * it is the same cathedral drawn smaller.
   */
  const vaultY = clamp(springY + loft * 1.45, springY * 1.35, 3.1)

  const arches: Arch[] = []
  const ribs: Rib[] = []

  for (let i = 0; i < piers.length - 1; i += 1) {
    const left = piers[i]
    const right = piers[i + 1]
    const midX = (left + right) / 2
    const near = 1 - Math.abs(midX) / (spacing * (bays + 1))
    const apexY = Math.min(
      springY + loft * lerp(0.88, 1.08, random()),
      // Under the vault the ribs rise to, always: an arch that pokes through
      // its own ceiling is the one shape that reads as a mistake rather than
      // as a variation.
      vaultY * 0.88,
    )
    const apexX = midX + (random() - 0.5) * (1 - symmetry) * 0.3

    arches.push({
      // Springing from the line rather than from each tendril's own tip.
      points: archPoints(left, springY, apexX, apexY, right, springY, 0.03),
      apexX,
      apexY,
      depth: near,
      release: random(),
    })

    // The vault: ribs leaving each keystone for the point the whole ceiling
    // gathers at. These are the last thing to arrive, and the reason the top
    // of an in-breath feels like a ceiling closing over you.
    const fan = 2 + Math.floor(random() * 3)
    for (let r = 0; r < fan; r += 1) {
      const spreadTarget = ((r + 0.5) / fan - 0.5) * spacing * 0.9
      ribs.push({
        x0: apexX,
        y0: apexY,
        x1: apexX * 0.28 + spreadTarget,
        y1: vaultY * lerp(0.9, 1.06, random()),
        release: random(),
        depth: near,
      })
    }
  }

  const ceiling: Array<{ x: number; y: number; size: number }> = []
  if (rarity === 'constellation') {
    const count = 16 + Math.floor(random() * 10)
    for (let i = 0; i < count; i += 1) {
      ceiling.push({
        x: (random() - 0.5) * spacing * (bays + 1) * 2.1,
        y: springY * 0.92 + random() * (vaultY - springY * 0.9),
        size: 0.006 + random() * 0.012,
      })
    }
    ceiling.sort((a, b) => a.x - b.x)
  }

  return {
    strands,
    arches,
    ribs,
    rarity,
    vaultY,
    tone,
    ceiling,
    roseY: springY + loft * 0.66,
    roseR: spacing * lerp(0.62, 0.86, random()),
    rosePetals: 8 + Math.floor(random() * 5) * 2,
  }
}

/* ── Vapour ─────────────────────────────────────────────────── */

interface Mote {
  x: number
  y: number
  vx: number
  vy: number
  age: number
  life: number
  size: number
  tone: number
  /** Its own phase, so a drifting field never resolves into one drift. */
  swirl: number
}

/* ── The scene ──────────────────────────────────────────────── */

export class InkCathedral implements LivingScene {
  private readonly seed: number
  private readonly world: CathedralWorld

  private cathedral: Cathedral
  private builtFor = -1

  private vapour: Mote[] = []
  private ambient: Mote[] = []

  /** Seconds of this scene's own life. Only advances when motion is wanted. */
  private clock = 0
  /**
   * How much of the architecture has ever been revealed this breath.
   *
   * *Not* the breath. This is the one number that separates an exhale from a
   * rewind, and getting it wrong is the mistake this form is easiest to make:
   * tie the reveal to `--e` and an out-breath un-draws the arches from the
   * keystone back down to the springing, which the eye reads instantly and
   * unmistakably as a video being scrubbed backwards.
   *
   * So the reveal only ever rises. It climbs with the in-breath, holds at the
   * top, and stays there through the whole of the exhale — during which the
   * building does not retract by so much as a pixel. It comes apart instead,
   * which is `dissolve`'s job. The next in-breath starts it from nothing again.
   */
  private reveal = 0
  /** How far the structure has come apart, 0 → 1. Lags the breath deliberately. */
  private dissolve = 0
  /** Smoothed emission budget, so a phase turn does not fire a puff. */
  private release = 0

  private pearlSprite: HTMLCanvasElement | null = null
  private goldSprite: HTMLCanvasElement | null = null
  private groundCache: { key: string; gradient: CanvasGradient } | null = null

  /** The one frame both `update` and `draw` are working from. */
  private readonly frame = {
    e: 0,
    p: 0,
    m: 0,
    phase: 'inhale' as LiveBreath['phase'],
    calm: false,
  }

  constructor(seed: number) {
    this.seed = seed
    this.world = worldFor(seed)
    this.cathedral = buildCathedral(seed, 0, this.world)
    this.builtFor = 0
  }

  update(dt: number, breath: LiveBreath, view: SceneView): void {
    const step = Math.min(dt, 0.05)
    const calm = breath.calm

    /*
     * The frame, taken once.
     *
     * `draw` deliberately never reads the clock. A renderer that asks what
     * time it is can disagree with the value `update` read a microsecond
     * earlier, and one frame drawn half in the past is exactly the kind of
     * flicker nobody can ever reproduce. Copied rather than held by reference
     * because the hook mutates its frame in place.
     */
    this.frame.e = breath.e
    this.frame.p = breath.p
    this.frame.m = breath.m
    this.frame.phase = breath.phase
    this.frame.calm = calm

    // Self-running motion stops at the turn of the breath and stops altogether
    // when someone has asked for less of it. The breath itself never stops.
    const sway = calm ? 0 : 0.3 + breath.m * 0.7
    this.clock += step * sway

    /*
     * A new breath rebuilds the architecture — once, at the moment the count
     * turns over, and never during the breath it is drawing. Rebuilding
     * mid-inhale would change the building under the eye, which is the exact
     * failure the whole seeded design exists to avoid.
     */
    if (breath.breaths !== this.builtFor) {
      this.builtFor = breath.breaths
      this.cathedral = buildCathedral(this.seed, breath.breaths, this.world)
    }

    this.reveal = revealFor(breath.phase, breath.e, this.reveal)

    /* See `dissolveFor`. */
    const target = dissolveFor(breath.phase, breath.p)
    // Rising fast, falling slowly: coming apart is quick, and settling back to
    // nothing between breaths is not.
    const rate = target > this.dissolve ? 4.4 : 2.2
    this.dissolve += (target - this.dissolve) * (1 - Math.exp(-rate * step))

    const budget = breath.phase === 'exhale' ? breath.m * (1 - this.dissolve * 0.35) : 0
    this.release += (budget - this.release) * (1 - Math.exp(-6 * step))

    this.stepVapour(step, breath, view, calm)
    this.stepAmbient(step, view, calm)
  }

  /* ── Motes ──────────────────────────────────────────────── */

  private capacity(view: SceneView): number {
    if (!view.rich) return view.field ? 70 : 40
    return view.field ? 220 : 130
  }

  private stepVapour(dt: number, breath: LiveBreath, view: SceneView, calm: boolean): void {
    const cap = this.capacity(view)

    if (!calm && this.release > 0.01 && this.vapour.length < cap) {
      /*
       * Vapour is born where the ink was, not from a nozzle. A strand that has
       * released is picked, a point along it is picked, and the puff starts
       * exactly there — so what you see leaving is the building.
       */
      const wanted = Math.min(
        Math.ceil(this.release * (view.field ? 5.5 : 3.4)),
        cap - this.vapour.length,
      )
      for (let i = 0; i < wanted; i += 1) {
        const strand =
          this.cathedral.strands[
            Math.floor(Math.random() * this.cathedral.strands.length)
          ]
        if (!strand || strand.release > this.dissolve) continue
        const node = strand.points[Math.floor(Math.random() * strand.points.length)]
        this.vapour.push({
          x: node.x + (Math.random() - 0.5) * 0.05,
          y: node.y + (Math.random() - 0.5) * 0.05,
          vx: (Math.random() - 0.5) * 0.09,
          vy: 0.04 + Math.random() * 0.13,
          age: 0,
          life: 2.6 + Math.random() * 3.4,
          size: 0.02 + Math.random() * 0.055,
          tone: this.cathedral.tone + (Math.random() - 0.5) * 0.3,
          swirl: Math.random() * Math.PI * 2,
        })
      }
    }

    if (this.cathedral.rarity === 'lightfall' && !calm && breath.e > 0.7) {
      // A fall of light down the axis: the one thing in this room that moves
      // downward, and the reason it is worth waiting for.
      if (this.vapour.length < cap && Math.random() < 0.4) {
        this.vapour.push({
          x: (Math.random() - 0.5) * 0.24,
          y: this.cathedral.vaultY * (0.9 + Math.random() * 0.16),
          vx: (Math.random() - 0.5) * 0.02,
          vy: -0.26 - Math.random() * 0.2,
          age: 0,
          life: 2.4 + Math.random() * 1.6,
          size: 0.012 + Math.random() * 0.02,
          tone: 1,
          swirl: Math.random() * Math.PI * 2,
        })
      }
    }

    for (let i = this.vapour.length - 1; i >= 0; i -= 1) {
      const mote = this.vapour[i]
      mote.age += dt
      if (mote.age >= mote.life) {
        this.vapour.splice(i, 1)
        continue
      }
      if (calm) continue
      // Curl: a slow lateral wander that is different for every puff, which is
      // what turns a cloud of dots into something that looks like it is in air.
      const curl = Math.sin(this.clock * 0.6 + mote.swirl) * 0.05
      mote.x += (mote.vx + curl) * dt
      mote.y += mote.vy * dt
      mote.vy += (0.02 - mote.vy) * dt * 0.4
      mote.size += dt * 0.012
    }
  }

  private stepAmbient(dt: number, view: SceneView, calm: boolean): void {
    const want = view.rich ? (view.field ? 44 : 24) : view.field ? 20 : 12
    while (this.ambient.length < want) {
      this.ambient.push({
        x: (Math.random() - 0.5) * 4.4,
        y: Math.random() * 2.4,
        vx: (Math.random() - 0.5) * 0.02,
        vy: 0.008 + Math.random() * 0.022,
        age: Math.random() * 20,
        life: 20 + Math.random() * 22,
        size: 0.006 + Math.random() * 0.011,
        tone: Math.random(),
        swirl: Math.random() * Math.PI * 2,
      })
    }
    while (this.ambient.length > want) this.ambient.pop()

    for (const mote of this.ambient) {
      mote.age += dt
      if (mote.age >= mote.life) {
        mote.age = 0
        mote.x = (Math.random() - 0.5) * 4.4
        mote.y = Math.random() * 0.4
      }
      if (calm) continue
      mote.x += (mote.vx + Math.sin(this.clock * 0.3 + mote.swirl) * 0.012) * dt
      mote.y += mote.vy * dt
    }
  }

  /* ── Drawing ────────────────────────────────────────────── */

  draw(ctx: CanvasRenderingContext2D, view: SceneView): void {
    if (view.mix <= 0.003) return

    /*
     * The scale is derived from the building, not assumed about it.
     *
     * `vaultY` varies with the seed and with the breath, so a fixed unit put
     * the ribs, the keystones and the rose window off the top of the orb on
     * some sessions — which is to say the entire reward for finishing the
     * in-breath happened where nobody could see it. Dividing the room's height
     * by the building's own height lands the vault just inside the frame for
     * every seed there is.
     *
     * Horizontally nothing is fitted: the outer bays run off both sides, and
     * that is the point. A cathedral you can see all of is a model of one.
     */
    const rise = view.field ? view.height * 0.9 : view.radius * 1.62
    const unit = rise / this.cathedral.vaultY
    const floorY = view.field ? view.height * 0.96 : view.cy + view.radius * 0.92
    const originX = view.cx + view.driftX
    const toX = (x: number) => originX + x * unit
    const toY = (y: number) => floorY - y * unit + view.driftY

    if (!this.pearlSprite) this.pearlSprite = softSprite(PALETTE.pearl)
    if (!this.goldSprite) this.goldSprite = softSprite(PALETTE.gold)

    /*
     * Two different questions, and they only agree on the way up.
     *
     * `reveal` is how much of the building has been drawn — it rises with the
     * in-breath and then holds, so nothing ever un-draws. `lustre` is how
     * bright it all is, and that *is* the breath, so the exhale softens the
     * light while the dissolve takes the structure apart. Together they are the
     * difference between a release and a rewind.
     */
    const reveal = this.reveal
    const lustre = this.frame.e
    const structure = clamp(1 - this.dissolve * 1.05)

    ctx.save()
    this.drawGround(ctx, view, unit, floorY, originX, this.frame.e)

    ctx.globalCompositeOperation = 'lighter'

    const ink = mixRgb(PALETTE.pearl, PALETTE.gold, this.cathedral.tone)
    const warm = mixRgb(ink, PALETTE.rose, 0.18)

    /*
     * ── Exposure, and the width of a line ──
     *
     * Two numbers, and they pull opposite ways.
     *
     * The room is drawn *dimmer* than the orb. The orb is near-black behind a
     * rim and can carry bright ink; the room is behind a page with words on it,
     * and light that reads beautifully in a 190-pixel portal is a wall of glare
     * at 1280. Under-exposing the room is what lets the same world be both.
     *
     * And the ink does not get thicker just because the world got larger. A
     * tendril is a tendril: scaling its width with the scene would turn the
     * room's piers into tree trunks — which is exactly what it did, the first
     * time this was built. So widths are measured against a unit of their own,
     * and what growing the world actually buys you is *more cathedral*, seen
     * finer and further off, which is the whole meaning of enormous.
     */
    const gain = view.field ? 1.05 : 1
    const pen = view.field ? unit * 0.5 : unit

    this.drawAmbient(ctx, view, toX, toY, unit, gain)
    this.drawStrands(ctx, view, toX, toY, pen, reveal, lustre, structure, ink, gain)
    this.drawArches(ctx, view, toX, toY, unit, pen, reveal, lustre, structure, ink, warm, gain)
    this.drawRibs(ctx, view, toX, toY, unit, pen, reveal, lustre, structure, warm, gain)
    this.drawRare(ctx, view, toX, toY, unit, reveal, structure, ink)
    this.drawVapour(ctx, view, toX, toY, unit, gain)

    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
    ctx.restore()
  }

  private drawGround(
    ctx: CanvasRenderingContext2D,
    view: SceneView,
    unit: number,
    floorY: number,
    originX: number,
    grown: number,
  ): void {
    /*
     * The dark this is all drawn on — in the orb only.
     *
     * The portal is genuinely near-black, and that is what lets pearl ink at
     * five percent opacity read as light. Across the viewport the same dark is
     * a static CSS gradient behind this canvas (see `.living-field__ground`),
     * because it never changes and a full-viewport fill per frame for a picture
     * that never changes is the single most expensive thing this scene could do.
     */
    if (!view.field) {
      const reach = view.radius * 1.02
      const key = `${view.cx.toFixed(0)}:${view.cy.toFixed(0)}:${reach.toFixed(0)}:${view.dark}`
      if (!this.groundCache || this.groundCache.key !== key) {
        const gradient = ctx.createRadialGradient(
          view.cx,
          view.cy,
          0,
          view.cx,
          view.cy,
          reach,
        )
        gradient.addColorStop(0, rgba(PALETTE.night, 0.86))
        gradient.addColorStop(0.55, rgba(PALETTE.night, 0.96))
        gradient.addColorStop(1, rgba(PALETTE.night, 1))
        this.groundCache = { key, gradient }
      }

      ctx.globalAlpha = (view.dark ? 0.96 : 0.9) * view.mix
      ctx.fillStyle = this.groundCache.gradient
      ctx.beginPath()
      ctx.arc(view.cx, view.cy, view.radius, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
    }

    /*
     * A pool of light on the floor, which is where the ink is rising from.
     * Filled to the gradient's own box rather than to the canvas: the light
     * reaches nothing outside it, and painting the rest of the screen to prove
     * that is a viewport of fill spent on transparent pixels.
     */
    ctx.globalCompositeOperation = 'lighter'
    const span = unit * 1.3
    const pool = ctx.createRadialGradient(originX, floorY, 0, originX, floorY, span)
    const tint = mixRgb(PALETTE.gold, PALETTE.pearl, 0.4)
    pool.addColorStop(0, rgba(tint, 0.16 * view.mix * (0.3 + grown * 0.7)))
    pool.addColorStop(1, rgba(tint, 0))
    ctx.fillStyle = pool
    ctx.fillRect(originX - span, floorY - span, span * 2, span * 2)
    ctx.globalCompositeOperation = 'source-over'
  }

  private drawAmbient(
    ctx: CanvasRenderingContext2D,
    view: SceneView,
    toX: (x: number) => number,
    toY: (y: number) => number,
    unit: number,
    gain: number,
  ): void {
    const sprite = this.pearlSprite
    if (!sprite) return
    for (const mote of this.ambient) {
      const fade = Math.sin((mote.age / mote.life) * Math.PI)
      stamp(
        ctx,
        sprite,
        toX(mote.x),
        toY(mote.y),
        mote.size * unit * 2.2,
        fade * 0.3 * view.mix * gain,
      )
    }
  }

  /**
   * Ink.
   *
   * Three strokes per strand and never a `shadowBlur`: a wide, almost invisible
   * pass for the air around the line, a medium one for its body, and a thin
   * bright one for the line itself. Canvas shadows are the obvious way to get a
   * glow and they are also the reliable way to turn sixty frames a second into
   * twelve; three additive strokes cost the compositor nothing it was not
   * already doing.
   */
  private drawStrands(
    ctx: CanvasRenderingContext2D,
    view: SceneView,
    toX: (x: number) => number,
    toY: (y: number) => number,
    pen: number,
    reveal: number,
    lustre: number,
    structure: number,
    ink: Rgb,
    gain: number,
  ): void {
    const front = clamp(reveal / STRAND_TOP)
    if (front <= 0.002 || structure <= 0.002) return

    const shimmer = smoothstep(0.86, 1, lustre)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    /*
     * The nave runs off both edges of the screen, which is what makes it read
     * as enormous — and means a good half of it is never seen. One compare per
     * strand against the viewport buys that scale back: the bays beyond the
     * edge are built, because the geometry has to be the same in both canvases,
     * and then simply not drawn.
     */
    const margin = pen * 0.6
    const left = -margin
    const right = view.width + margin

    for (const strand of this.cathedral.strands) {
      if (toX(strand.maxX) < left || toX(strand.minX) > right) continue
      // Released strands are gone from the structure — they are the vapour now.
      const since = this.dissolve - strand.release
      const held = clamp(1 - since * 3.2)
      if (held <= 0.01) continue

      /*
       * And the moment of letting go is *brighter* than holding on.
       *
       * A strand flares as it releases and then thins away. It is the one
       * gesture that stops an exhale reading as a dimmer switch: light leaving
       * is still light, and a breath out that gives you something to watch is
       * the difference between releasing and merely stopping.
       */
      const flare = since > 0 ? Math.max(0, 1 - Math.abs(since - 0.06) / 0.16) : 0

      const points = strand.points
      if (points[0].t > front) continue

      ctx.beginPath()
      ctx.moveTo(toX(points[0].x), toY(points[0].y))
      let last = points[0]
      let width = points[0].w

      for (let i = 1; i < points.length; i += 1) {
        const node = points[i]
        if (node.t <= front) {
          ctx.lineTo(toX(node.x), toY(node.y))
          last = node
          width = node.w
        } else {
          // The growing tip: a partial segment, so the front advances smoothly
          // rather than a whole joint at a time.
          const span = node.t - last.t
          const f = span > 1e-5 ? clamp((front - last.t) / span) : 0
          if (f > 0.02) {
            ctx.lineTo(
              toX(lerp(last.x, node.x, f)),
              toY(lerp(last.y, node.y, f)),
            )
            width = lerp(last.w, node.w, f)
          }
          break
        }
      }

      const lit =
        strand.bright *
        (0.5 + strand.depth * 0.5) *
        held *
        (structure + flare * 1.4) *
        view.mix *
        gain
      const glint = 1 + shimmer * 0.5 * Math.sin(this.clock * 1.6 + strand.release * 9)
      const w = Math.max(0.7, width * pen)

      /*
       * The widest pass is the air around the line, and it is also by a long
       * way the most expensive thing in this scene: a five-times-width stroke
       * over every strand in the nave is more fill than everything else put
       * together. It is worth it in the orb, where the ink is the subject and
       * there are a dozen strands. Across a viewport of sixty it is not — the
       * halo is spread too thin to see, and it costs a third of the frame. So
       * the room buys its bloom back with a wider middle pass instead, which is
       * a quarter of the pixels for very nearly the same picture.
       */
      if (view.rich && !view.field) {
        ctx.strokeStyle = rgba(ink, 0.05 * lit)
        ctx.lineWidth = w * 5
        ctx.stroke()
      }
      ctx.strokeStyle = rgba(ink, view.field ? 0.11 * lit : 0.15 * lit)
      ctx.lineWidth = w * (view.field ? 3.6 : 2.8)
      ctx.stroke()
      ctx.strokeStyle = rgba(mixRgb(ink, PALETTE.pearl, 0.28), 0.6 * lit * glint)
      ctx.lineWidth = w
      ctx.stroke()
    }
  }

  private drawArches(
    ctx: CanvasRenderingContext2D,
    view: SceneView,
    toX: (x: number) => number,
    toY: (y: number) => number,
    unit: number,
    pen: number,
    reveal: number,
    lustre: number,
    structure: number,
    ink: Rgb,
    warm: Rgb,
    gain: number,
  ): void {
    const front = smoothstep(0.44, 0.93, reveal)
    if (front <= 0.002 || structure <= 0.002) return

    const shimmer = smoothstep(0.84, 1, lustre)
    const sprite = this.goldSprite

    const margin = unit * 1.1
    for (const arch of this.cathedral.arches) {
      const held = clamp(1 - (this.dissolve - arch.release) * 2.6)
      if (held <= 0.01) continue
      const centre = toX(arch.apexX)
      if (centre < -margin || centre > view.width + margin) continue

      const lit = (0.56 + arch.depth * 0.44) * held * structure * view.mix * gain

      /*
       * Both halves at once, meeting at the keystone. `t` in an arch's points
       * is distance from the nearer spring, so one test draws both sides and
       * the two of them close together — which is the moment the eye reads as
       * the structure *connecting*, and the reason it lands at 93% of an
       * in-breath rather than at 60%.
       */
      let drawing = false
      ctx.beginPath()
      for (let i = 0; i < arch.points.length; i += 1) {
        const node = arch.points[i]
        if (node.t > front) {
          drawing = false
          continue
        }
        const px = toX(node.x)
        const py = toY(node.y)
        if (!drawing) {
          ctx.moveTo(px, py)
          drawing = true
        } else {
          ctx.lineTo(px, py)
        }
      }

      const w = Math.max(0.8, 0.03 * pen)
      ctx.lineCap = 'round'
      if (view.rich) {
        ctx.strokeStyle = rgba(ink, 0.055 * lit)
        ctx.lineWidth = w * 5.5
        ctx.stroke()
      }
      ctx.strokeStyle = rgba(warm, 0.17 * lit)
      ctx.lineWidth = w * 2.8
      ctx.stroke()
      ctx.strokeStyle = rgba(mixRgb(ink, PALETTE.pearl, 0.34), 0.66 * lit)
      ctx.lineWidth = w
      ctx.stroke()

      // The keystone lights when the arch closes, and shimmers while it holds.
      if (front > 0.97 && sprite) {
        const pulse = 0.55 + 0.45 * Math.sin(this.clock * 1.1 + arch.apexX * 4)
        stamp(
          ctx,
          sprite,
          toX(arch.apexX),
          toY(arch.apexY),
          unit * (0.09 + shimmer * 0.07),
          lit * (0.3 + shimmer * 0.42 * pulse),
        )
      }
    }
  }

  /**
   * The vault.
   *
   * Nothing here exists below 78% of an in-breath, and that is the whole
   * design: the last fifth of a guided inhale is where the ceiling closes. It
   * is the most spectacular thing in the room and it is reachable *only* by
   * finishing the breath you were asked for — not by taking a bigger one, since
   * the curve tops out at the cadence and there is nothing above it to chase.
   */
  private drawRibs(
    ctx: CanvasRenderingContext2D,
    view: SceneView,
    toX: (x: number) => number,
    toY: (y: number) => number,
    unit: number,
    pen: number,
    reveal: number,
    lustre: number,
    structure: number,
    warm: Rgb,
    gain: number,
  ): void {
    const front = smootherstep(0.78, 0.995, reveal)
    if (front <= 0.004 || structure <= 0.004) return

    ctx.lineCap = 'round'
    for (const rib of this.cathedral.ribs) {
      const held = clamp(1 - (this.dissolve - rib.release) * 4)
      if (held <= 0.01) continue
      const x1 = lerp(rib.x0, rib.x1, front)
      const y1 = lerp(rib.y0, rib.y1, front)
      const lit = (0.45 + rib.depth * 0.55) * held * structure * front * view.mix * gain

      ctx.beginPath()
      ctx.moveTo(toX(rib.x0), toY(rib.y0))
      ctx.lineTo(toX(x1), toY(y1))
      ctx.strokeStyle = rgba(warm, 0.1 * lit)
      ctx.lineWidth = Math.max(0.6, 0.016 * pen) * 3.4
      ctx.stroke()
      ctx.strokeStyle = rgba(mixRgb(warm, PALETTE.pearl, 0.65), 0.45 * lit)
      ctx.lineWidth = Math.max(0.6, 0.008 * pen)
      ctx.stroke()
    }

    /*
     * And the light the vault is holding.
     *
     * Two soft shafts coming down from where the ribs meet, at the very top of
     * the breath. It is the last thing to arrive and the only *volume* in a
     * room otherwise made entirely of lines — which is why it is what turns
     * the final fifth of an inhale from "the drawing finished" into a place
     * with air in it.
     */
    if (!view.rich) return
    const light = smootherstep(0.84, 1, lustre) * structure * view.mix
    if (light <= 0.01) return

    const top = toY(this.cathedral.vaultY)
    const floor = toY(0)
    for (let i = -1; i <= 1; i += 2) {
      const sway = Math.sin(this.clock * 0.24 + i) * 0.1
      const x = toX(i * 0.34 + sway)
      const beam = ctx.createLinearGradient(x, top, x, floor)
      beam.addColorStop(0, rgba(mixRgb(warm, PALETTE.pearl, 0.5), 0.1 * light * gain))
      beam.addColorStop(0.55, rgba(warm, 0.045 * light * gain))
      beam.addColorStop(1, rgba(warm, 0))
      ctx.fillStyle = beam
      ctx.beginPath()
      ctx.moveTo(x - unit * 0.06, top)
      ctx.lineTo(x + unit * 0.06, top)
      ctx.lineTo(x + unit * 0.42, floor)
      ctx.lineTo(x - unit * 0.42, floor)
      ctx.closePath()
      ctx.fill()
    }
  }

  private drawRare(
    ctx: CanvasRenderingContext2D,
    view: SceneView,
    toX: (x: number) => number,
    toY: (y: number) => number,
    unit: number,
    reveal: number,
    structure: number,
    ink: Rgb,
  ): void {
    const { rarity } = this.cathedral
    if (rarity === 'none' || rarity === 'twin' || rarity === 'lightfall') return

    const open = smootherstep(0.76, 1, reveal) * structure * view.mix
    if (open <= 0.004) return

    if (rarity === 'rose') {
      /*
       * A rose window: one breath in twenty-two, and the only circle in a room
       * made entirely of arches. It opens from its own centre outward over the
       * last quarter of the inhale.
       */
      const cxp = toX(0)
      const cyp = toY(this.cathedral.roseY)
      const r = this.cathedral.roseR * unit * lerp(0.5, 1, open)
      const petals = this.cathedral.rosePetals
      const glow = mixRgb(ink, PALETTE.rose, 0.3)

      ctx.lineWidth = Math.max(0.5, unit * 0.006)
      for (let i = 0; i < petals; i += 1) {
        const a = (i / petals) * Math.PI * 2 + this.clock * 0.02
        ctx.beginPath()
        ctx.moveTo(cxp, cyp)
        ctx.lineTo(cxp + Math.cos(a) * r, cyp + Math.sin(a) * r)
        ctx.strokeStyle = rgba(glow, 0.16 * open)
        ctx.stroke()

        ctx.beginPath()
        ctx.arc(
          cxp + Math.cos(a) * r * 0.62,
          cyp + Math.sin(a) * r * 0.62,
          r * 0.3,
          0,
          Math.PI * 2,
        )
        ctx.strokeStyle = rgba(glow, 0.12 * open)
        ctx.stroke()
      }
      for (const ring of [0.34, 0.68, 1]) {
        ctx.beginPath()
        ctx.arc(cxp, cyp, r * ring, 0, Math.PI * 2)
        ctx.strokeStyle = rgba(mixRgb(glow, PALETTE.pearl, 0.5), 0.2 * open)
        ctx.stroke()
      }
      if (this.goldSprite) {
        stamp(ctx, this.goldSprite, cxp, cyp, r * 0.85, 0.16 * open)
      }
      return
    }

    // A constellation ceiling: points across the vault, joined left to right,
    // so the vault reads as sky rather than as stone.
    const points = this.cathedral.ceiling
    const sprite = this.pearlSprite
    ctx.beginPath()
    for (let i = 0; i < points.length; i += 1) {
      const px = toX(points[i].x)
      const py = toY(points[i].y)
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.strokeStyle = rgba(PALETTE.twilight, 0.1 * open)
    ctx.lineWidth = Math.max(0.5, unit * 0.0025)
    ctx.stroke()

    if (!sprite) return
    for (let i = 0; i < points.length; i += 1) {
      const twinkle = 0.6 + 0.4 * Math.sin(this.clock * 1.4 + i * 2.3)
      stamp(
        ctx,
        sprite,
        toX(points[i].x),
        toY(points[i].y),
        points[i].size * unit * 3,
        0.42 * open * twinkle,
      )
    }
  }

  private drawVapour(
    ctx: CanvasRenderingContext2D,
    view: SceneView,
    toX: (x: number) => number,
    toY: (y: number) => number,
    unit: number,
    gain: number,
  ): void {
    const pearl = this.pearlSprite
    const gold = this.goldSprite
    if (!pearl || !gold) return

    for (const mote of this.vapour) {
      const life = mote.age / mote.life
      // In fast, out slow: a puff appears as the ink lets go and then takes its
      // time about leaving, which is the shape of something evaporating.
      const fade = Math.min(1, life * 6) * (1 - life) ** 1.6
      const radius = mote.size * unit * (1 + life * 2.4)
      stamp(
        ctx,
        mote.tone > 0.5 ? gold : pearl,
        toX(mote.x),
        toY(mote.y),
        radius,
        fade * 0.52 * view.mix * gain,
      )
    }
  }
}

/**
 * The still pose the picker's thumbnail and the resting orb hold.
 *
 * Two thirds of the way up an in-breath: far enough that the arches have
 * closed and the shape is legible as architecture, short of the last fifth so
 * the vault is still something you have to breathe for.
 */
export function cathedralPose(seconds: number): LiveBreath {
  return {
    e: 0.68,
    p: 0.68,
    m: 0.64,
    mid: 0.6,
    far: 0.5,
    phase: 'inhale',
    breaths: 0,
    seconds,
    active: true,
    calm: false,
  }
}
