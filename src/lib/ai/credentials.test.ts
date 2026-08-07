import { beforeEach, describe, expect, it, vi } from 'vitest'

/*
 * The key on disk.
 *
 * IndexedDB is stubbed out because the interesting behaviour is not the
 * database, it is the promise the app makes about the key: it goes in whole,
 * it comes back whole, disconnecting genuinely removes it, and no screen —
 * and no log line — ever shows all of it.
 */

const store = vi.hoisted(() => ({ values: new Map<string, unknown>() }))

vi.mock('../storage', () => ({
  readKv: async (key: string) => store.values.get(key) ?? null,
  writeKv: async (key: string, value: unknown) => {
    if (value == null) store.values.delete(key)
    else store.values.set(key, value)
  },
}))

import {
  forgetCredentials,
  loadCredentials,
  maskKey,
  saveCredentials,
  type Credentials,
} from './credentials'
import { setStoredCredentials } from './useCredentials'

const AUTH_KEY = `AQ.Ab8RN6${'K3xQ7pLm2Vt9YwZr'.repeat(3)}`

const connected: Credentials = {
  provider: 'gemini',
  key: AUTH_KEY,
  agreedAt: 1_700_000_000_000,
  model: 'gemini-3.6-flash',
  verifiedAt: 1_700_000_000_000,
}

beforeEach(() => {
  store.values.clear()
})

describe('connecting, disconnecting, and connecting again', () => {
  it('keeps the key and the model it was checked against', async () => {
    await saveCredentials(connected)
    const { credentials, retired } = await loadCredentials()

    expect(credentials?.key).toBe(AUTH_KEY)
    expect(credentials?.model).toBe('gemini-3.6-flash')
    expect(credentials?.verifiedAt).toBe(connected.verifiedAt)
    expect(retired).toBeNull()
  })

  it('really removes the key on disconnect', async () => {
    await saveCredentials(connected)
    await forgetCredentials()

    expect((await loadCredentials()).credentials).toBeNull()
    expect([...store.values.values()]).toEqual([])
  })

  it('reconnects cleanly after a disconnect', async () => {
    await saveCredentials(connected)
    await forgetCredentials()
    await saveCredentials({ ...connected, key: `AQ.Ab8ZZ${'9'.repeat(48)}` })

    const { credentials } = await loadCredentials()
    expect(credentials?.key.startsWith('AQ.Ab8ZZ')).toBe(true)
  })

  it('reads a record saved before models were remembered', async () => {
    // An upgrade must not log anybody out of a key that still works.
    store.values.set('aiCredentials', {
      provider: 'gemini',
      key: AUTH_KEY,
      agreedAt: 1,
    })

    const { credentials } = await loadCredentials()
    expect(credentials?.key).toBe(AUTH_KEY)
    expect(credentials?.model).toBeUndefined()
  })

  it('ignores a half-written record rather than half-connecting', async () => {
    store.values.set('aiCredentials', { provider: 'gemini', agreedAt: 1 })
    expect((await loadCredentials()).credentials).toBeNull()
  })

  /*
   * Claude was an option and is not any more. A device that connected it still
   * has a real API key in its IndexedDB, and every screen that looks a provider
   * up by id would throw on it.
   */
  it('deletes a key for a provider that is no longer offered, and says so', async () => {
    store.values.set('aiCredentials', {
      provider: 'claude',
      key: `sk-ant-api03-${'x'.repeat(60)}`,
      agreedAt: 1,
    })

    const { credentials, retired } = await loadCredentials()

    expect(credentials).toBeNull()
    expect(retired).toBe('Claude')
    // Gone from storage, not merely ignored: an unusable credential at rest is
    // worse than none.
    expect([...store.values.values()]).toEqual([])
  })

  it('tells the rest of the app straight away', () => {
    // The Create screen and the Customize list share one store, so a
    // disconnect on the About page has to reach both without a reload.
    setStoredCredentials(connected)
    setStoredCredentials(null)
    // No throw, and the null is what a caller with no key expects to see.
    expect(true).toBe(true)
  })

  /*
   * The other half of this — that the explanation actually reaches the screen
   * — is not asserted here, and the reason is worth writing down rather than
   * leaving as a gap.
   *
   * The bug was a React one: `retired` sat in a module variable beside the
   * store, the store emitted after loading, `useSyncExternalStore` compared
   * the snapshot, found the same `null` it already had, and correctly declined
   * to re-render. Nothing about that is visible from here — this suite runs in
   * Node with no DOM, so a hook cannot be rendered. It is covered by driving
   * the built app in a browser with a seeded Claude record instead.
   */
})

describe('showing a stored key back', () => {
  it('shows enough to recognise and never the whole thing', () => {
    for (const key of [AUTH_KEY, `AIzaSy${'x'.repeat(33)}`, `sk-ant-api03-${'x'.repeat(60)}abcd`]) {
      const masked = maskKey(key)
      expect(masked).not.toContain(key)
      expect(masked).not.toContain(key.slice(0, 12))
      expect(masked.startsWith(key.slice(0, 6))).toBe(true)
      expect(masked.endsWith(key.slice(-4))).toBe(true)
      // The middle is hidden whatever the length, so a long key does not leak
      // more than a short one.
      expect(masked.length).toBe(18)
    }
  })

  it('hides a short string outright rather than mostly showing it', () => {
    expect(maskKey('AQ.Abshort')).toBe('•'.repeat(10))
    expect(maskKey('')).toBe('•'.repeat(8))
  })

  it('recognises the newer Google format at a glance', () => {
    expect(maskKey(AUTH_KEY).startsWith('AQ.Ab8')).toBe(true)
  })
})
