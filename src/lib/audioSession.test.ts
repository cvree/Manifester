import { OfflineAudioContext } from 'node-web-audio-api'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  claimPlaybackSession,
  keepAwake,
  releaseRecordingSession,
  silentWavBytes,
  wake,
} from './audioSession'

/*
 * The bug these guard is the one that is hardest to see from a desktop: on a
 * phone the affirmation is spoken perfectly and everything else is silent,
 * because the voice does not go through Web Audio and every other sound in the
 * app does. Two causes, both invisible to a test that only checks the graph:
 * the iOS silent switch muting the `ambient` audio session, and iOS parking a
 * context in an `interrupted` state that a `state === 'suspended'` check walks
 * straight past.
 */

const withAudioSession = (type: string) => {
  const session = { type }
  Object.defineProperty(globalThis.navigator, 'audioSession', {
    value: session,
    configurable: true,
    writable: true,
  })
  return session
}

afterEach(() => {
  Reflect.deleteProperty(globalThis.navigator as object, 'audioSession')
  vi.restoreAllMocks()
})

describe('the audio session category', () => {
  it('claims playback so the silent switch cannot mute the mix', () => {
    const session = withAudioSession('auto')
    claimPlaybackSession()
    expect(session.type).toBe('playback')
  })

  it('widens out of the category that the silent switch mutes', () => {
    const session = withAudioSession('ambient')
    claimPlaybackSession()
    expect(session.type).toBe('playback')
  })

  /*
   * The one case where widening would break something: asking for `playback`
   * while a recording is live takes the microphone away mid-take.
   */
  it('never takes the microphone away from a live recording', () => {
    const session = withAudioSession('play-and-record')
    claimPlaybackSession()
    expect(session.type).toBe('play-and-record')
  })

  it('hands the route back once recording is finished', () => {
    const session = withAudioSession('play-and-record')
    releaseRecordingSession()
    expect(session.type).toBe('playback')

    // And leaves anything else exactly as it found it.
    const playing = withAudioSession('playback')
    releaseRecordingSession()
    expect(playing.type).toBe('playback')
  })

  it('does nothing at all where the API does not exist', () => {
    expect(() => claimPlaybackSession()).not.toThrow()
    expect(() => releaseRecordingSession()).not.toThrow()
  })
})

describe('waking a context', () => {
  const fake = (state: string) => {
    const resume = vi.fn(() => Promise.resolve())
    return { ctx: { state, resume } as unknown as AudioContext, resume }
  }

  it('resumes a suspended context', () => {
    const { ctx, resume } = fake('suspended')
    wake(ctx)
    expect(resume).toHaveBeenCalledOnce()
  })

  /*
   * The state the specification does not have. This is the one that made a
   * session carry on with a running clock, a moving orb, a spoken voice and no
   * sound underneath any of it — because the old check asked whether the
   * context was `suspended`, and it was not; it was `interrupted`.
   */
  it('resumes a context iOS has interrupted', () => {
    const { ctx, resume } = fake('interrupted')
    wake(ctx)
    expect(resume).toHaveBeenCalledOnce()
  })

  it('leaves a running context alone', () => {
    const { ctx, resume } = fake('running')
    wake(ctx)
    expect(resume).not.toHaveBeenCalled()
  })

  it('never resumes a closed context', () => {
    const { ctx, resume } = fake('closed')
    wake(ctx)
    expect(resume).not.toHaveBeenCalled()
  })

  it('survives a resume the browser rejects', () => {
    const ctx = {
      state: 'suspended',
      resume: () => Promise.reject(new Error('nope')),
    } as unknown as AudioContext
    expect(() => wake(ctx)).not.toThrow()
  })

  it('does not need a context to be given one', () => {
    expect(() => wake(null)).not.toThrow()
  })
})

describe('keeping a context awake', () => {
  /** A window and a document, to the extent this module uses either. */
  function fakeDom() {
    const bound: Record<string, Set<() => void>> = {}
    const target = {
      addEventListener: (name: string, fn: () => void) => {
        ;(bound[name] ??= new Set()).add(fn)
      },
      removeEventListener: (name: string, fn: () => void) => {
        bound[name]?.delete(fn)
      },
    }
    vi.stubGlobal('window', target)
    vi.stubGlobal('document', { ...target, visibilityState: 'visible' })
    return {
      fire: (name: string) => bound[name]?.forEach((fn) => fn()),
      count: (name: string) => bound[name]?.size ?? 0,
    }
  }

  afterEach(() => vi.unstubAllGlobals())

  it('recovers on the context saying so, on return, and on the next touch', () => {
    const dom = fakeDom()
    const resume = vi.fn(() => Promise.resolve())
    const listeners: Record<string, () => void> = {}
    const ctx = {
      state: 'interrupted',
      resume,
      addEventListener: (name: string, fn: () => void) => {
        listeners[name] = fn
      },
      removeEventListener: () => {},
    } as unknown as AudioContext

    const release = keepAwake(ctx)
    expect(typeof listeners.statechange).toBe('function')

    listeners.statechange()
    expect(resume).toHaveBeenCalledOnce()

    // Coming back to a page that was backgrounded mid-session.
    dom.fire('visibilitychange')
    expect(resume).toHaveBeenCalledTimes(2)

    // A touch is the last resort, because some interruptions are only
    // clearable from inside a gesture.
    dom.fire('pointerdown')
    expect(resume).toHaveBeenCalledTimes(3)

    release()
    expect(dom.count('pointerdown')).toBe(0)
    expect(dom.count('visibilitychange')).toBe(0)
  })

  /*
   * The trap this guards is not obvious and cost a real regression: pausing a
   * session suspends the bus *on purpose*, so that `currentTime` stops and
   * every oscillator resumes on the phase it held. A watcher that cannot tell
   * that apart from an iOS interruption sees the `statechange` it just caused,
   * helpfully resumes, and the ambience plays straight through a paused
   * session — with the pause button showing "resume".
   */
  it('leaves a context the app parked on purpose alone', () => {
    const dom = fakeDom()
    const resume = vi.fn(() => Promise.resolve())
    const listeners: Record<string, () => void> = {}
    const ctx = {
      state: 'suspended',
      resume,
      addEventListener: (name: string, fn: () => void) => {
        listeners[name] = fn
      },
      removeEventListener: () => {},
    } as unknown as AudioContext

    let parked = true
    keepAwake(ctx, () => !parked)

    listeners.statechange()
    dom.fire('visibilitychange')
    dom.fire('pointerdown')
    expect(resume).not.toHaveBeenCalled()

    // And picks it straight back up once the pause is over.
    parked = false
    listeners.statechange()
    expect(resume).toHaveBeenCalledOnce()
  })

  it('still watches the context itself where there is no DOM at all', () => {
    const resume = vi.fn(() => Promise.resolve())
    const listeners: Record<string, () => void> = {}
    const ctx = {
      state: 'suspended',
      resume,
      addEventListener: (name: string, fn: () => void) => {
        listeners[name] = fn
      },
      removeEventListener: () => {},
    } as unknown as AudioContext

    expect(() => keepAwake(ctx)()).not.toThrow()
    listeners.statechange()
    expect(resume).toHaveBeenCalledOnce()
  })
})

/**
 * The silent track is the second half of the silent-switch fix, and the half
 * that does the work on the phones people actually have: the Audio Session API
 * is Safari-only and largely still behind a feature flag, so on most iPhones
 * `claimPlaybackSession()` above sets a property and changes nothing. While an
 * `HTMLMediaElement` is playing, though, the page's audio goes out over the
 * media route rather than the ringer channel — which is what finally makes the
 * ambience, the rhythm and the breath cues as audible as a podcast.
 *
 * That makes these bytes load-bearing, and it makes them the easiest thing
 * here to get silently wrong. A header written big-endian, a chunk length off
 * by the size of the header, a sample count that disagrees with the data
 * chunk: every one of those produces a file the browser declines to decode, an
 * element that never plays, and a phone that behaves *exactly* as it did
 * before the fix. No error, nothing to see, and the bug reported a third time.
 *
 * So the assertion is the one that cannot be fooled — hand it to a real
 * decoder and ask what came out.
 */
describe('the silent track', () => {
  it('decodes as real audio of the length it claims', async () => {
    // Offline, like the rest of the suite: a live context needs an output
    // device, and a decoder does not.
    const ctx = new OfflineAudioContext(1, 128, 44100)
    const buffer = await ctx.decodeAudioData(silentWavBytes(0.4))

    expect(buffer.numberOfChannels).toBe(1)
    expect(buffer.sampleRate).toBe(44100)
    expect(buffer.duration).toBeCloseTo(0.4, 2)
  })

  it('is genuinely silent, so nothing can ever be heard through it', async () => {
    const ctx = new OfflineAudioContext(1, 128, 44100)
    const buffer = await ctx.decodeAudioData(silentWavBytes(0.1))

    let peak = 0
    for (const sample of buffer.getChannelData(0)) {
      peak = Math.max(peak, Math.abs(sample))
    }
    expect(peak).toBe(0)
  })

  it('writes a RIFF/WAVE header whose lengths agree with the data', () => {
    const bytes = silentWavBytes(0.25)
    const view = new DataView(bytes)
    const tag = (offset: number) =>
      String.fromCharCode(
        view.getUint8(offset),
        view.getUint8(offset + 1),
        view.getUint8(offset + 2),
        view.getUint8(offset + 3),
      )

    expect(tag(0)).toBe('RIFF')
    expect(tag(8)).toBe('WAVE')
    expect(tag(12)).toBe('fmt ')
    expect(tag(36)).toBe('data')

    // Little-endian, which is the half of this a decoder would reject.
    expect(view.getUint32(40, true)).toBe(bytes.byteLength - 44)
    expect(view.getUint32(4, true)).toBe(bytes.byteLength - 8)
    expect(view.getUint16(20, true)).toBe(1) // PCM
    expect(view.getUint16(22, true)).toBe(1) // mono
    expect(view.getUint32(24, true)).toBe(44100)
    expect(view.getUint16(34, true)).toBe(16) // bits per sample
  })
})
