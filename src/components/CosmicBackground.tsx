import { useEffect, useRef, type CSSProperties } from 'react'
import { cx } from '../lib/cx'
import { isLowPowerDevice, useReducedMotion } from '../lib/motion'

/**
 * The Cosmic Garden: the twilight environment behind every screen.
 *
 * Five layers, cheapest first, so the expensive ones can be dropped without
 * the scene falling apart:
 *
 *  1. a static twilight wash, on this element itself — the one thing here
 *     that never moves, so there is always a ground beneath the rest;
 *  2. a moonlit pool near the top edge;
 *  3. three slow aurora-like light pools (plain radial gradients — large
 *     blurred elements are the classic way to melt a phone GPU);
 *  4. two very faint organic garden curves, drawn once as SVG paths;
 *  5. a small canvas of drifting pollen and firefly points.
 *
 * Everything from 2 down is oversized and fades out inside its own bounds, so
 * no amount of drifting can bring an element's edge into view — the reasoning
 * is under "The atmosphere" in `theme.css`, and it is the whole reason this
 * scene reads as one continuous environment rather than as stacked panes.
 * The only clip in the system is this element's, and it sits exactly on the
 * viewport edge where a clip cannot be perceived.
 *
 * Layer 5 is skipped on reduced-motion or modest hardware, and the pointer
 * parallax only ever runs on a device with a real pointer. There is no WebGL
 * here on purpose: see the README note on why Vanta was left out.
 */

interface CosmicBackgroundProps {
  /** Warms and brightens the scene while a session is playing. */
  active?: boolean
}

interface Mote {
  x: number
  y: number
  radius: number
  speed: number
  drift: number
  phase: number
  alpha: number
  /** Fireflies pulse; pollen just drifts. */
  firefly: boolean
}

const MOTE_COUNT = 30

export function CosmicBackground({ active = false }: CosmicBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const reducedMotion = useReducedMotion()

  /* ── Pointer and scroll parallax, desktop only ── */

  useEffect(() => {
    if (reducedMotion) return
    if (typeof window === 'undefined') return
    // Coarse pointers get nothing: on a phone this would only fight scrolling.
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return

    const root = rootRef.current
    if (!root) return

    let targetX = 0
    let targetY = 0
    let currentX = 0
    let currentY = 0
    let frame = 0
    let running = false

    const settle = () => {
      // Ease toward the pointer so the scene never snaps to it.
      currentX += (targetX - currentX) * 0.06
      currentY += (targetY - currentY) * 0.06
      root.style.setProperty('--px', currentX.toFixed(3))
      root.style.setProperty('--py', currentY.toFixed(3))

      if (
        Math.abs(targetX - currentX) > 0.001 ||
        Math.abs(targetY - currentY) > 0.001
      ) {
        frame = requestAnimationFrame(settle)
      } else {
        running = false
      }
    }

    const request = () => {
      if (running) return
      running = true
      frame = requestAnimationFrame(settle)
    }

    const onPointerMove = (event: PointerEvent) => {
      targetX = (event.clientX / window.innerWidth - 0.5) * 2
      targetY = (event.clientY / window.innerHeight - 0.5) * 2
      request()
    }

    const onScroll = () => {
      const max = Math.max(1, document.body.scrollHeight - window.innerHeight)
      targetY = Math.min(1, window.scrollY / max) * 1.2 - 0.6
      request()
    }

    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('scroll', onScroll)
    }
  }, [reducedMotion])

  /* ── Pollen and fireflies ── */

  useEffect(() => {
    if (reducedMotion || isLowPowerDevice()) return

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let width = 0
    let height = 0
    let motes: Mote[] = []
    let frame = 0
    let running = true

    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    const resize = () => {
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      motes = Array.from({ length: MOTE_COUNT }, (_, index) => ({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: 0.6 + Math.random() * 1.6,
        speed: 0.04 + Math.random() * 0.14,
        drift: 0.15 + Math.random() * 0.5,
        phase: Math.random() * Math.PI * 2,
        alpha: 0.2 + Math.random() * 0.5,
        // Roughly one in three is a firefly, so the garden has warm points
        // among the cool ones without turning into a light show.
        firefly: index % 3 === 0,
      }))
    }

    /*
     * The point colours are read off a probe element rather than straight out
     * of the custom properties, because `--spark` and `--pollen` may hold a
     * relative-colour expression — `oklch(from … calc(h + var(--hue-shift)))`
     * — which is a recipe rather than a colour. Painting it on something and
     * asking what came out is what turns it into one the canvas can use.
     */
    const probe = document.createElement('span')
    probe.setAttribute('aria-hidden', 'true')
    probe.style.cssText =
      'position:fixed;top:0;left:0;width:0;height:0;pointer-events:none;visibility:hidden'
    document.body.appendChild(probe)

    const resolve = (name: string, fallback: string) => {
      probe.style.color = `var(${name})`
      return getComputedStyle(probe).color || fallback
    }

    const readColours = () => ({
      spark: resolve('--spark', 'rgba(46, 58, 89, 0.5)'),
      pollen: resolve('--pollen', 'rgba(193, 152, 80, 0.6)'),
    })

    let colours = readColours()
    let time = 0
    let frames = 0

    const draw = () => {
      if (!running) return
      time += 0.016

      /*
       * Twice a second, which is often enough that the motes travel with the
       * palette while the hue dial sweeps, and rare enough to cost nothing.
       */
      if (frames++ % 30 === 0) colours = readColours()
      ctx.clearRect(0, 0, width, height)

      for (const mote of motes) {
        mote.y -= mote.speed
        mote.phase += 0.004
        if (mote.y < -10) {
          mote.y = height + 10
          mote.x = Math.random() * width
        }

        const x = mote.x + Math.sin(mote.phase + time * 0.2) * mote.drift * 20
        // Fireflies breathe slowly in and out; pollen barely twinkles at all.
        const pulse = mote.firefly
          ? 0.45 + (Math.sin(time * 0.55 + mote.phase * 2) + 1) * 0.35
          : 0.75 + Math.sin(time * 0.8 + mote.phase * 3) * 0.25

        const reach = mote.radius * (mote.firefly ? 6 : 4.5)
        const gradient = ctx.createRadialGradient(x, mote.y, 0, x, mote.y, reach)
        gradient.addColorStop(0, mote.firefly ? colours.pollen : colours.spark)
        gradient.addColorStop(1, 'transparent')

        ctx.globalAlpha = mote.alpha * pulse
        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(x, mote.y, reach, 0, Math.PI * 2)
        ctx.fill()
      }

      ctx.globalAlpha = 1
      frame = requestAnimationFrame(draw)
    }

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        running = false
        cancelAnimationFrame(frame)
      } else if (!running) {
        running = true
        colours = readColours()
        frame = requestAnimationFrame(draw)
      }
    }

    resize()
    frame = requestAnimationFrame(draw)
    window.addEventListener('resize', resize)
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      running = false
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', onVisibility)
      probe.remove()
    }
  }, [reducedMotion])

  const still = reducedMotion

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      className="grain pointer-events-none fixed inset-0 -z-10 overflow-hidden [--px:0] [--py:0]"
      style={{
        background:
          'linear-gradient(168deg, var(--bg-0) 0%, var(--bg-1) 48%, var(--bg-2) 100%)',
      }}
    >
      {/*
        Four pools of light. Geometry, tint and breath all live in `theme.css`
        under "The atmosphere" — the only thing decided here is how bright each
        one burns, which is the one part that answers to the session.
      */}
      <Pool variant="moon" still={still} opacity={active ? 1 : 0.9} />
      <Pool variant="a" still={still} opacity={active ? 0.98 : 0.8} />
      <Pool variant="b" still={still} opacity={active ? 0.94 : 0.72} delay="-13s" duration="54s" />
      <Pool variant="c" still={still} opacity={active ? 0.95 : 0.7} delay="-28s" duration="66s" />

      {/*
        Two organic curves: the suggestion of a garden horizon and a stem
        arcing across it. One static SVG, no filters, drawn once.
      */}
      <svg
        className="sky-contours"
        viewBox="0 0 1200 600"
        preserveAspectRatio="none"
      >
        <path
          d="M-40 470 C 220 380, 420 520, 660 430 S 1040 300, 1240 372"
          fill="none"
          stroke="var(--sage)"
          strokeWidth="1.25"
          opacity="0.14"
        />
        <path
          d="M-40 556 C 260 486, 520 596, 780 512 S 1080 420, 1240 468"
          fill="none"
          stroke="var(--rose)"
          strokeWidth="1"
          opacity="0.1"
        />
        <path
          d="M-40 600 C 240 512, 500 620, 760 540 S 1060 452, 1240 500 L 1240 600 Z"
          fill="var(--twilight)"
          opacity="0.05"
        />
      </svg>

      {/*
        Mounted only when the points are actually going to move. Leaving an
        idle canvas in place would keep the last frame of pollen frozen on
        screen after someone turns reduced motion on.
      */}
      {!still && <canvas ref={canvasRef} className="absolute inset-0" />}
    </div>
  )
}

/**
 * One pool of light.
 *
 * Two elements rather than one, and deliberately so: the outer holds the
 * placement and the brightness the session asks for, the inner holds the
 * breath. They would otherwise be fighting over `transform` and `opacity` —
 * a CSS animation wins that fight outright, and the pool would stop answering
 * to the player.
 */
function Pool({
  variant,
  opacity,
  still,
  delay,
  duration,
}: {
  variant: 'moon' | 'a' | 'b' | 'c'
  opacity: number
  still: boolean
  delay?: string
  duration?: string
}) {
  return (
    <div className={`sky-pool sky-pool--${variant}`} style={{ opacity }}>
      <span
        className={cx('sky-glow', !still && 'sky-glow--breathing')}
        style={
          {
            '--swell-delay': delay,
            '--swell-duration': duration,
          } as CSSProperties
        }
      />
    </div>
  )
}
