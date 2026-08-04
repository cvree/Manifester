import { useMemo, useState } from 'react'
import { cx } from '../lib/cx'
import type { VoiceOption } from '../lib/speech'
import type { LoopSettings } from '../lib/types'
import { FieldLabel } from './Card'
import { Chip } from './SegmentedControl'
import { Slider } from './Slider'

interface VoiceSettingsProps {
  voices: VoiceOption[]
  voicesReady: boolean
  settings: LoopSettings
  onChange: (patch: Partial<LoopSettings>) => void
  /** Speak a short sample with the current settings. */
  onPreview?: () => void
  previewing?: boolean
}

type StyleFilter = 'all' | 'feminine' | 'masculine'

const STYLE_LABEL: Record<VoiceOption['style'], string> = {
  feminine: 'Likely feminine',
  masculine: 'Likely masculine',
  unlabelled: 'Unlabelled',
}

export function VoiceSettings({
  voices,
  voicesReady,
  settings,
  onChange,
  onPreview,
  previewing = false,
}: VoiceSettingsProps) {
  const [filter, setFilter] = useState<StyleFilter>('all')

  // Voices matching the page language first — those are the ones that will
  // actually sound right for English affirmation text.
  const sorted = useMemo(() => {
    const language = (navigator.language || 'en').slice(0, 2).toLowerCase()
    return [...voices].sort((a, b) => {
      const aMatch = a.lang.toLowerCase().startsWith(language) ? 0 : 1
      const bMatch = b.lang.toLowerCase().startsWith(language) ? 0 : 1
      if (aMatch !== bMatch) return aMatch - bMatch
      if (a.localService !== b.localService) return a.localService ? -1 : 1
      return a.name.localeCompare(b.name)
    })
  }, [voices])

  const filtered = useMemo(
    () => (filter === 'all' ? sorted : sorted.filter((v) => v.style === filter)),
    [sorted, filter],
  )

  const hasStyle = (style: StyleFilter) =>
    style === 'all' || sorted.some((voice) => voice.style === style)

  return (
    <div className="space-y-6">
      <div>
        <FieldLabel hint={voicesReady ? `${voices.length} available` : 'Loading…'}>
          Voice
        </FieldLabel>

        {voices.length > 1 && (
          <div
            role="radiogroup"
            aria-label="Filter voices by style"
            className="mb-3 flex flex-wrap gap-2"
          >
            {(['all', 'feminine', 'masculine'] as const)
              .filter(hasStyle)
              .map((option) => (
                <Chip
                  key={option}
                  selected={filter === option}
                  onClick={() => setFilter(option)}
                >
                  {option === 'all'
                    ? 'All voices'
                    : option === 'feminine'
                      ? 'Feminine'
                      : 'Masculine'}
                </Chip>
              ))}
          </div>
        )}

        {voicesReady && voices.length === 0 ? (
          <p className="rounded-2xl border border-[var(--border)] bg-[var(--surface-sunken)] px-4 py-3 text-[0.9rem] leading-relaxed text-ink-muted">
            No voices were offered by this browser. Manifester will still use the
            system default when you press play.
          </p>
        ) : (
          <select
            aria-label="Choose a voice"
            value={settings.voiceURI ?? ''}
            onChange={(event) => {
              const voiceURI = event.target.value || null
              const voice = voices.find((item) => item.voiceURI === voiceURI)
              onChange({ voiceURI, voiceName: voice?.name ?? null })
            }}
            className={cx(
              'min-h-12 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-sunken)] px-4',
              'text-[1rem] text-ink transition-colors focus:border-[var(--border-strong)]',
            )}
          >
            <option value="">System default voice</option>
            {filtered.map((voice) => (
              <option key={voice.voiceURI} value={voice.voiceURI}>
                {voice.name} · {voice.lang}
                {voice.style !== 'unlabelled' ? ` · ${STYLE_LABEL[voice.style]}` : ''}
              </option>
            ))}
          </select>
        )}

        <p className="mt-2 text-[0.82rem] leading-snug text-ink-faint">
          Voices come from your phone or browser, not from Manifester, so the list
          differs on every device. Style labels are a best guess from the voice
          name.
        </p>

        {onPreview && (
          <button
            type="button"
            onClick={onPreview}
            className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-pill border border-[var(--border)] px-4 text-[0.92rem] font-medium text-ink-muted transition-colors hover:text-ink"
          >
            {previewing ? 'Listening…' : 'Hear this voice'}
          </button>
        )}
      </div>

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
        max={1}
        step={0.05}
        value={settings.voiceVolume}
        display={`${Math.round(settings.voiceVolume * 100)}%`}
        hint="iOS often locks speech to the system volume. Use your phone's volume buttons if this slider has no effect."
        onChange={(voiceVolume) => onChange({ voiceVolume })}
      />

      <Slider
        label="Pause between repeats"
        min={0}
        max={20}
        step={1}
        value={settings.repeatPauseSeconds}
        display={
          settings.repeatPauseSeconds === 0
            ? 'None'
            : `${settings.repeatPauseSeconds}s`
        }
        hint="Quiet space before the text begins again."
        onChange={(repeatPauseSeconds) => onChange({ repeatPauseSeconds })}
      />
    </div>
  )
}
