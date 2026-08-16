import { useState } from 'react'
import { cx } from '../lib/cx'
import { MAX_VOICE_VOLUME } from '../lib/speech'
import { VOICE_PROFILES, voiceForStyle } from '../lib/tts'
import { useStudioAvailable, useTTSStatus } from '../lib/tts/useTTSStatus'
import type { LoopSettings } from '../lib/types'
import { contentLanguage, voiceSpeaks } from '../lib/voiceLanguage'
import type { RankedVoice, VoiceTier } from '../lib/voiceRanking'
import { BetterVoicesPanel } from './BetterVoicesPanel'
import { FieldLabel } from './Card'
import { StudioVoicePanel } from './StudioVoicePanel'
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
  const status = useTTSStatus()
  const studioAvailable = useStudioAvailable()
  // Chosen *and* available. See `useStudioAvailable`.
  const usingStudio = settings.voiceSource === 'studio' && studioAvailable

  /**
   * What each style card will actually sound like.
   *
   * Two different questions behind one control, and the difference is the
   * whole point of the studio voice. With it, the card names one specific
   * person who sounds the same on every device anybody plays this loop on.
   * Without it, the honest answer is still "whatever this phone happens to
   * have", which is what it always was.
   */
  const describeStyle = (style: 'feminine' | 'masculine') => {
    if (usingStudio) {
      const profile = VOICE_PROFILES[voiceForStyle(style)]
      return {
        name: profile.label,
        detail: profile.description,
        tier: 'neural' as VoiceTier,
        badge: 'Studio',
      }
    }

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
        badge: null,
      }
    }
    return {
      name: best.name,
      detail: best.tierLabel,
      tier: best.tier,
      badge: null,
    }
  }

  const selectStyle = (style: 'feminine' | 'masculine') => {
    // Clear any manual override so the style choice actually takes effect.
    onChange({ voiceStyle: style, voiceURI: null, voiceName: null })
  }

  return (
    <div className="space-y-6">
      <div>
        <FieldLabel
          hint={
            usingStudio
              ? 'Studio voice'
              : voicesReady
                ? `${voices.length} on this device`
                : 'Loading…'
          }
        >
          Voice
        </FieldLabel>

        <div className="grid grid-cols-2 gap-3">
          {(['feminine', 'masculine'] as const).map((style) => {
            const info = describeStyle(style)
            const selected = settings.voiceStyle === style
            const badge = info.badge
              ? { label: info.badge, tone: TIER_BADGE.neural.tone }
              : TIER_BADGE[info.tier]

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
          {usingStudio
            ? 'Studio voices are Manifester’s own, and they sound the same on every phone, tablet and computer. They are free, and clips you have already heard play again with no connection at all.'
            : 'Device voices come from your phone or browser, not from Manifester, so the list differs on every device. Feminine and masculine are a best guess from the voice name — there is no gender field to read.'}
        </p>

        {/*
          The honest sentence about what *this* device can do, which has three
          different answers now rather than two.
        */}
        {settings.voiceSource === 'studio' && !status.unlimited && (
          <p className="mt-2.5 rounded-2xl border border-[var(--border)] bg-[var(--surface-sunken)] p-3 text-[0.82rem] leading-snug text-ink-muted">
            {status.degraded
              ? 'The speech service cannot be reached from here, so this device’s own voice reads anything that did not ship with the app. Lines you have already heard still play in the studio voice.'
              : studioAvailable
                ? 'Manifester ships a library of affirmations already spoken in Ivy and Fen, and those play in the studio voice on any device. Install Studio Voice below and your own words are read in it too.'
                : 'Your device’s own voice is reading. Install Studio Voice below to have Ivy or Fen read every line instead.'}
          </p>
        )}
      </div>

      {/*
        The offer, and the state of it, in the place somebody comes looking for
        it. The same component the first-run screen uses, so an install started
        there and opened here is visibly the same install rather than a second
        one.
      */}
      <StudioVoicePanel />

      {!usingStudio && (
        <BetterVoicesPanel current={resolvedDeviceVoice} voicesReady={voicesReady} />
      )}

      <Disclosure
        title="Choose an exact voice"
        summary={
          usingStudio
            ? `Studio — ${VOICE_PROFILES[voiceForStyle(settings.voiceStyle)].label}`
            : settings.voiceURI
              ? (settings.voiceName ?? 'Custom voice')
              : `This device — ${resolvedDeviceVoice?.name ?? 'system default'}`
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
            value={usingStudio ? 'studio' : (settings.voiceURI ?? '')}
            onChange={(event) => {
              const next = event.target.value
              /*
               * One control, three answers, and the third is the reason it is
               * shaped like this: "the studio voice", "the best voice this
               * device has", and "this exact voice". Picking a device voice is
               * a decision to stop using the studio one — anything else would
               * leave somebody choosing Samantha and still hearing Ivy.
               */
              if (next === 'studio') {
                onChange({ voiceSource: 'studio', voiceURI: null, voiceName: null })
                return
              }
              if (!next) {
                onChange({ voiceSource: 'device', voiceURI: null, voiceName: null })
                return
              }
              const voice = voices.find((item) => item.voiceURI === next)
              onChange({
                voiceSource: 'device',
                voiceURI: next,
                voiceName: voice?.name ?? null,
              })
            }}
            className="min-h-12 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-sunken)] px-4 text-[1rem] text-ink transition-colors focus:border-[var(--border-strong)]"
          >
            <option value="studio">
              Studio — {VOICE_PROFILES[voiceForStyle(settings.voiceStyle)].label}, the
              same everywhere
            </option>
            <option value="">
              This device — best {settings.voiceStyle} voice available
            </option>
            {/*
              Filtered by the language of the *words*, not of the phone's
              menus. `navigator.language` used to decide this, which meant a
              phone set to Chinese hid every English voice installed on it and
              listed a dozen that read English as pinyin. The checkbox above is
              still the way out for anybody writing in another language.
            */}
            {voices
              .filter(
                (voice) => showAllVoices || voiceSpeaks(voice.lang, contentLanguage()),
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

      {/*
        Pitch belongs to device voices alone.

        A studio clip is recorded audio, and the only way to raise its pitch
        after the fact is to play it faster — which is the Speed control, under
        a different name and with a worse result. A slider that silently does
        nothing is worse than one that is not there, so it is not there.
      */}
      {!usingStudio && (
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
      )}

      <Slider
        label="Voice volume"
        min={0}
        max={MAX_VOICE_VOLUME}
        step={0.05}
        value={settings.voiceVolume}
        display={`${Math.round(settings.voiceVolume * 100)}%`}
        hint={
          usingStudio
            ? 'The studio voice plays through Manifester’s own mix, so this balances it against the sound underneath.'
            : 'iOS often locks speech to the system volume. Use your phone’s volume buttons if this slider has no effect.'
        }
        onChange={(voiceVolume) => onChange({ voiceVolume })}
      />

    </div>
  )
}
