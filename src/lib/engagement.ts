/**
 * A tiny record of whether this person has actually used Manifester yet.
 *
 * The install suggestion waits for this. Asking someone to put an app on their
 * home screen before they have heard a single word out of it is the banner
 * everybody closes without reading — so the prompt only appears after a loop
 * has been started or saved, and never comes back once it has been dismissed.
 */

import { readLocal, writeLocal } from './storage'

const COUNT_KEY = 'engagement'
const DISMISS_KEY = 'installDismissed'

/** Meaningful moments before the install card is allowed to appear. */
export const ENGAGEMENT_THRESHOLD = 2

type Listener = () => void
const listeners = new Set<Listener>()

export function engagementCount(): number {
  const raw = readLocal(COUNT_KEY)
  const parsed = raw ? Number.parseInt(raw, 10) : 0
  return Number.isFinite(parsed) ? parsed : 0
}

/** Called when a session starts or a loop is saved. */
export function recordEngagement(): void {
  const next = Math.min(99, engagementCount() + 1)
  writeLocal(COUNT_KEY, String(next))
  for (const listener of listeners) listener()
}

export function isInstallDismissed(): boolean {
  return readLocal(DISMISS_KEY) === '1'
}

export function dismissInstall(): void {
  writeLocal(DISMISS_KEY, '1')
  for (const listener of listeners) listener()
}

export function subscribeEngagement(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
