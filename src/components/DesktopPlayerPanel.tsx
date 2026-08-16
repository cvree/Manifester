import { MAX_MUSIC_VOLUME } from '../lib/audioBus'
import { cue } from '../lib/feedback'
import { MAX_VOICE_VOLUME } from '../lib/speech'
import { describeMix, mixerLayers } from '../lib/soundMixer'
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
import {
  BreathIcon,
  MixerIcon,
  MuteIcon,
  PulseIcon,
  TuneIcon,
  WaveIcon,
} from './Icons'
import { SettingRow } from './SettingRow'
import { Slider } from './Slider'

interface DesktopPlayerPanelProps {
  onOpenPanel: (key: PanelKey) => void
  onEditWords: () => void
  /** The mixer has its own sheet rather than being a settings panel. */
  onOpenMixer: () => void
}

/**
 * The desktop half of the Player.
 *
 * Phones keep the stage as a single focused column and reach these controls
 * through Adjust. Wide screens have enough room to keep the live player on the
 * left and the controls you actually change while listening on the right.
 */
export function DesktopPlayerPanel({
  onOpenPanel,
  onEditWords,
  onOpenMixer,
}: DesktopPlayerPanelProps) {
  const {
    draft,
    session,
    setLiveVoiceVolume,
    setLiveMusicVolume,
  } = useSession()
  const { preferences } = usePreferences()
  const { allTracks } = useLibrary()

  const { settings } = draft
  const idle = session.status === 'idle'
  const soundOn = settings.sound.mode !== 'off'

  const open = (key: PanelKey) => {
    cue('tap')
    onOpenPanel(key)
  }

  return (
    <aside
      aria-label="Player controls"
      className="surface-panel sticky top-24 hidden overflow-hidden xl:block"
    >
      <div className="border-b border-[var(--quiet-border)] px-5 py-5">
        <h2 className="type-subheading">Adjust while listening</h2>
        <p className="type-meta mt-1">
          Changes here take effect without leaving the player.
        </p>
      </div>

      <div className="space-y-5 px-5 py-5">
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
            Both are live. Every level here changes as you drag it.
          </p>
        )}
      </div>

      <div className="border-t border-[var(--quiet-border)]">
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
          onClick={() => open('sound')}
          accent={soundOn}
        />
        <SettingRow
          icon={<PulseIcon />}
          title="Brainwave rhythm"
          summary={brainwaveSummary(settings.brainwave)}
          onClick={() => open('brainwave')}
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
          onClick={() => open('breathing')}
          accent={preferences.breathingEnabled || preferences.backgroundVisualizer}
        />
        <SettingRow
          icon={<TuneIcon />}
          title="Feedback"
          summary={feelSummary(preferences.uiSounds, preferences.uiHaptics)}
          onClick={() => open('feel')}
        />
      </div>

      <div className="border-t border-[var(--quiet-border)] px-5 py-4">
        <Button variant="ghost" className="w-full" onClick={onEditWords}>
          Edit these words
        </Button>
      </div>
    </aside>
  )
}
