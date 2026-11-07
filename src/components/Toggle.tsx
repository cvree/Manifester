import { startTransition, useId, useOptimistic, type ReactNode } from 'react'
import { cx } from '../lib/cx'

interface ToggleProps {
  label: string
  description?: ReactNode
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}

/**
 * A switch with the whole row as its target — comfortably tappable on a phone
 * without needing to hit the switch itself.
 *
 * ── Why it answers before the app does ──
 *
 * Every switch in this app writes to a provider that most of the screen reads
 * from, so the knob used to move only once the whole tree had re-rendered with
 * the new setting — on a mid-range phone, a visible beat after the finger. Now
 * the knob is flipped optimistically, in an urgent render of this component
 * alone, and the setting itself is handed to a transition behind it.
 *
 * `onChange` still runs synchronously inside the tap. Anything it does that is
 * not a React state update — starting audio, which a browser only allows from
 * inside a gesture — happens exactly when it did before; only the re-render is
 * moved out of the way.
 */
export function Toggle({
  label,
  description,
  checked,
  onChange,
  disabled = false,
}: ToggleProps) {
  const id = useId()
  const descriptionId = description ? `${id}-description` : undefined
  const [shown, setShown] = useOptimistic(checked)

  return (
    <button
      type="button"
      role="switch"
      aria-checked={shown}
      aria-describedby={descriptionId}
      disabled={disabled}
      onClick={() => {
        const next = !shown
        startTransition(() => {
          setShown(next)
          onChange(next)
        })
      }}
      className={cx(
        'group flex w-full cursor-pointer items-start gap-4 rounded-2xl border border-transparent py-1 text-left',
        'touch-manipulation [-webkit-tap-highlight-color:transparent]',
        'transition-opacity duration-150',
        disabled && 'cursor-not-allowed opacity-55',
      )}
    >
      <span className="min-w-0 grow">
        <span className="block text-[0.98rem] font-medium text-ink">{label}</span>
        {description && (
          <span
            id={descriptionId}
            className="mt-0.5 block text-[0.84rem] leading-snug text-ink-muted"
          >
            {description}
          </span>
        )}
      </span>

      <span
        aria-hidden="true"
        className={cx(
          'relative mt-0.5 h-7 w-12 shrink-0 rounded-pill border transition-[background-color,border-color,transform] duration-[120ms] ease-out',
          'group-active:scale-95',
          shown
            ? 'border-[var(--rose-deep)] bg-[var(--rose-deep)]'
            : 'border-[var(--border-strong)] bg-[var(--surface-sunken)]',
        )}
      >
        <span
          className={cx(
            'absolute top-[3px] h-[1.125rem] w-[1.125rem] rounded-full bg-[var(--bg-0)] shadow-sm',
            'transition-[left] duration-[120ms] ease-out',
            shown ? 'left-[1.5rem]' : 'left-[3px]',
          )}
        />
      </span>
    </button>
  )
}
