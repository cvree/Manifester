import { useMemo, type CSSProperties, type RefObject } from 'react'
import {
  DEFAULT_BACKGROUND_CHOICE,
  type BackgroundChoice,
} from '../lib/environment'
import { cx } from '../lib/cx'
import { isLowPowerDevice, useReducedMotion } from '../lib/motion'
import { useBackgroundScenes } from '../lib/useBackgroundScenes'
import { BackgroundScene } from './BackgroundScene'

/**
 * The room the player sits in.
 *
 * The Cosmic Garden behind every screen is the weather; this is the air in one
 * particular room, and the difference is that this one answers to you. It is a
 * single fixed layer between the garden and the page, and the breathing hook
 * writes the breath onto its root every frame — the *same* numbers, on the same
 * frame, as the ones driving the orb. There is no second clock here, no
 * keyframed pulse and no interval: see `mirrors` in `useBreathing`.
 *
 * Three of its bands belong to the room itself and never change:
 *
 *   1. a warm ground wash that comes up as you empty and recedes as you fill —
 *      the room's temperature, and the only layer that runs *against* the
 *      breath rather than with it;
 *   2. a brief warming of the air behind each spoken line;
 *   3. the horizon and the vignette. The quietest band and the one doing the
 *      most: it is what keeps the eye on the words without ever asking it to
 *      move.
 *
 * Between them sits the scene — what the breath is actually drawn as, which is
 * the part the Background visualiser setting chooses: Atmosphere, Rings, Waterline,
 * Curtains, Starfield or Stillness, or all of them in turn. See
 * `BackgroundScene` for the rooms and `useBackgroundScenes` for the drift
 * between them; both of them read the same breath this element is carrying, so
 * a change of room is a crossfade and never a restart.
 *
 * All of it is drawn around one point — the orb's own centre, measured rather
 * than guessed. The player writes it here as `--heart-x`/`--heart-y`, with the
 * orb's radius as `--halo`; see `useHeartAnchor`. The radius is what keeps the
 * room *behind* the orb: every layer in a room that has an edge is masked
 * clear inside it, so a ring, a curtain or a star can never cross the one
 * thing on this screen that has to read as the nearest.
 *
 * Three rules hold the whole thing together, and all three are the house rules
 * the garden was already built on (see "The atmosphere" in `theme.css`):
 *
 *   - every gradient reaches full transparency well inside its own element, so
 *     no element edge can ever be walked into view by a transform;
 *   - nothing viewport-sized is ever put behind a `filter: blur()`. A large
 *     blurred layer is the classic way to melt a phone, and a soft enough
 *     gradient does not need one;
 *   - no gradient is ever *recomputed* per frame. Colour temperature is two
 *     layers cross-fading, not one layer's stops being re-interpolated, because
 *     the first costs a composite and the second costs a full-viewport repaint.
 *
 * So every frame of this costs the compositor a transform and an opacity on a
 * dozen already-promoted layers, and the main thread nothing at all.
 */

interface PlayerAtmosphereProps {
  /** Receives the breath from the breathing hook, in step with the orb. */
  fieldRef: RefObject<HTMLDivElement | null>
  /**
   * How much of its movement each layer should spend: 1 when there is a real
   * breath to follow, 0 otherwise. The player decides — it is the one that
   * knows whether the guide is on, a session is playing and motion is wanted —
   * and it sets the same number on the stage, so the light inside the glass and
   * the light beyond it can never disagree.
   *
   * Going to 0 is not a stop. `--field` is registered and eased (`theme.css`),
   * so every layer glides back to its resting pose over about a second.
   *
   * Note what is *not* in here: whether the visualiser is switched on. That is
   * the mix, it is a separate number, and the separation is what lets the
   * setting be changed mid-breath without the breath noticing.
   */
  amplitude: number
  /** True while the stage has the whole screen. */
  immersive: boolean
  /**
   * True once the session is over: the room holds a fraction warmer and a
   * fraction smaller, so finishing feels like coming back to a place rather
   * than like playback stopping.
   */
  settled?: boolean
  /**
   * Changes when a new spoken line begins, and re-mounts the one element that
   * lets the words warm the air behind them for a moment. Undefined while
   * there is nothing being said.
   */
  utterance?: string
  /** Which kind of room this is, or `random` to drift. See `BACKGROUND_MODES`. */
  mode?: BackgroundChoice
}

export function PlayerAtmosphere({
  fieldRef,
  amplitude,
  immersive,
  settled = false,
  utterance,
  mode = DEFAULT_BACKGROUND_CHOICE,
}: PlayerAtmosphereProps) {
  const reducedMotion = useReducedMotion()
  const scenes = useBackgroundScenes({ choice: mode, reducedMotion })
  /*
   * Measured once. The answer cannot change while the page is open, and it
   * costs a throwaway WebGL context to ask — see `isLowPowerDevice`.
   */
  const lowPower = useMemo(isLowPowerDevice, [])

  /*
   * What a modest device gets: the light, the temperature, the depth and the
   * vignette. What it does not get is colour drawn three more times and a
   * field that has to be drawn eighteen.
   *
   * Reduced motion keeps every layer and loses only the movement — the room is
   * still lit, still coloured, still deep. That is the whole difference between
   * respecting the preference and punishing it.
   */
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

        Usually one. Two for a few seconds while a drift is crossfading, and
        the pair are at the same instant of the same breath the whole way
        across, because neither of them owns a clock — see `BackgroundScene`.
      */}
      {scenes.map((scene) => (
        <BackgroundScene
          key={scene.key}
          mode={scene.id}
          entering={scene.entering}
          leaving={scene.leaving}
          rich={rich}
          immersive={immersive}
        />
      ))}

      {/*
        The words affecting the room they are spoken into: a brief, very faint
        warming behind the line, keyed so that each new line starts it again.
        No text glow — the light is behind the words, never on them.
      */}
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
