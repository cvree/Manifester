import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FallbackVoice } from './fallback'

/*
 * `speechSynthesis` is the one part of the voice this app does not own, and
 * every failure it has on a phone is a failure of *silence*: an utterance that
 * was accepted and never spoken, an engine left paused by a lock screen, a
 * queue cancelled with a promise still waiting on it. None of those raise an
 * error, so the only way to know this code handles them is to build an engine
 * that behaves that badly on purpose.
 */

class FakeSynth {
  speaking = false
  pending = false
  paused = false
  cancels = 0
  resumes = 0
  utterances: FakeUtterance[] = []
  /** When false, `speak` accepts the utterance and then does nothing at all. */
  actuallySpeaks = true

  speak(utterance: FakeUtterance): void {
    this.utterances.push(utterance)
    this.speaking = true
    if (this.actuallySpeaks) utterance.onstart?.()
  }

  cancel(): void {
    this.cancels += 1
    this.speaking = false
    this.pending = false
  }

  resume(): void {
    this.resumes += 1
    this.paused = false
  }

  pause(): void {
    this.paused = true
  }

  getVoices(): unknown[] {
    return []
  }
}

class FakeUtterance {
  voice: unknown = null
  lang = ''
  rate = 1
  pitch = 1
  volume = 1
  onstart: (() => void) | null = null
  onend: (() => void) | null = null
  onerror: ((event: unknown) => void) | null = null
  text: string
  constructor(text: string) {
    this.text = text
  }
}

const options = {
  style: 'feminine' as const,
  lang: 'en-US',
  rate: 1,
  pitch: 1,
  volume: 1,
}

let synth: FakeSynth
let voice: FallbackVoice

beforeEach(() => {
  vi.useFakeTimers()
  synth = new FakeSynth()
  vi.stubGlobal('window', {
    speechSynthesis: synth,
    SpeechSynthesisUtterance: FakeUtterance,
    setTimeout: (fn: () => void, ms?: number) => setTimeout(fn, ms),
    clearTimeout: (id: number) => clearTimeout(id),
    setInterval: (fn: () => void, ms?: number) => setInterval(fn, ms),
    clearInterval: (id: number) => clearInterval(id),
  })
  vi.stubGlobal('navigator', { userAgent: 'node', platform: 'node', maxTouchPoints: 0 })
  vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance)
  voice = new FallbackVoice()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('the device voice, on an engine that misbehaves', () => {
  it('reports a line the engine accepted and never spoke as a failure', async () => {
    // The symptom on a phone: `speak()` returns, `speaking` is true, and not a
    // word comes out. Calling that "finished" would have the loop move on as
    // though somebody had heard it; never settling at all — which is what an
    // engine claiming to speak forever used to produce — ends the session.
    synth.actuallySpeaks = false
    const handle = voice.speak('I am steady.', options)

    await vi.advanceTimersByTimeAsync(20_000)
    await expect(handle.done).resolves.toBe('failed')
  })

  it('does not cut off a line that is genuinely being spoken', async () => {
    // A long one, on an engine still working through it. Nothing about the
    // wait may be mistaken for the ghost above.
    const handle = voice.speak('I am steady.', options)
    let settled: string | null = null
    void handle.done.then((outcome) => {
      settled = outcome
    })

    await vi.advanceTimersByTimeAsync(60_000)
    expect(settled).toBeNull()
    expect(synth.cancels).toBe(1) // the one `speak()` makes on its way in
  })

  it('un-pauses an engine that a lock screen left paused', async () => {
    const handle = voice.speak('I am steady.', options)
    synth.paused = true

    await vi.advanceTimersByTimeAsync(3000)
    expect(synth.resumes).toBeGreaterThan(0)

    // Still the same utterance: resuming is recovery, not a restart.
    expect(synth.utterances).toHaveLength(1)
    handle.stop()
  })

  it('un-pauses on request, for the moment the app comes back', () => {
    synth.paused = true
    voice.resumeIfPaused()
    expect(synth.resumes).toBe(1)
    expect(synth.paused).toBe(false)
  })

  it('leaves an engine that is not paused alone', () => {
    voice.resumeIfPaused()
    expect(synth.resumes).toBe(0)
  })

  it('settles a stopped line itself, rather than trusting the engine to', async () => {
    // This engine never fires `onerror` on a cancel — which is not the
    // ordinary behaviour and is entirely allowed. Waiting for it meant the
    // loop awaited a promise that would never resolve, and the session ended
    // there: no next line, no error, no way back.
    const handle = voice.speak('I am steady.', options)
    voice.stop()
    await expect(handle.done).resolves.toBe('interrupted')
    expect(synth.cancels).toBeGreaterThan(0)
  })

  it('settles the line it replaced when a new one is asked for', async () => {
    const first = voice.speak('First line.', options)
    voice.speak('Second line.', options)
    await expect(first.done).resolves.toBe('interrupted')
  })

  it('finishes normally when the engine behaves', async () => {
    const handle = voice.speak('I am steady.', options)
    const utterance = synth.utterances[0]
    synth.speaking = false
    utterance.onend?.()
    await expect(handle.done).resolves.toBe('finished')
  })
})
