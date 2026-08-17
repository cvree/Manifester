/**
 * The conversation between the page and the model running beside it.
 *
 * Its own file because both ends need it and neither should import the other:
 * the worker must never pull in React, and the page must never pull in
 * `kokoro-js`, which is the entire point of putting the model in a worker.
 */

/** Which backend the worker managed to bring up. */
export type StudioBackend = 'webgpu' | 'wasm'

/**
 * Which copy of the ONNX Runtime to execute the model with.
 *
 * See `engines/runtime.ts`. It is part of the request rather than a constant
 * because ONNX Runtime can only be initialised once per worker — so trying the
 * other one means a new worker, which means the page has to be able to say
 * which one it wants.
 */
export type StudioRuntimeChoice = 'bundled' | 'cdn'

/** Sent from the page to the worker. */
export type StudioRequest =
  /** Bring the model up. Downloads it the first time, and only when asked. */
  | { type: 'install'; backend: StudioBackend; runtime: StudioRuntimeChoice }
  /**
   * Bring the model up *only* if every file is already in the browser cache.
   *
   * The difference between this and `install` is the whole "no surprise
   * downloads" promise: this one refuses rather than fetching ninety
   * megabytes, so a returning visitor gets their voice back automatically and
   * a new one is never charged for a decision they did not make.
   */
  | { type: 'resume'; backend: StudioBackend; runtime: StudioRuntimeChoice }
  | { type: 'synthesize'; id: number; text: string; voice: string; speed: number }
  /** Abandon a synthesis whose answer is no longer wanted. */
  | { type: 'cancel'; id: number }
  /**
   * Throw away every stored byte of the model.
   *
   * The way out of a copy that will not load. Nothing else in the app can
   * reach the caches `transformers.js` and `kokoro-js` keep — they are keyed by
   * Hugging Face URLs and live in the worker's half of the origin — so without
   * this a device that cached a damaged download had no way back at all: every
   * retry read the same bad bytes and produced the same error for ever.
   */
  | { type: 'purge' }
  /** Drop the session and free the graph. */
  | { type: 'release' }

/**
 * Which part of a bring-up is currently happening.
 *
 * Exists because of one specific bug and one specific dishonesty, and they are
 * the same fact seen from two sides.
 *
 * The bug: the page gives up on an install that has gone quiet, which is right
 * for a download and catastrophically wrong for everything after it. The last
 * byte of an 86 MB model arriving is followed by the runtime building the
 * graph and then speaking one word to prove it can — a minute or more on a
 * phone with one WebAssembly thread, during which nothing at all is reported.
 * A watchdog that cannot tell that apart from a dead connection kills working
 * installs at exactly the moment they are about to succeed.
 *
 * The dishonesty: during that same minute the bar sits at 100% and the screen
 * says "Preparing Studio Voice…", which reads as frozen. Saying which of the
 * three things is going on costs nothing and is true.
 */
export type StudioStage =
  /** The worker is up; nothing has been asked of the network yet. */
  | 'starting'
  /** Fetching the model files. Bytes should be arriving. */
  | 'downloading'
  /** Every file is in. The runtime is building the graph. Silent, and long. */
  | 'preparing'
  /** Saying one word, to find out whether this device can. */
  | 'warming'

/** Sent from the worker back to the page. */
export type StudioResponse =
  | { type: 'progress'; loaded: number; total: number; file: string | null }
  /** Which part of the bring-up is under way. See `StudioStage`. */
  | { type: 'stage'; stage: StudioStage }
  | { type: 'ready'; backend: StudioBackend }
  | { type: 'failed'; reason: StudioFailure; message: string }
  /** Every stored byte of the model is gone. */
  | { type: 'purged' }
  | {
      type: 'audio'
      id: number
      /** Mono float samples. Transferred, never copied. */
      samples: Float32Array
      sampleRate: number
    }
  | { type: 'error'; id: number; message: string }

/**
 * Why the studio voice could not be had.
 *
 * Separate from the message because each one has a different honest thing to
 * say on screen, and because two of them are not failures at all: `not-cached`
 * is the ordinary state of a visitor who has never installed it, and
 * `cancelled` is somebody changing their mind.
 */
export type StudioFailure =
  /** `resume` was asked for and the files are not downloaded. Not an error. */
  | 'not-cached'
  /** The download did not finish: offline, a closed tab, a tunnel. */
  | 'download'
  /** No room. Safari's private mode and a full phone both land here. */
  | 'storage'
  /**
   * The engine itself would not load.
   *
   * Distinct from `unsupported`, and the distinction was expensive to learn:
   * a WebAssembly runtime that could not be *fetched* is a network or blocking
   * problem with a different remedy from a device that genuinely cannot run
   * the graph, and telling somebody to close tabs when an ad blocker ate the
   * runtime is advice that can never work. See `engines/runtime.ts`.
   */
  | 'runtime'
  /** The graph would not build, or the first inference threw. */
  | 'unsupported'
  /**
   * The model ran, and what came back was not speech.
   *
   * The failure that has no exception attached to it, and therefore the one
   * that used to reach people instead of being caught: a backend that executes
   * this graph happily and returns corrupted samples. Nothing throws, the
   * install reports success, and the only symptom is that a person's own words
   * come back as noise — while the pre-generated affirmations carry on sounding
   * perfect, because they are static files that never touched the model. It is
   * its own reason because the answer to it is a different engine rather than
   * more memory, a better connection or another try at the same thing.
   */
  | 'garbled'
  /**
   * The stored copy of the model is damaged, and has been thrown away.
   *
   * Its own reason because it is the only failure that *fixes itself by
   * happening*. A truncated response that reached the cache as a complete one
   * — a proxy that cut a connection, a disk that filled mid-write — will not
   * parse, and will not parse on the next attempt either, because the next
   * attempt reads the same bytes. Every retry produced the same error and no
   * button anywhere could clear it. Now the bad copy is deleted at the moment
   * it is found, so the next press is a genuinely fresh download.
   */
  | 'corrupt'
  /** Nothing arrived for long enough that waiting further is not honest. */
  | 'timeout'
  /** Somebody pressed Cancel. */
  | 'cancelled'
