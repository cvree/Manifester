import {
  startTransition,
  useMemo,
  useOptimistic,
  useState,
  type ReactNode,
} from 'react'
import { AMBIENT_PRESETS, isBuiltInAmbientId } from '../lib/ambient'
import { MAX_MUSIC_VOLUME } from '../lib/audioBus'
import { BREATH_VOICES, MAX_BREATH_VOLUME, type BreathSound } from '../lib/breathAudio'
import { configureBreath } from '../lib/breathEngine'
import { cx } from '../lib/cx'
import { cue } from '../lib/feedback'
import {
  MAX_ACTIVE_LAYERS,
  activeSourceIds,
  describeMix,
  hasLayer,
  mixerLayers,
} from '../lib/soundMixer'
import { MAX_VOICE_VOLUME } from '../lib/speech'
import { brainwaveSummary } from '../lib/summaries'
import { useLibrary } from '../state/LibraryProvider'
import { usePreferences } from '../state/PreferencesProvider'
import { useSession } from '../state/SessionProvider'
import type { PanelKey } from './CustomizePanel'
import {
  BreathIcon,
  ChevronIcon,
  NoteIcon,
  PlusIcon,
  PulseIcon,
  SpeakerOffIcon,
  VoiceIcon,
  WaveIcon,
} from './Icons'
import { setMusicLevel, switchMusic } from './MusicControl'
import { Sheet } from './Sheet'
import { Slider } from './Slider'
import { SoundScene } from './SoundScene'

interface AmbienceMixerProps {
  open: boolean
  onClose: () => void
  /** Hand over to the sheet where *what* plays is chosen. */
  onOpenPanel?: (key: PanelKey) => void
}

/**
 * Volume: every level in the app, in one place, in one shape.
 *
 * ── What was wrong ──
 *
 * There were six things with a level — the voice, the background, each
 * stacked layer, the brainwave rhythm, the breath sound and the music — and
 * they lived in six different sheets under five different names ("Sound",
 * "All background sound", "Sound level", "Rhythm volume", "Breath sound
 * level", "Music level"). Turning one thing down meant first working out
 * which panel it belonged to. The stage also had two speaker-ish buttons side
 * by side, one for choosing the sound and one for its mixer, and nothing on
 * either said which was which.
 *
 * ── What this is ──
 *
 * One list. Every row is the same: an on/off button on the left, the name and
 * what it is playing, the number, and a full-width fader. Every row works the
 * same way — the button silences it and gives it back at the level it had,
 * dragging the fader of something that is off turns it on — so learning one
 * row is learning all of them. The name of what is playing is a link to the
 * sheet where it is chosen, which is the only reason left to go anywhere else.
 *
 * Everything is live. Levels are ramps on gains that already exist and reach
 * the audio thread in the same input event as the finger; nothing restarts.
 */
export function AmbienceMixer({ open, onClose, onOpenPanel }: AmbienceMixerProps) {
  const { session } = useSession()
  const live = session.status === 'playing'

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Volume"
      description={
        live
          ? 'Every level, in one place. Changes are heard as you make them.'
          : 'Every level, in one place. Your session starts with this balance.'
      }
    >
      <VolumeMixer onOpenPanel={onOpenPanel} />
    </Sheet>
  )
}

/*
 * The level something had before its button silenced it, for the two rows
 * whose "off" is a level of zero rather than a switch of their own. Kept at
 * module scope so the sheet and the desktop column agree, and so closing the
 * sheet does not forget it.
 */
const remembered = new Map<string, number>()

function silence(key: string, current: number, set: (level: number) => void) {
  if (current > 0) remembered.set(key, current)
  set(0)
}

function restore(key: string, fallback: number, set: (level: number) => void) {
  set(remembered.get(key) ?? fallback)
}

/** The breath sound to bring back when its button turns it on again. */
let lastBreathSound: BreathSound = BREATH_VOICES[0]?.id ?? 'chime'

/** "Alpha · 10 Hz" — the rhythm's name and rate, without the mode. */
function rhythmName(rhythm: Parameters<typeof brainwaveSummary>[0]): string {
  return brainwaveSummary(rhythm).split(' · ').slice(0, 2).join(' · ')
}

/** The panel's content, for the Volume sheet and the desktop column alike. */
export function VolumeMixer({
  onOpenPanel,
}: {
  onOpenPanel?: (key: PanelKey) => void
}) {
  const {
    draft,
    session,
    setLiveMusicVolume,
    setLiveVoiceVolume,
    setLayerLevel,
    setLayerMuted,
    setLayerEnabled,
    setBrainwave,
  } = useSession()
  const { preferences, update } = usePreferences()
  const { allTracks } = useLibrary()
  const [adding, setAdding] = useState(false)

  const { settings } = draft
  const { sound } = settings

  /*
   * The track the engine is *playing*, not the first of the queue. They differ
   * while a playlist is part-way through, and a fader labelled with one sound
   * while adjusting another is exactly the confusion this panel exists to end.
   */
  const currentTrackId = useMemo(() => {
    if (sound.mode !== 'playlist' || !session.trackName) return null
    return allTracks.find((track) => track.name === session.trackName)?.id ?? null
  }, [sound.mode, session.trackName, allTracks])

  const layers = useMemo(
    () => mixerLayers(sound, allTracks, currentTrackId),
    [sound, allTracks, currentTrackId],
  )

  const active = activeSourceIds(sound)
  const canAdd = active.length < MAX_ACTIVE_LAYERS
  const addable = AMBIENT_PRESETS.filter(
    (preset) => !active.includes(preset.id) && !hasLayer(sound, preset.id),
  )

  const open = onOpenPanel
    ? (key: PanelKey) => () => {
        cue('tap')
        onOpenPanel(key)
      }
    : () => undefined

  const voiceOn = settings.voiceVolume > 0
  const backgroundOn = settings.musicVolume > 0 && layers.length > 0
  const rhythm = settings.brainwave
  const breathOn = preferences.breathSound !== 'off'
  const breathName =
    BREATH_VOICES.find((voice) => voice.id === preferences.breathSound)?.name ??
    'Off'

  /** The breath sound, told to the engine first so the press is heard at once. */
  const setBreathSound = (breathSound: BreathSound) => {
    if (preferences.breathSound !== 'off') lastBreathSound = preferences.breathSound
    configureBreath({ sound: breathSound })
    update({ breathSound })
  }

  return (
    <ul className="space-y-2.5" aria-label="Volume levels">
      <LevelRow
        icon={<VoiceIcon />}
        name="Voice"
        status={voiceOn ? 'Your words' : 'Silent — the loop keeps going'}
        onStatus={onOpenPanel ? open('voice') : undefined}
        on={voiceOn}
        onToggle={(on) =>
          on
            ? restore('voice', 0.82, setLiveVoiceVolume)
            : silence('voice', settings.voiceVolume, setLiveVoiceVolume)
        }
        level={settings.voiceVolume}
        max={MAX_VOICE_VOLUME}
        onLevel={setLiveVoiceVolume}
      />

      <LevelRow
        icon={<WaveIcon />}
        name="Background"
        status={layers.length === 0 ? 'Choose a sound' : describeMix(layers)}
        onStatus={onOpenPanel ? open('sound') : undefined}
        on={backgroundOn}
        disabled={layers.length === 0 && !onOpenPanel}
        onToggle={(on) => {
          // Nothing chosen yet: "on" can only mean "choose something".
          if (layers.length === 0) return onOpenPanel?.('sound')
          if (on) restore('background', 0.4, setLiveMusicVolume)
          else silence('background', settings.musicVolume, setLiveMusicVolume)
        }}
        level={settings.musicVolume}
        max={MAX_MUSIC_VOLUME}
        onLevel={setLiveMusicVolume}
      >
        {/*
          The layers belong to the background and are drawn inside its row,
          one step in. A single sound needs no second fader — the background's
          own is the one — so they appear only once there is more than one.
        */}
        {layers.length > 1 && (
          <ul className="mt-3 space-y-2 border-l border-[var(--quiet-border)] pl-3">
            {layers.map((layer) => (
              <LevelRow
                key={layer.id}
                nested
                icon={
                  layer.imported || !isBuiltInAmbientId(layer.id) ? (
                    <WaveIcon />
                  ) : (
                    <SoundScene id={layer.id} className="h-full w-full rounded-full" />
                  )
                }
                name={layer.name}
                on={!layer.muted && layer.level > 0}
                onToggle={(on) => setLayerMuted(layer.id, !on)}
                level={layer.level}
                max={1}
                onLevel={(level) => setLayerLevel(layer.id, level)}
                onRemove={
                  layer.kind === 'layer'
                    ? () => {
                        cue('tap')
                        setLayerEnabled(layer.id, false)
                      }
                    : undefined
                }
              />
            ))}
          </ul>
        )}

        {addable.length > 0 && (
          <div className="mt-3">
            {!adding ? (
              <button
                type="button"
                disabled={!canAdd}
                onClick={() => {
                  cue('tap')
                  setAdding(true)
                }}
                className="interactive inline-flex min-h-10 items-center gap-2 rounded-pill border border-[var(--control-border)] px-3.5 text-[0.86rem] font-medium text-ink-muted hover:text-ink"
              >
                <PlusIcon className="text-[0.75rem]" />
                Layer another sound
              </button>
            ) : (
              <div>
                <p className="type-meta mb-2">
                  Each one fades in under the rest with its own level.
                </p>
                <ul className="flex flex-wrap gap-2">
                  {addable.map((preset) => (
                    <li key={preset.id}>
                      <button
                        type="button"
                        disabled={!canAdd}
                        onClick={() => {
                          cue('select')
                          setLayerEnabled(preset.id, true)
                          setAdding(false)
                        }}
                        className="interactive inline-flex min-h-10 items-center gap-2 rounded-pill border border-[var(--control-border)] px-3.5 text-[0.86rem] font-medium text-ink-muted hover:bg-[var(--quiet)] hover:text-ink"
                      >
                        <PlusIcon className="text-[0.75rem]" />
                        {preset.name}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {!canAdd && (
              <p className="type-meta mt-2">
                {MAX_ACTIVE_LAYERS} sounds at once is this device’s limit.
                Remove one to add another.
              </p>
            )}
          </div>
        )}
      </LevelRow>

      <LevelRow
        icon={<PulseIcon />}
        name="Brainwave rhythm"
        status={rhythm.enabled ? rhythmName(rhythm) : 'Choose a rhythm'}
        onStatus={onOpenPanel ? open('brainwave') : undefined}
        on={rhythm.enabled}
        onToggle={(enabled) => setBrainwave({ enabled })}
        level={rhythm.volume}
        max={1}
        onLevel={(volume) => setBrainwave({ volume, enabled: true })}
      />

      <LevelRow
        icon={<BreathIcon />}
        name="Breath sound"
        status={
          !preferences.breathingEnabled
            ? 'Breathing guide is off'
            : breathOn
              ? breathName
              : 'Choose a sound'
        }
        onStatus={onOpenPanel ? open('breathing') : undefined}
        on={breathOn}
        onToggle={(on) => setBreathSound(on ? lastBreathSound : 'off')}
        level={preferences.breathSoundVolume}
        max={MAX_BREATH_VOLUME}
        onLevel={(breathSoundVolume) => {
          configureBreath({ volume: breathSoundVolume })
          if (!breathOn) setBreathSound(lastBreathSound)
          update({ breathSoundVolume })
        }}
      />

      <LevelRow
        icon={<NoteIcon />}
        name="Music"
        status="The app’s soundtrack"
        onStatus={onOpenPanel ? open('music') : undefined}
        on={preferences.music}
        onToggle={(on) => switchMusic(on, update, false)}
        level={preferences.musicVolume}
        max={1}
        onLevel={(musicVolume) => {
          if (!preferences.music) switchMusic(true, update, false)
          setMusicLevel(musicVolume, update)
        }}
      />
    </ul>
  )
}

interface LevelRowProps {
  icon: ReactNode
  name: string
  /** What is playing, in a few words. A link when `onStatus` is given. */
  status?: string
  onStatus?: () => void
  on: boolean
  onToggle: (on: boolean) => void
  level: number
  max: number
  onLevel: (level: number) => void
  onRemove?: () => void
  /** Nothing to turn on — the background with no sound chosen. */
  disabled?: boolean
  /** A layer inside the background row: smaller, no status line. */
  nested?: boolean
  children?: ReactNode
}

/**
 * One thing making a sound: its switch, its name, its number, its fader.
 *
 * The switch answers optimistically — the icon changes in an urgent render of
 * this row alone, and the setting follows in a transition — and its handler
 * reaches the audio engine synchronously inside the tap, so the press is heard
 * and seen on the same frame. Moving the fader of something that is off turns
 * it on: a slider that visibly does nothing is worse than an unmute nobody
 * asked for out loud.
 */
function LevelRow({
  icon,
  name,
  status,
  onStatus,
  on,
  onToggle,
  level,
  max,
  onLevel,
  onRemove,
  disabled = false,
  nested = false,
  children,
}: LevelRowProps) {
  const [shown, setShown] = useOptimistic(on)
  /*
   * The number under the finger. The stored level arrives a transition later,
   * so the readout follows the slider's own urgent value while it is moving.
   */
  const [dragging, setDragging] = useState<number | null>(null)
  const [seen, setSeen] = useState(level)
  if (level !== seen) {
    setSeen(level)
    setDragging(null)
  }
  const percent = (value: number) => `${Math.round(value * 100)}%`

  const toggle = () => {
    const next = !shown
    cue('tap')
    startTransition(() => {
      setShown(next)
      onToggle(next)
    })
  }

  return (
    <li
      className={cx(
        !nested &&
          'rounded-[1.15rem] border border-[var(--border)] bg-[var(--surface-sunken)] px-3 pt-2.5 pb-1.5',
      )}
    >
      {/* Line one: what it is, and what is playing — the latter a way to change it. */}
      <div className="flex min-h-7 items-center gap-2">
        <span
          className={cx(
            'shrink-0 font-medium transition-colors duration-[120ms]',
            nested ? 'text-[0.9rem]' : 'text-[0.98rem]',
            shown ? 'text-ink' : 'text-ink-muted',
          )}
        >
          {name}
        </span>
        {status &&
          (onStatus ? (
            <button
              type="button"
              onClick={onStatus}
              className="group inline-flex min-h-7 min-w-0 items-center gap-0.5 rounded px-1 text-left text-[0.84rem] text-ink-muted hover:text-ink"
            >
              <span className="truncate">{status}</span>
              <ChevronIcon
                aria-hidden="true"
                className="shrink-0 -rotate-90 text-[0.8rem] text-ink-faint transition-transform duration-150 group-hover:translate-x-0.5"
              />
            </button>
          ) : (
            <span className="min-w-0 truncate px-1 text-[0.84rem] text-ink-muted">
              {status}
            </span>
          ))}
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${name}`}
            title={`Remove ${name}`}
            className="interactive -my-1 ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[1.1rem] text-ink-faint hover:text-ink"
          >
            <span aria-hidden="true">×</span>
          </button>
        )}
      </div>

      {/* Line two: the switch, the fader, the number. */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={disabled}
          onClick={toggle}
          aria-pressed={shown}
          aria-label={`${name}: ${shown ? 'on' : 'off'}. Turn ${shown ? 'off' : 'on'}.`}
          title={shown ? `Turn ${name.toLowerCase()} off` : `Turn ${name.toLowerCase()} on`}
          className={cx(
            'interactive relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border',
            'transition-[background-color,border-color,color] duration-[120ms]',
            nested ? 'h-10 w-10 text-[0.95rem]' : 'h-11 w-11 text-[1.05rem]',
            shown
              ? 'border-[var(--rose-deep)] bg-[var(--rose-soft)] text-[var(--rose-deep)]'
              : 'border-[var(--control-border)] bg-transparent text-ink-faint',
          )}
        >
          <span
            aria-hidden="true"
            className={cx(
              'absolute inset-0 flex items-center justify-center transition-opacity duration-[120ms]',
              shown ? 'opacity-100' : 'opacity-0',
            )}
          >
            {icon}
          </span>
          <span
            aria-hidden="true"
            className={cx(
              'absolute inset-0 flex items-center justify-center transition-opacity duration-[120ms]',
              shown ? 'opacity-0' : 'opacity-100',
            )}
          >
            <SpeakerOffIcon />
          </span>
        </button>

        <Slider
          bare
          className={cx('min-w-0 grow', !shown && 'opacity-60')}
          label={`${name} volume`}
          min={0}
          max={max}
          step={max > 1 ? 0.05 : 0.02}
          value={level}
          disabled={disabled}
          display={(value) => (shown ? percent(value) : `${percent(value)}, off`)}
          onLive={setDragging}
          onChange={(value) => {
            if (!shown && value > 0) setShown(true)
            onLevel(value)
          }}
        />

        <span
          aria-hidden="true"
          className={cx(
            'w-12 shrink-0 text-right font-display text-[0.98rem] tabular-nums transition-colors duration-[120ms]',
            shown ? 'text-ink-muted' : 'text-ink-faint',
          )}
        >
          {shown ? percent(dragging ?? level) : 'Off'}
        </span>
      </div>

      {children}
    </li>
  )
}
