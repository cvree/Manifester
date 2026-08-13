import { useEffect, useRef, useState, type ReactNode } from 'react'
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
import {
  BACKGROUND_MODES,
  LIVING_BACKGROUND_MODES,
} from '../lib/environment'
import { cue, hapticsSupported } from '../lib/feedback'
import { revealSection } from '../lib/scroll'
import { useBreathing } from '../lib/useBreathing'
import type { Preferences } from '../state/PreferencesProvider'
import { BackgroundSceneThumbnail } from './BackgroundScene'
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

type Step = 'room' | 'pattern' | 'form' | 'sound'

const NEXT_STEP: Partial<Record<Step, Step>> = {
  room: 'pattern',
  pattern: 'form',
  form: 'sound',
}

const ADVANCE_DELAY = 420

export function BreathingSettings({
  preferences,
  onChange,
}: BreathingSettingsProps) {
  const { breathPattern: pattern } = preferences
  const activePreset = findPreset(pattern)
  const valid = isPatternValid(pattern)

  const preview = useBreathing({
    pattern,
    active: preferences.breathingEnabled && valid,
  })

  const [auditioning, setAuditioning] = useState<BreathSound | null>(null)

  useEffect(() => () => stopAudition(), [])

  const sections = useRef<Partial<Record<Step, HTMLDivElement | null>>>({})
  const [pending, setPending] = useState<{ step: Step; nonce: number } | null>(
    null,
  )

  const advanceFrom = (step: Step) => {
    const next = NEXT_STEP[step]
    if (!next) return
    setPending((current) => ({ step: next, nonce: (current?.nonce ?? 0) + 1 }))
  }

  useEffect(() => {
    if (!pending) return
    const id = window.setTimeout(
      () => revealSection(sections.current[pending.step] ?? null),
      ADVANCE_DELAY,
    )
    return () => window.clearTimeout(id)
  }, [pending])

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

      <Toggle
        label="Background visualiser"
        description={
          preferences.breathingEnabled
            ? 'Let the whole screen behind the player expand and settle with each breath.'
            : 'The room stays lit and still until the breathing guide is on.'
        }
        checked={preferences.backgroundVisualizer}
        onChange={(backgroundVisualizer) => {
          onChange({ backgroundVisualizer })
          if (backgroundVisualizer) cue('tap')
        }}
      />

      {preferences.backgroundVisualizer && (
        <div>
          <FieldLabel hint="Behind the player">The room</FieldLabel>
          <div
            role="radiogroup"
            aria-label="Background visualiser room"
            className="grid grid-cols-2 gap-2"
          >
            {BACKGROUND_MODES.map((mode) => (
              <RoomTile
                key={mode.id}
                name={mode.name}
                description={mode.description}
                selected={preferences.backgroundMode === mode.id}
                onSelect={() => {
                  onChange({ backgroundMode: mode.id })
                  cue('select')
                  advanceFrom('room')
                }}
              >
                <BackgroundSceneThumbnail mode={mode.id} />
              </RoomTile>
            ))}

            {LIVING_BACKGROUND_MODES.map((mode) => (
              <RoomTile
                key={mode.id}
                name={mode.name}
                description={mode.description}
                selected={preferences.backgroundMode === mode.id}
                onSelect={() => {
                  onChange({ backgroundMode: mode.id })
                  cue('select')
                  advanceFrom('room')
                }}
              >
                <span
                  aria-hidden="true"
                  className="flex h-28 items-center justify-center overflow-hidden rounded-xl bg-[var(--bg-0)]"
                >
                  <span className="scale-[1.7]">
                    <BreathStyleThumbnail style={mode.id} />
                  </span>
                </span>
              </RoomTile>
            ))}

            <RoomTile
              name="Drifting"
              description="The six ambient rooms in turn, crossfading every minute or so. Held still if you have asked for reduced motion."
              selected={preferences.backgroundMode === 'random'}
              onSelect={() => {
                onChange({ backgroundMode: 'random' })
                cue('select')
                advanceFrom('room')
              }}
              className="col-span-2"
            >
              <span className="player-scene-drift" aria-hidden="true">
                {BACKGROUND_MODES.slice(0, 3).map((mode) => (
                  <BackgroundSceneThumbnail key={mode.id} mode={mode.id} />
                ))}
              </span>
            </RoomTile>
          </div>
        </div>
      )}

      {preferences.breathingEnabled && (
        <>
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

          <div
            ref={(node) => {
              sections.current.pattern = node
            }}
          >
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
                              advanceFrom('pattern')
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

          <div
            ref={(node) => {
              sections.current.form = node
            }}
          >
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
                    advanceFrom('form')
                  }}
                />
              ))}
            </div>
          </div>

          <div
            ref={(node) => {
              sections.current.sound = node
            }}
          >
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

function RoomTile({
  name,
  description,
  selected,
  onSelect,
  className,
  children,
}: {
  name: string
  description: string
  selected: boolean
  onSelect: () => void
  className?: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={`${name}. ${description}`}
      onClick={onSelect}
      className={cx(
        'interactive pressable flex flex-col gap-2 rounded-2xl border p-2 text-left',
        'transition-[background-color,border-color] duration-200',
        selected
          ? 'border-[var(--rose)] bg-[var(--rose-soft)]'
          : 'border-[var(--border)] bg-[var(--surface-sunken)] hover:border-[var(--border-strong)]',
        className,
      )}
    >
      {children}
      <span className="px-1 pb-0.5">
        <span className="block text-[0.9rem] font-medium text-ink">{name}</span>
        <span className="mt-0.5 block text-[0.76rem] leading-snug text-ink-muted">
          {description}
        </span>
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
