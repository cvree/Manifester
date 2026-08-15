/**
 * Which encoding this browser should be sent.
 *
 * Ogg Opus is the one worth having: a spoken line at 24 kHz mono lands around
 * 40–48 kbps and sounds like the original, which is roughly a third of the
 * MP3 of the same clip. Safari is the reason there is a choice at all — it has
 * never shipped the Ogg container, so an iPhone gets MP3 and the audio budget
 * of an iPhone is simply larger.
 *
 * Detection happens twice, on purpose.
 *
 *  - `canPlayType` is asked first, because it is free and it is right nearly
 *    always.
 *  - `decodeAudioData` is what actually has to work, and it is a different
 *    code path in the browser from the media element `canPlayType` describes.
 *    So a decode failure is not treated as a failed clip: it is treated as
 *    this browser telling us, late, that it cannot do Opus. The answer is
 *    remembered, the same clip is fetched as MP3, and the person hears a
 *    slightly slower first line and nothing else.
 */

import { readLocal, writeLocal } from '../storage'
import type { AudioFormat } from './types'

/** All formats the app can produce, best first. */
export const FORMATS: AudioFormat[] = ['opus', 'mp3']

const MIME: Record<AudioFormat, string> = {
  opus: 'audio/ogg; codecs=opus',
  mp3: 'audio/mpeg',
}

/** Where a browser's own verdict on Opus is remembered between visits. */
const OPUS_FLAG_KEY = 'tts.opus'

let cached: AudioFormat | null = null

/**
 * `true` when this browser has previously failed to decode Opus.
 *
 * Stored rather than re-derived because the failure only shows up when a clip
 * is decoded, and paying for that discovery once per visit would mean one
 * wasted download every time the app is opened.
 */
function opusKnownBad(): boolean {
  return readLocal(OPUS_FLAG_KEY) === 'unplayable'
}

function canPlay(format: AudioFormat): boolean {
  if (typeof document === 'undefined') return format === 'mp3'
  try {
    const probe = document.createElement('audio')
    return probe.canPlayType(MIME[format]) !== ''
  } catch {
    return format === 'mp3'
  }
}

/**
 * The format to ask for.
 *
 * MP3 is the floor rather than a preference: every browser that can decode
 * audio at all decodes MP3, so a wrong guess about Opus costs a little
 * bandwidth, and a wrong guess in the other direction would cost silence.
 */
export function preferredFormat(): AudioFormat {
  if (cached) return cached
  cached = !opusKnownBad() && canPlay('opus') ? 'opus' : 'mp3'
  return cached
}

/**
 * Record that a format could not be decoded here, and hand back the next one
 * to try — or `null` when there is nothing left to fall back to.
 */
export function markFormatUnplayable(format: AudioFormat): AudioFormat | null {
  if (format === 'opus') {
    writeLocal(OPUS_FLAG_KEY, 'unplayable')
    cached = 'mp3'
    return 'mp3'
  }
  return null
}
