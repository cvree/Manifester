import type { CSSProperties, ReactNode } from 'react'
import { cx } from '../lib/cx'
import {
  MOTE_FIELD,
  STAR_FIELD,
  type BackgroundModeId,
} from '../lib/environment'

/**
 * What the breath is drawn as.
 *
 * Six rooms, one set of numbers. Not one of these layers has a clock, a
 * keyframe or an interval driving its breathing half: they all read `--e`,
 * `--e-mid` and `--e-far` — expansion now, a quarter-second ago, two thirds of
 * a second ago — which `useBreathing` writes onto the field on the same frame
 * it writes them onto the orb. That is why a room can be swapped mid-breath
 * and why two of them can be on screen at once during a drift: they are not
 * agreeing with each other, they are the same number.
 *
 * Everything is sized in percentages of the field, so the same markup renders
 * as a preview thumbnail with nothing changed but the box around it.
 *
 * The three house rules from `theme.css` hold here as they do everywhere:
 * every gradient reaches full transparency inside its own element, nothing
 * viewport-sized goes behind a `filter: blur()`, and no gradient is ever
 * recomputed per frame — movement is transform and opacity, and nothing else.
 *
 * There is a fourth rule now, and it is about the orb. Anything in a room
 * with an *edge* — a ring, a curtain, the waterline, a star — is drawn inside
 * `<Figures>`, which is masked clear where the orb stands. The glass the orb
 * sits behind is translucent, and a hard edge crossing a soft object is read
 * by the eye as being in front of it; the mask is what keeps the orb the
 * nearest thing in its own room. Everything soft stays outside the wrapper,
 * because a hole in a wash would be a dark disc rather than a clearance.
 */

interface BackgroundSceneProps {
  mode: BackgroundModeId
  /** Fades up as it arrives, and down as it leaves. See `useBackgroundScenes`. */
  entering?: boolean
  leaving?: boolean
  /** Drops the layers a modest device should not be asked to draw. */
  rich?: boolean
  /** True while the stage has the whole screen. */
  immersive?: boolean
  className?: string
  style?: CSSProperties
}

export function BackgroundScene({
  mode,
  entering = false,
  leaving = false,
  rich = true,
  immersive = false,
  className,
  style,
}: BackgroundSceneProps) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        'player-scene',
        `player-scene--${mode}`,
        entering && 'player-scene--entering',
        leaving && 'player-scene--leaving',
        immersive && 'player-scene--immersive',
        className,
      )}
      style={style}
    >
      {LAYERS[mode](rich)}
    </span>
  )
}

/**
 * The layers of a room that have an edge, held clear of the orb.
 *
 * One untransformed wrapper carrying one mask — see `.player-scene__figures`.
 * Untransformed on purpose: a mask travels with its element's transform, so a
 * hole punched into a scaling ring would scale with it, and a hole that
 * follows the thing it is meant to be cut out of is not a hole.
 */
function Figures({ children }: { children: ReactNode }) {
  return <span className="player-scene__figures">{children}</span>
}

/**
 * One swell of the ocean: the tide outside, the water inside.
 *
 * Split in two because they are two different movements on the same property.
 * The outer element holds the level — one transform, driven by this swell's
 * own sample of the breath — and the inner one drifts sideways across it on a
 * period of its own. Nested transforms compose, so a crest can travel while
 * its sea rises, and neither half ever has to read the other.
 */
function Swell({ tone }: { tone: 'far' | 'mid' | 'near' }) {
  return (
    <span className={`player-scene__swell player-scene__swell--${tone}`}>
      <span className="player-scene__swell-crest" />
    </span>
  )
}

/**
 * One band of the aurora: the breath outside, the light inside.
 *
 * Three elements rather than two, because a band of aurora is three separate
 * movements and two separate kinds of light. The outer one reaches down the
 * sky with the breath. The body snakes — leaning and sliding at once, which is
 * what makes a ribbon look like a ribbon seen edge-on. Inside it the halo
 * carries the colour out into the air, and the veil carries the filaments: the
 * texture the eye reads as an aurora long before it reads the hue.
 */
function Aurora({ band }: { band: 'a' | 'b' | 'c' | 'd' | 'e' }) {
  return (
    <span className={`player-scene__aurora player-scene__aurora--${band}`}>
      <span className="player-scene__aurora-body">
        <span className="player-scene__aurora-halo" />
        <span className="player-scene__aurora-veil" />
      </span>
    </span>
  )
}

/* ── The rooms ──────────────────────────────────────────────── */

const LAYERS: Record<BackgroundModeId, (rich: boolean) => ReactNode> = {
  /*
   * Atmosphere. The original room, unchanged: a near field and a far field of
   * the same light, the echo a full inhale leaves behind, three aurora clouds
   * on incommensurable orbits, two haze planes and the points of pollen light.
   */
  atmosphere: (rich) => (
    <>
      <span className="player-field__wave" />
      <span className="player-field__glow" />
      <span className="player-field__echo" />
      {rich && (
        <span className="player-field__clouds">
          <span className="player-field__cloud player-field__cloud--a" />
          <span className="player-field__cloud player-field__cloud--b" />
          <span className="player-field__cloud player-field__cloud--c" />
          <span className="player-field__haze player-field__haze--near" />
          <span className="player-field__haze player-field__haze--far" />
        </span>
      )}
      {rich && (
        <Figures>
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
        </Figures>
      )}
    </>
  ),

  /*
   * Rings. The breath made visible as distance travelled.
   *
   * Four rings leave the heart and open outward across the whole screen, each
   * reading the breath a little further back in time than the one inside it —
   * now, a quarter-second ago, two thirds of a second ago, and the far sample
   * again at a wider radius. Nothing is spawned and nothing is cleaned up: the
   * ring "travelling" is four elements at four fixed lags, which is the same
   * trick the near and far fields already use, drawn where it can be seen.
   */
  rings: (rich) => (
    <>
      <span className="player-scene__pool" />
      {rich && <span className="player-scene__petal" />}
      <Figures>
        <span className="player-scene__ring player-scene__ring--1" />
        <span className="player-scene__ring player-scene__ring--2" />
        <span className="player-scene__ring player-scene__ring--3" />
        {rich && <span className="player-scene__ring player-scene__ring--4" />}
      </Figures>
    </>
  ),

  /*
   * Waterline. An ocean, filling as you breathe in and draining as you empty.
   *
   * Each swell is two elements: an outer one carrying the tide — the level,
   * on its own sample of the breath — and an inner one carrying the water,
   * drifting sideways on a long period of its own. Nested transforms compose,
   * so a crest travels across the screen while the sea it belongs to rises,
   * and three of them at three lags and three drifts slide past each other:
   * the waterline you see is the union, so it is never flat and never repeats.
   *
   * Everything else is light in water rather than more water — currents
   * banked in the body of it, shafts coming down through it from where the orb
   * is, foam that only exists while the sea is actually moving, and the path
   * of light lying on the water beneath you.
   */
  waterline: (rich) => (
    <>
      <span className="player-scene__deep" />
      {rich && (
        <>
          <span className="player-scene__current player-scene__current--a" />
          <span className="player-scene__current player-scene__current--b" />
        </>
      )}
      <Swell tone="far" />
      <Swell tone="mid" />
      <Swell tone="near" />
      {rich && (
        <>
          <span className="player-scene__shaft player-scene__shaft--a" />
          <span className="player-scene__shaft player-scene__shaft--b" />
          <span className="player-scene__shaft player-scene__shaft--c" />
        </>
      )}
      <span className="player-scene__path" />
      {/* The surface and the foam are the lines in this room with an edge. */}
      <Figures>
        <span className="player-scene__surface" />
        {rich && (
          <>
            <span className="player-scene__foam player-scene__foam--a" />
            <span className="player-scene__foam player-scene__foam--b" />
          </>
        )}
      </Figures>
      {rich && <span className="player-scene__shimmer" />}
    </>
  ),

  /*
   * Curtains. The aurora: light reaching down as you fill, lifting as you
   * empty.
   *
   * Each band is two elements again — an outer one carrying the breath, an
   * inner one carrying the serpentine, which leans and slides at the same time
   * so the light reads as a ribbon seen edge-on rather than a column being
   * nudged. The inner one is where the rays live: a repeating gradient of fine
   * near-vertical filaments, inside a mask that gives the band its shape, lit
   * magenta at the hem and green through the body. Static, both of them — the
   * texture costs one paint and never a frame.
   *
   * The bands are placed around the orb rather than across the viewport, and
   * each reads a different sample of the breath, so an in-breath crosses the
   * sky rather than stretching it as one sheet.
   */
  curtains: (rich) => (
    <>
      <span className="player-scene__night" />
      <span className="player-scene__sky" />
      {rich && <span className="player-scene__corona" />}
      <Figures>
        <Aurora band="a" />
        <Aurora band="b" />
        <Aurora band="c" />
        {rich && <Aurora band="d" />}
        {rich && <Aurora band="e" />}
      </Figures>
      <span className="player-scene__ground" />
    </>
  ),

  /*
   * Starfield. A sky that opens on the in-breath and gathers on the out.
   *
   * The field runs from a tight knot ringed against the orb's own rim to
   * points reaching the corners of the screen — around three times the radius
   * for the nearest of them and about half that for the furthest, because the
   * difference between those two numbers is the depth. It gathers *to*
   * something rather than merely becoming less: the core behind the orb is
   * largest and brightest at the bottom of every breath.
   *
   * Sixty points where the rest of the app uses eighteen. A spread this
   * wide needs the count to carry it — see `STAR_FIELD` — and a device that
   * should not be asked to draw sixty composited layers gets the small
   * field instead, at the same spread.
   */
  starfield: (rich) => (
    <>
      <span className="player-scene__night" />
      <span className="player-scene__core" />
      {rich && <span className="player-scene__dust" />}
      <Figures>
        <span className="player-scene__orbit player-scene__orbit--near" />
        <span className="player-scene__orbit player-scene__orbit--far" />
        <span className="player-scene__stars">
          {(rich ? STAR_FIELD : MOTE_FIELD).map((star) => (
            <span
              key={`${star.angle}-${star.distance}`}
              className="player-scene__star"
              style={
                {
                  '--angle': `${star.angle}deg`,
                  '--distance': star.distance,
                  '--depth': star.depth,
                  '--dot': `${star.size + 1.6}px`,
                  '--delay': `${star.delay}s`,
                  '--twinkle': `${star.period}s`,
                } as CSSProperties
              }
            />
          ))}
        </span>
      </Figures>
    </>
  ),

  /*
   * Stillness. One field, and the dark around it.
   *
   * The room for people who find the others busy — and the honest home for the
   * moments the rest of the app is already carrying enough. It breathes as
   * much as any of them; there is simply nothing else in it.
   */
  stillness: () => (
    <>
      <span className="player-scene__hollow" />
      <span className="player-scene__breath" />
    </>
  ),
}

/**
 * A still frame of a room, for the picker.
 *
 * The same layers at a fixed, half-open pose — so what you choose from is the
 * thing itself rather than an illustration of it that can quietly fall out of
 * date.
 */
export function BackgroundSceneThumbnail({
  mode,
  className,
}: {
  mode: BackgroundModeId
  className?: string
}) {
  return (
    <span
      aria-hidden="true"
      className={cx('player-scene-thumb', className)}
      style={
        {
          '--e': 0.66,
          '--e-mid': 0.5,
          '--e-far': 0.34,
          '--m': 0,
          '--field': 1,
          '--mix': 1,
          '--mix-cloud': 1,
          '--mix-mote': 1,
          '--mix-depth': 1,
        } as CSSProperties
      }
    >
      <BackgroundScene mode={mode} rich />
    </span>
  )
}
