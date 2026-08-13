import { MAX_MUSIC_VOLUME } from '../lib/audioBus'
import { cue } from '../lib/feedback'
import { MAX_VOICE_VOLUME } from '../lib/speech'
import {
  brainwaveSummary,
  breathingSummary,
  feelSummary,
  soundSummary,
} from '../lib/summaries'
import { useLibrary } from '../state/LibraryProvider'
import { usePreferences } from '../state/PreferencesProvider'
import { useSession } from '../state/SessionProvider'
import { Button } from './Button'
import type { PanelKey } from './CustomizePanel'
import { BreathIcon, MuteIcon, PulseIcon, TuneIcon, WaveIcon } from './Icons'
import { SettingRow } from './SettingRow'
import { Sheet } from './Sheet'
import { Slider } from './Slider'
import { VoiceQuickSettings } from './VoiceQuickSettings'

interface PlayerAdjustProps {
  open: boolean
  onClose: () => void
  /**
   * Hand over to one of the detail sheets.
   *
   * One sheet at a time, always. A sheet opening on top of a sheet is two
   * scrims, two focus traps and two ways out, and the way back it buys you is
   * a way back to a list you were only passing through.
   */
  onOpenPanel: (key: PanelKey) => void
  onEditWords: () => void
}

/**
 * Everything you might want to change while you are listening, in one place.
 *
 * ── Why this exists ──
 *
 * The player used to carry a column beside the stage: a Levels card, a panel of
 * four setting rows, and a button back to the editor. Three surfaces and a
 * dozen controls, permanently on screen, beside the one thing the screen is
 * actually for. It made a ritual space look like a mixing desk, and on a phone
 * it was worse than that — the column stacked *below* a full-height stage, so
 * the controls were both cluttering the page and out of reach.
 *
 * All of it is here now, one tap from the stage, in the order it is wanted:
 *
 *   · the two live faders, because volume is what people actually reach for;
 *   · who is reading and how fast, folded shut, stating its value on the lid;
 *   · the four things that have sheets of their own;
 *   · and the way back to the words.
 *
 * Nothing was removed to get here. The sliders are the same live ones, the rows
 * open the same sheets, and every one of them still takes effect over a running
 * loop without restarting it.
 */
export function PlayerAdjust({
  open,
  onClose,
  onOpenPanel,
  onEditWords,
}: PlayerAdjustProps) {
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
    <Sheet
      open={open}
      onClose={onClose}
      title="Adjust"
      description={
        idle
          ? 'Everything here is optional. The defaults already work.'
          : 'Every one of these takes effect without stopping the loop.'
      }
    >
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
              Voice level takes effect on the next line. Sound changes at once.
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
            )}
            onClick={() => go('breathing')}
            accent={preferences.breathingEnabled || preferences.backgroundVisualizer}
          />
          <SettingRow
            icon={<TuneIcon />}
            title="Haptics"
            summary={feelSummary(preferences.uiSounds, preferences.uiHaptics)}
            onClick={() => go('feel')}
          />
        </div>

        <div className="flex justify-center">
          <Button variant="ghost" onClick={onEditWords}>
            Edit these words
          </Button>
        </div>
      </div>
    </Sheet>
  )
}
