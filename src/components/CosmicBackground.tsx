import { useEffect, useRef } from 'react'
import { isLowPowerDevice, useReducedMotion } from '../lib/motion'

/**
 * The Cosmic Garden: the twilight environment behind every screen.
 *
 * Five layers, cheapest first, so the expensive ones can be dropped without
 * the scene falling apart:
 *
 *  1. a static twilight wash;
 *  2. a moonlit glow near the top edge;
 *  3. three slow aurora-like light pools (plain radial gradients — large
 *     blurred elements are the classic way to melt a phone GPU);
 *  4. two very faint organic garden curves, drawn once as SVG paths;
 *  5. a small canvas of drifting pollen and firefly points.
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

    const readColours = () => {
      const styles = getComputedStyle(document.documentElement)
      return {
        spark: styles.getPropertyValue('--spark').trim() || 'rgba(46, 58, 89, 0.5)',
        pollen:
          styles.getPropertyValue('--pollen').trim() || 'rgba(193, 152, 80, 0.6)',
      }
    }

    let colours = readColours()
    let time = 0

    const draw = () => {
      if (!running) return
      time += 0.016
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

    // The point colours differ between the day and night themes.
    const themeObserver = new MutationObserver(() => {
      colours = readColours()
    })
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })

    resize()
    frame = requestAnimationFrame(draw)
    window.addEventListener('resize', resize)
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      running = false
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', onVisibility)
      themeObserver.disconnect()
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
      {/* Moonlight, high and slightly off-centre. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(38% 26% at 68% -4%, var(--moonlight) 0%, transparent 72%)',
          transform:
            'translate3d(calc(var(--px) * -10px), calc(var(--py) * -6px), 0)',
          opacity: active ? 1 : 0.82,
          transition: 'opacity 1.8s var(--ease-calm)',
        }}
      />

      {/* Three slow light pools. */}
      <div
        className={still ? 'absolute inset-0' : 'animate-drift absolute inset-0'}
        style={{
          background:
            'radial-gradient(58% 44% at 16% 14%, var(--aurora-a) 0%, transparent 70%)',
          opacity: active ? 0.98 : 0.72,
          transition: 'opacity 1.8s var(--ease-calm)',
        }}
      />
      <div
        className={still ? 'absolute inset-0' : 'animate-drift absolute inset-0'}
        style={{
          background:
            'radial-gradient(54% 40% at 86% 30%, var(--aurora-b) 0%, transparent 72%)',
          animationDelay: '-13s',
          animationDuration: '54s',
          opacity: active ? 0.94 : 0.64,
          transition: 'opacity 1.8s var(--ease-calm)',
        }}
      />
      <div
        className={still ? 'absolute inset-0' : 'animate-drift absolute inset-0'}
        style={{
          background:
            'radial-gradient(72% 48% at 48% 106%, var(--aurora-c) 0%, transparent 66%)',
          animationDelay: '-28s',
          animationDuration: '66s',
          opacity: active ? 0.95 : 0.62,
          transition: 'opacity 1.8s var(--ease-calm)',
        }}
      />

      {/*
        Two organic curves: the suggestion of a garden horizon and a stem
        arcing across it. One static SVG, no filters, drawn once.
      */}
      <svg
        className="absolute inset-x-0 bottom-0 h-[62%] w-full"
        viewBox="0 0 1200 600"
        preserveAspectRatio="none"
        style={{
          transform: 'translate3d(calc(var(--px) * 8px), calc(var(--py) * 5px), 0)',
        }}
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
