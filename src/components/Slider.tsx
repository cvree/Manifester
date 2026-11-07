import {
  startTransition,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { cx } from '../lib/cx'

interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  /**
   * Called urgently with every value under the thumb, before `onChange` is
   * handed to its transition — for a readout drawn outside the slider.
   */
  onLive?: (value: number) => void
  /**
   * Right-aligned readout, e.g. `"70%"` or `"1.0×"`.
   *
   * Either a string, or a function of the value under the thumb — the function
   * form keeps the number in step with the finger even while the stored value
   * is still catching up behind a transition.
   */
  display?: string | ((value: number) => string)
  /** Extra context read by screen readers and shown under the slider. */
  hint?: string
  disabled?: boolean
  /**
   * A taller track and a larger thumb, for controls meant to be dragged
   * one-handed without looking. See the volume panel.
   */
  size?: 'md' | 'lg'
  /**
   * Keep the label for screen readers, but let something above carry it
   * visually.
   */
  hideLabel?: boolean
  /** Hide the readout row entirely, for rows that print the value themselves. */
  bare?: boolean
  className?: string
}

/**
 * A range input whose thumb never waits for the app.
 *
 * ── Why it keeps its own copy of the value ──
 *
 * A level lives in a provider that most of the screen reads, so a fully
 * controlled slider moved only as fast as the whole tree could re-render — on
 * a phone that is a thumb visibly trailing the finger. The thumb now follows a
 * local value in an urgent render, and `onChange` is called inside a
 * transition: its *side effects* (a gain ramp, a speech volume) still happen
 * synchronously in the input event, so the sound moves with the finger, while
 * the re-render of everything else is deferred and interruptible.
 *
 * The stored value is re-adopted whenever it changes from the outside — a mute
 * button, a preset — and ignored while a drag is still sending values of its
 * own, so a transition committing an older value cannot pull the thumb back.
 */
export function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  onLive,
  display,
  hint,
  disabled = false,
  size = 'md',
  hideLabel = false,
  bare = false,
  className,
}: SliderProps) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined

  const [local, setLocal] = useState(value)
  /** The last value this slider sent and has not yet seen come back. */
  const pending = useRef<number | null>(null)
  const settle = useRef<number | null>(null)
  const latest = useRef(value)
  latest.current = value

  useEffect(() => {
    if (pending.current != null && value !== pending.current) return
    pending.current = null
    setLocal(value)
  }, [value])

  useEffect(
    () => () => {
      if (settle.current != null) window.clearTimeout(settle.current)
    },
    [],
  )

  const send = (next: number) => {
    setLocal(next)
    onLive?.(next)
    pending.current = next
    /*
     * If the stored value never lands exactly where the thumb is (a clamp, a
     * rounding), stop waiting for it shortly after the last movement and adopt
     * whatever it settled on.
     */
    if (settle.current != null) window.clearTimeout(settle.current)
    settle.current = window.setTimeout(() => {
      settle.current = null
      if (pending.current == null) return
      pending.current = null
      setLocal(latest.current)
    }, 600)
    startTransition(() => onChange(next))
  }

  const fill = ((local - min) / (max - min)) * 100
  const readout = typeof display === 'function' ? display(local) : display

  return (
    <div className={cx('w-full', disabled && 'opacity-50', className)}>
      {!bare && (
        <div
          className={cx(
            'flex items-baseline gap-3',
            hideLabel ? 'justify-end' : 'justify-between',
          )}
        >
          <label
            htmlFor={id}
            className={cx(
              'text-[0.95rem] font-medium text-ink',
              hideLabel && 'sr-only',
            )}
          >
            {label}
          </label>
          {readout && (
            <span className="font-display text-[1rem] tabular-nums text-ink-muted">
              {readout}
            </span>
          )}
        </div>
      )}
      <input
        id={id}
        type="range"
        className={cx(
          'range-input',
          !bare && 'mt-0.5',
          size === 'lg' && 'range-input--lg',
        )}
        style={{ '--fill': `${fill}%` } as CSSProperties}
        min={min}
        max={max}
        step={step}
        value={local}
        disabled={disabled}
        aria-label={bare ? label : undefined}
        aria-describedby={hintId}
        aria-valuetext={readout}
        onChange={(event) => send(Number(event.target.value))}
      />
      {hint && (
        <p id={hintId} className="-mt-1 text-[0.82rem] leading-snug text-ink-faint">
          {hint}
        </p>
      )}
    </div>
  )
}
