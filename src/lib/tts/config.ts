/**
 * Where the voice comes from, on this deployment.
 *
 * Manifester ships to two quite different places and both have to be good:
 *
 *  - **GitHub Pages**, where there is no backend at all. There is no engine to
 *    reach, so the app plays the clips that were generated at build time and
 *    falls back to the device's own voice for anything a person wrote
 *    themselves. Nothing is broken, nothing is retried forever, and no error
 *    is shown for a service that was never meant to be there.
 *  - **A full install** — `docker compose up` — where the backend is on the
 *    same origin at `/api/tts` and every line is spoken in the studio voice.
 *
 * The difference between them is one environment variable, read at build time.
 * `VITE_TTS_ENDPOINT=""` says "there is no engine here"; anything else is the
 * path or origin the backend answers on.
 */

import type { PronunciationScope } from './pronunciation/types'
import { DEFAULT_LANGUAGE } from './versions'

export interface TTSConfig {
  /** The backend's base path, or `null` when this build has no backend. */
  endpoint: string | null
  /** Where pre-generated clips live, absolute from the site root. */
  staticBase: string
  /** Rules to switch on. See `pronunciation/dictionary.ts`. */
  scopes: PronunciationScope[]
  language: string
  /** Milliseconds before a live synthesis is given up on. */
  synthesisTimeoutMs: number
  /** Milliseconds before a cache lookup is given up on. */
  lookupTimeoutMs: number
}

/**
 * Vite replaces `import.meta.env` at build time, and this module is imported
 * by the browser only — the backend and the build script share the *hashing*
 * and the *dictionary*, never the configuration.
 */
const env = import.meta.env as unknown as Record<string, string | undefined>

function resolveEndpoint(): string | null {
  const configured = env.VITE_TTS_ENDPOINT
  // An explicitly empty value is a decision: this build has no backend.
  if (configured === '') return null
  const value = (configured ?? '/api/tts').trim()
  if (!value) return null
  return value.replace(/\/+$/, '')
}

function resolveStaticBase(): string {
  const base = env.BASE_URL ?? '/'
  const configured = env.VITE_TTS_STATIC_BASE
  if (configured) return configured.endsWith('/') ? configured : `${configured}/`
  return `${base.endsWith('/') ? base : `${base}/`}speech/`
}

export const DEFAULT_CONFIG: TTSConfig = {
  endpoint: resolveEndpoint(),
  staticBase: resolveStaticBase(),
  scopes: ['app', 'acronym', 'medical', 'science', 'gaming'],
  language: DEFAULT_LANGUAGE,
  /*
   * Twelve seconds is long for a phone and short for a cold model. It is
   * chosen against the thing that happens when it is exceeded: the line is
   * spoken by the device's own voice instead, which is a small drop in
   * quality and no drop at all in whether the app works. Waiting longer than
   * this to avoid that trade is the wrong way round.
   */
  synthesisTimeoutMs: 12_000,
  lookupTimeoutMs: 4_000,
}
