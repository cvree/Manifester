import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SpeechLooper, type SpeechLoopOptions } from './speech'

class MockUtterance {
  text: string
  voice: SpeechSynthesisVoice | null = null
  lang = ''
  rate = 1
  pitch = 1
  volume = 1
  onstart: (() => void) | null = null
  onend: (() => void) | null = null
  onerror: ((event: { error: string }) => void) | null = null
  constructor(text: string) {
    this.text = text
  }
}

const options: SpeechLoopOptions = {
  text: 'First line.\nSecond line.',
  voiceURI: null,
  rate: 1,
  pitch: 1,
  volume: 1,
  repeatPauseMs: 0,
  initialDelayMs: 0,
  loop: true,
}

describe('SpeechLooper pause and resume', () => {
  let utterances: MockUtterance[]
  let synth: {
    speaking: boolean
    pending: boolean
    paused: boolean
    speak: ReturnType<typeof vi.fn>
    cancel: ReturnType<typeof vi.fn>
    pause: ReturnType<typeof vi.fn>
    resume: ReturnType<typeof vi.fn>
    getVoices: () => SpeechSynthesisVoice[]
  }

  beforeEach(() => {
    vi.useFakeTimers()
    utterances = []
    synth = {
      speaking: false,
      pending: false,
      paused: false,
      speak: vi.fn((utterance: MockUtterance) => {
        utterances.push(utterance)
        synth.pending = true
      }),
      cancel: vi.fn(() => {
        synth.pending = false
        synth.speaking = false
      }),
      pause: vi.fn(),
      resume: vi.fn(),
      getVoices: () => [],
    }
    vi.stubGlobal('navigator', { userAgent: '', platform: '', maxTouchPoints: 0 })
    vi.stubGlobal('SpeechSynthesisUtterance', MockUtterance)
    vi.stubGlobal('window', {
      speechSynthesis: synth,
      SpeechSynthesisUtterance: MockUtterance,
      setTimeout,
      clearTimeout,
      setInterval,
      clearInterval,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('cancels immediately and resumes the current line once', () => {
    const looper = new SpeechLooper()
    expect(looper.start(options)).toBe(true)
    expect(synth.speak).toHaveBeenCalledTimes(1)

    looper.pause()
    looper.pause()
    expect(synth.cancel).toHaveBeenCalledTimes(2) // start clears any old queue, pause cancels the live one

    looper.resume()
    looper.resume()
    vi.advanceTimersByTime(100)
    expect(synth.speak).toHaveBeenCalledTimes(2)
    expect(utterances[1].text).toBe('First line.')
  })

  it('ignores orphaned callbacks from before a pause', () => {
    const looper = new SpeechLooper()
    looper.start(options)
    const old = utterances[0]
    looper.pause()
    looper.resume()
    vi.advanceTimersByTime(100)
    old.onend?.()
    expect(synth.speak).toHaveBeenCalledTimes(2)
  })

  it('never recovers or advances while paused', () => {
    const looper = new SpeechLooper()
    looper.start(options)
    looper.pause()
    looper.recover()
    vi.advanceTimersByTime(10_000)
    expect(synth.speak).toHaveBeenCalledTimes(1)
  })
})
