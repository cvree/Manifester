/**
 * The Kokoro engine, as the browser sees it.
 *
 * Which is to say: not Kokoro at all, but this app's own backend. The model
 * runs in a container that is never reachable from a browser — no port, no
 * origin, no CORS — and everything the page knows about it is three routes on
 * our own API. That is a security boundary rather than a layering nicety: a
 * public text-to-speech endpoint is a public GPU-shaped bill and a public
 * denial-of-service target, and putting one on the internet by accident is
 * something that has to be impossible rather than merely unlikely.
 *
 * The split between `lookup` and `synthesize` is what the resolution order in
 * `client.ts` is built on. `lookup` is a plain GET of a content-addressed
 * file: it hits a disk cache, it is cheap enough to try on every line, and it
 * is the request a CDN would serve if one were ever put in front of the API.
 * `synthesize` is the expensive one, and only runs when nothing anywhere had
 * the clip already.
 */

import type {
  AudioFormat,
  EngineDescriptor,
  EngineRequest,
  EngineResult,
  TTSEngine,
} from '../types'
import { assetPath } from '../cacheKey'
import { KOKORO_MODEL_VERSION } from './kokoroModel'

export interface KokoroEngineOptions {
  /** The backend base path, e.g. `/api/tts`. */
  endpoint: string
  synthesisTimeoutMs?: number
  lookupTimeoutMs?: number
  /**
   * Which model version the clips are keyed against.
   *
   * Sent by the backend on `/health` and used from then on, so that upgrading
   * the container re-keys the cache without a front-end release. Until the
   * first health check answers, the built-in default is used — and if the two
   * disagree, the clips made under the old one are simply never looked up
   * again, which is exactly what content addressing is for.
   */
  modelVersion?: string
}

const DEFAULT_MODEL_VERSION = KOKORO_MODEL_VERSION

export class KokoroEngine implements TTSEngine {
  private endpoint: string
  private synthesisTimeoutMs: number
  private lookupTimeoutMs: number
  private modelVersion: string
  /** Cached health result, so a dead backend is not asked on every line. */
  private health: { at: number; ok: boolean } | null = null

  constructor(options: KokoroEngineOptions) {
    this.endpoint = options.endpoint.replace(/\/+$/, '')
    this.synthesisTimeoutMs = options.synthesisTimeoutMs ?? 12_000
    this.lookupTimeoutMs = options.lookupTimeoutMs ?? 4_000
    this.modelVersion = options.modelVersion ?? DEFAULT_MODEL_VERSION
  }

  get descriptor(): EngineDescriptor {
    return {
      id: 'kokoro',
      modelVersion: this.modelVersion,
      // Misaki, Kokoro's front end, takes `[word](/ˈfoʊniːmz/)` inline.
      supportsPhonemes: true,
      formats: ['opus', 'mp3'],
    }
  }

  async lookup(
    request: EngineRequest,
    signal?: AbortSignal,
  ): Promise<EngineResult | null> {
    const url = `${this.endpoint}/audio/${assetPath(request.key, request.format)}`
    try {
      const response = await this.fetch(url, { method: 'GET' }, this.lookupTimeoutMs, signal)
      // 204 is the backend's way of saying "nobody has made this yet" without
      // printing an error in everybody's console. 404 means the address itself
      // was wrong, which is also a miss as far as this caller is concerned.
      if (response.status === 204 || response.status === 404) return null
      if (!response.ok) return null
      const bytes = await response.arrayBuffer()
      if (bytes.byteLength === 0) return null
      return { bytes, format: request.format, source: 'server-cache' }
    } catch {
      // A miss and an unreachable server are the same answer to the caller:
      // there is nothing here. Which one it was is `probe`'s business.
      return null
    }
  }

  async synthesize(
    request: EngineRequest,
    signal?: AbortSignal,
  ): Promise<EngineResult> {
    const response = await this.fetch(
      `${this.endpoint}/speak`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          text: request.text,
          voice: request.voice,
          speed: request.speed,
          language: request.language,
          format: request.format,
          key: request.key,
          reload: request.reload === true,
        }),
      },
      this.synthesisTimeoutMs,
      signal,
    )

    if (!response.ok) {
      this.health = { at: Date.now(), ok: false }
      throw new Error(`Speech service responded ${response.status}`)
    }

    const bytes = await response.arrayBuffer()
    if (bytes.byteLength === 0) throw new Error('Speech service returned no audio')

    const returned = response.headers.get('x-tts-format')
    const format = (returned === 'mp3' || returned === 'opus'
      ? returned
      : request.format) as AudioFormat
    const source = response.headers.get('x-tts-source') === 'cache'
      ? 'server-cache'
      : 'engine'

    this.health = { at: Date.now(), ok: true }
    const model = response.headers.get('x-tts-model')
    if (model) this.modelVersion = model

    return { bytes, format, source }
  }

  /**
   * Is the backend there?
   *
   * Answered from a short-lived memo, because the interesting case is a
   * session where it is *not* there: without the memo, every line of a
   * twenty-line loop would spend its own timeout discovering the same thing.
   * A negative answer is remembered for five seconds and a positive one for a
   * minute, so a backend that comes back is noticed quickly and one that is
   * missing is only asked about occasionally.
   */
  async probe(signal?: AbortSignal): Promise<boolean> {
    const now = Date.now()
    if (this.health) {
      const age = now - this.health.at
      if (this.health.ok ? age < 60_000 : age < 5_000) return this.health.ok
    }

    try {
      const response = await this.fetch(
        `${this.endpoint}/health`,
        { method: 'GET' },
        this.lookupTimeoutMs,
        signal,
      )
      const ok = response.ok
      if (ok) {
        const body = (await response.json()) as {
          engine?: { modelVersion?: string }
        }
        const version = body?.engine?.modelVersion
        if (version) this.modelVersion = version
      }
      this.health = { at: Date.now(), ok }
      return ok
    } catch {
      this.health = { at: Date.now(), ok: false }
      return false
    }
  }

  /* ── internals ── */

  /**
   * `fetch` with a deadline, and with the caller's cancellation folded in.
   *
   * `AbortSignal.any` would be one line and is too new to rely on: it landed
   * in Safari 17.4, and an app that stops working on an iPhone one major
   * version behind is not something a convenience is worth.
   */
  private async fetch(
    url: string,
    init: RequestInit,
    timeoutMs: number,
    signal?: AbortSignal,
  ): Promise<Response> {
    const controller = new AbortController()
    const onAbort = () => controller.abort(signal?.reason)
    if (signal) {
      if (signal.aborted) controller.abort(signal.reason)
      else signal.addEventListener('abort', onAbort, { once: true })
    }
    const timer = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs)

    try {
      return await fetch(url, { ...init, signal: controller.signal })
    } finally {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
    }
  }
}
