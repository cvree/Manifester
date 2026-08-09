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
import {
  DEFAULT_BACKGROUND_CHOICE,
  isBackgroundChoice,
  type BackgroundChoice,
} from '../lib/environment'
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
  /*
   * On, because at the depth it is drawn at most people feel it before they
   * notice it — which is the whole design. A percent or two of scale and a few
   * percent of light is not an effect anyone has to opt into; it is what stops
   * the orb reading as a widget sitting on a page.
   */
  backgroundVisualizer: true,
  /*
   * Atmosphere: the room this app has always had. A first session should look
   * the way the app is described rather than opening on whichever of six rooms
   * the developer liked best that week — the other five are one tap away, and
   * "drift between all of them" is one tap further.
   */
  backgroundMode: DEFAULT_BACKGROUND_CHOICE,
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

    /*
     * The old setting was a single on/off for "a soft tone at each change of
     * phase", which is exactly what the chime is. Someone who had turned it
     * off had made a decision, and upgrading the app is not a reason to
     * overrule it.
     */
    if (parsed.breathSound == null && typeof parsed.breathSoundCues === 'boolean') {
      merged.breathSound = parsed.breathSoundCues ? 'chime' : 'off'
    }

    /*
     * The room used to be called Background breathing and was only ever the
     * *movement* of the atmosphere. It is now the atmosphere itself, and it
     * has a switch of its own — but someone who had turned the old one off had
     * turned the room off, and that decision carries.
     */
    if (
      parsed.backgroundVisualizer == null &&
      typeof parsed.backgroundBreathing === 'boolean'
    ) {
      merged.backgroundVisualizer = parsed.backgroundBreathing
    }

    /*
     * A room that no longer exists — a build where one was renamed, or a
     * hand-edited value — falls back to the default rather than to a class
     * name nothing in the stylesheet answers to and an empty screen.
     */
    if (!isBackgroundChoice(merged.backgroundMode)) {
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
