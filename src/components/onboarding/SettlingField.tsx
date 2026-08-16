import { useEffect, useRef } from 'react'
import { cx } from '../../lib/cx'
import { isLowPowerDevice, useReducedMotion } from '../../lib/motion'
import type { LiveBreath } from '../../lib/useBreathing'

/**
 * The one visual the welcome experience has.
 *
 * **A field of concentric light that begins unresolved and settles into focus
 * as the person makes each choice** — so the room itself appears to take a
 * breath and come into clarity alongside them. That is the whole metaphor, and
 * everything below is in service of it rather than of looking busy.
 *
 * Four things move it, and each one is a fact about the person rather than a
 * decoration:
 *
 *  - **`resolve`**, 0 → 1 across the four steps. At zero the rings are wide,
 *    dim, and each drifting on its own wobble; at one they are concentric,
 *    close, and still. Nothing else in the interface says "you are nearly
 *    there" — this does, without a progress bar's arithmetic.
 *  - **The breath.** The field expands and contracts on the app's own breath
 *    clock, at the pattern they will actually be following a minute later. The
 *    first thing they see is already the thing they came for.
 *  - **`tone`.** The room warms towards whatever they said they needed. Four
 *    accents, all already in the palette.
 *  - **`speaking`.** A slow bloom while a voice is talking, so the sound has
 *    somewhere to be coming from.
 *
 * ── Why canvas, and why this much of it ─────────────────────────────────────
 *
 * Twelve soft rings redrawn at 60fps is roughly nothing: no shader, no WebGL
 * context, no second render loop of its own — it borrows the breath frame that
 * `useBreathing` is already producing. A CSS version was tried first and could
 * not do the one thing the metaphor needs, which is *per-ring* wobble that
 * decays independently; stacking twelve blurred elements to fake it is how a
 * phone GPU dies.
 *
 * With motion reduced it draws exactly once, resolved and still, and is
 * genuinely better for it: the picture the whole animation was travelling
 * towards, arrived at immediately.
 */

export type FieldTone = 'rose' | 'sage' | 'gold' | 'twilight'

interface SettlingFieldProps {
  /** 0 on arrival, 1 at the ritual. Eased towards, never jumped to. */
  resolve: number
  tone: FieldTone
  /** True while a voice is speaking. Blooms the field. */
  speaking?: boolean
  /** The breath frame, mutated in place by `useBreathing`. */
  breath?: React.RefObject<LiveBreath>
  className?: string
}

/**
 * The field's own palette.
 *
 * Deliberately its own rather than read from the stylesheet: the tokens are
 * `oklch()` with a runtime hue rotation, `canvas` cannot be relied on to parse
 * that everywhere this app runs, and parsing it here would be a colour library
 * for four swatches. These are the same four accents to the eye, and the hue
 * dial is applied below by rotating them — so the field still turns with the
 * rest of the app.
 */
const TONES: Record<FieldTone, { day: [number, number, number]; night: [number, number, number] }> = {
  rose: { day: [192, 122, 132], night: [229, 170, 177] },
  sage: { day: [111, 144, 115], night: [149, 186, 152] },
  gold: { day: [193, 152, 80], night: [231, 203, 148] },
  twilight: { day: [110, 126, 178], night: [150, 166, 224] },
}

const RINGS = 12
const RINGS_LOW_POWER = 7

/** Rotate an RGB triple by the app's hue dial, in degrees. */
function rotate([r, g, b]: [number, number, number], degrees: number) {
  if (!degrees) return [r, g, b] as const
  // A 3×3 hue rotation matrix — cheaper and more stable than a round trip
  // through HSL, and it runs once per theme change rather than per frame.
  const angle = (degrees * Math.PI) / 180
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const m = [
    0.213 + cos * 0.787 - sin * 0.213,
    0.715 - cos * 0.715 - sin * 0.715,
    0.072 - cos * 0.072 + sin * 0.928,
    0.213 - cos * 0.213 + sin * 0.143,
    0.715 + cos * 0.285 + sin * 0.14,
    0.072 - cos * 0.072 - sin * 0.283,
    0.213 - cos * 0.213 - sin * 0.787,
    0.715 - cos * 0.715 + sin * 0.715,
    0.072 + cos * 0.928 + sin * 0.072,
  ]
  const clamp = (value: number) => Math.max(0, Math.min(255, Math.round(value)))
  return [
    clamp(r * m[0] + g * m[1] + b * m[2]),
    clamp(r * m[3] + g * m[4] + b * m[5]),
    clamp(r * m[6] + g * m[7] + b * m[8]),
  ] as const
}

export function SettlingField({
  resolve,
  tone,
  speaking = false,
  breath,
  className,
}: SettlingFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const reducedMotion = useReducedMotion()

  /*
   * Everything the frame loop reads lives in refs, so a new prop is a new
   * *target* rather than a re-mounted animation. Changing intent mid-flight
   * eases the colour across; it does not cut.
   */
  const target = useRef({ resolve, tone, speaking })
  target.current = { resolve, tone, speaking }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d', { alpha: true })
    if (!context) return

    const lowPower = isLowPowerDevice()
    const ringCount = lowPower ? RINGS_LOW_POWER : RINGS

    /* ── Palette, re-read when the theme or the hue dial moves ── */

    let palette: Record<FieldTone, readonly [number, number, number]> = {
      rose: TONES.rose.day,
      sage: TONES.sage.day,
      gold: TONES.gold.day,
      twilight: TONES.twilight.day,
    }

    const readPalette = () => {
      const root = document.documentElement
      const night = root.classList.contains('dark')
      const shift = Number.parseFloat(
        getComputedStyle(root).getPropertyValue('--hue-shift'),
      )
      const degrees = Number.isFinite(shift) ? shift : 0
      palette = {
        rose: rotate(night ? TONES.rose.night : TONES.rose.day, degrees),
        sage: rotate(night ? TONES.sage.night : TONES.sage.day, degrees),
        gold: rotate(night ? TONES.gold.night : TONES.gold.day, degrees),
        twilight: rotate(
          night ? TONES.twilight.night : TONES.twilight.day,
          degrees,
        ),
      }
    }
    readPalette()

    const themeWatcher = new MutationObserver(readPalette)
    themeWatcher.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'style'],
    })

    /* ── Size ── */

    let width = 0
    let height = 0
    let ratio = 1

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return
      // Capped at 2: a 3× phone gains nothing visible from twelve blurred
      // rings and pays for every one of those pixels.
      ratio = Math.min(2, window.devicePixelRatio || 1)
      width = rect.width
      height = rect.height
      canvas.width = Math.round(width * ratio)
      canvas.height = Math.round(height * ratio)
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
    }
    resize()

    const observer = new ResizeObserver(resize)
    observer.observe(canvas)

    /* ── Pointer, on devices that have one ── */

    let pointerX = 0
    let pointerY = 0
    const finePointer =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(hover: hover) and (pointer: fine)').matches

    const onPointerMove = (event: PointerEvent) => {
      pointerX = (event.clientX / window.innerWidth - 0.5) * 2
      pointerY = (event.clientY / window.innerHeight - 0.5) * 2
    }
    if (finePointer && !reducedMotion) {
      window.addEventListener('pointermove', onPointerMove, { passive: true })
    }

    /* ── The frame ── */

    // Eased state, so every input arrives as a movement rather than a cut.
    const eased = {
      resolve: reducedMotion ? resolve : 0,
      voice: 0,
      x: 0,
      y: 0,
      colour: [...(palette[tone] ?? palette.rose)] as [number, number, number],
    }

    let frame = 0
    let running = true
    let last = performance.now()

    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now

      const wanted = target.current
      const goal = palette[wanted.tone] ?? palette.rose

      // One time constant for everything, so the whole field settles as a
      // single object rather than as parts arriving separately.
      const k = reducedMotion ? 1 : 1 - Math.exp(-dt * 2.4)
      eased.resolve += (wanted.resolve - eased.resolve) * k
      eased.voice += ((wanted.speaking ? 1 : 0) - eased.voice) * k
      eased.x += (pointerX - eased.x) * k * 0.5
      eased.y += (pointerY - eased.y) * k * 0.5
      for (let i = 0; i < 3; i += 1) {
        eased.colour[i] += (goal[i] - eased.colour[i]) * k
      }

      const live = breath?.current
      // 0 → 1 → 0 across a breath. At rest it sits open, so a still field is
      // an inhale held rather than a collapsed one.
      const expansion = live?.active ? live.e : 0.4
      const seconds = live?.seconds ?? now / 1000

      const settle = eased.resolve
      const centreX = width / 2 + eased.x * 22 * (1 - settle * 0.6)
      const centreY = height * (0.5 - 0.06 * (1 - settle)) + eased.y * 16

      // The field contracts as it resolves: wide and searching at first, close
      // and certain by the ritual.
      const span = Math.min(width, height)
      const outer = span * (0.92 - 0.3 * settle) * (0.94 + expansion * 0.12)
      const [r, g, b] = eased.colour

      context.clearRect(0, 0, width, height)
      context.globalCompositeOperation = 'lighter'

      for (let index = 0; index < ringCount; index += 1) {
        const t = index / (ringCount - 1)

        /*
         * The wobble is the whole "unresolved" feeling, and it decays with
         * `resolve` rather than with time — so the field is not waiting for a
         * clock, it is waiting for the person.
         */
        const wobbleAmount = (1 - settle) * span * 0.055
        const wobble = reducedMotion
          ? 0
          : Math.sin(seconds * (0.22 + t * 0.35) + index * 1.7) * wobbleAmount
        const drift = reducedMotion
          ? 0
          : Math.cos(seconds * (0.17 + t * 0.24) + index * 2.3) * wobbleAmount * 0.7

        const radius = outer * (0.16 + t * 0.84) + wobble
        if (radius <= 1) continue

        // Bright at the heart, fading outwards, and brighter overall as the
        // field resolves and while a voice is speaking.
        const falloff = 1 - t * 0.82
        const alpha =
          falloff *
          (0.075 + settle * 0.115) *
          (0.72 + expansion * 0.5) *
          (1 + eased.voice * 0.85)

        const x = centreX + drift
        const y = centreY + drift * 0.6

        const gradient = context.createRadialGradient(
          x,
          y,
          radius * 0.62,
          x,
          y,
          radius,
        )
        gradient.addColorStop(0, `rgba(${r | 0}, ${g | 0}, ${b | 0}, 0)`)
        gradient.addColorStop(
          0.72,
          `rgba(${r | 0}, ${g | 0}, ${b | 0}, ${alpha.toFixed(4)})`,
        )
        gradient.addColorStop(1, `rgba(${r | 0}, ${g | 0}, ${b | 0}, 0)`)

        context.fillStyle = gradient
        context.beginPath()
        context.arc(x, y, radius, 0, Math.PI * 2)
        context.fill()
      }

      /*
       * The heart. One soft light at the centre that grows with the breath and
       * with resolve — the thing the rings are rings *of*, and the thing the
       * player's orb takes over from when the welcome ends.
       */
      const heart = span * (0.09 + 0.05 * settle) * (0.82 + expansion * 0.4)
      const heartAlpha = (0.10 + settle * 0.14) * (1 + eased.voice * 0.7)
      const core = context.createRadialGradient(
        centreX,
        centreY,
        0,
        centreX,
        centreY,
        heart,
      )
      core.addColorStop(0, `rgba(${r | 0}, ${g | 0}, ${b | 0}, ${heartAlpha.toFixed(4)})`)
      core.addColorStop(1, `rgba(${r | 0}, ${g | 0}, ${b | 0}, 0)`)
      context.fillStyle = core
      context.beginPath()
      context.arc(centreX, centreY, heart, 0, Math.PI * 2)
      context.fill()

      context.globalCompositeOperation = 'source-over'

      if (!running) return
      // Reduced motion draws the settled picture once and stops. It is not a
      // degraded version of this — it is the frame the animation was heading
      // for, which is the only honest way to remove motion from a metaphor
      // about arriving somewhere.
      if (reducedMotion) return
      frame = requestAnimationFrame(draw)
    }

    frame = requestAnimationFrame(draw)

    /*
     * A hidden tab must not hold a frame loop open. Coming back re-reads the
     * clock rather than catching up, so a phone that was in a pocket for ten
     * minutes resumes rather than fast-forwards.
     */
    const onVisibility = () => {
      if (document.hidden) {
        running = false
        cancelAnimationFrame(frame)
        return
      }
      if (running) return
      running = true
      last = performance.now()
      frame = requestAnimationFrame(draw)
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      running = false
      cancelAnimationFrame(frame)
      observer.disconnect()
      themeWatcher.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pointermove', onPointerMove)
    }
    // `resolve` and `tone` are read through `target`; only the things that
    // change *how* the loop is built belong here.
  }, [reducedMotion, breath, resolve, tone])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={cx('pointer-events-none absolute inset-0 h-full w-full', className)}
    />
  )
}
