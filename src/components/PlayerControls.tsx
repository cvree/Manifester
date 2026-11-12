import { cue } from '../lib/feedback'
import {
  brainwaveSummary,
  breathingSummary,
  soundSummary,
  timerSummary,
} from '../lib/summaries'
import { useLibrary } from '../state/LibraryProvider'
import { usePreferences } from '../state/PreferencesProvider'
import { useSession } from '../state/SessionProvider'
import { VolumeMixer } from './AmbienceMixer'
import { Button } from './Button'
import type { PanelKey } from './CustomizePanel'
import {
  BreathIcon,
  ClockIcon,
  MuteIcon,
  PulseIcon,
  TuneIcon,
  WaveIcon,
} from './Icons'
import { SettingRow } from './SettingRow'
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
}

/**
 * Everything you might want to change while you are listening.
 *
 * There is one of these and two places it appears: the Adjust sheet on a
 * phone, and the column beside the stage on a wide desktop.
 *
 * Three groups, each under a plain heading, in the order things are wanted:
 *
 * 1. **Volume** — every level in the app, in the one shape the Volume panel
 *    uses everywhere. It is the same component as the panel the stage's
 *    speaker button opens, so there is exactly one way a level looks and
 *    works, and it is never more than one tap from the stage.
 * 2. **Voice** — who is reading and how fast, folded shut with its value on
 *    the lid.
 * 3. **What plays** — the three things with sheets of their own, each stating
 *    its value so the rest of the player is legible without opening anything.
 *
 * Every control here takes effect over a running loop without restarting it.
 */
export function PlayerControls({ onOpenPanel, onEditWords }: PlayerControlsProps) {
  const {
    draft,
    session,
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
    <div className="space-y-7">
      <section aria-labelledby="player-volume-heading">
        <h3 id="player-volume-heading" className="type-label mb-2.5">
          Volume
        </h3>
        <VolumeMixer onOpenPanel={onOpenPanel} />
      </section>

      <section aria-labelledby="player-voice-heading">
        <h3 id="player-voice-heading" className="type-label mb-2.5">
          Voice
        </h3>
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
      </section>

      <section aria-labelledby="player-plays-heading">
        <h3 id="player-plays-heading" className="type-label mb-2.5">
          What plays
        </h3>
        <div className="surface-panel overflow-hidden shadow-none">
          <SettingRow
            icon={soundOn ? <WaveIcon /> : <MuteIcon />}
            title="Background sound"
            summary={soundSummary(settings, allTracks)}
            onClick={() => go('sound')}
            accent={soundOn}
          />
          <SettingRow
            icon={<ClockIcon />}
            title="Repeat and length"
            summary={
              idle
                ? timerSummary(settings.timerMinutes, settings.repeat)
                : `${timerSummary(settings.timerMinutes, settings.repeat)} · applies next time you start`
            }
            onClick={() => go('timer')}
            accent={settings.repeat}
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
          <SettingRow
            icon={<TuneIcon />}
            title="Gamer mode"
            summary={
              preferences.gamerMode
                ? 'On · minimum background use'
                : 'Off · for listening while you play'
            }
            onClick={() => go('gamer')}
            accent={preferences.gamerMode}
          />
        </div>
      </section>

      <div className="flex justify-center">
        <Button variant="ghost" className="w-full sm:w-auto" onClick={onEditWords}>
          Edit these words
        </Button>
      </div>
    </div>
  )
}
