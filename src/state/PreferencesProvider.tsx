/**
 * App-level preferences: the breathing guide, and whether cues are felt or heard.
 *
 * These belong to the person rather than to a particular loop, so they live in
 * localStorage and apply everywhere. Saved loops deliberately do not carry them
 * — you should not have to re-choose your breathing pattern for every loop.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { DEFAULT_PATTERN, type BreathPattern } from '../lib/breathing'
import { setHapticsEnabled, setSoundEnabled } from '../lib/feedback'
import { readLocal, writeLocal } from '../lib/storage'

export interface Preferences {
  breathingEnabled: boolean
  breathPattern: BreathPattern
  breathSoundCues: boolean
  breathHapticCues: boolean
  /** Interface taps and confirmations. */
  uiSounds: boolean
  uiHaptics: boolean
}

const DEFAULTS: Preferences = {
  breathingEnabled: false,
  breathPattern: DEFAULT_PATTERN,
  breathSoundCues: false,
  breathHapticCues: true,
  uiSounds: false,
  uiHaptics: true,
}

const KEY = 'preferences'

interface PreferencesContextValue {
  preferences: Preferences
  update: (patch: Partial<Preferences>) => void
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null)

function load(): Preferences {
  const raw = readLocal(KEY)
  if (!raw) return DEFAULTS
  try {
    const parsed = JSON.parse(raw) as Partial<Preferences>
    return {
      ...DEFAULTS,
      ...parsed,
      breathPattern: { ...DEFAULTS.breathPattern, ...parsed.breathPattern },
    }
  } catch {
    return DEFAULTS
  }
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<Preferences>(load)

  // Keep the feedback module in step; it is called from non-React code.
  useEffect(() => {
    setSoundEnabled(preferences.uiSounds || preferences.breathSoundCues)
    setHapticsEnabled(preferences.uiHaptics || preferences.breathHapticCues)
    writeLocal(KEY, JSON.stringify(preferences))
  }, [preferences])

  const update = useCallback((patch: Partial<Preferences>) => {
    setPreferences((current) => ({
      ...current,
      ...patch,
      breathPattern: patch.breathPattern
        ? { ...current.breathPattern, ...patch.breathPattern }
        : current.breathPattern,
    }))
  }, [])

  const value = useMemo(() => ({ preferences, update }), [preferences, update])

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  )
}

export function usePreferences(): PreferencesContextValue {
  const context = useContext(PreferencesContext)
  if (!context) {
    throw new Error('usePreferences must be used inside <PreferencesProvider>')
  }
  return context
}
