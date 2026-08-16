/**
 * What is spoken, and by which of the device's own voices.
 *
 * This used to be the whole voice layer. It is now the two thirds of it that
 * survived the studio voice arriving: the chunker, which decides what one
 * utterance *is*, and the device voice list, which the emergency fallback
 * still needs. The looping, the timing and the recovery moved to
 * `voiceLoop.ts`, where they are shared by both voices rather than being one
 * voice's private machinery — see `tts/` for the rest.
 */

import { applyDeviceVoice, langForText } from './deviceVoice'

/** Longer chunks are more natural; shorter chunks are more reliable. */
const MAX_CHUNK_CHARS = 180

/**
 * The ceiling for the `voiceVolume` setting, and the browser's own ceiling for
 * the voice itself.
 *
 * They are deliberately the same number now. `volume` on
 * `SpeechSynthesisUtterance` is spec'd to `[0, 1]` and every browser clamps it
 * there regardless of what this app does, because speech synthesis renders
 * entirely outside the page — there is no Web Audio node to put a gain on. So a
 * setting that ran to 2 could only ever be a promise the live voice was unable
 * to keep: the slider read "200%", the readout agreed, and the voice stayed
 * exactly where it had been at 100%.
 *
 * The export path is the one place a gain above 1 would mean anything, since a
 * recorded voice really is mixed inside this app — and it already has a better
 * answer. `masterGainFor` in `exportAudio.ts` normalises the finished mix, so
 * pushing the voice past 1 there changes nothing but its *balance* against the
 * bed, which is what the Sound slider is for: `MAX_MUSIC_VOLUME` is still 2.
 * Nothing needs a voice setting above 1, so nothing offers one.
 *
 * `LIVE_VOICE_VOLUME_CAP` stays as its own name because it means something
 * different — it is the browser's limit rather than this app's choice — and it
 * is still applied to every utterance as belt and braces.
 */
export const MAX_VOICE_VOLUME = 1
export const LIVE_VOICE_VOLUME_CAP = 1

/**
 * Bring a voice level into range.
 *
 * Used on the way in from storage and on the way out of the slider, so a loop
 * saved when the ceiling was 2 comes back at 100% rather than as a value no
 * control in the app can now represent.
 */
export function clampVoiceVolume(value: number): number {
  if (!Number.isFinite(value)) return MAX_VOICE_VOLUME
  return Math.min(MAX_VOICE_VOLUME, Math.max(0, value))
}

export function isSpeechSupported(): boolean {
  /*
   * The property being *present* is not the same as it being usable.
   *
   * Privacy-hardened browsers and some embedded WebViews keep
   * `speechSynthesis` on `window` and set it to `undefined` or a stub with no
   * methods, which passes an `in` check and then throws on the first
   * `getVoices()` — during app start-up, before anything has rendered. Asking
   * for the method that is actually about to be called is the only test that
   * means anything here.
   */
  if (typeof window === 'undefined') return false
  if (typeof window.SpeechSynthesisUtterance !== 'function') return false
  const synth = window.speechSynthesis as SpeechSynthesis | undefined
  return !!synth && typeof synth.getVoices === 'function'
}

/* ── Chunking ────────────────────────────────────────────────── */

/**
 * Split text into speakable chunks — one per written line.
 *
 * A line is the unit the whole app already thinks in: it is what the editor
 * counts, what the preview lists, and what the player puts on screen. Making
 * it the unit the voice speaks too is what keeps the words on screen and the
 * words in your ears the same words.
 *
 * This used to merge lines together up to the character budget, which read
 * perfectly well as prose and was quietly wrong here: six short affirmations
 * went out as a single utterance while the player, indexing its line list by
 * the chunk number, sat on line one for all six. The screen was not lagging —
 * it was pointing at something else entirely.
 *
 * Only a line too long to speak in one go is split further, and then at
 * sentence, clause and word boundaries in that order, so the pauses still land
 * where a reader would take them.
 */
export function chunkText(text: string, maxChars = MAX_CHUNK_CHARS): string[] {
  const chunks: string[] = []

  for (const rawLine of text.replace(/\r\n/g, '\n').split('\n')) {
    const line = rawLine.trim()
    if (!line) continue
    if (line.length <= maxChars) {
      chunks.push(line)
      continue
    }
    chunks.push(...splitLongLine(line, maxChars))
  }

  return chunks
}

/** A single line longer than one utterance should be: break it up sensibly. */
function splitLongLine(line: string, maxChars: number): string[] {
  // Keep the terminating punctuation with its sentence.
  const sentences = line.match(/[^.!?…]+(?:[.!?…]+["'”’)]*|$)/g) ?? [line]

  const parts: string[] = []
  let buffer = ''
  const flush = () => {
    const value = buffer.trim()
    if (value) parts.push(value)
    buffer = ''
  }

  for (const rawSentence of sentences) {
    const sentence = rawSentence.trim()
    if (!sentence) continue

    if (sentence.length > maxChars) {
      flush()
      parts.push(...splitLongSentence(sentence, maxChars))
      continue
    }

    if ((buffer + ' ' + sentence).trim().length > maxChars) flush()
    buffer = buffer ? `${buffer} ${sentence}` : sentence
  }

  flush()
  return parts
}

/** Break a run-on sentence at commas, then at word boundaries. */
function splitLongSentence(sentence: string, maxChars: number): string[] {
  const parts: string[] = []
  let buffer = ''

  for (const clause of sentence.split(/(?<=[,;:—–])\s+/)) {
    if (clause.length > maxChars) {
      if (buffer.trim()) parts.push(buffer.trim())
      buffer = ''
      let words = ''
      for (const word of clause.split(/\s+/)) {
        if ((words + ' ' + word).trim().length > maxChars) {
          if (words.trim()) parts.push(words.trim())
          words = word
        } else {
          words = words ? `${words} ${word}` : word
        }
      }
      if (words.trim()) parts.push(words.trim())
      continue
    }

    if ((buffer + ' ' + clause).trim().length > maxChars) {
      if (buffer.trim()) parts.push(buffer.trim())
      buffer = clause
    } else {
      buffer = buffer ? `${buffer} ${clause}` : clause
    }
  }

  if (buffer.trim()) parts.push(buffer.trim())
  return parts
}

/* ── Voices ──────────────────────────────────────────────────── */

export interface VoiceOption {
  voiceURI: string
  name: string
  lang: string
  localService: boolean
  /** A best guess only — voice naming is not standardised across platforms. */
  style: 'feminine' | 'masculine' | 'unlabelled'
}

const FEMININE_HINTS = [
  'female', 'woman', 'samantha', 'karen', 'moira', 'tessa', 'fiona', 'victoria',
  'serena', 'allison', 'ava', 'susan', 'zira', 'hazel', 'catherine', 'nicky',
  'kate', 'sara', 'anna', 'amelie', 'amélie', 'joana', 'luciana', 'paulina',
  'monica', 'mónica', 'yuna', 'kyoko', 'ting-ting', 'sin-ji', 'mei-jia',
  'nora', 'satu', 'ioana', 'laura', 'alice', 'milena', 'zosia', 'linh', 'lekha',
  'zuzana', 'aria', 'jenny', 'michelle', 'sonia', 'libby', 'natasha', 'clara',
  'emma', 'olivia', 'ivy', 'joanna', 'kendra', 'kimberly', 'salli', 'amy',
]

const MASCULINE_HINTS = [
  'male', 'man', 'alex', 'daniel', 'fred', 'tom', 'aaron', 'oliver', 'rishi',
  'david', 'mark', 'nathan', 'arthur', 'george', 'james', 'ryan', 'guy',
  'thomas', 'jorge', 'diego', 'juan', 'carlos', 'xander', 'rocko', 'reed',
  'eddy', 'grandpa', 'yuri', 'otoya', 'hattori', 'lee', 'gordon', 'matthew',
  'brian', 'joey', 'justin', 'russell', 'liam', 'christopher', 'eric',
]

function guessStyle(name: string): VoiceOption['style'] {
  const lower = name.toLowerCase()
  // Check masculine first: "Google UK English Male" also contains "ale".
  if (MASCULINE_HINTS.some((hint) => lower.includes(hint))) return 'masculine'
  if (FEMININE_HINTS.some((hint) => lower.includes(hint))) return 'feminine'
  return 'unlabelled'
}

export function toVoiceOption(voice: SpeechSynthesisVoice): VoiceOption {
  return {
    voiceURI: voice.voiceURI,
    name: voice.name,
    lang: voice.lang,
    localService: voice.localService,
    style: guessStyle(voice.name),
  }
}

/**
 * Voice lists load asynchronously (and on Safari, lazily). Resolve as soon as
 * we have something, and give up gracefully after a short wait.
 */
export function loadVoices(timeoutMs = 3000): Promise<SpeechSynthesisVoice[]> {
  if (!isSpeechSupported()) return Promise.resolve([])

  const synth = window.speechSynthesis
  const immediate = synth.getVoices()
  if (immediate.length > 0) return Promise.resolve(immediate)

  return new Promise((resolve) => {
    let settled = false
    const finish = (voices: SpeechSynthesisVoice[]) => {
      if (settled) return
      settled = true
      clearInterval(poll)
      clearTimeout(bail)
      synth.removeEventListener('voiceschanged', onChange)
      resolve(voices)
    }

    const onChange = () => finish(synth.getVoices())
    synth.addEventListener('voiceschanged', onChange)

    // Safari does not always fire `voiceschanged`, so poll as well.
    const poll = setInterval(() => {
      const voices = synth.getVoices()
      if (voices.length > 0) finish(voices)
    }, 200)

    const bail = setTimeout(() => finish(synth.getVoices()), timeoutMs)
  })
}


/**
 * Speak one line in one specific device voice, right now.
 *
 * Deliberately not routed through the session's settings. Auditioning a voice
 * in a picker is a question — *what does this one sound like?* — and answering
 * it by first writing the choice into the loop, then asking the loop to
 * preview itself, means every voice somebody merely listens to becomes the
 * voice their session will use. The question and the commitment are separate
 * acts, so they use separate paths.
 *
 * It also has to be *immediate*. A picker that answers a tap half a second
 * later is a picker people stop tapping, so this goes straight at
 * `speechSynthesis` rather than through the resolver, the cache and the audio
 * graph that a real line is worth putting through.
 *
 * What it does *not* do any more is resolve the voice its own way. Speed,
 * pitch, volume, the chosen voice and — the one that was actually broken — the
 * language all come from the same place a real line's do, so what you hear when
 * you press a voice is what you will hear when you press play.
 */
export interface AuditionOptions {
  text?: string
  /** Which end of the list to fall back to when no exact voice is given. */
  style?: 'feminine' | 'masculine'
  lang?: string | null
  rate?: number
  pitch?: number
  volume?: number
}

/** What a voice says when you touch it. Short, and about the thing it is for. */
export const DEVICE_AUDITION_LINE = 'This is how your own words will sound.'

/** Close to the app's own default speaking rate, which is 0.9. */
const DEFAULT_AUDITION_RATE = 0.95

export function auditionDeviceVoice(
  voiceURI: string | null,
  options: AuditionOptions = {},
): void {
  if (!isSpeechSupported()) return
  try {
    const synth = window.speechSynthesis
    // Whatever was speaking is the previous answer to a question nobody is
    // asking any more.
    synth.cancel()

    const text = options.text?.trim() || DEVICE_AUDITION_LINE
    const utterance = new SpeechSynthesisUtterance(text)

    /*
     * The same resolver the session uses, not a second one.
     *
     * An audition that resolves its voice differently from real playback is
     * worse than no audition: it is a demonstration of a voice you will not
     * get. In particular this is where `lang` gets set — for a device whose
     * interface is not English, an utterance with no `lang` is read in the
     * interface language, so the picker used to sound wrong in exactly the way
     * the session did. See `deviceVoice.ts`.
     */
    applyDeviceVoice(utterance, synth.getVoices(), [], {
      voiceURI,
      style: options.style ?? 'feminine',
      lang: options.lang ?? langForText(text),
    })

    utterance.rate = clampRate(options.rate ?? DEFAULT_AUDITION_RATE)
    utterance.pitch = clampPitch(options.pitch ?? 1)
    utterance.volume = clampVoiceVolume(options.volume ?? 1)
    synth.speak(utterance)
  } catch {
    /* A browser that will not speak is not an error worth surfacing here. */
  }
}

function clampRate(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_AUDITION_RATE
  return Math.min(4, Math.max(0.1, value))
}

function clampPitch(value: number): number {
  if (!Number.isFinite(value)) return 1
  return Math.min(2, Math.max(0, value))
}

/** Stop any audition started by `auditionDeviceVoice`. */
export function stopDeviceAudition(): void {
  if (!isSpeechSupported()) return
  try {
    window.speechSynthesis.cancel()
  } catch {
    /* Nothing to stop. */
  }
}
