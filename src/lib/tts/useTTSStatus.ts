/**
 * What the voice is currently able to do, as a React value.
 *
 * Used by the settings screens to say something true rather than something
 * hopeful. A studio voice that cannot be reached is not an error — the app
 * carries on in the device's own voice — but silently swapping the voice
 * somebody chose and never mentioning it is the kind of small dishonesty that
 * makes an app feel unreliable even when nothing is broken.
 */

import { useCallback, useEffect, useState } from 'react'
import { tts, type TTSStatus } from './index'
import { browserKokoro, type StudioSnapshot } from './engines/browserKokoro'

export function useTTSStatus(): TTSStatus {
  const [status, setStatus] = useState<TTSStatus>(() => tts.getStatus())
  useEffect(() => tts.subscribe(setStatus), [])
  return status
}

export interface StudioVoiceControls extends StudioSnapshot {
  /** 0–1 while installing, or `null` before any total is known. */
  fraction: number | null
  install: () => void
  cancel: () => void
  forget: () => void
  /** Throw away every stored byte and download it again from nothing. */
  startOver: () => void
  /** True once the model is on this device and speaking. */
  installed: boolean
}

/**
 * The on-device model, as a React value with its two buttons attached.
 *
 * Both the onboarding voice moment and the Voice settings sheet render the
 * same thing from this, which is deliberate: an install that reports 40% in
 * one place and "not installed" in the other is the kind of inconsistency that
 * makes somebody install it twice.
 */
export function useStudioVoice(): StudioVoiceControls {
  const [snapshot, setSnapshot] = useState<StudioSnapshot>(() =>
    browserKokoro.getSnapshot(),
  )
  useEffect(() => browserKokoro.subscribe(setSnapshot), [])

  const install = useCallback(() => {
    void browserKokoro.install()
  }, [])
  const cancel = useCallback(() => browserKokoro.cancelInstall(), [])
  const forget = useCallback(() => browserKokoro.forget(), [])
  /*
   * Clearing and installing are one action from the outside. Somebody who has
   * asked for a clean download wants a download, not an empty panel and a
   * second decision.
   */
  const startOver = useCallback(() => {
    void browserKokoro.reset().then(() => browserKokoro.install())
  }, [])

  return {
    ...snapshot,
    fraction:
      snapshot.total > 0
        ? Math.min(1, Math.max(0, snapshot.loaded / snapshot.total))
        : null,
    install,
    cancel,
    forget,
    startOver,
    installed: snapshot.state === 'ready',
  }
}

/**
 * Can the studio voice actually be had here?
 *
 * Not the same question as "did somebody choose it". A build with no speech
 * service — which is what GitHub Pages is — answers no from the first render,
 * and a full install whose backend has gone away answers no from the moment it
 * finds out. Both cases have to reach the screens, because a Voice panel
 * naming Ivy while a device synthesiser reads the words is the app telling
 * somebody something untrue about what they are listening to.
 *
 * The setting itself is left alone on purpose: it is a preference, and a loop
 * saved on the static build should still use the studio voice when it is
 * opened somewhere that has one.
 */
export function useStudioAvailable(): boolean {
  return useTTSStatus().engine === 'studio'
}
