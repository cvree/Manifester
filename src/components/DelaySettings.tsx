import { useEffect, useState } from 'react'
import { cue } from '../lib/feedback'
import { Chip } from './SegmentedControl'
import { Slider } from './Slider'
import { TextField } from './TextArea'

interface DelaySettingsProps {
  seconds: number
  onChange: (seconds: number) => void
}

export const DELAY_MIN = 0
export const DELAY_MAX = 60

/** The four lengths people actually reach for. */
const PRESETS: Array<{ label: string; seconds: number }> = [
  { label: 'No delay', seconds: 0 },
  { label: '3 sec', seconds: 3 },
  { label: '5 sec', seconds: 5 },
  { label: '10 sec', seconds: 10 },
]

/**
 * The quiet space between repetitions.
 *
 * Presets first, because four taps cover almost everyone. The slider is for
 * feel, and the number field is for the person who knows they want 45 —
 * dragging to that is slower than typing it.
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

  const isPreset = PRESETS.some((preset) => preset.seconds === seconds)

  return (
    <div className="space-y-5">
      <div role="radiogroup" aria-label="Delay between loops" className="flex flex-wrap gap-2">
        {PRESETS.map((preset) => (
          <Chip
            key={preset.label}
            selected={seconds === preset.seconds}
            onClick={() => {
              cue('select')
              onChange(preset.seconds)
            }}
          >
            {preset.label}
          </Chip>
        ))}
        <Chip selected={!isPreset} onClick={() => onChange(seconds === 20 ? 15 : 20)}>
          Custom
        </Chip>
      </div>

      <Slider
        label="Exact length"
        min={DELAY_MIN}
        max={DELAY_MAX}
        step={1}
        value={seconds}
        display={seconds === 0 ? 'None' : `${seconds}s`}
        onChange={onChange}
      />

      <div className="flex items-center gap-3">
        <TextField
          inputMode="numeric"
          pattern="[0-9]*"
          aria-label="Delay between loops in seconds"
          value={text}
          onChange={(event) => commitText(event.target.value.replace(/\D/g, ''))}
          onBlur={() => setText(String(seconds))}
          className="max-w-24 text-center"
        />
        <span className="type-meta">seconds (0–{DELAY_MAX})</span>
      </div>

      <p className="type-meta">
        {seconds === 0
          ? 'Your words begin again immediately.'
          : `A ${seconds} second rest before your words begin again. The player counts it down, and pausing holds the count where it is.`}
      </p>
    </div>
  )
}
