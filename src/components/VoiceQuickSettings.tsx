import { useMemo } from 'react'
import { cx } from '../lib/cx'
import type { LoopSettings } from '../lib/types'
import type { RankedVoice } from '../lib/voiceRanking'
import { Disclosure } from './Disclosure'
import { Slider } from './Slider'

interface VoiceQuickSettingsProps {
  settings: LoopSettings
  voices: RankedVoice[]
  voicesReady: boolean
  /** The voice the current settings actually land on, for the summary line. */
  resolved: RankedVoice | null
  onVoiceChange: (patch: {
    voiceURI: string | null
    voiceName: string | null
    voiceStyle?: LoopSettings['voiceStyle']
  }) => void
  onRateChange: (rate: number) => void
  onPitchChange: (pitch: number) => void
  /** Shown under the controls while a session is running. */
  live?: boolean
  className?: string
}

/** The two answers that are not a particular voice. */
const AUTO = {
  feminine: 'auto:feminine',
  masculine: 'auto:masculine',
} as const

/**
 * Who is reading, and how — folded away under the Levels card on the Player.
 *
 * The full Voice sheet is still where the choice is *made*: two large cards, a
 * live audition, and a paragraph about why the list differs on every device.
 * This is the other half of that need — the one that shows up mid-session,
 * with your eyes half closed, when the voice is a shade too fast or a shade
 * too high and opening a settings sheet over the orb is the wrong answer.
 *
 * So it is three controls, folded shut, stating their current value on the
 * lid. Every one of them is live: `setLiveRate`, `setLivePitch` and
 * `setLiveVoice` update the running speech loop's options rather than
 * restarting it, so a change lands on the next line and the loop never breaks
 * step.
 */
export function VoiceQuickSettings({
  settings,
  voices,
  voicesReady,
  resolved,
  onVoiceChange,
  onRateChange,
  onPitchChange,
  live = false,
  className,
}: VoiceQuickSettingsProps) {
  /*
   * The device's whole list is often forty voices in fifteen languages, and
   * nobody scrolling a dropdown mid-session wants to read past Polish to find
   * Samantha. Anything in the page's language, plus whatever is already
   * chosen, and that is the list.
   */
  const listed = useMemo(() => {
    const tongue = (navigator.language || 'en').slice(0, 2).toLowerCase()
    const near = voices.filter((voice) =>
      voice.lang.toLowerCase().startsWith(tongue),
    )
    const chosen = voices.find((voice) => voice.voiceURI === settings.voiceURI)
    if (chosen && !near.includes(chosen)) return [chosen, ...near]
    return near
  }, [voices, settings.voiceURI])

  const value = settings.voiceURI ?? AUTO[settings.voiceStyle]

  const summary = voicesReady
    ? `${settings.voiceName ?? resolved?.name ?? 'System voice'} · ${settings.rate.toFixed(2)}×`
    : 'Loading voices…'

  return (
    <Disclosure
      title="Voice, speed and pitch"
      summary={summary}
      className={cx('shadow-none', className)}
    >
      <label className="block">
        <span className="mb-1.5 block text-[0.95rem] font-medium text-ink">
          Voice
        </span>
        <select
          value={value}
          onChange={(event) => {
            const next = event.target.value
            if (next === AUTO.feminine || next === AUTO.masculine) {
              onVoiceChange({
                voiceURI: null,
                voiceName: null,
                voiceStyle: next === AUTO.feminine ? 'feminine' : 'masculine',
              })
              return
            }
            const voice = voices.find((item) => item.voiceURI === next)
            onVoiceChange({ voiceURI: next, voiceName: voice?.name ?? null })
          }}
          className="min-h-12 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-sunken)] px-4 text-[1rem] text-ink transition-colors focus:border-[var(--border-strong)]"
        >
          <optgroup label="Chosen for you">
            <option value={AUTO.feminine}>Best feminine voice</option>
            <option value={AUTO.masculine}>Best masculine voice</option>
          </optgroup>
          {listed.length > 0 && (
            <optgroup label="On this device">
              {listed.map((voice) => (
                <option key={voice.voiceURI} value={voice.voiceURI}>
                  {voice.name} · {voice.tierLabel}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </label>

      <Slider
        label="Speed"
        min={0.5}
        max={1.6}
        step={0.05}
        value={settings.rate}
        display={`${settings.rate.toFixed(2)}×`}
        onChange={onRateChange}
      />

      <Slider
        label="Pitch"
        min={0.5}
        max={1.5}
        step={0.05}
        value={settings.pitch}
        display={settings.pitch.toFixed(2)}
        onChange={onPitchChange}
      />

      <p className="type-meta -mt-1">
        {live
          ? 'Each of these takes effect on the next line.'
          : 'Some voices ignore pitch. If nothing changes, that is why.'}
      </p>
    </Disclosure>
  )
}
