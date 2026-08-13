/**
 * The voice layer.
 *
 * Browser speech synthesis is quirky and inconsistent, so this module keeps all
 * of the workarounds in one place:
 *
 *  - Long text is split into short chunks. Chrome silently truncates utterances
 *    that run past ~15 seconds, and several engines choke on very long strings.
 *  - Utterances are kept referenced until they finish (Chrome garbage-collects
 *    them mid-sentence otherwise).
 *  - A watchdog nudges the queue when an `onend` event never arrives.
 *  - Every callback is guarded by a generation token so a fast stop → start tap
 *    can never let an old session resurrect itself.
 */

import { scheduleAt } from './heartbeat'

/** Longer chunks are more natural; shorter chunks are more reliable. */
const MAX_CHUNK_CHARS = 180
/** If nothing is speaking or pending for this long, assume the chunk ended. */
const STALL_TIMEOUT_MS = 2500
/** Chrome desktop stops speaking after ~15s unless nudged. */
const KEEPALIVE_INTERVAL_MS = 9000
/** How long to wait for `onstart` before assuming the engine will not send one. */
const ANNOUNCE_FALLBACK_MS = 300

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
  return (
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    'SpeechSynthesisUtterance' in window
  )
}

const isAppleMobile = (): boolean =>
  typeof navigator !== 'undefined' &&
  (/iP(hone|ad|od)/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))

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

/* ── The looping speaker ─────────────────────────────────────── */

export interface SpeechLoopOptions {
  text: string
  voiceURI: string | null
  rate: number
  pitch: number
  volume: number
  /** Silence between repetitions. */
  repeatPauseMs: number
  /** A small settling silence before the first word. */
  initialDelayMs?: number
  /** When false the text is spoken once and then finishes. */
  loop: boolean
}

export interface SpeechLoopHandlers {
  /**
   * The words that are being spoken *now*.
   *
   * Fired when the engine reports it has started this utterance, not when the
   * app queued it. The gap between those two moments is a few milliseconds for
   * a voice installed on the device and can be half a second for one that is
   * fetched over the network — long enough, on a phone, to read as the screen
   * running ahead of the voice.
   */
  onChunk?: (index: number, total: number, text: string) => void
  onCycle?: (completedCycles: number) => void
  onFinish?: () => void
  onError?: (message: string) => void
}

export class SpeechLooper {
  private generation = 0
  private chunks: string[] = []
  private index = 0
  private cycles = 0
  private options: SpeechLoopOptions | null = null
  private handlers: SpeechLoopHandlers = {}
  private voices: SpeechSynthesisVoice[] = []
  /** Held so Chrome cannot garbage-collect an utterance that is still speaking. */
  private pending = new Set<SpeechSynthesisUtterance>()
  /**
   * Cancels the silence between repetitions.
   *
   * Not a `setTimeout` id, because a `setTimeout` is not a promise about when
   * anything happens: a hidden tab clamps it to a second and can push it much
   * further than that. The gap between passes is part of the sound design — a
   * three-second rest that becomes an eleven-second rest because somebody
   * checked their email is exactly the kind of unasked-for change this pass
   * exists to remove. `scheduleAt` arms a timer *and* a heartbeat, so whichever
   * of the two the browser is still honouring is the one that fires it.
   */
  private gapCancel: (() => void) | null = null
  private stallTimer: number | null = null
  private announceTimer: number | null = null
  private resumeTimer: number | null = null
  private keepAlive: number | null = null
  private running = false
  private paused = false
  /** When the current silence is due to end. */
  private gapEndsAt = 0
  /** Initial settling silence is deliberately not shown as a repeat delay. */
  private gapVisible = true
  /** Milliseconds of silence still owed, when paused during that gap. */
  private pausedGapMs: number | null = null
  private pausedGapVisible = true

  get isRunning(): boolean {
    return this.running
  }

  get chunkCount(): number {
    return this.chunks.length
  }

  /**
   * Seconds left in the silence between repetitions, or `null` when words are
   * actually being spoken. Drives the countdown on the Player.
   */
  get delayRemainingSeconds(): number | null {
    if (!this.running) return null
    if (this.pausedGapMs != null) {
      return this.pausedGapVisible ? this.pausedGapMs / 1000 : null
    }
    if (this.gapCancel != null && this.gapEndsAt > 0) {
      return this.gapVisible
        ? Math.max(0, (this.gapEndsAt - Date.now()) / 1000)
        : null
    }
    return null
  }

  setVoices(voices: SpeechSynthesisVoice[]): void {
    this.voices = voices
  }

  /** Live-update rate/pitch/volume; takes effect on the next chunk. */
  updateOptions(patch: Partial<SpeechLoopOptions>): void {
    if (this.options) this.options = { ...this.options, ...patch }
  }

  start(options: SpeechLoopOptions, handlers: SpeechLoopHandlers = {}): boolean {
    if (!isSpeechSupported()) {
      handlers.onError?.(
        'This browser cannot read text aloud. Try Safari on iPhone, or Chrome on Android and desktop.',
      )
      return false
    }

    this.stop()

    const chunks = chunkText(options.text)
    if (chunks.length === 0) {
      handlers.onError?.('Add some words first, then press play.')
      return false
    }

    this.generation += 1
    this.chunks = chunks
    this.index = 0
    this.cycles = 0
    this.options = options
    this.handlers = handlers
    this.running = true
    this.paused = false

    this.startKeepAlive()
    const initialDelay = Math.max(0, options.initialDelayMs ?? 0)
    if (initialDelay > 0) this.startGap(this.generation, initialDelay, false)
    else this.speakCurrent(this.generation)
    return true
  }

  pause(): void {
    if (!this.running || this.paused || !isSpeechSupported()) return
    this.paused = true

    if (this.gapCancel != null) {
      this.pausedGapMs = Math.max(0, this.gapEndsAt - Date.now())
      this.pausedGapVisible = this.gapVisible
    }

    // Invalidate every callback from the utterance being cancelled. Resuming
    // deliberately restarts the current line, which is safer than skipping it
    // or trusting browser-specific suspended queue behaviour.
    this.generation += 1
    this.clearGap()
    this.clearTimer('stallTimer')
    this.clearTimer('announceTimer')
    this.clearTimer('resumeTimer')
    this.stopKeepAlive()
    this.pending.clear()
    try {
      window.speechSynthesis.cancel()
    } catch {
      /* Cancelling an empty queue is allowed to throw on older engines. */
    }
  }

  /**
   * Check that the voice is still going, and start it again if it is not.
   *
   * Speech synthesis renders outside the page and outside this app's control,
   * and browsers treat a backgrounded tab's queue with a good deal of latitude:
   * Chrome has been known to drop the queue on the floor, and iOS pauses it
   * when the app goes away and does not always resume it. The stall watchdog
   * catches that while the page is visible; this is the same question asked at
   * the one other moment it is worth asking — the moment somebody comes back
   * and would otherwise be looking at a running clock over silence.
   *
   * It is careful to be a no-op in every case where something *is* happening,
   * including the deliberate silence between passes, so it can never
   * double-speak.
   */
  recover(): void {
    if (!this.running || this.paused || !isSpeechSupported()) return
    if (this.gapCancel != null || this.pausedGapMs != null) return

    const synth = window.speechSynthesis
    if (synth.speaking || synth.pending) return
    this.speakCurrent(this.generation)
  }

  resume(): void {
    if (!this.running || !this.paused || !isSpeechSupported()) return
    this.paused = false
    this.generation += 1
    const generation = this.generation
    this.startKeepAlive()

    if (this.pausedGapMs != null) {
      const remaining = this.pausedGapMs
      const visible = this.pausedGapVisible
      this.pausedGapMs = null
      this.pausedGapVisible = true
      this.startGap(generation, remaining, visible)
      return
    }

    // Give cancel() one brief turn to release the platform queue before
    // putting the current line back. This avoids the overlap several engines
    // otherwise produce on a quick pause → resume.
    this.resumeTimer = window.setTimeout(() => {
      this.resumeTimer = null
      this.speakCurrent(generation)
    }, 80)
  }

  stop(): void {
    this.generation += 1
    this.running = false
    this.paused = false
    this.pending.clear()
    this.gapEndsAt = 0
    this.gapVisible = true
    this.pausedGapMs = null
    this.pausedGapVisible = true
    this.clearGap()
    this.clearTimer('stallTimer')
    this.clearTimer('announceTimer')
    this.clearTimer('resumeTimer')
    this.stopKeepAlive()
    if (isSpeechSupported()) {
      try {
        window.speechSynthesis.cancel()
      } catch {
        /* Some engines throw when cancelling an empty queue. */
      }
    }
  }

  /* ── internals ── */

  private speakCurrent(generation: number): void {
    if (generation !== this.generation || !this.options || this.paused) return

    const synth = window.speechSynthesis
    const text = this.chunks[this.index]
    const utterance = new SpeechSynthesisUtterance(text)

    const voice =
      this.options.voiceURI != null
        ? this.voices.find((v) => v.voiceURI === this.options?.voiceURI)
        : undefined
    if (voice) {
      utterance.voice = voice
      utterance.lang = voice.lang
    }

    utterance.rate = clamp(this.options.rate, 0.1, 4)
    utterance.pitch = clamp(this.options.pitch, 0, 2)
    utterance.volume = clamp(this.options.volume, 0, LIVE_VOICE_VOLUME_CAP)

    utterance.onend = () => {
      this.pending.delete(utterance)
      if (generation !== this.generation) return
      this.clearTimer('stallTimer')
      this.advance(generation)
    }

    utterance.onerror = (event) => {
      this.pending.delete(utterance)
      if (generation !== this.generation) return
      this.clearTimer('stallTimer')
      // `interrupted` / `canceled` are what a deliberate stop looks like.
      if (event.error === 'interrupted' || event.error === 'canceled') return
      if (event.error === 'not-allowed') {
        this.handlers.onError?.(
          'This browser blocked speech until you interact with the page. Tap play again.',
        )
        this.stopFromError()
        return
      }
      // Anything else is usually transient — skip the chunk and keep going.
      this.advance(generation)
    }

    /*
     * Say what is being spoken, once, at the moment it starts.
     *
     * `onstart` is the honest signal and every current engine fires it. The
     * timer behind it is for the one that does not: better a screen that is a
     * third of a second late than a screen still showing the previous line for
     * the whole utterance.
     */
    const index = this.index
    let announced = false
    const announce = () => {
      if (announced || generation !== this.generation) return
      announced = true
      this.clearTimer('announceTimer')
      this.handlers.onChunk?.(index, this.chunks.length, text)
    }
    utterance.onstart = announce

    this.pending.add(utterance)

    try {
      synth.speak(utterance)
    } catch {
      this.handlers.onError?.('The voice engine could not start. Try again.')
      this.stopFromError()
      return
    }

    this.clearTimer('announceTimer')
    this.announceTimer = window.setTimeout(announce, ANNOUNCE_FALLBACK_MS)
    this.armStallWatchdog(generation)
  }

  private advance(generation: number): void {
    if (generation !== this.generation || !this.options || this.paused) return

    if (this.index < this.chunks.length - 1) {
      this.index += 1
      this.speakCurrent(generation)
      return
    }

    this.cycles += 1
    this.handlers.onCycle?.(this.cycles)

    if (!this.options.loop) {
      this.running = false
      this.stopKeepAlive()
      this.handlers.onFinish?.()
      return
    }

    this.index = 0
    this.startGap(generation, Math.max(0, this.options.repeatPauseMs))
  }

  /** Hold a deliberate silence, then begin again. */
  private startGap(
    generation: number,
    durationMs: number,
    visible = true,
  ): void {
    this.clearGap()
    this.gapVisible = visible
    this.gapEndsAt = Date.now() + durationMs
    this.gapCancel = scheduleAt(this.gapEndsAt, () => {
      this.gapCancel = null
      this.gapEndsAt = 0
      this.gapVisible = true
      if (!this.paused) this.speakCurrent(generation)
    })
  }

  private clearGap(): void {
    this.gapCancel?.()
    this.gapCancel = null
  }

  /**
   * If the engine drops an utterance without firing `onend`, this notices the
   * silence and moves on. It only fires when nothing is speaking or queued, so
   * it can never double-speak.
   */
  private armStallWatchdog(generation: number): void {
    this.clearTimer('stallTimer')
    const check = () => {
      if (generation !== this.generation || !this.running || this.paused) return
      const synth = window.speechSynthesis
      if (synth.speaking || synth.pending || synth.paused) {
        this.stallTimer = window.setTimeout(check, STALL_TIMEOUT_MS)
        return
      }
      this.advance(generation)
    }
    this.stallTimer = window.setTimeout(check, STALL_TIMEOUT_MS)
  }

  /**
   * Chrome on desktop stops after roughly 15 seconds of continuous speech.
   * A pause/resume pair resets its internal timer. iOS Safari behaves badly
   * with the same trick, so it is skipped there.
   */
  private startKeepAlive(): void {
    this.stopKeepAlive()
    if (isAppleMobile()) return
    this.keepAlive = window.setInterval(() => {
      const synth = window.speechSynthesis
      if (this.running && !this.paused && synth.speaking && !synth.paused) {
        synth.pause()
        synth.resume()
      }
    }, KEEPALIVE_INTERVAL_MS)
  }

  private stopKeepAlive(): void {
    if (this.keepAlive != null) {
      clearInterval(this.keepAlive)
      this.keepAlive = null
    }
  }

  private stopFromError(): void {
    const handlers = this.handlers
    this.stop()
    handlers.onFinish?.()
  }

  private clearTimer(which: 'stallTimer' | 'announceTimer' | 'resumeTimer'): void {
    const id = this[which]
    if (id != null) {
      clearTimeout(id)
      this[which] = null
    }
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
