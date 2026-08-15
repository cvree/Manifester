/**
 * The only code in this repository that knows what Kokoro's API looks like.
 *
 * `remsky/Kokoro-FastAPI` speaks the OpenAI audio API, which is convenient in
 * a way that is worth being explicit about: swapping it for a hosted provider
 * that speaks the same shape is a base URL and a key, and swapping it for one
 * that does not is a new file next to this one and a line in `index.mjs`.
 * Neither is a change to the app, the cache, or the cache keys.
 */

import { config } from './config.mjs'

/** Kokoro's own name for American English. */
const LANG_CODES = {
  'en-us': 'a',
  'en-gb': 'b',
}

/**
 * Ask for one clip.
 *
 * `response_format` is passed straight through, so the container does the
 * encoding — which is why nothing in this repository needs ffmpeg, lame, or an
 * opinion about bit rates.
 */
export async function synthesize({ text, voice, speed, language, format }, signal) {
  const controller = new AbortController()
  const onAbort = () => controller.abort()
  signal?.addEventListener('abort', onAbort, { once: true })
  const timer = setTimeout(() => controller.abort(), config.kokoroTimeoutMs)

  try {
    const response = await fetch(`${config.kokoroUrl}/v1/audio/speech`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: config.kokoroModel,
        input: text,
        voice,
        response_format: format === 'opus' ? 'opus' : 'mp3',
        speed,
        stream: false,
        lang_code: LANG_CODES[language] ?? 'a',
      }),
    })

    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      throw new Error(
        `Kokoro responded ${response.status}${detail ? `: ${detail.slice(0, 300)}` : ''}`,
      )
    }

    const buffer = Buffer.from(await response.arrayBuffer())
    if (buffer.length === 0) throw new Error('Kokoro returned an empty clip')
    return buffer
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

/**
 * Is the model up?
 *
 * Two endpoints because the health route has moved between releases of the
 * container, and the voice list is the one that has always been there. Either
 * answering is enough to know the thing is alive.
 */
export async function health() {
  for (const path of ['/health', '/v1/audio/voices']) {
    try {
      const response = await fetch(`${config.kokoroUrl}${path}`, {
        signal: AbortSignal.timeout(2500),
      })
      if (response.ok) return true
    } catch {
      /* Try the next one. */
    }
  }
  return false
}
