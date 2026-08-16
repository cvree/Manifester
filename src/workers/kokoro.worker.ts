/// <reference lib="webworker" />

/**
 * Kokoro-82M, running beside the page rather than in it.
 *
 * Synthesising a sentence is one to three seconds of dense matrix arithmetic.
 * On the main thread that is one to three seconds during which nothing scrolls,
 * no button responds, and the breathing guide stops breathing — which on the
 * one screen in this app whose entire job is to feel calm would be worse than
 * having no studio voice at all. So the model lives here, the page sends text
 * and receives samples, and the interface never stops being an interface.
 *
 * Three other things follow from the worker boundary and are worth naming:
 *
 *  - **`kokoro-js` and `onnxruntime-web` are only ever imported here**, behind
 *    a dynamic import that runs on `install`. Nobody who never turns the
 *    studio voice on downloads a byte of either.
 *  - **The model is never fetched without being asked.** `resume` brings the
 *    session back only when every file is already in the browser's cache, so a
 *    returning visitor gets their voice back instantly and a new one is never
 *    surprised by a ninety-megabyte download.
 *  - **Samples are transferred, not copied.** A ten-second clip is a megabyte
 *    of floats, and this runs on phones.
 *
 * ── The engine, and where it comes from ─────────────────────────────────────
 *
 * The first thing that happens after `kokoro-js` is imported is that this
 * worker overrules `transformers.js` about where the ONNX Runtime WebAssembly
 * lives. That one line is the difference between Studio Voice working and
 * Studio Voice failing identically on every desktop browser, and the reasoning
 * is written out in `lib/tts/engines/runtime.ts`.
 */

import {
  CDN_WASM_PATH,
  type StudioRuntime,
} from '../lib/tts/engines/runtime'
import type {
  StudioBackend,
  StudioFailure,
  StudioRequest,
  StudioResponse,
} from '../lib/tts/studioTypes'

/** The ONNX export this app speaks with. */
const MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX'

const MODEL_BASE = `https://huggingface.co/${MODEL_ID}/resolve/main`

/**
 * Which weights to fetch.
 *
 * `q8` on both backends, deliberately. The obvious choice for WebGPU is `fp32`
 * — it is what the upstream demo uses and it is unquestionably the better
 * sounding of the two — but it is 326 MB, and this app promised somebody a
 * hundred. Quantised is ~86 MB, is very hard to tell apart on a phone speaker
 * at 24 kHz, and means the WebGPU→WASM fallback below costs nothing: the same
 * files are already on disk, so a device whose GPU path fails re-opens the
 * session on the CPU without downloading anything a second time.
 */
const DTYPE = 'q8'

/** Kokoro's output rate. Fixed by the checkpoint. */
const SAMPLE_RATE = 24_000

/**
 * The voices this app actually uses, by their Kokoro names.
 *
 * Kept in step with `lib/tts/voices.ts` by hand, and the duplication is
 * deliberate: the worker must not import the page's module graph, and the only
 * thing it needs from that table is which two of the twenty-eight voice packs
 * are worth pulling into the cache so that "works offline" is true for Fen as
 * well as for Ivy.
 */
const USED_VOICES = ['af_heart', 'am_fenrir']

/** Where `kokoro-js` looks for a voice pack. Matched exactly, or it re-fetches. */
const VOICE_CACHE = 'kokoro-voices'

type KokoroModule = typeof import('kokoro-js')
type KokoroInstance = InstanceType<KokoroModule['KokoroTTS']>

let tts: KokoroInstance | null = null
let loading: Promise<void> | null = null
let activeBackend: StudioBackend | null = null

/**
 * Ids whose answer nobody wants any more.
 *
 * Inference cannot be interrupted once it has entered the graph, so cancelling
 * is a promise about what happens *afterwards* rather than about stopping the
 * arithmetic. The work finishes, the samples are dropped, and the page is not
 * told — which is the correct behaviour anyway: the alternative is a line
 * arriving after the one that replaced it.
 */
const cancelled = new Set<number>()

/** One synthesis at a time, in the order they were asked for. */
let queue: Promise<unknown> = Promise.resolve()

const post = (message: StudioResponse, transfer?: Transferable[]) => {
  if (transfer) self.postMessage(message, transfer)
  else self.postMessage(message)
}

/* ── Bringing the model up ───────────────────────────────────────────────── */

/**
 * Everything the model needs, as URLs.
 *
 * Used to answer "is this already downloaded?" without downloading it, which
 * is the question `resume` is entirely made of. The list has to match what
 * `from_pretrained` will actually ask for; if it drifts, the worst outcome is
 * a `resume` that reports `not-cached` and an install button that says Install
 * when it could have said Resume — never an unasked-for download.
 */
function requiredUrls(): string[] {
  return [
    `${MODEL_BASE}/onnx/model_quantized.onnx`,
    `${MODEL_BASE}/tokenizer.json`,
    `${MODEL_BASE}/config.json`,
  ]
}

/** True when every model file is already in the browser's cache. */
async function isCached(): Promise<boolean> {
  if (typeof caches === 'undefined') return false
  try {
    const cache = await caches.open('transformers-cache')
    const found = await Promise.all(
      requiredUrls().map((url) => cache.match(url)),
    )
    return found.every(Boolean)
  } catch {
    // A browser that will not open a cache cannot tell us anything useful, and
    // guessing "yes" here would turn a resume into a silent download.
    return false
  }
}

/**
 * Pull both voice packs into the cache `kokoro-js` reads them from.
 *
 * Each is around half a megabyte and is fetched lazily, on the first line
 * spoken in that voice — which means a device that installed the model, went
 * offline, and then switched from Ivy to Fen would find that the voice it was
 * promised works offline does not. Two small fetches at the end of a
 * ninety-megabyte install fixes that permanently.
 *
 * Failures are swallowed on purpose. This runs *after* `ready` has been sent,
 * and a voice pack that could not be pre-fetched is simply a voice pack that
 * will be fetched the ordinary way later. It is not a reason to tell somebody
 * their install did not work, because it did.
 */
async function warmVoices(): Promise<void> {
  if (typeof caches === 'undefined') return
  try {
    const cache = await caches.open(VOICE_CACHE)
    await Promise.all(
      USED_VOICES.map(async (voice) => {
        const url = `${MODEL_BASE}/voices/${voice}.bin`
        if (await cache.match(url)) return
        const response = await fetch(url)
        if (!response.ok) return
        await cache.put(url, response)
      }),
    )
  } catch {
    /* See above: best effort, never a failure the person hears about. */
  }
}

/**
 * Sum the progress of several files into one number.
 *
 * transformers.js reports per file, and a bar that restarts at zero four times
 * looks broken. Totals are only known once a file's first progress event has
 * arrived, so the denominator grows during the first second — which is fine,
 * because the model file is 95% of the bytes and dominates the moment it
 * appears.
 */
class Progress {
  private loaded = new Map<string, number>()
  private total = new Map<string, number>()
  private lastSent = 0

  update(file: string, loaded: number, total: number): void {
    this.loaded.set(file, loaded)
    if (total > 0) this.total.set(file, total)

    // Roughly thirty updates a second is already more than a progress bar can
    // show; a postMessage per 16 KB chunk is thousands.
    const now = Date.now()
    if (now - this.lastSent < 120) return
    this.lastSent = now
    this.send(file)
  }

  send(file: string | null): void {
    const loaded = [...this.loaded.values()].reduce((a, b) => a + b, 0)
    const total = [...this.total.values()].reduce((a, b) => a + b, 0)
    post({ type: 'progress', loaded, total, file })
  }
}

/**
 * What kind of failure this was, from what the runtime said.
 *
 * The order matters: the engine's own loading failures are checked before the
 * generic network words, because "failed to fetch dynamically imported module"
 * contains *both* and only one of the two readings leads to advice that can
 * actually help. See `StudioFailure` for what each one means on screen.
 */
function classify(error: unknown): StudioFailure {
  const message = String((error as Error)?.message ?? error ?? '').toLowerCase()

  if (message.includes('quota') || message.includes('storage')) return 'storage'

  /*
   * The engine, not the model.
   *
   * These are the strings ONNX Runtime produces when its WebAssembly could not
   * be loaded or initialised at all — a blocked CDN, a stripped MIME type, a
   * hardened browser. They used to fall through to `unsupported`, which is how
   * a blocked network request came to be reported to everybody as a memory
   * problem on their device.
   */
  if (
    message.includes('no available backend') ||
    message.includes('backend not found') ||
    message.includes('dynamically imported module') ||
    message.includes('initializewebassembly') ||
    message.includes('ort-wasm') ||
    message.includes('wasm backend')
  ) {
    return 'runtime'
  }

  if (
    message.includes('fetch') ||
    message.includes('network') ||
    message.includes('load model') ||
    message.includes('failed to load') ||
    message.includes('404') ||
    message.includes('offline')
  ) {
    return 'download'
  }

  return 'unsupported'
}

/**
 * Point `transformers.js` at the runtime this build ships with.
 *
 * Called once, immediately after the import that triggers its module-level
 * defaults, and before anything asks for a session. The `bundled` case sets
 * `wasmPaths` to `undefined` rather than to a path, because that is the state
 * ONNX Runtime interprets as "use the copy that was bundled with the code that
 * is calling me" — the asset Vite emitted next to this worker.
 */
async function configureRuntime(runtime: StudioRuntime): Promise<void> {
  const { env } = await import('@huggingface/transformers')
  const wasm = env.backends?.onnx?.wasm as
    | { wasmPaths?: unknown; numThreads?: number; proxy?: boolean }
    | undefined
  if (!wasm) return

  wasm.wasmPaths = runtime === 'cdn' ? CDN_WASM_PATH : undefined

  /*
   * As many threads as the page is actually allowed.
   *
   * Multi-threaded WebAssembly needs `SharedArrayBuffer`, which needs
   * cross-origin isolation, which needs COOP/COEP headers. GitHub Pages does
   * not send them, so the hosted build gets one thread — stated here rather
   * than discovered, because ONNX Runtime's own fallback arrives by way of two
   * console warnings that read like something is broken.
   *
   * The Docker deployment in this repository *can* send those headers, and
   * threads are the difference between a sentence taking six seconds and two.
   * So it is asked rather than assumed.
   */
  const isolated =
    typeof self !== 'undefined' && (self as { crossOriginIsolated?: boolean }).crossOriginIsolated
  wasm.numThreads = isolated
    ? Math.max(1, Math.min(4, Math.ceil((navigator.hardwareConcurrency || 2) / 2)))
    : 1

  // Already the default, and worth pinning: the proxy spawns a second worker
  // inside this one, which is a second thing that can fail to load.
  wasm.proxy = false

  // We are the ones who decide what is fetched, and it is never a local path.
  env.allowLocalModels = false
}

async function bringUp(
  device: StudioBackend,
  runtime: StudioRuntime,
  allowDownload: boolean,
): Promise<void> {
  if (tts && activeBackend === device) {
    post({ type: 'ready', backend: device })
    return
  }
  if (loading) return loading

  loading = (async () => {
    if (!allowDownload && !(await isCached())) {
      post({ type: 'failed', reason: 'not-cached', message: 'Studio Voice is not installed.' })
      return
    }

    const progress = new Progress()

    let KokoroTTS: KokoroModule['KokoroTTS']
    try {
      const module = (await import('kokoro-js')) as KokoroModule
      KokoroTTS = module.KokoroTTS
      await configureRuntime(runtime)
    } catch (error) {
      /*
       * The worker's own code could not be loaded. Nothing below this point is
       * reachable and no retry inside this worker can help, so it is reported
       * as what it is rather than as a device that cannot run the model.
       */
      post({
        type: 'failed',
        reason: 'runtime',
        message: String((error as Error)?.message ?? 'The voice engine could not be loaded.'),
      })
      return
    }

    /*
     * Exactly one device, and the page decides which.
     *
     * This used to loop WebGPU → WASM in here, and that loop could not work.
     * ONNX Runtime initialises its WebAssembly once per thread and refuses
     * ever after — a second attempt in a worker where the first one failed
     * throws `previous call to initializeWebAssembly() failed`, so the CPU
     * fallback was guaranteed to fail whenever it was actually needed. It is
     * the page's job now, and it starts a fresh worker for every attempt.
     * See `browserKokoro.ts`.
     */
    try {
      const instance = await KokoroTTS.from_pretrained(MODEL_ID, {
        dtype: DTYPE,
        device,
        progress_callback: (event: {
          status: string
          file?: string
          loaded?: number
          total?: number
        }) => {
          if (event.status === 'progress' && event.file) {
            progress.update(event.file, event.loaded ?? 0, event.total ?? 0)
          }
        },
      })

      /*
       * Say one word before claiming to be ready.
       *
       * Building the session succeeds on hardware that then throws on the
       * first real inference — an unsupported operator, a shader that will not
       * compile, a GPU adapter that has already been lost. Finding that out
       * here costs a second and lets the CPU attempt happen quietly; finding
       * it out later means somebody taps Play and hears nothing.
       */
      await instance.generate('Ready.', { voice: 'af_heart', speed: 1 })

      tts = instance
      activeBackend = device
      progress.send(null)
      post({ type: 'ready', backend: device })
      // After `ready`, so it never delays somebody hearing their own words.
      void warmVoices()
    } catch (error) {
      tts = null
      activeBackend = null
      post({
        type: 'failed',
        reason: classify(error),
        message: `${device}: ${String((error as Error)?.message ?? error ?? 'Studio Voice could not start.')}`,
      })
    }
  })().finally(() => {
    loading = null
  })

  return loading
}

/* ── Speaking ────────────────────────────────────────────────────────────── */

async function synthesize(
  id: number,
  text: string,
  voice: string,
  speed: number,
): Promise<void> {
  if (cancelled.delete(id)) return
  if (!tts) {
    post({ type: 'error', id, message: 'Studio Voice is not running.' })
    return
  }

  try {
    const audio = await tts.generate(text, { voice: voice as never, speed })
    if (cancelled.delete(id)) return

    /*
     * A copy, because the samples are about to be transferred out of this
     * worker and `RawAudio` may be holding a view onto a larger tensor buffer
     * that the runtime still owns. Detaching that would be a crash on the next
     * inference rather than a wrong answer, which is worse.
     */
    const samples = new Float32Array(audio.audio);
    post({ type: 'audio', id, samples, sampleRate: audio.sampling_rate ?? SAMPLE_RATE }, [
      samples.buffer,
    ])
  } catch (error) {
    if (cancelled.delete(id)) return
    post({ type: 'error', id, message: String((error as Error)?.message ?? error) })
  }
}

self.onmessage = (event: MessageEvent<StudioRequest>) => {
  const message = event.data

  switch (message.type) {
    case 'install':
      void bringUp(message.backend, message.runtime, true)
      break
    case 'resume':
      void bringUp(message.backend, message.runtime, false)
      break
    case 'synthesize': {
      const { id, text, voice, speed } = message
      queue = queue
        .catch(() => undefined)
        .then(() => synthesize(id, text, voice, speed))
      break
    }
    case 'cancel':
      cancelled.add(message.id)
      break
    case 'release':
      tts = null
      activeBackend = null
      cancelled.clear()
      break
  }
}
