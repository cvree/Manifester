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
import { isProviderId, type ProviderId } from './providers'

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

export interface LoadedCredentials {
  credentials: Credentials | null
  /**
   * The name of a provider this app used to support, whose key was found and
   * removed. Set once, so a screen can explain what happened rather than
   * simply appearing disconnected one morning.
   */
  retired: string | null
}

/**
 * Read the stored key, and deal honestly with one from a provider that is gone.
 *
 * Claude was an option and is not any more. A key for it can no longer be used
 * for anything, and a live API credential sitting at rest that this app will
 * never send anywhere is worse than no credential at all — so it is deleted
 * here, and the caller is told, rather than quietly kept.
 */
export async function loadCredentials(): Promise<LoadedCredentials> {
  try {
    const stored = await readKv<Credentials>(KEY)
    if (!stored?.provider || !stored.key || !stored.agreedAt) {
      return { credentials: null, retired: null }
    }
    if (!isProviderId(stored.provider)) {
      await forgetCredentials()
      return { credentials: null, retired: nameRetiredProvider(stored.provider) }
    }
    return { credentials: stored, retired: null }
  } catch {
    return { credentials: null, retired: null }
  }
}

/** Providers this app has offered in the past, for one explanatory sentence. */
function nameRetiredProvider(id: string): string {
  return id === 'claude' ? 'Claude' : id
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
