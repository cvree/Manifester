/**
 * The clips this server has on disk.
 *
 * Content-addressed and therefore append-only: a file's name is a hash of
 * everything that decides its contents, so nothing here is ever updated,
 * invalidated, or versioned. Changing the voice or the dictionary changes the
 * names, the old files stop being asked for, and deleting them is housekeeping
 * rather than correctness.
 *
 * Two roots. The writable cache is where synthesis lands; the static root is
 * whatever `npm run speech` generated, mounted read-only. Lookups try both, so
 * a deployment that ships pre-generated audio never synthesises those phrases
 * even once.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { config } from './config.mjs'
import { assetPath } from '../src/lib/tts/cacheKey.ts'

/** Requests for a clip that is currently being made, keyed by file name. */
const inflight = new Map()

const cachePathFor = (key, format) => path.join(config.cacheDir, assetPath(key, format))
const staticPathFor = (key, format) => path.join(config.staticDir, assetPath(key, format))

/**
 * Read a clip, from either root.
 *
 * Returns `null` for a miss. A read that fails for any other reason is also a
 * miss: the clip can always be made again, and a corrupt cache entry must not
 * be able to take the voice down with it.
 */
export async function read(key, format) {
  for (const file of [cachePathFor(key, format), staticPathFor(key, format)]) {
    try {
      const bytes = await fs.readFile(file)
      if (bytes.length > 0) return bytes
    } catch {
      /* Miss. */
    }
  }
  return null
}

/**
 * Write a clip.
 *
 * Through a temporary file and a rename, because a half-written clip that
 * happens to have the right name is the one failure content addressing cannot
 * protect anybody from — every later lookup would find it and trust it.
 * `rename` within a filesystem is atomic, so a reader sees either nothing or
 * the whole file.
 */
export async function write(key, format, bytes) {
  const file = cachePathFor(key, format)
  await fs.mkdir(path.dirname(file), { recursive: true })
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`
  try {
    await fs.writeFile(temporary, bytes)
    await fs.rename(temporary, file)
  } catch (error) {
    await fs.rm(temporary, { force: true }).catch(() => undefined)
    throw error
  }
}

/**
 * Make a clip at most once, however many people ask at the same moment.
 *
 * The browser deduplicates too, and this is the other half of the same idea:
 * two phones opening the same shared loop at the same second are one
 * synthesis, and a model that takes two seconds per line stays useful with
 * several people using it.
 */
export function once(key, format, work) {
  const id = `${key}.${format}`
  const existing = inflight.get(id)
  if (existing) return existing

  const promise = work().finally(() => {
    if (inflight.get(id) === promise) inflight.delete(id)
  })
  inflight.set(id, promise)
  return promise
}

/** Clip count and total bytes, for the health route. */
export async function stats() {
  let clips = 0
  let bytes = 0
  const walk = async (directory) => {
    let entries
    try {
      entries = await fs.readdir(directory, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const full = path.join(directory, entry.name)
      if (entry.isDirectory()) {
        await walk(full)
        continue
      }
      if (!/\.(opus|mp3)$/.test(entry.name)) continue
      clips += 1
      try {
        bytes += (await fs.stat(full)).size
      } catch {
        /* Counted approximately is fine for a diagnostics route. */
      }
    }
  }
  await walk(config.cacheDir)
  return { clips, bytes }
}
