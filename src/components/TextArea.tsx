import {
  useEffect,
  useRef,
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { cx } from '../lib/cx'

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Grow with the content instead of scrolling inside a fixed box. */
  autoGrow?: boolean
  minRows?: number
  maxHeight?: number
}

export function TextArea({
  autoGrow = true,
  minRows = 8,
  maxHeight = 520,
  className,
  value,
  ...props
}: TextAreaProps) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const element = ref.current
    if (!element || !autoGrow) return
    element.style.height = 'auto'
    element.style.height = `${Math.min(element.scrollHeight, maxHeight)}px`
  }, [value, autoGrow, maxHeight])

  return (
    <textarea
      ref={ref}
      rows={minRows}
      value={value}
      /*
       * Past `maxHeight` this box scrolls its own text. On a route that has
       * opted into smooth scrolling, the wheel over it belongs to the words
       * being written rather than to the page they are on.
       */
      data-lenis-prevent
      {...props}
      className={cx(
        'w-full resize-none rounded-[1.25rem] border border-[var(--border)] bg-[var(--surface-sunken)] px-4 py-3.5',
        'text-[1.02rem] leading-relaxed text-ink placeholder:text-ink-faint',
        'transition-colors duration-200 focus:border-[var(--border-strong)] focus:bg-[var(--surface-strong)]',
        className,
      )}
    />
  )
}

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  value: string
}

export function TextField({ className, ...props }: TextFieldProps) {
  return (
    <input
      type="text"
      {...props}
      className={cx(
        'min-h-12 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-sunken)] px-4',
        'text-[1.02rem] text-ink placeholder:text-ink-faint',
        'transition-colors duration-200 focus:border-[var(--border-strong)] focus:bg-[var(--surface-strong)]',
        className,
      )}
    />
  )
}
