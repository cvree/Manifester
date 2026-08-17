/**
 * Fetch the first words of a loop before anybody asks for them.
 *
 * ── Why the player is the right place for this ──
 *
 * Everything else about the voice is prepared *during* a session: the loop
 * fetches the line after the one it is speaking, so from the second line
 * onwards there is nothing to wait for. The first line is the exception, and
 * it is the one that matters most — it is the one somebody is sitting in front
 * of, having just pressed play, listening to nothing.
 *
 * `start()` does ask for it, but it asks at the moment it is needed. There is
 * a settling silence before the first word and the fetch overlaps it, and on a
 * warm cache that is already enough. On a cold one — a phrase nobody has ever
 * played, on a build where the model runs on the device — it is not remotely
 * enough, and the settling silence turns into a wait.
 *
 * Somebody looking at the play button has, on the other hand, usually been
 * looking at it for several seconds. That is the time this uses.
 *
 * Two lines, not the whole affirmation: the aim is to cover the start, and
 * anything past that is speculative work against words that may never be
 * played and a model that has better things to do. It is skipped entirely
 * while a session is running, because then the loop's own lookahead is doing
 * this properly and with better information.
 */

import { useEffect } from 'react'
import { chunkText } from '../speech'
import { tts } from '.'
import type { LogicalVoice } from './types'

/** Long enough that arriving, glancing and leaving costs nothing. */
const SETTLE_MS = 700

/** The opening, and the line behind it. Matches the loop's own window. */
const LINES = 2

export interface WarmVoiceOptions {
  text: string
  voice: LogicalVoice
  rate: number
  pitch: number
  preferDevice: boolean
  /** False while a session is running, or when there is nothing to play. */
  enabled: boolean
}

export function useWarmVoice({
  text,
  voice,
  rate,
  pitch,
  preferDevice,
  enabled,
}: WarmVoiceOptions): void {
  useEffect(() => {
    if (!enabled || preferDevice) return
    const chunks = chunkText(text).slice(0, LINES)
    if (chunks.length === 0) return

    const timer = window.setTimeout(() => {
      for (const chunk of chunks) {
        /*
         * Quiet on every failure. Nothing has been promised to anybody yet —
         * the words have not been played and may never be — so a warm-up that
         * cannot reach the model is simply a warm-up that did not happen, and
         * `start()` will do its own work when the time comes.
         */
        void tts.preload(chunk, { voice, speed: rate, pitch, prefer: 'studio' })
      }
    }, SETTLE_MS)

    return () => window.clearTimeout(timer)
  }, [text, voice, rate, pitch, preferDevice, enabled])
}
