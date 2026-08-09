import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { cx } from '../lib/cx'
import { cue } from '../lib/feedback'
import { IconButton } from './IconButton'
import { MoreIcon } from './Icons'
import { Sheet } from './Sheet'

export interface MenuAction {
  id: string
  label: string
  /** One quiet line under the label, where the action needs a word of context. */
  hint?: string
  icon?: ReactNode
  tone?: 'neutral' | 'danger'
  disabled?: boolean
  /** Draws a hairline above this action — used once, before the destructive one. */
  divided?: boolean
  onSelect: () => void
}

interface MenuProps {
  /** Names the button and the menu. Required: the trigger is three dots. */
  label: string
  /** Heading for the phone sheet. Defaults to `label`. */
  title?: string
  /** One line under that heading. */
  description?: string
  actions: MenuAction[]
  className?: string
}

/** Below this the menu arrives as a sheet from the bottom edge instead. */
const SHEET_QUERY = '(max-width: 639px)'

const MENU_WIDTH = 264
/** Breathing room kept between the menu and the edge of the window. */
const EDGE = 10
/** The gap between the button and the menu it opens. */
const GAP = 8

interface Placement {
  top: number
  left: number
  width: number
  /** True when there was no room below and the menu opened upward. */
  flipped: boolean
}

/**
 * The "…" menu: one API, two presentations.
 *
 * On a phone the actions arrive as the app's own bottom sheet — thumb-height
 * rows, the same scrim, drag handle, focus trap and escape handling as every
 * other sheet in the app, because a 248px dropdown pinned to a 44px button is
 * a desktop idea that reads as a mistake under a thumb.
 *
 * From 640px up they arrive as a small menu anchored under the button, with
 * the WAI-ARIA menu-button roles and roving arrow-key focus. It is positioned
 * in a portal with fixed coordinates rather than absolutely inside the card:
 * the cards it opens from have `overflow` of their own, and a menu that gets
 * clipped by its own card is worse than no menu.
 */
export function Menu({
  label,
  title,
  description,
  actions,
  className,
}: MenuProps) {
  const [open, setOpen] = useState(false)
  const asSheet = useMatches(SHEET_QUERY)

  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const itemsRef = useRef<Array<HTMLButtonElement | null>>([])
  const [box, setBox] = useState<Placement | null>(null)
  const menuId = useId()

  const close = useCallback((returnFocus = true) => {
    setOpen(false)
    setBox(null)
    if (returnFocus) triggerRef.current?.focus({ preventScroll: true })
  }, [])

  // Measure, then place. `useLayoutEffect` lands both before the browser
  // paints, so the menu never appears in the corner first.
  useLayoutEffect(() => {
    if (!open || asSheet) return
    const trigger = triggerRef.current
    const panel = panelRef.current
    if (!trigger || !panel) return
    setBox(placeMenu(trigger.getBoundingClientRect(), panel.offsetHeight))
  }, [open, asSheet])

  useEffect(() => {
    if (!open || asSheet || !box) return
    // Focus the first action, the way a menu button is expected to behave.
    focusItem(itemsRef.current, 0, 1)
  }, [open, asSheet, box])

  /*
   * The page moving underneath is the one thing a fixed, pre-measured menu
   * cannot follow: this route scrolls with Lenis, so re-measuring per frame
   * would trail the button rather than track it. Closing is both cheaper and
   * what every other menu on the platform does.
   */
  useEffect(() => {
    if (!open || asSheet) return
    const dismiss = () => close(false)
    window.addEventListener('resize', dismiss)
    window.addEventListener('scroll', dismiss, true)
    return () => {
      window.removeEventListener('resize', dismiss)
      window.removeEventListener('scroll', dismiss, true)
    }
  }, [open, asSheet, close])

  const run = (action: MenuAction) => {
    if (action.disabled) return
    cue('tap')
    // Close first: an action that opens a sheet needs the trigger to be the
    // focused element by then, so the sheet returns focus there when it closes.
    close()
    action.onSelect()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = itemsRef.current
    const current = items.findIndex((item) => item === document.activeElement)

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        focusItem(items, current + 1, 1)
        break
      case 'ArrowUp':
        event.preventDefault()
        focusItem(items, current - 1, -1)
        break
      case 'Home':
        event.preventDefault()
        focusItem(items, 0, 1)
        break
      case 'End':
        event.preventDefault()
        focusItem(items, items.length - 1, -1)
        break
      case 'Escape':
        event.preventDefault()
        close()
        break
      case 'Tab':
        // Not prevented: focus returns to the trigger and carries on from
        // there, which is where tabbing out of a menu is supposed to leave you.
        close()
        break
    }
  }

  const trigger = (
    <IconButton
      ref={triggerRef}
      label={label}
      icon={<MoreIcon />}
      aria-haspopup="menu"
      aria-expanded={open}
      aria-controls={open && !asSheet ? menuId : undefined}
      className={className}
      onClick={() => {
        cue('tap')
        setOpen((value) => !value)
      }}
    />
  )

  if (asSheet) {
    return (
      <>
        {trigger}
        <Sheet
          open={open}
          onClose={() => close()}
          title={title ?? label}
          description={description}
        >
          <div className="-mx-2">
            {actions.map((action, index) => (
              <ActionRow
                key={action.id}
                action={action}
                onSelect={() => run(action)}
                first={index === 0}
                size="sheet"
              />
            ))}
          </div>
        </Sheet>
      </>
    )
  }

  return (
    <>
      {trigger}
      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-50">
            <button
              type="button"
              aria-label="Close menu"
              tabIndex={-1}
              onClick={() => close()}
              className="absolute inset-0 cursor-default"
            />
            <div
              ref={panelRef}
              id={menuId}
              role="menu"
              aria-label={label}
              onKeyDown={onKeyDown}
              className={cx(
                'surface-sheet absolute overflow-hidden rounded-[1.25rem] p-1.5',
                box?.flipped ? 'animate-menu-in-up' : 'animate-menu-in',
              )}
              style={{
                top: box?.top ?? 0,
                left: box?.left ?? 0,
                width: box?.width ?? MENU_WIDTH,
                visibility: box ? 'visible' : 'hidden',
              }}
            >
              {actions.map((action, index) => (
                <ActionRow
                  key={action.id}
                  action={action}
                  onSelect={() => run(action)}
                  first={index === 0}
                  size="menu"
                  ref={(node) => {
                    itemsRef.current[index] = node
                  }}
                />
              ))}
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}

interface ActionRowProps {
  action: MenuAction
  onSelect: () => void
  first: boolean
  size: 'menu' | 'sheet'
  ref?: (node: HTMLButtonElement | null) => void
}

function ActionRow({ action, onSelect, first, size, ref }: ActionRowProps) {
  const danger = action.tone === 'danger'
  return (
    <button
      ref={ref}
      type="button"
      role={size === 'menu' ? 'menuitem' : undefined}
      tabIndex={size === 'menu' ? -1 : undefined}
      disabled={action.disabled}
      onClick={onSelect}
      className={cx(
        'interactive flex w-full items-center gap-3 text-left',
        size === 'menu'
          ? 'min-h-11 rounded-[0.85rem] px-2.5 text-[0.94rem]'
          : 'min-h-14 rounded-[1rem] px-3 text-[1rem]',
        'disabled:cursor-not-allowed disabled:opacity-40',
        danger
          ? 'text-[var(--rose-deep)] hover:bg-[var(--rose-soft)]'
          : 'text-ink hover:bg-[var(--quiet)]',
        // The divider belongs to the run of rows, not to the row — so it is
        // never drawn against the panel's own top edge.
        action.divided && !first && 'mt-1.5 border-t border-[var(--quiet-border)] pt-1.5',
      )}
    >
      {action.icon && (
        <span
          aria-hidden="true"
          className={cx(
            'shrink-0',
            size === 'menu' ? 'text-[1.05rem]' : 'text-[1.15rem]',
            danger ? 'text-[var(--rose-deep)]' : 'text-ink-muted',
          )}
        >
          {action.icon}
        </span>
      )}
      <span className="min-w-0 grow py-1.5">
        <span className="block truncate">{action.label}</span>
        {/*
          The label truncates and the hint wraps. A hint is a whole short
          sentence, and half of one is worse than none — but a title someone
          chose can be any length at all, and a menu that widens to fit it is
          not a menu.
        */}
        {action.hint && (
          <span className="type-meta mt-0.5 block leading-snug">{action.hint}</span>
        )}
      </span>
    </button>
  )
}

/** Where the menu goes: right-aligned under the button, flipped up if it must. */
function placeMenu(trigger: DOMRect, height: number): Placement {
  const width = Math.min(MENU_WIDTH, window.innerWidth - EDGE * 2)
  const left = clamp(
    trigger.right - width,
    EDGE,
    Math.max(EDGE, window.innerWidth - width - EDGE),
  )

  const below = trigger.bottom + GAP
  const roomBelow = window.innerHeight - EDGE - below
  const roomAbove = trigger.top - GAP - EDGE
  const flipped = height > roomBelow && roomAbove > roomBelow

  const top = flipped
    ? Math.max(EDGE, trigger.top - GAP - height)
    : clamp(below, EDGE, Math.max(EDGE, window.innerHeight - height - EDGE))

  return { top, left, width, flipped }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/** Move focus, skipping anything disabled, and wrapping at either end. */
function focusItem(
  items: Array<HTMLButtonElement | null>,
  from: number,
  step: number,
) {
  const count = items.length
  if (count === 0) return
  for (let i = 0; i < count; i += 1) {
    const index = (((from + i * step) % count) + count) % count
    const item = items[index]
    if (item && !item.disabled) {
      item.focus({ preventScroll: true })
      return
    }
  }
}

function useMatches(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window === 'undefined' || !window.matchMedia
      ? false
      : window.matchMedia(query).matches,
  )

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const media = window.matchMedia(query)
    const onChange = () => setMatches(media.matches)
    setMatches(media.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [query])

  return matches
}
