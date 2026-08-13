import { useMemo, type CSSProperties, type RefObject } from 'react'
import type { BreathStyleId } from '../lib/breathing'
import {
  DEFAULT_BACKGROUND_CHOICE,
  isLivingBackgroundChoice,
  type BackgroundChoice,
} from '../lib/environment'
import { cx } from '../lib/cx'
import { isLowPowerDevice, useReducedMotion } from '../lib/motion'
import { useBackgroundScenes } from '../lib/useBackgroundScenes'
import type { LiveBreath } from '../lib/useBreathing'
import { BackgroundScene } from './BackgroundScene'
import { LivingCanvas } from './LivingCanvas'

/**
 * The room the player sits in.
 *
 * Room choice and breathing-form choice are intentionally independent. The two
 * canvas worlds can be selected here as backgrounds without changing the guide,
 * and they can be selected as guide forms without taking over the background.
 */
interface PlayerAtmosphereProps {
  fieldRef: RefObject<HTMLDivElement | null>
  amplitude: number
  immersive: boolean
  settled?: boolean
  utterance?: string
  mode?: BackgroundChoice
  /** Kept for call-site compatibility; the room no longer follows the form. */
  breathStyle?: BreathStyleId
  live?: RefObject<LiveBreath>
}

export function PlayerAtmosphere({
  fieldRef,
  amplitude,
  immersive,
  settled = false,
  utterance,
  mode = DEFAULT_BACKGROUND_CHOICE,
  live,
}: PlayerAtmosphereProps) {
  const reducedMotion = useReducedMotion()
  const livingStyle = isLivingBackgroundChoice(mode) ? mode : null
  const sceneChoice: BackgroundChoice = livingStyle
    ? DEFAULT_BACKGROUND_CHOICE
    : mode
  const scenes = useBackgroundScenes({ choice: sceneChoice, reducedMotion })

  /* Measured once. See `isLowPowerDevice`. */
  const lowPower = useMemo(isLowPowerDevice, [])
  const rich = !lowPower

  return (
    <div
      ref={fieldRef}
      aria-hidden="true"
      className={cx(
        'player-field',
        immersive && 'player-field--immersive',
        settled && 'player-field--settled',
      )}
      style={{ '--field': amplitude } as CSSProperties}
    >
      {/* 1 · Temperature. Warm as you empty, receding as you fill. */}
      <span className="player-field__warm" />

      {/*
        2 · The room itself.

        Standard rooms are CSS scenes. Ink Cathedral and Moonpool are canvas
        worlds. Crucially, the decision comes from `mode`, not `breathStyle`, so
        the room and guide can now be mixed in any combination.
      */}
      {livingStyle ? (
        <LivingCanvas
          style={livingStyle}
          live={live}
          variant="field"
          hostRef={fieldRef}
        />
      ) : (
        scenes.map((scene) => (
          <BackgroundScene
            key={scene.key}
            mode={scene.id}
            entering={scene.entering}
            leaving={scene.leaving}
            rich={rich}
            immersive={immersive}
          />
        ))
      )}

      {/* The spoken line briefly warms the air behind it. */}
      {utterance != null && (
        <span key={utterance} className="player-field__utter" />
      )}

      {/* 3 · Depth. The horizon, and the vignette over everything. */}
      <span className="player-field__depth">
        {rich && (
          <>
            <span className="player-field__horizon player-field__horizon--a" />
            <span className="player-field__horizon player-field__horizon--b" />
          </>
        )}
        <span className="player-field__vignette" />
      </span>
    </div>
  )
}
