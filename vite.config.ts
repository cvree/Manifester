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

export default defineConfig({
  base,
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
  },
})
