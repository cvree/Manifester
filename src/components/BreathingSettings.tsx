import {
  BREATH_PRESETS,
  cycleSeconds,
  findPreset,
  isPatternValid,
  PHASE_LIMITS,
  type BreathPattern,
} from '../lib/breathing'
import { cue, hapticsSupported } from '../lib/feedback'
import { cx } from '../lib/cx'
import type { Preferences } from '../state/PreferencesProvider'
import { FieldLabel } from './Card'
import { Slider } from './Slider'
import { Toggle } from './Toggle'

interface BreathingSettingsProps {
  preferences: Preferences
  onChange: (patch: Partial<Preferences>) => void
}

const PHASES: Array<{ key: keyof BreathPattern; label: string }> = [
  { key: 'inhale', label: 'Breathe in' },
  { key: 'holdIn', label: 'Hold' },
  { key: 'exhale', label: 'Breathe out' },
  { key: 'holdOut', label: 'Rest' },
]

export function BreathingSettings({
  preferences,
  onChange,
}: BreathingSettingsProps) {
  const { breathPattern: pattern } = preferences
  const activePreset = findPreset(pattern)
  const valid = isPatternValid(pattern)

  const setPattern = (patch: Partial<BreathPattern>) =>
    onChange({ breathPattern: { ...pattern, ...patch } })

  return (
    <div className="space-y-6">
      <Toggle
        label="Breathing guide"
        description="A glowing orb on the player that expands as you breathe in and settles as you breathe out."
        checked={preferences.breathingEnabled}
        onChange={(breathingEnabled) => {
          onChange({ breathingEnabled })
          if (breathingEnabled) cue('start')
        }}
      />

      {preferences.breathingEnabled && (
        <>
          <div>
            <FieldLabel
              hint={valid ? `${cycleSeconds(pattern)}s per breath` : undefined}
            >
              Pattern
            </FieldLabel>
            <div
              role="radiogroup"
              aria-label="Breathing pattern"
              className="space-y-2"
            >
              {BREATH_PRESETS.map((preset) => {
                const selected = activePreset?.id === preset.id
                return (
                  <button
                    key={preset.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => {
                      setPattern(preset.pattern)
                      cue('tap')
                    }}
                    className={cx(
                      'flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left',
                      'transition-[background-color,border-color] duration-200',
                      selected
                        ? 'border-[var(--rose)] bg-[var(--rose-soft)]'
                        : 'border-[var(--border)] bg-[var(--surface-sunken)] hover:border-[var(--border-strong)]',
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cx(
                        'h-3 w-3 shrink-0 rounded-full border-2',
                        selected
                          ? 'border-[var(--rose-deep)] bg-[var(--rose-deep)]'
                          : 'border-[var(--border-strong)]',
                      )}
                    />
                    <span className="min-w-0">
                      <span className="block text-[0.98rem] font-medium text-ink">
                        {preset.name}
                      </span>
                      <span className="block text-[0.84rem] leading-snug text-ink-muted">
                        {preset.description}
                      </span>
                    </span>
                  </button>
                )
              })}

              <div
                className={cx(
                  'rounded-2xl border px-4 py-3',
                  activePreset
                    ? 'border-[var(--border)] bg-[var(--surface-sunken)]'
                    : 'border-[var(--rose)] bg-[var(--rose-soft)]',
                )}
              >
                <p className="text-[0.98rem] font-medium text-ink">
                  Custom timing
                </p>
                <p className="mt-0.5 mb-3 text-[0.84rem] leading-snug text-ink-muted">
                  Set each part of the breath yourself. A longer out-breath than
                  in-breath is the calming direction.
                </p>

                <div className="space-y-4">
                  {PHASES.map(({ key, label }) => (
                    <Slider
                      key={key}
                      label={label}
                      min={PHASE_LIMITS.min}
                      max={PHASE_LIMITS.max}
                      step={1}
                      value={pattern[key]}
                      display={pattern[key] === 0 ? 'Skip' : `${pattern[key]}s`}
                      onChange={(value) => setPattern({ [key]: value })}
                    />
                  ))}
                </div>

                {!valid && (
                  <p
                    role="alert"
                    className="mt-3 text-[0.85rem] leading-snug text-[var(--rose-deep)]"
                  >
                    A breath needs both an in and an out. Give each of those at
                    least one second.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <Toggle
              label="Sound cue"
              description="A soft tone at each change of phase."
              checked={preferences.breathSoundCues}
              onChange={(breathSoundCues) => {
                onChange({ breathSoundCues })
                if (breathSoundCues) cue('inhale')
              }}
            />

            <Toggle
              label="Gentle vibration"
              description={
                hapticsSupported()
                  ? 'A short buzz at each change of phase.'
                  : 'Not available in this browser. iPhone does not let web apps vibrate.'
              }
              checked={preferences.breathHapticCues && hapticsSupported()}
              disabled={!hapticsSupported()}
              onChange={(breathHapticCues) => {
                onChange({ breathHapticCues })
                if (breathHapticCues) cue('exhale')
              }}
            />
          </div>
        </>
      )}
    </div>
  )
}
