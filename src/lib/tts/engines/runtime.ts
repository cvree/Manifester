/**
 * Where the Studio Voice runtime itself comes from.
 *
 * Not the model — the *engine*: the ONNX Runtime WebAssembly that executes it.
 * This is a separate question from the weights and it has its own answer,
 * because getting it wrong is the difference between Studio Voice working and
 * Studio Voice failing on every device with the same unhelpful sentence.
 *
 * ── What went wrong before ──────────────────────────────────────────────────
 *
 * `transformers.js` sets `env.backends.onnx.wasm.wasmPaths` to a jsDelivr URL
 * the moment it is imported, unasked. That single line has three consequences
 * this app cannot accept:
 *
 *  1. **It is a third-party request.** The whole argument for an on-device
 *     voice is that nothing leaves the device; fetching the engine from a CDN
 *     the person never agreed to undermines the sentence on the install card.
 *  2. **It is blocked more often than anyone expects.** Ad blockers, hardened
 *     browsers, enterprise DNS and the built-in shields in browsers like Opera
 *     GX all interfere with CDN hosts. When the request fails, ONNX Runtime
 *     reports it as "no backend available", which the app rendered as
 *     "this device could not start the voice engine" — a memory problem, which
 *     it was not, and which no amount of closing tabs would fix.
 *  3. **It breaks the offline promise.** "Works offline after setup" cannot be
 *     true when the engine is re-fetched from someone else's server.
 *
 * Meanwhile the build already contains the exact runtime: Vite resolves the
 * `.wasm` that ONNX Runtime references and emits it into `assets/` next to
 * everything else. It was sitting there unused.
 *
 * ── What happens now ────────────────────────────────────────────────────────
 *
 * `wasmPaths` is cleared, which is what makes ONNX Runtime use the copy that
 * was bundled beside the worker — same origin, same cache, same service
 * worker, no third party. The CDN remains as a *second* attempt and nothing
 * more: if the bundled runtime will not start on some device for a reason we
 * cannot see from here, the page re-runs the install in a fresh worker with
 * the CDN path, because a fallback that costs one retry is better than a
 * feature that is simply unavailable.
 */

/** Which copy of the ONNX Runtime a bring-up attempt should use. */
export type StudioRuntime =
  /** The one bundled into this build. Same origin, offline, private. */
  | 'bundled'
  /** jsDelivr, as a last resort when the bundled one will not start. */
  | 'cdn'

/**
 * The order attempts are made in, and it is not negotiable.
 *
 * Bundled first, always. The CDN attempt exists so that a device the bundled
 * runtime cannot satisfy still gets a voice, not so that anyone's first
 * install reaches for a third party.
 */
export const RUNTIME_ORDER: StudioRuntime[] = ['bundled', 'cdn']

/** Which processor to run the model on. */
export type StudioDevice = 'webgpu' | 'wasm'

export interface Attempt {
  runtime: StudioRuntime
  device: StudioDevice
}

/**
 * Every way this app is willing to try to bring the voice up, in order.
 *
 * ── Why this is a list and not a loop inside the worker ─────────────────────
 *
 * Because ONNX Runtime initialises its WebAssembly exactly once per thread and
 * refuses for ever afterwards — a second attempt in a worker where the first
 * one failed throws an error about the first one. The old code looped WebGPU
 * then WASM inside a single worker, which meant the CPU fallback was
 * guaranteed to fail *precisely when it was needed*, and every such device
 * ended up reading "this device could not start the voice engine".
 *
 * So each entry here gets a worker of its own, torn down before the next one
 * starts. Nothing is re-downloaded between them: the weights are in the
 * browser's cache after the first attempt, so a second or third costs a few
 * seconds rather than another eighty-six megabytes.
 *
 * ── Why WebGPU is tried at all ──────────────────────────────────────────────
 *
 * When it works it is several times faster, and on a phone that is the
 * difference between a line arriving before somebody gives up on it and after.
 * When it does not work it fails at the first inference rather than silently,
 * because the worker speaks one word before reporting ready — and the CPU
 * attempt behind it is now a real fallback rather than a broken one.
 */
export function attemptsFor(webGpu: boolean): Attempt[] {
  const attempts: Attempt[] = []
  if (webGpu) attempts.push({ runtime: 'bundled', device: 'webgpu' })
  attempts.push({ runtime: 'bundled', device: 'wasm' })
  // And only then somebody else's server, for a device the bundled runtime
  // could not satisfy at all.
  attempts.push({ runtime: 'cdn', device: 'wasm' })
  return attempts
}

/**
 * The version of `@huggingface/transformers` whose `dist/` carries a matching
 * ONNX Runtime build.
 *
 * Stated here rather than read from the package, because the fallback URL has
 * to name a version that actually exists on the CDN — and because a mismatch
 * between the glue script and the binary beside it is a class of failure that
 * is very hard to read from the error it produces.
 */
const CDN_TRANSFORMERS_VERSION = '3.8.1'

export const CDN_WASM_PATH = `https://cdn.jsdelivr.net/npm/@huggingface/transformers@${CDN_TRANSFORMERS_VERSION}/dist/`

/**
 * Whether a failure is worth a second attempt against the other runtime.
 *
 * `storage` is not: a device with no room has no room whichever copy of the
 * engine is used, and re-downloading to prove it would be rude. `cancelled`
 * and `not-cached` are not failures at all.
 */
export function worthRetryingElsewhere(reason: string | null): boolean {
  return reason === 'unsupported' || reason === 'download' || reason === 'runtime'
}
