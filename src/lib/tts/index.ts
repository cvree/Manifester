/**
 * The voice, as the rest of the app is allowed to see it.
 *
 *     tts.unlock()                       // from the first tap
 *     tts.speak('photosynthesis', { voice: 'female_1' })
 *     tts.preload(nextLine, { voice: 'female_1' })
 *     tts.stop()
 *
 * That is the entire surface. Everything underneath — which engine, which
 * cache, which container, which of six places the audio actually came from,
 * and what to do when the model is unreachable — is decided here and never
 * leaks upward. A component that wants a word spoken says so and gets on with
 * being a component.
 *
 * The one piece of ceremony is `unlock()`, and it is not ceremony: browsers
 * will not open audio outside a user gesture, so the first Start or Play tap
 * has to reach this synchronously. Every path that can lead to speech in this
 * app goes through it.
 */

import type { AudioBus } from '../audioBus'
import { langForText } from '../deviceVoice'
import { readLocal, writeLocal } from '../storage'
import type { RankedVoice } from '../voiceRanking'
import { TTSClient, NoEngineError, type ResolveOptions } from './client'
import { DEFAULT_CONFIG, type TTSConfig } from './config'
import { browserKokoro, type StudioSnapshot } from './engines/browserKokoro'
import { KokoroEngine } from './engines/kokoro'
import { FallbackVoice } from './fallback'
import { StaticManifest } from './manifest'
import { AudioPlayer } from './player'
import {
  PronunciationNormalizer,
  createNormalizer,
} from './pronunciation/normalizer'
import type { PronunciationEntry } from './pronunciation/types'
import { bridgeRate, voiceShape } from './shape'
import type {
  ClipSource,
  LogicalVoice,
  SpeakOptions,
  SpeakOutcome,
  TTSEngine,
} from './types'
import { voiceProfile } from './voices'

/** Which voice a line was actually spoken in. */
export type VoiceKind = 'studio' | 'device' | 'none'

export interface TTSStatus {
  /** What the next line would be spoken by, as far as anything knows. */
  engine: VoiceKind
  /** True while a line is being fetched or synthesised. */
  loading: boolean
  /** Where the last clip came from. Diagnostics only. */
  lastSource: ClipSource | 'fallback' | null
  /** True when the studio voice has been asked for and could not be had. */
  degraded: boolean
  /**
   * True when *anything at all* can be said in the studio voice here.
   *
   * The distinction that matters to the interface. `engine: 'studio'` can be
   * true on a build that only has a shelf of pre-generated clips, where a line
   * somebody typed themselves still falls back to the device. This is the
   * stronger claim: there is a model on this device, so their own words are
   * read by Ivy or Fen too.
   */
  unlimited: boolean
  /**
   * True when something here can make a clip that does not already exist.
   *
   * Weaker than `unlimited` — a reachable backend counts, and that is not a
   * model on this device — and it is the question that decides whether the
   * *shape* controls are real. A build with neither a service nor a model
   * still speaks in the studio voice, out of the shelf of clips that shipped
   * with it; what it cannot do is produce that voice at a speed nobody
   * pre-generated. Asking it to would quietly hand the line to the device's
   * own voice, so the control that would ask is not offered. See
   * `VoiceSettings`.
   */
  synthesises: boolean
}

export interface SpeakSettings extends SpeakOptions {
  /**
   * Ask for the device's own voice rather than the studio one.
   *
   * Set when somebody has deliberately chosen a device voice in the settings.
   * It is a preference, not a fallback: `allowFallback` is what governs what
   * happens when the studio voice is wanted and cannot be had.
   */
  prefer?: 'studio' | 'device'
  /** An exact device voice, for the fallback path only. */
  deviceVoiceURI?: string | null
  /**
   * How high the voice reads, on both paths.
   *
   * The device voice takes it straight through to the platform. The studio
   * voice gets it by being rendered at a compensating speed and played back
   * faster or slower — which moves the pitch and leaves the tempo alone. See
   * `shape.ts`; it is why this is no longer a fallback-only control.
   */
  pitch?: number
}

/**
 * How long a failed studio line speaks for the ones after it.
 *
 * Long enough that a dead backend costs one round trip rather than twenty;
 * short enough that a phone coming back onto a network is speaking properly
 * again within a few lines.
 */
const ENGINE_RETRY_MS = 5000

/**
 * How long a line will wait for the backend to say which model it is running.
 *
 * ── Why there is a deadline at all ──
 *
 * `warmUp` exists so that the page and the server agree on the model version
 * that goes into every cache key, and waiting for it costs one round trip on
 * the first line of a session. That is a fair trade against a health check
 * that answers. It is not a fair trade against one that does not: a backend
 * behind a captive portal, a phone on a dead cell, a container still starting
 * up — all of them hold the request open for the full four-second lookup
 * timeout, and the whole time the first line of somebody's ritual is not being
 * spoken, and not being fetched either, because `preload` waits on the same
 * promise. That is the "massive delay when the audio loads" that this number
 * removes.
 *
 * So the wait is bounded and the fallback is the value the build ships with —
 * which is the same value the backend reports in every case except the one
 * where somebody has upgraded the container without rebuilding the front end.
 * A wrong guess costs a cache miss on one line; the probe lands a moment later
 * and every line after it is keyed correctly.
 */
const WARM_UP_BUDGET_MS = 600

/**
 * Which repairs of the on-device cache this installation has already had.
 *
 * A number rather than a flag, so the next one that is ever needed is `2`
 * rather than a second key. `1` is the repair that went with fixing Studio
 * Voice: every line the model synthesised before it worked properly is still
 * on the device, addressed by a hash of the words rather than of the backend
 * that made them — so without this, fixing the engine changed nothing anybody
 * could hear, because the wrong recording was returned before any engine was
 * consulted. See `TTSClient.dropLocalSyntheses`.
 */
const CACHE_REPAIR_KEY = 'tts.cacheRepair'
const CACHE_REPAIR = '1'

const DEFAULT_SPEAK: Required<
  Pick<SpeakSettings, 'voice' | 'speed' | 'volume' | 'priority' | 'allowFallback' | 'pitch'>
> = {
  voice: 'female_1',
  speed: 1,
  volume: 1,
  priority: 'interrupt',
  allowFallback: true,
  pitch: 1,
}

class TTS {
  private config: TTSConfig = { ...DEFAULT_CONFIG }
  /** The service behind this build, when there is one. */
  private remote: TTSEngine | null = null
  private normalizer: PronunciationNormalizer
  private manifest: StaticManifest
  private client: TTSClient
  private player: AudioPlayer
  private fallbackVoice = new FallbackVoice()
  private bus: AudioBus | null = null

  /** Bumped by every interruption, so a slow arrival cannot speak late. */
  private generation = 0
  /** Tail of the queue, for `priority: 'queue'`. */
  private chain: Promise<unknown> = Promise.resolve()
  private listeners = new Set<(status: TTSStatus) => void>()
  private status: TTSStatus = {
    engine: 'none',
    loading: false,
    lastSource: null,
    degraded: false,
    unlimited: false,
    synthesises: false,
  }
  /** Resolves once the engine has said which model version it is running. */
  private ready: Promise<void> | null = null
  /**
   * When the studio voice last failed to produce a line.
   *
   * A backend that is down is down for every line, not just the one that
   * discovered it. Without this, a twenty-line loop with no network spends two
   * requests and one timeout *per line* rediscovering the same fact — which is
   * slow, noisy, and on a phone is somebody's battery. So a failure stands for
   * a few seconds and every line in that window goes straight to the device's
   * own voice; after it, one line pays to find out whether the voice is back.
   */
  private engineFailedAt = 0
  /**
   * The speed the clip in the speakers was rendered at.
   *
   * Zero when nothing studio-made is playing. It is the reference a live speed
   * change is measured against — see `setLiveRate`.
   */
  private liveSynthesisSpeed = 0

  constructor() {
    this.normalizer = createNormalizer({
      scopes: this.config.scopes,
      supportsPhonemes: false,
    })
    this.manifest = new StaticManifest(this.config.staticBase)
    this.remote = this.buildRemote()
    this.player = new AudioPlayer(() => this.context())
    this.client = new TTSClient({
      engines: this.engines(),
      manifest: this.manifest,
      normalizer: this.normalizer,
      getContext: () => this.context(),
      staticBase: this.config.staticBase,
      language: this.config.language,
    })
    this.status.engine = this.remote ? 'studio' : 'device'
    this.status.synthesises = this.engines().length > 0
  }

  /**
   * The engines, best first.
   *
   * On-device before remote, always. The model on this phone is free, private
   * and works on a plane; the service is none of those, and is only reached
   * for what the phone could not say itself. On the GitHub Pages build the
   * second entry does not exist at all.
   */
  private engines(): TTSEngine[] {
    const list: TTSEngine[] = []
    if (browserKokoro.getSnapshot().state === 'ready') list.push(browserKokoro)
    if (this.remote) list.push(this.remote)
    return list
  }

  /** Re-read which engines exist, without disturbing anything already cached. */
  private refreshEngines(): void {
    const engines = this.engines()
    this.client.setEngines(engines)
    this.publish({ synthesises: engines.length > 0 })
  }

  /* ── Wiring ───────────────────────────────────────────────── */

  /**
   * Hand the voice the app's one `AudioContext`.
   *
   * Not its own: a second context on iOS is a second thing that can be
   * interrupted, suspended, and left silently not running, and the ambience
   * already has all the machinery for keeping one alive. See `AudioBus`.
   */
  attach(bus: AudioBus): void {
    this.bus = bus
  }

  configure(overrides: Partial<TTSConfig>): void {
    this.config = { ...this.config, ...overrides }
    this.normalizer.setScopes(this.config.scopes)
    this.manifest = new StaticManifest(this.config.staticBase)
    this.remote = this.buildRemote()
    this.ready = null
    this.client = new TTSClient({
      engines: this.engines(),
      manifest: this.manifest,
      normalizer: this.normalizer,
      getContext: () => this.context(),
      staticBase: this.config.staticBase,
      language: this.config.language,
    })
    this.publish({
      engine: this.remote ? 'studio' : 'device',
      synthesises: this.engines().length > 0,
    })
  }

  /* ── The on-device model ──────────────────────────────────────── */

  /**
   * Start watching the on-device model, and bring it back if it is installed.
   *
   * Called once, from the provider that owns the session. Deliberately not
   * done at module load: creating a worker is a side effect, and a module that
   * spawns one the moment it is imported cannot be unit tested and cannot be
   * imported by anything that does not want a model.
   */
  watchStudioVoice(): () => void {
    void this.repairCache()
    const unsubscribe = browserKokoro.subscribe((snapshot) => {
      this.refreshEngines()
      const ready = snapshot.state === 'ready'
      this.publish({
        unlimited: ready,
        // A model on the device settles the question for everything, including
        // lines nobody could have pre-generated.
        ...(ready ? { engine: 'studio' as const, degraded: false } : {}),
      })
      // A voice that has just arrived should be used by the *next* line, and
      // a failure should not leave a stale "resting" flag suppressing it.
      if (ready) this.engineFailedAt = 0
    })
    void browserKokoro.resume()
    return unsubscribe
  }

  /** Download and start the on-device model. From a deliberate press only. */
  installStudioVoice(): Promise<boolean> {
    return browserKokoro.install()
  }

  /**
   * Throw away speech this device made under an engine that was not working.
   *
   * Once per installation, and silent either way. It is a cache of bytes that
   * can always be made again, so the worst case is that one line is
   * re-synthesised the next time it is played; the case it exists for is
   * somebody who installed Studio Voice while it was producing noise, for whom
   * every fix to the engine would otherwise be invisible behind a recording of
   * the bug. See `CACHE_REPAIR`.
   */
  private async repairCache(): Promise<void> {
    if (readLocal(CACHE_REPAIR_KEY) === CACHE_REPAIR) return
    // Written first: a repair that fails is not worth running on every load,
    // and the clips it would have dropped are re-made on demand anyway.
    writeLocal(CACHE_REPAIR_KEY, CACHE_REPAIR)
    try {
      await this.client.dropLocalSyntheses()
    } catch {
      /* A cache that will not open has nothing stale in it to worry about. */
    }
  }

  get studio(): StudioSnapshot {
    return browserKokoro.getSnapshot()
  }

  /** Device voices, for the fallback path. */
  setDeviceVoices(raw: SpeechSynthesisVoice[], ranked: RankedVoice[]): void {
    this.fallbackVoice.setVoices(raw, ranked)
  }

  /** Teach the dictionary a term at runtime. See `pronunciation/`. */
  addPronunciation(entries: PronunciationEntry[]): void {
    this.normalizer.add(entries)
  }

  subscribe(listener: (status: TTSStatus) => void): () => void {
    this.listeners.add(listener)
    listener(this.status)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getStatus(): TTSStatus {
    return this.status
  }

  /* ── The four verbs ───────────────────────────────────────── */

  /**
   * Open the audio hardware. Must be called from inside a user gesture.
   *
   * Safe to call on every tap: the context is created once, and waking one
   * that is already running is free. It also takes the opportunity to ask the
   * backend whether it is there, so the first `speak` does not have to wait to
   * find out.
   */
  unlock(): void {
    this.bus?.ensure()
    this.player.unlock()
    void this.warmUp()
  }

  /**
   * Say something.
   *
   * Resolves when the words have finished, been interrupted, been dropped, or
   * failed — never rejects. Speech failing is a fact about the audio, not an
   * exception in the caller's control flow, and a loop that has to wrap every
   * line in a `try` is a loop that will eventually forget to.
   */
  async speak(text: string, options: SpeakSettings = {}): Promise<SpeakOutcome> {
    const words = text?.trim()
    if (!words) return 'failed'

    const settings = { ...DEFAULT_SPEAK, ...options }
    const priority = settings.priority

    if (priority === 'drop' && this.isSpeaking) return 'dropped'

    if (priority === 'queue') {
      const previous = this.chain
      const run = previous
        .catch(() => undefined)
        .then(() => this.perform(words, settings, this.generation))
      this.chain = run
      return run
    }

    // `interrupt`: everything currently speaking is finished with.
    this.generation += 1
    this.player.stop('interrupted')
    this.fallbackVoice.stop()
    const generation = this.generation
    const run = this.perform(words, settings, generation)
    this.chain = run
    return run
  }

  /**
   * Prepare something the app knows it will say.
   *
   * The most valuable call in the whole module: the app nearly always knows
   * the next line before it needs it, and a preloaded line starts in the time
   * it takes to schedule a buffer rather than in the time it takes to reach a
   * model.
   */
  async preload(text: string, options: SpeakSettings = {}): Promise<void> {
    const words = text?.trim()
    if (!words) return
    const settings = { ...DEFAULT_SPEAK, ...options }
    if (settings.prefer === 'device' || this.engineResting()) return
    await this.whenReady()
    await this.client.preload(words, this.resolveOptions(settings))
  }

  /**
   * Turn the line that is currently speaking up or down.
   *
   * Only the studio voice can do this — it plays through a gain node this app
   * owns. A device utterance's volume is fixed the moment `speak()` is called
   * and no browser exposes a way to change it, so there the level still lands
   * on the next line. Saying so out loud in the interface is better than
   * pretending both are instant.
   */
  setLiveVolume(value: number): void {
    this.player.setVolume(value)
  }

  /**
   * Change the speed of the line that is speaking *now*, and report whether
   * that worked.
   *
   * The studio voice can do this because a clip is a buffer this app owns, and
   * resampling a buffer is free. The device voice cannot: an utterance's rate
   * is fixed the moment the platform is handed it. The boolean is the whole
   * point of the method — the loop uses it to decide between "the fader was
   * enough" and "this line has to be said again", and the second of those is
   * the expensive one, so it is worth knowing which is which.
   *
   * What the listener hears is the new *tempo*, exactly, from the next tenth
   * of a second. The pitch rides along with it for the remainder of that one
   * line, because a clip cannot be re-rendered mid-word; the next line is
   * rendered at the new speed properly and both are right from then on. That
   * trade replaces what this used to do, which was stop speaking and hold the
   * silence until a re-synthesis arrived.
   */
  setLiveRate(rate: number): boolean {
    if (!this.player.isSpeaking || this.liveSynthesisSpeed <= 0) return false
    this.player.setPlaybackRate(bridgeRate(rate, this.liveSynthesisSpeed))
    return true
  }

  /** Stop speaking now. Does not cancel work that is nearly finished. */
  stop(): void {
    this.generation += 1
    this.liveSynthesisSpeed = 0
    this.player.stop('interrupted')
    this.fallbackVoice.stop()
    this.publish({ loading: false })
  }

  /**
   * Stop, and abandon everything in flight.
   *
   * Separate from `stop` because they answer different questions. Stopping is
   * "be quiet now", and the fetch that is two thirds finished should still be
   * allowed to land in the cache, because the next round will want it.
   * Cancelling is "this app is going away".
   */
  cancelAll(): void {
    this.stop()
    this.client.cancelAll()
  }

  dispose(): void {
    this.cancelAll()
    this.player.dispose()
    this.listeners.clear()
  }

  /**
   * Stop speaking, drop every cache, and let go of the model and the database.
   *
   * Only for the Delete everything button. The worker is torn down as well as
   * the caches, because it holds the model's own storage open — and because a
   * thread that carries on synthesising into a database somebody has just asked
   * to have removed is the kind of thing that leaves half of it behind.
   */
  releaseStorage(): void {
    this.stop()
    this.client.releaseStorage()
    browserKokoro.forget()
  }

  get isSpeaking(): boolean {
    return this.player.isSpeaking || this.fallbackVoice.isSpeaking
  }

  /* ── internals ── */

  private context(): AudioContext | null {
    return this.bus?.context ?? null
  }

  private buildRemote(): TTSEngine | null {
    if (!this.config.endpoint) return null
    return new KokoroEngine({
      endpoint: this.config.endpoint,
      synthesisTimeoutMs: this.config.synthesisTimeoutMs,
      lookupTimeoutMs: this.config.lookupTimeoutMs,
    })
  }

  /**
   * Ask the backend what it is, once.
   *
   * Cache keys contain the model version, so a page that guesses it and a
   * server that knows it would name the same clip two different things — the
   * cache would be perfectly consistent and would never hit. Waiting for the
   * answer costs one round trip on the first line of a session and nothing
   * afterwards; a backend that is not there answers instantly with `false`.
   */
  private warmUp(): Promise<void> {
    if (!this.remote) {
      /*
       * No service, but possibly a shelf full of speech.
       *
       * A static deployment ships whatever `npm run speech` generated, and
       * those clips are the studio voice by every measure that matters. So the
       * manifest is read at unlock and the answer to "which voice is this app
       * speaking in?" is settled before anybody opens the Voice panel, rather
       * than flipping from device to studio the moment a clip happens to be
       * found.
       */
      if (!this.ready) {
        this.ready = this.manifest.load().then(() => {
          if (this.manifest.hasClips) this.publish({ engine: 'studio' })
        })
      }
      return this.ready
    }
    const remote = this.remote
    if (!this.ready) {
      this.ready = remote
        .probe()
        .then((ok) => {
          // A model on this device already answered the question, and the
          // service being unreachable does not un-answer it.
          if (this.status.unlimited) return
          this.publish({
            engine: ok ? 'studio' : 'device',
            degraded: !ok,
          })
        })
        .catch(() => {
          if (this.status.unlimited) return
          this.publish({ engine: 'device', degraded: true })
        })
    }
    return this.ready
  }

  /**
   * Wait for the warm-up, but never for longer than a line can afford.
   *
   * The promise itself is not cancelled — it settles in its own time and the
   * status it publishes still lands. This only stops a caller queueing behind
   * it. See `WARM_UP_BUDGET_MS`.
   */
  private whenReady(): Promise<void> {
    const ready = this.warmUp()
    return Promise.race([ready, sleep(WARM_UP_BUDGET_MS)])
  }

  /**
   * What the studio path should ask the caches and the engine for.
   *
   * The speed here is not the speed somebody chose: it is the speed the clip
   * has to be *rendered* at for the requested pitch to come out of a resampled
   * playback at the requested tempo. At pitch 1 the two are the same number.
   * See `shape.ts`.
   */
  private resolveOptions(settings: SpeakSettings & typeof DEFAULT_SPEAK): ResolveOptions {
    return {
      voice: settings.voice as LogicalVoice,
      speed: voiceShape(settings.speed, settings.pitch).synthesisSpeed,
      language: settings.language ?? this.config.language,
      cache: settings.cache,
      signal: settings.signal,
    }
  }

  /** One line, from wherever it can be had. */
  private async perform(
    text: string,
    settings: SpeakSettings & typeof DEFAULT_SPEAK,
    generation: number,
  ): Promise<SpeakOutcome> {
    if (generation !== this.generation) return 'interrupted'
    if (settings.signal?.aborted) return 'interrupted'

    /*
     * A build with no engine is not a build with no studio voice.
     *
     * Everything `npm run speech` generated ships as static files, and the
     * client can resolve those out of memory, IndexedDB or the manifest
     * without any service existing — which is exactly what the GitHub Pages
     * deployment is. Skipping the studio path because there is no engine would
     * throw all of that away and read pre-generated clips in a device voice.
     *
     * So the only reasons to go straight to the device are a deliberate
     * preference and a studio voice that has just failed. Everything else
     * tries, and a miss costs a few local lookups before falling through.
     */
    const wantsDevice = settings.prefer === 'device' || this.engineResting()

    if (!wantsDevice) {
      const outcome = await this.speakStudio(text, settings, generation)
      if (outcome !== 'failed') return outcome
      if (!settings.allowFallback) {
        settings.onEnd?.('failed')
        return 'failed'
      }
      this.publish({ engine: 'device', degraded: true })
    }

    return this.speakDevice(text, settings, generation)
  }

  /** True while a recent failure is still standing in for a health check. */
  private engineResting(): boolean {
    return (
      this.engineFailedAt > 0 && Date.now() - this.engineFailedAt < ENGINE_RETRY_MS
    )
  }

  private async speakStudio(
    text: string,
    settings: SpeakSettings & typeof DEFAULT_SPEAK,
    generation: number,
  ): Promise<SpeakOutcome> {
    if (!this.context()) return 'failed'

    const shape = voiceShape(settings.speed, settings.pitch)

    this.publish({ loading: true })
    try {
      await this.whenReady()
      const clip = await this.client.resolve(text, this.resolveOptions(settings))
      if (generation !== this.generation || settings.signal?.aborted) {
        this.publish({ loading: false })
        return 'interrupted'
      }

      // Remembered so that a slider moved halfway through this line can be
      // answered by resampling it rather than by re-rendering it. See
      // `setLiveRate`.
      this.liveSynthesisSpeed = shape.synthesisSpeed
      const handle = this.player.play(clip.buffer, {
        volume: settings.volume,
        playbackRate: shape.playbackRate,
        onStart: settings.onStart,
      })

      const onAbort = () => handle.stop()
      settings.signal?.addEventListener('abort', onAbort, { once: true })

      this.engineFailedAt = 0
      this.publish({
        loading: false,
        engine: 'studio',
        lastSource: clip.source,
        degraded: false,
      })

      const outcome = await handle.done
      settings.signal?.removeEventListener('abort', onAbort)
      settings.onEnd?.(outcome)
      return outcome
    } catch (error) {
      this.publish({ loading: false })
      if (settings.signal?.aborted) return 'interrupted'
      // A missing engine is not a fault worth marking the session degraded
      // over: it is what a build with no backend looks like, every time.
      if (!(error instanceof NoEngineError)) {
        this.engineFailedAt = Date.now()
        this.publish({ degraded: true })
      }
      return 'failed'
    }
  }

  private async speakDevice(
    text: string,
    settings: SpeakSettings & typeof DEFAULT_SPEAK,
    generation: number,
  ): Promise<SpeakOutcome> {
    if (!this.fallbackVoice.supported) {
      settings.onEnd?.('failed')
      return 'failed'
    }

    // Nothing of this app's own is playing, so there is nothing to resample.
    this.liveSynthesisSpeed = 0

    // The device voice cannot take phonemes, so it gets the respellings —
    // which is exactly why the dictionary carries both.
    const spoken = this.normalizer.normalize(text).text || text
    const profile = voiceProfile((settings.voice as LogicalVoice) ?? 'female_1')

    const handle = this.fallbackVoice.speak(spoken, {
      style: profile.fallbackStyle,
      voiceURI: settings.deviceVoiceURI ?? null,
      /*
       * Explicit, always. `settings.language` is the app's own content
       * language; `langForText` falls back to English for Latin-script words
       * and to `null` — meaning "let the engine decide" — for anything in
       * another script. What is never allowed to happen is an utterance going
       * out with no language at all, which is what the platform answers with
       * its own locale, and is why English affirmations were being read in
       * Chinese on Chinese-language phones.
       */
      lang: langForText(spoken) ?? settings.language ?? null,
      rate: settings.speed,
      pitch: settings.pitch,
      volume: settings.volume,
      onStart: () => {
        if (generation === this.generation) settings.onStart?.()
      },
    })

    const onAbort = () => handle.stop()
    settings.signal?.addEventListener('abort', onAbort, { once: true })
    this.publish({ loading: false, engine: 'device', lastSource: 'fallback' })

    const outcome = await handle.done
    settings.signal?.removeEventListener('abort', onAbort)
    settings.onEnd?.(outcome)
    return outcome
  }

  private publish(patch: Partial<TTSStatus>): void {
    const next = { ...this.status, ...patch }
    if (
      next.engine === this.status.engine &&
      next.loading === this.status.loading &&
      next.lastSource === this.status.lastSource &&
      next.degraded === this.status.degraded &&
      next.unlimited === this.status.unlimited &&
      next.synthesises === this.status.synthesises
    ) {
      return
    }
    this.status = next
    this.listeners.forEach((listener) => listener(next))
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * One voice for the whole app.
 *
 * A singleton because the thing it owns is a singleton: there is one pair of
 * speakers, one audio context, and one thing that should be being said at any
 * moment. Two instances would be two of those.
 */
export const tts = new TTS()

export type { LogicalVoice, SpeakOutcome } from './types'
export { STUDIO_PITCH, clampStudioPitch, voiceShape } from './shape'
export { VOICE_PROFILES, voiceProfile, voiceForStyle } from './voices'
export {
  browserKokoro,
  studioVoiceSupported,
  STUDIO_DOWNLOAD_MB,
  type StudioSnapshot,
  type StudioState,
} from './engines/browserKokoro'
