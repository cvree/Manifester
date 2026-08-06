/**
 * The stored key, shared by the two places that care about it.
 *
 * The Create screen needs it to decide which engine runs; the Customize list
 * needs it to show whether anything is set up. A module-level store rather
 * than another React provider: this is one nullable value read in two places,
 * which is less than a context is worth.
 */

import { useEffect, useSyncExternalStore } from 'react'
import { loadCredentials, type Credentials } from './credentials'

let current: Credentials | null = null
let loaded = false
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function snapshot() {
  return current
}

export function setStoredCredentials(next: Credentials | null): void {
  current = next
  loaded = true
  emit()
}

/**
 * Reads the key, loading it from IndexedDB the first time anything asks.
 *
 * Returns `null` both while loading and when nothing is set up, which is the
 * right answer for every caller: with no key in hand, the offline engine runs.
 */
export function useCredentials(): Credentials | null {
  const value = useSyncExternalStore(subscribe, snapshot, snapshot)

  useEffect(() => {
    if (loaded) return
    loaded = true
    void loadCredentials().then((stored) => {
      if (stored) setStoredCredentials(stored)
    })
  }, [])

  return value
}
