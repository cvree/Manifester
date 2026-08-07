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
import {
  DEFAULT_BREATH_VOLUME,
  MAX_BREATH_VOLUME,
  type BreathSound,
} from '../lib/breathAudio'
import {
  DEFAULT_PATTERN,
  DEFAULT_STYLE,
  type BreathPattern,
  type BreathStyleId,
} from '../lib/breathing'
import { setHapticsEnabled, setSoundEnabled } from '../lib/feedback'
import { readLocal, writeLocal } from '../lib/storage'

export interface Preferences {
  breathingEnabled: boolean
  breathPattern: BreathPattern
  /** Which of the six forms the guide is drawn as. */
  breathStyle: BreathStyleId
  /** The breath's own voice, or `'off'`. */
  breathSound: BreathSound
  breathSoundVolume: number
  breathHapticCues: boolean
  /** Interface taps and confirmations. */
  uiSounds: boolean
  uiHaptics: boolean
  /**
   * The master switch for anything that talks to an AI.
   *
   * Separate from whether a key is stored, so turning it off does not throw
   * the key away and turning it back on is not a re-setup. While it is off
   * nothing reaches a provider, and the app stops offering to connect one.
   */
  aiEnabled: boolean
}

const DEFAULTS: Preferences = {
  // The guide is the visual centre of both the preview and the player, so it
  // is on by default.
  breathingEnabled: true,
  breathPattern: DEFAULT_PATTERN,
  breathStyle: DEFAULT_STYLE,
  /*
   * A chime rather than one of the continuous voices. The guide is no use to
   * anyone with their eyes shut unless it makes a sound, so silence is the
   * wrong default — but a bed of noise arriving unasked would be startling,
   * and a bell that rings twice a breath will not be mistaken for a fault.
   */
  breathSound: 'chime',
  breathSoundVolume: DEFAULT_BREATH_VOLUME,
  breathHapticCues: true,
  uiSounds: true,
  uiHaptics: true,
  aiEnabled: true,
}

const KEY = 'preferences'

interface PreferencesContextValue {
  preferences: Preferences
  update: (patch: Partial<Preferences>) => void
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null)

/** What was stored before the breath had voices and forms of its own. */
interface LegacyPreferences {
  breathSoundCues?: boolean
}

function load(): Preferences {
  const raw = readLocal(KEY)
  if (!raw) return DEFAULTS
  try {
    const parsed = JSON.parse(raw) as Partial<Preferences> & LegacyPreferences
    const merged: Preferences = {
      ...DEFAULTS,
      ...parsed,
      breathPattern: { ...DEFAULTS.breathPattern, ...parsed.breathPattern },
    }

    /*
     * The old setting was a single on/off for "a soft tone at each change of
     * phase", which is exactly what the chime is. Someone who had turned it
     * off had made a decision, and upgrading the app is not a reason to
     * overrule it.
     */
    if (parsed.breathSound == null && typeof parsed.breathSoundCues === 'boolean') {
      merged.breathSound = parsed.breathSoundCues ? 'chime' : 'off'
    }

    merged.breathSoundVolume = Math.min(
      MAX_BREATH_VOLUME,
      Math.max(0, merged.breathSoundVolume),
    )
    return merged
  } catch {
    return DEFAULTS
  }
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<Preferences>(load)

  // Keep the feedback module in step; it is called from non-React code.
  useEffect(() => {
    setSoundEnabled(preferences.uiSounds)
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
