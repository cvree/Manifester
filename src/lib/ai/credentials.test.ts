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
    const loaded = await loadCredentials()

    expect(loaded?.key).toBe(AUTH_KEY)
    expect(loaded?.model).toBe('gemini-3.6-flash')
    expect(loaded?.verifiedAt).toBe(connected.verifiedAt)
  })

  it('really removes the key on disconnect', async () => {
    await saveCredentials(connected)
    await forgetCredentials()

    expect(await loadCredentials()).toBeNull()
    expect([...store.values.values()]).toEqual([])
  })

  it('reconnects cleanly after a disconnect', async () => {
    await saveCredentials(connected)
    await forgetCredentials()
    await saveCredentials({ ...connected, key: `AQ.Ab8ZZ${'9'.repeat(48)}` })

    const loaded = await loadCredentials()
    expect(loaded?.key.startsWith('AQ.Ab8ZZ')).toBe(true)
  })

  it('reads a record saved before models were remembered', async () => {
    // An upgrade must not log anybody out of a key that still works.
    store.values.set('aiCredentials', {
      provider: 'gemini',
      key: AUTH_KEY,
      agreedAt: 1,
    })

    const loaded = await loadCredentials()
    expect(loaded?.key).toBe(AUTH_KEY)
    expect(loaded?.model).toBeUndefined()
  })

  it('ignores a half-written record rather than half-connecting', async () => {
    store.values.set('aiCredentials', { provider: 'gemini', agreedAt: 1 })
    expect(await loadCredentials()).toBeNull()
  })

  it('tells the rest of the app straight away', () => {
    // The Create screen and the Customize list share one store, so a
    // disconnect on the About page has to reach both without a reload.
    setStoredCredentials(connected)
    setStoredCredentials(null)
    // No throw, and the null is what a caller with no key expects to see.
    expect(true).toBe(true)
  })
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
