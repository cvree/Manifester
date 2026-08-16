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
 */

import type {
  StudioBackend,
  StudioFailure,
  StudioRequest,
  StudioResponse,
} from '../lib/tts/studioTypes'

/** The ONNX export this app speaks with. */
const MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX'

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
  const base = `https://huggingface.co/${MODEL_ID}/resolve/main`
  return [
    `${base}/onnx/model_quantized.onnx`,
    `${base}/tokenizer.json`,
    `${base}/config.json`,
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

function classify(error: unknown): StudioFailure {
  const message = String((error as Error)?.message ?? error ?? '').toLowerCase()
  if (message.includes('quota') || message.includes('storage')) return 'storage'
  if (
    message.includes('fetch') ||
    message.includes('network') ||
    message.includes('load model') ||
    message.includes('failed to load')
  ) {
    return 'download'
  }
  return 'unsupported'
}

async function bringUp(backend: StudioBackend, allowDownload: boolean): Promise<void> {
  if (tts && activeBackend === backend) {
    post({ type: 'ready', backend })
    return
  }
  if (loading) return loading

  loading = (async () => {
    if (!allowDownload && !(await isCached())) {
      post({ type: 'failed', reason: 'not-cached', message: 'Studio Voice is not installed.' })
      return
    }

    const progress = new Progress()
    const { KokoroTTS } = (await import('kokoro-js')) as KokoroModule

    /*
     * WebGPU first, then the CPU, and the second attempt is not a retry of the
     * download — the weights are in the cache by then, so a device whose GPU
     * path throws pays a couple of seconds rather than another 86 MB. Plenty
     * of real browsers advertise `navigator.gpu` and then fail to build a
     * pipeline for one operator in this graph; that is a runtime fact and the
     * only way to learn it is to try.
     */
    const order: StudioBackend[] = backend === 'webgpu' ? ['webgpu', 'wasm'] : ['wasm']
    let lastError: unknown = null

    for (const device of order) {
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
         * first real inference — an unsupported operator, a shader that will
         * not compile, a GPU adapter that has already been lost. Finding that
         * out here costs a second and lets the WASM fallback happen quietly;
         * finding it out later means somebody taps Play and hears nothing.
         */
        await instance.generate('Ready.', { voice: 'af_heart', speed: 1 })

        tts = instance
        activeBackend = device
        progress.send(null)
        post({ type: 'ready', backend: device })
        return
      } catch (error) {
        lastError = error
        tts = null
        activeBackend = null
      }
    }

    post({
      type: 'failed',
      reason: classify(lastError),
      message: String((lastError as Error)?.message ?? 'Studio Voice could not start.'),
    })
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
      void bringUp(message.backend, true)
      break
    case 'resume':
      void bringUp(message.backend, false)
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
