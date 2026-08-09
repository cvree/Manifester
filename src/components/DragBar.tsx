import {
  useCallback,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react'
import { cx } from '../lib/cx'

interface DragBarProps {
  /** Read aloud in place of a visible label, e.g. "Palette colour". */
  label: string
  value: number
  min: number
  max: number
  /** The smallest move a drag or an arrow key can make. */
  step?: number
  /** A shift-arrow, and a page key, move this many steps at once. */
  coarse?: number
  onChange: (value: number) => void
  /** Called once when a drag or a key press finishes, for the tap sound. */
  onCommit?: () => void
  /**
   * Called as a drag begins. What it is for: a value under a long transition
   * has to stop transitioning while it is being dragged, or the thing it
   * drives trails the finger by however long the transition is.
   */
  onDragStart?: () => void
  /**
   * True when the two ends of the range are the same place — a hue wheel.
   * Dragging past either end comes round the other side rather than stopping.
   */
  wrap?: boolean
  /** What the value *means*, spoken instead of the bare number. */
  valueText?: string
  /** Painted across the track: the range you are choosing from, as itself. */
  track: ReactNode
  /** Painted inside the handle: what you have chosen, as itself. */
  handle?: ReactNode
  className?: string
  style?: CSSProperties
}

/**
 * A band you drag, for choices that are genuinely continuous.
 *
 * Not a styled `<input type="range">`, and the reason is the track: the two
 * things this is used for — the palette and the night light — are both ranges
 * whose whole content is a picture of what choosing that position does. A
 * range input's track is one element with no children, so a spectrum has to be
 * faked as a background image on a pseudo-element, and anything richer than a
 * flat gradient is simply not expressible. Here the track is markup.
 *
 * Everything a range input gives you for free is given back deliberately:
 * `role="slider"` with the three value attributes, arrow keys at one step and
 * shift-arrows at ten, Home and End, a focus ring, and a 44px hit area with
 * `touch-action: none` so a horizontal drag on a phone is a drag rather than
 * an argument with the scroller.
 *
 * The travel is inset by half the handle at each end — the same geometry a
 * native range uses — so the handle's *centre* tracks the finger and the
 * handle never hangs off the end of its own bar. The inset is measured from
 * the handle rather than assumed, so the stylesheet stays the one place its
 * size is decided.
 */
export function DragBar({
  label,
  value,
  min,
  max,
  step = 1,
  coarse = 10,
  onChange,
  onCommit,
  onDragStart,
  wrap = false,
  valueText,
  track,
  handle,
  className,
  style,
}: DragBarProps) {
  const barRef = useRef<HTMLDivElement>(null)
  const handleRef = useRef<HTMLSpanElement>(null)
  const [dragging, setDragging] = useState(false)

  const span = max - min
  const ratio = span === 0 ? 0 : (value - min) / span

  const clamp = useCallback(
    (next: number) => {
      if (!wrap) return Math.min(max, Math.max(min, next))
      // One extra step past the top is the bottom again, not the top twice.
      const period = span + step
      return min + ((((next - min) % period) + period) % period)
    },
    [wrap, min, max, span, step],
  )

  const quantise = useCallback(
    (next: number) => clamp(Math.round(next / step) * step),
    [clamp, step],
  )

  const valueAt = useCallback(
    (clientX: number) => {
      const bar = barRef.current
      if (!bar) return value
      const rect = bar.getBoundingClientRect()
      const inset = (handleRef.current?.offsetWidth ?? 0) / 2
      const travel = Math.max(1, rect.width - inset * 2)
      const along = Math.min(1, Math.max(0, (clientX - rect.left - inset) / travel))
      return quantise(min + along * span)
    },
    [min, span, quantise, value],
  )

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button != null && event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    setDragging(true)
    onDragStart?.()
    onChange(valueAt(event.clientX))
  }

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragging) return
    onChange(valueAt(event.clientX))
  }

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragging) return
    setDragging(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    onCommit?.()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const jump = event.shiftKey ? step * coarse : step
    let next: number | null = null

    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        next = quantise(value - jump)
        break
      case 'ArrowRight':
      case 'ArrowUp':
        next = quantise(value + jump)
        break
      case 'PageDown':
        next = quantise(value - step * coarse)
        break
      case 'PageUp':
        next = quantise(value + step * coarse)
        break
      case 'Home':
        next = min
        break
      case 'End':
        next = max
        break
      default:
        return
    }

    event.preventDefault()
    onChange(next)
    onCommit?.()
  }

  return (
    <div
      ref={barRef}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={valueText}
      data-dragging={dragging ? 'true' : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={onKeyDown}
      className={cx('drag-bar', className)}
      style={{ '--at': ratio, ...style } as CSSProperties}
    >
      <span aria-hidden="true" className="drag-bar__track">
        {track}
      </span>
      <span ref={handleRef} aria-hidden="true" className="drag-bar__handle">
        {handle}
      </span>
    </div>
  )
}
