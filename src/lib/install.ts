import { useEffect, useState } from 'react'
import { detectPlatform, isStandalone, type Platform } from './motion'

/** Chrome's install event, which is not in the standard DOM lib types. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export interface InstallState {
  platform: Platform
  /** Already running from the home screen. */
  installed: boolean
  /** The browser offered a native install prompt we can trigger. */
  canPrompt: boolean
  install: () => Promise<void>
}

/**
 * Shared by the install banner and the About screen so the two never disagree
 * about what this browser can do.
 */
export function useInstallPrompt(): InstallState {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(isStandalone)
  const platform = detectPlatform()

  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      event.preventDefault()
      setDeferred(event as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setInstalled(true)
      setDeferred(null)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const install = async () => {
    if (!deferred) return
    await deferred.prompt()
    await deferred.userChoice
    setDeferred(null)
  }

  return { platform, installed, canPrompt: deferred !== null, install }
}
