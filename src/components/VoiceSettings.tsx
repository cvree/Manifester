import { useState } from 'react'
import { cx } from '../lib/cx'
import { MAX_VOICE_VOLUME } from '../lib/speech'
import type { LoopSettings } from '../lib/types'
import type { RankedVoice, VoiceTier } from '../lib/voiceRanking'
import { BetterVoicesPanel } from './BetterVoicesPanel'
import { FieldLabel } from './Card'
import { Disclosure } from './Disclosure'
import { PlayIcon } from './Icons'
import { Slider } from './Slider'

interface VoiceSettingsProps {
  voices: RankedVoice[]
  voicesReady: boolean
  resolvedDeviceVoice: RankedVoice | null
  settings: LoopSettings
  onChange: (patch: Partial<LoopSettings>) => void
  onPreview: (style?: 'feminine' | 'masculine') => void
  previewState: 'idle' | 'loading' | 'playing'
}

const TIER_BADGE: Record<VoiceTier, { label: string; tone: string }> = {
  neural: { label: 'Neural', tone: 'text-[var(--sage)] border-[var(--sage)]' },
  enhanced: { label: 'Enhanced', tone: 'text-[var(--sage)] border-[var(--sage)]' },
  standard: {
    label: 'Standard',
    tone: 'text-ink-faint border-[var(--border-strong)]',
  },
  basic: { label: 'Basic', tone: 'text-[var(--rose-deep)] border-[var(--rose)]' },
}

export function VoiceSettings({
  voices,
  voicesReady,
  resolvedDeviceVoice,
  settings,
  onChange,
  onPreview,
  previewState,
}: VoiceSettingsProps) {
  const [showAllVoices, setShowAllVoices] = useState(false)

  /** What each style card will actually sound like on this device. */
  const describeStyle = (style: 'feminine' | 'masculine') => {
    const manual = style === settings.voiceStyle && settings.voiceURI
    const best = manual
      ? resolvedDeviceVoice
      : (voices.find((voice) => voice.style === style) ??
        voices.find((voice) => voice.style === 'unlabelled') ??
        voices[0] ??
        null)

    if (!best) {
      return {
        name: 'System voice',
        detail: 'Whatever this device provides.',
        tier: 'standard' as VoiceTier,
      }
    }
    return { name: best.name, detail: best.tierLabel, tier: best.tier }
  }

  const selectStyle = (style: 'feminine' | 'masculine') => {
    // Clear any manual override so the style choice actually takes effect.
    onChange({ voiceStyle: style, voiceURI: null, voiceName: null })
  }

  return (
    <div className="space-y-6">
      <div>
        <FieldLabel hint={voicesReady ? `${voices.length} on this device` : 'Loading…'}>
          Voice
        </FieldLabel>

        <div className="grid grid-cols-2 gap-3">
          {(['feminine', 'masculine'] as const).map((style) => {
            const info = describeStyle(style)
            const selected = settings.voiceStyle === style
            const badge = TIER_BADGE[info.tier]

            return (
              <button
                key={style}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => selectStyle(style)}
                className={cx(
                  'flex min-h-[7.5rem] flex-col items-start gap-1 rounded-[1.25rem] border p-4 text-left',
                  'transition-[background-color,border-color] duration-200 ease-[var(--ease-calm)]',
                  selected
                    ? 'border-[var(--rose)] bg-[var(--rose-soft)]'
                    : 'border-[var(--border)] bg-[var(--surface-sunken)] hover:border-[var(--border-strong)]',
                )}
              >
                <span className="text-[0.76rem] font-medium uppercase tracking-[0.1em] text-ink-faint">
                  {style === 'feminine' ? 'Feminine' : 'Masculine'}
                </span>
                <span className="font-display text-[1.15rem] leading-tight text-ink">
                  {info.name}
                </span>
                <span className="text-[0.8rem] leading-snug text-ink-muted">
                  {info.detail}
                </span>
                <span
                  className={cx(
                    'mt-auto rounded-pill border px-2 py-0.5 text-[0.7rem] font-medium',
                    badge.tone,
                  )}
                >
                  {badge.label}
                </span>
              </button>
            )
          })}
        </div>

        <button
          type="button"
          onClick={() => onPreview()}
          disabled={previewState !== 'idle'}
          className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-pill border border-[var(--border)] px-4 text-[0.92rem] font-medium text-ink-muted transition-colors hover:text-ink disabled:opacity-60"
        >
          <PlayIcon className="text-[0.8rem]" />
          {previewState === 'playing' ? 'Listening…' : 'Hear this voice'}
        </button>

        <p className="mt-2.5 text-[0.82rem] leading-snug text-ink-faint">
          Voices come from your phone or browser, not from Manifester, so the list
          differs on every device. Feminine and masculine are a best guess from the
          voice name — there is no gender field to read.
        </p>
      </div>

      <BetterVoicesPanel current={resolvedDeviceVoice} voicesReady={voicesReady} />

      <Disclosure
        title="Choose an exact voice"
        summary={
          settings.voiceURI
            ? (settings.voiceName ?? 'Custom voice')
            : `Automatic — ${resolvedDeviceVoice?.name ?? 'system default'}`
        }
      >
        <div className="space-y-3">
          <label className="flex items-center gap-3 text-[0.92rem] text-ink-muted">
            <input
              type="checkbox"
              checked={showAllVoices}
              onChange={(event) => setShowAllVoices(event.target.checked)}
              className="h-5 w-5 rounded border-[var(--border-strong)]"
            />
            Show every voice, including other languages
          </label>

          <select
            aria-label="Choose a voice"
            value={settings.voiceURI ?? ''}
            onChange={(event) => {
              const voiceURI = event.target.value || null
              const voice = voices.find((item) => item.voiceURI === voiceURI)
              onChange({ voiceURI, voiceName: voice?.name ?? null })
            }}
            className="min-h-12 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-sunken)] px-4 text-[1rem] text-ink transition-colors focus:border-[var(--border-strong)]"
          >
            <option value="">
              Automatic — best {settings.voiceStyle} voice on this device
            </option>
            {voices
              .filter(
                (voice) =>
                  showAllVoices ||
                  voice.lang
                    .toLowerCase()
                    .startsWith(
                      (navigator.language || 'en').slice(0, 2).toLowerCase(),
                    ),
              )
              .map((voice) => (
                <option key={voice.voiceURI} value={voice.voiceURI}>
                  {voice.name} · {voice.lang} · {TIER_BADGE[voice.tier].label}
                </option>
              ))}
          </select>
        </div>
      </Disclosure>

      <Slider
        label="Speed"
        min={0.5}
        max={1.6}
        step={0.05}
        value={settings.rate}
        display={`${settings.rate.toFixed(2)}×`}
        hint="Slower speech tends to feel calmer."
        onChange={(rate) => onChange({ rate })}
      />

      <Slider
        label="Pitch"
        min={0.5}
        max={1.5}
        step={0.05}
        value={settings.pitch}
        display={settings.pitch.toFixed(2)}
        hint="Some voices ignore pitch. If nothing changes, that is why."
        onChange={(pitch) => onChange({ pitch })}
      />

      <Slider
        label="Voice volume"
        min={0}
        max={MAX_VOICE_VOLUME}
        step={0.05}
        value={settings.voiceVolume}
        display={`${Math.round(settings.voiceVolume * 100)}%`}
        hint="iOS often locks speech to the system volume. Use your phone’s volume buttons if this slider has no effect."
        onChange={(voiceVolume) => onChange({ voiceVolume })}
      />

    </div>
  )
}
