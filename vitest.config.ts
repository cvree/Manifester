import { defineConfig } from 'vitest/config'

/**
 * A separate config from `vite.config.ts` on purpose: the app build carries the
 * PWA plugin and a GitHub Pages base path, neither of which a test run wants.
 *
 * The audio tests render through `node-web-audio-api`, a real Web Audio
 * implementation for Node. It is a dev dependency only — nothing in the shipped
 * app imports it — and it is what makes it possible to assert the *measured*
 * frequency of a generated rhythm rather than the number we asked for.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Real offline renders of 30-second beds take a moment.
    testTimeout: 30_000,
  },
})
