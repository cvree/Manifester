/**
 * The stored key, shared by the places that care about it.
 *
 * The Create screen needs it to decide which engine runs; the Customize list
 * needs it to show whether anything is set up; the setup panel needs it and
 * one thing beside it. A module-level store rather than another React
 * provider: this is a small piece of state read in a few places, which is less
 * than a context is worth.
 */

import { useEffect, useSyncExternalStore } from 'react'
import { loadCredentials, type Credentials } from './credentials'

export interface AiCredentialsState {
  credentials: Credentials | null
  /**
   * The name of a provider this app used to support, whose key was found on
   * this device and deleted. The setup panel turns it into one sentence, so
   * somebody whose Claude key stopped being used is told why rather than left
   * to conclude the app lost it.
   *
   * It lives in the same snapshot as the key, and that is the whole point. It
   * was a bare module variable first, and the screen never showed it: the
   * store emitted, `useSyncExternalStore` compared the snapshot — still `null`,
   * still the same `null` — and correctly declined to re-render. State that
   * has to reach the screen has to be *in* the value the screen subscribes to.
   */
  retired: string | null
}

const EMPTY: AiCredentialsState = { credentials: null, retired: null }

let state: AiCredentialsState = EMPTY
let loaded = false
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function snapshot(): AiCredentialsState {
  return state
}

export function setStoredCredentials(next: Credentials | null): void {
  state = { ...state, credentials: next }
  loaded = true
  emit()
}

/**
 * The whole stored-key state, loading it from IndexedDB the first time
 * anything asks.
 *
 * Returns nulls both while loading and when nothing is set up, which is the
 * right answer for every caller: with no key in hand, the offline engine runs.
 */
export function useAiCredentials(): AiCredentialsState {
  const value = useSyncExternalStore(subscribe, snapshot, snapshot)

  useEffect(() => {
    if (loaded) return
    loaded = true
    void loadCredentials().then((stored) => {
      state = { credentials: stored.credentials, retired: stored.retired }
      emit()
    })
  }, [])

  return value
}

/** Just the key, for the two screens that only need to know if there is one. */
export function useCredentials(): Credentials | null {
  return useAiCredentials().credentials
}

/** Just the explanation, for the one screen that has to give it. */
export function useRetiredProvider(): string | null {
  return useAiCredentials().retired
}
