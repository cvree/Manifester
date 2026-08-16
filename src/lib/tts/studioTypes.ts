/**
 * The conversation between the page and the model running beside it.
 *
 * Its own file because both ends need it and neither should import the other:
 * the worker must never pull in React, and the page must never pull in
 * `kokoro-js`, which is the entire point of putting the model in a worker.
 */

/** Which backend the worker managed to bring up. */
export type StudioBackend = 'webgpu' | 'wasm'

/** Sent from the page to the worker. */
export type StudioRequest =
  /** Bring the model up. Downloads it the first time, and only when asked. */
  | { type: 'install'; backend: StudioBackend }
  /**
   * Bring the model up *only* if every file is already in the browser cache.
   *
   * The difference between this and `install` is the whole "no surprise
   * downloads" promise: this one refuses rather than fetching ninety
   * megabytes, so a returning visitor gets their voice back automatically and
   * a new one is never charged for a decision they did not make.
   */
  | { type: 'resume'; backend: StudioBackend }
  | { type: 'synthesize'; id: number; text: string; voice: string; speed: number }
  /** Abandon a synthesis whose answer is no longer wanted. */
  | { type: 'cancel'; id: number }
  /** Drop the session and free the graph. */
  | { type: 'release' }

/** Sent from the worker back to the page. */
export type StudioResponse =
  | { type: 'progress'; loaded: number; total: number; file: string | null }
  | { type: 'ready'; backend: StudioBackend }
  | { type: 'failed'; reason: StudioFailure; message: string }
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
  /** The graph would not build, or the first inference threw. */
  | 'unsupported'
  /** Somebody pressed Cancel. */
  | 'cancelled'
