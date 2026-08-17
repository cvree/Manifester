import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BrowserCache } from './browserCache'
import { TTSClient, NoEngineError, type ResolveOptions } from './client'
import { StaticManifest } from './manifest'
import { PronunciationNormalizer } from './pronunciation/normalizer'
import type { AudioFormat, EngineRequest, TTSEngine } from './types'

/*
 * The resolution order is the whole performance argument of this feature, and
 * it is invisible from the outside: every layer produces exactly the same
 * sound. So these tests assert on *which* layer answered, because that is the
 * part that can silently regress into "correct, and three seconds slower".
 */

const options: ResolveOptions = { voice: 'female_1', speed: 0.9 }

function bytes(byte: number, length = 8): ArrayBuffer {
  return new Uint8Array(new Array(length).fill(byte)).buffer
}

/** A context that can only decode, which is all the client asks of one. */
function fakeContext() {
  return {
    decodeAudioData: (buffer: ArrayBuffer) =>
      Promise.resolve({
        duration: 1,
        length: buffer.byteLength,
        numberOfChannels: 1,
        sampleRate: 24_000,
      } as unknown as AudioBuffer),
  } as unknown as AudioContext
}

function fakeEngine(overrides: Partial<TTSEngine> = {}): TTSEngine {
  return {
    descriptor: {
      id: 'fake',
      modelVersion: 'fake-v1',
      supportsPhonemes: true,
      formats: ['opus', 'mp3'],
    },
    lookup: vi.fn(async () => null),
    synthesize: vi.fn(async (request: EngineRequest) => ({
      bytes: bytes(2),
      format: request.format as AudioFormat,
      source: 'engine' as const,
    })),
    probe: vi.fn(async () => true),
    ...overrides,
  }
}

/** A persistent cache without a browser behind it. */
function fakeStore() {
  const held = new Map<string, ArrayBuffer>()
  const cache = {
    get: vi.fn(async (key: string, format: AudioFormat) =>
      held.get(`${key}.${format}`) ?? null,
    ),
    put: vi.fn(async (key: string, format: AudioFormat, value: ArrayBuffer) => {
      held.set(`${key}.${format}`, value)
    }),
    find: vi.fn(async (key: string, formats: AudioFormat[]) => {
      for (const format of formats) {
        const bytes = held.get(`${key}.${format}`)
        if (bytes) return { bytes, format }
      }
      return null
    }),
    usage: async () => 0,
    clear: async () => held.clear(),
  }
  return { cache: cache as unknown as BrowserCache, held, spy: cache }
}

function build(
  engine: TTSEngine | null,
  extras: {
    manifestJson?: unknown
    store?: ReturnType<typeof fakeStore>
    /** More than one engine, in preference order. Overrides `engine`. */
    engines?: TTSEngine[]
  } = {},
) {
  const store = extras.store ?? fakeStore()
  const client = new TTSClient({
    engines: extras.engines ?? (engine ? [engine] : []),
    manifest: new StaticManifest('/speech/'),
    normalizer: new PronunciationNormalizer({ supportsPhonemes: false }),
    getContext: fakeContext,
    browserCache: store.cache,
    staticBase: '/speech/',
  })
  return { client, store }
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  // No manifest and no static assets, unless a test says otherwise.
  fetchMock = vi.fn(async () => new Response(null, { status: 404 }))
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('resolution order', () => {
  it('synthesises once, then answers from memory', async () => {
    const engine = fakeEngine()
    const { client } = build(engine)

    const first = await client.resolve('Hello there.', options)
    expect(first.source).toBe('engine')

    const second = await client.resolve('Hello there.', options)
    expect(second.source).toBe('memory')
    expect(engine.synthesize).toHaveBeenCalledTimes(1)
  })

  it('prefers what this device has heard before over anything remote', async () => {
    const engine = fakeEngine()
    const store = fakeStore()
    const { client } = build(engine, { store })

    const key = client.keyFor('Hello there.', options)
    await store.cache.put(key, 'mp3', bytes(7))

    const clip = await client.resolve('Hello there.', options)
    expect(clip.source).toBe('browser-cache')
    expect(engine.lookup).not.toHaveBeenCalled()
    expect(engine.synthesize).not.toHaveBeenCalled()
  })

  it('prefers a clip that shipped with the app over asking the server', async () => {
    const engine = fakeEngine()
    const { client, store } = build(engine)
    const key = client.keyFor('Hello there.', options)

    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).endsWith('manifest.json')) {
        return new Response(
          JSON.stringify({
            version: 1,
            clips: { [key]: { formats: { mp3: `ab/${key}.mp3` } } },
          }),
          { status: 200 },
        )
      }
      return new Response(bytes(3), { status: 200 })
    })

    const clip = await client.resolve('Hello there.', options)
    expect(clip.source).toBe('static')
    expect(engine.lookup).not.toHaveBeenCalled()
    expect(engine.synthesize).not.toHaveBeenCalled()
    // And it is kept, so the next visit does not even fetch it.
    expect(store.spy.put).toHaveBeenCalled()
  })

  it('prefers the server cache over making the model work', async () => {
    const engine = fakeEngine({
      lookup: vi.fn(async () => ({
        bytes: bytes(4),
        format: 'mp3' as AudioFormat,
        source: 'server-cache' as const,
      })),
    })
    const { client } = build(engine)

    const clip = await client.resolve('Hello there.', options)
    expect(clip.source).toBe('server-cache')
    expect(engine.synthesize).not.toHaveBeenCalled()
  })

  it('skips every cache when asked to reload', async () => {
    const engine = fakeEngine()
    const { client, store } = build(engine)
    const key = client.keyFor('Hello there.', options)
    await store.cache.put(key, 'mp3', bytes(9))

    const clip = await client.resolve('Hello there.', { ...options, cache: 'reload' })
    expect(clip.source).toBe('engine')
    expect(engine.lookup).not.toHaveBeenCalled()
  })

  it('writes nothing when asked not to store', async () => {
    const engine = fakeEngine()
    const { client, store } = build(engine)
    await client.resolve('Hello there.', { ...options, cache: 'no-store' })
    expect(store.spy.put).not.toHaveBeenCalled()
  })

  /*
   * A clip is addressed by what it says, not by how it is packed. Three ways
   * that can now be violated, each of which costs a synthesis somebody waits
   * for — or, on the on-device path, several seconds of a phone's battery.
   */
  it('takes a cached clip in any encoding rather than making it again', async () => {
    const engine = fakeEngine()
    const store = fakeStore()
    const { client } = build(engine, { store })

    // What the on-device model leaves behind, while this browser would rather
    // download Opus.
    const key = client.keyFor('Hello there.', options)
    await store.cache.put(key, 'wav', bytes(11))

    const clip = await client.resolve('Hello there.', options)
    expect(clip.source).toBe('browser-cache')
    expect(clip.format).toBe('wav')
    expect(engine.synthesize).not.toHaveBeenCalled()
  })

  it('takes a shipped clip in the other encoding rather than reaching an engine', async () => {
    const engine = fakeEngine()
    const { client } = build(engine)
    const key = client.keyFor('Hello there.', options)

    // A build that generated MP3 only, seen by a browser that prefers Opus.
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).endsWith('manifest.json')) {
        return new Response(
          JSON.stringify({
            version: 1,
            clips: { [key]: { formats: { mp3: `ab/${key}.mp3` } } },
          }),
          { status: 200 },
        )
      }
      return new Response(bytes(3), { status: 200 })
    })

    const clip = await client.resolve('Hello there.', options)
    expect(clip.source).toBe('static')
    expect(clip.format).toBe('mp3')
    expect(engine.synthesize).not.toHaveBeenCalled()
  })

  it('remembers one decoded copy per clip, not one per container', async () => {
    const engine = fakeEngine({
      synthesize: vi.fn(async () => ({
        bytes: bytes(2),
        format: 'wav' as AudioFormat,
        source: 'engine' as const,
      })),
    })
    const { client } = build(engine)

    // Synthesised as WAV, asked for again as whatever this browser prefers.
    expect((await client.resolve('Hello there.', options)).source).toBe('engine')
    expect((await client.resolve('Hello there.', options)).source).toBe('memory')
    expect(engine.synthesize).toHaveBeenCalledTimes(1)
  })
})

describe('several engines', () => {
  it('asks the on-device model before the service', async () => {
    const local = fakeEngine()
    const remote = fakeEngine()
    const { client } = build(null, { engines: [local, remote] })

    const clip = await client.resolve('Hello there.', options)
    expect(clip.source).toBe('engine')
    expect(local.synthesize).toHaveBeenCalledTimes(1)
    expect(remote.lookup).not.toHaveBeenCalled()
    expect(remote.synthesize).not.toHaveBeenCalled()
  })

  it('falls through to the next engine when one cannot answer', async () => {
    // A phone that has run out of memory mid-session. The service is still
    // there, and falling back to it beats falling back to a device voice.
    const local = fakeEngine({
      synthesize: vi.fn(async () => {
        throw new Error('out of memory')
      }),
    })
    const remote = fakeEngine()
    const { client } = build(null, { engines: [local, remote] })

    const clip = await client.resolve('Hello there.', options)
    expect(clip.source).toBe('engine')
    expect(remote.synthesize).toHaveBeenCalledTimes(1)
  })

  it('reports the last failure when every engine has failed', async () => {
    const boom = () =>
      fakeEngine({
        synthesize: vi.fn(async () => {
          throw new Error('nope')
        }),
      })
    const { client } = build(null, { engines: [boom(), boom()] })

    await expect(client.resolve('Hello there.', options)).rejects.toThrow('nope')
  })

  it('is a NoEngineError when there are none at all', async () => {
    const { client } = build(null)
    await expect(client.resolve('Hello there.', options)).rejects.toBeInstanceOf(
      NoEngineError,
    )
  })
})

describe('deduplication', () => {
  it('turns simultaneous identical requests into one synthesis', async () => {
    type Made = { bytes: ArrayBuffer; format: AudioFormat; source: 'engine' }
    let resolveSynthesis: (value: Made) => void = () => undefined

    const engine = fakeEngine({
      synthesize: vi.fn(
        () =>
          new Promise<Made>((resolve) => {
            resolveSynthesis = resolve
          }),
      ),
    })
    const { client } = build(engine)

    const all = Promise.all([
      client.resolve('Hello there.', options),
      client.resolve('Hello there.', options),
      client.resolve('Hello there.', options),
    ])

    // Every caller is waiting on the same promise, so the model is asked once
    // — the wait is for the cache layers above it, which are asynchronous.
    await vi.waitFor(() => expect(engine.synthesize).toHaveBeenCalledTimes(1))
    resolveSynthesis({ bytes: bytes(5), format: 'mp3', source: 'engine' })

    const clips = await all
    expect(clips.map((clip) => clip.key)).toEqual([
      clips[0].key,
      clips[0].key,
      clips[0].key,
    ])
  })

  it('does not confuse two requests that only differ in voice or speed', async () => {
    const engine = fakeEngine()
    const { client } = build(engine)

    await Promise.all([
      client.resolve('Hello there.', options),
      client.resolve('Hello there.', { ...options, voice: 'male_1' }),
      client.resolve('Hello there.', { ...options, speed: 1 }),
    ])

    expect(engine.synthesize).toHaveBeenCalledTimes(3)
  })

  it('stores a copy, because decoding detaches the buffer it is given', async () => {
    const engine = fakeEngine()
    const { client, store } = build(engine)
    await client.resolve('Hello there.', options)

    const stored = store.spy.put.mock.calls[0][2] as ArrayBuffer
    expect(stored.byteLength).toBe(8)
  })
})

describe('what an engine is actually asked to say', () => {
  /**
   * The dictionary reaching the model that runs on the device.
   *
   * Every clip that ships with the app is generated from the *normalised*
   * reading of its line — that is what makes a pre-generated affirmation and
   * the same sentence spoken on somebody's phone one voice saying one thing
   * rather than two readings under one cache key. The on-device engine was
   * handed the raw text instead, so the dictionary quietly stopped applying to
   * exactly the lines it exists for: the ones somebody typed themselves.
   */
  it('hands over the words as written and as the dictionary reads them', async () => {
    const engine = fakeEngine()
    const client = new TTSClient({
      engines: [engine],
      manifest: new StaticManifest('/speech/'),
      normalizer: new PronunciationNormalizer({
        supportsPhonemes: false,
        entries: [{ term: 'REM', say: 'rem', scope: 'core' }],
      }),
      getContext: fakeContext,
      browserCache: fakeStore().cache,
      staticBase: '/speech/',
    })

    await client.resolve('I rest in REM sleep.', options)

    const request = (engine.synthesize as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as EngineRequest
    // The backend has the dictionary too, and renders it with phonemes on.
    expect(request.text).toBe('I rest in REM sleep.')
    // An engine that speaks the words directly gets them ready to speak.
    expect(request.spoken).toBe('I rest in rem sleep.')
  })

  it('falls back to the written form when no rule touched the line', async () => {
    const engine = fakeEngine()
    const { client } = build(engine)
    await client.resolve('Hello there.', options)

    const request = (engine.synthesize as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as EngineRequest
    expect(request.spoken).toBe('Hello there.')
  })
})

describe('when there is nothing to fall back on', () => {
  it('says so plainly rather than hanging', async () => {
    const { client } = build(null)
    await expect(client.resolve('Hello there.', options)).rejects.toBeInstanceOf(
      NoEngineError,
    )
  })

  it('lets a preload fail in silence', async () => {
    const { client } = build(null)
    await expect(client.preload('Hello there.', options)).resolves.toBeUndefined()
  })

  it('cancels a caller without cancelling the work others are waiting on', async () => {
    const engine = fakeEngine()
    const { client } = build(engine)
    const controller = new AbortController()

    const cancelled = client.resolve('Hello there.', {
      ...options,
      signal: controller.signal,
    })
    const kept = client.resolve('Hello there.', options)
    controller.abort()

    await expect(cancelled).rejects.toBeTruthy()
    await expect(kept).resolves.toMatchObject({ source: 'engine' })
  })
})
