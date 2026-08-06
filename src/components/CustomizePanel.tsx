import { useState } from 'react'
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

type PanelKey =
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
    description: 'The guide that expands and settles while you listen.',
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
    description: 'Optional. Connect Claude or Gemini with your own key.',
  },
}

/**
 * Everything that used to be a long vertical settings form.
 *
 * Each row states its own value, so the whole of the advanced configuration
 * is legible at a glance; opening one puts it in a sheet — rising from the
 * bottom on a phone, centred on a desktop — instead of pushing the page
 * further down.
 */
export function CustomizePanel() {
  const {
    draft,
    updateSettings,
    setBrainwave,
    voices,
    voicesReady,
    resolvedDeviceVoice,
    previewVoice,
    previewState,
  } = useSession()
  const { allTracks } = useLibrary()
  const { preferences, update: updatePreferences } = usePreferences()
  const credentials = useCredentials()
  const [open, setOpen] = useState<PanelKey | null>(null)

  const { settings } = draft

  const openPanel = (key: PanelKey) => {
    cue('tap')
    setOpen(key)
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
          icon={<PulseIcon />}
          title="Brainwave rhythm"
          summary={brainwaveSummary(settings.brainwave)}
          onClick={() => openPanel('brainwave')}
          accent={settings.brainwave.enabled}
        />
        <SettingRow
          icon={<BreathIcon />}
          title="Breathing"
          summary={breathingSummary(
            preferences.breathingEnabled,
            preferences.breathPattern,
          )}
          onClick={() => openPanel('breathing')}
          accent={preferences.breathingEnabled}
        />
        <SettingRow
          icon={<PauseIcon />}
          title="Delay between loops"
          summary={delaySummary(settings.repeatPauseSeconds)}
          onClick={() => openPanel('delay')}
        />
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
      </div>

      <Sheet
        open={open === 'voice'}
        onClose={() => setOpen(null)}
        {...TITLES.voice}
      >
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

      <Sheet
        open={open === 'sound'}
        onClose={() => setOpen(null)}
        {...TITLES.sound}
      >
        <SoundSettings
          settings={settings}
          tracks={allTracks}
          onChange={updateSettings}
        />
      </Sheet>

      <Sheet
        open={open === 'brainwave'}
        onClose={() => setOpen(null)}
        {...TITLES.brainwave}
      >
        <BrainwavePanel settings={settings.brainwave} onChange={setBrainwave} />
      </Sheet>

      <Sheet
        open={open === 'breathing'}
        onClose={() => setOpen(null)}
        {...TITLES.breathing}
      >
        <BreathingSettings
          preferences={preferences}
          onChange={updatePreferences}
        />
      </Sheet>

      <Sheet
        open={open === 'delay'}
        onClose={() => setOpen(null)}
        {...TITLES.delay}
      >
        <DelaySettings
          seconds={settings.repeatPauseSeconds}
          onChange={(repeatPauseSeconds) => updateSettings({ repeatPauseSeconds })}
        />
      </Sheet>

      <Sheet
        open={open === 'recording'}
        onClose={() => setOpen(null)}
        {...TITLES.recording}
      >
        <VoiceRecorderPanel
          recordingId={settings.recordingId}
          onChange={(recordingId) => updateSettings({ recordingId })}
        />
      </Sheet>

      <Sheet
        open={open === 'export'}
        onClose={() => setOpen(null)}
        {...TITLES.export}
      >
        <ExportPanel
          settings={settings}
          title={draft.title}
          hasRecording={settings.recordingId != null}
          soundLabel={soundSummary(settings, allTracks)}
          voiceLabel={voiceSummary(settings, resolvedDeviceVoice)}
        />
      </Sheet>

      <Sheet open={open === 'ai'} onClose={() => setOpen(null)} {...TITLES.ai}>
        <AiSetupPanel
          credentials={credentials}
          onChange={setStoredCredentials}
          enabled={preferences.aiEnabled}
          onEnabledChange={(aiEnabled) => updatePreferences({ aiEnabled })}
        />
      </Sheet>

      <Sheet open={open === 'feel'} onClose={() => setOpen(null)} {...TITLES.feel}>
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
