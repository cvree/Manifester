import { useEffect, useRef, useState } from 'react'
import {
  countWords,
  estimateSpokenSeconds,
  formatApproxDuration,
  formatRelativeDate,
} from '../lib/format'
import { cue } from '../lib/feedback'
import {
  canShare,
  copyText,
  createLoopShareUrl,
  shareText,
} from '../lib/share'
import type { SavedLoop } from '../lib/types'
import { Button } from './Button'
import { IconButton } from './IconButton'
import {
  ClipboardIcon,
  ClockIcon,
  CopyIcon,
  DownloadIcon,
  PencilIcon,
  PlayIcon,
  SeedIcon,
  ShareIcon,
  TrashIcon,
} from './Icons'
import { Menu, type MenuAction } from './Menu'

interface SavedLoopCardProps {
  loop: SavedLoop
  onPlay: () => void
  onEdit: () => void
  onDownload: () => void
  onRemind: () => void
  onDuplicate: () => void
  onDelete: () => void
  /** Present only for a captured play: keep it for good. */
  onKeep?: () => void
}

const NOTE_MS = 2600

export function SavedLoopCard({
  loop,
  onPlay,
  onEdit,
  onDownload,
  onRemind,
  onDuplicate,
  onDelete,
  onKeep,
}: SavedLoopCardProps) {
  const [confirming, setConfirming] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const keepRef = useRef<HTMLButtonElement>(null)

  useEffect(
    () => () => {
      if (noteTimer.current) clearTimeout(noteTimer.current)
    },
    [],
  )

  useEffect(() => {
    if (confirming) keepRef.current?.focus({ preventScroll: true })
  }, [confirming])

  const flash = (message: string) => {
    setNote(message)
    if (noteTimer.current) clearTimeout(noteTimer.current)
    noteTimer.current = setTimeout(() => setNote(null), NOTE_MS)
  }

  const shareLink = async () => {
    let link: string
    try {
      link = createLoopShareUrl(loop)
    } catch (error) {
      flash(error instanceof Error ? error.message : 'This loop could not be shared.')
      return
    }
    const outcome = await shareText({
      title: loop.title,
      text: 'A Manifester loop shared with you.',
      url: link,
    })
    if (outcome === 'copied') flash('Link copied')
    else if (outcome === 'failed') flash('This browser would not share the link')
    else if (outcome === 'shared') cue('save')
  }

  const copy = async () => {
    const copied = await copyText(loop.text.trim())
    if (copied) cue('save')
    flash(copied ? 'The words are on your clipboard' : 'Could not reach the clipboard')
  }

  const duplicate = () => {
    onDuplicate()
    flash('Copy saved to your library')
  }

  const keep = () => {
    onKeep?.()
    cue('save')
    flash('Saved to your loops')
  }

  /*
   * No Save entry here. A recent play already carries a Save button in the
   * footer, an inch to the left of the button that opens this menu — the same
   * action twice, side by side, one of them hidden behind a tap.
   */
  const actions: MenuAction[] = [
    {
      id: 'share-link',
      label: canShare() ? 'Share loop link' : 'Copy loop link',
      hint: 'Open or save it on another device',
      icon: <ShareIcon />,
      onSelect: () => void shareLink(),
    },
    {
      id: 'reminder',
      label: 'Add calendar reminder',
      hint: 'One reminder, only when you choose it',
      icon: <ClockIcon />,
      onSelect: onRemind,
    },
    {
      id: 'download',
      label: 'Download audio',
      hint: 'Render this loop as an MP3',
      icon: <DownloadIcon />,
      onSelect: onDownload,
    },
    {
      id: 'copy',
      label: 'Copy the words',
      icon: <ClipboardIcon />,
      onSelect: () => void copy(),
    },
    {
      id: 'duplicate',
      label: 'Duplicate',
      hint: 'A separate copy to edit',
      icon: <CopyIcon />,
      onSelect: duplicate,
    },
    {
      id: 'delete',
      label: 'Delete',
      icon: <TrashIcon />,
      tone: 'danger',
      divided: true,
      onSelect: () => setConfirming(true),
    },
  ]

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
        <span
          role="status"
          aria-live="polite"
          className="min-w-0 truncate text-[0.8125rem] text-ink-muted"
        >
          {note ??
            (loop.lastPlayedAt
              ? `${onKeep ? 'Played' : 'Last played'} ${formatRelativeDate(loop.lastPlayedAt)}`
              : `Saved ${formatRelativeDate(loop.createdAt)}`)}
        </span>

        {confirming ? (
          <span className="flex items-center gap-2">
            <button
              ref={keepRef}
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
            {onKeep && (
              <Button
                variant="secondary"
                size="sm"
                onClick={keep}
                leading={<SeedIcon className="text-[0.8rem]" />}
              >
                Save
              </Button>
            )}
            <IconButton
              label={`Edit ${loop.title}`}
              icon={<PencilIcon />}
              onClick={onEdit}
            />
            <Menu
              label={`More for ${loop.title}`}
              title={loop.title}
              description="Share it, set one reminder, download it, or make another copy."
              actions={actions}
            />
          </span>
        )}
      </footer>
    </article>
  )
}
