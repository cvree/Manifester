/**
 * Modules that only exist during a build.
 *
 * See `phonemizerRuntime()` in `vite.config.ts` for why this one is not a
 * normal import.
 */
declare module 'virtual:phonemizer-runtime' {
  /** Where the untouched `phonemizer` package was emitted. */
  const url: string
  export default url
}
