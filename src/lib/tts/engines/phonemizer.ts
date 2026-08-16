/**
 * The text-to-phoneme engine, kept out of the bundler's hands.
 *
 * `kokoro-js` turns a sentence into sounds in two steps: `phonemizer` says how
 * the words are pronounced, and the model turns those phonemes into audio. The
 * first step is a compiled build of espeak-ng — a WebAssembly module translated
 * back into JavaScript, so a megabyte of machine-generated code full of the
 * `label: { … break label }` control flow a compiler emits and a person never
 * writes.
 *
 * That code cannot survive being re-bundled, and this file exists because of
 * what happened when it was.
 *
 * ── The failure this prevents ───────────────────────────────────────────────
 *
 * Rolldown, the bundler behind `vite build`, drops `continue` statements that
 * sit at the end of a labelled block inside a loop. In ordinary source that
 * pattern is vanishingly rare and removing the statement is harmless; in
 * compiled output it is everywhere, and removing it silently rewires the loop.
 * Eleven of espeak's `continue`s disappeared, one of them inside `printf`,
 * which then stopped appending anything after its first substitution. espeak
 * builds the path to its own pronunciation data with `printf`, so it looked
 * for the data in the string's first half — a directory with nothing in it —
 * found no voices, and reported:
 *
 *     Invalid language identifier: "en-us". Should be one of: .
 *
 * An empty list, because the list really was empty.
 *
 * The cost of that was the whole feature and then some. The failure happens at
 * the *last* step of installing Studio Voice — after ninety megabytes have been
 * downloaded and the graph has been built — so every person who pressed Install
 * paid the entire download three times over, once per fallback attempt, and was
 * then told their device could not run the model. It could. Nothing about the
 * device, the browser, the GPU or the network was ever involved, which is why
 * none of the advice on screen could possibly have helped.
 *
 * Development never showed it: `vite dev` transforms with esbuild, which leaves
 * the `continue`s alone. Only the built app was broken.
 *
 * ── What this does instead ──────────────────────────────────────────────────
 *
 * `vite.config.ts` points the `phonemizer` specifier at this file, and emits
 * the real package as a build asset — copied byte for byte, never parsed. This
 * module loads that asset at runtime and forwards to it.
 *
 * Both of the package's exports are already `async`, so a lazy forwarder is
 * indistinguishable from the real thing to `kokoro-js`: it awaits the module on
 * first use and every call after that is one extra `await` on a promise that
 * has already resolved.
 */

// Resolved by `phonemizerRuntime()` in `vite.config.ts` to the URL of the
// untouched package, emitted as an asset rather than compiled into a chunk.
import runtimeUrl from 'virtual:phonemizer-runtime'

type Phonemizer = typeof import('phonemizer')

let loading: Promise<Phonemizer> | null = null

/**
 * Fetch the real module, once.
 *
 * `@vite-ignore` because the URL is only known at build time and there is
 * nothing here for the bundler to follow — which is the entire point.
 */
function load(): Promise<Phonemizer> {
  loading ??= import(/* @vite-ignore */ runtimeUrl) as Promise<Phonemizer>
  return loading
}

export const phonemize: Phonemizer['phonemize'] = async (...args) =>
  (await load()).phonemize(...args)

export const list_voices: Phonemizer['list_voices'] = async (...args) =>
  (await load()).list_voices(...args)
