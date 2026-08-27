import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AudioPlayer } from './player'

/*
 * What this file guards is the half of "the audio stopped on my phone" that
 * lives below the loop: a context that was taken away and never asked for
 * back, and a clip that ended while every timer in the page was throttled.
 *
 * A hand-built context rather than a real one, because both cases are about
 * states a real `AudioContext` will not enter on request — `interrupted` does
 * not exist off iOS, and a frozen `currentTime` is precisely what a working
 * implementation refuses to give you.
 */

interface FakeParam {
  value: number
  setValueAtTime(value: number, when: number): FakeParam
  linearRampToValueAtTime(value: number, when: number): FakeParam
  exponentialRampToValueAtTime(value: number, when: number): FakeParam
  cancelScheduledValues(when: number): FakeParam
}

function param(initial = 1): FakeParam {
  const self: FakeParam = {
    value: initial,
    setValueAtTime(value) {
      self.value = value
      return self
    },
    linearRampToValueAtTime(value) {
      self.value = value
      return self
    },
    exponentialRampToValueAtTime(value) {
      self.value = value
      return self
    },
    cancelScheduledValues() {
      return self
    },
  }
  return self
}

class FakeContext {
  state: 'running' | 'suspended' | 'closed' | 'interrupted' = 'running'
  currentTime = 10
  destination = { kind: 'destination' }
  resumes = 0
  /** The one source `play` created, so a test can look at what was scheduled. */
  source: {
    buffer: unknown
    playbackRate: FakeParam
    started: number | null
    stopped: number | null
    onended: (() => void) | null
    connect(): void
    disconnect(): void
    start(when: number): void
    stop(when?: number): void
  } | null = null

  resume(): Promise<void> {
    this.resumes += 1
    this.state = 'running'
    return Promise.resolve()
  }

  createGain() {
    return {
      gain: param(1),
      connect: () => undefined,
      disconnect: () => undefined,
    }
  }

  createBufferSource() {
    const source = {
      buffer: null as unknown,
      playbackRate: param(1),
      started: null as number | null,
      stopped: null as number | null,
      onended: null as (() => void) | null,
      connect: () => undefined,
      disconnect: () => undefined,
      start(when: number) {
        source.started = when
      },
      stop(when?: number) {
        source.stopped = when ?? 0
      },
    }
    this.source = source
    return source
  }
}

/** Two seconds of nothing. Only `duration` is ever read. */
const buffer = { duration: 2 } as unknown as AudioBuffer

let ctx: FakeContext
let player: AudioPlayer

beforeEach(() => {
  vi.useFakeTimers()
  /*
   * The player schedules its watchdog and its "the sound is audible now"
   * announcement on `window`, which a bare Node runner does not have.
   * Delegating to the ambient timers keeps `vi.useFakeTimers` in charge.
   */
  vi.stubGlobal('window', {
    setTimeout: (fn: () => void, ms?: number) => setTimeout(fn, ms),
    clearTimeout: (id: number) => clearTimeout(id),
  })
  ctx = new FakeContext()
  player = new AudioPlayer(() => ctx as unknown as AudioContext)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('putting a clip through the speakers', () => {
  it('asks for a suspended context back before scheduling against it', () => {
    ctx.state = 'suspended'
    player.play(buffer)

    // Without this the source is scheduled against a clock that is not moving,
    // and the clip simply never arrives.
    expect(ctx.resumes).toBe(1)
    expect(ctx.source?.started).toBeGreaterThan(ctx.currentTime)
  })

  it('asks for an interrupted context back too, which iOS alone produces', () => {
    ctx.state = 'interrupted' as never
    player.play(buffer)
    expect(ctx.resumes).toBe(1)
  })

  it('leaves a running context alone', () => {
    player.play(buffer)
    expect(ctx.resumes).toBe(0)
  })

  it('reaches for the hardware on an unlock, where a gesture is guaranteed', () => {
    ctx.state = 'suspended'
    expect(player.unlock()).toBe(true)
    expect(ctx.resumes).toBe(1)
  })

  it('says nothing can be opened when there is no context at all', () => {
    const orphan = new AudioPlayer(() => null)
    expect(orphan.unlock()).toBe(false)
  })
})

describe('settling a clip whose fate is already decided', () => {
  it('finishes a clip whose end went by while the page was hidden', async () => {
    const handle = player.play(buffer)
    // The phone slept. The audio clock ran on; the page's timers did not.
    ctx.currentTime += 30

    player.verify()
    await expect(handle.done).resolves.toBe('finished')
    expect(player.isSpeaking).toBe(false)
  })

  it('leaves a clip that is genuinely still coming', async () => {
    const handle = player.play(buffer)
    let settled: string | null = null
    void handle.done.then((outcome) => {
      settled = outcome
    })

    ctx.currentTime += 0.5
    player.verify()
    await Promise.resolve()

    expect(settled).toBeNull()
    expect(player.isSpeaking).toBe(true)
  })

  it('asks for the context back rather than giving up on it', async () => {
    const handle = player.play(buffer)
    let settled: string | null = null
    void handle.done.then((outcome) => {
      settled = outcome
    })

    ctx.state = 'suspended'
    player.verify()
    await Promise.resolve()

    // A suspended context is a clip that is late, not a clip that is lost —
    // its `currentTime` is frozen, so it is still due exactly when it was.
    expect(ctx.resumes).toBe(1)
    expect(settled).toBeNull()
  })

  it('reports a clip on a closed context as interrupted, so the loop retries', async () => {
    const handle = player.play(buffer)
    ctx.state = 'closed'
    player.verify()
    await expect(handle.done).resolves.toBe('interrupted')
  })

  it('does nothing at all when nothing is speaking', () => {
    expect(() => player.verify()).not.toThrow()
  })
})
