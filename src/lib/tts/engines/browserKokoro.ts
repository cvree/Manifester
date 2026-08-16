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
 *    with progress → ready, or one of five honest ways to fail. Nothing here
 *    downloads anything until `install()` is called by a person pressing a
 *    button; `resume()` only ever re-opens files that are already on disk.
 *  - **A `TTSEngine`**, which the resolver drives and which knows nothing
 *    about any of that. It answers `probe()` with whether the model is up and
 *    `synthesize()` with audio, exactly like the HTTP engine next to it.
 *
 * Everything expensive happens in `workers/kokoro.worker.ts`. This file is the
 * page's half of that conversation, and it is careful about three things: the
 * worker is not created until somebody asks for it, a synthesis nobody is
 * waiting for is cancelled rather than left to arrive late, and a failure is
 * always a state the interface can render rather than a rejected promise
 * somebody has to catch.
 */

import { readLocal, removeLocal, writeLocal } from '../../storage'
import type {
  StudioBackend,
  StudioFailure,
  StudioRequest,
  StudioResponse,
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

/** Where "this device has the model" is remembered between visits. */
const INSTALLED_KEY = 'tts.studioVoice'

/**
 * What the download actually costs, for the sentence on the install card.
 *
 * Stated rather than measured because it has to be on screen *before* anything
 * is fetched — the whole point of the card is that nobody finds out the size
 * afterwards. Quantised weights plus tokeniser plus one voice pack.
 */
export const STUDIO_DOWNLOAD_MB = 90

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
  failure: StudioFailure | null
  message: string | null
  /** True when this browser advertises WebGPU. Shown on the install card. */
  accelerated: boolean
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

/** True when WebGPU is advertised. Not a promise that it works — see the worker. */
export function webGpuAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator
}

/**
 * Just enough of `Worker` for this class to talk to one.
 *
 * Narrowed to what is used so a test can supply an object rather than a
 * thread. The lifecycle below — install, progress, ready, cancel, and five
 * kinds of failure — is the part of this feature most likely to strand
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
    failure: null,
    message: null,
    accelerated: webGpuAvailable(),
  }

  /** Resolves when the current install settles, either way. */
  private settling: {
    promise: Promise<boolean>
    resolve: (ok: boolean) => void
  } | null = null

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
    return this.bringUp('resume')
  }

  /** Download and start the model. Only ever from a deliberate press. */
  async install(): Promise<boolean> {
    if (this.snapshot.state === 'unsupported') return false
    if (this.snapshot.state === 'ready') return true
    return this.bringUp('install')
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
    this.teardown()
    this.settling?.resolve(false)
    this.settling = null
    this.publish({
      state: 'available',
      failure: 'cancelled',
      message: null,
      loaded: 0,
      total: 0,
    })
  }

  /** Forget the model, so the next visit does not try to bring it back. */
  forget(): void {
    this.teardown()
    removeLocal(INSTALLED_KEY)
    this.publish({
      state: studioVoiceSupported() ? 'available' : 'unsupported',
      backend: null,
      failure: null,
      message: null,
      loaded: 0,
      total: 0,
    })
  }

  private bringUp(kind: 'install' | 'resume'): Promise<boolean> {
    if (this.settling) return this.settling.promise

    let resolve!: (ok: boolean) => void
    const promise = new Promise<boolean>((done) => {
      resolve = done
    })
    this.settling = { promise, resolve }

    this.publish({
      state: 'installing',
      failure: null,
      message: null,
      loaded: 0,
      total: 0,
    })

    try {
      this.send({
        type: kind,
        backend: webGpuAvailable() ? 'webgpu' : 'wasm',
      })
    } catch (error) {
      this.settle(false, {
        state: 'failed',
        failure: 'unsupported',
        message: String((error as Error)?.message ?? error),
      })
    }

    return promise
  }

  private settle(ok: boolean, patch: Partial<StudioSnapshot>): void {
    this.publish(patch)
    this.settling?.resolve(ok)
    this.settling = null
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

  private send(message: StudioRequest): void {
    this.ensureWorker()
    this.post(message)
  }

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
    this.worker.onerror = () => this.crash('The Studio Voice engine stopped.')
    this.worker.onmessageerror = () => this.crash('The Studio Voice engine stopped.')
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
    const wasInstalling = this.snapshot.state === 'installing'
    this.teardown()
    this.settle(false, {
      state: wasInstalling ? 'failed' : 'available',
      backend: null,
      failure: 'unsupported',
      message,
    })
  }

  private receive(message: StudioResponse): void {
    switch (message.type) {
      case 'progress':
        this.publish({ loaded: message.loaded, total: message.total })
        break

      case 'ready':
        writeLocal(INSTALLED_KEY, 'installed')
        this.settle(true, {
          state: 'ready',
          backend: message.backend,
          failure: null,
          message: null,
        })
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
          this.teardown()
          this.settle(false, {
            state: 'available',
            backend: null,
            failure: null,
            message: null,
            loaded: 0,
            total: 0,
          })
          return
        }
        this.teardown()
        this.settle(false, {
          state: 'failed',
          backend: null,
          failure: message.reason,
          message: message.message,
        })
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
      next.failure === this.snapshot.failure &&
      next.message === this.snapshot.message
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
