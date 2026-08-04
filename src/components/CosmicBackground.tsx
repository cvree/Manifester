import { useEffect, useRef } from 'react'
import { isLowPowerDevice, useReducedMotion } from '../lib/motion'

/**
 * The moonlit garden behind everything.
 *
 * Three layers, cheapest first:
 *  1. a static gradient wash;
 *  2. slow-drifting radial "aurora" pools (plain gradients, no blur filter —
 *     large blurred elements are the classic way to melt a phone GPU);
 *  3. a small canvas of drifting seed-lights.
 *
 * Layer 3 is skipped entirely on reduced-motion or modest hardware. There is no
 * WebGL here on purpose: see the README note on why Vanta was left out.
 */

interface CosmicBackgroundProps {
  /** Brightens the scene while a session is playing. */
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
}

const MOTE_COUNT = 26

export function CosmicBackground({ active = false }: CosmicBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const reducedMotion = useReducedMotion()

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

      motes = Array.from({ length: MOTE_COUNT }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: 0.7 + Math.random() * 1.8,
        speed: 0.05 + Math.random() * 0.16,
        drift: 0.15 + Math.random() * 0.45,
        phase: Math.random() * Math.PI * 2,
        alpha: 0.25 + Math.random() * 0.5,
      }))
    }

    const readColour = () =>
      getComputedStyle(document.documentElement).getPropertyValue('--spark').trim() ||
      'rgba(46, 58, 89, 0.5)'

    let colour = readColour()
    let time = 0

    const draw = () => {
      if (!running) return
      time += 0.016
      ctx.clearRect(0, 0, width, height)

      for (const mote of motes) {
        mote.y -= mote.speed
        mote.phase += 0.004
        if (mote.y < -8) {
          mote.y = height + 8
          mote.x = Math.random() * width
        }

        const x = mote.x + Math.sin(mote.phase + time * 0.2) * mote.drift * 18
        const twinkle = 0.7 + Math.sin(time * 0.9 + mote.phase * 3) * 0.3

        const gradient = ctx.createRadialGradient(
          x,
          mote.y,
          0,
          x,
          mote.y,
          mote.radius * 5,
        )
        gradient.addColorStop(0, colour)
        gradient.addColorStop(1, 'transparent')

        ctx.globalAlpha = mote.alpha * twinkle
        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(x, mote.y, mote.radius * 5, 0, Math.PI * 2)
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
        colour = readColour()
        frame = requestAnimationFrame(draw)
      }
    }

    // The spark colour differs between the day and night themes.
    const themeObserver = new MutationObserver(() => {
      colour = readColour()
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

  return (
    <div
      aria-hidden="true"
      className="grain pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={{
        background:
          'linear-gradient(170deg, var(--bg-0) 0%, var(--bg-1) 52%, var(--bg-2) 100%)',
      }}
    >
      <div
        className={
          reducedMotion ? 'absolute inset-0' : 'absolute inset-0 animate-drift'
        }
        style={{
          background:
            'radial-gradient(60% 45% at 18% 12%, var(--aurora-a) 0%, transparent 70%)',
          opacity: active ? 0.95 : 0.7,
          transition: 'opacity 1.6s var(--ease-calm)',
        }}
      />
      <div
        className={
          reducedMotion ? 'absolute inset-0' : 'absolute inset-0 animate-drift'
        }
        style={{
          background:
            'radial-gradient(55% 40% at 84% 26%, var(--aurora-b) 0%, transparent 72%)',
          animationDelay: '-11s',
          animationDuration: '46s',
          opacity: active ? 0.9 : 0.62,
          transition: 'opacity 1.6s var(--ease-calm)',
        }}
      />
      <div
        className={
          reducedMotion ? 'absolute inset-0' : 'absolute inset-0 animate-drift'
        }
        style={{
          background:
            'radial-gradient(70% 50% at 50% 104%, var(--aurora-c) 0%, transparent 68%)',
          animationDelay: '-24s',
          animationDuration: '58s',
          opacity: active ? 0.9 : 0.6,
          transition: 'opacity 1.6s var(--ease-calm)',
        }}
      />

      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  )
}
