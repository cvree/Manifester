import { useEffect, useState } from 'react'
import { Slider } from './Slider'
import { TextField } from './TextArea'

interface DelaySettingsProps {
  seconds: number
  onChange: (seconds: number) => void
}

export const DELAY_MIN = 0
export const DELAY_MAX = 60

/**
 * The quiet space between repetitions.
 *
 * A slider for feel and a number field for precision — on a phone the slider is
 * what people reach for, but typing "45" is faster than dragging to it.
 */
export function DelaySettings({ seconds, onChange }: DelaySettingsProps) {
  const [text, setText] = useState(String(seconds))

  // Keep the field in step when the slider (or a loaded loop) moves the value.
  useEffect(() => setText(String(seconds)), [seconds])

  const commitText = (raw: string) => {
    setText(raw)
    if (raw === '') return
    const parsed = Number.parseInt(raw, 10)
    if (!Number.isFinite(parsed)) return
    onChange(Math.min(DELAY_MAX, Math.max(DELAY_MIN, parsed)))
  }

  return (
    <div>
      <Slider
        label="Delay between loops"
        min={DELAY_MIN}
        max={DELAY_MAX}
        step={1}
        value={seconds}
        display={seconds === 0 ? 'None' : `${seconds}s`}
        onChange={onChange}
      />

      <div className="mt-1 flex items-center gap-3">
        <TextField
          inputMode="numeric"
          pattern="[0-9]*"
          aria-label="Delay between loops in seconds"
          value={text}
          onChange={(event) => commitText(event.target.value.replace(/\D/g, ''))}
          onBlur={() => setText(String(seconds))}
          className="max-w-24 text-center"
        />
        <span className="text-[0.9rem] text-ink-muted">
          seconds (0–{DELAY_MAX})
        </span>
      </div>

      <p className="mt-2.5 text-[0.85rem] leading-snug text-ink-faint">
        {seconds === 0
          ? 'Your words begin again immediately.'
          : `A ${seconds} second rest before your words begin again. The player counts it down.`}
      </p>
    </div>
  )
}
