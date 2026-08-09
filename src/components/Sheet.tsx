import {
  useCallback,
  useEffect,
  useId,
  useRef,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { cx } from '../lib/cx'
import { cue } from '../lib/feedback'
import { CloseIcon } from './Icons'

interface SheetProps {
  open: boolean
  onClose: () => void
  title: string
  /** One quiet line under the title explaining what this changes. */
  description?: string
  children: ReactNode
  /** Pinned to the bottom of the sheet, above the safe area. */
  footer?: ReactNode
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * One modal surface for the whole app.
 *
 * On a phone it rises from the bottom edge with a drag handle and clears the
 * home indicator; from `md` up it becomes a centred dialog. Both share the
 * same focus trap, the same escape handling and the same scroll lock, so a
 * setting behaves identically wherever you opened it from.
 *
 * Written by hand rather than pulled in: a headless dialog library is ~15 kB
 * for behaviour that is about sixty lines when you only need one variant.
 */
export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
}: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const titleId = useId()
  const descriptionId = useId()

  const close = useCallback(() => {
    cue('tap')
    onClose()
  }, [onClose])

  // Lock the page behind the sheet and give focus to the panel.
  useEffect(() => {
    if (!open) return

    returnFocusRef.current = document.activeElement as HTMLElement | null
    document.body.setAttribute('data-scroll-locked', '')

    const panel = panelRef.current
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE)
    // Prefer the content over the close button: the first thing you can act on.
    ;(first ?? panel)?.focus({ preventScroll: true })

    return () => {
      document.body.removeAttribute('data-scroll-locked')
      returnFocusRef.current?.focus?.({ preventScroll: true })
    }
  }, [open])

  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }

      if (event.key !== 'Tab') return

      const panel = panelRef.current
      if (!panel) return
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (item) => item.offsetParent !== null,
      )
      if (items.length === 0) return

      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement

      if (event.shiftKey && (active === first || active === panel)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6">
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={close}
        className="animate-scrim-in absolute inset-0 cursor-default bg-[var(--scrim)] backdrop-blur-[3px]"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cx(
          'surface-sheet animate-sheet-in relative flex max-h-[88dvh] w-full flex-col',
          'rounded-t-[1.75rem] md:max-h-[82dvh] md:max-w-lg md:rounded-[1.75rem]',
        )}
      >
        {/* Drag handle: a phone affordance only. */}
        <span
          aria-hidden="true"
          className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-pill bg-[var(--control-border-hover)] md:hidden"
        />

        <header className="flex items-start gap-4 px-6 pt-4 pb-4 md:pt-6">
          <div className="min-w-0 grow">
            <h2 id={titleId} className="type-heading">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="type-meta mt-1">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={close}
            aria-label={`Close ${title}`}
            className="interactive -mr-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--control-border)] text-[1.05rem] text-ink-muted hover:text-ink"
          >
            <CloseIcon />
          </button>
        </header>

        {/*
          `data-lenis-prevent`: a sheet has its own scroller, and on a route
          that has opted into smooth scrolling the wheel would otherwise be
          taken by the page behind this one.
        */}
        <div
          data-lenis-prevent
          className="scroll-quiet min-h-0 grow overflow-y-auto overscroll-contain px-6 pb-6"
        >
          {children}
        </div>

        {footer && (
          <div className="safe-bottom shrink-0 border-t border-[var(--panel-border)] px-6 pt-4">
            {footer}
          </div>
        )}

        {!footer && (
          <div
            aria-hidden="true"
            className="shrink-0"
            style={{ height: 'env(safe-area-inset-bottom)' }}
          />
        )}
      </div>
    </div>,
    document.body,
  )
}
