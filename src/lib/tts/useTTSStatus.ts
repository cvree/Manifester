/**
 * What the voice is currently able to do, as a React value.
 *
 * Used by the settings screens to say something true rather than something
 * hopeful. A studio voice that cannot be reached is not an error — the app
 * carries on in the device's own voice — but silently swapping the voice
 * somebody chose and never mentioning it is the kind of small dishonesty that
 * makes an app feel unreliable even when nothing is broken.
 */

import { useEffect, useState } from 'react'
import { tts, type TTSStatus } from './index'

export function useTTSStatus(): TTSStatus {
  const [status, setStatus] = useState<TTSStatus>(() => tts.getStatus())
  useEffect(() => tts.subscribe(setStatus), [])
  return status
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
