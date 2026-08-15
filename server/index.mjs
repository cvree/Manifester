/**
 * The speech API.
 *
 * Three routes, no framework, no dependencies:
 *
 *     GET  /api/tts/health              is anything working?
 *     GET  /api/tts/audio/ab/<key>.ext  a clip that already exists
 *     POST /api/tts/speak               a clip, making it if necessary
 *
 * It exists for one reason above all the others: **Kokoro is never exposed to
 * a browser.** The model container publishes no ports and has no route in from
 * the outside, and everything a page can ask for arrives here first, where the
 * voice is restricted to the two this app has, the speed is clamped, the text
 * is bounded, and the request is rate limited. A text-to-speech endpoint on
 * the open internet is somebody else's compute, and the way to be sure that
 * cannot happen is for there to be no way to reach it.
 *
 * The rest is caching. Every clip is named by a hash of everything that
 * decides how it sounds, computed by the same code the browser uses, so the
 * server, the page and the build script all agree on the name of a file none
 * of them has made yet.
 */

import http from 'node:http'
import fs from 'node:fs/promises'
import path from 'node:path'
import { config } from './config.mjs'
import * as kokoro from './kokoro.mjs'
import * as store from './store.mjs'
import { cacheKey, clampSpeed } from '../src/lib/tts/cacheKey.ts'
import {
  PronunciationNormalizer,
  kokoroPhonemeMarkup,
} from '../src/lib/tts/pronunciation/normalizer.ts'
import {
  AUDIO_VERSION,
  DEFAULT_LANGUAGE,
  PRONUNCIATION_VERSION,
  VOICE_VERSION,
} from '../src/lib/tts/versions.ts'
import { engineVoiceFor, LOGICAL_VOICES } from '../src/lib/tts/voices.ts'
import { KOKORO_MODEL_VERSION } from '../src/lib/tts/engines/kokoroModel.ts'

const BASE = '/api/tts'
const FORMATS = new Set(['opus', 'mp3'])
const MODEL_VERSION = process.env.TTS_MODEL_VERSION ?? KOKORO_MODEL_VERSION

/*
 * The server normalises with phonemes switched on, because that is what the
 * engine behind it understands. The browser runs the same dictionary with them
 * switched off, for the device voice it falls back to. One dictionary, two
 * renderings, and the cache key is computed from the text as *written* — so
 * neither side has to know what the other did with it.
 */
const normalizer = new PronunciationNormalizer({
  supportsPhonemes: true,
  renderPhoneme: kokoroPhonemeMarkup,
})

/* ── Rate limiting ───────────────────────────────────────────── */

const buckets = new Map()

function withinRateLimit(address) {
  const now = Date.now()
  const window = 60_000
  const bucket = buckets.get(address)
  if (!bucket || now - bucket.startedAt > window) {
    buckets.set(address, { startedAt: now, count: 1 })
    return true
  }
  bucket.count += 1
  return bucket.count <= config.rateLimitPerMinute
}

// Addresses stop counting once their window is long past; without this the map
// is a slow memory leak on a long-running server.
setInterval(() => {
  const cutoff = Date.now() - 120_000
  for (const [address, bucket] of buckets) {
    if (bucket.startedAt < cutoff) buckets.delete(address)
  }
}, 60_000).unref()

/* ── Helpers ─────────────────────────────────────────────────── */

function cors(request, response) {
  const origin = request.headers.origin
  if (!origin) return
  if (config.allowedOrigins.includes(origin)) {
    response.setHeader('access-control-allow-origin', origin)
    response.setHeader('vary', 'origin')
    response.setHeader('access-control-allow-headers', 'content-type')
    response.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS')
  }
}

function json(response, status, body) {
  const payload = JSON.stringify(body)
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'cache-control': 'no-store',
  })
  response.end(payload)
}

function sendAudio(response, bytes, { key, format, source }) {
  response.writeHead(200, {
    'content-type': format === 'opus' ? 'audio/ogg' : 'audio/mpeg',
    'content-length': bytes.length,
    /*
     * A year, immutable. The name is a hash of the contents, so this is not
     * optimism: the file at this URL can never become different audio, and a
     * browser or CDN that never revalidates it is behaving correctly.
     */
    'cache-control': 'public, max-age=31536000, immutable',
    etag: `"${key}.${format}"`,
    'x-tts-key': key,
    'x-tts-format': format,
    'x-tts-source': source,
    'x-tts-model': MODEL_VERSION,
  })
  response.end(bytes)
}

async function readBody(request) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > config.maxBodyBytes) throw new Error('Request body too large')
    chunks.push(chunk)
  }
  return Buffer.concat(chunks).toString('utf8')
}

/**
 * A request, as the server is prepared to believe it.
 *
 * Everything is checked rather than passed through: the voice must be one of
 * the two logical names this app has — never an engine voice, so no caller can
 * reach into Kokoro's voice list — the speed is clamped to a sane range, the
 * language must be known, and the text has a hard length limit.
 */
function validate(body) {
  const text = typeof body.text === 'string' ? body.text.trim() : ''
  if (!text) return { error: 'A `text` field is required.' }
  if (text.length > config.maxTextLength) {
    return { error: `Text must be ${config.maxTextLength} characters or fewer.` }
  }

  const voice = LOGICAL_VOICES.includes(body.voice) ? body.voice : null
  if (!voice) {
    return { error: `\`voice\` must be one of: ${LOGICAL_VOICES.join(', ')}.` }
  }

  const format = FORMATS.has(body.format) ? body.format : 'mp3'
  const language = (
    typeof body.language === 'string' && body.language.trim()
      ? body.language
      : DEFAULT_LANGUAGE
  )
    .trim()
    .toLowerCase()

  return {
    text,
    voice,
    format,
    language,
    speed: clampSpeed(Number(body.speed ?? 1)),
    reload: body.reload === true,
  }
}

/* ── Routes ──────────────────────────────────────────────────── */

async function handleHealth(response) {
  const [upstream, counts] = await Promise.all([kokoro.health(), store.stats()])
  json(response, 200, {
    ok: true,
    engine: {
      id: 'kokoro',
      modelVersion: MODEL_VERSION,
      supportsPhonemes: true,
      formats: ['opus', 'mp3'],
      /*
       * `false` here is not a failure of this route. The API can still serve
       * every clip it has on disk with the model container stopped, which is
       * exactly what a deployment that only ever plays pre-generated speech
       * looks like — so the page is told, and decides for itself.
       */
      upstream,
    },
    voices: LOGICAL_VOICES,
    cache: counts,
  })
}

/** `GET /audio/ab/<key>.<format>` — a clip that already exists, or nothing. */
async function handleAudio(request, response, url) {
  const match = /^\/audio\/([0-9a-f]{2})\/([0-9a-f]{64})\.(opus|mp3)$/.exec(url)
  if (!match) return json(response, 404, { error: 'Not found' })

  const [, prefix, key, format] = match
  if (key.slice(0, 2) !== prefix) {
    return json(response, 404, { error: 'Not found' })
  }

  const bytes = await store.read(key, format)
  if (!bytes) {
    /*
     * 204 rather than 404, and the difference is entirely about the console.
     *
     * A miss here is the *expected* answer for any line nobody has spoken yet:
     * the browser asks before it synthesises, on every cold clip. A 404 is
     * logged by every browser as a failed resource, so an app that is working
     * perfectly would print a stream of red errors that anybody debugging
     * something else has to learn to ignore. "No content" is true, is not an
     * error, and is silent. A malformed address is still a 404, because that
     * one really is a mistake.
     */
    response.writeHead(204, { 'cache-control': 'no-store' })
    response.end()
    return
  }

  if (request.headers['if-none-match'] === `"${key}.${format}"`) {
    response.writeHead(304, {
      etag: `"${key}.${format}"`,
      'cache-control': 'public, max-age=31536000, immutable',
    })
    response.end()
    return
  }

  sendAudio(response, bytes, { key, format, source: 'cache' })
}

/** `POST /speak` — a clip, synthesising it if nobody has made it yet. */
async function handleSpeak(request, response) {
  let body
  try {
    body = JSON.parse(await readBody(request))
  } catch {
    return json(response, 400, { error: 'Expected a JSON body.' })
  }

  const input = validate(body ?? {})
  if (input.error) return json(response, 400, { error: input.error })

  /*
   * The key is computed here, from the text as written, rather than trusted
   * from the request. A client that could name the file it is writing could
   * poison the cache for every other client — a request for one phrase stored
   * under the hash of another, served to everybody from then on. It costs a
   * hash to be sure instead.
   */
  const key = cacheKey({
    text: input.text,
    voice: input.voice,
    voiceVersion: VOICE_VERSION,
    speed: input.speed,
    language: input.language,
    modelVersion: MODEL_VERSION,
    pronunciationVersion: PRONUNCIATION_VERSION,
    audioVersion: AUDIO_VERSION,
  })

  if (!input.reload) {
    const cached = await store.read(key, input.format)
    if (cached) {
      return sendAudio(response, cached, {
        key,
        format: input.format,
        source: 'cache',
      })
    }
  }

  const address = request.socket.remoteAddress ?? 'unknown'
  if (!withinRateLimit(address)) {
    return json(response, 429, {
      error: 'Too many synthesis requests. Try again in a moment.',
    })
  }

  try {
    const bytes = await store.once(key, input.format, async () => {
      const spoken = normalizer.normalize(input.text)
      const audio = await kokoro.synthesize({
        text: spoken.text || input.text,
        voice: engineVoiceFor(input.voice),
        speed: input.speed,
        language: input.language,
        format: input.format,
      })
      // Stored before it is served: a clip that reaches somebody's ears and
      // not the disk is one that will be synthesised again next time.
      await store.write(key, input.format, audio).catch((error) => {
        console.warn(`[tts] could not cache ${key}.${input.format}:`, error.message)
      })
      return audio
    })

    sendAudio(response, bytes, { key, format: input.format, source: 'engine' })
  } catch (error) {
    console.warn('[tts] synthesis failed:', error.message)
    json(response, 502, {
      error: 'The speech engine is not available.',
    })
  }
}

/* ── Optional: serve the built app from the same process ─────── */

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
  '.opus': 'audio/ogg',
  '.ogg': 'audio/ogg',
  '.mp3': 'audio/mpeg',
}

async function serveStatic(response, urlPath) {
  if (!config.publicDir) return false

  const relative = decodeURIComponent(urlPath.replace(/^\/+/, '')) || 'index.html'
  const resolved = path.resolve(config.publicDir, relative)
  // Nothing outside the published directory, whatever the URL says.
  if (!resolved.startsWith(path.resolve(config.publicDir))) return false

  for (const candidate of [resolved, path.join(config.publicDir, 'index.html')]) {
    try {
      const bytes = await fs.readFile(candidate)
      const extension = path.extname(candidate)
      response.writeHead(200, {
        'content-type': CONTENT_TYPES[extension] ?? 'application/octet-stream',
        'content-length': bytes.length,
        'cache-control': candidate.endsWith('.html')
          ? 'no-cache'
          : 'public, max-age=3600',
      })
      response.end(bytes)
      return true
    } catch {
      /* Try the SPA fallback, then give up. */
    }
  }
  return false
}

/* ── The server ──────────────────────────────────────────────── */

const server = http.createServer((request, response) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`)
  cors(request, response)

  if (request.method === 'OPTIONS') {
    response.writeHead(204)
    response.end()
    return
  }

  const handle = async () => {
    if (url.pathname.startsWith(BASE)) {
      const route = url.pathname.slice(BASE.length) || '/'

      if (request.method === 'GET' && (route === '/health' || route === '/health/')) {
        return handleHealth(response)
      }
      if (request.method === 'GET' && route.startsWith('/audio/')) {
        return handleAudio(request, response, route)
      }
      if (request.method === 'POST' && route === '/speak') {
        return handleSpeak(request, response)
      }
      return json(response, 404, { error: 'Not found' })
    }

    if (request.method === 'GET' && (await serveStatic(response, url.pathname))) return

    return json(response, 404, { error: 'Not found' })
  }

  handle().catch((error) => {
    console.error('[tts] unhandled error:', error)
    if (!response.headersSent) json(response, 500, { error: 'Internal error' })
    else response.end()
  })
})

server.listen(config.port, config.host, () => {
  console.log(`[tts] listening on http://${config.host}:${config.port}${BASE}`)
  console.log(`[tts] kokoro at ${config.kokoroUrl}`)
  console.log(`[tts] cache in ${config.cacheDir}`)
})

const shutdown = () => {
  server.close(() => process.exit(0))
  // A request that is mid-synthesis gets a moment to finish; a container that
  // is being replaced does not get to hang for a minute.
  setTimeout(() => process.exit(0), 5000).unref()
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
