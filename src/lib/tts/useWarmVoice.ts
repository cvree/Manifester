/**
 * Fetch the words of a loop before anybody asks for them.
 *
 * ── Why this runs the whole time the app is open ──
 *
 * Everything else about the voice is prepared *during* a session: the loop
 * fetches the lines around the one it is speaking, so from the second line
 * onwards there is nothing to wait for. What that never covered is the start —
 * the one line somebody is sitting in front of, having just pressed play,
 * listening to nothing — and it is the line that decides what the app feels
 * like.
 *
 * `start()` does ask for it, but it asks at the moment it is needed. There is
 * a settling silence before the first word and the fetch overlaps it, and on a
 * warm cache that is already enough. On a cold one — a phrase nobody has ever
 * played, on a build where the model runs on the device — it is not remotely
 * enough, and the settling silence turns into a wait with a label on it.
 *
 * The time this uses is all the other time. Somebody writing an affirmation,
 * reading their library, or looking at the play button has usually been doing
 * it for several seconds, and none of those seconds were doing any work. So
 * this is mounted at the shell rather than on the player, and every one of them
 * goes on the voice: by the time the play button is pressed the whole loop is
 * usually already in the cache, and pressing it is instant.
 *
 * ── Why the whole text, and why one line at a time ──
 *
 * It used to fetch the first two lines, which covered the opening and left the
 * rest of the pass to the loop. That is enough only while nothing changes; the
 * moment somebody moves the speed, or plays a long affirmation on a slow
 * device, the pass runs into lines nothing has ever made. Warming all of them
 * costs nothing extra in the common case — a clip that exists is a lookup —
 * and removes the last case where the app has to say it is waiting.
 *
 * Sequentially, and this is the important half: a model on this device
 * synthesises one line at a time, so twenty lines asked for at once is not
 * twenty lines sooner, it is the *first* line stuck behind nineteen it does not
 * need yet. Awaiting each one keeps them arriving in the order they will be
 * wanted, and keeps the queue short enough that a real request — somebody
 * pressing play — is never more than one line behind.
 *
 * Everything here is quiet on failure and abandoned on change. Nothing has been
 * promised to anybody: the words have not been played and may never be, so a
 * warm-up that could not reach the model is simply a warm-up that did not
 * happen, and `start()` does its own work when the time comes.
 */

import { useEffect } from 'react'
import { chunkText } from '../speech'
import { tts } from '.'
import type { LogicalVoice } from './types'

/**
 * How long the settings have to stop moving before any of this starts.
 *
 * Short enough to be finished with before somebody's hand reaches the play
 * button, and long enough that typing a sentence is one round of warming
 * rather than one per keystroke — every character changes the text, and each
 * change abandons the round before it. A speed or pitch drag is the same
 * shape: sixty events, one warm-up, on the value the finger stopped on.
 */
const SETTLE_MS = 320

/**
 * The most lines that are worth preparing in advance.
 *
 * A ceiling on wasted work rather than a limit anybody will meet: an
 * affirmation is a handful of lines, and something pasted in at fifty is
 * something being read once, where the loop's own lookahead is the right tool.
 */
const MAX_LINES = 48

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
    /*
     * The device's own voice has nothing to prepare — the platform is handed
     * the words at the moment they are spoken — so warming it is not cheaper,
     * it is impossible.
     */
    if (!enabled || preferDevice) return
    const chunks = chunkText(text).slice(0, MAX_LINES)
    if (chunks.length === 0) return

    let abandoned = false

    const timer = window.setTimeout(() => {
      void (async () => {
        for (const chunk of chunks) {
          if (abandoned) return
          await tts
            .preload(chunk, { voice, speed: rate, pitch, prefer: 'studio' })
            .catch(() => undefined)
        }
      })()
    }, SETTLE_MS)

    /*
     * A change abandons the walk rather than cancelling what is in flight. The
     * line already being fetched is left to land in the cache — it cost what it
     * cost, and the next round is very often the same words at a new speed,
     * where the layers underneath still save the round trip. See `client.ts`.
     */
    return () => {
      abandoned = true
      window.clearTimeout(timer)
    }
  }, [text, voice, rate, pitch, preferDevice, enabled])
}
