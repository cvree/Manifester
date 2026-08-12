import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { cx } from '../lib/cx'
import { isLowPowerDevice, prefersReducedMotion } from '../lib/motion'
import { SESSION_SEED } from '../lib/random'
import { InkCathedral, cathedralPose } from '../lib/scenes/inkCathedral'
import { Moonpool, moonpoolPose } from '../lib/scenes/moonpool'
import { approach, type LivingScene, type LivingStyleId, type SceneView } from '../lib/scenes/types'
import type { LiveBreath } from '../lib/useBreathing'

/**
 * The one piece of machinery the two living forms share.
 *
 * It owns a canvas, a size, a device ratio and a frame loop, and it owns
 * nothing else. Every decision about what the world looks like belongs to the
 * scene; every decision about how often and how large belongs here. That split
 * is what lets the same scene be an orb three hundred pixels across and the
 * room behind the whole page at the same instant, without either of them
 * knowing about the other.
 *
 * ── The one clock ──
 *
 * There is no clock in this file. `runtime.live` is a plain object that
 * `useBreathing` rewrites each frame from the same `breathStateAt` call that
 * writes `--e` onto the orb and the atmosphere; this loop reads whatever is in
 * it when its own frame comes round, which is by construction the current one.
 * So a canvas form is in step with a CSS form to the millisecond for the same
 * reason two CSS forms are: they are not agreeing, they are the same number.
 *
 * ── What it costs ──
 *
 * One canvas and one `requestAnimationFrame`. Everything expensive about a
 * scene like this is fill rate, so all three of the levers here are about
 * pixels: the device ratio is capped rather than honoured, the room's static
 * ground is a CSS gradient behind the canvas rather than a viewport of fill
 * every frame, and a mix of zero draws nothing at all. What is left on the
 * canvas is light, composited additively, over transparent.
 */

export type LivingVariant = 'orb' | 'field' | 'thumb'

interface LivingCanvasProps {
  style: LivingStyleId
  /** The live breath. Omitted for a thumbnail, which holds a fixed pose. */
  live?: RefObject<LiveBreath>
  variant: LivingVariant
  /**
   * The element carrying `--mix`, `--heart-x`, `--heart-y` and `--halo` — the
   * player's atmosphere. Read from its *inline* style, which is a property
   * lookup rather than a style resolution, so the loop never forces layout.
   */
  hostRef?: RefObject<HTMLElement | null>
}

/**
 * Asked once per page, not once per canvas.
 *
 * `isLowPowerDevice` builds and throws away a WebGL context to read the
 * renderer string. That is cheap, and it is not free — and the style picker
 * alone would mount two of these alongside the orb and the room. The answer
 * cannot change while the page is open, so neither should the question.
 */
let lowPowerAnswer: boolean | null = null
function lowPower(): boolean {
  if (lowPowerAnswer === null) lowPowerAnswer = isLowPowerDevice()
  return lowPowerAnswer
}

function makeScene(style: LivingStyleId, seed: number): LivingScene {
  return style === 'cathedral' ? new InkCathedral(seed) : new Moonpool(seed)
}

function poseFor(style: LivingStyleId, seconds: number): LiveBreath {
  return style === 'cathedral' ? cathedralPose(seconds) : moonpoolPose(seconds)
}

/**
 * Read one custom property off an element's *inline* style.
 *
 * Inline rather than computed, and that is the whole point: `getComputedStyle`
 * would force the browser to resolve style, which is a layout flush, sixty
 * times a second. Everything this reads — the mix, the orb's measured centre
 * and radius — is written as an inline property by `useBackgroundMix` and
 * `useHeartAnchor`, so a plain property lookup is both correct and free.
 */
function readVar(host: HTMLElement | null, name: string, fallback: number): number {
  if (!host) return fallback
  const raw = host.style.getPropertyValue(name)
  if (!raw) return fallback
  const value = Number.parseFloat(raw)
  return Number.isFinite(value) ? value : fallback
}

export function LivingCanvas({ style, live, variant, hostRef }: LivingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const liveRef = useRef(live)
  liveRef.current = live
  const hostElement = useRef(hostRef)
  hostElement.current = hostRef

  /* Measured once for the whole page, not once per canvas. */
  const modest = useMemo(lowPower, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return

    const field = variant === 'field'
    const scene = makeScene(style, SESSION_SEED)
    /*
     * Every canvas of a given form draws the same world — same session seed,
     * same breath index, same deterministic geometry — so the orb and the room
     * are one place seen at two scales. What they do *not* share is their
     * suspended matter: vapour and motes are stochastic detail, and letting
     * each canvas have its own is both cheaper and better, because two hundred
     * identical specks in two places would read as a reflection.
     */

    /*
     * The device ratio is capped rather than honoured, and the room is capped
     * harder than the orb.
     *
     * A full-viewport canvas at a phone's native 3× is nine times the fill of
     * one at 1× — for a picture made almost entirely of soft gradients, where
     * the extra resolution is invisible and the extra fill is most of the frame.
     * The orb has edges worth resolving and is a few hundred pixels across, so
     * it gets 2×. A modest device gets 1× and a scene told to draw less.
     */
    const dprCap = modest ? 1 : field ? 1.25 : 2
    /**
     * Set by anything that changes the picture while it is being held still —
     * a resize, a theme change, the mix arriving. Only consulted under reduced
     * motion, where it is the whole redraw policy.
     */
    let dirty = true
    let width = 0
    let height = 0
    let frame = 0
    let last = performance.now()
    /** Wall-clock seconds, for the poses that have no breath behind them. */
    let posed = 0

    let driftX = 0
    let driftY = 0
    let targetX = 0
    let targetY = 0

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const w = Math.max(1, Math.round(rect.width))
      const h = Math.max(1, Math.round(rect.height))
      if (w === width && h === height) return
      width = w
      height = h
      const dpr = Math.min(window.devicePixelRatio || 1, dprCap)
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      dirty = true
    }

    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)

    /*
     * Parallax, and deliberately only here.
     *
     * The room shifts by a few pixels against the pointer, which is enough for
     * the eye to read the haze, the light and the architecture as being at
     * different distances. The UI does not move at all: this is depth, not a
     * tilt effect, and a page whose controls slide under the cursor is a page
     * nobody can hit a button on.
     */
    const onPointer = (event: PointerEvent) => {
      const nx = event.clientX / window.innerWidth - 0.5
      const ny = event.clientY / window.innerHeight - 0.5
      targetX = -nx * 26
      targetY = -ny * 18
    }
    // Not attached at all when motion has been declined: parallax is exactly
    // the kind of movement someone turns that preference on to be spared.
    const parallax = field && !prefersReducedMotion()
    if (parallax) window.addEventListener('pointermove', onPointer, { passive: true })

    const isDark = () => document.documentElement.classList.contains('dark')
    let dark = isDark()
    const themeWatch = new MutationObserver(() => {
      const next = isDark()
      if (next === dark) return
      dark = next
      dirty = true
    })
    themeWatch.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })

    /** Nothing has been drawn since the scene last went completely quiet. */
    let cleared = false
    /** The half-open pose the world holds when motion has been declined. */
    const held: LiveBreath = { ...poseFor(style, 0), calm: true }

    /*
     * A picker thumbnail keeps a little life — the same courtesy the styled
     * forms get, where a ripple in a 3.5rem swatch is still travelling — but
     * two of them at sixty frames a second inside a settings sheet is a strange
     * way to spend a phone's battery on a decision that takes four seconds.
     */
    const minStep = variant === 'thumb' ? 1000 / 15 : 0
    let drawnAt = 0
    /** The last mix drawn, so a held picture notices the room being switched off. */
    let lastMix = -1

    const render = (now: number) => {
      frame = requestAnimationFrame(render)
      if (width < 2 || height < 2) {
        last = now
        return
      }

      if (now - drawnAt < minStep) return
      drawnAt = now

      const host = hostElement.current?.current ?? null
      /*
       * How much of itself the world is showing.
       *
       * Two things folded into one number, and folded rather than threaded
       * because every alpha in both scenes is already multiplied by it.
       *
       * The first is the background visualiser's own mix, tweened by
       * `useBackgroundMix` — which is what lets the setting be switched
       * mid-breath and simply fade in at whatever value the breath was already
       * at. The second is the palette. These are worlds made of light drawn
       * *additively*, and light added to a near-black night page is luminous
       * where the same light added to a cream one is a grey smudge. So the room
       * is exposed down by day. The orb is untouched by either: it is a portal
       * with its own dark inside it, and it looks the same in both palettes.
       *
       * Read before the reduced-motion gate below, and that ordering is load-
       * bearing: the mix keeps moving when the breath has been held still, so a
       * held picture that never looked at it would go on showing a room the
       * person had just switched off.
       */
      const mix = field ? readVar(host, '--mix', 1) * (dark ? 1 : 0.55) : 1
      if (Math.abs(mix - lastMix) > 0.002) {
        lastMix = mix
        dirty = true
      }

      const live = liveRef.current?.current
      const calm = live?.calm ?? false

      /*
       * ── Reduced motion ──
       *
       * The other six forms answer this by holding one comfortable half-open
       * pose and letting the words, the countdown and the phase ring do the
       * guiding (`REDUCED_POSE`, in `useBreathing`). These two do exactly the
       * same, and the consistency is the point: someone who has asked their
       * system for less motion has asked all of it, and a single form that
       * kept animating anyway would be a bug from the only point of view that
       * matters here.
       *
       * So the world is built to the same half-open pose and simply drawn —
       * once, and then again only when something that is not the breath changes
       * it: the theme, the size, or the mix. A held pose is a picture, and a
       * picture does not need sixty frames a second to keep being itself.
       */
      const breath = calm ? held : (live ?? poseFor(style, posed))

      if (calm && !dirty) return
      dirty = false

      const dt = calm ? 1 / 60 : Math.min(0.05, Math.max(0, (now - last) / 1000))
      last = now
      posed += dt

      if (parallax) {
        driftX = approach(driftX, targetX, 2.2, dt)
        driftY = approach(driftY, targetY, 2.2, dt)
      }

      const radius = field
        ? readVar(host, '--halo', Math.min(width, height) * 0.2)
        : Math.min(width, height) / 2

      const view: SceneView = {
        width,
        height,
        cx: field ? readVar(host, '--heart-x', width / 2) : width / 2,
        cy: field ? readVar(host, '--heart-y', height * 0.44) : height / 2,
        radius,
        mix,
        field,
        dark,
        rich: !modest && variant !== 'thumb',
        driftX: field ? driftX : 0,
        driftY: field ? driftY : 0,
      }

      /*
       * A room nobody is being shown is a room that costs nothing. One clear,
       * and then not another pixel until the mix comes back — which is the
       * whole of what "turn the background visualiser off" should mean.
       */
      if (mix <= 0.003) {
        if (!cleared) {
          ctx.clearRect(0, 0, width, height)
          cleared = true
        }
        return
      }
      cleared = false

      scene.update(dt, breath, view)

      ctx.clearRect(0, 0, width, height)
      ctx.save()
      if (!field) {
        // The orb is a portal, and a portal has a rim. Nothing the scene draws
        // may cross it.
        ctx.beginPath()
        ctx.arc(view.cx, view.cy, radius, 0, Math.PI * 2)
        ctx.clip()
      }
      scene.draw(ctx, view)
      ctx.restore()
    }

    frame = requestAnimationFrame(render)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      themeWatch.disconnect()
      if (parallax) window.removeEventListener('pointermove', onPointer)
    }
  }, [style, variant, modest])

  const canvas = (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={cx('living-canvas', `living-canvas--${variant}`)}
    />
  )

  if (variant !== 'field') return canvas

  /*
   * The room's ground is a stylesheet's job, not a renderer's.
   *
   * It is one enormous, entirely static gradient — the dark these worlds are
   * drawn on — and painting it into the canvas cost two full-viewport fills
   * every frame for a picture that never changes. On a 1600×1000 screen at
   * 1.5×, that was most of the frame budget, spent redrawing the same pixels.
   *
   * So it is a sibling element with a CSS gradient, centred on the same
   * `--heart-x`/`--heart-y` the whole atmosphere uses and faded by the same
   * `--mix`. The canvas above it now carries light and nothing else, and clears
   * to transparent — which is also why every stroke in both scenes composites
   * with `lighter`. Same picture, one less viewport of fill per frame, and the
   * house rule the rest of `theme.css` is built on ("no gradient is ever
   * recomputed per frame") holds here too.
   */
  return (
    <span aria-hidden="true" className={cx('living-field', `living-field--${style}`)}>
      <span className="living-field__ground" />
      {canvas}
    </span>
  )
}
