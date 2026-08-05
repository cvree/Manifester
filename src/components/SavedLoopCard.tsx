import { useState } from 'react'
import {
  countWords,
  estimateSpokenSeconds,
  formatApproxDuration,
  formatRelativeDate,
} from '../lib/format'
import type { SavedLoop } from '../lib/types'
import { Button } from './Button'
import { IconButton } from './IconButton'
import { CopyIcon, PencilIcon, PlayIcon, TrashIcon } from './Icons'

interface SavedLoopCardProps {
  loop: SavedLoop
  onPlay: () => void
  onEdit: () => void
  onDuplicate: () => void
  onDelete: () => void
}

export function SavedLoopCard({
  loop,
  onPlay,
  onEdit,
  onDuplicate,
  onDelete,
}: SavedLoopCardProps) {
  const [confirming, setConfirming] = useState(false)

  const preview = loop.text.trim().slice(0, 150)
  const spoken = formatApproxDuration(estimateSpokenSeconds(loop.text, loop.rate))

  return (
    <article className="surface-panel flex flex-col p-5" data-rise>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-display text-[1.25rem] text-ink">
            {loop.title}
          </h3>
          <p className="mt-0.5 text-[0.8125rem] text-ink-muted">
            {countWords(loop.text)} words · {spoken} per pass ·{' '}
            {loop.timerMinutes == null ? 'no timer' : `${loop.timerMinutes} min`}
          </p>
        </div>
        <Button
          variant="primary"
          onClick={onPlay}
          leading={<PlayIcon className="text-[0.85rem]" />}
          className="shrink-0"
        >
          Play
        </Button>
      </div>

      {preview && (
        <p className="mt-3 line-clamp-3 text-[0.93rem] leading-relaxed text-ink-muted">
          {preview}
          {loop.text.trim().length > 150 && '…'}
        </p>
      )}

      <footer className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-[var(--quiet-border)] pt-4">
        <span className="text-[0.8125rem] text-ink-muted">
          {loop.lastPlayedAt
            ? `Last played ${formatRelativeDate(loop.lastPlayedAt)}`
            : `Saved ${formatRelativeDate(loop.createdAt)}`}
        </span>

        {confirming ? (
          <span className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="min-h-11 rounded-pill px-3 text-[0.9rem] text-ink-muted"
            >
              Keep
            </button>
            <Button variant="danger" onClick={onDelete}>
              Delete for good
            </Button>
          </span>
        ) : (
          <span className="flex items-center gap-1.5">
            <IconButton
              label={`Edit ${loop.title}`}
              icon={<PencilIcon />}
              onClick={onEdit}
            />
            <IconButton
              label={`Duplicate ${loop.title}`}
              icon={<CopyIcon />}
              onClick={onDuplicate}
            />
            <IconButton
              label={`Delete ${loop.title}`}
              icon={<TrashIcon />}
              tone="danger"
              onClick={() => setConfirming(true)}
            />
          </span>
        )}
      </footer>
    </article>
  )
}
