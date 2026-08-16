import { defineConfig } from 'vite'
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

export default defineConfig({
  base,
  server: {
    proxy: {
      '/api/tts': {
        target: ttsTarget,
        changeOrigin: true,
      },
    },
  },
  plugins: [
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
              sameOrigin &&
              (/kokoro\.worker-[^/]*\.js$/.test(url.pathname) ||
                /\.wasm$/.test(url.pathname) ||
                /ort-wasm[^/]*\.mjs$/.test(url.pathname)),
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
         * The Studio Voice worker is 2.2 MB, and the model it loads is another
         * ninety. Precaching the worker would mean every visitor downloads the
         * runtime for a feature that explicitly promises to download nothing
         * until they press Install — which would make the promise false in the
         * only way that matters. It is runtime-cached instead, above.
         */
        globIgnores: ['**/ai-provider-*.js', '**/kokoro.worker-*.js'],
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
