/**
 * Moonpool.
 *
 * You are under an impossibly calm dark ocean, looking up. There is an opening
 * in the surface above you — Snell's window, the circle of sky a diver sees
 * from below — and through it: moonlight, stars, and the shape of the water
 * moving between you and them.
 *
 * Breathe in and the opening widens. More stars come into it, the moonlight
 * spreads, the caustics on the underside of the surface stretch away from the
 * rim, the haze thins, and the dark at the edges of your vision draws back.
 * Breathe out and the ocean closes over you again: the stars nearest the rim
 * go first, the light softens rather than switches off, and what is left is
 * deep water with a few silver motes suspended in it.
 *
 * ── Why the water does not follow the breath ──
 *
 * It nearly does, and the gap is the whole thing.
 *
 * The opening chases the breath through a lag (see `approach`), so it is still
 * widening a beat after you have stopped filling and still open a beat after
 * you have started to empty. On top of that the rim is never a circle: its
 * radius is a sum of harmonics at ratios that do not resolve, running on a
 * clock of the scene's own. Water that tracked `--e` exactly would read as a
 * circle being scaled — which is what it would in fact be. Water that arrives
 * slightly late, in a shape that is never quite the same, reads as a mass with
 * weight above you.
 *
 * ── The sky is a place ──
 *
 * The stars are placed once per session and never again, so it is the same sky
 * every breath: the same moon in the same quarter of it, the same scatter. What
 * each breath changes is how much of it you are being shown. That is the
 * difference between a night sky and a particle effect.
 */

import { hashUnit, mulberry32 } from '../random'
import type { LiveBreath } from '../useBreathing'
import {
  approach,
  clamp,
  lerp,
  mixRgb,
  PALETTE,
  rgba,
  smoothstep,
  smootherstep,
  softSprite,
  stamp,
  wander,
  type LivingScene,
  type SceneView,
} from './types'

/* ── The sky this session is under ──────────────────────────── */

interface Star {
  /** Radians around the opening. */
  angle: number
  /** Distance from the middle, in units of the widest the opening ever gets. */
  dist: number
  size: number
  /** 0 → 1. Dim stars only arrive near the top of an in-breath. */
  magnitude: number
  twinkle: number
  phase: number
}

export interface MoonpoolWorld {
  stars: Star[]
  /** Where the moon hangs, in the same sky coordinates as the stars. */
  moonAngle: number
  moonDist: number
  moonSize: number
  /** How much the surface disturbs the view. */
  chop: number
  /** 0 is a cold blue ocean, 1 a warmer silver one. */
  tint: number
  /** How much suspended matter is in the water. */
  haze: number
  /** How wide the window opens at the top of a full breath. */
  reach: number
}

const STAR_COUNT = 150

export function worldFor(seed: number): MoonpoolWorld {
  const random = mulberry32(seed ^ 0x5eed)
  const stars: Star[] = []

  for (let i = 0; i < STAR_COUNT; i += 1) {
    /*
     * Stratified in angle and pushed outward by a square root, so the sky is
     * evenly dense by *area* rather than crowded in the middle. A field drawn
     * with a flat radius looks like a target.
     */
    const sector = (Math.PI * 2) / STAR_COUNT
    stars.push({
      angle: i * sector + random() * sector * 0.9,
      dist: Math.sqrt(random()) * 1.02,
      size: 0.5 + random() ** 2 * 2.1,
      // Most of the sky is faint. The bright few are what make the rest read
      // as depth rather than as noise.
      magnitude: random() ** 1.7,
      twinkle: 5 + random() * 11,
      phase: random() * Math.PI * 2,
    })
  }

  return {
    stars,
    moonAngle: hashUnit(seed, 21) * Math.PI * 2,
    moonDist: 0.3 + hashUnit(seed, 22) * 0.34,
    moonSize: 0.1 + hashUnit(seed, 23) * 0.07,
    chop: 0.5 + hashUnit(seed, 24) * 0.6,
    tint: hashUnit(seed, 25),
    haze: 0.4 + hashUnit(seed, 26) * 0.5,
    /*
     * How wide the window opens, as a fraction of the scene's unit — and
     * deliberately well under one. A Snell's window that fills the view is not
     * a window, it is a light box: the ocean around it is what you are in, and
     * losing it loses the entire feeling of being underneath something.
     */
    reach: 0.58 + hashUnit(seed, 27) * 0.16,
  }
}

/* ── The rare moments ───────────────────────────────────────── */

/**
 * Extremely rare, and meant to be.
 *
 * About one breath in twelve brings one of these, which across a long session
 * is a few — enough that someone who stays finds something, and few enough
 * that nobody watching for two minutes learns to expect it. A rarity that
 * arrives on schedule is a feature; one that arrives when it arrives is
 * weather, and weather is what this room is for.
 */
export type Rarity = 'none' | 'shooting' | 'glass' | 'constellation' | 'silver' | 'moondrift'

export function rarityFor(seed: number, breath: number): Rarity {
  const roll = hashUnit(seed, breath, 0x7a)
  if (roll < 0.022) return 'shooting'
  if (roll < 0.042) return 'glass'
  if (roll < 0.062) return 'constellation'
  if (roll < 0.08) return 'silver'
  if (roll < 0.095) return 'moondrift'
  return 'none'
}

interface Drop {
  x: number
  y: number
  vx: number
  vy: number
  age: number
  life: number
  size: number
  silver: boolean
  phase: number
}

/* ── The scene ──────────────────────────────────────────────── */

export class Moonpool implements LivingScene {
  private readonly seed: number
  private readonly world: MoonpoolWorld

  private rarity: Rarity = 'none'
  private builtFor = -1
  /** This breath's own nudge to clarity, chop and star density. */
  private variation = { clarity: 1, chop: 1, density: 1, drift: 0 }
  /** Which stars this breath's constellation joins, when it has one. */
  private figure: number[] = []

  private clock = 0
  /** The opening, chasing the breath rather than obeying it. */
  private open = 0
  /** Independent of the opening: how settled the water is. */
  private calmness = 0
  /** A shooting star, when there is one: 0 → 1 across the sky. */
  private streak = -1

  private motes: Drop[] = []
  private silverSprite: HTMLCanvasElement | null = null
  private moonSprite: HTMLCanvasElement | null = null
  private skyCache: { key: string; gradient: CanvasGradient } | null = null

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
  }

  update(dt: number, breath: LiveBreath, view: SceneView): void {
    const step = Math.min(dt, 0.05)
    const calm = breath.calm

    this.frame.e = breath.e
    this.frame.p = breath.p
    this.frame.m = breath.m
    this.frame.phase = breath.phase
    this.frame.calm = calm

    if (breath.breaths !== this.builtFor) {
      this.builtFor = breath.breaths
      this.rarity = rarityFor(this.seed, breath.breaths)
      this.variation = {
        clarity: lerp(0.82, 1.2, hashUnit(this.seed, breath.breaths, 1)),
        chop: lerp(0.6, 1.3, hashUnit(this.seed, breath.breaths, 2)),
        density: lerp(0.78, 1.15, hashUnit(this.seed, breath.breaths, 3)),
        drift: (hashUnit(this.seed, breath.breaths, 4) - 0.5) * 0.4,
      }
      this.figure =
        this.rarity === 'constellation' ? this.buildFigure(breath.breaths) : []
      this.streak = this.rarity === 'shooting' ? 0 : -1
    }

    /*
     * Two different lags, and they must not be the same number.
     *
     * The opening is quick enough to be unmistakably yours — you can feel that
     * it is answering — and slow enough to still be moving when you have
     * stopped. `calmness` is much slower again: it is how settled the water
     * *is*, which is a thing that takes several breaths to change and is the
     * reason the surface does not go glassy the instant you hold.
     */
    this.open = approach(this.open, breath.e, calm ? 6 : 2.35, step)
    this.calmness = approach(this.calmness, breath.m < 0.18 ? 1 : 0, 0.55, step)

    // The scene's own life fades toward the turn of a breath, so the top of an
    // inhale feels like time suspending rather than like one layer stopping.
    this.clock += step * (calm ? 0 : 0.34 + breath.m * 0.66)

    if (this.streak >= 0 && !calm && breath.e > 0.6) {
      this.streak += step * 0.85
      if (this.streak > 1.6) this.streak = -1
    }

    this.stepMotes(step, view, calm)
  }

  private buildFigure(breath: number): number[] {
    const random = mulberry32((this.seed ^ Math.imul(breath + 7, 0x27d4eb2f)) >>> 0)
    const start = Math.floor(random() * this.world.stars.length)
    // Walk to nearby bright stars: a figure that jumps across the sky is a
    // scribble, and a real constellation is always a short local walk.
    const chosen = [start]
    for (let i = 0; i < 5; i += 1) {
      const from = this.world.stars[chosen[chosen.length - 1]]
      let best = -1
      let bestScore = Infinity
      for (let j = 0; j < this.world.stars.length; j += 1) {
        if (chosen.includes(j)) continue
        const star = this.world.stars[j]
        const dx = Math.cos(star.angle) * star.dist - Math.cos(from.angle) * from.dist
        const dy = Math.sin(star.angle) * star.dist - Math.sin(from.angle) * from.dist
        const d = Math.hypot(dx, dy) + (1 - star.magnitude) * 0.4 + random() * 0.05
        if (d < bestScore) {
          bestScore = d
          best = j
        }
      }
      if (best < 0) break
      chosen.push(best)
    }
    return chosen
  }

  private stepMotes(dt: number, view: SceneView, calm: boolean): void {
    const silver = this.rarity === 'silver'
    const want = view.rich
      ? (view.field ? 130 : 64) * (silver ? 1.5 : 1)
      : (view.field ? 46 : 26) * (silver ? 1.4 : 1)

    while (this.motes.length < want) {
      this.motes.push({
        x: (Math.random() - 0.5) * 3.4,
        y: (Math.random() - 0.5) * 3.4,
        vx: (Math.random() - 0.5) * 0.016,
        vy: (Math.random() - 0.5) * 0.016,
        age: Math.random() * 18,
        life: 16 + Math.random() * 20,
        size: 0.003 + Math.random() ** 2 * 0.012,
        silver: silver || Math.random() < 0.22,
        phase: Math.random() * Math.PI * 2,
      })
    }
    while (this.motes.length > want) this.motes.pop()

    for (const mote of this.motes) {
      mote.age += dt
      if (mote.age >= mote.life) {
        mote.age = 0
        mote.x = (Math.random() - 0.5) * 3.4
        mote.y = (Math.random() - 0.5) * 3.4
      }
      if (calm) continue
      /*
       * Suspended matter, not a fountain: the drift is almost nothing, and
       * what movement there is comes from a slow circulation the whole body of
       * water is in rather than from each speck having somewhere to be.
       */
      mote.x += (mote.vx + Math.sin(this.clock * 0.22 + mote.phase) * 0.01) * dt
      mote.y += (mote.vy + Math.cos(this.clock * 0.17 + mote.phase * 1.3) * 0.01) * dt
    }
  }

  /* ── The shape of the opening ───────────────────────────── */

  /**
   * The rim, at one angle.
   *
   * Three harmonics at ratios chosen not to resolve — so the outline is
   * irregular the way a real surface is, and no viewer can find the loop. The
   * amplitude falls away as the water settles, which is what the rare glassy
   * breath is made of.
   */
  private rimAt(theta: number, radius: number): number {
    const chop =
      this.world.chop *
      this.variation.chop *
      (this.rarity === 'glass' ? 0.12 : 1) *
      (1 - this.calmness * 0.3)
    const t = this.clock
    /*
     * Weighted toward the higher harmonics on purpose. The low ones move the
     * whole outline and read as a blob being squashed; the high ones ripple it,
     * which is what a surface does. Getting that ratio wrong is the difference
     * between water and an amoeba.
     */
    const shape =
      Math.sin(theta * 2 + t * 0.24 + 2.7) * 0.04 +
      Math.sin(theta * 3 + t * 0.53) * 0.045 +
      Math.sin(theta * 5 - t * 0.37 + 1.4) * 0.05 +
      Math.sin(theta * 7 + t * 0.44 + 0.6) * 0.035 +
      Math.sin(theta * 11 + t * 0.61) * 0.022
    return radius * (1 + shape * chop)
  }

  private tracePath(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    radius: number,
    scale = 1,
  ): void {
    const steps = 64
    ctx.beginPath()
    for (let i = 0; i <= steps; i += 1) {
      const theta = (i / steps) * Math.PI * 2
      const r = this.rimAt(theta, radius) * scale
      const x = cx + Math.cos(theta) * r
      const y = cy + Math.sin(theta) * r
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()
  }

  /* ── Drawing ────────────────────────────────────────────── */

  draw(ctx: CanvasRenderingContext2D, view: SceneView): void {
    if (view.mix <= 0.003) return

    if (!this.silverSprite) this.silverSprite = softSprite(PALETTE.moon)
    if (!this.moonSprite) this.moonSprite = softSprite(PALETTE.pearl, 0.5)

    const unit = view.field
      ? Math.max(view.radius * 2.1, Math.min(view.width, view.height) * 0.46)
      : view.radius
    const cx = view.cx + view.driftX
    const cy = view.cy + view.driftY

    /*
     * The opening never closes to nothing and never fills the view. A window
     * that shuts completely is a black screen, and a window with no water left
     * around it is not a window. Both ends of the breath keep some ocean.
     */
    const span = this.world.reach * unit
    const radius = span * lerp(0.2, 1, smootherstep(0, 1, this.open))
    const openness = clamp(this.open)

    ctx.save()
    this.drawWater(ctx, view, cx, cy, openness)

    // ── Through the window ──
    ctx.save()
    this.tracePath(ctx, cx, cy, radius)
    ctx.clip()
    this.drawSky(ctx, view, cx, cy, radius, span, openness)
    ctx.restore()

    ctx.globalCompositeOperation = 'lighter'
    this.drawRim(ctx, view, cx, cy, radius, openness)
    this.drawCaustics(ctx, view, cx, cy, radius, unit, openness)
    this.drawShafts(ctx, view, cx, cy, radius, unit, openness)
    this.drawMotes(ctx, view, cx, cy, unit, openness)

    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
    this.drawHaze(ctx, view, cx, cy, unit, openness)
    ctx.restore()
  }

  /** The body of water: dark, and darker at the edges of vision. */
  private drawWater(
    ctx: CanvasRenderingContext2D,
    view: SceneView,
    cx: number,
    cy: number,
    openness: number,
  ): void {
    /*
     * The ocean, in the orb only. Across the viewport the same body of water —
     * and the haze you are looking through, which thickens as the breath
     * empties — are two static CSS gradients behind this canvas, driven by
     * `--mix` and `--e`. See `.living-field__ground`. A canvas is for the
     * things that actually change every frame, and a dark ocean is not one.
     */
    if (view.field) return

    const reach = view.radius * 1.02
    const key = `${cx.toFixed(0)}:${cy.toFixed(0)}:${reach.toFixed(0)}:${view.dark}`
    if (!this.skyCache || this.skyCache.key !== key) {
      const water = mixRgb(PALETTE.abyss, PALETTE.twilight, 0.06 + this.world.tint * 0.08)
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, reach)
      gradient.addColorStop(0, rgba(water, 0.8))
      gradient.addColorStop(0.4, rgba(water, 0.95))
      gradient.addColorStop(1, rgba(PALETTE.abyss, 1))
      this.skyCache = { key, gradient }
    }

    // The vignette opens as you fill: less of the dark at the edge of vision,
    // which is most of why a full breath feels like more room.
    ctx.globalAlpha = (view.dark ? 0.98 : 0.94) * view.mix * lerp(1, 0.78, openness)
    ctx.fillStyle = this.skyCache.gradient
    ctx.beginPath()
    ctx.arc(view.cx, view.cy, view.radius, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
  }

  /** Moonlight, stars, and whatever this breath is showing of them. */
  private drawSky(
    ctx: CanvasRenderingContext2D,
    view: SceneView,
    cx: number,
    cy: number,
    radius: number,
    span: number,
    openness: number,
  ): void {
    const moonlight = mixRgb(PALETTE.moon, PALETTE.gold, this.world.tint * 0.22)
    const moonX = cx + Math.cos(this.world.moonAngle) * this.world.moonDist * span
    const moonY = cy + Math.sin(this.world.moonAngle) * this.world.moonDist * span

    /*
     * Night first, light second — and in that order, because it is the order
     * that decides whether this reads as a sky or as a grey disc.
     *
     * The window is filled with something *darker and bluer* than the water
     * around it, and only then is the moon's light added on top of it. Doing it
     * the other way round — a pale wash lifted out of the dark — is what the
     * first version did, and it produced exactly the flat grey circle that a
     * night sky is not. A sky is black with light in it.
     */
    const night = mixRgb(PALETTE.abyss, PALETTE.twilight, 0.16)
    ctx.fillStyle = rgba(night, (view.dark ? 0.94 : 0.88) * view.mix)
    ctx.fillRect(cx - radius * 1.15, cy - radius * 1.15, radius * 2.3, radius * 2.3)

    ctx.globalCompositeOperation = 'lighter'

    // The moon's own quarter of the sky, and nowhere near all of it.
    const glow = ctx.createRadialGradient(moonX, moonY, 0, moonX, moonY, radius * 1.15)
    glow.addColorStop(0, rgba(moonlight, 0.3 * view.mix))
    glow.addColorStop(0.35, rgba(mixRgb(moonlight, PALETTE.twilight, 0.55), 0.1 * view.mix))
    glow.addColorStop(1, rgba(PALETTE.twilight, 0))
    ctx.fillStyle = glow
    ctx.fillRect(cx - radius * 1.15, cy - radius * 1.15, radius * 2.3, radius * 2.3)

    /*
     * Stars arrive by magnitude, not by fading in together. The bright ones are
     * there from early in the breath; the faint ones only cross the threshold
     * in the last third, so the sky keeps giving you something the longer you
     * fill — and the moment it gives you the most is the top of the inhale you
     * were asked for.
     */
    const threshold = lerp(0.72, -0.08, smootherstep(0.1, 1, openness)) / this.variation.density
    const sprite = this.silverSprite
    if (sprite) {
      for (const star of this.world.stars) {
        if (star.magnitude < threshold) continue
        const d = star.dist * span
        const x = cx + Math.cos(star.angle) * d
        const y = cy + Math.sin(star.angle) * d
        const arrival = smoothstep(threshold, threshold + 0.18, star.magnitude)
        const twinkle =
          0.66 + 0.34 * Math.sin(this.clock * (6.2 / star.twinkle) * 2 + star.phase)
        stamp(
          ctx,
          sprite,
          x,
          y,
          star.size * (view.field ? 2.6 : 1.9),
          arrival * (0.3 + star.magnitude * 0.7) * twinkle * view.mix,
        )
      }
    }

    if (this.figure.length > 1) {
      // A constellation: the lines are barely there. What you notice is that
      // some of the stars have started to mean something.
      ctx.beginPath()
      for (let i = 0; i < this.figure.length; i += 1) {
        const star = this.world.stars[this.figure[i]]
        const d = star.dist * span
        const x = cx + Math.cos(star.angle) * d
        const y = cy + Math.sin(star.angle) * d
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.strokeStyle = rgba(PALETTE.moon, 0.11 * smootherstep(0.5, 0.95, openness) * view.mix)
      ctx.lineWidth = 1
      ctx.stroke()
    }

    // The milky band, only near the top of a full breath.
    const band = smootherstep(0.72, 1, openness)
    if (band > 0.01 && view.rich) {
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(this.world.moonAngle * 0.6 + 1.1)
      const milky = ctx.createLinearGradient(0, -radius * 0.5, 0, radius * 0.5)
      milky.addColorStop(0, rgba(PALETTE.twilight, 0))
      milky.addColorStop(0.5, rgba(PALETTE.moon, 0.06 * band * view.mix))
      milky.addColorStop(1, rgba(PALETTE.twilight, 0))
      ctx.fillStyle = milky
      ctx.fillRect(-radius * 1.4, -radius * 0.5, radius * 2.8, radius)
      ctx.restore()
    }

    this.drawMoon(ctx, view, cx, cy, span, openness, moonlight)
    this.drawStreak(ctx, view, cx, cy, radius, span)

    /*
     * And the water between you and all of it. Two soft bands drifting across
     * the window — the underside of the surface, refracting what is above it.
     * This is the layer that stops the opening reading as a hole cut in a
     * photograph.
     */
    const chop = (1 - this.calmness * 0.5) * (this.rarity === 'glass' ? 0.2 : 1)
    for (let i = 0; i < 2; i += 1) {
      const offset = wander(this.clock * 0.4 + i * 3.1, 1, 0.7) * radius * 0.4
      const veil = ctx.createLinearGradient(
        cx - radius,
        cy + offset - radius * 0.4,
        cx + radius,
        cy + offset + radius * 0.4,
      )
      veil.addColorStop(0, rgba(PALETTE.twilight, 0))
      veil.addColorStop(0.5, rgba(PALETTE.moon, 0.05 * chop * view.mix))
      veil.addColorStop(1, rgba(PALETTE.twilight, 0))
      ctx.fillStyle = veil
      ctx.fillRect(cx - radius * 1.2, cy - radius * 1.2, radius * 2.4, radius * 2.4)
    }

    ctx.globalCompositeOperation = 'source-over'
  }

  private drawMoon(
    ctx: CanvasRenderingContext2D,
    view: SceneView,
    cx: number,
    cy: number,
    span: number,
    openness: number,
    moonlight: readonly [number, number, number],
  ): void {
    const sprite = this.moonSprite
    if (!sprite) return

    /*
     * Ordinarily the moon sits where this session put it. Once in a great
     * while it drifts across the window instead, which over a session of a
     * hundred breaths happens perhaps twice and is worth every line of this.
     */
    const drift =
      this.rarity === 'moondrift'
        ? Math.sin(this.clock * 0.11) * 0.55
        : this.variation.drift * 0.12
    const angle = this.world.moonAngle + drift
    const dist = this.world.moonDist * (this.rarity === 'moondrift' ? 0.7 : 1)
    const x = cx + Math.cos(angle) * dist * span
    const y = cy + Math.sin(angle) * dist * span
    const r = this.world.moonSize * span

    // Halo first, then the disc: the halo is what makes it read as seen
    // through water rather than pasted on.
    stamp(ctx, sprite, x, y, r * 3.2, 0.13 * openness * view.mix)
    stamp(ctx, sprite, x, y, r * 1.6, 0.22 * openness * view.mix)

    ctx.globalAlpha = 1
    const disc = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r)
    disc.addColorStop(0, rgba(PALETTE.pearl, 0.75 * openness * view.mix))
    disc.addColorStop(0.65, rgba(moonlight, 0.5 * openness * view.mix))
    disc.addColorStop(1, rgba(moonlight, 0.06 * openness * view.mix))
    ctx.fillStyle = disc
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }

  private drawStreak(
    ctx: CanvasRenderingContext2D,
    view: SceneView,
    cx: number,
    cy: number,
    radius: number,
    span: number,
  ): void {
    if (this.streak < 0 || this.streak > 1.4) return
    const t = clamp(this.streak)
    // In and out inside its own crossing: a shooting star that fades at the
    // frame edge is a sprite; one that fades mid-flight is a shooting star.
    const alpha = Math.sin(clamp(this.streak / 1.4) * Math.PI) ** 1.4
    if (alpha <= 0.01) return

    const heading = this.world.moonAngle + 2.2
    const from = -1.1
    const travel = lerp(from, 1.1, t)
    const px = cx + Math.cos(heading) * travel * span
    const py = cy + Math.sin(heading) * travel * span - radius * 0.2
    const tail = span * 0.34

    const trail = ctx.createLinearGradient(
      px,
      py,
      px - Math.cos(heading) * tail,
      py - Math.sin(heading) * tail,
    )
    trail.addColorStop(0, rgba(PALETTE.pearl, 0.6 * alpha * view.mix))
    trail.addColorStop(1, rgba(PALETTE.moon, 0))
    ctx.strokeStyle = trail
    ctx.lineWidth = 1.6
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(px, py)
    ctx.lineTo(px - Math.cos(heading) * tail, py - Math.sin(heading) * tail)
    ctx.stroke()

    if (this.silverSprite) {
      stamp(ctx, this.silverSprite, px, py, span * 0.02, 0.7 * alpha * view.mix)
    }
  }

  /** The bright edge where the window ends and the ocean begins. */
  private drawRim(
    ctx: CanvasRenderingContext2D,
    view: SceneView,
    cx: number,
    cy: number,
    radius: number,
    openness: number,
  ): void {
    const light = mixRgb(PALETTE.moon, PALETTE.pearl, 0.4)
    /*
     * Three passes, widest and faintest first. One crisp stroke would draw a
     * petri dish; what the edge of Snell's window actually looks like is light
     * bleeding out of it into the water, with only a suggestion of a line.
     */
    this.tracePath(ctx, cx, cy, radius)
    ctx.strokeStyle = rgba(light, 0.05 * (0.4 + openness * 0.6) * view.mix)
    ctx.lineWidth = Math.max(3, radius * 0.09)
    ctx.stroke()
    ctx.strokeStyle = rgba(light, 0.1 * (0.4 + openness * 0.6) * view.mix)
    ctx.lineWidth = Math.max(1.5, radius * 0.03)
    ctx.stroke()
    ctx.strokeStyle = rgba(light, 0.2 * (0.3 + openness * 0.7) * view.mix)
    ctx.lineWidth = 1
    ctx.stroke()
  }

  /**
   * Caustics.
   *
   * The net of light on the underside of a surface. Drawn as rings that are
   * pushed *outward* from the rim as the window widens, so an in-breath reads
   * as light spreading across the ceiling of the ocean rather than as a circle
   * getting bigger.
   */
  private drawCaustics(
    ctx: CanvasRenderingContext2D,
    view: SceneView,
    cx: number,
    cy: number,
    radius: number,
    unit: number,
    openness: number,
  ): void {
    if (!view.rich) return
    const rings = 5
    const light = mixRgb(PALETTE.moon, PALETTE.twilight, 0.3)
    const stretch = lerp(0.06, 0.4, smootherstep(0, 1, openness))

    ctx.lineWidth = Math.max(0.6, unit * 0.004)
    for (let ring = 0; ring < rings; ring += 1) {
      const spread = (ring + 1) / rings
      const base = radius * (1 + spread * stretch * 3.4)
      const fade = (1 - spread) ** 1.5 * (0.3 + openness * 0.7)
      if (fade <= 0.01) continue

      ctx.beginPath()
      const steps = 72
      for (let i = 0; i <= steps; i += 1) {
        const theta = (i / steps) * Math.PI * 2
        const ripple =
          Math.sin(theta * 6 + this.clock * 0.7 + ring * 1.7) * 0.05 +
          Math.sin(theta * 11 - this.clock * 0.44 + ring) * 0.028
        const r = base * (1 + ripple * (1 - this.calmness * 0.6))
        const x = cx + Math.cos(theta) * r
        const y = cy + Math.sin(theta) * r
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.closePath()
      ctx.strokeStyle = rgba(light, 0.13 * fade * view.mix * (view.field ? 1.35 : 1))
      ctx.stroke()
    }
  }

  /** Shafts of moonlight coming down through the water toward you. */
  private drawShafts(
    ctx: CanvasRenderingContext2D,
    view: SceneView,
    cx: number,
    cy: number,
    radius: number,
    unit: number,
    openness: number,
  ): void {
    if (!view.rich) return
    const count = 6
    const strength = smootherstep(0.15, 1, openness)
    if (strength <= 0.01) return
    const light = mixRgb(PALETTE.moon, PALETTE.pearl, 0.3)
    const length = unit * lerp(1.1, 2.1, strength)

    ctx.save()
    ctx.translate(cx, cy)
    for (let i = 0; i < count; i += 1) {
      const base = (i / count) * Math.PI * 2
      const angle = base + this.world.moonAngle * 0.3 + wander(this.clock * 0.3 + i, 1, 0.53) * 0.16
      const width = radius * (0.07 + 0.05 * Math.sin(this.clock * 0.5 + i * 2.1))
      const alpha =
        0.085 *
        strength *
        view.mix *
        (view.field ? 1.4 : 1) *
        (0.5 + 0.5 * Math.sin(this.clock * 0.4 + i * 1.7))

      const gradient = ctx.createLinearGradient(0, 0, Math.cos(angle) * length, Math.sin(angle) * length)
      gradient.addColorStop(0, rgba(light, alpha))
      gradient.addColorStop(0.55, rgba(light, alpha * 0.42))
      gradient.addColorStop(1, rgba(light, 0))

      ctx.beginPath()
      // Leaving from the rim rather than from the middle: a shaft is light that
      // got through the window, so it starts where the window is.
      ctx.moveTo(Math.cos(angle - 0.02) * radius * 0.92, Math.sin(angle - 0.02) * radius * 0.92)
      ctx.lineTo(
        Math.cos(angle) * length - Math.sin(angle) * width,
        Math.sin(angle) * length + Math.cos(angle) * width,
      )
      ctx.lineTo(
        Math.cos(angle) * length + Math.sin(angle) * width,
        Math.sin(angle) * length - Math.cos(angle) * width,
      )
      ctx.closePath()
      ctx.fillStyle = gradient
      ctx.fill()
    }
    ctx.restore()
  }

  private drawMotes(
    ctx: CanvasRenderingContext2D,
    view: SceneView,
    cx: number,
    cy: number,
    unit: number,
    openness: number,
  ): void {
    const sprite = this.silverSprite
    if (!sprite) return
    const lift = 0.4 + openness * 0.6
    for (const mote of this.motes) {
      const fade = Math.sin((mote.age / mote.life) * Math.PI)
      const shine = (mote.silver ? 0.3 : 0.14) * (view.field ? 1.3 : 1)
      stamp(
        ctx,
        sprite,
        cx + mote.x * unit,
        cy + mote.y * unit,
        mote.size * unit * 2.2,
        fade * shine * lift * view.mix,
      )
    }
  }

  /** The water you are looking through. Thicker as the window closes. */
  private drawHaze(
    ctx: CanvasRenderingContext2D,
    view: SceneView,
    cx: number,
    cy: number,
    unit: number,
    openness: number,
  ): void {
    // Across the viewport this is the stylesheet's `::after` layer, for the
    // same reason the ocean is: one opacity beats a viewport of fill.
    if (view.field) return

    const amount =
      this.world.haze *
      this.variation.clarity *
      lerp(1, 0.42, openness) *
      (this.rarity === 'glass' ? 0.45 : 1)
    const strength = amount * view.mix * (view.dark ? 0.32 : 0.14)
    if (strength <= 0.004) return

    const fog = ctx.createRadialGradient(cx, cy, unit * 0.2, cx, cy, view.radius)
    fog.addColorStop(0, rgba(PALETTE.abyss, 0))
    fog.addColorStop(0.5, rgba(PALETTE.abyss, strength * 0.5))
    fog.addColorStop(1, rgba(PALETTE.abyss, strength))
    ctx.fillStyle = fog
    ctx.beginPath()
    ctx.arc(view.cx, view.cy, view.radius, 0, Math.PI * 2)
    ctx.fill()
  }
}

/**
 * The still pose the picker's thumbnail and the resting orb hold: the window
 * comfortably open, the moon in it, and plenty of ocean left around the edge.
 */
export function moonpoolPose(seconds: number): LiveBreath {
  return {
    e: 0.64,
    p: 0.64,
    m: 0.6,
    mid: 0.58,
    far: 0.5,
    phase: 'inhale',
    breaths: 0,
    seconds,
    active: true,
    calm: false,
  }
}
