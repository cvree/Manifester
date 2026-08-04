/** Small formatting helpers used across the UI. */

/** `754` → `"12:34"`, `4210` → `"1:10:10"` */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  const hours = Math.floor(s / 3600)
  const minutes = Math.floor((s % 3600) / 60)
  const seconds = s % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${minutes}:${pad(seconds)}`
}

export function countWords(text: string): number {
  const trimmed = text.trim()
  return trimmed ? trimmed.split(/\s+/).length : 0
}

/**
 * Rough spoken length. Typical synthesised speech lands near 150 words per
 * minute at rate 1.0, so this scales inversely with the chosen rate.
 */
export function estimateSpokenSeconds(text: string, rate: number): number {
  const words = countWords(text)
  const wordsPerMinute = 150 * Math.max(0.3, rate)
  return (words / wordsPerMinute) * 60
}

export function formatApproxDuration(seconds: number): string {
  if (seconds < 1) return '—'
  if (seconds < 60) return `~${Math.round(seconds)} sec`
  const minutes = seconds / 60
  if (minutes < 10) return `~${minutes.toFixed(1)} min`
  return `~${Math.round(minutes)} min`
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function formatRelativeDate(timestamp: number): string {
  const diff = Date.now() - timestamp
  const day = 86_400_000
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`
  if (diff < day) return `${Math.floor(diff / 3_600_000)} hr ago`
  if (diff < day * 7) return `${Math.floor(diff / day)} d ago`
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

/** Stable-enough unique id without pulling in a uuid dependency. */
export function createId(prefix = 'id'): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10)
  return `${prefix}_${Date.now().toString(36)}_${random}`
}
