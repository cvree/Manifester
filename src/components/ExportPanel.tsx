import { useCallback, useEffect, useRef, useState } from 'react'
import { cx } from '../lib/cx'
import {
  BED_CROSSFADE_SECONDS,
  CUSTOM_DURATION_LIMITS,
  DURATION_PRESETS,
  EXPORT_BITRATE_KBPS,
  EXPORT_SAMPLE_RATE,
  decodeRecording,
  estimateMp3Bytes,
  estimateWavBytes,
  formatEstimate,
  masterGainFor,
  renderBackgroundBed,
  trimSilence,
} from '../lib/exportAudio'
import type { EncodeRequest, EncodeResponse } from '../lib/exportTypes'
import { cue } from '../lib/feedback'
import type { LoopSettings } from '../lib/types'
import { Button } from './Button'
import { Chip } from './SegmentedControl'
import { CheckIcon, DownloadIcon } from './Icons'
import { TextField } from './TextArea'

interface ExportPanelProps {
  settings: LoopSettings
  title: string
  hasRecording: boolean
  /** Shown in the manifest, so the file's contents are stated before rendering. */
  soundLabel: string
  voiceLabel: string
}

type Stage =
  | { kind: 'idle' }
  | { kind: 'preparing' }
  | { kind: 'encoding'; percent: number }
  | { kind: 'done'; url: string; filename: string; bytes: number; format: 'mp3' | 'wav' }
  | { kind: 'error'; message: string }

export function ExportPanel({
  settings,
  title,
  hasRecording,
  soundLabel,
  voiceLabel,
}: ExportPanelProps) {
  const [minutes, setMinutes] = useState<number>(10)
  const [custom, setCustom] = useState('')
  const [usingCustom, setUsingCustom] = useState(false)
  const [stage, setStage] = useState<Stage>({ kind: 'idle' })
  const [fallbackNote, setFallbackNote] = useState<string | null>(null)

  const workerRef = useRef<Worker | null>(null)
  const urlRef = useRef<string | null>(null)

  useEffect(
    () => () => {
      workerRef.current?.terminate()
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    },
    [],
  )

  const hasBackground = settings.sound.mode !== 'off'
  const canExport = hasRecording || hasBackground
  const estimate = formatEstimate(estimateMp3Bytes(minutes))
  const wavEstimate = formatEstimate(estimateWavBytes(minutes))

  const reset = useCallback(() => {
    workerRef.current?.terminate()
    workerRef.current = null
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current)
      urlRef.current = null
    }
    setFallbackNote(null)
    setStage({ kind: 'idle' })
  }, [])

  const cancel = useCallback(() => {
    workerRef.current?.postMessage({ type: 'cancel' })
    workerRef.current?.terminate()
    workerRef.current = null
    setStage({ kind: 'idle' })
  }, [])

  const start = useCallback(async () => {
    reset()
    setStage({ kind: 'preparing' })

    try {
      // Step 1, on this thread: render the bed and decode the recording.
      const [bed, rawVoice] = await Promise.all([
        renderBackgroundBed(settings),
        settings.recordingId ? decodeRecording(settings.recordingId) : null,
      ])

      const voice = rawVoice ? trimSilence(rawVoice) : new Float32Array(0)

      if (bed.length === 0 && voice.length === 0) {
        setStage({
          kind: 'error',
          message:
            'There is nothing to export yet. Record your voice, or choose a background sound.',
        })
        cue('error')
        return
      }

      const worker = new Worker(
        new URL('../workers/encode.worker.ts', import.meta.url),
        { type: 'module' },
      )
      workerRef.current = worker

      const request: EncodeRequest = {
        bed,
        voice,
        sampleRate: EXPORT_SAMPLE_RATE,
        totalSamples: Math.floor(minutes * 60 * EXPORT_SAMPLE_RATE),
        delaySamples: Math.floor(
          settings.repeatPauseSeconds * EXPORT_SAMPLE_RATE,
        ),
        musicVolume: settings.musicVolume,
        voiceVolume: settings.voiceVolume,
        bitrateKbps: EXPORT_BITRATE_KBPS,
        crossfadeSamples: Math.floor(
          BED_CROSSFADE_SECONDS * EXPORT_SAMPLE_RATE,
        ),
        fadeSamples: Math.floor(2 * EXPORT_SAMPLE_RATE),
        masterGain: masterGainFor(
          bed,
          voice,
          settings.musicVolume,
          settings.voiceVolume,
        ),
      }

      worker.onmessage = (event: MessageEvent<EncodeResponse>) => {
        const message = event.data
        switch (message.type) {
          case 'progress':
            setStage({ kind: 'encoding', percent: message.percent })
            break
          case 'fallback':
            setFallbackNote(message.reason)
            break
          case 'cancelled':
            setStage({ kind: 'idle' })
            break
          case 'failed':
            setStage({ kind: 'error', message: message.message })
            cue('error')
            break
          case 'done': {
            const url = URL.createObjectURL(message.blob)
            urlRef.current = url
            const safeTitle =
              title.trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') ||
              'manifester-loop'
            setStage({
              kind: 'done',
              url,
              filename: `${safeTitle}-${minutes}min.${message.format}`,
              bytes: message.blob.size,
              format: message.format,
            })
            cue('complete')
            break
          }
        }
      }

      worker.onerror = () => {
        setStage({
          kind: 'error',
          message: 'The export stopped unexpectedly. Try a shorter length.',
        })
      }

      // Hand the sample data over rather than copying it.
      worker.postMessage(request, [bed.buffer, voice.buffer])
      setStage({ kind: 'encoding', percent: 0 })
    } catch (error) {
      setStage({
        kind: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'The audio could not be prepared on this device.',
      })
      cue('error')
    }
  }, [minutes, reset, settings, title])

  const busy = stage.kind === 'preparing' || stage.kind === 'encoding'

  return (
    <div className="space-y-5">
      <div>
        <div
          role="radiogroup"
          aria-label="Length of the exported file"
          className="flex flex-wrap gap-2"
        >
          {DURATION_PRESETS.map((preset) => (
            <Chip
              key={preset}
              selected={!usingCustom && minutes === preset}
              onClick={() => {
                setUsingCustom(false)
                setMinutes(preset)
                reset()
              }}
            >
              {preset} min
            </Chip>
          ))}
          <Chip
            selected={usingCustom}
            onClick={() => {
              setUsingCustom(true)
              if (!custom) setCustom('45')
              setMinutes(Number.parseInt(custom || '45', 10))
              reset()
            }}
          >
            Custom
          </Chip>
        </div>

        {usingCustom && (
          <div className="mt-3 flex items-center gap-3">
            <TextField
              inputMode="numeric"
              pattern="[0-9]*"
              aria-label="Custom export length in minutes"
              value={custom}
              onChange={(event) => {
                const raw = event.target.value.replace(/\D/g, '')
                setCustom(raw)
                const parsed = Number.parseInt(raw, 10)
                if (Number.isFinite(parsed)) {
                  setMinutes(
                    Math.min(
                      CUSTOM_DURATION_LIMITS.max,
                      Math.max(CUSTOM_DURATION_LIMITS.min, parsed),
                    ),
                  )
                }
                reset()
              }}
              className="max-w-24 text-center"
            />
            <span className="text-[0.9rem] text-ink-muted">
              minutes ({CUSTOM_DURATION_LIMITS.min}–{CUSTOM_DURATION_LIMITS.max})
            </span>
          </div>
        )}

        <p className="type-meta mt-3">
          About {estimate} as an MP3 ({EXPORT_BITRATE_KBPS} kbps mono), or{' '}
          {wavEstimate} if this browser can only make a WAV. Longer files take a
          few minutes to render, and you can keep using the app while they do.
        </p>
      </div>

      <div className="surface-control px-4 py-4">
        <p className="type-label mb-3">What goes in the file</p>
        <dl className="space-y-2.5 text-[0.875rem]">
          <ManifestRow
            included={hasRecording}
            label="Voice"
            value={
              hasRecording
                ? `Your recording at ${Math.round(settings.voiceVolume * 100)}%`
                : 'Not included — see the note below'
            }
          />
          <ManifestRow
            included={hasBackground}
            label="Sound"
            value={hasBackground ? soundLabel : 'No background sound'}
          />
          <ManifestRow
            included
            label="Delay"
            value={
              settings.repeatPauseSeconds === 0
                ? 'No pause between passes'
                : `${settings.repeatPauseSeconds}s between passes`
            }
          />
          <ManifestRow
            included
            label="Format"
            value={`MP3, ${EXPORT_BITRATE_KBPS} kbps mono, ${EXPORT_SAMPLE_RATE / 1000} kHz`}
          />
        </dl>

        {!hasRecording && (
          <p className="type-meta mt-4 border-t border-[var(--quiet-border)] pt-3">
            The app's speaking voice ({voiceLabel}) cannot go in the file, and no
            web app can manage that — your device generates that speech outside
            the page, where a website has no way to listen to it. Record your own
            voice to put words in the download.
          </p>
        )}
      </div>

      {fallbackNote && (
        <p
          role="status"
          className="rounded-2xl border border-[var(--border-strong)] bg-[var(--gold-soft)] px-4 py-3 text-[0.87rem] leading-relaxed text-ink"
        >
          {fallbackNote}
        </p>
      )}

      {stage.kind === 'error' && (
        <p
          role="alert"
          className="rounded-2xl border border-[var(--border-strong)] bg-[var(--gold-soft)] px-4 py-3 text-[0.87rem] leading-relaxed text-ink"
        >
          {stage.message}
        </p>
      )}

      {busy && (
        <div>
          <div
            className="h-2 w-full overflow-hidden rounded-pill bg-[var(--surface-sunken)]"
            role="progressbar"
            aria-label="Export progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={stage.kind === 'encoding' ? stage.percent : 0}
          >
            <div
              className="h-full rounded-pill bg-[var(--rose)] transition-[width] duration-200"
              style={{
                width:
                  stage.kind === 'encoding'
                    ? `${Math.max(2, stage.percent)}%`
                    : '2%',
              }}
            />
          </div>
          <p className="mt-2 text-[0.85rem] text-ink-muted">
            {stage.kind === 'preparing'
              ? 'Preparing the sound…'
              : `Rendering ${stage.percent}% — you can keep using the app`}
          </p>
        </div>
      )}

      {stage.kind === 'done' ? (
        <div className="rounded-[1.25rem] border border-[var(--sage)] bg-[var(--sage-soft)] p-4" role="status">
          <p className="flex items-center gap-2 text-[0.98rem] font-medium text-ink">
            <CheckIcon className="text-[1rem] text-[var(--sage)]" />
            Your {minutes} minute {stage.format.toUpperCase()} is ready
          </p>
          <p className="mt-1 text-[0.85rem] text-ink-muted">
            {formatEstimate(stage.bytes)} · {stage.filename}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href={stage.url}
              download={stage.filename}
              onClick={() => cue('tap')}
              className="inline-flex min-h-14 items-center justify-center gap-2 rounded-[1.25rem] border border-transparent bg-[var(--rose-deep)] px-6 text-[1.05rem] font-medium text-[var(--bg-0)] shadow-[0_6px_20px_-8px_var(--glow)]"
            >
              <DownloadIcon className="text-[0.95rem]" />
              Save the file
            </a>
            <Button variant="secondary" size="lg" onClick={reset}>
              Make another
            </Button>
          </div>
        </div>
      ) : busy ? (
        <Button variant="secondary" block size="lg" onClick={cancel}>
          Cancel
        </Button>
      ) : (
        <Button
          variant="primary"
          block
          size="lg"
          disabled={!canExport}
          onClick={() => void start()}
          leading={<DownloadIcon className="text-[0.95rem]" />}
        >
          Create the audio file
        </Button>
      )}

      {!canExport && (
        <p className="type-meta">
          Record your voice or choose a background sound first.
        </p>
      )}
    </div>
  )
}

/** One line of the export manifest: included, or honestly marked as not. */
function ManifestRow({
  included,
  label,
  value,
}: {
  included: boolean
  label: string
  value: string
}) {
  return (
    <div className="flex items-start gap-3">
      <span
        aria-hidden="true"
        className={cx(
          'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[0.6rem]',
          included
            ? 'bg-[var(--sage-soft)] text-[var(--sage)]'
            : 'border border-[var(--control-border)] text-ink-faint',
        )}
      >
        {included ? '✓' : '—'}
      </span>
      <dt className="w-16 shrink-0 text-ink-muted">{label}</dt>
      <dd className={cx('min-w-0 grow', included ? 'text-ink' : 'text-ink-muted')}>
        {value}
      </dd>
    </div>
  )
}
