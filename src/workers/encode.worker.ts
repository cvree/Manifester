/// <reference lib="webworker" />

/**
 * Mixes and encodes the exported file.
 *
 * The whole timeline is written one block at a time and handed straight to the
 * encoder, so memory stays flat whether the export is five minutes or an hour.
 * The MP3 encoder is imported dynamically — a user who never exports anything
 * never downloads it, and if the import fails we can still produce a WAV.
 */

import type { EncodeRequest, EncodeResponse } from '../lib/exportTypes'

/** One MP3 frame. Encoding in whole frames keeps lamejs happy. */
const FRAME = 1152
const BLOCK_FRAMES = 128
const BLOCK = FRAME * BLOCK_FRAMES

let cancelled = false

const post = (message: EncodeResponse, transfer?: Transferable[]) => {
  if (transfer) self.postMessage(message, transfer)
  else self.postMessage(message)
}

/**
 * Make a bed that loops without a seam by crossfading its tail over its head,
 * then dropping the tail. The same trick the noise buffers use.
 */
function seamlessBed(
  bed: Float32Array,
  crossfadeSamples: number,
): Float32Array {
  if (bed.length === 0) return bed
  const fade = Math.min(crossfadeSamples, Math.floor(bed.length / 3))
  if (fade <= 0) return bed

  const length = bed.length - fade
  const out = new Float32Array(length)
  out.set(bed.subarray(0, length))

  for (let i = 0; i < fade; i += 1) {
    const t = i / fade
    out[i] = bed[i] * t + bed[length + i] * (1 - t)
  }
  return out
}

/** Gentle limiter — keeps a loud recording plus a bed from clipping harshly. */
function softClip(value: number): number {
  if (value > 0.95) return 0.95 + Math.tanh((value - 0.95) * 6) * 0.05
  if (value < -0.95) return -0.95 + Math.tanh((value + 0.95) * 6) * 0.05
  return value
}

function buildWav(
  blocks: Int16Array<ArrayBuffer>[],
  totalSamples: number,
  rate: number,
): Blob {
  const header = new ArrayBuffer(44)
  const view = new DataView(header)
  const write = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) {
      view.setUint8(offset + i, text.charCodeAt(i))
    }
  }
  const dataBytes = totalSamples * 2

  write(0, 'RIFF')
  view.setUint32(4, 36 + dataBytes, true)
  write(8, 'WAVEfmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, rate, true)
  view.setUint32(28, rate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  write(36, 'data')
  view.setUint32(40, dataBytes, true)

  return new Blob([header, ...blocks], { type: 'audio/wav' })
}

async function run(request: EncodeRequest): Promise<void> {
  const {
    bed,
    voice,
    sampleRate,
    totalSamples,
    delaySamples,
    musicVolume,
    voiceVolume,
    bitrateKbps,
    crossfadeSamples,
    fadeSamples,
    masterGain,
  } = request

  const loopBed = seamlessBed(bed, crossfadeSamples)
  const bedLength = loopBed.length
  const voiceLength = voice.length
  // A voice cycle is the words plus the delay the user chose after them.
  const cycleLength = voiceLength > 0 ? voiceLength + delaySamples : 0

  interface Encoder {
    encodeBuffer: (samples: Int16Array) => Uint8Array
    flush: () => Uint8Array
  }

  let encoder: Encoder | null = null
  let format: 'mp3' | 'wav' = 'wav'

  try {
    const { Mp3Encoder } = await import('@breezystack/lamejs')
    encoder = new Mp3Encoder(1, sampleRate, bitrateKbps) as unknown as Encoder
    format = 'mp3'
  } catch {
    // No encoder: fall through to WAV rather than failing the whole export.
    post({
      type: 'fallback',
      reason: 'This browser could not load the MP3 encoder, so a WAV file will be made instead.',
    })
  }

  const mp3Chunks: Uint8Array<ArrayBuffer>[] = []
  const wavChunks: Int16Array<ArrayBuffer>[] = []
  const block = new Int16Array(BLOCK)

  let position = 0
  let lastReported = -1

  while (position < totalSamples) {
    if (cancelled) {
      post({ type: 'cancelled' })
      return
    }

    const count = Math.min(BLOCK, totalSamples - position)

    for (let i = 0; i < count; i += 1) {
      const at = position + i
      let sample = 0

      if (bedLength > 0) sample += loopBed[at % bedLength] * musicVolume

      if (cycleLength > 0) {
        const withinCycle = at % cycleLength
        if (withinCycle < voiceLength) {
          sample += voice[withinCycle] * voiceVolume
        }
      }

      sample *= masterGain

      // Ease in at the very start and out at the very end.
      if (at < fadeSamples) sample *= at / fadeSamples
      const fromEnd = totalSamples - at
      if (fromEnd < fadeSamples) sample *= fromEnd / fadeSamples

      block[i] = Math.round(softClip(sample) * 32767)
    }

    const slice = count === BLOCK ? block : block.subarray(0, count)

    if (encoder) {
      const encoded = encoder.encodeBuffer(slice)
      if (encoded.length > 0) mp3Chunks.push(new Uint8Array(encoded))
    } else {
      wavChunks.push(new Int16Array(slice))
    }

    position += count

    const percent = Math.floor((position / totalSamples) * 100)
    if (percent !== lastReported) {
      lastReported = percent
      post({ type: 'progress', percent })
    }

    // Let the worker breathe so a cancel message can land.
    if (position % (BLOCK * 8) === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
  }

  if (cancelled) {
    post({ type: 'cancelled' })
    return
  }

  if (encoder) {
    const tail = encoder.flush()
    if (tail.length > 0) mp3Chunks.push(new Uint8Array(tail))
    const blob = new Blob(mp3Chunks as BlobPart[], { type: 'audio/mpeg' })
    post({ type: 'done', blob, format: 'mp3' })
    return
  }

  post({
    type: 'done',
    blob: buildWav(wavChunks, totalSamples, sampleRate),
    format,
  })
}

self.onmessage = async (event: MessageEvent<EncodeRequest | { type: 'cancel' }>) => {
  const message = event.data

  if ('type' in message && message.type === 'cancel') {
    cancelled = true
    return
  }

  cancelled = false
  try {
    await run(message as EncodeRequest)
  } catch (error) {
    post({
      type: 'failed',
      message:
        error instanceof Error
          ? error.message
          : 'The audio could not be rendered on this device.',
    })
  }
}
