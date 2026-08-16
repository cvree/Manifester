import { useMemo } from 'react'
import { AMBIENT_PRESETS, isBuiltInAmbientId } from '../lib/ambient'
import { MAX_MUSIC_VOLUME } from '../lib/audioBus'
import { cx } from '../lib/cx'
import { cue } from '../lib/feedback'
import {
  MAX_ACTIVE_LAYERS,
  activeSourceIds,
  hasLayer,
  mixerLayers,
  type MixerLayer,
} from '../lib/soundMixer'
import { MAX_VOICE_VOLUME } from '../lib/speech'
import { useLibrary } from '../state/LibraryProvider'
import { useSession } from '../state/SessionProvider'
import { MuteIcon, PlusIcon, SpeakerIcon, SpeakerOffIcon, WaveIcon } from './Icons'
import { Sheet } from './Sheet'
import { Slider } from './Slider'
import { SoundScene } from './SoundScene'

interface AmbienceMixerProps {
  open: boolean
  onClose: () => void
}

/**
 * The live mixing desk, one tap from the stage.
 *
 * ── What was wrong ──
 *
 * The background was one sound with one fader, and that fader also carried the
 * brainwave rhythm. So every question anybody actually had about the mix —
 * *can I have rain under the fire? can the tide be quieter than the pad over
 * it? can I drop the rhythm without losing the ambience?* — had the same
 * answer, which was no. The controls were not merely limited; they were tied
 * together, so moving one moved things nobody was asking about.
 *
 * ── What this is ──
 *
 * One row per thing making a sound, each with its own fader, its own mute, and
 * its own remembered level. Everything is live: a level is a ramp on a gain
 * node that already exists, so it arrives while your finger is still moving and
 * nothing is ever rebuilt to apply one. Adding a layer fades it up under what
 * is already playing; removing it fades it out. Nothing restarts, ever.
 *
 * The master ambience fader stays at the top. It is the right control nine
 * times out of ten, it scales the whole bed at once, and — the part that
 * matters — it does not replace the individual ones underneath it.
 *
 * ── Made for a thumb in the dark ──
 *
 * Every row is a full-width fader with a 44-pixel target and a mute button the
 * same size beside it, and every current value is written out as a number. This
 * is a control somebody reaches for with their eyes half shut, ten minutes into
 * a session, without wanting to look at the screen for longer than a second.
 */
export function AmbienceMixer({ open, onClose }: AmbienceMixerProps) {
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
  const { allTracks } = useLibrary()

  const { settings } = draft
  const { sound } = settings
  const live = session.status === 'playing'

  /*
   * The track the engine is *playing*, not the first of the queue. They differ
   * while a playlist is part-way through, and a fader labelled with one sound
   * while adjusting another is the exact confusion this panel exists to end.
   */
  const currentTrackId = useMemo(() => {
    if (sound.mode !== 'playlist' || !session.trackName) return null
    return (
      allTracks.find((track) => track.name === session.trackName)?.id ?? null
    )
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

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Mixer"
      description={
        live
          ? 'Every level here changes the sound you are listening to, as you move it.'
          : 'Set the balance now, and it is the balance your session starts with.'
      }
    >
      <div className="space-y-6">
        {/*
          The two levels that are about the whole room rather than one layer.
          They are first because they are what people reach for, and they are
          in the same panel as the individual faders because a mixer that hides
          the master somewhere else is a mixer you have to leave to use.
        */}
        <section className="space-y-5" aria-label="Overall levels">
          <Slider
            size="lg"
            label="Voice"
            min={0}
            max={MAX_VOICE_VOLUME}
            step={0.05}
            value={settings.voiceVolume}
            display={`${Math.round(settings.voiceVolume * 100)}%`}
            onChange={setLiveVoiceVolume}
          />
          <Slider
            size="lg"
            label="All background sound"
            min={0}
            max={MAX_MUSIC_VOLUME}
            step={0.05}
            value={settings.musicVolume}
            display={`${Math.round(settings.musicVolume * 100)}%`}
            hint="The master level. Each layer below keeps its own balance under it."
            onChange={setLiveMusicVolume}
          />
        </section>

        <section aria-label="Background layers" className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="type-label">Layers</h3>
            <span className="type-meta">
              {layers.length} of {MAX_ACTIVE_LAYERS}
            </span>
          </div>

          {layers.length === 0 ? (
            <p className="type-meta">
              No background sound yet. Add one below and it fades in under your
              words.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {layers.map((layer) => (
                <LayerRow
                  key={layer.id}
                  layer={layer}
                  onLevel={(level) => setLayerLevel(layer.id, level)}
                  onMute={(muted) => {
                    cue('tap')
                    setLayerMuted(layer.id, muted)
                  }}
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

          {/*
            The rhythm is a background source like any other and belongs in the
            same list, with the same two controls. It was previously governed by
            the one shared "Sound" level and a panel three taps away, which is
            how somebody ends up turning the ambience down to quiet the rhythm.
          */}
          <RhythmRow
            enabled={settings.brainwave.enabled}
            level={settings.brainwave.volume}
            onLevel={(volume) => setBrainwave({ volume, enabled: true })}
            onMute={(muted) => {
              cue('tap')
              setBrainwave({ enabled: !muted })
            }}
          />
        </section>

        {addable.length > 0 && (
          <section aria-label="Add a layer" className="space-y-2.5">
            <h3 className="type-label">Add a layer</h3>
            <p className="type-meta -mt-1">
              Generated soundscapes stack. Each one arrives with a fade and gets
              its own level.
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
                    }}
                    className={cx(
                      'interactive inline-flex min-h-11 items-center gap-2 rounded-pill border px-4',
                      'text-[0.9rem] font-medium transition-colors',
                      canAdd
                        ? 'border-[var(--control-border)] text-ink-muted hover:bg-[var(--quiet)] hover:text-ink'
                        : 'cursor-not-allowed border-[var(--border)] text-ink-faint opacity-50',
                    )}
                  >
                    <PlusIcon className="text-[0.8rem]" />
                    {preset.name}
                  </button>
                </li>
              ))}
            </ul>
            {!canAdd && (
              <p className="type-meta">
                {MAX_ACTIVE_LAYERS} layers is the most this device generates at
                once. Remove one to add another.
              </p>
            )}
          </section>
        )}
      </div>
    </Sheet>
  )
}

interface LayerRowProps {
  layer: MixerLayer
  onLevel: (level: number) => void
  onMute: (muted: boolean) => void
  /** Absent for the main sound, which is changed in Background sound instead. */
  onRemove?: () => void
}

/**
 * One source, one fader, one mute.
 *
 * The mute is a real button rather than a level of zero, and the two are kept
 * apart deliberately: muting has to be reversible without asking somebody to
 * remember the level they were at. Moving the fader while muted unmutes,
 * because a slider that visibly does nothing is worse than an unmute nobody
 * asked for out loud.
 */
function LayerRow({ layer, onLevel, onMute, onRemove }: LayerRowProps) {
  const percent = Math.round(layer.level * 100)

  return (
    <li
      className={cx(
        'rounded-[1.15rem] border px-3 py-3 transition-colors duration-300',
        layer.muted
          ? 'border-[var(--border)] bg-[var(--quiet)]'
          : 'border-[var(--border)] bg-[var(--surface-sunken)]',
      )}
    >
      <div className="flex items-center gap-3">
        {layer.imported || !isBuiltInAmbientId(layer.id) ? (
          <span
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.8rem] border border-[var(--panel-border)] bg-[var(--quiet)] text-[1rem] text-ink-faint"
          >
            <WaveIcon />
          </span>
        ) : (
          <SoundScene id={layer.id} className="h-10 w-10 shrink-0 rounded-[0.8rem]" />
        )}

        <span className="min-w-0 grow">
          <span
            className={cx(
              'block truncate text-[0.98rem] font-medium',
              layer.muted ? 'text-ink-faint' : 'text-ink',
            )}
          >
            {layer.name}
          </span>
          <span className="mt-0.5 block truncate text-[0.82rem] text-ink-muted">
            {layer.muted ? 'Muted' : layer.detail}
          </span>
        </span>

        {/*
          Both buttons are 44 square. This panel is used one-handed, in the
          dark, without looking — a 32-pixel icon button is a control you miss
          and then have to look at the screen to find.
        */}
        <button
          type="button"
          onClick={() => onMute(!layer.muted)}
          aria-pressed={layer.muted}
          aria-label={`${layer.muted ? 'Unmute' : 'Mute'} ${layer.name}`}
          className={cx(
            'interactive flex h-11 w-11 shrink-0 items-center justify-center rounded-full border text-[1rem]',
            layer.muted
              ? 'border-[var(--rose)] bg-[var(--rose-soft)] text-[var(--rose-deep)]'
              : 'border-[var(--control-border)] text-ink-muted hover:text-ink',
          )}
        >
          {layer.muted ? <SpeakerOffIcon /> : <SpeakerIcon />}
        </button>

        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${layer.name} from the mix`}
            className="interactive flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--control-border)] text-[1.15rem] text-ink-faint hover:text-ink"
          >
            <span aria-hidden="true">−</span>
          </button>
        )}
      </div>

      <Slider
        size="lg"
        className="mt-1.5"
        label={`${layer.name} level`}
        hideLabel
        min={0}
        max={1}
        step={0.02}
        value={layer.level}
        display={layer.muted ? `${percent}% · muted` : `${percent}%`}
        onChange={onLevel}
      />
    </li>
  )
}

interface RhythmRowProps {
  enabled: boolean
  level: number
  onLevel: (level: number) => void
  onMute: (muted: boolean) => void
}

function RhythmRow({ enabled, level, onLevel, onMute }: RhythmRowProps) {
  const percent = Math.round(level * 100)

  return (
    <div
      className={cx(
        'rounded-[1.15rem] border px-3 py-3 transition-colors duration-300',
        enabled
          ? 'border-[var(--border)] bg-[var(--surface-sunken)]'
          : 'border-[var(--border)] bg-[var(--quiet)]',
      )}
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.8rem] border border-[var(--panel-border)] bg-[var(--quiet)] text-[1rem] text-ink-faint"
        >
          <MuteIcon />
        </span>
        <span className="min-w-0 grow">
          <span
            className={cx(
              'block truncate text-[0.98rem] font-medium',
              enabled ? 'text-ink' : 'text-ink-faint',
            )}
          >
            Brainwave rhythm
          </span>
          <span className="mt-0.5 block truncate text-[0.82rem] text-ink-muted">
            {enabled ? 'Its own level, under the ambience' : 'Off'}
          </span>
        </span>
        <button
          type="button"
          onClick={() => onMute(enabled)}
          aria-pressed={!enabled}
          aria-label={`${enabled ? 'Mute' : 'Unmute'} the brainwave rhythm`}
          className={cx(
            'interactive flex h-11 w-11 shrink-0 items-center justify-center rounded-full border text-[1rem]',
            enabled
              ? 'border-[var(--control-border)] text-ink-muted hover:text-ink'
              : 'border-[var(--rose)] bg-[var(--rose-soft)] text-[var(--rose-deep)]',
          )}
        >
          {enabled ? <SpeakerIcon /> : <SpeakerOffIcon />}
        </button>
      </div>

      <Slider
        size="lg"
        className="mt-1.5"
        label="Brainwave rhythm level"
        hideLabel
        min={0}
        max={1}
        step={0.02}
        value={level}
        display={enabled ? `${percent}%` : `${percent}% · off`}
        onChange={onLevel}
      />
    </div>
  )
}
