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
  isLivingStyle,
  type BreathPattern,
  type BreathStyleId,
} from '../lib/breathing'
import {
  DEFAULT_BACKGROUND_CHOICE,
  isBackgroundChoice,
  isLivingBackgroundChoice,
  type BackgroundChoice,
} from '../lib/environment'
import { setHapticsEnabled, setSoundEnabled } from '../lib/feedback'
import { readLocal, writeLocal } from '../lib/storage'

export interface Preferences {
  breathingEnabled: boolean
  breathPattern: BreathPattern
  /** Which of the six forms the guide is drawn as. */
  breathStyle: BreathStyleId
  /**
   * Cinematic typography: the breath said in words, across the whole screen.
   *
   * A layer over the guide rather than a different guide — the same clock, the
   * same pattern, the same sound — that sets "Breathe in" and "Breathe out" at
   * the size of the room and lets them open and close with the breath. It is
   * on by default, because for most people the words are what makes a
   * breathing guide followable with their eyes half shut, and it belongs to
   * the guide rather than to a loop: whether the screen speaks to you is not a
   * property of the words you happen to be playing over it.
   *
   * Switched off, the guide is exactly what it always was: the orb, its small
   * caption, and the count.
   */
  cinematicTypography: boolean
  /** The breath's own voice, or `'off'`. */
  breathSound: BreathSound
  breathSoundVolume: number
  breathHapticCues: boolean
  /**
   * Whether the player is wrapped in a living environment rather than sitting
   * on the ordinary Cosmic Garden.
   *
   * Independent of `breathingEnabled` on purpose. What the environment *is* —
   * the light, the colour, the depth, the horizon — is this switch; whether it
   * moves is the guide's, because the room rides on the guide's clock rather
   * than having one of its own and inventing one would be a four-second pulse
   * pretending to be your breathing. With the guide off the room is simply
   * still, which is a room, and not a broken effect.
   */
  backgroundVisualizer: boolean
  /**
   * Which room that environment is — Atmosphere, Rings, Waterline,
   * Curtains, Starfield or Stillness — or `random`, which drifts between all of them
   * a minute and a half at a time. See `BACKGROUND_MODES`.
   */
  backgroundMode: BackgroundChoice
  /** Interface taps and confirmations. See `feedback.ts`. */
  uiSounds: boolean
  /**
   * True once somebody has answered the question about cues themselves.
   *
   * Interface audio was silent for several versions, and everyone who used the
   * app during them has `uiSounds: false` stored — not because they turned cues
   * off, but because there was nothing to turn off and `false` was the honest
   * value for a feature that did not exist. Bringing the cues back means that
   * stored `false` has to be told apart from a real preference, and this is
   * what does it: unset means "never asked", and the current default applies.
   */
  uiSoundsChosen: boolean
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
  breathingEnabled: true,
  breathPattern: DEFAULT_PATTERN,
  breathStyle: DEFAULT_STYLE,
  cinematicTypography: true,
  // Silent by default; sound remains an explicit choice inside Breathing.
  breathSound: 'off',
  breathSoundVolume: DEFAULT_BREATH_VOLUME,
  breathHapticCues: true,
  backgroundVisualizer: true,
  backgroundMode: DEFAULT_BACKGROUND_CHOICE,
  uiSounds: true,
  uiSoundsChosen: false,
  uiHaptics: true,
  aiEnabled: true,
}

const KEY = 'preferences'

interface PreferencesContextValue {
  preferences: Preferences
  update: (patch: Partial<Preferences>) => void
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null)

/** What was stored before the breath had voices, forms and a room of its own. */
interface LegacyPreferences {
  breathSoundCues?: boolean
  backgroundBreathing?: boolean
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

    if (parsed.breathSound == null && typeof parsed.breathSoundCues === 'boolean') {
      merged.breathSound = parsed.breathSoundCues ? 'chime' : 'off'
    }

    /*
     * A stored `uiSounds` from the silent era is not an answer to a question
     * nobody was asked. See `uiSoundsChosen`.
     */
    if (parsed.uiSoundsChosen !== true) merged.uiSounds = DEFAULTS.uiSounds

    if (
      parsed.backgroundVisualizer == null &&
      typeof parsed.backgroundBreathing === 'boolean'
    ) {
      merged.backgroundVisualizer = parsed.backgroundBreathing
    }

    if (!isBackgroundChoice(merged.backgroundMode)) {
      merged.backgroundMode = DEFAULT_BACKGROUND_CHOICE
    }

    // Cathedral and Moonpool are retained internally for future experiments,
    // but they are not part of the product's current visualizer choices. Move
    // anyone who saved one while they were public back onto the stable defaults.
    if (isLivingStyle(merged.breathStyle)) {
      merged.breathStyle = DEFAULT_STYLE
    }
    if (isLivingBackgroundChoice(merged.backgroundMode)) {
      merged.backgroundMode = DEFAULT_BACKGROUND_CHOICE
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
      // Touching the switch at all is the answer, whichever way it was moved.
      uiSoundsChosen: patch.uiSounds != null ? true : current.uiSoundsChosen,
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
