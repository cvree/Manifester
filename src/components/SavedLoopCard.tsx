import { useEffect, useRef, useState } from 'react'
import {
  countWords,
  estimateSpokenSeconds,
  formatApproxDuration,
  formatRelativeDate,
} from '../lib/format'
import { cue } from '../lib/feedback'
import { canShare, copyText, loopShareText, shareText } from '../lib/share'
import type { SavedLoop } from '../lib/types'
import { Button } from './Button'
import { IconButton } from './IconButton'
import {
  ClipboardIcon,
  CopyIcon,
  DownloadIcon,
  PencilIcon,
  PlayIcon,
  ShareIcon,
  TrashIcon,
} from './Icons'
import { Menu, type MenuAction } from './Menu'

interface SavedLoopCardProps {
  loop: SavedLoop
  onPlay: () => void
  onEdit: () => void
  /** Opens the download sheet for this loop, with the full export panel in it. */
  onDownload: () => void
  onDuplicate: () => void
  onDelete: () => void
}

/** How long a "Copied" line stays before the card goes back to its date. */
const NOTE_MS = 2600

export function SavedLoopCard({
  loop,
  onPlay,
  onEdit,
  onDownload,
  onDuplicate,
  onDelete,
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

  /*
   * Delete comes from the menu, and choosing it takes the menu — and the
   * button focus was standing on — off the card. Focus lands on Keep rather
   * than on Delete: the destructive option should never be the one a stray
   * Enter finds.
   */
  useEffect(() => {
    if (confirming) keepRef.current?.focus({ preventScroll: true })
  }, [confirming])

  const flash = (message: string) => {
    setNote(message)
    if (noteTimer.current) clearTimeout(noteTimer.current)
    noteTimer.current = setTimeout(() => setNote(null), NOTE_MS)
  }

  const share = async () => {
    const outcome = await shareText({
      title: loop.title,
      text: loopShareText(loop.title, loop.text),
    })
    // A share sheet that was opened and dismissed needs no comment from us.
    if (outcome === 'copied') flash('Copied — no share sheet in this browser')
    else if (outcome === 'failed') flash('This browser would not share it')
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

  const actions: MenuAction[] = [
    {
      id: 'download',
      label: 'Download audio',
      hint: 'Render this loop as an MP3',
      icon: <DownloadIcon />,
      onSelect: onDownload,
    },
    {
      id: 'share',
      label: canShare() ? 'Share the words' : 'Copy the words to share',
      icon: <ShareIcon />,
      onSelect: () => void share(),
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
      hint: 'A separate copy to change freely',
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
        {/*
          One line, whatever it is saying: the date, or what just happened. A
          note that appeared beside the date would move the buttons, and this
          card is small enough that the shift would be the loudest thing on it.
        */}
        <span
          role="status"
          aria-live="polite"
          className="min-w-0 truncate text-[0.8125rem] text-ink-muted"
        >
          {note ??
            (loop.lastPlayedAt
              ? `Last played ${formatRelativeDate(loop.lastPlayedAt)}`
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
            <IconButton
              label={`Edit ${loop.title}`}
              icon={<PencilIcon />}
              onClick={onEdit}
            />
            <Menu
              label={`More for ${loop.title}`}
              title={loop.title}
              description="Download it, share it, or make another copy."
              actions={actions}
            />
          </span>
        )}
      </footer>
    </article>
  )
}
