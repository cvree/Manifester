import { useMemo, type CSSProperties, type RefObject } from 'react'
import {
  DEFAULT_BACKGROUND_MODE,
  MOTE_FIELD,
  type BackgroundModeId,
} from '../lib/environment'
import { cx } from '../lib/cx'
import { isLowPowerDevice } from '../lib/motion'

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
 * Seven bands of depth, and each of them earns its place:
 *
 *   1. a warm ground wash that comes up as you empty and recedes as you fill —
 *      the room's temperature, and the only layer that runs *against* the
 *      breath rather than with it;
 *   2. the breathing field — one broad pool of light behind the orb, which is
 *      the layer that actually reads as the room inhaling — and behind it the
 *      far field, drawn two thirds of a second in arrears so that an in-breath
 *      appears to travel outward rather than land everywhere at once;
 *   3. the echo: a faint halo that only exists where the lagged breath is
 *      still ahead of the live one, so a full inhale leaves something behind
 *      it for a moment and nothing can ever accumulate;
 *   4. three aurora clouds — rose-lavender above, sage below, gold to one
 *      side — on very slow, deliberately incommensurable orbits, so the colour
 *      never repeats a pose;
 *   5. two haze planes at different depths: one near and broad, one further
 *      out and tighter, which is what turns four gradients into a volume;
 *   6. motes — eighteen points of pollen light with depth values, drifting out
 *      and settling back. The first thing dropped on modest hardware;
 *   7. the horizon and the vignette. The quietest band and the one doing the
 *      most: it is what keeps the eye on the words without ever asking it to
 *      move.
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
  /** Which kind of room this is. See `BACKGROUND_MODES`. */
  mode?: BackgroundModeId
}

export function PlayerAtmosphere({
  fieldRef,
  amplitude,
  immersive,
  settled = false,
  utterance,
  mode = DEFAULT_BACKGROUND_MODE,
}: PlayerAtmosphereProps) {
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
        `player-field--${mode}`,
        immersive && 'player-field--immersive',
        settled && 'player-field--settled',
      )}
      style={{ '--field': amplitude } as CSSProperties}
    >
      {/* 1 · Temperature. Warm as you empty, receding as you fill. */}
      <span className="player-field__warm" />

      {/* 2 · The breath itself, near and far. */}
      <span className="player-field__wave" />
      <span className="player-field__glow" />

      {/* 3 · What a full inhale leaves behind it. */}
      <span className="player-field__echo" />

      {/*
        4 and 5 · Colour and haze, wrapped together.

        The wrapper is not decoration: its opacity is plain, so GSAP has
        something it can reveal without fighting the per-frame calculations on
        the layers inside it. A tween and a `calc(var(--e) …)` on the same
        property is a tug of war with no winner.
      */}
      {rich && (
        <span className="player-field__clouds">
          <span className="player-field__cloud player-field__cloud--a" />
          <span className="player-field__cloud player-field__cloud--b" />
          <span className="player-field__cloud player-field__cloud--c" />
          <span className="player-field__haze player-field__haze--near" />
          <span className="player-field__haze player-field__haze--far" />
        </span>
      )}

      {/*
        6 · The points of light.

        Always mounted when the hardware can afford them, and hidden by the
        stylesheet where there is no room for them to travel through without
        landing on the words — a mote behind a paragraph is not atmosphere, it
        is a smudge. Hiding it there rather than unmounting it keeps the field
        the same field: nothing is re-placed by expanding the stage.
      */}
      {rich && (
        <span className="player-field__motes">
          {MOTE_FIELD.map((mote) => (
            <span
              key={`${mote.angle}-${mote.distance}`}
              className="player-field__mote"
              style={
                {
                  '--angle': `${mote.angle}deg`,
                  '--distance': mote.distance,
                  '--depth': mote.depth,
                  '--dot': `${mote.size}px`,
                  '--delay': `${mote.delay}s`,
                  '--twinkle': `${mote.period}s`,
                } as CSSProperties
              }
            />
          ))}
        </span>
      )}

      {/*
        The words affecting the room they are spoken into: a brief, very faint
        warming behind the line, keyed so that each new line starts it again.
        No text glow — the light is behind the words, never on them.
      */}
      {utterance != null && (
        <span key={utterance} className="player-field__utter" />
      )}

      {/* 7 · Depth. The horizon, and the vignette over everything. */}
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
