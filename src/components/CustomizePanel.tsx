import type { ReactNode } from 'react'
import { setStoredCredentials, useCredentials } from '../lib/ai/useCredentials'
import { cue, hapticsSupported, primeFeedback, soundSupported } from '../lib/feedback'
import {
  breathingSummary,
  exportSummary,
  feelSummary,
  musicSummary,
  recordingSummary,
  soundSummary,
  voiceSummary,
} from '../lib/summaries'
import { useStudioAvailable } from '../lib/tts/useTTSStatus'
import { useLibrary } from '../state/LibraryProvider'
import { usePreferences } from '../state/PreferencesProvider'
import { useSession } from '../state/SessionProvider'
import { AiSetupPanel, aiSummary } from './AiSetupPanel'
import { BrainwavePanel } from './BrainwavePanel'
import { BreathingSettings } from './BreathingSettings'
import { DelaySettings } from './DelaySettings'
import { ExportPanel } from './ExportPanel'
import {
  BreathIcon,
  DownloadIcon,
  MicIcon,
  NoteIcon,
  SparkIcon,
  TuneIcon,
} from './Icons'
import { MusicSettings } from './MusicControl'
import { SettingRow } from './SettingRow'
import { Sheet } from './Sheet'
import { SoundSettings } from './SoundSettings'
import { TimerSettings } from './TimerSettings'
import { Toggle } from './Toggle'
import { VoiceRecorderPanel } from './VoiceRecorderPanel'
import { VoiceSettings } from './VoiceSettings'

export type PanelKey =
  | 'voice'
  | 'sound'
  | 'music'
  | 'brainwave'
  | 'breathing'
  | 'timer'
  | 'delay'
  | 'recording'
  | 'export'
  | 'feel'
  | 'ai'

const TITLES: Record<PanelKey, { title: string; description: string }> = {
  voice: {
    title: 'Voice',
    description: 'Who reads your words, and how quickly.',
  },
  sound: {
    title: 'Background sound',
    description: 'The ambience your words rest on.',
  },
  music: {
    title: 'Music',
    description: 'The soundtrack under the app.',
  },
  brainwave: {
    title: 'Brainwave rhythm',
    description: 'A generated rhythm, on its own or under the ambience.',
  },
  breathing: {
    title: 'Breathing',
    description: 'The guide you follow while you listen — how it moves, and how it sounds.',
  },
  timer: {
    title: 'Session length',
    description: 'How long the loop keeps going before it fades out.',
  },
  delay: {
    title: 'Delay between loops',
    description: 'The quiet space before your words begin again.',
  },
  recording: {
    title: 'Record your own voice',
    description: 'Optional. It is what makes a downloadable file possible.',
  },
  export: {
    title: 'Download audio',
    description: 'Render this loop as a file you can play anywhere.',
  },
  feel: {
    title: 'Feedback',
    description: 'How the interface answers when you touch it.',
  },
  ai: {
    title: 'AI writing help',
    description: 'Optional. Connect Gemini with your own free key.',
  },
}

interface SheetsProps {
  open: PanelKey | null
  onOpenChange: (key: PanelKey | null) => void
}

/**
 * Every settings sheet in the app, in one place.
 *
 * Create and the Player both open sheets, and each used to carry its own copy
 * of the ones it needed — which is how the same breathing panel ended up with
 * two descriptions and the haptics panel with two. There is one of each now,
 * and a screen only has to say which key is open.
 */
export function SettingsSheets({ open, onOpenChange }: SheetsProps) {
  const {
    draft,
    session,
    updateSettings,
    setBrainwave,
    setLiveSound,
    setLiveMusicVolume,
    voices,
    voicesReady,
    resolvedDeviceVoice,
    previewVoice,
    previewState,
  } = useSession()
  const { allTracks } = useLibrary()
  const { preferences, update: updatePreferences } = usePreferences()
  const credentials = useCredentials()
  const studioAvailable = useStudioAvailable()

  const { settings } = draft
  const close = () => onOpenChange(null)

  return (
    <>
      <Sheet open={open === 'voice'} onClose={close} {...TITLES.voice}>
        <VoiceSettings
          voices={voices}
          voicesReady={voicesReady}
          resolvedDeviceVoice={resolvedDeviceVoice}
          settings={settings}
          onChange={updateSettings}
          onPreview={previewVoice}
          previewState={previewState}
        />
      </Sheet>

      <Sheet open={open === 'sound'} onClose={close} {...TITLES.sound}>
        {/*
          Both handlers are the live ones. Idle, they are ordinary setting
          changes; mid-session they reach the engine, which is what makes this
          the same panel the player can open over a running loop.
        */}
        <SoundSettings
          settings={settings}
          tracks={allTracks}
          onSoundChange={setLiveSound}
          onVolumeChange={setLiveMusicVolume}
          live={session.status === 'playing' || session.status === 'paused'}
        />
      </Sheet>

      <Sheet open={open === 'music'} onClose={close} {...TITLES.music}>
        {/*
          The same panel the header button opens. One set of controls, reachable
          from the place people look for settings and from the place people
          reach when they want the sound to stop.
        */}
        <MusicSettings />
      </Sheet>

      <Sheet open={open === 'brainwave'} onClose={close} {...TITLES.brainwave}>
        <BrainwavePanel settings={settings.brainwave} onChange={setBrainwave} />
      </Sheet>

      <Sheet open={open === 'breathing'} onClose={close} {...TITLES.breathing}>
        <BreathingSettings
          preferences={preferences}
          onChange={updatePreferences}
        />
      </Sheet>

      {/*
        Session length used to be a card of its own on Create, which made it
        the one setting with two homes — a tile in the preview that scrolled
        somewhere, and a panel nothing else on the screen looked like. It is a
        sheet like the other nine now.
      */}
      <Sheet open={open === 'timer'} onClose={close} {...TITLES.timer}>
        <TimerSettings
          minutes={settings.timerMinutes}
          onChange={(timerMinutes) => updateSettings({ timerMinutes })}
        />
      </Sheet>

      <Sheet open={open === 'delay'} onClose={close} {...TITLES.delay}>
        <DelaySettings
          seconds={settings.repeatPauseSeconds}
          onChange={(repeatPauseSeconds) => updateSettings({ repeatPauseSeconds })}
        />
      </Sheet>

      <Sheet open={open === 'recording'} onClose={close} {...TITLES.recording}>
        <VoiceRecorderPanel
          recordingId={settings.recordingId}
          onChange={(recordingId) => updateSettings({ recordingId })}
        />
      </Sheet>

      <Sheet open={open === 'export'} onClose={close} {...TITLES.export}>
        <ExportPanel
          settings={settings}
          title={draft.title}
          hasRecording={settings.recordingId != null}
          soundLabel={soundSummary(settings, allTracks)}
          voiceLabel={voiceSummary(settings, resolvedDeviceVoice, studioAvailable)}
        />
      </Sheet>

      <Sheet open={open === 'ai'} onClose={close} {...TITLES.ai}>
        <AiSetupPanel
          credentials={credentials}
          onChange={setStoredCredentials}
          enabled={preferences.aiEnabled}
          onEnabledChange={(aiEnabled) => updatePreferences({ aiEnabled })}
        />
      </Sheet>

      <Sheet open={open === 'feel'} onClose={close} {...TITLES.feel}>
        <div className="space-y-5">
          <Toggle
            label="Interface sound"
            description={
              soundSupported()
                ? 'Soft, low cues under the words — a touch, a confirmation, and a chime when a loop completes. They always sit beneath the voice.'
                : 'Not available in this browser.'
            }
            checked={preferences.uiSounds && soundSupported()}
            disabled={!soundSupported()}
            onChange={(uiSounds) => {
              updatePreferences({ uiSounds })
              // Answered by hearing it, which is the only useful answer.
              if (uiSounds) {
                primeFeedback()
                cue('select')
              }
            }}
          />
          <Toggle
            label="Haptics"
            description={
              hapticsSupported()
                ? 'A brief buzz on the main controls. Sliders never vibrate.'
                : 'Not available in this browser. iPhone does not let web apps vibrate.'
            }
            checked={preferences.uiHaptics && hapticsSupported()}
            disabled={!hapticsSupported()}
            onChange={(uiHaptics) => {
              updatePreferences({ uiHaptics })
              if (uiHaptics) cue('tap')
            }}
          />
        </div>
      </Sheet>
    </>
  )
}

/**
 * Everything about the ritual that the preview's tiles do not already carry.
 *
 * The two used to overlap almost entirely: voice, sound, length, delay and
 * rhythm each had a tile in the preview *and* a row down here, on the same
 * screen, both opening the same sheet. Two lists of the same settings is not
 * twice the control — it is a screen you have to read twice to be sure you
 * have not missed something.
 *
 * So the split is by what the setting is about. The five tiles above own the
 * loop itself — who reads it, what it rests on, how long it runs. These rows
 * own everything around it: the guide, the soundtrack, and the handful of
 * things done once and then forgotten. Each row still states its own value, and
 * opening one puts it in a sheet rather than pushing the page further down.
 */
interface CustomizePanelProps {
  /**
   * Which sheet is open, owned by Create. The ritual preview's summary tiles
   * open these same sheets, so the state cannot live in here.
   */
  open: PanelKey | null
  onOpenChange: (key: PanelKey | null) => void
}

export function CustomizePanel({ open, onOpenChange }: CustomizePanelProps) {
  const { draft } = useSession()
  const { preferences } = usePreferences()
  const credentials = useCredentials()

  const { settings } = draft

  const openPanel = (key: PanelKey) => {
    cue('tap')
    onOpenChange(key)
  }

  return (
    <>
      <div className="surface-panel overflow-hidden">
        <div className="border-b border-[var(--quiet-border)] px-4 py-4 sm:px-5">
          <h2 className="type-subheading">Everything else</h2>
          <p className="type-meta mt-0.5">
            Optional. Everything the ritual tiles do not already cover.
          </p>
        </div>

        <Group label="Around the loop">
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
            onClick={() => openPanel('breathing')}
            accent={preferences.breathingEnabled || preferences.backgroundVisualizer}
          />
          <SettingRow
            icon={<NoteIcon />}
            title="Music"
            summary={musicSummary(preferences.music, preferences.musicVolume)}
            onClick={() => openPanel('music')}
            accent={preferences.music}
          />
        </Group>

        <Group label="Now and then">
          <SettingRow
            icon={<MicIcon />}
            title="Voice recording"
            summary={recordingSummary(settings.recordingId)}
            onClick={() => openPanel('recording')}
            accent={settings.recordingId != null}
          />
          <SettingRow
            icon={<DownloadIcon />}
            title="Download audio"
            summary={exportSummary(settings, settings.recordingId != null)}
            onClick={() => openPanel('export')}
          />
          <SettingRow
            icon={<SparkIcon />}
            title="AI writing help"
            summary={aiSummary(credentials, preferences.aiEnabled)}
            onClick={() => openPanel('ai')}
            accent={credentials != null && preferences.aiEnabled}
          />
          <SettingRow
            icon={<TuneIcon />}
            title="Feedback"
            summary={feelSummary(preferences.uiSounds, preferences.uiHaptics)}
            onClick={() => openPanel('feel')}
          />
        </Group>
      </div>

      <SettingsSheets open={open} onOpenChange={onOpenChange} />
    </>
  )
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section aria-label={label}>
      <h3 className="type-meta bg-[var(--quiet)] px-4 py-2 font-semibold tracking-[0.08em] uppercase sm:px-5">
        {label}
      </h3>
      {children}
    </section>
  )
}
