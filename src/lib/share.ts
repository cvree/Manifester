/**
 * Handing something to the rest of the device.
 *
 * The Web Share API is the only place Manifester passes anything outside its
 * own tab, and it is always the user who starts it: a share sheet opens, they
 * choose where it goes, and the app never learns what they picked. Nothing is
 * uploaded, and there is no link to anywhere — a shared loop is its words, and
 * a shared file is the file itself.
 *
 * Support is uneven (Firefox on the desktop has no share sheet, and file
 * sharing is narrower still), so every path here degrades rather than
 * disappearing: the clipboard when there is no share sheet, and `execCommand`
 * when the page is not in a secure context and the async clipboard is missing.
 */

export type ShareOutcome =
  /** The device's share sheet took it. */
  | 'shared'
  /** No share sheet, so the words went to the clipboard instead. */
  | 'copied'
  /** The share sheet opened and the user backed out. Say nothing. */
  | 'dismissed'
  | 'failed'

export interface SharePayload {
  title: string
  text: string
}

/** A loop as a message worth pasting somewhere: its title, then its words. */
export function loopShareText(title: string, text: string): string {
  const heading = title.trim()
  const words = text.trim()
  if (!heading) return words
  if (!words) return heading
  return `${heading}\n\n${words}`
}

/** Whether this browser has a share sheet at all. */
export function canShare(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function'
}

/**
 * Whether this browser will share *these* files. Chrome on Windows and Safari
 * on iOS both take audio; several browsers with `navigator.share` take text
 * only, and answering that honestly is the whole point of `canShare(data)`.
 */
export function canShareFiles(files: File[]): boolean {
  if (!canShare() || typeof navigator.canShare !== 'function') return false
  try {
    return navigator.canShare({ files })
  } catch {
    return false
  }
}

/** Share the words, falling back to the clipboard where there is no sheet. */
export async function shareText(payload: SharePayload): Promise<ShareOutcome> {
  if (canShare()) {
    try {
      await navigator.share({ title: payload.title, text: payload.text })
      return 'shared'
    } catch (error) {
      if (wasDismissed(error)) return 'dismissed'
      /* Anything else falls through to the clipboard. */
    }
  }
  return (await copyText(payload.text)) ? 'copied' : 'failed'
}

/**
 * Share a rendered audio file.
 *
 * On a phone this is usually better than a download: iOS has no visible
 * downloads folder for a web app, but its share sheet will put the file
 * straight into Files, Voice Memos or a message.
 */
export async function shareFile(file: File, title: string): Promise<ShareOutcome> {
  if (!canShareFiles([file])) return 'failed'
  try {
    await navigator.share({ files: [file], title })
    return 'shared'
  } catch (error) {
    return wasDismissed(error) ? 'dismissed' : 'failed'
  }
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* Permission refused, or no secure context. Try the old way. */
  }
  return legacyCopy(text)
}

/**
 * Backing out of the share sheet rejects with an `AbortError`, and it is not a
 * failure — the user changed their mind, and the app should say nothing at all.
 * Some older WebKit builds reject with a plain "canceled" message instead.
 */
function wasDismissed(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return error.name === 'AbortError' || /abort|cancel/i.test(error.message)
}

/** `document.execCommand` is deprecated, and it is still the only fallback. */
function legacyCopy(text: string): boolean {
  if (typeof document === 'undefined') return false

  const field = document.createElement('textarea')
  field.value = text
  field.setAttribute('readonly', '')
  // Off-screen rather than hidden: a hidden field cannot be selected.
  field.style.position = 'fixed'
  field.style.top = '-1000px'
  field.style.opacity = '0'
  document.body.appendChild(field)

  try {
    field.select()
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    field.remove()
  }
}
