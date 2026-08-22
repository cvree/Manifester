import { MAX_MUSIC_VOLUME } from '../lib/audioBus'
import { cue } from '../lib/feedback'
import { MAX_VOICE_VOLUME } from '../lib/speech'
import { describeMix, mixerLayers } from '../lib/soundMixer'
import {
  brainwaveSummary,
  breathingSummary,
  soundSummary,
} from '../lib/summaries'
import { useLibrary } from '../state/LibraryProvider'
import { usePreferences } from '../state/PreferencesProvider'
import { useSession } from '../state/SessionProvider'
import { Button } from './Button'
import type { PanelKey } from './CustomizePanel'
import { BreathIcon, MixerIcon, MuteIcon, PulseIcon, WaveIcon } from './Icons'
import { SettingRow } from './SettingRow'
import { Slider } from './Slider'
import { VoiceQuickSettings } from './VoiceQuickSettings'

interface PlayerControlsProps {
  /**
   * Hand over to one of the detail sheets.
   *
   * One sheet at a time, always. A sheet opening on top of a sheet is two
   * scrims, two focus traps and two ways out, and the way back it buys you is
   * a way back to a list you were only passing through.
   */
  onOpenPanel: (key: PanelKey) => void
  onEditWords: () => void
  /** The mixer is not a settings panel; it has its own sheet. */
  onOpenMixer: () => void
}

/**
 * Everything you might want to change while you are listening.
 *
 * There is one of these and two places it appears: the Adjust sheet on a
 * phone, and the column beside the stage on a wide desktop. It used to be two
 * components with the same four rows, the same two faders and the same button
 * typed out twice, which is how the desktop column quietly ended up without
 * the voice controls the sheet had — a difference nobody chose. Whatever this
 * renders, both sizes of screen now get.
 *
 * The order is the order things are wanted: the two live faders first, because
 * volume is what people actually reach for; who is reading and how fast, folded
 * shut and stating its value on the lid; the four things with sheets of their
 * own; and the way back to the words.
 *
 * Every control here takes effect over a running loop without restarting it.
 */
export function PlayerControls({
  onOpenPanel,
  onEditWords,
  onOpenMixer,
}: PlayerControlsProps) {
  const {
    draft,
    session,
    setLiveVoiceVolume,
    setLiveMusicVolume,
    setLiveRate,
    setLivePitch,
    setLiveVoice,
    voices,
    voicesReady,
    resolvedDeviceVoice,
  } = useSession()
  const { preferences } = usePreferences()
  const { allTracks } = useLibrary()

  const { settings } = draft
  const idle = session.status === 'idle'
  const soundOn = settings.sound.mode !== 'off'

  const go = (key: PanelKey) => {
    cue('tap')
    onOpenPanel(key)
  }

  return (
    <div className="space-y-6">
      <div className="space-y-5">
        <Slider
          label="Voice"
          min={0}
          max={MAX_VOICE_VOLUME}
          step={0.05}
          value={settings.voiceVolume}
          display={`${Math.round(settings.voiceVolume * 100)}%`}
          onChange={setLiveVoiceVolume}
        />
        <Slider
          label="Sound"
          min={0}
          max={MAX_MUSIC_VOLUME}
          step={0.05}
          value={settings.musicVolume}
          display={`${Math.round(settings.musicVolume * 100)}%`}
          onChange={setLiveMusicVolume}
        />
        {!idle && (
          <p className="type-meta -mt-1">
            Both are live. Every level here changes the sound you are listening
            to as you drag it.
          </p>
        )}
      </div>

      {/*
        The other three numbers that shape a voice, folded away under the two
        that are always wanted. All of them are live — the running speech loop
        is re-optioned rather than restarted — so a voice that is a shade too
        fast can be fixed without breaking the loop's step.
      */}
      <VoiceQuickSettings
        settings={settings}
        voices={voices}
        voicesReady={voicesReady}
        resolved={resolvedDeviceVoice}
        onVoiceChange={setLiveVoice}
        onRateChange={setLiveRate}
        onPitchChange={setLivePitch}
        live={!idle}
      />

      {/*
        Each row states its own value, so the whole of the rest of the player
        is legible without opening anything.
      */}
      <div className="surface-panel overflow-hidden shadow-none">
        {/*
          First in the list, because it is the one people open mid-session.
          The stage's own corner is still the shortest way in — this is here so
          somebody already looking at the controls does not have to close them
          to find the mixer. See `AmbienceMixer`.

          What is actually in the bed, named. A row saying "Mixer · 2 layers"
          tells you a count; one saying "Rain on Window · Fireplace Glow" tells
          you what you are listening to.
        */}
        <SettingRow
          icon={<MixerIcon />}
          title="Mixer"
          summary={describeMix(mixerLayers(settings.sound, allTracks))}
          onClick={() => {
            cue('tap')
            onOpenMixer()
          }}
          accent={soundOn || settings.brainwave.enabled}
        />
        <SettingRow
          icon={soundOn ? <WaveIcon /> : <MuteIcon />}
          title="Background sound"
          summary={soundSummary(settings, allTracks)}
          onClick={() => go('sound')}
          accent={soundOn}
        />
        <SettingRow
          icon={<PulseIcon />}
          title="Brainwave rhythm"
          summary={brainwaveSummary(settings.brainwave)}
          onClick={() => go('brainwave')}
          accent={settings.brainwave.enabled}
        />
        <SettingRow
          icon={<BreathIcon />}
          title="Breathing"
          summary={breathingSummary(
            preferences.breathingEnabled,
            preferences.breathPattern,
            preferences.breathStyle,
            preferences.breathSound,
            preferences.backgroundVisualizer,
            preferences.backgroundMode,
            preferences.cinematicTypography,
          )}
          onClick={() => go('breathing')}
          accent={preferences.breathingEnabled || preferences.backgroundVisualizer}
        />
        {/*
          No Feedback row. Taps and haptics are not something anybody adjusts
          *while listening* — they are a preference you set once and forget,
          and a row for them here would make this list longer without ever
          being the reason somebody opened it. It lives under Customize with
          the rest of the once-and-forget settings.
        */}
      </div>

      <div className="flex justify-center">
        <Button variant="ghost" className="w-full sm:w-auto" onClick={onEditWords}>
          Edit these words
        </Button>
      </div>
    </div>
  )
}
