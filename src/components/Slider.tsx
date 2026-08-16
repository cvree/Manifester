import { useId, type CSSProperties } from 'react'
import { cx } from '../lib/cx'

interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  /** Right-aligned readout, e.g. `"70%"` or `"1.0×"`. */
  display?: string
  /** Extra context read by screen readers and shown under the slider. */
  hint?: string
  disabled?: boolean
  /**
   * A taller track and a larger thumb, for controls meant to be dragged
   * one-handed without looking. See the mixer.
   */
  size?: 'md' | 'lg'
  /**
   * Keep the label for screen readers, but let something above carry it
   * visually.
   *
   * Used where a row already names the thing — a mixer layer states its name,
   * its detail and its mute state in the line above the fader, and repeating
   * "Rain on Window level" underneath is noise on a small screen. The readout
   * stays visible, because the current value is exactly what somebody needs to
   * see while dragging.
   */
  hideLabel?: boolean
  className?: string
}

export function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  display,
  hint,
  disabled = false,
  size = 'md',
  hideLabel = false,
  className,
}: SliderProps) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const fill = ((value - min) / (max - min)) * 100

  return (
    <div className={cx('w-full', disabled && 'opacity-50', className)}>
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
        {display && (
          <span className="font-display text-[1rem] tabular-nums text-ink-muted">
            {display}
          </span>
        )}
      </div>
      <input
        id={id}
        type="range"
        className={cx('range-input mt-0.5', size === 'lg' && 'range-input--lg')}
        style={{ '--fill': `${fill}%` } as CSSProperties}
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-describedby={hintId}
        aria-valuetext={display}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      {hint && (
        <p id={hintId} className="-mt-1 text-[0.82rem] leading-snug text-ink-faint">
          {hint}
        </p>
      )}
    </div>
  )
}
