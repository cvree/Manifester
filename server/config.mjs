/**
 * Everything the speech backend can be told, and what it assumes otherwise.
 *
 * Defaults are chosen so that `node server/index.mjs` on a laptop with the
 * Kokoro container running does the right thing with no environment at all,
 * and so that the Docker composition needs only the one variable that differs
 * inside a network of containers.
 */

import { fileURLToPath } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '..')

const number = (value, fallback) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export const config = {
  port: number(process.env.PORT, 8787),
  host: process.env.HOST ?? '0.0.0.0',

  /**
   * The Kokoro container.
   *
   * Never reachable from a browser — see the compose file, where it has no
   * published ports. This is the only process that talks to it.
   */
  kokoroUrl: (process.env.KOKORO_URL ?? 'http://127.0.0.1:8880').replace(/\/+$/, ''),
  kokoroModel: process.env.KOKORO_MODEL ?? 'kokoro',
  /** Seconds. A cold model on a small CPU takes its time on the first line. */
  kokoroTimeoutMs: number(process.env.KOKORO_TIMEOUT_MS, 60_000),

  /** Where synthesised clips are kept. Content-addressed, so append-only. */
  cacheDir: process.env.SPEECH_CACHE_DIR ?? path.join(repoRoot, 'data', 'speech'),
  /**
   * Clips generated at build time, served read-only.
   *
   * The same files the browser can fetch directly from the CDN. Reading them
   * here as well means a device that skipped the static layer — an old service
   * worker, a cache-busting reload — still never causes a synthesis.
   */
  staticDir: process.env.SPEECH_STATIC_DIR ?? path.join(repoRoot, 'public', 'speech'),
  /** Set to a built front end to serve the whole app from one process. */
  publicDir: process.env.PUBLIC_DIR ?? '',

  /** Longest single utterance. One line of an affirmation is far below this. */
  maxTextLength: number(process.env.MAX_TEXT_LENGTH, 1200),
  maxBodyBytes: number(process.env.MAX_BODY_BYTES, 16 * 1024),
  /** Synthesis requests per minute, per address. Cache hits are not counted. */
  rateLimitPerMinute: number(process.env.RATE_LIMIT_PER_MINUTE, 120),

  /**
   * Cross-origin callers.
   *
   * Empty means same-origin only, which is what the Docker composition is:
   * the API and the app are served from one place. A comma-separated list
   * opens it up for a front end deployed somewhere else.
   */
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
}
