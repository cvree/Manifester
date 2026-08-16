/**
 * The vocabulary the rest of the app speaks to the voice layer in.
 *
 * Nothing here mentions Kokoro, HTTP, or Web Audio. That is deliberate and it
 * is the point of the whole directory: the app asks for `female_1` at speed
 * 0.9 and gets sound back, and which model produced it — a container in the
 * next room today, a hosted API tomorrow — is a fact about `engines/`, not
 * about the app.
 */

/**
 * A voice by role rather than by name.
 *
 * The app has always offered exactly two, and it offered them as "the best
 * feminine voice this device happens to have", which meant the same loop was a
 * different person on a phone, a laptop and a tablet. A logical name is the fix
 * for that: `female_1` is one specific voice everywhere, and the engine is the
 * only thing that needs to know which one.
 */
export type LogicalVoice = 'female_1' | 'male_1'

/**
 * The encodings a clip can arrive in. See `formats.ts`.
 *
 * `opus` and `mp3` are what gets shipped and fetched — one small, one
 * universal. `wav` is never downloaded and never pre-generated: it is what the
 * on-device model produces, wrapped in the cheapest container that every
 * browser decodes, and it exists as a format only so that locally synthesised
 * audio can travel through the same caches as everything else.
 */
export type AudioFormat = 'opus' | 'mp3' | 'wav'

/** Everything that decides what a clip sounds like. */
export interface SpeechRequest {
  /** As written by the person, before any pronunciation rules are applied. */
  text: string
  voice: LogicalVoice
  /** 0.5–2.0, where 1 is the voice's own pace. */
  speed: number
  /** BCP-47-ish, lower-cased. `DEFAULT_LANGUAGE` unless stated. */
  language: string
}

/** How a new request should treat speech that is already happening. */
export type SpeakPriority =
  /** Stop whatever is speaking and say this instead. The default. */
  | 'interrupt'
  /** Wait for the current clip, then say this. */
  | 'queue'
  /** If something is already speaking, do nothing. */
  | 'drop'

/** What a caller is willing to accept from the caches. */
export type CacheMode =
  /** Memory → browser → static → server → synthesis. The default. */
  | 'default'
  /** Skip every cache and synthesise again, then store the result. */
  | 'reload'
  /** Read caches, but do not write to them. */
  | 'no-store'

export interface SpeakOptions {
  voice?: LogicalVoice
  /** 0.5–2.0. Clamped, and rounded to two places before it reaches a key. */
  speed?: number
  language?: string
  priority?: SpeakPriority
  /** 0–1, applied by this app's own gain node rather than by the engine. */
  volume?: number
  cache?: CacheMode
  /**
   * Let `speechSynthesis` have the line when the engine cannot be reached.
   * True everywhere except where a fallback would be worse than silence —
   * see `preload`, which never speaks anything.
   */
  allowFallback?: boolean
  /** Cancels the request, whether it is fetching, decoding or speaking. */
  signal?: AbortSignal
  /** Fired when the first sample actually reaches the speakers. */
  onStart?: () => void
  /** Fired when the clip finishes, is interrupted, or fails. */
  onEnd?: (outcome: SpeakOutcome) => void
}

/** How a `speak()` ended. Callers use this to advance a loop honestly. */
export type SpeakOutcome =
  | 'finished'
  | 'interrupted'
  | 'dropped'
  | 'failed'

/** Where a clip came from, for diagnostics and tests. */
export type ClipSource =
  | 'memory'
  | 'browser-cache'
  | 'static'
  | 'server-cache'
  | 'engine'

/** Audio, and the story of how it was obtained. */
export interface Clip {
  key: string
  format: AudioFormat
  bytes: ArrayBuffer
  source: ClipSource
  /** Seconds, once something has decoded it. */
  durationSeconds?: number
}

/* ── Engines ─────────────────────────────────────────────────── */

/**
 * What an engine says about itself, before it is asked to do anything.
 *
 * The client reads this to build cache keys and to decide whether it may send
 * phonemes, so a new engine is a new descriptor and a new `synthesize`, and no
 * changes anywhere else.
 */
export interface EngineDescriptor {
  /** Stable, lower-case, e.g. `kokoro`. Appears in diagnostics only. */
  id: string
  /**
   * Changes whenever the same text would come back sounding different: a new
   * checkpoint, a new engine, a different backend. Part of every cache key.
   */
  modelVersion: string
  /** True when the engine accepts IPA overrides in its input. */
  supportsPhonemes: boolean
  /** Encodings the engine can return, best first. */
  formats: AudioFormat[]
}

/** A synthesis request, after normalisation and after the key is known. */
export interface EngineRequest {
  /** The text to speak, with pronunciation rules already applied. */
  text: string
  voice: LogicalVoice
  speed: number
  language: string
  format: AudioFormat
  /** The content address this will be stored under. */
  key: string
  /** Skip the server's own cache and synthesise again. */
  reload?: boolean
}

export interface EngineResult {
  bytes: ArrayBuffer
  format: AudioFormat
  /** `server-cache` when the backend already had the file. */
  source: Extract<ClipSource, 'server-cache' | 'engine'>
}

/**
 * The seam the whole app is built around.
 *
 * Two methods and a descriptor. `lookup` is the cheap question — "do you
 * already have this?" — and is allowed to fail fast; `synthesize` is the
 * expensive one and is allowed to take seconds.
 */
export interface TTSEngine {
  readonly descriptor: EngineDescriptor
  /**
   * Fetch a clip the engine has already made, by key. Resolves `null` when it
   * has not — never throws for a plain miss.
   */
  lookup(request: EngineRequest, signal?: AbortSignal): Promise<EngineResult | null>
  /** Make the clip. Throws when the engine cannot be reached. */
  synthesize(request: EngineRequest, signal?: AbortSignal): Promise<EngineResult>
  /** A cheap health check, used to decide whether to bother trying. */
  probe(signal?: AbortSignal): Promise<boolean>
}
