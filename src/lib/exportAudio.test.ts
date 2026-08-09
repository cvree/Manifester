import { describe, expect, it } from 'vitest'
import { exportFileName, formatEstimate, estimateMp3Bytes } from './exportAudio'

describe('exportFileName', () => {
  it('carries the title, the length and the format', () => {
    expect(exportFileName('Morning Calm', 10, 'mp3')).toBe('Morning-Calm-10min.mp3')
  })

  it('makes a filesystem-safe name out of anything the user typed', () => {
    expect(exportFileName('I am / becoming: calm!', 20, 'wav')).toBe(
      'I-am-becoming-calm-20min.wav',
    )
  })

  it('falls back to a name of its own rather than producing "-10min.mp3"', () => {
    expect(exportFileName('   ', 10, 'mp3')).toBe('manifester-loop-10min.mp3')
    expect(exportFileName('✻ ✻ ✻', 10, 'mp3')).toBe('manifester-loop-10min.mp3')
  })

  it('caps a very long title without leaving a trailing hyphen', () => {
    const name = exportFileName('word '.repeat(40), 5, 'mp3')
    expect(name.endsWith('-5min.mp3')).toBe(true)
    expect(name).not.toMatch(/--5min/)
    expect(name.length).toBeLessThanOrEqual(60 + '-5min.mp3'.length)
  })
})

describe('size estimates', () => {
  it('scales with length at the export bitrate', () => {
    expect(estimateMp3Bytes(20)).toBe(estimateMp3Bytes(10) * 2)
  })

  it('reads in the unit the number deserves', () => {
    expect(formatEstimate(400 * 1024)).toBe('400 KB')
    expect(formatEstimate(3.5 * 1024 * 1024)).toBe('3.5 MB')
    expect(formatEstimate(42 * 1024 * 1024)).toBe('42 MB')
  })
})
