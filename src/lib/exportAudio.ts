/**
 * Preparing audio for export.
 *
 * The final file can be an hour long, which at 44.1 kHz is far too many samples
 * to hold in one `OfflineAudioContext` on a phone. So the work is split:
 *
 *  1. Here, on the main thread, we render a *bounded* background bed and decode
 *     the voice recording. Both are small and fast — Web Audio's offline
 *     renderer is many times quicker than real time.
 *  2. The worker then writes the actual timeline sample by sample, looping the
 *     bed and repeating the voice with its delay, encoding as it goes. Memory
 *     stays flat no matter how long the export is.
 *
 * `decodeAudioData` and `OfflineAudioContext` are main-thread APIs, which is
 * why step 1 cannot simply live in the worker too.
 */

import { findAmbientPreset } from './ambient'
import type { LoopSettings } from './types'
import * as storage from './storage'

export const EXPORT_SAMPLE_RATE = 44100
export const EXPORT_BITRATE_KBPS = 96

/** How much ambience to render before looping it. Long enough to hide the seam. */
const BED_SECONDS = 90
/** Imported files longer than this are trimmed; the rest would blow up memory. */
const MAX_IMPORT_SECONDS = 300
/** Crossfade applied at the bed's wrap point. */
export const BED_CROSSFADE_SECONDS = 2

export const DURATION_PRESETS = [5, 10, 20, 30, 60] as const
export const CUSTOM_DURATION_LIMITS = { min: 1, max: 120 }

/** Bytes for a constant-bitrate MP3 of this length. */
export function estimateMp3Bytes(minutes: number): number {
  return Math.round((EXPORT_BITRATE_KBPS * 1000 * minutes * 60) / 8)
}

/** Uncompressed 16-bit mono, for the fallback path. */
export function estimateWavBytes(minutes: number): number {
  return Math.round(EXPORT_SAMPLE_RATE * 2 * minutes * 60) + 44
}

export function formatEstimate(bytes: number): string {
  const megabytes = bytes / 1024 / 1024
  return megabytes < 1
    ? `${Math.round(bytes / 1024)} KB`
    : `${megabytes.toFixed(megabytes < 10 ? 1 : 0)} MB`
}

function offlineContext(seconds: number): OfflineAudioContext {
  const Ctor =
    window.OfflineAudioContext ??
    (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext })
      .webkitOfflineAudioContext
  return new Ctor(1, Math.ceil(seconds * EXPORT_SAMPLE_RATE), EXPORT_SAMPLE_RATE)
}

/** Average the channels down to mono — halves everything downstream. */
function toMono(buffer: AudioBuffer): Float32Array<ArrayBuffer> {
  const length = buffer.length
  const mono = new Float32Array(length)
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const data = buffer.getChannelData(channel)
    for (let i = 0; i < length; i += 1) mono[i] += data[i]
  }
  if (buffer.numberOfChannels > 1) {
    for (let i = 0; i < length; i += 1) mono[i] /= buffer.numberOfChannels
  }
  return mono
}

/**
 * Render the loop's background selection into a loopable bed.
 * Returns an empty array when the loop has no background sound.
 */
export async function renderBackgroundBed(
  settings: LoopSettings,
): Promise<Float32Array<ArrayBuffer>> {
  const { sound } = settings
  if (sound.mode === 'off') return new Float32Array(0)

  const ids =
    sound.mode === 'playlist'
      ? sound.playlist
      : sound.trackId
        ? [sound.trackId]
        : []
  if (ids.length === 0) return new Float32Array(0)

  const segments: Float32Array<ArrayBuffer>[] = []

  for (const id of ids) {
    const preset = findAmbientPreset(id)
    if (preset) {
      const ctx = offlineContext(BED_SECONDS)
      preset.build(ctx, ctx.destination, { offlineSeconds: BED_SECONDS })
      const rendered = await ctx.startRendering()
      segments.push(toMono(rendered))
      continue
    }

    try {
      const stored = await storage.getCustomTrack(id)
      if (!stored) continue
      const decoded = await decodeTrack(stored.blob)
      if (decoded) segments.push(decoded)
    } catch {
      /* A track that will not decode is skipped rather than failing the export. */
    }
  }

  if (segments.length === 0) return new Float32Array(0)
  if (segments.length === 1) return segments[0]

  // A playlist becomes one long bed, played end to end and then looped.
  const total = segments.reduce((sum, segment) => sum + segment.length, 0)
  const bed = new Float32Array(total)
  let offset = 0
  for (const segment of segments) {
    bed.set(segment, offset)
    offset += segment.length
  }
  return bed
}

async function decodeTrack(blob: Blob): Promise<Float32Array<ArrayBuffer> | null> {
  const bytes = await blob.arrayBuffer()
  const ctx = offlineContext(1)
  try {
    const decoded = await ctx.decodeAudioData(bytes)
    const mono = toMono(decoded)
    // Resample by simple linear interpolation when the file disagrees with us.
    const resampled =
      decoded.sampleRate === EXPORT_SAMPLE_RATE
        ? mono
        : resample(mono, decoded.sampleRate, EXPORT_SAMPLE_RATE)
    const cap = MAX_IMPORT_SECONDS * EXPORT_SAMPLE_RATE
    return resampled.length > cap
      ? (resampled.slice(0, cap) as Float32Array<ArrayBuffer>)
      : resampled
  } catch {
    return null
  }
}

function resample(
  input: Float32Array<ArrayBuffer>,
  from: number,
  to: number,
): Float32Array<ArrayBuffer> {
  const ratio = to / from
  const length = Math.floor(input.length * ratio)
  const output = new Float32Array(length)
  for (let i = 0; i < length; i += 1) {
    const position = i / ratio
    const index = Math.floor(position)
    const fraction = position - index
    const a = input[index] ?? 0
    const b = input[index + 1] ?? a
    output[i] = a + (b - a) * fraction
  }
  return output
}

/** Decode a stored voice recording into mono samples at the export rate. */
export async function decodeRecording(
  recordingId: string,
): Promise<Float32Array<ArrayBuffer> | null> {
  const stored = await storage.getRecording(recordingId)
  if (!stored) return null
  return decodeTrack(stored.blob)
}

/**
 * How much to lift the finished mix.
 *
 * The in-app balance is tuned for listening *under* a spoken voice, which makes
 * a bare export very quiet. Scaling both layers by the same factor keeps the
 * user's balance exactly while landing the peak near -3 dBFS. The boost is
 * capped so a near-silent mix is not amplified into hiss.
 */
export function masterGainFor(
  bed: Float32Array<ArrayBuffer>,
  voice: Float32Array<ArrayBuffer>,
  musicVolume: number,
  voiceVolume: number,
): number {
  const peakOf = (samples: Float32Array<ArrayBuffer>) => {
    let peak = 0
    // Every 7th sample is plenty to find the peak of a continuous signal.
    for (let i = 0; i < samples.length; i += 7) {
      const value = Math.abs(samples[i])
      if (value > peak) peak = value
    }
    return peak
  }

  const combined =
    peakOf(bed) * musicVolume + peakOf(voice) * voiceVolume
  if (combined < 0.001) return 1
  return Math.min(6, 0.7 / combined)
}

/** Trim near-silence from both ends so repeats sit tightly against the delay. */
export function trimSilence(
  samples: Float32Array<ArrayBuffer>,
  threshold = 0.008,
): Float32Array<ArrayBuffer> {
  let start = 0
  let end = samples.length - 1
  while (start < end && Math.abs(samples[start]) < threshold) start += 1
  while (end > start && Math.abs(samples[end]) < threshold) end -= 1

  // Leave a little air either side rather than clipping the first consonant.
  const pad = Math.floor(EXPORT_SAMPLE_RATE * 0.08)
  start = Math.max(0, start - pad)
  end = Math.min(samples.length - 1, end + pad)

  return start === 0 && end === samples.length - 1
    ? samples
    : (samples.slice(start, end + 1) as Float32Array<ArrayBuffer>)
}
