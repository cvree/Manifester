import { describe, expect, it } from 'vitest'
import { encodeWav } from './wav'

/*
 * The container the on-device model's output travels in. It is written by
 * hand, it is what every browser is asked to decode, and it is what goes into
 * IndexedDB — so a wrong byte here is a clip that plays as static, or does not
 * play at all, on the one path that has no fallback behind it.
 */

const read = (buffer: ArrayBuffer) => {
  const view = new DataView(buffer)
  const text = (offset: number, length: number) =>
    String.fromCharCode(
      ...Array.from({ length }, (_, i) => view.getUint8(offset + i)),
    )
  return { view, text }
}

describe('the WAV container', () => {
  it('writes a header every decoder recognises', () => {
    const buffer = encodeWav(new Float32Array(10), 24_000)
    const { view, text } = read(buffer)

    expect(text(0, 4)).toBe('RIFF')
    expect(text(8, 4)).toBe('WAVE')
    expect(text(12, 4)).toBe('fmt ')
    expect(text(36, 4)).toBe('data')

    expect(view.getUint16(20, true)).toBe(1) // PCM
    expect(view.getUint16(22, true)).toBe(1) // mono
    expect(view.getUint32(24, true)).toBe(24_000)
    expect(view.getUint16(34, true)).toBe(16) // bits per sample
  })

  it('declares the lengths the data actually has', () => {
    const buffer = encodeWav(new Float32Array(100), 24_000)
    const { view } = read(buffer)

    expect(buffer.byteLength).toBe(44 + 200)
    expect(view.getUint32(4, true)).toBe(36 + 200)
    expect(view.getUint32(40, true)).toBe(200)
    // Byte rate and block align describe 16-bit mono at the given rate.
    expect(view.getUint32(28, true)).toBe(24_000 * 2)
    expect(view.getUint16(32, true)).toBe(2)
  })

  it('scales samples without wrapping the loud ones', () => {
    const buffer = encodeWav(
      new Float32Array([0, 1, -1, 0.5, -0.5, 2, -2]),
      24_000,
    )
    const { view } = read(buffer)
    const at = (index: number) => view.getInt16(44 + index * 2, true)

    expect(at(0)).toBe(0)
    expect(at(1)).toBe(32767)
    expect(at(2)).toBe(-32768)
    expect(at(3)).toBe(16383)
    expect(at(4)).toBe(-16384)

    /*
     * The one that matters. A sample above 1.0 is not impossible — a neural
     * vocoder overshoots — and letting it through unclamped wraps positive
     * full scale round to negative full scale, which is not a loud clip but a
     * clip full of clicks.
     */
    expect(at(5)).toBe(32767)
    expect(at(6)).toBe(-32768)
  })

  it('produces something for an empty clip rather than throwing', () => {
    expect(encodeWav(new Float32Array(0), 24_000).byteLength).toBe(44)
  })
})
