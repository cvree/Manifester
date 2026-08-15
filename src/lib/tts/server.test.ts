import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { spawn, type ChildProcess } from 'node:child_process'
import http from 'node:http'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { cacheKey } from './cacheKey'
import { assetPath } from './cacheKey'
import {
  AUDIO_VERSION,
  DEFAULT_LANGUAGE,
  PRONUNCIATION_VERSION,
  VOICE_VERSION,
} from './versions'
import { KOKORO_MODEL_VERSION } from './engines/kokoroModel'

/*
 * The backend, running for real, with a stub where the model would be.
 *
 * Worth the cost of a child process because the properties being checked here
 * are the ones that only exist at the seam: that the *server* decides what a
 * clip is called rather than trusting the client, that two simultaneous
 * requests for the same words reach the model once, and that a clip is on disk
 * — under the name the browser will ask for — before anybody hears it.
 *
 * The stub also lets the interesting failure be tested, which a real model
 * would not: a synthesis that fails must produce a clean 502 rather than a
 * hung request, because a hung request is what turns one bad line into a
 * silent session.
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')

let upstream: http.Server
let upstreamPort = 0
let server: ChildProcess | null = null
let baseUrl = ''
let cacheDir = ''

/** Every request the fake model has been asked for. */
const asked: Array<{ input: string; voice: string; format: string }> = []
let failNext = false
/** Held open to prove that concurrent requests collapse into one synthesis. */
let hold: (() => void) | null = null

function startUpstream(): Promise<void> {
  upstream = http.createServer((request, response) => {
    if (request.url?.startsWith('/health')) {
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end('{"status":"healthy"}')
      return
    }

    let body = ''
    request.on('data', (chunk) => (body += chunk))
    request.on('end', () => {
      const parsed = JSON.parse(body || '{}')
      asked.push({
        input: parsed.input,
        voice: parsed.voice,
        format: parsed.response_format,
      })

      if (failNext) {
        response.writeHead(500)
        response.end('model unavailable')
        return
      }

      const send = () => {
        // Not real audio: the server is not supposed to look inside it.
        response.writeHead(200, { 'content-type': 'audio/mpeg' })
        response.end(Buffer.from('fake-audio-bytes'))
      }

      if (hold) {
        const release = hold
        hold = null
        setTimeout(() => {
          release()
          send()
        }, 50)
        return
      }
      send()
    })
  })

  return new Promise((resolve) => {
    upstream.listen(0, '127.0.0.1', () => {
      upstreamPort = (upstream.address() as { port: number }).port
      resolve()
    })
  })
}

async function startServer(): Promise<void> {
  cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'manifester-speech-'))
  const port = 8899

  server = spawn('node', ['server/index.mjs'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      PORT: String(port),
      HOST: '127.0.0.1',
      KOKORO_URL: `http://127.0.0.1:${upstreamPort}`,
      SPEECH_CACHE_DIR: cacheDir,
      SPEECH_STATIC_DIR: path.join(cacheDir, 'static-does-not-exist'),
      PUBLIC_DIR: '',
    },
    stdio: 'ignore',
  })

  baseUrl = `http://127.0.0.1:${port}/api/tts`

  // Wait for it to answer rather than guessing at a start-up time.
  const deadline = Date.now() + 15_000
  for (;;) {
    try {
      const response = await fetch(`${baseUrl}/health`)
      if (response.ok) return
    } catch {
      /* Not up yet. */
    }
    if (Date.now() > deadline) throw new Error('The speech server did not start')
    await new Promise((resolve) => setTimeout(resolve, 150))
  }
}

const keyFor = (text: string, voice = 'female_1', speed = 1) =>
  cacheKey({
    text,
    voice: voice as 'female_1' | 'male_1',
    voiceVersion: VOICE_VERSION,
    speed,
    language: DEFAULT_LANGUAGE,
    modelVersion: KOKORO_MODEL_VERSION,
    pronunciationVersion: PRONUNCIATION_VERSION,
    audioVersion: AUDIO_VERSION,
  })

const speak = (body: Record<string, unknown>) =>
  fetch(`${baseUrl}/speak`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

beforeAll(async () => {
  await startUpstream()
  await startServer()
}, 30_000)

afterAll(async () => {
  server?.kill()
  upstream?.close()
  if (cacheDir) await fs.rm(cacheDir, { recursive: true, force: true })
})

describe('the speech API', () => {
  it('says what it is, and what it is running', async () => {
    const response = await fetch(`${baseUrl}/health`)
    const body = await response.json()
    expect(body.ok).toBe(true)
    expect(body.engine.modelVersion).toBe(KOKORO_MODEL_VERSION)
    expect(body.engine.upstream).toBe(true)
    expect(body.voices).toEqual(['female_1', 'male_1'])
  })

  it('names a clip the same way the browser does', async () => {
    const text = 'I am steady today.'
    const response = await speak({ text, voice: 'female_1', speed: 1, format: 'mp3' })

    expect(response.status).toBe(200)
    expect(response.headers.get('x-tts-key')).toBe(keyFor(text))
    expect(response.headers.get('x-tts-source')).toBe('engine')
    expect(await response.arrayBuffer()).toBeTruthy()
  })

  it('puts the clip on disk under the name the browser will ask for', async () => {
    const text = 'The clip goes to disk.'
    await speak({ text, voice: 'male_1', speed: 1, format: 'mp3' })

    const file = path.join(cacheDir, assetPath(keyFor(text, 'male_1'), 'mp3'))
    const bytes = await fs.readFile(file)
    expect(bytes.length).toBeGreaterThan(0)
  })

  it('serves the second request from disk without touching the model', async () => {
    const text = 'Say this twice.'
    await speak({ text, voice: 'female_1', speed: 1, format: 'mp3' })
    const before = asked.length

    const again = await speak({ text, voice: 'female_1', speed: 1, format: 'mp3' })
    expect(again.headers.get('x-tts-source')).toBe('cache')
    expect(asked.length).toBe(before)

    // And by content address, which is the request a CDN would serve.
    const direct = await fetch(`${baseUrl}/audio/${assetPath(keyFor(text), 'mp3')}`)
    expect(direct.status).toBe(200)
    expect(direct.headers.get('cache-control')).toContain('immutable')
  })

  it('collapses simultaneous requests for the same words into one synthesis', async () => {
    const text = 'Everyone wants this line at once.'
    const before = asked.length
    hold = () => undefined

    const [a, b, c] = await Promise.all([
      speak({ text, voice: 'female_1', speed: 1, format: 'mp3' }),
      speak({ text, voice: 'female_1', speed: 1, format: 'mp3' }),
      speak({ text, voice: 'female_1', speed: 1, format: 'mp3' }),
    ])

    expect([a.status, b.status, c.status]).toEqual([200, 200, 200])
    expect(asked.length - before).toBe(1)
  })

  it('applies the dictionary before the model sees the words', async () => {
    const before = asked.length
    await speak({
      text: 'photosynthesis',
      voice: 'female_1',
      speed: 1,
      format: 'mp3',
    })
    expect(asked[before].input).toBe('[photosynthesis](/ˌfoʊtoʊˈsɪnθəsɪs/)')
  })

  it('turns a logical voice into an engine voice, and accepts nothing else', async () => {
    const before = asked.length
    await speak({ text: 'Which voice is this?', voice: 'male_1', speed: 1 })
    expect(asked[before].voice).toBe('am_fenrir')

    // The engine's own voice names are not a thing a client may ask for: the
    // API is the boundary, and this is what makes it one.
    const refused = await speak({ text: 'Hello', voice: 'af_bella' })
    expect(refused.status).toBe(400)
  })

  it('refuses input it should not accept', async () => {
    expect((await speak({ text: '' })).status).toBe(400)
    expect((await speak({ text: 'x'.repeat(5000), voice: 'female_1' })).status).toBe(400)

    const badJson = await fetch(`${baseUrl}/speak`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not json',
    })
    expect(badJson.status).toBe(400)
  })

  it('answers a cold clip with "no content" rather than an error', async () => {
    // Every line the world has not spoken yet asks this question once. A 404
    // would be logged as a failed request by every browser, so an app working
    // exactly as designed would print a stream of red into the console.
    const response = await fetch(
      `${baseUrl}/audio/${assetPath(keyFor('Nobody has ever said this.'), 'mp3')}`,
    )
    expect(response.status).toBe(204)
  })

  it('will not serve a path that is not a content address', async () => {
    expect((await fetch(`${baseUrl}/audio/ab/not-a-hash.mp3`)).status).toBe(404)
    expect(
      (await fetch(`${baseUrl}/audio/zz/${keyFor('anything')}.mp3`)).status,
    ).toBe(404)
    expect((await fetch(`${baseUrl}/audio/../../etc/passwd`)).status).toBe(404)
  })

  it('reports a failed synthesis rather than hanging on it', async () => {
    failNext = true
    try {
      const response = await speak({
        text: 'This one cannot be made.',
        voice: 'female_1',
        speed: 1,
      })
      expect(response.status).toBe(502)
      expect((await response.json()).error).toMatch(/not available/i)
    } finally {
      failNext = false
    }
  })

  it('clamps a speed rather than passing it through', async () => {
    const before = asked.length
    const response = await speak({
      text: 'How fast can this go?',
      voice: 'female_1',
      speed: 99,
    })
    expect(response.headers.get('x-tts-key')).toBe(keyFor('How fast can this go?', 'female_1', 2))
    expect(asked.length).toBeGreaterThan(before)
  })
})
