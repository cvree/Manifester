/**
 * Float samples, wrapped in the one container every browser decodes.
 *
 * The in-browser model hands back raw mono floats, and something has to turn
 * those into bytes that `decodeAudioData` and IndexedDB will both accept. WAV
 * is the answer for one reason: writing it is a 44-byte header and a loop,
 * with no encoder to download, no worker time, and no latency between the
 * model finishing and the first sample reaching the speakers.
 *
 * It is roughly four times the size of the Opus that ships pre-generated, and
 * that is the trade being made knowingly. A locally synthesised clip is one
 * device's copy of one line, held under a budget that evicts what nobody plays
 * (see `browserCache.ts`); a pre-generated clip is downloaded by everybody who
 * ever opens the app. Spending bytes on the first to save seconds on the
 * second is the right way round.
 *
 * 16-bit rather than 32-bit float for the same trade read the other way: it
 * halves the size, every decoder understands it, and the difference is
 * inaudible in speech at 24 kHz.
 */

/** Clamp to [-1, 1] and scale, so a hot sample wraps to full scale not to zero. */
function toPcm16(sample: number): number {
  const clamped = sample < -1 ? -1 : sample > 1 ? 1 : sample
  return clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff
}

/** A mono 16-bit PCM WAV file. */
export function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const bytesPerSample = 2
  const dataBytes = samples.length * bytesPerSample
  const buffer = new ArrayBuffer(44 + dataBytes)
  const view = new DataView(buffer)

  const ascii = (offset: number, text: string) => {
    for (let index = 0; index < text.length; index += 1) {
      view.setUint8(offset + index, text.charCodeAt(index))
    }
  }

  ascii(0, 'RIFF')
  view.setUint32(4, 36 + dataBytes, true)
  ascii(8, 'WAVE')
  ascii(12, 'fmt ')
  view.setUint32(16, 16, true) // PCM header length
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * bytesPerSample, true) // byte rate
  view.setUint16(32, bytesPerSample, true) // block align
  view.setUint16(34, 8 * bytesPerSample, true)
  ascii(36, 'data')
  view.setUint32(40, dataBytes, true)

  let offset = 44
  for (let index = 0; index < samples.length; index += 1) {
    view.setInt16(offset, toPcm16(samples[index]), true)
    offset += bytesPerSample
  }

  return buffer
}
