/**
 * Speak everything the app already knows it might say, at build time.
 *
 *     npm run speech                # against a running Kokoro-FastAPI
 *     npm run speech:local          # no server: Kokoro-82M on this machine
 *     npm run speech -- --force     # say it all again
 *     npm run speech -- --prune     # and delete clips nothing asks for any more
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
 *
 * ── Two engines, one plan ───────────────────────────────────────────────────
 *
 * This file owns every decision that has to agree with the browser: which
 * phrases, which voices, which speeds, what each clip is called. It never owns
 * the model. Whichever engine is asked for is handed a flat list of jobs and
 * told where to put the bytes.
 *
 *  - `server` is Kokoro-FastAPI over HTTP, which is what `docker compose up`
 *    provides and what a development machine with a GPU wants.
 *  - `local` is `kokoro_local.py`: ONNX on the CPU, no container, no service.
 *    Slower per clip and reproducible from a bare checkout, which is what the
 *    clips committed to this repository were made with.
 */

import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { assetPath, cacheKey, clampSpeed } from '../src/lib/tts/cacheKey.ts'
import { instantPhrases, knownPhrases } from '../src/lib/tts/knownPhrases.ts'
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
const engine = value('--engine', 'server')
const formats = value('--formats', 'opus,mp3')
  .split(',')
  .map((format) => format.trim())
  .filter((format) => format === 'opus' || format === 'mp3')

/**
 * Which speeds to generate, and for which phrases.
 *
 * Speed is part of the cache key — a clip is audio, and audio at a different
 * pace is different audio — so pre-generating means choosing the speeds people
 * actually use, and every extra speed is another full copy of the library on
 * disk and in the repository.
 *
 * So the split follows how much each phrase is worth. The app's default is
 * 0.9 and every pre-generated phrase is available there. The handful somebody
 * hears in their first minute — the previews, the starters, the voice sample —
 * are also generated at 1.0, because "normal" is the other answer people pick
 * and the first minute is the one that has to be instant. Anything else at any
 * other speed falls through to whatever engine is present and is cached from
 * there, which by then is a returning visitor's problem rather than a new
 * one's.
 */
const speeds = value('--speeds', '0.9')
  .split(',')
  .map((speed) => clampSpeed(Number(speed)))
  .filter((speed, index, list) => list.indexOf(speed) === index)

const instantSpeeds = value('--instant-speeds', '0.9,1')
  .split(',')
  .map((speed) => clampSpeed(Number(speed)))
  .filter((speed, index, list) => list.indexOf(speed) === index)

const modelVersion = process.env.TTS_MODEL_VERSION ?? KOKORO_MODEL_VERSION
const language = (process.env.TTS_LANGUAGE ?? DEFAULT_LANGUAGE).toLowerCase()

/**
 * Which normaliser the clips are made through.
 *
 * The two engines have different front ends and it matters. Kokoro-FastAPI
 * runs Misaki, which takes `[word](/ˈfoʊniːmz/)` inline; the local script runs
 * espeak-ng directly, exactly as the in-browser Studio Voice does, and would
 * read that markup out as punctuation. Handing each the form it understands is
 * what keeps a pre-generated clip and the same line synthesised on somebody's
 * phone the same audio rather than two different readings.
 */
const normalizer = new PronunciationNormalizer(
  engine === 'local'
    ? { supportsPhonemes: false }
    : { supportsPhonemes: true, renderPhoneme: kokoroPhonemeMarkup },
)

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

/**
 * Every clip this build wants, whether or not it already exists.
 *
 * Built before anything is synthesised so that both engines see the same list,
 * the manifest can be written from it rather than from whatever happened to
 * succeed, and `--prune` has something authoritative to compare against.
 */
function planClips() {
  const instant = new Set(instantPhrases())
  const wanted = []

  for (const text of knownPhrases()) {
    const forThisPhrase = instant.has(text)
      ? [...new Set([...speeds, ...instantSpeeds])]
      : speeds

    for (const voice of LOGICAL_VOICES) {
      for (const speed of forThisPhrase) {
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
        wanted.push({
          key,
          text,
          // The same normaliser the engine runs, so a phrase generated here
          // and the same phrase synthesised live are the same audio.
          spoken: normalizer.normalize(text).text || text,
          voice,
          engineVoice: engineVoiceFor(voice),
          speed,
          language,
          formats: formats.map((format) => ({
            format,
            relative: assetPath(key, format),
          })),
        })
      }
    }
  }

  return wanted
}

/** The jobs whose files are not already on disk. */
async function missingJobs(clips) {
  const jobs = []
  for (const clip of clips) {
    for (const { format, relative } of clip.formats) {
      if (!force && (await exists(path.join(outputDir, relative)))) continue
      jobs.push({
        key: clip.key,
        text: clip.text,
        spoken: clip.spoken,
        engineVoice: clip.engineVoice,
        speed: clip.speed,
        language: clip.language,
        format,
        relative,
      })
    }
  }
  return jobs
}

/* ── Engines ─────────────────────────────────────────────────────────────── */

async function runServer(jobs) {
  let made = 0
  let failed = 0
  for (const job of jobs) {
    try {
      const bytes = await kokoro.synthesize({
        text: job.spoken,
        voice: job.engineVoice,
        speed: job.speed,
        language: job.language,
        format: job.format,
      })
      const file = path.join(outputDir, job.relative)
      await fs.mkdir(path.dirname(file), { recursive: true })
      await fs.writeFile(file, bytes)
      made += 1
      process.stdout.write('.')
    } catch (error) {
      failed += 1
      console.warn(
        `\n  ! ${job.engineVoice} ${job.speed}× ${job.format}: ${job.text}\n    ${error.message}`,
      )
    }
  }
  process.stdout.write('\n')
  return { made, failed }
}

/**
 * Which interpreter runs `kokoro_local.py`.
 *
 * The virtual environment `npm run speech:setup` builds wins when it is there,
 * so the common case needs no environment variable and no activated shell.
 * `KOKORO_PYTHON` overrides it for anybody who keeps the dependencies
 * somewhere else, and bare `python3` is the last resort.
 */
async function resolvePython() {
  if (process.env.KOKORO_PYTHON) return process.env.KOKORO_PYTHON
  const venv = path.join(
    repoRoot,
    '.cache',
    'kokoro',
    'venv',
    process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python',
  )
  return (await exists(venv)) ? venv : 'python3'
}

/**
 * Hand the whole batch to one Python process.
 *
 * One process rather than one per clip because loading a 320 MB ONNX graph
 * takes longer than synthesising a sentence, so per-clip spawning would spend
 * nearly all of its time on startup. The plan goes through a temporary file
 * rather than an argument list, which has a length limit measured in
 * kilobytes and would truncate somewhere around the fiftieth affirmation.
 */
async function runLocal(jobs) {
  const python = await resolvePython()
  const planFile = path.join(
    await fs.mkdtemp(path.join(os.tmpdir(), 'manifester-speech-')),
    'plan.json',
  )
  await fs.writeFile(planFile, JSON.stringify({ outputDir, jobs }))

  const code = await new Promise((resolve) => {
    const child = spawn(python, [path.join(here, 'kokoro_local.py'), planFile], {
      stdio: 'inherit',
    })
    child.on('error', (error) => {
      console.error(`\nCould not start ${python}: ${error.message}`)
      resolve(1)
    })
    child.on('close', resolve)
  })

  await fs.rm(path.dirname(planFile), { recursive: true, force: true })

  // Python writes the files; what actually landed is the honest answer, and
  // it is also what the manifest is about to be built from.
  let made = 0
  for (const job of jobs) {
    if (await exists(path.join(outputDir, job.relative))) made += 1
  }
  return { made, failed: jobs.length - made, exitCode: code }
}

/* ── Run ─────────────────────────────────────────────────────────────────── */

async function main() {
  if (engine !== 'server' && engine !== 'local') {
    console.error(`Unknown engine "${engine}". Use --engine server or --engine local.`)
    process.exitCode = 1
    return
  }

  const previous = await readManifest()
  const wanted = planClips()
  const jobs = await missingJobs(wanted)
  const skipped = wanted.reduce((total, clip) => total + clip.formats.length, 0) - jobs.length

  console.log(
    `${wanted.length} clips wanted across ${formats.length} format(s); ` +
      `${jobs.length} to generate, ${skipped} already present. Engine: ${engine}.`,
  )

  await fs.mkdir(outputDir, { recursive: true })
  const outcome = jobs.length
    ? engine === 'local'
      ? await runLocal(jobs)
      : await runServer(jobs)
    : { made: 0, failed: 0 }

  /*
   * The manifest lists what is actually on disk, not what was asked for.
   *
   * A clip that failed to generate must not appear: the browser would fetch
   * its URL, get a 404, and fall back to the device voice a beat later —
   * whereas a clip simply absent from the manifest falls back immediately and
   * silently, which is the same outcome without the wasted round trip.
   */
  const clips = {}
  let listed = 0
  for (const clip of wanted) {
    const present = {}
    for (const { format, relative } of clip.formats) {
      if (await exists(path.join(outputDir, relative))) present[format] = relative
    }
    if (Object.keys(present).length === 0) continue
    clips[clip.key] = {
      text: clip.text,
      voice: clip.voice,
      speed: clip.speed,
      language: clip.language,
      formats: present,
    }
    listed += 1
  }

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

  await fs.writeFile(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`)

  if (prune) {
    const keep = new Set(
      Object.values(clips).flatMap((clip) => Object.values(clip.formats)),
    )
    const removed = await pruneUnlisted(outputDir, keep)
    console.log(`Pruned ${removed} clip${removed === 1 ? '' : 's'}.`)
  }

  const carriedOver = Object.keys(previous.clips ?? {}).length
  console.log(
    `${outcome.made} generated, ${skipped} already present, ${outcome.failed} failed. ` +
      `Manifest lists ${listed} clips (was ${carriedOver}).`,
  )

  if (outcome.failed > 0 && outcome.made === 0) {
    console.error(
      engine === 'local'
        ? '\nNothing could be generated. Are the Python dependencies installed?\n' +
            '  npm run speech:setup   # then try again'
        : '\nNothing could be generated. Is Kokoro running?\n' +
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
