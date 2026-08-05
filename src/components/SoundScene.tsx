import { cx } from '../lib/cx'
import type { BuiltInAmbientId } from '../lib/ambient'
import { useReducedMotion } from '../lib/motion'

/**
 * A small decorative scene for each built-in ambience.
 *
 * Purely CSS: a gradient, a couple of absolutely-positioned shapes, and one
 * slow animation. Nothing here touches audio timing, and nothing here is the
 * only way to tell which sound is selected — every card states that in words
 * as well.
 *
 * The moving parts (rain trails, rising embers) are simply not rendered when
 * someone prefers reduced motion. The still scene stays, and the sound is
 * identical either way.
 */
export function SoundScene({
  id,
  className,
}: {
  id: BuiltInAmbientId
  className?: string
}) {
  const reducedMotion = useReducedMotion()

  return (
    <span
      aria-hidden="true"
      className={cx('scene', `scene--${id}`, className)}
      data-still={reducedMotion ? 'true' : undefined}
    >
      {id === 'moon-garden' && (
        <>
          <span className="scene__moon" />
          <span className="scene__glint scene__glint--a" />
          <span className="scene__glint scene__glint--b" />
        </>
      )}

      {id === 'soft-horizon' && (
        <>
          <span className="scene__sun" />
          <span className="scene__horizon" />
        </>
      )}

      {id === 'rain-window' && (
        <>
          <span className="scene__window-glow" />
          {!reducedMotion && (
            <span className="scene__rain">
              <span />
              <span />
              <span />
              <span />
            </span>
          )}
          {reducedMotion && <span className="scene__rain scene__rain--still" />}
        </>
      )}

      {id === 'ocean-tide' && (
        <>
          <span className="scene__shore scene__shore--far" />
          <span className="scene__shore scene__shore--near" />
          <span className="scene__foam" />
        </>
      )}

      {id === 'fireplace-glow' && (
        <>
          <span className="scene__flame" />
          {!reducedMotion && (
            <span className="scene__embers">
              <span />
              <span />
              <span />
            </span>
          )}
        </>
      )}
    </span>
  )
}
