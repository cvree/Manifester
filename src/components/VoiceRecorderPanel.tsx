import { useCallback, useEffect, useRef, useState } from 'react'
import { cue } from '../lib/feedback'
import { createId, formatApproxDuration } from '../lib/format'
import {
  VoiceRecorder,
  describeRecordingError,
  isRecordingSupported,
} from '../lib/recorder'
import * as storage from '../lib/storage'
import { Button } from './Button'
import { IconButton } from './IconButton'
import { CloseIcon, PlayIcon, StopIcon, TrashIcon } from './Icons'

interface VoiceRecorderPanelProps {
  recordingId: string | null
  onChange: (recordingId: string | null) => void
}

/** Long enough for a full affirmation, short enough to stay in memory. */
const MAX_SECONDS = 180

export function VoiceRecorderPanel({
  recordingId,
  onChange,
}: VoiceRecorderPanelProps) {
  const recorderRef = useRef<VoiceRecorder | null>(null)
  const previewRef = useRef<HTMLAudioElement | null>(null)
  const [recording, setRecording] = useState(false)
  const [level, setLevel] = useState(0)
  const [seconds, setSeconds] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [existing, setExisting] = useState<storage.StoredRecording | null>(null)
  const [playing, setPlaying] = useState(false)

  if (!recorderRef.current) recorderRef.current = new VoiceRecorder()

  // Load whatever recording this loop already has.
  useEffect(() => {
    let cancelled = false
    if (!recordingId) {
      setExisting(null)
      return
    }
    void storage.getRecording(recordingId).then((found) => {
      if (!cancelled) setExisting(found ?? null)
    })
    return () => {
      cancelled = true
    }
  }, [recordingId])

  useEffect(() => {
    if (!recording) return
    const interval = window.setInterval(() => {
      const elapsed = recorderRef.current?.elapsedSeconds ?? 0
      setSeconds(elapsed)
      if (elapsed >= MAX_SECONDS) void finish()
    }, 200)
    return () => window.clearInterval(interval)
    // `finish` is stable enough for this guard; re-creating it would reset the timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording])

  useEffect(() => {
    const element = previewRef.current
    return () => {
      element?.pause()
      recorderRef.current?.cancel()
    }
  }, [])

  const begin = useCallback(async () => {
    setError(null)
    try {
      await recorderRef.current?.start({
        onLevel: setLevel,
        onError: (message) => setError(message),
      })
      setRecording(true)
      setSeconds(0)
      cue('start')
    } catch (caught) {
      setError(describeRecordingError(caught))
      cue('error')
    }
  }, [])

  const finish = useCallback(async () => {
    const blob = await recorderRef.current?.stop()
    setRecording(false)
    setLevel(0)
    if (!blob) return

    const id = createId('rec')
    const record: storage.StoredRecording = {
      id,
      blob,
      durationSeconds: seconds,
      mimeType: blob.type,
      createdAt: Date.now(),
    }

    try {
      await storage.putRecording(record)
      // Free the previous take rather than leaving it orphaned.
      if (recordingId) await storage.deleteRecording(recordingId)
      onChange(id)
      setExisting(record)
      cue('complete')
    } catch {
      setError('There was not enough room on this device to save the recording.')
      cue('error')
    }
  }, [onChange, recordingId, seconds])

  const remove = useCallback(async () => {
    previewRef.current?.pause()
    setPlaying(false)
    if (recordingId) await storage.deleteRecording(recordingId)
    onChange(null)
    setExisting(null)
  }, [onChange, recordingId])

  const togglePreview = useCallback(() => {
    if (!existing) return
    if (playing) {
      previewRef.current?.pause()
      setPlaying(false)
      return
    }
    const url = URL.createObjectURL(existing.blob)
    const element = new Audio(url)
    element.onended = () => {
      setPlaying(false)
      URL.revokeObjectURL(url)
    }
    previewRef.current = element
    setPlaying(true)
    void element.play().catch(() => setPlaying(false))
  }, [existing, playing])

  if (!isRecordingSupported()) {
    return (
      <p className="rounded-2xl border border-[var(--border)] bg-[var(--surface-sunken)] px-4 py-3.5 text-[0.88rem] leading-relaxed text-ink-muted">
        This browser cannot record audio, so an exported file can only contain
        background sound.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <p
          role="alert"
          className="rounded-2xl border border-[var(--border-strong)] bg-[var(--gold-soft)] px-4 py-3 text-[0.88rem] leading-relaxed text-ink"
        >
          {error}
        </p>
      )}

      {recording ? (
        <div className="rounded-[1.25rem] border border-[var(--rose)] bg-[var(--rose-soft)] p-4">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="h-3 w-3 shrink-0 rounded-full bg-[var(--rose-deep)]"
              style={{ opacity: 0.5 + level * 0.5 }}
            />
            <span className="font-display text-[1.2rem] tabular-nums text-ink">
              {seconds.toFixed(1)}s
            </span>
            <span className="text-[0.85rem] text-ink-muted">
              of {MAX_SECONDS}s
            </span>
          </div>

          {/* Level meter, so you can tell the microphone is actually hearing you. */}
          <div
            className="mt-3 h-2 w-full overflow-hidden rounded-pill bg-[var(--surface-sunken)]"
            role="meter"
            aria-label="Microphone level"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(level * 100)}
          >
            <div
              className="h-full rounded-pill bg-[var(--rose-deep)]"
              style={{ width: `${Math.max(2, level * 100)}%` }}
            />
          </div>

          <Button
            variant="primary"
            block
            size="lg"
            className="mt-4"
            onClick={() => void finish()}
            leading={<StopIcon className="text-[0.85rem]" />}
          >
            Stop recording
          </Button>
        </div>
      ) : existing ? (
        <div className="flex items-center gap-3 rounded-[1.25rem] border border-[var(--sage)] bg-[var(--sage-soft)] px-4 py-3">
          <IconButton
            label={playing ? 'Stop the preview' : 'Play your recording'}
            icon={playing ? <CloseIcon /> : <PlayIcon />}
            onClick={togglePreview}
          />
          <div className="min-w-0 grow">
            <p className="text-[0.95rem] font-medium text-ink">
              Your recording is ready
            </p>
            <p className="text-[0.83rem] text-ink-muted">
              {formatApproxDuration(existing.durationSeconds)} · used in the
              exported file
            </p>
          </div>
          <IconButton
            label="Delete this recording"
            icon={<TrashIcon />}
            tone="danger"
            onClick={() => void remove()}
          />
        </div>
      ) : (
        <Button variant="secondary" block size="lg" onClick={() => void begin()}>
          Record your voice
        </Button>
      )}

      {!recording && (
        <p className="text-[0.83rem] leading-relaxed text-ink-faint">
          {existing
            ? 'Recording again replaces this one.'
            : 'Read your words aloud once. Manifester repeats the recording, with your delay, over your background sound.'}
        </p>
      )}
    </div>
  )
}
