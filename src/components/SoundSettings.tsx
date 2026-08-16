import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { RAIN_CHARACTERS, isBuiltInAmbientId } from '../lib/ambient'
import { MAX_MUSIC_VOLUME } from '../lib/audioBus'
import { cx } from '../lib/cx'
import {
  chooseSound,
  isSoundChoiceActive,
  type SoundChoice,
} from '../lib/soundChoice'
import type { LoopSettings, SoundConfig, TrackMeta } from '../lib/types'
import { CheckIcon, MuteIcon, WaveIcon } from './Icons'
import { SegmentedControl } from './SegmentedControl'
import { Slider } from './Slider'
import { SoundScene } from './SoundScene'

interface SoundSettingsProps {
  settings: LoopSettings
  tracks: TrackMeta[]
  /** Applied at once — mid-session, this crossfades rather than restarting. */
  onSoundChange: (patch: Partial<SoundConfig>) => void
  onVolumeChange: (value: number) => void
  /** True while a session is running, so the panel can say so. */
  live?: boolean
}

/**
 * Choosing what plays behind your words.
 *
 * One list, one tap. It used to be three controls — a mode, then a list of
 * sounds, then the playlist somewhere else — and picking "Ocean Tide" meant
 * understanding that "One sound" had to be chosen first. Silence, every sound
 * in the library and the queued playlist are all rows of the same list now,
 * and choosing one sets whatever combination of mode and track id that
 * actually means.
 *
 * Everything here applies immediately, including mid-session: this is the
 * panel the player opens from its own corner, so it has to be safe to use
 * while listening. The library's Sounds tab is still where sounds are
 * imported, renamed and queued — there is a way through to it at the bottom.
 */
export function SoundSettings({
  settings,
  tracks,
  onSoundChange,
  onVolumeChange,
  live = false,
}: SoundSettingsProps) {
  const { sound } = settings

  const playlistNames = sound.playlist
    .map((id) => tracks.find((track) => track.id === id)?.name)
    .filter(Boolean) as string[]

  const rainChosen = sound.mode === 'single' && sound.trackId === 'rain-window'

  /*
   * Silence, every sound in the library, and the queue — one flat list, in the
   * order they are wanted in: off first because it is the one you reach for
   * mid-session, then the soundscapes, then your own files, then the playlist
   * if there is one. An empty "Playlist" row that plays nothing is a trap, so
   * it only appears once something is in it.
   */
  const choices: Array<{
    key: string
    choice: SoundChoice
    thumbnail: ReactNode
    name: string
    detail: string
  }> = [
    {
      key: 'off',
      choice: { kind: 'off' },
      thumbnail: (
        <Tile>
          <MuteIcon />
        </Tile>
      ),
      name: 'No sound',
      detail: 'Just your voice, and the room.',
    },
    ...tracks.map((track) => ({
      key: track.id,
      choice: { kind: 'track', id: track.id } as SoundChoice,
      thumbnail: isBuiltInAmbientId(track.id) ? (
        <SoundScene id={track.id} />
      ) : (
        <Tile>
          <WaveIcon />
        </Tile>
      ),
      name: track.name,
      detail:
        track.description ??
        (track.kind === 'custom' ? 'Your import' : 'Generated on this device'),
    })),
    ...(playlistNames.length > 0
      ? [
          {
            key: 'playlist',
            choice: { kind: 'playlist' } as SoundChoice,
            thumbnail: (
              <Tile>
                <span className="font-display text-[1.05rem] tabular-nums">
                  {playlistNames.length}
                </span>
              </Tile>
            ),
            name: 'Your playlist',
            detail: playlistNames.join(' \u00b7 '),
          },
        ]
      : []),
  ]

  return (
    <div className="space-y-5">
      <div role="radiogroup" aria-label="Background sound" className="space-y-2">
        {choices.map(({ key, choice, thumbnail, name, detail }) => (
          <ChoiceRow
            key={key}
            choice={choice}
            sound={sound}
            onChoose={onSoundChange}
            thumbnail={thumbnail}
            name={name}
            detail={detail}
          />
        ))}
      </div>

      {rainChosen && (
        <div>
          <p className="type-label mb-2.5">Rain character</p>
          <SegmentedControl
            label="Rain character"
            value={sound.rainCharacter}
            onChange={(rainCharacter) => onSoundChange({ rainCharacter })}
            segments={RAIN_CHARACTERS.map((value) => ({
              value,
              label: value.charAt(0).toUpperCase() + value.slice(1),
            }))}
          />
          <p className="mt-2 text-[0.82rem] leading-snug text-ink-faint">
            How dense and bright the rain is. No thunder, at any setting.
          </p>
        </div>
      )}

      {sound.mode === 'playlist' && (
        <div>
          <p className="type-label mb-2.5">Repeat</p>
          <SegmentedControl
            label="Repeat behaviour"
            value={sound.repeat}
            onChange={(repeat) => onSoundChange({ repeat })}
            segments={[
              { value: 'one', label: 'Repeat one' },
              { value: 'all', label: 'Repeat all' },
            ]}
          />
        </div>
      )}

      {sound.mode !== 'off' && (
        <Slider
          label="Sound level"
          min={0}
          max={MAX_MUSIC_VOLUME}
          step={0.05}
          value={settings.musicVolume}
          display={`${Math.round(settings.musicVolume * 100)}%`}
          hint="The master level for the whole bed. The Mixer, in the player's corner, gives each layer its own."
          onChange={onVolumeChange}
        />
      )}

      <p className="type-meta">
        {live
          ? 'Anything you change here takes effect straight away — the sound crossfades and your words carry on.'
          : 'The brainwave rhythm is separate from this, and plays even with the sound off.'}{' '}
        <Link
          to="/sounds"
          className="font-medium text-[var(--rose-deep)] underline underline-offset-4"
        >
          Import sounds or build a playlist
        </Link>
      </p>
    </div>
  )
}

interface ChoiceRowProps {
  choice: SoundChoice
  sound: SoundConfig
  onChoose: (patch: Partial<SoundConfig>) => void
  thumbnail: ReactNode
  name: string
  detail: string
}

/**
 * One pickable sound.
 *
 * A radio rather than a button with state, because that is what it is: exactly
 * one of these is in force at a time. The tick is spelled out in the label as
 * well as drawn, so the choice is never carried by colour alone — and tapping
 * the one already in force does nothing at all, rather than restarting the
 * sound you are listening to.
 */
function ChoiceRow({
  choice,
  sound,
  onChoose,
  thumbnail,
  name,
  detail,
}: ChoiceRowProps) {
  const selected = isSoundChoiceActive(sound, choice)

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={`${name}. ${detail}${selected ? '. Playing.' : ''}`}
      onClick={() => {
        if (selected) return
        onChoose(chooseSound(sound, choice))
      }}
      className={cx(
        'interactive flex w-full items-center gap-3 rounded-[1.15rem] border px-3 py-2.5 text-left',
        'transition-[background-color,border-color] duration-200',
        selected
          ? 'border-[var(--rose)] bg-[var(--rose-soft)]'
          : 'border-[var(--border)] bg-[var(--surface-sunken)] hover:border-[var(--border-strong)]',
      )}
    >
      {thumbnail}

      <span className="min-w-0 grow">
        <span className="block truncate text-[0.98rem] font-medium text-ink">
          {name}
        </span>
        <span className="mt-0.5 block truncate text-[0.84rem] text-ink-muted">
          {detail}
        </span>
      </span>

      {selected && (
        <span
          aria-hidden="true"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--rose-deep)] text-[0.8rem] text-[var(--bg-0)]"
        >
          <CheckIcon />
        </span>
      )}
    </button>
  )
}

/** A plain tile the size of a soundscape's scene, for the rows without one. */
function Tile({ children }: { children: ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        'flex h-[3.25rem] w-[3.25rem] shrink-0 items-center justify-center',
        'rounded-[0.9rem] border border-[var(--panel-border)] bg-[var(--quiet)]',
        'text-[1.15rem] text-ink-faint',
      )}
    >
      {children}
    </span>
  )
}
