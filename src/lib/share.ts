/** User-initiated sharing. Nothing is uploaded; links carry the loop in their hash. */

import { findAmbientPreset } from './ambient'
import { createId } from './format'
import { normaliseSettings } from './loops'
import type { LoopSettings, SavedLoop, SoundConfig } from './types'

export type ShareOutcome = 'shared' | 'copied' | 'dismissed' | 'failed'

export interface SharePayload {
  title: string
  text?: string
  url?: string
}

interface SharedLoopDocument {
  v: 1
  title: string
  text: string
  settings: LoopSettings
}

const MAX_SHARED_TEXT = 8_000
const MAX_TOKEN_LENGTH = 16_000

export function loopShareText(title: string, text: string): string {
  const heading = title.trim()
  const words = text.trim()
  if (!heading) return words
  if (!words) return heading
  return `${heading}\n\n${words}`
}

export function canShare(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function'
}

export function canShareFiles(files: File[]): boolean {
  if (!canShare() || typeof navigator.canShare !== 'function') return false
  try {
    return navigator.canShare({ files })
  } catch {
    return false
  }
}

export async function shareText(payload: SharePayload): Promise<ShareOutcome> {
  if (canShare()) {
    try {
      await navigator.share({
        title: payload.title,
        ...(payload.text ? { text: payload.text } : {}),
        ...(payload.url ? { url: payload.url } : {}),
      })
      return 'shared'
    } catch (error) {
      if (wasDismissed(error)) return 'dismissed'
    }
  }
  const fallback = payload.url ?? payload.text ?? ''
  return fallback && (await copyText(fallback)) ? 'copied' : 'failed'
}

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

/** Create a backend-free link. Device-specific voices and local media are omitted. */
export function createLoopShareUrl(loop: SavedLoop, currentUrl?: string): string {
  const token = encodeSharedLoop(loop)
  const base = new URL(
    currentUrl ??
      (typeof window !== 'undefined'
        ? window.location.href
        : 'https://cvree.github.io/Manifester/'),
  )
  base.hash = `/share?loop=${encodeURIComponent(token)}`
  return base.toString()
}

export function encodeSharedLoop(loop: SavedLoop): string {
  if (!loop.text.trim() || loop.text.length > MAX_SHARED_TEXT) {
    throw new Error('This loop is too long to share as a link.')
  }
  const settings = normaliseSettings(loop)
  const document: SharedLoopDocument = {
    v: 1,
    title: loop.title.trim().slice(0, 80) || 'Shared loop',
    text: loop.text,
    settings: {
      ...settings,
      voiceURI: null,
      voiceName: null,
      recordingId: null,
      sound: shareableSound(settings.sound),
    },
  }
  const token = base64UrlEncode(JSON.stringify(document))
  if (token.length > MAX_TOKEN_LENGTH) {
    throw new Error('This loop is too long to share as a link.')
  }
  return token
}

export function decodeSharedLoop(token: string): SavedLoop {
  if (!token || token.length > MAX_TOKEN_LENGTH) throw new Error('This shared link is not valid.')
  let raw: unknown
  try {
    raw = JSON.parse(base64UrlDecode(token))
  } catch {
    throw new Error('This shared link is not valid.')
  }
  if (!raw || typeof raw !== 'object') throw new Error('This shared link is not valid.')
  const value = raw as Partial<SharedLoopDocument>
  if (value.v !== 1 || typeof value.text !== 'string' || !value.text.trim()) {
    throw new Error('This shared link is incomplete.')
  }
  if (value.text.length > MAX_SHARED_TEXT) throw new Error('This shared loop is too large.')
  const now = Date.now()
  const settings = normaliseSettings(value.settings ?? {})
  return {
    ...settings,
    voiceURI: null,
    voiceName: null,
    recordingId: null,
    sound: shareableSound(settings.sound),
    id: createId('loop'),
    title:
      typeof value.title === 'string' && value.title.trim()
        ? value.title.trim().slice(0, 80)
        : 'Shared loop',
    text: value.text,
    createdAt: now,
    updatedAt: now,
    lastPlayedAt: null,
    // A link somebody opened is not yet a loop they kept. Pressing "Save to my
    // library" here, or Save in Create, is what makes it one; playing it puts
    // it under Recent plays like anything else.
    origin: 'played',
  }
}

function shareableSound(sound: SoundConfig): SoundConfig {
  if (sound.mode === 'off') return { ...sound, playlist: [] }
  if (sound.mode === 'single') {
    return sound.trackId && findAmbientPreset(sound.trackId)
      ? { ...sound, playlist: [] }
      : { ...sound, mode: 'off', trackId: null, playlist: [] }
  }
  const playlist = sound.playlist.filter((id) => findAmbientPreset(id) != null)
  return playlist.length > 0
    ? { ...sound, playlist }
    : { ...sound, mode: 'off', trackId: null, playlist: [] }
}

function base64UrlEncode(value: string): string {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function base64UrlDecode(value: string): string {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return new TextDecoder().decode(bytes)
}

function wasDismissed(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return error.name === 'AbortError' || /abort|cancel/i.test(error.message)
}

function legacyCopy(text: string): boolean {
  if (typeof document === 'undefined') return false
  const field = document.createElement('textarea')
  field.value = text
  field.setAttribute('readonly', '')
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
