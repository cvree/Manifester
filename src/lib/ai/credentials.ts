/**
 * Where the API key lives.
 *
 * In this browser's own IndexedDB, beside the saved loops, and nowhere else.
 * It is never bundled into the app, never sent to GitHub Pages, and never sent
 * anywhere except the provider it belongs to.
 *
 * Worth being clear-eyed about what that does and does not protect. Same-origin
 * rules keep other websites out. They do not help if someone has the unlocked
 * phone — so the setup screen says plainly that the key is worth money, and
 * "Forget this key" is one tap away.
 */

import { readKv, writeKv } from '../storage'
import type { ProviderId } from './providers'

export interface Credentials {
  provider: ProviderId
  key: string
  /**
   * When the person agreed that their words may be sent to this provider.
   * Absent means never asked, which means never send anything.
   */
  agreedAt: number
}

const KEY = 'aiCredentials'

export async function loadCredentials(): Promise<Credentials | null> {
  try {
    const stored = await readKv<Credentials>(KEY)
    if (!stored?.provider || !stored.key || !stored.agreedAt) return null
    return stored
  } catch {
    return null
  }
}

export async function saveCredentials(credentials: Credentials): Promise<void> {
  await writeKv(KEY, credentials)
}

export async function forgetCredentials(): Promise<void> {
  await writeKv(KEY, null)
}

/** `sk-ant-api03-abcd…wxyz` — enough to recognise, not enough to use. */
export function maskKey(key: string): string {
  const trimmed = key.trim()
  if (trimmed.length <= 12) return '•'.repeat(trimmed.length)
  return `${trimmed.slice(0, 8)}…${trimmed.slice(-4)}`
}
