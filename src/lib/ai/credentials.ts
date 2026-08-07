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
  /**
   * The model that answered when the key was last checked.
   *
   * Two jobs: it is what the connected screen shows, so nobody has to guess
   * what they are actually talking to, and it is where the next request
   * starts, so the usual case is one call rather than a walk down the list.
   */
  model?: string
  /** When a real request last came back from the provider. */
  verifiedAt?: number
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

/**
 * `AQ.Ab8•••••••••3f7a` — enough to recognise, not enough to use.
 *
 * The head is short on purpose. Six characters is plenty to tell your two keys
 * apart and to see which company issued it, and every character beyond that is
 * a character somebody has handed to whoever is looking over their shoulder.
 * Short keys are hidden outright rather than mostly-shown.
 */
export function maskKey(key: string): string {
  const trimmed = key.trim()
  if (trimmed.length < 16) return '•'.repeat(Math.max(trimmed.length, 8))
  return `${trimmed.slice(0, 6)}${'•'.repeat(8)}${trimmed.slice(-4)}`
}
