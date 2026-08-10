import { useCallback, useEffect, useRef, useState } from 'react'
import { BrainwavePanel } from '../components/BrainwavePanel'
import { Button } from '../components/Button'
import { Card, FieldLabel } from '../components/Card'
import { EmptyState } from '../components/EmptyState'
import { IconButton } from '../components/IconButton'
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckIcon,
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
import { SoundScene } from '../components/SoundScene'
import { TextField } from '../components/TextArea'
import {
  RAIN_CHARACTERS,
  isBuiltInAmbientId,
  type BuiltInAmbientId,
  type RainCharacter,
} from '../lib/ambient'
import { MusicEngine, type TrackSource } from '../lib/audio'
import { AudioBus } from '../lib/audioBus'
import { BrainwaveVoice } from '../lib/brainwaveAudio'
import { cx } from '../lib/cx'
import { formatApproxDuration, formatBytes } from '../lib/format'
import { estimateUsage, getCustomTrack } from '../lib/storage'
import { MAX_TRACK_BYTES, type TrackMeta } from '../lib/types'
import { useLibrary } from '../state/LibraryProvider'
import { useSession } from '../state/SessionProvider'

const RAIN_LABELS: Record<RainCharacter, string> = {
  soft: 'Soft',
  steady: 'Steady',
  full: 'Full',
}

const RAIN_HINTS: Record<RainCharacter, string> = {
  soft: 'Fewer, quieter drops and a darker bed.',
  steady: 'The everyday setting — even rainfall on the glass.',
  full: 'Denser and brighter, with more warmth underneath.',
}

export function SoundsSection() {
  const {
    builtinTracks,
    customTracks,
    allTracks,
    importTracks,
    renameTrack,
    removeTrack,
  } = useLibrary()
  /*
   * `setLiveSound` rather than `updateSettings`, everywhere the sound is
   * chosen here.
   *
   * This tab is a perfectly good place to change what you are listening to —
   * it is the one with every soundscape, the previews and the playlist in it —
   * and until now a session running in the background carried on with the old
   * sound regardless, so the only way to hear a change was to stop and start
   * again. Each of these now crossfades under a running loop, and is an
   * ordinary settings edit when nothing is playing.
   */
  const { draft, setLiveSound, setBrainwave } = useSession()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const previewRef = useRef<MusicEngine | null>(null)
  // Auditioning a sound runs on its own bus so it never disturbs a live session.
  const previewBusRef = useRef<AudioBus | null>(null)
  const rhythmPreviewRef = useRef<BrainwaveVoice | null>(null)

  const [previewId, setPreviewId] = useState<string | null>(null)
  const [rhythmPreviewing, setRhythmPreviewing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [notes, setNotes] = useState<string[]>([])
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [usage, setUsage] = useState<string | null>(null)

  const { sound, brainwave } = draft.settings

  if (!previewBusRef.current) previewBusRef.current = new AudioBus()
  if (!previewRef.current) {
    previewRef.current = new MusicEngine(previewBusRef.current)
  }
  if (!rhythmPreviewRef.current) {
    rhythmPreviewRef.current = new BrainwaveVoice(previewBusRef.current)
  }

  useEffect(() => {
    const engine = previewRef.current
    const rhythm = rhythmPreviewRef.current
    const bus = previewBusRef.current
    return () => {
      engine?.dispose()
      rhythm?.dispose()
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
      // Previews open at a moderate level whatever the loop is set to.
      engine.setVolume(Math.min(0.6, Math.max(0.35, draft.settings.musicVolume)))
      engine.setAmbienceOptions({ rainCharacter: sound.rainCharacter })
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
    [draft.settings.musicVolume, previewId, sound.rainCharacter, stopPreview],
  )

  /** Keep a running rain preview in step with the character control. */
  useEffect(() => {
    previewRef.current?.setAmbienceOptions({ rainCharacter: sound.rainCharacter })
  }, [sound.rainCharacter])

  /**
   * Change a rhythm setting and let the person hear the result immediately.
   *
   * Choosing a rhythm and then having to find a Preview button was two steps
   * for one intention. Selecting anything other than Off now starts the sound
   * on the spot; selecting Off stops it. This is safe to do here because the
   * handler is reached synchronously from the tap that chose the preset, which
   * is the only moment a browser will let an AudioContext start.
   */
  const changeRhythm = useCallback(
    (patch: Partial<typeof brainwave>) => {
      setBrainwave(patch)

      const voice = rhythmPreviewRef.current
      const bus = previewBusRef.current
      if (!voice || !bus) return

      if (patch.enabled === false) {
        voice.stop()
        setRhythmPreviewing(false)
        return
      }

      // Turning it on, or switching preset while on. Anything else (volume,
      // depth, mode) is already followed by the effect below.
      if (patch.enabled === true) {
        bus.ensure()
        bus.setMusicVolume(Math.min(0.6, Math.max(0.35, draft.settings.musicVolume)))
        voice.apply({ ...brainwave, ...patch, enabled: true })
        setRhythmPreviewing(true)
      }
    },
    [brainwave, draft.settings.musicVolume, setBrainwave],
  )

  const toggleRhythmPreview = useCallback(() => {
    const voice = rhythmPreviewRef.current
    const bus = previewBusRef.current
    if (!voice || !bus) return

    if (rhythmPreviewing) {
      voice.stop()
      setRhythmPreviewing(false)
      return
    }

    // Reached synchronously from the tap, so the context is allowed to start.
    bus.ensure()
    bus.setMusicVolume(Math.min(0.6, Math.max(0.35, draft.settings.musicVolume)))
    voice.apply({ ...brainwave, enabled: true })
    setRhythmPreviewing(true)
  }, [brainwave, draft.settings.musicVolume, rhythmPreviewing])

  /** A live rhythm preview follows the controls as they move. */
  useEffect(() => {
    if (!rhythmPreviewing) return
    rhythmPreviewRef.current?.apply({ ...brainwave, enabled: true })
  }, [brainwave, rhythmPreviewing])

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
    setLiveSound({ playlist, mode: 'playlist' })
  }

  const movePlaylistItem = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= sound.playlist.length) return
    const playlist = [...sound.playlist]
    const [moved] = playlist.splice(index, 1)
    playlist.splice(target, 0, moved)
    setLiveSound({ playlist })
  }

  const handleDelete = async (track: TrackMeta) => {
    if (previewId === track.id) stopPreview()
    await removeTrack(track.id)
    const playlist = sound.playlist.filter((id) => id !== track.id)
    setLiveSound({
      playlist,
      trackId: sound.trackId === track.id ? 'moon-garden' : sound.trackId,
    })
  }

  const rainSelected =
    (sound.mode === 'single' && sound.trackId === 'rain-window') ||
    inPlaylist('rain-window') ||
    previewId === 'rain-window'

  return (
    <div className="space-y-6 lg:grid lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start lg:gap-8 lg:space-y-0">
      <div className="space-y-6 lg:col-start-1">
        <Card
          data-rise
          level="stage"
          title="Built in"
          description="Generated live in your browser, so they always work offline. None of these are recordings."
        >
          <div
            role="radiogroup"
            aria-label="Built-in ambience"
            className="space-y-2.5"
          >
            {builtinTracks.map((track) => (
              <AmbienceCard
                key={track.id}
                track={track}
                playing={previewId === track.id}
                selected={sound.mode === 'single' && sound.trackId === track.id}
                inPlaylist={inPlaylist(track.id)}
                onPreview={() => void togglePreview(track)}
                onSelect={() => setLiveSound({ mode: 'single', trackId: track.id })}
                onTogglePlaylist={() => togglePlaylist(track.id)}
              />
            ))}
          </div>

          {rainSelected && (
            <div className="mt-5 border-t border-[var(--quiet-border)] pt-5">
              <FieldLabel hint="Rain on Window">Rain character</FieldLabel>
              <SegmentedControl
                label="Rain character"
                value={sound.rainCharacter}
                onChange={(rainCharacter) => setLiveSound({ rainCharacter })}
                segments={RAIN_CHARACTERS.map((value) => ({
                  value,
                  label: RAIN_LABELS[value],
                }))}
              />
              <p className="mt-2 text-[0.82rem] leading-snug text-ink-faint">
                {RAIN_HINTS[sound.rainCharacter]} No thunder, at any setting.
              </p>
            </div>
          )}

          <p className="type-meta mt-5">
            Whichever you pick, please choose a listening level that feels
            comfortable — these are meant to sit under your words, not over them.
          </p>
        </Card>

        <Card
          data-rise
          title="Brainwave rhythm"
          description="A generated rhythm that can play on its own or under an ambience."
        >
          <BrainwavePanel
            settings={brainwave}
            onChange={changeRhythm}
            previewing={rhythmPreviewing}
            onTogglePreview={toggleRhythmPreview}
            autoPlays
          />
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
                    onSelect={() => setLiveSound({ mode: 'single', trackId: track.id })}
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

          {usage && <p className="mt-4 text-[0.82rem] text-ink-faint">{usage}</p>}
        </Card>
      </div>

      <Card
        data-rise
        className="lg:sticky lg:top-6 lg:col-start-2"
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
                      setLiveSound({
                        playlist: sound.playlist.filter((_, i) => i !== index),
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
              onChange={(repeat) => setLiveSound({ repeat })}
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
              onChange={(mode) => setLiveSound({ mode })}
              segments={[
                { value: 'off', label: 'No sound' },
                { value: 'single', label: 'One sound' },
                { value: 'playlist', label: 'Playlist' },
              ]}
            />
            <p className="mt-2 text-[0.82rem] leading-snug text-ink-faint">
              The brainwave rhythm is separate from this, and stays on even with
              ambience turned off.
            </p>
          </div>
        </div>
      </Card>

      <p className="px-1 pb-2 text-center text-[0.82rem] leading-relaxed text-ink-faint lg:col-span-2">
        Manifester ships with no third-party audio. Every built-in ambience and
        rhythm is synthesised in your browser as it plays, and imported files
        never leave your device.
      </p>
    </div>
  )
}

interface AmbienceCardProps {
  track: TrackMeta
  playing: boolean
  selected: boolean
  inPlaylist: boolean
  onPreview: () => void
  onSelect: () => void
  onTogglePlaylist: () => void
}

/**
 * One built-in soundscape.
 *
 * The scene on the left is decoration; the name, the sentence under it and the
 * word "Selected" are what actually carry the state.
 */
function AmbienceCard({
  track,
  playing,
  selected,
  inPlaylist,
  onPreview,
  onSelect,
  onTogglePlaylist,
}: AmbienceCardProps) {
  const sceneId: BuiltInAmbientId | null = isBuiltInAmbientId(track.id)
    ? track.id
    : null

  return (
    <div
      className={cx(
        'rounded-[1.15rem] border px-3 py-3 transition-colors duration-200',
        selected
          ? 'border-[var(--rose)] bg-[var(--rose-soft)]'
          : 'border-[var(--border)] bg-[var(--surface-sunken)]',
      )}
    >
      <div className="flex items-start gap-3">
        {sceneId && <SoundScene id={sceneId} />}

        <button
          type="button"
          role="radio"
          aria-checked={selected}
          /*
           * Spelled out rather than left to the contents, which would otherwise
           * run the name, the sentence, the badge and the word "Selected"
           * together into one unpunctuated string.
           */
          aria-label={[
            track.name,
            track.description,
            'Generated on this device.',
            selected ? 'Selected.' : null,
          ]
            .filter(Boolean)
            .join(' ')}
          onClick={onSelect}
          className="interactive min-w-0 grow rounded-[0.85rem] py-0.5 text-left"
        >
          <span className="flex items-center gap-2">
            <span className="truncate text-[1rem] font-medium text-ink">
              {track.name}
            </span>
            {selected && (
              <span className="inline-flex shrink-0 items-center gap-1 text-[0.72rem] font-medium tracking-[0.06em] text-[var(--rose-deep)] uppercase">
                <CheckIcon className="text-[0.7rem]" />
                Selected
              </span>
            )}
          </span>
          <span className="mt-0.5 block text-[0.85rem] leading-snug text-ink-muted">
            {track.description}
          </span>
          <span className="mt-1.5 inline-block rounded-pill bg-[var(--quiet)] px-2 py-0.5 text-[0.72rem] text-ink-faint">
            Generated on this device
          </span>
        </button>
      </div>

      {/* Aligned under the text: the 3.25rem scene plus the 0.75rem gap. */}
      <div className="mt-2.5 flex items-center gap-2 pl-16">
        <Button
          variant="secondary"
          size="sm"
          onClick={onPreview}
          leading={
            playing ? (
              <PauseIcon className="text-[0.8rem]" />
            ) : (
              <PlayIcon className="text-[0.8rem]" />
            )
          }
          aria-label={
            playing ? `Stop preview of ${track.name}` : `Preview ${track.name}`
          }
        >
          {playing ? 'Stop preview' : 'Preview'}
        </Button>

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
      </div>
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
        <span className="flex items-center gap-2">
          <span className="truncate text-[0.98rem] font-medium text-ink">
            {track.name}
          </span>
          {selected && (
            <span className="shrink-0 text-[0.72rem] font-medium tracking-[0.06em] text-[var(--rose-deep)] uppercase">
              Selected
            </span>
          )}
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
