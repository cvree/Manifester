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
