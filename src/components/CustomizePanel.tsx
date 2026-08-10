import type { ReactNode } from 'react'
import { setStoredCredentials, useCredentials } from '../lib/ai/useCredentials'
import { cue, hapticsSupported } from '../lib/feedback'
import {
  brainwaveSummary,
  breathingSummary,
  delaySummary,
  exportSummary,
  feelSummary,
  recordingSummary,
  soundSummary,
  voiceSummary,
} from '../lib/summaries'
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
  PauseIcon,
  PulseIcon,
  SparkIcon,
  TuneIcon,
  VoiceIcon,
  WaveIcon,
} from './Icons'
import { SettingRow } from './SettingRow'
import { Sheet } from './Sheet'
import { SoundSettings } from './SoundSettings'
import { Toggle } from './Toggle'
import { VoiceRecorderPanel } from './VoiceRecorderPanel'
import { VoiceSettings } from './VoiceSettings'

export type PanelKey =
  | 'voice'
  | 'sound'
  | 'brainwave'
  | 'breathing'
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
  brainwave: {
    title: 'Brainwave rhythm',
    description: 'A generated rhythm, on its own or under the ambience.',
  },
  breathing: {
    title: 'Breathing',
    description: 'The guide you follow while you listen — how it moves, and how it sounds.',
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
    title: 'Haptics and interface sounds',
    description: 'How the app answers when you touch it.',
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

      <Sheet open={open === 'brainwave'} onClose={close} {...TITLES.brainwave}>
        <BrainwavePanel settings={settings.brainwave} onChange={setBrainwave} />
      </Sheet>

      <Sheet open={open === 'breathing'} onClose={close} {...TITLES.breathing}>
        <BreathingSettings
          preferences={preferences}
          onChange={updatePreferences}
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
          voiceLabel={voiceSummary(settings, resolvedDeviceVoice)}
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
            label="Interface sounds"
            description="A soft tone when you start, pause, save or finish something."
            checked={preferences.uiSounds}
            onChange={(uiSounds) => {
              updatePreferences({ uiSounds })
              if (uiSounds) cue('tap')
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
 * Everything that used to be a long vertical settings form.
 *
 * Each row states its own value, so the whole of the advanced configuration is
 * legible at a glance; opening one puts it in a sheet — rising from the bottom
 * on a phone, centred on a desktop — instead of pushing the page further down.
 *
 * The nine rows are grouped into three named runs, because nine identical rows
 * in a column is a list you read from the top every time rather than a place
 * you know your way around.
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
  const { draft, resolvedDeviceVoice } = useSession()
  const { allTracks } = useLibrary()
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
          <h2 className="type-subheading">Customize your ritual</h2>
          <p className="type-meta mt-0.5">
            Everything here is optional. The defaults already work.
          </p>
        </div>

        <Group label="What you hear">
          <SettingRow
            icon={<VoiceIcon />}
            title="Voice"
            summary={voiceSummary(settings, resolvedDeviceVoice)}
            onClick={() => openPanel('voice')}
            accent
          />
          <SettingRow
            icon={<WaveIcon />}
            title="Background sound"
            summary={soundSummary(settings, allTracks)}
            onClick={() => openPanel('sound')}
            accent={settings.sound.mode !== 'off'}
          />
          <SettingRow
            icon={<PauseIcon />}
            title="Delay between loops"
            summary={delaySummary(settings.repeatPauseSeconds)}
            onClick={() => openPanel('delay')}
          />
        </Group>

        <Group label="What guides you">
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
            onClick={() => openPanel('breathing')}
            accent={preferences.breathingEnabled || preferences.backgroundVisualizer}
          />
          <SettingRow
            icon={<PulseIcon />}
            title="Brainwave rhythm"
            summary={brainwaveSummary(settings.brainwave)}
            onClick={() => openPanel('brainwave')}
            accent={settings.brainwave.enabled}
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
            title="Haptics and interface sounds"
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
