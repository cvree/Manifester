import { useMemo } from 'react'
import { cx } from '../lib/cx'
import { STUDIO_PITCH, VOICE_PROFILES, clampStudioPitch, voiceForStyle } from '../lib/tts'
import { useStudioAvailable, useTTSStatus } from '../lib/tts/useTTSStatus'
import type { LoopSettings } from '../lib/types'
import { contentLanguage } from '../lib/voiceLanguage'
import { voicesInLanguage, type RankedVoice } from '../lib/voiceRanking'
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
    voiceSource?: LoopSettings['voiceSource']
  }) => void
  onRateChange: (rate: number) => void
  onPitchChange: (pitch: number) => void
  /** Shown under the controls while a session is running. */
  live?: boolean
  className?: string
}

/** The four answers that are not one particular device voice. */
const AUTO = {
  feminine: 'auto:feminine',
  masculine: 'auto:masculine',
} as const

const STUDIO = {
  feminine: 'studio:feminine',
  masculine: 'studio:masculine',
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
 * lid. Every one of them is live, and live here means *now* — though the three
 * get there by different routes, because a rendered clip can be bent in some
 * ways and not others:
 *
 *   · **Speed** lands on the words already in the speakers. The clip is
 *     resampled, so the new tempo arrives within a tenth of a second and
 *     nothing stops to fetch anything.
 *   · **Pitch** and **Voice** cannot be bent mid-word, so the line is taken
 *     back to its first word and read again — but only once the replacement
 *     audio is in hand, so the old reading covers the wait instead of silence
 *     covering it.
 *
 * Either way the place in the affirmation and the pass count are kept: a line
 * is restarted, never the ritual. See `VoiceLooper.updateOptions`.
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
   * Samantha. The voices that can read these words, plus whatever is already
   * chosen, and that is the list.
   *
   * "Can read these words" used to mean `navigator.language`, which is a fact
   * about somebody's menus rather than about their affirmations — so on a phone
   * set to Chinese this list hid every English voice on the device and offered
   * a dozen that would read English as pinyin. It is the content's language
   * now. See `voiceLanguage.ts`.
   */
  const listed = useMemo(() => {
    const near = voicesInLanguage(voices, contentLanguage())
    const chosen = voices.find((voice) => voice.voiceURI === settings.voiceURI)
    if (chosen && !near.includes(chosen)) return [chosen, ...near]
    return near
  }, [voices, settings.voiceURI])

  const studioAvailable = useStudioAvailable()
  const { synthesises } = useTTSStatus()
  const usingStudio = settings.voiceSource === 'studio' && studioAvailable
  // A device voice may have been left anywhere in its wider range; a studio
  // one has a narrower one, so the control shows where the value will land.
  const pitch = usingStudio ? clampStudioPitch(settings.pitch) : settings.pitch
  const studioName = VOICE_PROFILES[voiceForStyle(settings.voiceStyle)].label

  const value = usingStudio
    ? STUDIO[settings.voiceStyle]
    : (settings.voiceURI ?? AUTO[settings.voiceStyle])

  const summary = usingStudio
    ? `${studioName} · ${settings.rate.toFixed(2)}×`
    : voicesReady
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
            if (next === STUDIO.feminine || next === STUDIO.masculine) {
              onVoiceChange({
                voiceURI: null,
                voiceName: null,
                voiceSource: 'studio',
                voiceStyle: next === STUDIO.feminine ? 'feminine' : 'masculine',
              })
              return
            }
            if (next === AUTO.feminine || next === AUTO.masculine) {
              onVoiceChange({
                voiceURI: null,
                voiceName: null,
                voiceSource: 'device',
                voiceStyle: next === AUTO.feminine ? 'feminine' : 'masculine',
              })
              return
            }
            const voice = voices.find((item) => item.voiceURI === next)
            onVoiceChange({
              voiceURI: next,
              voiceName: voice?.name ?? null,
              voiceSource: 'device',
            })
          }}
          className="min-h-12 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-sunken)] px-4 text-[1rem] text-ink transition-colors focus:border-[var(--border-strong)]"
        >
          <optgroup label="Studio — the same on every device">
            <option value={STUDIO.feminine}>
              {VOICE_PROFILES.female_1.label} · feminine
            </option>
            <option value={STUDIO.masculine}>
              {VOICE_PROFILES.male_1.label} · masculine
            </option>
          </optgroup>
          <optgroup label="Chosen for you, on this device">
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

      {/*
        Pitch, on both kinds of voice now. The studio one gets it by being
        rendered at a compensating speed and played back faster or slower, so
        it moves the voice without hurrying it — which needs something able to
        render, hence the second condition. See `tts/shape.ts`.
      */}
      {(!usingStudio || synthesises) && (
        <Slider
          label="Pitch"
          min={usingStudio ? STUDIO_PITCH.min : 0.5}
          max={usingStudio ? STUDIO_PITCH.max : 1.5}
          step={0.05}
          value={pitch}
          display={pitch.toFixed(2)}
          onChange={onPitchChange}
        />
      )}

      <p className="type-meta -mt-1">
        {live
          ? 'Speed lands on the words you are hearing. Voice and pitch take the line back to its first word and read it again.'
          : usingStudio
            ? 'Studio voices sound the same on every device. Pitch moves one without changing its pace.'
            : 'Some voices ignore pitch. If nothing changes, that is why.'}
      </p>
    </Disclosure>
  )
}
