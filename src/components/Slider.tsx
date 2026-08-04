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
  className,
}: SliderProps) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const fill = ((value - min) / (max - min)) * 100

  return (
    <div className={cx('w-full', disabled && 'opacity-50', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label
          htmlFor={id}
          className="text-[0.95rem] font-medium text-ink"
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
        className="range-input mt-0.5"
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
