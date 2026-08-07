import { useEffect, useState } from 'react'
import {
  auditionBreathVoice,
  BREATH_VOICES,
  MAX_BREATH_VOLUME,
  stopAudition,
  type BreathSound,
} from '../lib/breathAudio'
import {
  BREATH_PRESETS,
  BREATH_STYLES,
  breathsPerMinute,
  cycleSeconds,
  describePattern,
  findPreset,
  formatSeconds,
  isPatternValid,
  MOOD_LABEL,
  MOOD_ORDER,
  PHASE_LIMITS,
  type BreathPattern,
  type BreathStyleId,
} from '../lib/breathing'
import { cx } from '../lib/cx'
import { cue, hapticsSupported } from '../lib/feedback'
import { useBreathing } from '../lib/useBreathing'
import type { Preferences } from '../state/PreferencesProvider'
import {
  BreathingVisualizer,
  BreathStyleThumbnail,
} from './BreathingVisualizer'
import { FieldLabel } from './Card'
import { Disclosure } from './Disclosure'
import { PlayIcon, WaveIcon } from './Icons'
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

/**
 * Everything about the guide, in the order it matters: is it on, what shape
 * is the breath, what does it look like, what does it sound like.
 *
 * The panel breathes while you are in it. Choosing a form or a voice without
 * seeing and hearing the result is choosing from a list of words, so the
 * picker at the top is a live guide and every voice has an audition button.
 */
export function BreathingSettings({
  preferences,
  onChange,
}: BreathingSettingsProps) {
  const { breathPattern: pattern } = preferences
  const activePreset = findPreset(pattern)
  const valid = isPatternValid(pattern)

  // A silent, purely visual guide: this one is a picture of the choice.
  const preview = useBreathing({
    pattern,
    active: preferences.breathingEnabled && valid,
    sound: 'off',
    soundVolume: 0,
    hapticCues: false,
  })

  const [auditioning, setAuditioning] = useState<BreathSound | null>(null)

  // Never leave a voice ringing behind a closed sheet.
  useEffect(() => () => stopAudition(), [])

  const setPattern = (patch: Partial<BreathPattern>) =>
    onChange({ breathPattern: { ...pattern, ...patch } })

  const play = (voice: BreathSound, volume = preferences.breathSoundVolume) => {
    if (voice === 'off') {
      stopAudition()
      setAuditioning(null)
      return
    }
    auditionBreathVoice(voice, volume)
    setAuditioning(voice)
    window.setTimeout(() => setAuditioning(null), 7000)
  }

  return (
    <div className="space-y-7">
      <Toggle
        label="Breathing guide"
        description="A guide on the player that expands as you breathe in and settles as you breathe out."
        checked={preferences.breathingEnabled}
        onChange={(breathingEnabled) => {
          onChange({ breathingEnabled })
          if (breathingEnabled) cue('start')
        }}
      />

      {preferences.breathingEnabled && (
        <>
          {/* ── The live picture of every choice below ── */}
          <div className="flex flex-col items-center rounded-[1.5rem] border border-[var(--quiet-border)] bg-[var(--quiet)] py-5">
            <BreathingVisualizer
              runtime={preview}
              style={preferences.breathStyle}
              size="sm"
            />
            <p className="type-meta mt-4 text-center">
              {valid
                ? `${describePattern(pattern)} · about ${breathsPerMinute(pattern).toFixed(1)} breaths a minute`
                : 'Give the breath both an in and an out.'}
            </p>
          </div>

          {/* ── Pattern ── */}
          <div>
            <FieldLabel
              hint={valid ? `${formatSeconds(cycleSeconds(pattern))}s per breath` : undefined}
            >
              Pattern
            </FieldLabel>

            <div role="radiogroup" aria-label="Breathing pattern" className="space-y-4">
              {MOOD_ORDER.map((mood) => {
                const presets = BREATH_PRESETS.filter(
                  (preset) => preset.mood === mood,
                )
                if (presets.length === 0) return null
                return (
                  <div key={mood}>
                    <p className="type-meta mb-2 font-semibold tracking-[0.08em] uppercase">
                      {MOOD_LABEL[mood]}
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {presets.map((preset) => {
                        const selected = activePreset?.id === preset.id
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            onClick={() => {
                              setPattern(preset.pattern)
                              cue('select')
                            }}
                            className={cx(
                              'interactive pressable flex min-h-[3.5rem] flex-col justify-center rounded-2xl border px-3.5 py-2.5 text-left',
                              'transition-[background-color,border-color] duration-200',
                              selected
                                ? 'border-[var(--rose)] bg-[var(--rose-soft)]'
                                : 'border-[var(--border)] bg-[var(--surface-sunken)] hover:border-[var(--border-strong)]',
                            )}
                          >
                            <span className="flex items-baseline gap-2">
                              <span className="text-[0.95rem] font-medium text-ink">
                                {preset.name}
                              </span>
                              <span className="type-numeral text-[0.78rem] text-ink-faint">
                                {formatSeconds(preset.pattern.inhale)}·
                                {preset.pattern.holdIn > 0 &&
                                  `${formatSeconds(preset.pattern.holdIn)}·`}
                                {formatSeconds(preset.pattern.exhale)}
                                {preset.pattern.holdOut > 0 &&
                                  `·${formatSeconds(preset.pattern.holdOut)}`}
                              </span>
                            </span>
                            <span className="mt-0.5 block text-[0.8rem] leading-snug text-ink-muted">
                              {preset.description}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>

            <Disclosure
              className="mt-4"
              title="Custom timing"
              summary={
                activePreset
                  ? 'Set each part of the breath yourself'
                  : describePattern(pattern)
              }
              defaultOpen={!activePreset}
            >
              <p className="type-meta -mt-1">
                A longer out-breath than in-breath is the calming direction.
                Set a part to zero to skip it.
              </p>
              {PHASES.map(({ key, label }) => (
                <Slider
                  key={key}
                  label={label}
                  min={PHASE_LIMITS.min}
                  max={PHASE_LIMITS.max}
                  step={PHASE_LIMITS.step}
                  value={pattern[key]}
                  display={
                    pattern[key] === 0 ? 'Skip' : `${formatSeconds(pattern[key])}s`
                  }
                  onChange={(value) => setPattern({ [key]: value })}
                />
              ))}
              {!valid && (
                <p
                  role="alert"
                  className="text-[0.85rem] leading-snug text-[var(--rose-deep)]"
                >
                  A breath needs both an in and an out. Give each of those at
                  least half a second.
                </p>
              )}
            </Disclosure>
          </div>

          {/* ── Form ── */}
          <div>
            <FieldLabel hint="Shown above">Form</FieldLabel>
            <div
              role="radiogroup"
              aria-label="Breathing guide form"
              className="grid grid-cols-2 gap-2"
            >
              {BREATH_STYLES.map((style) => (
                <StyleTile
                  key={style.id}
                  id={style.id}
                  name={style.name}
                  description={style.description}
                  selected={preferences.breathStyle === style.id}
                  onSelect={() => {
                    onChange({ breathStyle: style.id })
                    cue('select')
                  }}
                />
              ))}
            </div>
          </div>

          {/* ── Sound ── */}
          <div>
            <FieldLabel hint="Follow it with your eyes closed">
              Breath sound
            </FieldLabel>
            <p className="type-meta -mt-1 mb-3">
              The guide can say the breath out loud: rising as you fill,
              falling as you empty, still through a hold. Press one to hear it.
            </p>

            <div
              role="radiogroup"
              aria-label="Breath sound"
              className="space-y-2"
            >
              <VoiceRow
                selected={preferences.breathSound === 'off'}
                name="Silent"
                description="The guide is watched, not heard."
                onSelect={() => {
                  onChange({ breathSound: 'off' })
                  play('off')
                  cue('select')
                }}
              />
              {BREATH_VOICES.map((voice) => (
                <VoiceRow
                  key={voice.id}
                  selected={preferences.breathSound === voice.id}
                  name={voice.name}
                  description={voice.description}
                  badge={voice.sustained ? 'Continuous' : 'At each turn'}
                  playing={auditioning === voice.id}
                  onSelect={() => {
                    onChange({ breathSound: voice.id })
                    play(voice.id)
                  }}
                  onAudition={() => play(voice.id)}
                />
              ))}
            </div>

            {preferences.breathSound !== 'off' && (
              <div className="mt-5">
                <Slider
                  label="Breath sound level"
                  min={0}
                  max={MAX_BREATH_VOLUME}
                  step={0.05}
                  value={preferences.breathSoundVolume}
                  display={`${Math.round(
                    (preferences.breathSoundVolume / MAX_BREATH_VOLUME) * 100,
                  )}%`}
                  hint="Independent of the loop's own voice and sound levels."
                  onChange={(breathSoundVolume) => {
                    onChange({ breathSoundVolume })
                  }}
                />
              </div>
            )}
          </div>

          {/* ── Touch ── */}
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
              if (breathHapticCues) cue('tap')
            }}
          />
        </>
      )}
    </div>
  )
}

/**
 * A form's own name and a thumbnail of the shape it makes.
 *
 * The thumbnail is the same markup the real guide uses, frozen at a
 * comfortable half-open pose — so what you are choosing between is six
 * pictures rather than six adjectives.
 */
function StyleTile({
  id,
  name,
  description,
  selected,
  onSelect,
}: {
  id: BreathStyleId
  name: string
  description: string
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={`${name}. ${description}`}
      onClick={onSelect}
      className={cx(
        'interactive pressable flex flex-col items-center gap-2 rounded-2xl border px-3 py-3.5 text-center',
        'transition-[background-color,border-color] duration-200',
        selected
          ? 'border-[var(--rose)] bg-[var(--rose-soft)]'
          : 'border-[var(--border)] bg-[var(--surface-sunken)] hover:border-[var(--border-strong)]',
      )}
    >
      <BreathStyleThumbnail style={id} />
      <span className="block text-[0.9rem] font-medium text-ink">{name}</span>
      <span className="block text-[0.76rem] leading-snug text-ink-muted">
        {description}
      </span>
    </button>
  )
}

function VoiceRow({
  selected,
  name,
  description,
  badge,
  playing = false,
  onSelect,
  onAudition,
}: {
  selected: boolean
  name: string
  description: string
  badge?: string
  playing?: boolean
  onSelect: () => void
  onAudition?: () => void
}) {
  return (
    <div
      className={cx(
        'flex items-center gap-2 rounded-2xl border pr-2 transition-[background-color,border-color] duration-200',
        selected
          ? 'border-[var(--rose)] bg-[var(--rose-soft)]'
          : 'border-[var(--border)] bg-[var(--surface-sunken)]',
      )}
    >
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        onClick={onSelect}
        className="interactive flex min-w-0 grow items-center gap-3 rounded-2xl px-4 py-3 text-left"
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
          <span className="flex items-baseline gap-2">
            <span className="text-[0.95rem] font-medium text-ink">{name}</span>
            {badge && (
              <span className="text-[0.7rem] tracking-[0.06em] text-ink-faint uppercase">
                {badge}
              </span>
            )}
          </span>
          <span className="block text-[0.8rem] leading-snug text-ink-muted">
            {description}
          </span>
        </span>
      </button>

      {onAudition && (
        <button
          type="button"
          onClick={onAudition}
          aria-label={`Hear ${name}`}
          className={cx(
            'interactive flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[1rem]',
            playing
              ? 'bg-[var(--rose-deep)] text-[var(--bg-0)]'
              : 'text-ink-muted hover:bg-[var(--quiet)] hover:text-ink',
          )}
        >
          {playing ? <WaveIcon /> : <PlayIcon />}
        </button>
      )}
    </div>
  )
}
