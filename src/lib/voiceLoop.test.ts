import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetHeartbeat } from './heartbeat'
import { VoiceLooper, type Speaker, type VoiceLoopOptions } from './voiceLoop'
import type { SpeakOutcome } from './tts/types'

/*
 * What this file is really guarding is the two failures people actually
 * report about looping speech: hearing a line twice, and hearing nothing at
 * all while the screen insists something is playing. Both of them are timing
 * bugs around interruption, so the fake speaker below never resolves on its
 * own — every line is finished, or interrupted, by the test, at the moment the
 * test chooses.
 */

interface Pending {
  text: string
  settle: (outcome: SpeakOutcome) => void
  started: () => void
}

class FakeSpeaker implements Speaker {
  spoken: string[] = []
  preloaded: string[] = []
  stops = 0
  pending: Pending | null = null

  speak(text: string, options: { onStart?: () => void } = {}): Promise<SpeakOutcome> {
    this.spoken.push(text)
    return new Promise<SpeakOutcome>((resolve) => {
      this.pending = {
        text,
        settle: (outcome) => {
          this.pending = null
          resolve(outcome)
        },
        started: () => options.onStart?.(),
      }
    })
  }

  async preload(text: string): Promise<void> {
    this.preloaded.push(text)
  }

  stop(): void {
    this.stops += 1
    this.pending?.settle('interrupted')
  }

  get isSpeaking(): boolean {
    return this.pending != null
  }

  /** Let the current line start and then finish, as a real one would. */
  async finish(): Promise<void> {
    const pending = this.pending
    if (!pending) return
    pending.started()
    pending.settle('finished')
    await flush()
  }

  async fail(): Promise<void> {
    this.pending?.settle('failed')
    await flush()
  }
}

/** Let every already-resolved promise run. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

const options: VoiceLoopOptions = {
  text: 'First line.\nSecond line.',
  voice: 'female_1',
  rate: 1,
  pitch: 1,
  volume: 1,
  repeatPauseMs: 1000,
  initialDelayMs: 0,
  loop: true,
}

let speaker: FakeSpeaker
let loop: VoiceLooper

/*
 * The gap between passes is held by `scheduleAt`, which arms a timer *and* an
 * audio-clock heartbeat and takes both from `window`. Under a bare Node test
 * runner there is no window, so it would arm neither and the loop would simply
 * stop after its first pass — silently, and only in the test. Delegating to
 * the ambient timers keeps `vi.useFakeTimers` in charge of the clock.
 */
beforeEach(() => {
  vi.stubGlobal('window', {
    setTimeout: (fn: () => void, ms?: number) => setTimeout(fn, ms),
    clearTimeout: (id: number) => clearTimeout(id),
    setInterval: (fn: () => void, ms?: number) => setInterval(fn, ms),
    clearInterval: (id: number) => clearInterval(id),
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })
  vi.stubGlobal('document', {
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })
  speaker = new FakeSpeaker()
  loop = new VoiceLooper(speaker)
})

afterEach(() => {
  loop.stop()
  resetHeartbeat()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('the looping speaker', () => {
  it('speaks one written line at a time, in order', async () => {
    loop.start(options)
    await flush()
    expect(speaker.spoken).toEqual(['First line.'])

    await speaker.finish()
    expect(speaker.spoken).toEqual(['First line.', 'Second line.'])
    expect(loop.chunkCount).toBe(2)
  })

  it('reports the line at the moment it is heard, not when it was queued', async () => {
    const heard: string[] = []
    loop.start(options, { onChunk: (_index, _total, text) => heard.push(text) })
    await flush()

    // Queued, but not yet audible: the screen must not have moved.
    expect(heard).toEqual([])
    await speaker.finish()
    expect(heard).toEqual(['First line.'])
  })

  it('fetches the next line while the current one is speaking', async () => {
    loop.start(options)
    await flush()
    expect(speaker.preloaded).toContain('Second line.')
  })

  it('holds the gap between passes, then begins again', async () => {
    const cycles: number[] = []
    loop.start(options, { onCycle: (count) => cycles.push(count) })
    await flush()
    await speaker.finish() // first line
    await speaker.finish() // second line

    expect(cycles).toEqual([1])
    // The pass is over and the next one has not started: this is the silence.
    expect(speaker.spoken).toHaveLength(2)
    expect(loop.delayRemainingSeconds).toBeGreaterThan(0)
    expect(loop.delayRemainingSeconds).toBeLessThanOrEqual(1)
  })

  it('stops after one pass when it is not a loop', async () => {
    const onFinish = vi.fn()
    loop.start({ ...options, loop: false }, { onFinish })
    await flush()
    await speaker.finish()
    await speaker.finish()

    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(loop.isRunning).toBe(false)
  })

  it('does not speak the line it was interrupted on a second time', async () => {
    loop.start(options)
    await flush()
    loop.pause()
    await flush()

    // A `stop()` resolves the outstanding line as interrupted. If that were
    // treated as a finish, pausing would advance the loop — and resuming would
    // then skip a line while the old one was still queued somewhere.
    expect(speaker.spoken).toEqual(['First line.'])

    loop.resume()
    await flush()
    expect(speaker.spoken).toEqual(['First line.', 'First line.'])
  })

  it('resumes into the remainder of a gap rather than restarting it', async () => {
    loop.start(options)
    await flush()
    await speaker.finish()
    await speaker.finish()

    const before = loop.delayRemainingSeconds ?? 0
    loop.pause()
    expect(loop.delayRemainingSeconds).toBeLessThanOrEqual(before)
    loop.resume()
    await flush()

    // Still in the gap, and no line has been spoken out of turn.
    expect(speaker.spoken).toHaveLength(2)
    expect(loop.delayRemainingSeconds).toBeGreaterThan(0)
  })

  it('stops everything, and stays stopped', async () => {
    loop.start(options)
    await flush()
    loop.stop()
    await flush()

    expect(loop.isRunning).toBe(false)
    expect(speaker.stops).toBeGreaterThan(0)

    // A line that was in flight when the loop stopped must not resurrect it.
    await flush()
    expect(speaker.spoken).toEqual(['First line.'])
  })

  it('refuses to start on nothing', () => {
    const onError = vi.fn()
    expect(loop.start({ ...options, text: '   \n  ' }, { onError })).toBe(false)
    expect(onError).toHaveBeenCalled()
    expect(loop.isRunning).toBe(false)
  })

  it('keeps going when a line cannot be spoken, and eventually says so', async () => {
    vi.useFakeTimers()
    const onError = vi.fn()
    loop.start(options, { onError })
    await vi.advanceTimersByTimeAsync(0)

    // Six turns of the wheel: enough to fail three lines even with the pause
    // after each failure and the gap between passes.
    for (let attempt = 0; attempt < 6; attempt += 1) {
      speaker.pending?.settle('failed')
      await vi.advanceTimersByTimeAsync(1500)
    }

    // Three failures in a row is a broken voice rather than a broken line.
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError.mock.calls[0][0]).toMatch(/could not be reached/i)
    // And it is still going, rather than having given up.
    expect(loop.isRunning).toBe(true)
    expect(speaker.spoken.length).toBeGreaterThan(3)
  })

  it('puts the line back when playback died without saying so', async () => {
    loop.start(options)
    await flush()

    // What an iOS interruption looks like from here: the clip is gone and
    // nothing is speaking, but the loop was never told.
    speaker.pending = null
    loop.recover()
    await flush()
    expect(speaker.spoken).toEqual(['First line.', 'First line.'])
  })

  it('does nothing on recovery when the voice is genuinely still speaking', async () => {
    loop.start(options)
    await flush()
    loop.recover()
    await flush()
    expect(speaker.spoken).toEqual(['First line.'])
  })

  it('does not interrupt the deliberate silence between passes', async () => {
    loop.start(options)
    await flush()
    await speaker.finish()
    await speaker.finish()

    loop.recover()
    await flush()
    expect(speaker.spoken).toHaveLength(2)
  })

  it('applies a change of voice to the line after this one', async () => {
    loop.start(options)
    await flush()
    loop.updateOptions({ voice: 'male_1' })
    // The change is heard next line, and the preload is redone under the new
    // voice so that "next line" does not mean "next line plus two seconds".
    expect(speaker.preloaded.filter((text) => text === 'Second line.').length)
      .toBeGreaterThan(1)
  })
})
