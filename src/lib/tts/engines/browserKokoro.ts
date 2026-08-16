/**
 * Studio Voice, running on the device that is listening to it.
 *
 * This is the same Kokoro-82M checkpoint the pre-generated clips were made
 * with, downloaded once and then kept — so after a one-off ~90 MB install the
 * app can speak *anything somebody writes* in Ivy or Fen, with no service
 * anywhere, no account, no cost, and nothing typed ever leaving the phone.
 * That last part is the reason this exists rather than an API key: an
 * affirmation is the most private sentence most people will type this year.
 *
 * The class has two jobs and they are deliberately separable:
 *
 *  - **A lifecycle**, which the interface drives. Not installed → installing,
 *    with progress → ready, or one of several honest ways to fail. Nothing
 *    here downloads anything until `install()` is called by a person pressing
 *    a button; `resume()` only ever re-opens files that are already on disk.
 *  - **A `TTSEngine`**, which the resolver drives and which knows nothing
 *    about any of that. It answers `probe()` with whether the model is up and
 *    `synthesize()` with audio, exactly like the HTTP engine next to it.
 *
 * Everything expensive happens in `workers/kokoro.worker.ts`. This file is the
 * page's half of that conversation, and it is careful about four things: the
 * worker is not created until somebody asks for it, a synthesis nobody is
 * waiting for is cancelled rather than left to arrive late, an install that
 * has stopped moving is reported rather than waited on for ever, and a failure
 * is always a state the interface can render rather than a rejected promise
 * somebody has to catch.
 *
 * ── Several attempts, each in its own thread ────────────────────────────────
 *
 * Bringing the model up is tried against the GPU and then the CPU, against the
 * bundled engine and then — only if nothing else worked — a CDN copy. Every
 * one of those attempts gets a **new worker**, and that is not tidiness: ONNX
 * Runtime initialises its WebAssembly exactly once per thread and refuses ever
 * after, so a fallback attempted in a worker where the first one failed throws
 * an error about the first one. Sharing a worker meant the CPU fallback was
 * guaranteed to fail precisely when it was needed, which is how a GPU that
 * could not run this graph turned into "this device could not start the voice
 * engine" with no way out. `runtime.ts` has the order and the reasoning.
 *
 * Nothing is re-downloaded between attempts. The weights are in the browser's
 * cache after the first one, so the second and third cost seconds.
 */

import { readLocal, removeLocal, writeLocal } from '../../storage'
import type {
  StudioBackend,
  StudioFailure,
  StudioRequest,
  StudioResponse,
  StudioStage,
} from '../studioTypes'
import type {
  AudioFormat,
  EngineDescriptor,
  EngineRequest,
  EngineResult,
  TTSEngine,
} from '../types'
import { engineVoiceFor } from '../voices'
import { encodeWav } from '../wav'
import { KOKORO_MODEL_VERSION } from './kokoroModel'
import {
  attemptsFor,
  worthRetryingElsewhere,
  type Attempt,
  type StudioRuntime,
} from './runtime'

/** Where "this device has the model" is remembered between visits. */
const INSTALLED_KEY = 'tts.studioVoice'

/** Which copy of the engine actually worked here last time. */
const RUNTIME_KEY = 'tts.studioRuntime'

/**
 * What the download actually costs, for the sentence on the install card.
 *
 * Stated rather than measured because it has to be on screen *before* anything
 * is fetched — the whole point of the card is that nobody finds out the size
 * afterwards. Quantised weights plus tokeniser plus one voice pack.
 */
export const STUDIO_DOWNLOAD_MB = 90

/**
 * How long each part of a bring-up may go quiet before it is called.
 *
 * Not a total timeout: ninety megabytes on a bad train connection is minutes,
 * and cutting that off would be the app giving up on somebody who was doing
 * fine. This is a *stall* timer, reset by every message from the worker, and
 * it exists for the one failure mode that has no error attached to it — a
 * runtime that never resolves, which without this leaves "Preparing Studio
 * Voice…" on screen until the tab is closed.
 *
 * ── Why one number was not enough ───────────────────────────────────────────
 *
 * It used to be a single forty-five seconds covering everything, and that
 * quietly broke the install on exactly the devices it was meant to protect.
 * Downloading reports itself continuously, so forty-five seconds of silence
 * there really does mean a dead connection. What comes *after* the last byte
 * reports nothing at all: the runtime builds an 86 MB graph, then speaks one
 * word to prove it can, and on a phone with a single WebAssembly thread that
 * is comfortably more than forty-five seconds of legitimate quiet. The
 * watchdog fired at the moment the install was about to succeed, called it a
 * stalled download, and — because `timeout` was not worth retrying elsewhere —
 * ended the whole sequence. A slow device could not install this at all.
 *
 * So each stage gets the budget its own silence deserves, and every one of
 * them is still bounded, because the alternative is a spinner with no end.
 */
const STALL_MS: Record<StudioStage, number> = {
  /* Worker boot and the engine chunk. Local, and quick, or it is not coming. */
  starting: 60_000,
  /* Between byte batches. Generous for a train, hopeless for a dead socket. */
  downloading: 90_000,
  /* Session build. Silent by nature, and the longest of them on a phone. */
  preparing: 300_000,
  /* espeak, kernel compilation and a whole vocoder pass, once. */
  warming: 240_000,
}

export type StudioState =
  /** No worker, no WebAssembly, or a browser that cannot run this. */
  | 'unsupported'
  /** Could be installed, and has not been. */
  | 'available'
  /** Downloading or warming up. `progress` is meaningful. */
  | 'installing'
  /** Installed and speaking. */
  | 'ready'
  /** Tried and could not. `failure` says which way. */
  | 'failed'

export interface StudioSnapshot {
  state: StudioState
  /** Which backend came up, once one has. */
  backend: StudioBackend | null
  /** Bytes so far and bytes expected, while installing. */
  loaded: number
  total: number
  /**
   * Which part of the install is happening, while one is.
   *
   * On screen, because the minute after the bar reaches 100% is silent and
   * looks broken. "Preparing Studio Voice…" over a full bar is the app not
   * saying what it is doing; "Setting it up on this device" is.
   */
  stage: StudioStage
  failure: StudioFailure | null
  message: string | null
  /**
   * True when this device will actually run the model on its GPU.
   *
   * Starts as what the browser *advertises* and is replaced, as soon as the
   * driver has been asked, by what it will really hand over — which is often
   * not the same thing. The install card says this out loud, so it is worth
   * the correction. See `webGpuUsable`.
   */
  accelerated: boolean
  /** Which copy of the engine the current or last attempt used. */
  runtime: StudioRuntime | null
  /**
   * What every attempt said, in order.
   *
   * The single most useful thing when somebody reports that this will not
   * install. Without it a bug report is "it does not work"; with it, it is
   * three lines naming the runtime, the processor and the exact error, which
   * is usually enough to know the answer without owning the device.
   */
  trail: string[]
  /**
   * True while a second attempt against the other runtime is under way.
   *
   * The interface uses it to keep saying "preparing" rather than flashing a
   * failure that the app is in the middle of recovering from by itself.
   */
  retrying: boolean
}

/** A synthesis the page is still waiting on. */
interface Pending {
  resolve: (result: { samples: Float32Array; sampleRate: number }) => void
  reject: (error: Error) => void
}

/**
 * Does this browser stand a chance?
 *
 * Deliberately generous. The only things checked are the ones whose absence
 * makes the attempt pointless — no worker, no WebAssembly, no cache to keep
 * the model in. Everything else, including whether a phone has the memory to
 * hold an 86 MB graph, is discovered by trying, because the alternative is a
 * hard-coded list of devices that is wrong the week after it is written.
 */
export function studioVoiceSupported(): boolean {
  if (typeof window === 'undefined') return false
  return (
    typeof Worker !== 'undefined' &&
    typeof WebAssembly !== 'undefined' &&
    typeof caches !== 'undefined'
  )
}

/** True when WebGPU is advertised. Not a promise that it works — see below. */
export function webGpuAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator
}

/** Just enough of `navigator.gpu` to ask it the one question that matters. */
type GpuHost = Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }

/**
 * Just enough of `Worker` for this class to talk to one.
 *
 * Narrowed to what is used so a test can supply an object rather than a
 * thread. The lifecycle below — install, progress, ready, cancel, and the
 * several kinds of failure — is the part of this feature most likely to strand
 * somebody on "Preparing your voice…" for ever, and it is not testable at all
 * if the only way to reach it is to download 86 MB of weights.
 */
export interface StudioWorker {
  postMessage(message: StudioRequest): void
  terminate(): void
  onmessage: ((event: MessageEvent<StudioResponse>) => void) | null
  onerror: ((event: unknown) => void) | null
  onmessageerror: ((event: unknown) => void) | null
}

export class BrowserKokoroEngine implements TTSEngine {
  private worker: StudioWorker | null = null
  private createWorker: () => StudioWorker
  private nextId = 1
  private pending = new Map<number, Pending>()
  private listeners = new Set<(snapshot: StudioSnapshot) => void>()

  private snapshot: StudioSnapshot = {
    state: studioVoiceSupported() ? 'available' : 'unsupported',
    backend: null,
    loaded: 0,
    total: 0,
    stage: 'starting',
    failure: null,
    message: null,
    accelerated: webGpuAvailable(),
    runtime: null,
    retrying: false,
    trail: [],
  }

  /** The whole sequence of attempts, so two presses of Install share one. */
  private running: Promise<boolean> | null = null

  /** What the sequence in flight is: a deliberate download, or a cache check. */
  private mode: 'install' | 'resume' = 'install'

  /** Resolves when the *current attempt* settles, either way. */
  private attempt: { resolve: (ok: boolean) => void } | null = null

  /** Reset by every message from the worker. See `STALL_MS`. */
  private stall: ReturnType<typeof setTimeout> | null = null

  /** Set while tearing a worker down deliberately, so `crash` stays quiet. */
  private abandoning = false

  /**
   * Set when a running sequence has been overtaken and should simply stop.
   *
   * Distinct from cancelling, which is a person changing their mind and has a
   * state on screen. This is the app getting out of its own way — a background
   * resume being pushed aside by somebody pressing Install.
   */
  private superseded = false

  /** Resolves the `reset` in flight, when the worker says the caches are gone. */
  private purged: (() => void) | null = null

  /** What the GPU driver said when it was asked. See `webGpuUsable`. */
  private adapter: Promise<boolean> | null = null

  constructor(createWorker: () => StudioWorker = defaultWorker) {
    this.createWorker = createWorker
  }

  get descriptor(): EngineDescriptor {
    return {
      id: 'kokoro-browser',
      /*
       * The same version the pre-generated clips are keyed under, on purpose.
       *
       * The quantised weights running here are not bit-identical to the fp32
       * export that made the shipped files, and a purist would give them their
       * own version. That would be a mistake: it would mean a device with the
       * model installed never finds any of the hundred-odd affirmations that
       * shipped with the app, and re-synthesises every one of them locally.
       * They are the same voice saying the same words — one is simply a
       * slightly cheaper recording of it — so they share an address.
       */
      modelVersion: KOKORO_MODEL_VERSION,
      // espeak-ng's IPA, not Misaki's inline markup. See `pronunciation/`.
      supportsPhonemes: false,
      formats: ['wav'],
    }
  }

  /* ── Lifecycle ────────────────────────────────────────────────── */

  getSnapshot(): StudioSnapshot {
    return this.snapshot
  }

  subscribe(listener: (snapshot: StudioSnapshot) => void): () => void {
    this.listeners.add(listener)
    listener(this.snapshot)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /**
   * Whether this browser will actually hand over a GPU.
   *
   * `'gpu' in navigator` says the *API* exists, which is a far weaker claim
   * than anybody reading it assumes, and the gap between the two was expensive.
   * Chrome on a machine with no usable adapter — a virtual machine, a Linux box
   * whose driver is not on the allow list, a browser started without the flag —
   * still defines `navigator.gpu`, and tells the truth only when
   * `requestAdapter()` resolves to `null`. Studio Voice used to find that out
   * the long way round: it planned a WebGPU attempt, downloaded ninety
   * megabytes, built the graph, and got as far as speaking its first word
   * before ONNX Runtime said
   *
   *     no available backend found … Failed to get GPU adapter.
   *
   * and the entire attempt was discarded over something one call knows in
   * milliseconds.
   *
   * So it is asked before anything is planned, and asked once — an engine
   * outlives every install it runs, and the answer cannot change under it. A
   * `null` adapter is not a failure anybody hears about; it is a device that
   * installs on the CPU quietly, and is never told about a road it was never
   * on.
   *
   * Asked *there* and not on the way in, though. `requestAdapter()` wakes a GPU
   * process, and the whole promise of this feature is that a visitor who never
   * turns it on is never charged for it — which includes not touching their
   * graphics card to find out something only an install needs to know.
   */
  private webGpuUsable(): Promise<boolean> {
    this.adapter ??= (async () => {
      if (!webGpuAvailable()) return false
      try {
        return Boolean(await (navigator as GpuHost).gpu?.requestAdapter())
      } catch {
        // A browser that throws rather than answering has answered.
        return false
      }
    })()
    return this.adapter
  }

  /** True when this device has installed the model before. */
  get everInstalled(): boolean {
    return readLocal(INSTALLED_KEY) === 'installed'
  }

  /**
   * Bring the model back if it is already downloaded, and do nothing at all
   * otherwise.
   *
   * Called on load when the flag says this device has installed it. Silent by
   * design: a browser that has evicted the cache under storage pressure is not
   * a problem to report, it is a device that has quietly gone back to being a
   * device that has not installed Studio Voice.
   */
  async resume(): Promise<boolean> {
    if (this.snapshot.state === 'unsupported') return false
    if (this.snapshot.state === 'ready') return true
    if (!this.everInstalled) return false
    return this.sequence('resume')
  }

  /** Download and start the model. Only ever from a deliberate press. */
  async install(): Promise<boolean> {
    if (this.snapshot.state === 'unsupported') return false
    if (this.snapshot.state === 'ready') return true

    /*
     * A press must never be answered by a resume that was already running.
     *
     * `sequence` joins whatever is in flight, which is right for two presses of
     * Install and was wrong in one specific and very confusing way: on a device
     * whose `installed` flag survived a cache eviction, the app starts a resume
     * on load, that resume can only ever answer "not cached", and anybody who
     * pressed Install during those few seconds was handed *its* answer. The
     * button did nothing, twice, and then worked — which reads as an app that
     * ignores you rather than as a race.
     *
     * So the resume is put aside and the real thing starts behind it. Nothing
     * is lost: a resume downloads nothing and discovers nothing an install does
     * not discover for itself.
     */
    if (this.running && this.mode === 'resume') {
      this.supersede()
      await this.running.catch(() => false)
    }
    return this.sequence('install')
  }

  /**
   * Throw away every stored byte and start over.
   *
   * The last resort, and until now it did not exist. Everything this feature
   * downloads lives in caches keyed by Hugging Face URLs inside the worker's
   * half of the origin, so a device that had cached something unusable had no
   * way back: clearing site data would take the person's saved loops with it,
   * and nothing smaller was on offer. The damaged-file case now clears itself,
   * but a person staring at a failure nobody predicted deserves a button that
   * means *forget all of it and try properly*.
   */
  async reset(): Promise<void> {
    if (this.snapshot.state === 'unsupported') return
    this.supersede()
    await this.running?.catch(() => false)

    await new Promise<void>((resolve) => {
      const done = () => {
        this.abandoning = true
        this.teardown()
        this.abandoning = false
        resolve()
      }
      try {
        this.abandoning = true
        this.teardown()
        this.abandoning = false
        this.ensureWorker()
        this.purged = done
        this.post({ type: 'purge' })
        // A purge that never answers must not hold the button for ever; the
        // caches are the worker's to clear and it has either done it or died.
        setTimeout(() => {
          if (this.purged) {
            this.purged = null
            done()
          }
        }, 10_000)
      } catch {
        done()
      }
    })

    this.forget()
  }

  /**
   * Stop waiting for an install.
   *
   * Honest about what it can and cannot do: the fetches already in flight
   * belong to `transformers.js` inside the worker and cannot be aborted from
   * here, so this tears the worker down, which ends them. Whatever had already
   * been written to the browser cache stays there, so pressing Install again
   * later resumes rather than starting from zero — which is the behaviour
   * somebody on a train tunnel actually wants.
   */
  cancelInstall(): void {
    if (this.snapshot.state !== 'installing') return
    this.abandoning = true
    this.teardown()
    this.abandoning = false
    this.publish({
      state: 'available',
      failure: 'cancelled',
      message: null,
      loaded: 0,
      total: 0,
      retrying: false,
    })
    // After the publish, so the attempt that unwinds cannot overwrite it.
    this.finishAttempt(false)
  }

  /** Forget the model, so the next visit does not try to bring it back. */
  forget(): void {
    this.teardown()
    removeLocal(INSTALLED_KEY)
    removeLocal(RUNTIME_KEY)
    this.publish({
      state: studioVoiceSupported() ? 'available' : 'unsupported',
      backend: null,
      failure: null,
      message: null,
      loaded: 0,
      total: 0,
      runtime: null,
      retrying: false,
    })
  }

  /**
   * The attempts, best first, with whatever worked here last time promoted.
   *
   * A device that had to fall back once should not pay for the discovery on
   * every visit — and on a machine where the CDN is what gets blocked, the
   * remembered answer is the bundled runtime, which is also the one this app
   * would rather use.
   */
  private async plan(): Promise<Attempt[]> {
    /*
     * The first question a bring-up has to answer, and the only place it is
     * asked: whether the GPU this browser advertises is one it will really
     * hand over. The snapshot is corrected with the answer, because the card
     * says it out loud.
     */
    const accelerated = await this.webGpuUsable()
    if (accelerated !== this.snapshot.accelerated) this.publish({ accelerated })

    const all = attemptsFor(accelerated)
    const remembered = readLocal(RUNTIME_KEY)
    if (!remembered) return all

    const [runtime, device] = remembered.split('/')
    const first = all.findIndex(
      (attempt) => attempt.runtime === runtime && attempt.device === device,
    )
    if (first <= 0) return all
    return [all[first], ...all.filter((_, index) => index !== first)]
  }

  /**
   * The whole install: one attempt per entry in the plan, each in a worker of
   * its own, stopping at the first success and at the first failure not worth
   * carrying to the next.
   */
  private sequence(kind: 'install' | 'resume'): Promise<boolean> {
    if (this.running) return this.running

    this.mode = kind
    this.superseded = false

    this.running = (async () => {
      const plan = await this.plan()
      this.publish({ trail: [] })

      for (let index = 0; index < plan.length; index += 1) {
        const attempt = plan[index]
        const more = index < plan.length - 1

        this.publish({
          state: 'installing',
          failure: null,
          message: null,
          loaded: 0,
          total: 0,
          stage: 'starting',
          runtime: attempt.runtime,
          retrying: index > 0,
        })

        const ok = await this.runAttempt(kind, attempt)

        // Overtaken by a deliberate press. Leave the state to whoever did it.
        if (this.superseded) return false

        this.publish({
          trail: [
            ...this.snapshot.trail,
            `${attempt.runtime}/${attempt.device}: ${
              ok ? 'ready' : (this.snapshot.message ?? this.snapshot.failure ?? 'failed')
            }`,
          ],
        })

        if (ok) {
          writeLocal(RUNTIME_KEY, `${attempt.runtime}/${attempt.device}`)
          return true
        }

        /*
         * `cancelled` is somebody changing their mind and `not-cached` is the
         * ordinary answer to a resume. Neither is a reason to go and try
         * another engine, and doing so would turn a Cancel press into a second
         * download.
         */
        if (!more || !worthRetryingElsewhere(this.snapshot.failure)) return false
      }

      return false
    })().finally(() => {
      this.running = null
      if (this.snapshot.retrying) this.publish({ retrying: false })
    })

    return this.running
  }

  /** One worker, one runtime, one processor, one answer. */
  private runAttempt(kind: 'install' | 'resume', attempt: Attempt): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this.attempt = { resolve }

      /*
       * A fresh worker for every attempt, and not as a precaution: ONNX
       * Runtime refuses a second `initializeWebAssembly` in a thread where the
       * first one failed, so re-using the worker would make the fallback fail
       * with an error about the failure it was sent to recover from.
       */
      this.abandoning = true
      this.teardown()
      this.abandoning = false

      this.armStall('starting')

      try {
        this.ensureWorker()
        this.post({ type: kind, backend: attempt.device, runtime: attempt.runtime })
      } catch (error) {
        this.publish({
          state: 'failed',
          failure: 'runtime',
          message: String((error as Error)?.message ?? error),
        })
        this.finishAttempt(false)
      }
    })
  }

  /**
   * Start the watchdog for the stage the worker says it is in.
   *
   * The stage is recorded on the snapshot as well as used for the budget,
   * because it is the same fact the screen needs: silence that is expected
   * should be described, not merely tolerated.
   */
  private armStall(stage: StudioStage): void {
    this.clearStall()
    this.publish({ stage })
    this.stall = setTimeout(() => {
      if (this.snapshot.state !== 'installing') return
      this.abandoning = true
      this.teardown()
      this.abandoning = false
      this.publish({
        state: 'failed',
        failure: 'timeout',
        message: `Nothing happened for ${Math.round(STALL_MS[stage] / 1000)}s while ${stage}.`,
      })
      this.finishAttempt(false)
    }, STALL_MS[stage])
  }

  private clearStall(): void {
    if (this.stall != null) clearTimeout(this.stall)
    this.stall = null
  }

  /** Stop whatever sequence is running, without putting a failure on screen. */
  private supersede(): void {
    if (!this.running) return
    this.superseded = true
    this.abandoning = true
    this.teardown()
    this.abandoning = false
    this.finishAttempt(false)
  }

  /** Settle the attempt in flight, once, whatever happened to it. */
  private finishAttempt(ok: boolean): void {
    this.clearStall()
    const attempt = this.attempt
    this.attempt = null
    attempt?.resolve(ok)
  }

  /* ── The engine ───────────────────────────────────────────────── */

  /** Nothing of its own to look in; the caches above it have already looked. */
  async lookup(): Promise<EngineResult | null> {
    return null
  }

  async probe(): Promise<boolean> {
    return this.snapshot.state === 'ready'
  }

  async synthesize(
    request: EngineRequest,
    signal?: AbortSignal,
  ): Promise<EngineResult> {
    if (this.snapshot.state !== 'ready' || !this.worker) {
      throw new Error('Studio Voice is not running on this device.')
    }
    if (signal?.aborted) throw new Error('aborted')

    const id = this.nextId
    this.nextId += 1

    const audio = await new Promise<{ samples: Float32Array; sampleRate: number }>(
      (resolve, reject) => {
        this.pending.set(id, { resolve, reject })

        const onAbort = () => {
          this.pending.delete(id)
          this.post({ type: 'cancel', id })
          reject(new Error('aborted'))
        }
        signal?.addEventListener('abort', onAbort, { once: true })

        const settled = () => signal?.removeEventListener('abort', onAbort)
        const original = this.pending.get(id)!
        this.pending.set(id, {
          resolve: (value) => {
            settled()
            original.resolve(value)
          },
          reject: (error) => {
            settled()
            original.reject(error)
          },
        })

        this.post({
          type: 'synthesize',
          id,
          text: request.text,
          voice: engineVoiceFor(request.voice),
          speed: request.speed,
        })
      },
    )

    return {
      bytes: encodeWav(audio.samples, audio.sampleRate),
      format: 'wav' as AudioFormat,
      source: 'engine',
    }
  }

  /* ── The worker ───────────────────────────────────────────────── */

  private post(message: StudioRequest): void {
    this.worker?.postMessage(message)
  }

  private ensureWorker(): void {
    if (this.worker) return
    this.worker = this.createWorker()
    this.worker.onmessage = (event: MessageEvent<StudioResponse>) =>
      this.receive(event.data)
    /*
     * A worker that dies takes every promise waiting on it with it. Without
     * this the app would sit at "Preparing your voice…" for ever — the one
     * failure mode that looks like the app is broken rather than like a
     * feature that is unavailable.
     */
    this.worker.onerror = () =>
      this.crash('The voice engine could not be started in this browser.')
    this.worker.onmessageerror = () =>
      this.crash('The voice engine stopped unexpectedly.')
  }

  private teardown(): void {
    this.worker?.terminate()
    this.worker = null
    for (const pending of this.pending.values()) {
      pending.reject(new Error('Studio Voice stopped.'))
    }
    this.pending.clear()
  }

  private crash(message: string): void {
    // A worker we terminated on purpose is not a crash to report.
    if (this.abandoning) return
    const wasInstalling = this.snapshot.state === 'installing'
    this.teardown()
    this.publish({
      state: wasInstalling ? 'failed' : 'available',
      backend: null,
      /*
       * A worker that fails to start is the engine failing to load, not the
       * device failing to run it — the distinction that decides whether the
       * sentence on screen is advice somebody can act on or advice that cannot
       * possibly work.
       */
      failure: 'runtime',
      message,
    })
    this.finishAttempt(false)
  }

  private receive(message: StudioResponse): void {
    switch (message.type) {
      case 'progress':
        /*
         * Bytes are arriving, so the stall clock starts again — and on the
         * download budget, whatever the worker last said. That is what makes a
         * premature "preparing" harmless: the config file can finish before the
         * weights are even asked for, and the very next chunk of the weights
         * puts the watchdog back where it belongs by itself.
         */
        if (this.snapshot.state === 'installing') this.armStall('downloading')
        this.publish({ loaded: message.loaded, total: message.total })
        break

      case 'stage':
        if (this.snapshot.state === 'installing') this.armStall(message.stage)
        break

      case 'purged':
        this.purged?.()
        this.purged = null
        break

      case 'ready':
        writeLocal(INSTALLED_KEY, 'installed')
        this.publish({
          state: 'ready',
          backend: message.backend,
          failure: null,
          message: null,
          retrying: false,
        })
        this.finishAttempt(true)
        break

      case 'failed': {
        /*
         * `not-cached` is not a failure. It is the answer to "is this already
         * downloaded?", asked by a resume that was triggered by a stale flag —
         * a browser evicting the cache is ordinary. Clearing the flag is what
         * stops it being asked again on every load, and leaves the interface
         * offering a clean Install rather than an error nobody caused.
         */
        if (message.reason === 'not-cached') {
          removeLocal(INSTALLED_KEY)
          this.abandoning = true
          this.teardown()
          this.abandoning = false
          this.publish({
            state: 'available',
            backend: null,
            failure: null,
            message: null,
            loaded: 0,
            total: 0,
            retrying: false,
          })
          this.finishAttempt(false)
          return
        }
        /*
         * The damaged copy has just been deleted, so this device no longer has
         * Studio Voice by any measure — the flag has to go with it, or the next
         * load will resume a model that is not there.
         *
         * A resume that discovers this says nothing on screen, for the same
         * reason `not-cached` says nothing: nobody asked for anything, and an
         * error about a file they never knew existed is noise. A person who
         * pressed Install is owed the opposite, and gets a sentence that
         * explains why pressing it once more is not the same as pressing it
         * again.
         */
        if (message.reason === 'corrupt') {
          removeLocal(INSTALLED_KEY)
          const asked = this.mode === 'install'
          this.abandoning = true
          this.teardown()
          this.abandoning = false
          this.publish({
            state: asked ? 'failed' : 'available',
            backend: null,
            failure: asked ? 'corrupt' : null,
            message: asked ? message.message : null,
            loaded: 0,
            total: 0,
            retrying: false,
          })
          this.finishAttempt(false)
          return
        }

        this.abandoning = true
        this.teardown()
        this.abandoning = false
        this.publish({
          state: 'failed',
          backend: null,
          failure: message.reason,
          message: message.message,
        })
        this.finishAttempt(false)
        break
      }

      case 'audio': {
        const pending = this.pending.get(message.id)
        this.pending.delete(message.id)
        pending?.resolve({ samples: message.samples, sampleRate: message.sampleRate })
        break
      }

      case 'error': {
        const pending = this.pending.get(message.id)
        this.pending.delete(message.id)
        pending?.reject(new Error(message.message))
        break
      }
    }
  }

  private publish(patch: Partial<StudioSnapshot>): void {
    const next = { ...this.snapshot, ...patch }
    if (
      next.state === this.snapshot.state &&
      next.backend === this.snapshot.backend &&
      next.loaded === this.snapshot.loaded &&
      next.total === this.snapshot.total &&
      next.stage === this.snapshot.stage &&
      next.failure === this.snapshot.failure &&
      next.message === this.snapshot.message &&
      next.runtime === this.snapshot.runtime &&
      next.retrying === this.snapshot.retrying &&
      /*
       * `accelerated` is the other field that can be the only thing that
       * changed: it starts as what the browser advertises and is replaced, on
       * its own, by what the driver actually said. Leaving it out here would
       * have thrown that correction away exactly as the trail was thrown away.
       */
      next.accelerated === this.snapshot.accelerated &&
      /*
       * The trail has to be in this comparison, not just in the object.
       *
       * It was left out once and the effect was silent: an update that changed
       * only the diagnostic trail matched on every other field, took the early
       * return, and was thrown away — so the one thing added specifically to
       * make failures reportable never reached the screen. Any field that can
       * be the *sole* thing that changed belongs here.
       */
      next.trail === this.snapshot.trail
    ) {
      return
    }
    this.snapshot = next
    this.listeners.forEach((listener) => listener(next))
  }
}

/**
 * The real thing.
 *
 * A module worker, created only when somebody has asked for the voice — which
 * is also what keeps `kokoro-js` and ONNX Runtime out of every other visitor's
 * download. See `vite.config.ts`, where the bundle is deliberately left out of
 * the precache for the same reason.
 */
function defaultWorker(): StudioWorker {
  return new Worker(new URL('../../../workers/kokoro.worker.ts', import.meta.url), {
    type: 'module',
    name: 'studio-voice',
  }) as unknown as StudioWorker
}

/** One model per page, like the one pair of speakers it plays through. */
export const browserKokoro = new BrowserKokoroEngine()
