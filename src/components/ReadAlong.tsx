import { useEffect, useMemo, useRef } from 'react'
import { cx } from '../lib/cx'
import { prefersReducedMotion } from '../lib/motion'
import { chunkText } from '../lib/speech'
import type { SessionStatus } from '../lib/types'

interface ReadAlongProps {
  text: string
  status: SessionStatus
  /** Which part the voice is on, as the voice loop counts them. */
  index: number
  /** That part's own words, to confirm the page and the voice still agree. */
  spoken: string
  onEdit: () => void
  className?: string
}

/**
 * The whole text, readable while it is being read, with the line the voice is
 * on marked.
 *
 * The stage shows one line at a time, large — good for listening with your
 * eyes half shut and no use at all for finding your place in a page of
 * writing. This is the page.
 *
 * Three rules keep it calm:
 *
 *  - **The parts are the voice's own.** `chunkText` is what the loop speaks
 *    from, so the list can never disagree with it about where a line ends.
 *  - **The mark is only made when it is true.** If the words were edited
 *    after the session began, the part at that position may no longer be what
 *    is being said; then nothing is marked rather than the wrong thing.
 *  - **The page never moves.** Following along scrolls this list inside its
 *    own box, and only when the current line has left it. `scrollIntoView`
 *    would move the whole document under somebody's thumb.
 *
 * Not a live region: the stage above already announces state, and a screen
 * reader re-reading every line a voice is already speaking is two voices.
 */
export function ReadAlong({
  text,
  status,
  index,
  spoken,
  onEdit,
  className,
}: ReadAlongProps) {
  const parts = useMemo(() => chunkText(text), [text])
  const boxRef = useRef<HTMLOListElement>(null)

  const live = status === 'playing' || status === 'paused'
  const current = live && parts[index] === spoken ? index : -1

  useEffect(() => {
    const box = boxRef.current
    if (!box || current < 0) return
    const item = box.children[current] as HTMLElement | undefined
    if (!item) return
    const top = item.offsetTop - box.offsetTop
    const bottom = top + item.offsetHeight
    const visible = top >= box.scrollTop && bottom <= box.scrollTop + box.clientHeight
    if (visible) return
    box.scrollTo({
      top: Math.max(0, top - box.clientHeight / 3),
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    })
  }, [current])

  if (parts.length === 0) return null

  return (
    <section
      aria-labelledby="read-along-heading"
      className={cx('surface-panel px-5 py-5 sm:px-7 sm:py-6', className)}
    >
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <h2 id="read-along-heading" className="type-label">
          Your words
        </h2>
        <button
          type="button"
          onClick={onEdit}
          className="interactive -my-2 inline-flex min-h-11 items-center rounded-pill px-3 text-[0.9rem] font-medium text-ink-muted hover:bg-[var(--quiet)] hover:text-ink"
        >
          Edit
        </button>
      </div>

      <ol ref={boxRef} data-lenis-prevent className="read-along scroll-quiet">
        {parts.map((part, position) => (
          <li
            key={`${position}:${part}`}
            aria-current={position === current ? 'true' : undefined}
            className={cx(
              'read-along__line',
              position === current && 'read-along__line--current',
              current >= 0 && position < current && 'read-along__line--read',
            )}
          >
            {part}
          </li>
        ))}
      </ol>
    </section>
  )
}
