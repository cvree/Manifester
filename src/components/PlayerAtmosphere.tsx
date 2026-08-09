import { useMemo, type CSSProperties, type RefObject } from 'react'
import { cx } from '../lib/cx'
import { isLowPowerDevice, useReducedMotion } from '../lib/motion'

/**
 * The room the player sits in.
 *
 * The Cosmic Garden behind every screen is the weather; this is the air in one
 * particular room, and the difference is that this one answers to you. It is a
 * single fixed layer between the garden and the page, and the breathing hook
 * writes `--e` and `--p` onto its root every frame — the *same* two values, on
 * the same frame, as the ones driving the orb. There is no second clock here,
 * no keyframed pulse and no interval: see `mirrors` in `useBreathing`.
 *
 * Five layers, and each of them earns its place:
 *
 *   1. the breathing field — one broad pool of light behind the orb, which is
 *      the layer that actually reads as the room inhaling;
 *   2. two aurora veils — rose-lavender above, sage below — on very slow,
 *      deliberately incommensurable orbits, so the colour never repeats a pose;
 *   3. haze — one wide, almost invisible wash that gathers inward as you empty;
 *   4. motes — seven points of pollen light that drift out and settle back.
 *      Expanded only, and the first thing dropped on modest hardware;
 *   5. the vignette, which relaxes as you fill and deepens as you empty. It is
 *      the quietest layer and does the most: it is what keeps the eye on the
 *      words without ever asking it to move.
 *
 * Two rules hold the whole thing together, and both are the house rules the
 * garden was already built on (see "The atmosphere" in `theme.css`):
 *
 *   - every gradient reaches full transparency well inside its own element, so
 *     no element edge can ever be walked into view by a transform;
 *   - nothing viewport-sized is ever put behind a `filter: blur()`. A large
 *     blurred layer is the classic way to melt a phone, and a soft enough
 *     gradient does not need one.
 *
 * So every frame of this costs the compositor a transform and an opacity on
 * five or ten already-promoted layers, and the main thread nothing at all.
 */

interface PlayerAtmosphereProps {
  /** Receives `--e` and `--p` from the breathing hook, in step with the orb. */
  fieldRef: RefObject<HTMLDivElement | null>
  /**
   * True only when there is a real breath to follow: the guide is on, the
   * background-breathing preference is on, and a session is actually playing.
   * When it goes false the room does not snap back — `--field` eases to zero
   * and every layer settles to its resting pose over about a second.
   */
  breathing: boolean
  /** True while the stage has the whole screen. */
  immersive: boolean
}

/**
 * Seven motes, placed by hand rather than at random.
 *
 * Random placement clumps, and a clump reads as a mistake. These are spread
 * around the orb at uneven angles and distances so the field looks scattered
 * rather than arranged — the irregularity is the point, and it should be the
 * same irregularity every time the player opens.
 */
const MOTES = [
  { angle: 18, distance: 0.72, size: 2.5, delay: 0 },
  { angle: 74, distance: 0.98, size: 1.5, delay: 2.4 },
  { angle: 129, distance: 0.61, size: 2, delay: 4.6 },
  { angle: 168, distance: 0.93, size: 1.5, delay: 1.3 },
  { angle: 214, distance: 0.8, size: 2.5, delay: 3.5 },
  { angle: 287, distance: 0.66, size: 1.5, delay: 6.1 },
  { angle: 322, distance: 1, size: 2, delay: 1.8 },
]

export function PlayerAtmosphere({
  fieldRef,
  breathing,
  immersive,
}: PlayerAtmosphereProps) {
  const reducedMotion = useReducedMotion()

  /*
   * Measured once. The answer cannot change while the page is open, and it
   * costs a throwaway WebGL context to ask — see `isLowPowerDevice`.
   */
  const lowPower = useMemo(isLowPowerDevice, [])

  /*
   * What a modest device gets: the field, the vignette and the colour. What it
   * does not get is the layer that has to be drawn seven times.
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
      className={cx('player-field', immersive && 'player-field--immersive')}
      style={
        {
          // The amplitude every layer multiplies its movement by. One number,
          // eased, so "stop breathing" is a settle rather than a stop.
          '--field': breathing && !reducedMotion ? 1 : 0,
        } as CSSProperties
      }
    >
      <span className="player-field__glow" />

      {rich && (
        <>
          <span className="player-field__aurora player-field__aurora--a" />
          <span className="player-field__aurora player-field__aurora--b" />
          <span className="player-field__haze" />
        </>
      )}

      {/*
        Expanded only. In the card there is no room for them to travel through
        without landing on the words, and a mote behind a paragraph is not
        atmosphere, it is a smudge.
      */}
      {rich && immersive && (
        <span className="player-field__motes">
          {MOTES.map((mote) => (
            <span
              key={`${mote.angle}-${mote.distance}`}
              className="player-field__mote"
              style={
                {
                  '--angle': `${mote.angle}deg`,
                  '--distance': mote.distance,
                  '--dot': `${mote.size}px`,
                  '--delay': `${-mote.delay}s`,
                } as CSSProperties
              }
            />
          ))}
        </span>
      )}

      <span className="player-field__vignette" />
    </div>
  )
}
