/**
 * Finding the audio, wherever it already is.
 *
 * The resolution order is the whole performance story of this feature, and it
 * is deliberately arranged so that the expensive thing is last and rare:
 *
 *     memory → browser cache → static assets → on-device model → remote engine
 *       µs         ~2 ms          ~10 ms           ~1–3 s          ~1–3 s
 *
 * The two engines at the end are tried in that order rather than the other way
 * round, and it is a privacy decision before it is a performance one: if this
 * device can say the sentence itself, the sentence does not leave the device.
 * A remote engine only ever sees text that nothing local could speak, and on
 * the static deployment there is no remote engine at all.
 *
 * Every layer above the engine writes into the layers above *it*, so a clip
 * gets cheaper every time it is heard: synthesised once anywhere, it is a disk
 * read on the server, then an IndexedDB read on the device, then nothing at
 * all. A loop of eight affirmations played twice does two round trips and then
 * never touches the network again — including with the backend switched off,
 * which is what makes this work in a PWA on a plane.
 *
 * The other half of the job is that identical requests collide constantly in
 * this app: a preloading line, the same line arriving for real a moment later,
 * and a second component asking for a preview of it. All three are one
 * synthesis. `inflight` is what makes that true, and it is keyed by exactly
 * the thing that decides the audio — the content hash — so the deduplication
 * is correct rather than merely likely.
 */

import { cacheKey, clampSpeed, type CacheKeyInput } from './cacheKey'
import { KOKORO_MODEL_VERSION } from './engines/kokoroModel'
import { BrowserCache } from './browserCache'
import { lookupOrder, markFormatUnplayable, preferredFormat } from './formats'
import { StaticManifest } from './manifest'
import { MemoryCache } from './memoryCache'
import { PronunciationNormalizer } from './pronunciation/normalizer'
import type {
  AudioFormat,
  CacheMode,
  Clip,
  ClipSource,
  LogicalVoice,
  TTSEngine,
} from './types'
import { AUDIO_VERSION, DEFAULT_LANGUAGE, PRONUNCIATION_VERSION, VOICE_VERSION } from './versions'

export interface ResolveOptions {
  voice: LogicalVoice
  speed: number
  language?: string
  cache?: CacheMode
  signal?: AbortSignal
}

export interface ResolvedClip {
  key: string
  buffer: AudioBuffer
  source: ClipSource
  format: AudioFormat
}

export interface TTSClientOptions {
  /**
   * The engines that can make a clip nothing had already, best first.
   *
   * A list rather than one, because a build can genuinely have two: the model
   * running on this device, and a speech service behind the app. They are
   * tried in the order given and the first one that answers wins.
   */
  engines: TTSEngine[]
  manifest: StaticManifest
  normalizer: PronunciationNormalizer
  /** The shared context, for decoding. Never created here. */
  getContext: () => AudioContext | null
  browserCache?: BrowserCache
  memoryCache?: MemoryCache
  /** Where a manual audio override's file lives. */
  staticBase: string
  language?: string
}

export class TTSClient {
  private engines: TTSEngine[]
  private manifest: StaticManifest
  private normalizer: PronunciationNormalizer
  private getContext: () => AudioContext | null
  private memory: MemoryCache
  private browser: BrowserCache
  private staticBase: string
  private language: string

  /** One promise per content address, shared by every caller that wants it. */
  private inflight = new Map<string, Promise<Clip>>()
  /** Aborts every request in flight — used when the app stops speaking. */
  private controller = new AbortController()

  constructor(options: TTSClientOptions) {
    this.engines = options.engines
    this.manifest = options.manifest
    this.normalizer = options.normalizer
    this.getContext = options.getContext
    this.memory = options.memoryCache ?? new MemoryCache()
    this.browser = options.browserCache ?? new BrowserCache()
    this.staticBase = options.staticBase
    this.language = options.language ?? DEFAULT_LANGUAGE
  }

  /**
   * The content address of a request.
   *
   * Computed from the words *as written*, not from the words after the
   * dictionary has been applied. Which of those two is hashed matters more
   * than it looks: the written form is the only one every participant has
   * before doing any work, so the browser, the backend and the build script
   * can each name the same file without having to agree on a normalisation
   * pass first. The dictionary still takes part — `PRONUNCIATION_VERSION` is
   * in the key — so changing a rule re-keys every clip that could contain it.
   */
  keyFor(text: string, options: ResolveOptions): string {
    return cacheKey(this.keyInput(text, options))
  }

  private keyInput(text: string, options: ResolveOptions): CacheKeyInput {
    return {
      text,
      voice: options.voice,
      voiceVersion: VOICE_VERSION,
      speed: clampSpeed(options.speed),
      language: (options.language ?? this.language).toLowerCase(),
      modelVersion: this.modelVersion(),
      pronunciationVersion: PRONUNCIATION_VERSION,
      audioVersion: AUDIO_VERSION,
    }
  }

  /**
   * Which model version this build keys against.
   *
   * With an engine, whatever it says it is running. Without one — the static
   * deployment, where there is no service to ask — the clips that shipped are
   * the only clips there are, so the answer has to be whatever *made* them:
   * the manifest's own declaration once it has been read, and the shipped
   * default until then, which is the value the build script uses.
   *
   * Getting this wrong is not a small mistake. `'none'` was the first attempt,
   * and it meant every key on the static build was a key nothing had ever been
   * generated under: the manifest was fetched, every lookup missed, and a
   * deployment carrying two thousand pre-generated clips read every line in
   * the device's own voice.
   */
  private modelVersion(): string {
    return (
      this.engines[0]?.descriptor.modelVersion ??
      this.manifest.modelVersion ??
      KOKORO_MODEL_VERSION
    )
  }

  /**
   * Get the audio, from wherever it is cheapest.
   *
   * Rejects only when there is genuinely no way to produce it — every caller
   * treats that as "use the device's own voice for this line" rather than as
   * an error worth showing anybody.
   */
  async resolve(text: string, options: ResolveOptions): Promise<ResolvedClip> {
    const format = preferredFormat()
    try {
      return await this.resolveAs(text, options, format)
    } catch (error) {
      if (error instanceof DecodeError && error.hadBytes) {
        /*
         * This browser has just told us it cannot decode that container.
         * Remember it, and ask for the other one — once.
         *
         * `hadBytes` is what keeps that verdict honest. The conclusion is
         * persisted for the life of the installation, so it must only ever be
         * drawn from a decoder that was given something to decode: a failure
         * on an empty buffer says nothing about the codec, and acting on it
         * would condemn every future visit to the larger encoding.
         */
        // Blame the container that actually failed, which is not always the
        // one that was asked for: a clip resolved out of the cache or made on
        // this device can arrive in a different encoding entirely.
        const next = markFormatUnplayable(error.format)
        if (next && next !== format) return this.resolveAs(text, options, next)
      }
      throw error
    }
  }

  /**
   * Warm the caches for something the app knows it is about to say.
   *
   * Two shapes, chosen by whether the audio hardware is open yet. With a live
   * context the clip is decoded as well, so the moment it is wanted there is
   * nothing left to do at all. Without one — the app has been launched but
   * nobody has pressed anything — the bytes are fetched and stored, and the
   * decode waits, because decoding needs a context and opening one outside a
   * gesture is the thing browsers refuse.
   *
   * Deliberately quiet either way: a preload that fails is not a problem,
   * because the thing it was preparing for has not happened yet and will do
   * its own work when it does.
   */
  async preload(text: string, options: ResolveOptions): Promise<void> {
    try {
      if (this.getContext()) {
        await this.resolve(text, options)
        return
      }
      await this.warm(text, options)
    } catch {
      /* Nothing was owed. */
    }
  }

  /** Fetch and store the encoded bytes, without decoding them. */
  async warm(text: string, options: ResolveOptions): Promise<void> {
    const format = preferredFormat()
    const key = this.keyFor(text, options)
    if (this.memory.has(key)) return
    await withSignal(this.obtain(text, options, format, key, 'default'), options.signal)
  }

  /**
   * Change which engines are available, keeping every cache intact.
   *
   * Called when the on-device model finishes installing, which is the one
   * moment during a session when the answer to "what can make a clip?"
   * changes. Rebuilding the client instead would throw away the decoded
   * buffers of everything already heard — the loop would stutter at exactly
   * the moment the voice was supposed to get better.
   */
  setEngines(engines: TTSEngine[]): void {
    this.engines = engines
  }

  /** Stop every fetch and synthesis in flight. */
  cancelAll(): void {
    this.controller.abort(new Error('cancelled'))
    this.controller = new AbortController()
    this.inflight.clear()
  }

  /* ── internals ── */

  private async resolveAs(
    text: string,
    options: ResolveOptions,
    format: AudioFormat,
  ): Promise<ResolvedClip> {
    const mode: CacheMode = options.cache ?? 'default'
    const key = this.keyFor(text, options)

    /*
     * 1. Memory. The only layer with no asynchrony at all.
     *
     * Keyed by the clip rather than by the clip *and* its container: once it
     * is decoded, which encoding it arrived in is a fact about the past. Two
     * entries for one sentence would be two copies of the same 300 KB of PCM
     * in a budget measured in megabytes.
     */
    if (mode === 'default') {
      const hit = this.memory.get(key)
      if (hit) return { key, buffer: hit, source: 'memory', format }
    }

    const clip = await withSignal(
      this.obtain(text, options, format, key, mode),
      options.signal,
    )
    /*
     * Decode a copy, never the clip's own bytes.
     *
     * `decodeAudioData` detaches the buffer it is handed, and the whole point
     * of `obtain` is that several callers share one result — a preload and the
     * line it was preparing for are the common pair. The second of them would
     * be decoding an empty buffer, and what that looks like from the outside
     * is a *format* failure: the app concludes this browser cannot play Opus,
     * remembers it, and re-fetches everything as MP3 for the rest of time.
     * Which is exactly what it did, until this line.
     */
    const buffer = await this.decode(clip.bytes.slice(0), clip.format)
    if (mode !== 'no-store') this.memory.set(key, buffer)
    return { key, buffer, source: clip.source, format: clip.format }
  }

  /**
   * The bytes, deduplicated.
   *
   * Two callers asking for the same clip at the same moment — which happens
   * constantly, because the app preloads the line it is about to speak — share
   * one walk down the resolution order and therefore one synthesis.
   */
  private obtain(
    text: string,
    options: ResolveOptions,
    format: AudioFormat,
    key: string,
    mode: CacheMode,
  ): Promise<Clip> {
    const id = `${key}.${format}`
    if (mode !== 'default') return this.fetchClip(text, options, format, key, mode)

    const existing = this.inflight.get(id)
    if (existing) return existing

    const work = this.fetchClip(text, options, format, key, mode).finally(() => {
      if (this.inflight.get(id) === work) this.inflight.delete(id)
    })
    this.inflight.set(id, work)
    return work
  }

  /**
   * The layers below memory, in order.
   *
   * Each one hands its bytes to the ones above it on the way back, so the
   * expensive path is walked at most once per clip per device.
   */
  private async fetchClip(
    text: string,
    options: ResolveOptions,
    format: AudioFormat,
    key: string,
    mode: CacheMode,
  ): Promise<Clip> {
    const signal = this.controller.signal
    const speed = clampSpeed(options.speed)
    const language = (options.language ?? this.language).toLowerCase()
    const order = lookupOrder(format)

    // A phrase with a recording of its own never goes near an engine.
    const override = this.normalizer.normalize(text).audio
    if (override) {
      const bytes = await this.fetchBytes(`${this.staticBase}${override}`, signal)
      if (bytes) return { key, format, bytes, source: 'static' }
    }

    if (mode !== 'reload') {
      // 2. What this device has heard before, in whatever encoding it kept.
      const stored = await this.browser.find(key, order)
      if (stored) {
        return { key, format: stored.format, bytes: stored.bytes, source: 'browser-cache' }
      }

      // 3. What shipped with the app.
      const shipped = await this.manifest.find(key, order)
      if (shipped) {
        const bytes = await this.fetchBytes(shipped.url, signal)
        if (bytes) {
          await this.store(key, shipped.format, bytes, mode)
          return { key, format: shipped.format, bytes, source: 'static' }
        }
      }
    }

    if (this.engines.length === 0) throw new NoEngineError()

    /*
     * 4. Whichever engine can make it, in order of preference.
     *
     * Each is given the same request and the same two chances — "do you
     * already have this?" then "make it" — and the first to answer ends the
     * walk. An engine that throws is not fatal while another remains: the
     * on-device model failing on a phone that has run out of memory should
     * fall through to the service, not to silence. Only when they have all
     * failed does the caller hear about it, and by then the honest answer is
     * the device's own voice.
     */
    const request = {
      text,
      voice: options.voice,
      speed,
      language,
      format,
      key,
      reload: mode === 'reload',
    }

    let lastError: unknown = null
    for (const engine of this.engines) {
      try {
        if (mode !== 'reload') {
          const found = await engine.lookup(request, signal)
          if (found) {
            await this.store(key, found.format, found.bytes, mode)
            return {
              key,
              format: found.format,
              bytes: found.bytes,
              source: 'server-cache',
            }
          }
        }

        const made = await engine.synthesize(request, signal)
        await this.store(key, made.format, made.bytes, mode)
        return { key, format: made.format, bytes: made.bytes, source: made.source }
      } catch (error) {
        if (signal.aborted || options.signal?.aborted) throw error
        lastError = error
      }
    }

    throw lastError ?? new NoEngineError()
  }

  private async store(
    key: string,
    format: AudioFormat,
    bytes: ArrayBuffer,
    mode: CacheMode,
  ): Promise<void> {
    if (mode === 'no-store') return
    // `decodeAudioData` detaches the buffer it is given, so what goes to
    // storage has to be a copy taken before anything decodes it. Skipping
    // this is the classic version of this bug: the clip plays perfectly, and
    // what lands in IndexedDB is zero bytes.
    await this.browser.put(key, format, bytes.slice(0))
  }

  private async fetchBytes(
    url: string,
    signal: AbortSignal,
  ): Promise<ArrayBuffer | null> {
    try {
      const response = await fetch(url, { signal, cache: 'force-cache' })
      if (!response.ok) return null
      const bytes = await response.arrayBuffer()
      return bytes.byteLength > 0 ? bytes : null
    } catch {
      return null
    }
  }

  /**
   * Decode, on the shared context.
   *
   * The two spellings of `decodeAudioData` are both here because Safari
   * supported only the callback form for years and the promise form still
   * returns `undefined` on some builds when handed a container it does not
   * understand — which is the case that has to be distinguishable, since it is
   * what triggers the switch from Opus to MP3.
   */
  private decode(bytes: ArrayBuffer, format: AudioFormat): Promise<AudioBuffer> {
    const ctx = this.getContext()
    if (!ctx) return Promise.reject(new Error('No audio context'))

    return new Promise<AudioBuffer>((resolve, reject) => {
      let settled = false
      const ok = (buffer: AudioBuffer) => {
        if (settled) return
        settled = true
        resolve(buffer)
      }
      const fail = () => {
        if (settled) return
        settled = true
        reject(new DecodeError(format, bytes.byteLength > 0))
      }

      try {
        const maybe = ctx.decodeAudioData(bytes, ok, fail)
        if (maybe && typeof maybe.then === 'function') {
          maybe.then(ok, fail)
        }
      } catch {
        fail()
      }
    })
  }
}

/** The browser cannot play this container. Caught in `resolve`. */
export class DecodeError extends Error {
  format: AudioFormat
  /** False when the decoder was handed nothing, which blames no codec. */
  hadBytes: boolean

  constructor(format: AudioFormat, hadBytes: boolean) {
    super(`Could not decode ${format} audio`)
    this.name = 'DecodeError'
    this.format = format
    this.hadBytes = hadBytes
  }
}

/** No engine is configured, and nothing had the clip already. */
export class NoEngineError extends Error {
  constructor() {
    super('No speech engine is configured')
    this.name = 'NoEngineError'
  }
}

/**
 * Give one caller a cancellable view of a shared promise.
 *
 * The underlying work is deliberately *not* cancelled: three components can be
 * waiting on one synthesis, and the first of them navigating away is not a
 * reason to make the other two start again. `cancelAll` is what actually stops
 * the work, and it is called when the app as a whole stops wanting sound.
 */
function withSignal<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise
  if (signal.aborted) return Promise.reject(signal.reason ?? new Error('aborted'))
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(signal.reason ?? new Error('aborted'))
    signal.addEventListener('abort', onAbort, { once: true })
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort)
        resolve(value)
      },
      (error) => {
        signal.removeEventListener('abort', onAbort)
        reject(error)
      },
    )
  })
}
