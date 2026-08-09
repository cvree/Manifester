import type { CSSProperties, ReactNode } from 'react'
import { cx } from '../lib/cx'
import { MOTE_FIELD, type BackgroundModeId } from '../lib/environment'

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
      <span className="player-scene__ring player-scene__ring--1" />
      <span className="player-scene__ring player-scene__ring--2" />
      <span className="player-scene__ring player-scene__ring--3" />
      {rich && <span className="player-scene__ring player-scene__ring--4" />}
      {rich && <span className="player-scene__petal" />}
    </>
  ),

  /*
   * Waterline. The room fills as you breathe in, and draws back as you empty.
   *
   * Three water planes rise from below the bottom edge — the near one on the
   * live breath, the others on the two lagged samples, so the surface arrives
   * in three unhurried steps rather than as one moving line. The bright line
   * is the surface itself, and it is the only thing on screen that reaches its
   * brightest halfway up: water is most visible while it is moving.
   */
  waterline: (rich) => (
    <>
      <span className="player-scene__deep" />
      <span className="player-scene__water player-scene__water--far" />
      <span className="player-scene__water player-scene__water--mid" />
      <span className="player-scene__water player-scene__water--near" />
      <span className="player-scene__surface" />
      {rich && <span className="player-scene__shimmer" />}
    </>
  ),

  /*
   * Curtains. Light reaching down as you fill, lifting as you empty.
   *
   * Five of them at their own widths and positions, each scaling from the top
   * edge, and each on a different sample of the breath so the light ripples
   * across rather than stretching as one sheet. The slow lateral sway is the
   * only self-running motion in the room and it is damped by `--sway`, which
   * goes to a quarter through a hold — so a held breath genuinely suspends.
   */
  curtains: (rich) => (
    <>
      <span className="player-scene__sky" />
      <span className="player-scene__curtain player-scene__curtain--a" />
      <span className="player-scene__curtain player-scene__curtain--b" />
      <span className="player-scene__curtain player-scene__curtain--c" />
      {rich && <span className="player-scene__curtain player-scene__curtain--d" />}
      {rich && <span className="player-scene__curtain player-scene__curtain--e" />}
      <span className="player-scene__ground" />
    </>
  ),

  /*
   * Starfield. The same eighteen points of light the atmosphere keeps in
   * its corners, brought to the front and given the whole screen to travel
   * across — near points move furthest, far points barely at all, so filling
   * the lungs opens the field into depth rather than scaling a picture.
   */
  starfield: (rich) => (
    <>
      <span className="player-scene__night" />
      <span className="player-scene__orbit player-scene__orbit--near" />
      <span className="player-scene__orbit player-scene__orbit--far" />
      <span className="player-scene__stars">
        {MOTE_FIELD.map((mote) => (
          <span
            key={`${mote.angle}-${mote.distance}`}
            className="player-scene__star"
            style={
              {
                '--angle': `${mote.angle}deg`,
                '--distance': mote.distance,
                '--depth': mote.depth,
                '--dot': `${mote.size + 0.6}px`,
                '--delay': `${mote.delay}s`,
                '--twinkle': `${mote.period}s`,
              } as CSSProperties
            }
          />
        ))}
      </span>
      {rich && <span className="player-scene__dust" />}
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
