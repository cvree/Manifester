/**
 * Speak everything the app already knows it might say, at build time.
 *
 *     npm run speech            # generate what is missing
 *     npm run speech -- --force # say it all again
 *     npm run speech -- --prune # and delete clips nothing asks for any more
 *
 * The output is ordinary static files under `public/speech`, named by the same
 * content hash the browser and the backend compute, plus a manifest listing
 * them. They are served like any other asset: precached by the service worker,
 * cacheable forever because their names can never mean different audio, and
 * available with no backend at all — which is what lets the GitHub Pages build
 * speak in the studio voice.
 *
 * Regeneration is incremental by construction rather than by bookkeeping. A
 * clip's name is a hash of the words, the voice, the speed, the language and
 * the three version numbers, so "has this changed?" is answered by asking
 * whether the file exists. Editing one phrase regenerates one phrase; bumping
 * `PRONUNCIATION_VERSION` regenerates everything, and does so under new names,
 * so a half-finished run can never leave the manifest pointing at a mixture.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { assetPath, cacheKey, clampSpeed } from '../src/lib/tts/cacheKey.ts'
import { knownPhrases } from '../src/lib/tts/knownPhrases.ts'
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
import { LOGICAL_VOICES, engineVoiceFor } from '../src/lib/tts/voices.ts'
import { KOKORO_MODEL_VERSION } from '../src/lib/tts/engines/kokoroModel.ts'
import * as kokoro from '../server/kokoro.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '..')
const outputDir = path.join(repoRoot, 'public', 'speech')
const manifestFile = path.join(outputDir, 'manifest.json')

const args = process.argv.slice(2)
const has = (flag) => args.includes(flag)
const value = (flag, fallback) => {
  const index = args.indexOf(flag)
  return index === -1 || index === args.length - 1 ? fallback : args[index + 1]
}

const force = has('--force')
const prune = has('--prune')
const formats = value('--formats', 'opus,mp3')
  .split(',')
  .map((format) => format.trim())
  .filter((format) => format === 'opus' || format === 'mp3')

/**
 * Which speeds to generate.
 *
 * Speed is part of the cache key — a clip is audio, and audio at a different
 * pace is different audio — so pre-generating means choosing the speeds people
 * actually use. The app's default is 0.9 and the second most common answer is
 * "normal", so those two are generated and everything else falls through to
 * live synthesis and is cached from there.
 */
const speeds = value('--speeds', '0.9,1')
  .split(',')
  .map((speed) => clampSpeed(Number(speed)))
  .filter((speed, index, list) => list.indexOf(speed) === index)

const modelVersion = process.env.TTS_MODEL_VERSION ?? KOKORO_MODEL_VERSION
const language = (process.env.TTS_LANGUAGE ?? DEFAULT_LANGUAGE).toLowerCase()

const normalizer = new PronunciationNormalizer({
  supportsPhonemes: true,
  renderPhoneme: kokoroPhonemeMarkup,
})

async function readManifest() {
  try {
    const raw = await fs.readFile(manifestFile, 'utf8')
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && parsed.clips) return parsed
  } catch {
    /* No manifest yet, or an unreadable one: start from nothing. */
  }
  return { version: 1, clips: {} }
}

async function exists(file) {
  try {
    const stats = await fs.stat(file)
    return stats.size > 0
  } catch {
    return false
  }
}

async function main() {
  const phrases = knownPhrases()
  const previous = await readManifest()
  const clips = {}

  let made = 0
  let skipped = 0
  let failed = 0

  console.log(
    `Generating ${phrases.length} phrases × ${LOGICAL_VOICES.length} voices × ` +
      `${speeds.length} speeds × ${formats.length} formats`,
  )

  for (const text of phrases) {
    for (const voice of LOGICAL_VOICES) {
      for (const speed of speeds) {
        const key = cacheKey({
          text,
          voice,
          voiceVersion: VOICE_VERSION,
          speed,
          language,
          modelVersion,
          pronunciationVersion: PRONUNCIATION_VERSION,
          audioVersion: AUDIO_VERSION,
        })

        const entry = {
          text,
          voice,
          speed,
          language,
          formats: {},
        }

        for (const format of formats) {
          const relative = assetPath(key, format)
          const file = path.join(outputDir, relative)

          if (!force && (await exists(file))) {
            entry.formats[format] = relative
            skipped += 1
            continue
          }

          try {
            // The same normaliser the backend runs, so a phrase generated here
            // and the same phrase synthesised live are the same audio.
            const spoken = normalizer.normalize(text)
            const bytes = await kokoro.synthesize({
              text: spoken.text || text,
              voice: engineVoiceFor(voice),
              speed,
              language,
              format,
            })
            await fs.mkdir(path.dirname(file), { recursive: true })
            await fs.writeFile(file, bytes)
            entry.formats[format] = relative
            made += 1
            process.stdout.write('.')
          } catch (error) {
            failed += 1
            console.warn(`\n  ! ${voice} ${speed}× ${format}: ${text}\n    ${error.message}`)
          }
        }

        if (Object.keys(entry.formats).length > 0) clips[key] = entry
      }
    }
  }

  process.stdout.write('\n')

  const manifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    engine: { id: 'kokoro', modelVersion },
    versions: {
      voice: VOICE_VERSION,
      pronunciation: PRONUNCIATION_VERSION,
      audio: AUDIO_VERSION,
    },
    clips,
  }

  await fs.mkdir(outputDir, { recursive: true })
  await fs.writeFile(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`)

  if (prune) {
    const wanted = new Set(
      Object.entries(clips).flatMap(([, clip]) => Object.values(clip.formats)),
    )
    const removed = await pruneUnlisted(outputDir, wanted)
    console.log(`Pruned ${removed} clip${removed === 1 ? '' : 's'}.`)
  }

  const carriedOver = Object.keys(previous.clips ?? {}).length
  console.log(
    `\n${made} generated, ${skipped} already present, ${failed} failed. ` +
      `Manifest lists ${Object.keys(clips).length} clips (was ${carriedOver}).`,
  )

  if (failed > 0 && made === 0) {
    console.error(
      '\nNothing could be generated. Is Kokoro running?\n' +
        '  docker compose up -d kokoro   # then try again\n' +
        `  KOKORO_URL is ${process.env.KOKORO_URL ?? 'http://127.0.0.1:8880'}`,
    )
    process.exitCode = 1
  }
}

/** Delete generated audio the manifest no longer refers to. */
async function pruneUnlisted(directory, wanted) {
  let removed = 0
  const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => [])
  for (const entry of entries) {
    const full = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      removed += await pruneUnlisted(full, wanted)
      const remaining = await fs.readdir(full).catch(() => ['keep'])
      if (remaining.length === 0) await fs.rmdir(full).catch(() => undefined)
      continue
    }
    if (!/\.(opus|mp3)$/.test(entry.name)) continue
    const relative = path.relative(outputDir, full).split(path.sep).join('/')
    if (wanted.has(relative)) continue
    await fs.rm(full, { force: true })
    removed += 1
  }
  return removed
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
