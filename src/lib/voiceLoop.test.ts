import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetHeartbeat } from './heartbeat'
import { VoiceLooper, type Speaker, type VoiceLoopOptions } from './voiceLoop'
import type { SpeakSettings } from './tts'
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
  /** The settings each line was asked for with, in order. */
  requests: SpeakSettings[] = []
  /** Levels applied to a line that was already speaking. */
  liveVolumes: number[] = []

  speak(text: string, options: SpeakSettings = {}): Promise<SpeakOutcome> {
    this.spoken.push(text)
    this.requests.push(options)
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

  setLiveVolume(value: number): void {
    this.liveVolumes.push(value)
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

  it('re-fetches under the new voice, so nothing waits on a stale preload', async () => {
    loop.start(options)
    await flush()
    loop.updateOptions({ voice: 'male_1' })
    // The line in flight was fetched under the old voice, so it is fetched
    // again under the new one immediately rather than at the moment it is
    // wanted — which is the difference between "instant" and "instant, after
    // a synthesis".
    expect(
      speaker.preloaded.filter((text) => text === 'First line.').length,
    ).toBeGreaterThan(1)
  })
})

/*
 * ── Editing the voice while it is speaking ──
 *
 * The behaviour these pin is the one people reported as broken: opening the
 * voice controls mid-session, choosing a different voice, and then listening
 * to the *old* one finish the line — and, with a three-second rest after it,
 * for several seconds more. The interface said one thing and the speakers said
 * another, which is the confusing state this is meant to make impossible.
 *
 * What must be true is narrow and worth stating exactly: the line restarts,
 * the ritual does not.
 */
describe('changing the voice while it is speaking', () => {
  /*
   * `FakeSpeaker.finish` waits on a real `setTimeout`, which never fires while
   * the fake clock is in charge. These tests need the fake clock — the restart
   * is deliberately debounced — so they finish a line by hand and let the fake
   * timers flush the microtasks behind it.
   */
  const finishLine = async () => {
    const pending = speaker.pending
    if (!pending) return
    pending.started()
    pending.settle('finished')
    await vi.advanceTimersByTimeAsync(0)
  }

  it('stops the current line and says it again in the new voice', async () => {
    vi.useFakeTimers()
    loop.start(options)
    await vi.advanceTimersByTimeAsync(0)
    expect(speaker.spoken).toEqual(['First line.'])
    expect(speaker.requests[0].prefer).toBe('studio')

    loop.updateOptions({ preferDevice: true, deviceVoiceURI: 'uri:Samantha' })
    await vi.advanceTimersByTimeAsync(200)

    // The same line, again, under the new voice — not the next one.
    expect(speaker.spoken).toEqual(['First line.', 'First line.'])
    const latest = speaker.requests[speaker.requests.length - 1]
    expect(latest.prefer).toBe('device')
    expect(latest.deviceVoiceURI).toBe('uri:Samantha')
  })

  it('keeps its place in the affirmation and its pass count', async () => {
    vi.useFakeTimers()
    const cycles: number[] = []
    loop.start(options, { onCycle: (count) => cycles.push(count) })
    await vi.advanceTimersByTimeAsync(0)

    // Move onto the second line, so a restart could plausibly lose the place.
    await finishLine()
    expect(speaker.spoken).toEqual(['First line.', 'Second line.'])

    loop.updateOptions({ rate: 1.4 })
    await vi.advanceTimersByTimeAsync(200)

    // Still the second line, still the first pass. A line was restarted; the
    // ritual was not.
    expect(speaker.spoken[speaker.spoken.length - 1]).toBe('Second line.')
    expect(cycles).toEqual([])
    expect(loop.isRunning).toBe(true)
  })

  it('settles a dragged slider into exactly one restart', async () => {
    vi.useFakeTimers()
    loop.start(options)
    await vi.advanceTimersByTimeAsync(0)
    const before = speaker.spoken.length

    // A finger on a fader generates a change every frame. Re-synthesising per
    // frame is how a fader becomes a stutter.
    for (const rate of [1.05, 1.1, 1.15, 1.2, 1.25, 1.3]) {
      loop.updateOptions({ rate })
      await vi.advanceTimersByTimeAsync(16)
    }
    await vi.advanceTimersByTimeAsync(300)

    expect(speaker.spoken.length - before).toBe(1)
    expect(speaker.requests[speaker.requests.length - 1].speed).toBeCloseTo(1.3)
  })

  it('changes the level of the line already speaking, without restarting it', async () => {
    vi.useFakeTimers()
    loop.start(options)
    await vi.advanceTimersByTimeAsync(0)
    const before = speaker.spoken.length

    loop.updateOptions({ volume: 0.4 })
    await vi.advanceTimersByTimeAsync(300)

    // A gain node this app owns can simply be turned down mid-word, which is
    // better than a restart in every way — so there must not be one.
    expect(speaker.liveVolumes).toEqual([0.4])
    expect(speaker.spoken.length).toBe(before)
  })

  it('leaves a deliberate silence alone', async () => {
    vi.useFakeTimers()
    loop.start(options)
    await vi.advanceTimersByTimeAsync(0)
    await finishLine()
    await finishLine()

    // Now in the rest between passes. A restart here would mean speaking
    // inside a silence somebody asked for.
    expect(loop.delayRemainingSeconds).not.toBeNull()
    const before = speaker.spoken.length

    loop.updateOptions({ voice: 'male_1' })
    await vi.advanceTimersByTimeAsync(300)
    expect(speaker.spoken.length).toBe(before)
    expect(loop.delayRemainingSeconds).not.toBeNull()

    // And when the rest ends, the next line is spoken in the new voice.
    await vi.advanceTimersByTimeAsync(1000)
    expect(speaker.spoken.length).toBe(before + 1)
    expect(speaker.requests[speaker.requests.length - 1].voice).toBe('male_1')
  })

  it('does not restart for a change the current line cannot hear', async () => {
    vi.useFakeTimers()
    loop.start(options)
    await vi.advanceTimersByTimeAsync(0)
    const before = speaker.spoken.length

    // The rest between passes is not part of how this line sounds, so
    // interrupting it would be damage with no benefit.
    loop.updateOptions({ repeatPauseMs: 4000 })
    await vi.advanceTimersByTimeAsync(300)
    expect(speaker.spoken.length).toBe(before)
  })

  it('does not speak over a pause', async () => {
    vi.useFakeTimers()
    loop.start(options)
    await vi.advanceTimersByTimeAsync(0)
    loop.pause()
    const before = speaker.spoken.length

    loop.updateOptions({ voice: 'male_1' })
    await vi.advanceTimersByTimeAsync(300)
    expect(speaker.spoken.length).toBe(before)
  })
})
