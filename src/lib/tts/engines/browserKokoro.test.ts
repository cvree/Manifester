import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { StudioRequest, StudioResponse } from '../studioTypes'
import { BrowserKokoroEngine, type StudioWorker } from './browserKokoro'

/**
 * The Studio Voice lifecycle, without eighty-six megabytes.
 *
 * Everything here is a state machine on the page side of a worker boundary,
 * and the failure that matters most is not a wrong answer — it is no answer:
 * somebody left on "Preparing your voice…" for ever because a message never
 * arrived, a worker died quietly, or a stale "installed" flag kept asking for
 * files a browser had already evicted. Those are exactly the paths a real
 * install can never be made to take on demand, so they are tested here.
 */

/** A worker that records what it was told and can be answered by hand. */
function fakeWorker() {
  const sent: StudioRequest[] = []
  let terminated = false
  const worker: StudioWorker = {
    postMessage: (message) => void sent.push(message),
    terminate: () => {
      terminated = true
    },
    onmessage: null,
    onerror: null,
    onmessageerror: null,
  }
  return {
    worker,
    sent,
    get terminated() {
      return terminated
    },
    reply(message: StudioResponse) {
      worker.onmessage?.({ data: message } as MessageEvent<StudioResponse>)
    },
    die() {
      worker.onerror?.(new Error('worker died'))
    },
  }
}

function build() {
  const fake = fakeWorker()
  let created = 0
  const engine = new BrowserKokoroEngine(() => {
    created += 1
    return fake.worker
  })
  return {
    engine,
    fake,
    get created() {
      return created
    },
  }
}

const store = new Map<string, string>()

beforeEach(() => {
  store.clear()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    },
  })
  // `studioVoiceSupported` wants these three and nothing else.
  vi.stubGlobal('window', globalThis)
  vi.stubGlobal('Worker', class {})
  vi.stubGlobal('caches', {})
  vi.stubGlobal('navigator', {})
})

afterEach(() => {
  vi.unstubAllGlobals()
  Reflect.deleteProperty(globalThis, 'localStorage')
})

describe('installing Studio Voice', () => {
  it('creates nothing until somebody asks', async () => {
    const { engine, created } = build()
    expect(engine.getSnapshot().state).toBe('available')
    expect(created).toBe(0)

    // A device that has never installed it must not even open a worker to
    // find that out — that is the whole "no surprise downloads" promise.
    expect(await engine.resume()).toBe(false)
    expect(created).toBe(0)
  })

  it('reports progress and then readiness', async () => {
    const { engine, fake } = build()
    const seen: string[] = []
    engine.subscribe((snapshot) => seen.push(snapshot.state))

    const installing = engine.install()
    expect(fake.sent[0]).toMatchObject({ type: 'install' })
    expect(engine.getSnapshot().state).toBe('installing')

    fake.reply({ type: 'progress', loaded: 45_000_000, total: 90_000_000, file: 'model' })
    expect(engine.getSnapshot().loaded).toBe(45_000_000)

    fake.reply({ type: 'ready', backend: 'webgpu' })
    expect(await installing).toBe(true)
    expect(engine.getSnapshot()).toMatchObject({ state: 'ready', backend: 'webgpu' })
    expect(engine.everInstalled).toBe(true)
    expect(await engine.probe()).toBe(true)
    expect(seen).toContain('installing')
    expect(seen).toContain('ready')
  })

  it('collapses two presses into one install', async () => {
    const { engine, fake } = build()
    const first = engine.install()
    const second = engine.install()
    fake.reply({ type: 'ready', backend: 'wasm' })
    expect(await Promise.all([first, second])).toEqual([true, true])
    expect(fake.sent.filter((message) => message.type === 'install')).toHaveLength(1)
  })

  it('resumes only when the files are already there', async () => {
    // A previous visit installed it, so the flag is set and this load tries to
    // bring the model back without asking anybody anything.
    store.set('manifester:tts.studioVoice', 'installed')
    const restarted = build()

    const resuming = restarted.engine.resume()
    expect(restarted.fake.sent[0]).toMatchObject({ type: 'resume' })

    /*
     * The browser evicted the cache between visits. Not an error and not worth
     * a word on screen — but the flag has to go, or every future load asks the
     * same question and every future load gets the same answer.
     */
    restarted.fake.reply({
      type: 'failed',
      reason: 'not-cached',
      message: 'Studio Voice is not installed.',
    })
    expect(await resuming).toBe(false)
    expect(restarted.engine.getSnapshot()).toMatchObject({
      state: 'available',
      failure: null,
    })
    expect(restarted.engine.everInstalled).toBe(false)
  })

  it('keeps a real failure on screen, with a way back', async () => {
    const { engine, fake } = build()
    const installing = engine.install()
    fake.reply({ type: 'failed', reason: 'storage', message: 'QuotaExceededError' })

    expect(await installing).toBe(false)
    expect(engine.getSnapshot()).toMatchObject({ state: 'failed', failure: 'storage' })
    expect(fake.terminated).toBe(true)
    // And the flag is not set, so nothing tries to resume a model that is not
    // there on the next visit.
    expect(engine.everInstalled).toBe(false)
  })

  it('cancelling stops the worker and offers the install again', async () => {
    const { engine, fake } = build()
    const installing = engine.install()
    engine.cancelInstall()

    expect(await installing).toBe(false)
    expect(fake.terminated).toBe(true)
    expect(engine.getSnapshot()).toMatchObject({
      state: 'available',
      failure: 'cancelled',
      loaded: 0,
    })
  })

  it('a worker that dies never leaves the interface waiting', async () => {
    const { engine, fake } = build()
    const installing = engine.install()

    /*
     * Twice, because a dead worker is now worth one second attempt against the
     * other copy of the engine before anybody is told it did not work. See
     * `runtime.ts`: the overwhelmingly common cause of this failure was the
     * engine being fetched from a CDN that something on the machine refused to
     * let through, and the recovery for that is to use the bundled one.
     */
    fake.die()
    await Promise.resolve()
    fake.die()

    expect(await installing).toBe(false)
    expect(engine.getSnapshot().state).toBe('failed')
    // Not "your device cannot do this" — the engine could not be loaded.
    expect(engine.getSnapshot().failure).toBe('runtime')
  })

  /**
   * The bug this whole attempt matrix exists for.
   *
   * The GPU and CPU attempts used to happen inside one worker. ONNX Runtime
   * initialises its WebAssembly once per thread and refuses afterwards, so the
   * CPU fallback threw an error about the GPU failure that sent it there —
   * which meant every device whose GPU could not run this graph was told its
   * device could not start the voice engine, with nothing behind the message.
   */
  it('falls back from the GPU to the CPU in a brand new worker', async () => {
    vi.stubGlobal('navigator', { gpu: {} })
    const built = build()
    const installing = built.engine.install()

    expect(built.fake.sent[0]).toMatchObject({ type: 'install', backend: 'webgpu' })
    expect(built.created).toBe(1)

    built.fake.reply({
      type: 'failed',
      reason: 'unsupported',
      message: 'webgpu: Could not find an implementation for ConvTranspose',
    })
    await Promise.resolve()

    // A *second* worker, not the one that just failed.
    expect(built.created).toBe(2)
    expect(built.fake.sent.at(-1)).toMatchObject({
      type: 'install',
      backend: 'wasm',
      runtime: 'bundled',
    })
    expect(built.engine.getSnapshot()).toMatchObject({ state: 'installing' })

    built.fake.reply({ type: 'ready', backend: 'wasm' })
    expect(await installing).toBe(true)
    expect(built.engine.getSnapshot().backend).toBe('wasm')
  })

  it('keeps a readable trail of what every attempt said', async () => {
    vi.stubGlobal('navigator', { gpu: {} })
    const { engine, fake } = build()
    const installing = engine.install()

    fake.reply({ type: 'failed', reason: 'unsupported', message: 'webgpu: no kernel' })
    await Promise.resolve()
    fake.reply({ type: 'ready', backend: 'wasm' })
    await installing

    const trail = engine.getSnapshot().trail
    expect(trail).toHaveLength(2)
    expect(trail[0]).toContain('bundled/webgpu')
    expect(trail[0]).toContain('no kernel')
    expect(trail[1]).toBe('bundled/wasm: ready')
  })

  it('tries the other engine once before giving up, and remembers what worked', async () => {
    const { engine, fake } = build()
    const installing = engine.install()

    expect(fake.sent[0]).toMatchObject({ type: 'install', runtime: 'bundled' })
    fake.reply({
      type: 'failed',
      reason: 'runtime',
      message: 'no available backend found.',
    })
    await Promise.resolve()

    // Still preparing, from the outside: the app is recovering by itself.
    expect(engine.getSnapshot()).toMatchObject({ state: 'installing', retrying: true })
    const second = fake.sent.filter((message) => message.type === 'install').at(-1)
    expect(second).toMatchObject({ runtime: 'cdn' })

    fake.reply({ type: 'ready', backend: 'wasm' })
    expect(await installing).toBe(true)

    // And the next install on this device starts with the one that worked.
    const again = build()
    void again.engine.install()
    expect(again.fake.sent[0]).toMatchObject({ runtime: 'cdn' })
  })

  it('does not go looking for a second engine when there is no room', async () => {
    const { engine, fake } = build()
    const installing = engine.install()
    fake.reply({ type: 'failed', reason: 'storage', message: 'QuotaExceededError' })

    expect(await installing).toBe(false)
    // One attempt. A device with no room has no room either way, and proving
    // it a second time would be another ninety megabytes.
    expect(fake.sent.filter((message) => message.type === 'install')).toHaveLength(1)
  })

  it('forgets on request', async () => {
    const { engine, fake } = build()
    const installing = engine.install()
    fake.reply({ type: 'ready', backend: 'wasm' })
    await installing

    engine.forget()
    expect(engine.everInstalled).toBe(false)
    expect(engine.getSnapshot().state).toBe('available')
  })
})

describe('speaking', () => {
  const request = {
    text: 'I am steady.',
    voice: 'female_1' as const,
    speed: 0.9,
    language: 'en-us',
    format: 'mp3' as const,
    key: 'abc',
  }

  async function ready() {
    const built = build()
    const installing = built.engine.install()
    built.fake.reply({ type: 'ready', backend: 'wasm' })
    await installing
    return built
  }

  it('refuses before the model is up rather than hanging', async () => {
    const { engine } = build()
    await expect(engine.synthesize(request)).rejects.toThrow(/not running/)
  })

  it('wraps the samples it is given in a playable container', async () => {
    const { engine, fake } = await ready()

    const speaking = engine.synthesize(request)
    const asked = fake.sent.at(-1)
    expect(asked).toMatchObject({ type: 'synthesize', voice: 'af_heart', speed: 0.9 })

    const samples = new Float32Array([0, 0.5, -0.5, 0])
    fake.reply({
      type: 'audio',
      id: (asked as { id: number }).id,
      samples,
      sampleRate: 24_000,
    })

    const result = await speaking
    expect(result.format).toBe('wav')
    expect(result.source).toBe('engine')
    // 44-byte header, 16-bit mono.
    expect(result.bytes.byteLength).toBe(44 + samples.length * 2)
  })

  it('surfaces a synthesis error instead of never resolving', async () => {
    const { engine, fake } = await ready()
    const speaking = engine.synthesize(request)
    const id = (fake.sent.at(-1) as { id: number }).id
    fake.reply({ type: 'error', id, message: 'out of memory' })
    await expect(speaking).rejects.toThrow('out of memory')
  })

  it('abandons a line nobody is waiting for any more', async () => {
    const { engine, fake } = await ready()
    const controller = new AbortController()
    const speaking = engine.synthesize(request, controller.signal)

    controller.abort()
    await expect(speaking).rejects.toThrow('aborted')

    // The worker is told, so the answer is dropped rather than arriving after
    // the line that replaced it.
    expect(fake.sent.at(-1)).toMatchObject({ type: 'cancel' })
  })

  it('has nothing of its own to look in', async () => {
    const { engine } = build()
    expect(await engine.lookup()).toBeNull()
  })
})
