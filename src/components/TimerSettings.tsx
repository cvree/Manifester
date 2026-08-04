import { useEffect, useState } from 'react'
import { TIMER_PRESETS } from '../lib/types'
import { Chip } from './SegmentedControl'
import { TextField } from './TextArea'

interface TimerSettingsProps {
  minutes: number | null
  onChange: (minutes: number | null) => void
}

const PRESET_VALUES = TIMER_PRESETS.map((preset) => preset.minutes)

export function TimerSettings({ minutes, onChange }: TimerSettingsProps) {
  const isPreset = PRESET_VALUES.includes(minutes)
  const [custom, setCustom] = useState(isPreset ? '' : String(minutes ?? ''))
  const [showCustom, setShowCustom] = useState(!isPreset)

  useEffect(() => {
    if (PRESET_VALUES.includes(minutes)) return
    setShowCustom(true)
    setCustom(String(minutes ?? ''))
  }, [minutes])

  const applyCustom = (raw: string) => {
    setCustom(raw)
    const parsed = Number.parseInt(raw, 10)
    if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 480) onChange(parsed)
  }

  return (
    <div>
      <div role="radiogroup" aria-label="Session length" className="flex flex-wrap gap-2">
        {TIMER_PRESETS.map((preset) => (
          <Chip
            key={preset.label}
            selected={!showCustom && minutes === preset.minutes}
            onClick={() => {
              setShowCustom(false)
              setCustom('')
              onChange(preset.minutes)
            }}
          >
            {preset.label}
          </Chip>
        ))}
        <Chip
          selected={showCustom}
          onClick={() => {
            setShowCustom(true)
            if (!custom) setCustom('45')
            onChange(Number.parseInt(custom || '45', 10))
          }}
        >
          Custom
        </Chip>
      </div>

      {showCustom && (
        <div className="mt-3 flex items-center gap-3">
          <TextField
            inputMode="numeric"
            pattern="[0-9]*"
            aria-label="Custom session length in minutes"
            value={custom}
            onChange={(event) => applyCustom(event.target.value.replace(/\D/g, ''))}
            className="max-w-28 text-center"
            placeholder="45"
          />
          <span className="text-[0.95rem] text-ink-muted">minutes (1–480)</span>
        </div>
      )}

      <p className="mt-3 text-[0.85rem] leading-snug text-ink-faint">
        {minutes == null
          ? 'The loop will keep going until you end the session.'
          : `The voice and sound fade out after ${minutes} minutes.`}
      </p>
    </div>
  )
}
