import { Link } from 'react-router'
import { cx } from '../lib/cx'
import type { LoopSettings, SoundConfig, TrackMeta } from '../lib/types'
import { SegmentedControl } from './SegmentedControl'
import { Slider } from './Slider'

interface SoundSettingsProps {
  settings: LoopSettings
  tracks: TrackMeta[]
  onChange: (patch: Partial<LoopSettings>) => void
}

export function SoundSettings({ settings, tracks, onChange }: SoundSettingsProps) {
  const { sound } = settings

  const patchSound = (patch: Partial<SoundConfig>) =>
    onChange({ sound: { ...sound, ...patch } as SoundConfig })

  const playlistNames = sound.playlist
    .map((id) => tracks.find((track) => track.id === id)?.name)
    .filter(Boolean) as string[]

  return (
    <div className="space-y-5">
      <SegmentedControl
        label="Background sound"
        value={sound.mode}
        onChange={(mode) => patchSound({ mode })}
        segments={[
          { value: 'off', label: 'No sound' },
          { value: 'single', label: 'One sound' },
          { value: 'playlist', label: 'Playlist' },
        ]}
      />

      {sound.mode === 'single' && (
        <div className="space-y-2">
          {tracks.map((track) => {
            const selected = sound.trackId === track.id
            return (
              <button
                key={track.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => patchSound({ trackId: track.id })}
                className={cx(
                  'flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left',
                  'transition-[background-color,border-color] duration-200',
                  selected
                    ? 'border-[var(--rose)] bg-[var(--rose-soft)]'
                    : 'border-[var(--border)] bg-[var(--surface-sunken)] hover:border-[var(--border-strong)]',
                )}
              >
                <span
                  aria-hidden="true"
                  className={cx(
                    'h-3 w-3 shrink-0 rounded-full border-2',
                    selected
                      ? 'border-[var(--rose-deep)] bg-[var(--rose-deep)]'
                      : 'border-[var(--border-strong)]',
                  )}
                />
                <span className="min-w-0">
                  <span className="block truncate text-[0.98rem] font-medium text-ink">
                    {track.name}
                  </span>
                  <span className="block truncate text-[0.84rem] text-ink-muted">
                    {track.description ??
                      (track.kind === 'custom' ? 'Your import' : 'Built in')}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      )}

      {sound.mode === 'playlist' && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-sunken)] px-4 py-3.5">
          {playlistNames.length > 0 ? (
            <>
              <p className="text-[0.95rem] font-medium text-ink">
                {playlistNames.length} sound
                {playlistNames.length === 1 ? '' : 's'} queued
              </p>
              <p className="mt-1 line-clamp-2 text-[0.85rem] leading-snug text-ink-muted">
                {playlistNames.join(' · ')}
              </p>
            </>
          ) : (
            <p className="text-[0.9rem] leading-relaxed text-ink-muted">
              Your playlist is empty.
            </p>
          )}
          <Link
            to="/sounds"
            className="mt-3 inline-flex min-h-11 items-center text-[0.92rem] font-medium text-[var(--rose-deep)] underline underline-offset-4"
          >
            Build the playlist in Sounds
          </Link>
        </div>
      )}

      {sound.mode !== 'off' && (
        <>
          <SegmentedControl
            label="Repeat behaviour"
            value={sound.repeat}
            onChange={(repeat) => patchSound({ repeat })}
            segments={[
              { value: 'one', label: 'Repeat one' },
              { value: 'all', label: 'Repeat all' },
            ]}
          />

          <Slider
            label="Sound volume"
            min={0}
            max={1}
            step={0.05}
            value={settings.musicVolume}
            display={`${Math.round(settings.musicVolume * 100)}%`}
            hint="Keep this well under the voice so the words stay clear."
            onChange={(musicVolume) => onChange({ musicVolume })}
          />
        </>
      )}
    </div>
  )
}
