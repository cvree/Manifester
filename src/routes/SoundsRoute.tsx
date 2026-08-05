import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '../components/Button'
import { Card, FieldLabel } from '../components/Card'
import { EmptyState } from '../components/EmptyState'
import { IconButton } from '../components/IconButton'
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CloseIcon,
  PauseIcon,
  PencilIcon,
  PlayIcon,
  PlusIcon,
  TrashIcon,
  UploadIcon,
  WaveIcon,
} from '../components/Icons'
import { SegmentedControl } from '../components/SegmentedControl'
import { TextField } from '../components/TextArea'
import { MusicEngine, type TrackSource } from '../lib/audio'
import { AudioBus } from '../lib/audioBus'
import { cx } from '../lib/cx'
import { formatApproxDuration, formatBytes } from '../lib/format'
import { estimateUsage, getCustomTrack } from '../lib/storage'
import { MAX_TRACK_BYTES, type TrackMeta } from '../lib/types'
import { useLibrary } from '../state/LibraryProvider'
import { useSession } from '../state/SessionProvider'

export function SoundsRoute() {
  const {
    builtinTracks,
    customTracks,
    allTracks,
    importTracks,
    renameTrack,
    removeTrack,
  } = useLibrary()
  const { draft, updateSettings } = useSession()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const previewRef = useRef<MusicEngine | null>(null)
  // Auditioning a sound runs on its own bus so it never disturbs a live session.
  const previewBusRef = useRef<AudioBus | null>(null)

  const [previewId, setPreviewId] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [notes, setNotes] = useState<string[]>([])
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [usage, setUsage] = useState<string | null>(null)

  const { sound } = draft.settings

  if (!previewBusRef.current) previewBusRef.current = new AudioBus()
  if (!previewRef.current) {
    previewRef.current = new MusicEngine(previewBusRef.current)
  }

  useEffect(() => {
    const engine = previewRef.current
    const bus = previewBusRef.current
    return () => {
      engine?.dispose()
      bus?.close()
    }
  }, [])

  useEffect(() => {
    void estimateUsage().then((result) => {
      if (result && result.usageBytes > 0) {
        setUsage(`${formatBytes(result.usageBytes)} used on this device`)
      }
    })
  }, [customTracks.length])

  const stopPreview = useCallback(() => {
    previewRef.current?.stop(300)
    setPreviewId(null)
  }, [])

  const togglePreview = useCallback(
    async (track: TrackMeta) => {
      const engine = previewRef.current
      if (!engine) return

      if (previewId === track.id) {
        stopPreview()
        return
      }

      engine.unlock()
      engine.setVolume(Math.max(0.35, draft.settings.musicVolume))
      setPreviewId(track.id)

      let source: TrackSource
      if (track.kind === 'builtin') {
        source = { id: track.id, name: track.name, kind: 'builtin', presetId: track.id }
      } else {
        const stored = await getCustomTrack(track.id)
        if (!stored) {
          setPreviewId(null)
          return
        }
        source = { id: stored.id, name: stored.name, kind: 'custom', blob: stored.blob }
      }

      await engine.play([source], 'one')
    },
    [draft.settings.musicVolume, previewId, stopPreview],
  )

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return
      setImporting(true)
      const result = await importTracks(files)
      setImporting(false)
      setNotes(
        result.skipped.length > 0
          ? result.skipped
          : [`Added ${result.added} sound${result.added === 1 ? '' : 's'}.`],
      )
      window.setTimeout(() => setNotes([]), 6000)
      if (fileInputRef.current) fileInputRef.current.value = ''
    },
    [importTracks],
  )

  const inPlaylist = (id: string) => sound.playlist.includes(id)

  const togglePlaylist = (id: string) => {
    const playlist = inPlaylist(id)
      ? sound.playlist.filter((item) => item !== id)
      : [...sound.playlist, id]
    updateSettings({ sound: { ...sound, playlist, mode: 'playlist' } })
  }

  const movePlaylistItem = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= sound.playlist.length) return
    const playlist = [...sound.playlist]
    const [moved] = playlist.splice(index, 1)
    playlist.splice(target, 0, moved)
    updateSettings({ sound: { ...sound, playlist } })
  }

  const handleDelete = async (track: TrackMeta) => {
    if (previewId === track.id) stopPreview()
    await removeTrack(track.id)
    const playlist = sound.playlist.filter((id) => id !== track.id)
    updateSettings({
      sound: {
        ...sound,
        playlist,
        trackId: sound.trackId === track.id ? 'moon-garden' : sound.trackId,
      },
    })
  }

  return (
    <div className="space-y-5">
      <section data-rise className="pt-2 pb-1">
        <h1 className="font-display text-[2rem] leading-tight text-ink">Sounds</h1>
        <p className="mt-2 max-w-[42ch] text-[1rem] leading-relaxed text-ink-muted">
          Two ambiences come built in. You can also bring your own audio — it stays
          on this device.
        </p>
      </section>

      <Card
        data-rise
        title="Built in"
        description="Generated live in your browser, so they always work offline."
      >
        <div className="space-y-2">
          {builtinTracks.map((track) => (
            <TrackRow
              key={track.id}
              track={track}
              playing={previewId === track.id}
              selected={sound.mode === 'single' && sound.trackId === track.id}
              inPlaylist={inPlaylist(track.id)}
              onPreview={() => void togglePreview(track)}
              onSelect={() =>
                updateSettings({
                  sound: { ...sound, mode: 'single', trackId: track.id },
                })
              }
              onTogglePlaylist={() => togglePlaylist(track.id)}
            />
          ))}
        </div>
      </Card>

      <Card
        data-rise
        title="Your sounds"
        description={`Audio files up to ${formatBytes(MAX_TRACK_BYTES)} each.`}
        action={
          <Button
            variant="secondary"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            leading={<UploadIcon className="text-[0.95rem]" />}
          >
            {importing ? 'Adding…' : 'Import'}
          </Button>
        }
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*,.mp3,.m4a,.wav,.ogg,.aac,.flac"
          multiple
          className="sr-only"
          onChange={(event) => void handleFiles(event.target.files)}
        />

        {notes.length > 0 && (
          <ul className="mb-4 space-y-1 rounded-2xl border border-[var(--border)] bg-[var(--gold-soft)] px-4 py-3 text-[0.88rem] leading-relaxed text-ink">
            {notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        )}

        {customTracks.length === 0 ? (
          <EmptyState
            icon={<WaveIcon />}
            title="No imported sounds"
            description="Bring in music or ambience you already own. Please only use audio you have the right to use."
            action={
              <Button variant="primary" onClick={() => fileInputRef.current?.click()}>
                Choose audio files
              </Button>
            }
          />
        ) : (
          <div className="space-y-2">
            {customTracks.map((track) =>
              renamingId === track.id ? (
                <div key={track.id} className="flex items-center gap-2">
                  <TextField
                    autoFocus
                    aria-label={`Rename ${track.name}`}
                    value={renameValue}
                    onChange={(event) => setRenameValue(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        void renameTrack(track.id, renameValue)
                        setRenamingId(null)
                      }
                      if (event.key === 'Escape') setRenamingId(null)
                    }}
                  />
                  <Button
                    variant="primary"
                    onClick={() => {
                      void renameTrack(track.id, renameValue)
                      setRenamingId(null)
                    }}
                  >
                    Save
                  </Button>
                </div>
              ) : (
                <TrackRow
                  key={track.id}
                  track={track}
                  playing={previewId === track.id}
                  selected={sound.mode === 'single' && sound.trackId === track.id}
                  inPlaylist={inPlaylist(track.id)}
                  onPreview={() => void togglePreview(track)}
                  onSelect={() =>
                    updateSettings({
                      sound: { ...sound, mode: 'single', trackId: track.id },
                    })
                  }
                  onTogglePlaylist={() => togglePlaylist(track.id)}
                  onRename={() => {
                    setRenamingId(track.id)
                    setRenameValue(track.name)
                  }}
                  onDelete={() => void handleDelete(track)}
                />
              ),
            )}
          </div>
        )}

        {usage && (
          <p className="mt-4 text-[0.82rem] text-ink-faint">{usage}</p>
        )}
      </Card>

      <Card
        data-rise
        title="Playlist"
        description="Plays in this order behind your words."
      >
        {sound.playlist.length === 0 ? (
          <p className="rounded-2xl border border-[var(--border)] bg-[var(--surface-sunken)] px-4 py-3.5 text-[0.92rem] leading-relaxed text-ink-muted">
            Nothing queued yet. Use the + button on any sound above to add it.
          </p>
        ) : (
          <ol className="space-y-2">
            {sound.playlist.map((id, index) => {
              const track = allTracks.find((item) => item.id === id)
              return (
                <li
                  key={`${id}-${index}`}
                  className="flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-sunken)] px-3 py-2.5"
                >
                  <span className="w-6 shrink-0 text-center font-display text-[1rem] tabular-nums text-ink-faint">
                    {index + 1}
                  </span>
                  <span className="min-w-0 grow truncate text-[0.95rem] text-ink">
                    {track?.name ?? 'Missing sound'}
                  </span>
                  <IconButton
                    label={`Move ${track?.name ?? 'item'} earlier`}
                    icon={<ArrowUpIcon />}
                    disabled={index === 0}
                    onClick={() => movePlaylistItem(index, -1)}
                  />
                  <IconButton
                    label={`Move ${track?.name ?? 'item'} later`}
                    icon={<ArrowDownIcon />}
                    disabled={index === sound.playlist.length - 1}
                    onClick={() => movePlaylistItem(index, 1)}
                  />
                  <IconButton
                    label={`Remove ${track?.name ?? 'item'} from the playlist`}
                    icon={<CloseIcon />}
                    onClick={() =>
                      updateSettings({
                        sound: {
                          ...sound,
                          playlist: sound.playlist.filter((_, i) => i !== index),
                        },
                      })
                    }
                  />
                </li>
              )
            })}
          </ol>
        )}

        <div className="mt-5 space-y-4">
          <div>
            <FieldLabel>Repeat</FieldLabel>
            <SegmentedControl
              label="Repeat behaviour"
              value={sound.repeat}
              onChange={(repeat) => updateSettings({ sound: { ...sound, repeat } })}
              segments={[
                { value: 'one', label: 'Repeat one' },
                { value: 'all', label: 'Repeat all' },
              ]}
            />
            <p className="mt-2 text-[0.82rem] leading-snug text-ink-faint">
              {sound.repeat === 'one'
                ? 'The current sound loops on its own.'
                : 'Plays through the list, then starts again from the top.'}
            </p>
          </div>

          <div>
            <FieldLabel>Use in this loop</FieldLabel>
            <SegmentedControl
              label="Background sound mode"
              value={sound.mode}
              onChange={(mode) => updateSettings({ sound: { ...sound, mode } })}
              segments={[
                { value: 'off', label: 'No sound' },
                { value: 'single', label: 'One sound' },
                { value: 'playlist', label: 'Playlist' },
              ]}
            />
          </div>
        </div>
      </Card>

      <p className="px-1 pb-2 text-center text-[0.82rem] leading-relaxed text-ink-faint">
        Manifester ships with no third-party audio. The built-in ambiences are
        synthesised in your browser, and imported files never leave your device.
      </p>
    </div>
  )
}

interface TrackRowProps {
  track: TrackMeta
  playing: boolean
  selected: boolean
  inPlaylist: boolean
  onPreview: () => void
  onSelect: () => void
  onTogglePlaylist: () => void
  onRename?: () => void
  onDelete?: () => void
}

function TrackRow({
  track,
  playing,
  selected,
  inPlaylist,
  onPreview,
  onSelect,
  onTogglePlaylist,
  onRename,
  onDelete,
}: TrackRowProps) {
  const meta = [
    track.description,
    track.durationSeconds ? formatApproxDuration(track.durationSeconds) : null,
    track.sizeBytes ? formatBytes(track.sizeBytes) : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div
      className={cx(
        'flex items-center gap-2 rounded-2xl border px-3 py-2.5 transition-colors duration-200',
        selected
          ? 'border-[var(--rose)] bg-[var(--rose-soft)]'
          : 'border-[var(--border)] bg-[var(--surface-sunken)]',
      )}
    >
      <IconButton
        label={playing ? `Stop previewing ${track.name}` : `Preview ${track.name}`}
        icon={playing ? <PauseIcon /> : <PlayIcon />}
        onClick={onPreview}
        className={playing ? 'border-[var(--rose)] text-[var(--rose-deep)]' : undefined}
      />

      <button
        type="button"
        onClick={onSelect}
        className="min-w-0 grow py-1 text-left"
        aria-pressed={selected}
      >
        <span className="block truncate text-[0.98rem] font-medium text-ink">
          {track.name}
        </span>
        {meta && (
          <span className="block truncate text-[0.82rem] text-ink-muted">{meta}</span>
        )}
      </button>

      <IconButton
        label={
          inPlaylist
            ? `Remove ${track.name} from the playlist`
            : `Add ${track.name} to the playlist`
        }
        icon={inPlaylist ? <TrashIcon /> : <PlusIcon />}
        onClick={onTogglePlaylist}
        className={inPlaylist ? 'border-[var(--sage)] text-[var(--sage)]' : undefined}
      />

      {onRename && (
        <IconButton label={`Rename ${track.name}`} icon={<PencilIcon />} onClick={onRename} />
      )}
      {onDelete && (
        <IconButton
          label={`Delete ${track.name}`}
          icon={<CloseIcon />}
          tone="danger"
          onClick={onDelete}
        />
      )}
    </div>
  )
}
