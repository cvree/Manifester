import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * Manifester ships to GitHub Pages at https://<owner>.github.io/Manifester/
 * so every asset URL has to be prefixed with the repository sub-path.
 *
 * Override with `MANIFESTER_BASE=/ npm run build` when deploying to a root
 * domain (e.g. a custom domain or Netlify).
 */
const base = process.env.MANIFESTER_BASE ?? '/Manifester/'

const THEME_COLOR = '#EFE7DC'
const BACKGROUND_COLOR = '#F7F1E8'

/**
 * Where the speech API is, while developing.
 *
 * `docker compose up` puts it on 8787, and the dev server proxies to it so
 * that the browser only ever sees a same-origin `/api/tts` — the same path it
 * will see in production, so there is no CORS in development that does not
 * exist later, and no configuration difference to forget about.
 */
const ttsTarget = process.env.TTS_PROXY_TARGET ?? 'http://127.0.0.1:8787'

/**
 * Everything that only exists to run Studio Voice.
 *
 * One list, used twice below: these files are kept *out* of the offline bundle
 * every visitor downloads, and cached the first time somebody actually presses
 * Install. They are twenty-four megabytes together — the worker, `kokoro-js`,
 * `transformers.js`, ONNX Runtime and espeak-ng — for a feature that promises
 * to download nothing until it is asked for.
 *
 * Written as one pattern so the two rules cannot drift apart. They did once,
 * silently, when the worker stopped being a single flattened bundle and the
 * ignore list still named only the file it used to be.
 */
const STUDIO_VOICE_CHUNK =
  /(?:kokoro[.-]|transformers|phonemizer-|ort-wasm)[^/]*\.(?:js|mjs|wasm)$/

/** The real `phonemizer`, as a path on disk rather than as a module. */
const PHONEMIZER_ENTRY = fileURLToPath(import.meta.resolve('phonemizer'))

/** What `src/lib/tts/engines/phonemizer.ts` imports to find the asset. */
const PHONEMIZER_URL_ID = 'virtual:phonemizer-runtime'

/**
 * Ship espeak-ng exactly as its author compiled it.
 *
 * `phonemizer` is a WebAssembly build of espeak-ng translated back into
 * JavaScript, and Rolldown — the bundler `vite build` uses — miscompiles it:
 * it deletes `continue` statements that end a labelled block inside a loop,
 * which is a pattern no human writes and a compiler emits constantly. Eleven
 * of them vanished, `printf` stopped concatenating, espeak looked for its
 * pronunciation data in the wrong directory, and Studio Voice failed on every
 * device with `Invalid language identifier: "en-us"` — at the very end of a
 * ninety-megabyte install, three times over as the fallbacks each tried again.
 * `src/lib/tts/engines/phonemizer.ts` has the long version.
 *
 * So the file is never parsed. It is emitted as an asset, copied byte for byte
 * with a content hash in its name, and this module hands back its URL for the
 * worker to `import()` at runtime. The alias below is what puts that module in
 * the path of `kokoro-js`, which asks for `phonemizer` by name and has no idea
 * any of this is happening.
 *
 * Only the build needs it. `vite dev` transforms with esbuild, which leaves the
 * code alone, so in development the URL simply points at the file on disk.
 */
function phonemizerRuntime(): Plugin {
  const resolved = `\0${PHONEMIZER_URL_ID}`
  let serving = false

  return {
    name: 'manifester:phonemizer-runtime',
    configResolved(config) {
      serving = config.command === 'serve'
    },
    resolveId(id) {
      return id === PHONEMIZER_URL_ID ? resolved : undefined
    },
    load(id) {
      if (id !== resolved) return undefined

      if (serving) {
        // Vite's own escape hatch for a file outside the project root.
        return `export default ${JSON.stringify(`${base}@fs${PHONEMIZER_ENTRY}`)}\n`
      }

      const source = readFileSync(PHONEMIZER_ENTRY, 'utf8')
      /*
       * The name is spelled out rather than left to the asset pipeline, which
       * renames a `.js` asset to `.cjs` to keep it from being mistaken for a
       * chunk. That rename is fatal here: this file is loaded with `import()`,
       * and a static host that does not serve `.cjs` as JavaScript makes the
       * browser refuse it outright.
       */
      const digest = createHash('sha256').update(source).digest('hex').slice(0, 8)
      const reference = this.emitFile({
        type: 'asset',
        fileName: `assets/phonemizer-${digest}.js`,
        source,
      })
      return `export default import.meta.ROLLUP_FILE_URL_${reference}\n`
    },
  }
}

export default defineConfig({
  base,
  resolve: {
    alias: [
      /*
       * Exactly `phonemizer`, and a regular expression because a plain string
       * would also capture every path underneath it — including the one the
       * plugin above resolves.
       */
      {
        find: /^phonemizer$/,
        replacement: fileURLToPath(
          new URL('./src/lib/tts/engines/phonemizer.ts', import.meta.url),
        ),
      },
    ],
  },
  server: {
    proxy: {
      '/api/tts': {
        target: ttsTarget,
        changeOrigin: true,
      },
    },
  },
  /*
   * The worker gets its own bundle, and therefore its own copy of the plugin.
   * It is also the only place `phonemizer` is ever reached from — `kokoro-js`
   * runs nowhere else — so leaving this out means the fix does not exist.
   */
  worker: {
    /*
     * A real module, which is what the page already asks for.
     *
     * `defaultWorker()` has always created this with `{ type: 'module' }`, but
     * the bundle behind it defaulted to an IIFE — and an IIFE has no
     * `import.meta`, so the URL of the espeak asset resolved against
     * `undefined` and the worker threw before it could speak. Saying `es` here
     * makes the output match the declaration.
     *
     * It also makes a promise this file already made come true. `kokoro-js` and
     * ONNX Runtime are behind a dynamic import precisely so that nobody who
     * never turns Studio Voice on downloads them; flattened into an IIFE they
     * were in the worker chunk regardless, and the split only exists now.
     */
    format: 'es',
    plugins: () => [phonemizerRuntime()],
  },
  plugins: [
    phonemizerRuntime(),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.svg',
        'apple-touch-icon.png',
        'icons/icon-180.png',
        'icons/maskable-512.png',
      ],
      manifest: {
        id: base,
        name: 'Manifester — calm affirmation loops',
        short_name: 'Manifester',
        description:
          'Paste an intention, choose a voice, and let it loop over gentle ambient sound. Everything stays on your device.',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        theme_color: THEME_COLOR,
        background_color: BACKGROUND_COLOR,
        lang: 'en',
        dir: 'ltr',
        categories: ['lifestyle', 'health', 'productivity'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        /*
         * Pre-generated speech is cached when it is heard, not when the app is
         * installed. There can be hundreds of clips in two encodings, and
         * precaching all of them would turn a fast install into a several
         * megabyte one to prepare for lines most people will never choose.
         *
         * `CacheFirst` with no expiry is exactly right for these and would be
         * wrong for nearly anything else: the file name is a hash of the audio
         * inside it, so a cached clip cannot become stale — only unwanted, and
         * the entry limit is what eventually clears those out.
         */
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              url.pathname.includes('/speech/') &&
              /\.(opus|mp3)$/.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'manifester-speech',
              expiration: { maxEntries: 400 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          /*
           * The soundtrack.
           *
           * Eleven megabytes across five pieces, and deliberately not in the
           * offline bundle: precaching them would more than double what every
           * visitor downloads for a layer that is switched off entirely for
           * anybody on a metered connection, and most visits never reach more
           * than two of the five. So each piece is cached the first time it is
           * actually heard, and from then on it costs nothing — which is what
           * makes a crossfade between two scenes instant on the second visit
           * and offline afterwards.
           *
           * `CacheFirst` with no expiry is right here for the same reason it
           * is right for the speech clips: these files never change without
           * changing name. The entry limit is a fence rather than a policy —
           * there are five of them.
           */
          {
            urlPattern: ({ url, sameOrigin }) =>
              sameOrigin &&
              url.pathname.includes('/music/') &&
              url.pathname.endsWith('.mp3'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'manifester-music',
              expiration: { maxEntries: 12 },
              // Range requests: a media fetch can be partial, and a 206 that is
              // cached as if it were the whole file is a track that plays the
              // first two seconds forever.
              cacheableResponse: { statuses: [0, 200] },
              rangeRequests: true,
            },
          },
          /*
           * The Studio Voice runtime: the worker bundle and the ONNX
           * WebAssembly it loads. Together they are far too large to precache
           * for the majority who never install the model, and far too
           * important to leave uncached for the minority who do — "works
           * offline after setup" is a promise the model files alone cannot
           * keep, because without these two nothing can load them.
           *
           * So they are cached the first time the worker starts, which is the
           * first time somebody presses Install. Content-hashed names, so
           * `CacheFirst` with no expiry is safe for the same reason it is safe
           * for the speech clips above.
           */
          {
            /*
             * Same origin only, and the `sameOrigin` guard is not tidiness.
             *
             * `CacheFirst` with `statuses: [0, 200]` is right for our own
             * content-hashed assets and is a trap for anybody else's: a status
             * of 0 is an opaque response, which is what a cross-origin fetch
             * produces whether it succeeded or was blocked, and caching one of
             * those first-and-for-ever would freeze a failure in place with no
             * way to tell it from a success. The CDN copy of the runtime is a
             * fallback for a device the bundled one could not satisfy; it needs
             * the network the first time regardless, and the browser's own HTTP
             * cache is the right thing to keep it in.
             */
            urlPattern: ({ url, sameOrigin }) =>
              sameOrigin && STUDIO_VOICE_CHUNK.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'manifester-studio-voice',
              expiration: { maxEntries: 16 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
        /*
         * The three AI provider SDKs are deliberately left out of the offline
         * bundle. They are ~660 KB together — nearly doubling the install —
         * and they are useless without a network anyway, since all they do is
         * make an HTTPS request. Precaching them would tax every person who
         * never turns the feature on, which is the default.
         *
         * They stay in `dist` and load on demand the first time someone opens
         * the AI panel; the browser caches them normally from there.
         */
        /*
         * Two things stay out of the offline bundle, for the same reason.
         *
         * The AI provider SDK is ~360 KB and useless without a network, so
         * precaching it taxes everybody who never turns the feature on — which
         * is the default.
         *
         * The Studio Voice worker is 2.2 MB, and espeak-ng beside it is another
         * 1.3 MB, and the model they load is ninety. Precaching any of that
         * would mean every visitor downloads the runtime for a feature that
         * explicitly promises to download nothing until they press Install —
         * which would make the promise false in the only way that matters. All
         * three are runtime-cached instead, above.
         */
        globIgnores: [
          '**/ai-provider-*.js',
          '**/kokoro.worker-*.js',
          '**/kokoro-*.js',
          '**/transformers*.js',
          '**/phonemizer-*.js',
        ],
        navigateFallback: `${base}index.html`,
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  build: {
    target: 'es2022',
    sourcemap: false,
    rollupOptions: {
      output: {
        /*
         * Give the provider SDK a predictable chunk name so the service
         * worker can be told to skip it. Left to itself the bundler names it
         * after the package's entry file — `web-*` — which is both
         * unrecognisable and too generic to write an ignore rule against.
         *
         * `@google` is the only one now; the pattern stays an alternation so
         * that adding a provider back is a word rather than a rewrite.
         */
        manualChunks(id: string) {
          if (/node_modules[\\/](@google)[\\/]/.test(id)) {
            return 'ai-provider'
          }
          return undefined
        },
      },
    },
  },
})
