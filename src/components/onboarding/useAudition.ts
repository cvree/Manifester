import { useCallback, useEffect, useRef, useState } from 'react'
import { tts, voiceForStyle } from '../../lib/tts'
import type { LoopSettings } from '../../lib/types'

/**
 * Hearing a line, during the first minute.
 *
 * The player's own preview would almost do, and it is deliberately not used
 * here for one reason: this screen shows six lines at once and needs to know
 * *which* of them is speaking, so the tile that was tapped can say so while
 * the other five stay quiet. A single global "playing" flag would light all
 * six.
 *
 * Everything else it does is about the first tap being fast:
 *
 *  - `unlock()` on every press, not just the first. It is free when the audio
 *    is already open, and it is the only thing that works on iOS, where the
 *    permission to make sound belongs to the gesture rather than to the page.
 *  - The rest of the visible lines are warmed as soon as they are shown, so
 *    the second tap and the third are instant even on a cold cache.
 *  - Speed is fixed to the app's default, which is the speed the shipped clips
 *    were generated at. Auditioning at any other speed would miss every one of
 *    them and synthesise from scratch — a beautiful voice, arriving late.
 */

/** The rate the pre-generated library exists at. See `generate-speech.mjs`. */
export const AUDITION_SPEED: LoopSettings['rate'] = 0.9

/** Loud enough to be judged on, quiet enough for a phone in a quiet room. */
const AUDITION_VOLUME = 0.9

export interface Audition {
  /** The text currently being fetched, or null. */
  loading: string | null
  /** The text currently speaking, or null. */
  speaking: string | null
  play: (text: string, style: 'feminine' | 'masculine') => void
  stop: () => void
  /** Fetch and decode ahead of a tap that has not happened yet. */
  warm: (texts: string[], style: 'feminine' | 'masculine') => void
}

export function useAudition(): Audition {
  const [loading, setLoading] = useState<string | null>(null)
  const [speaking, setSpeaking] = useState<string | null>(null)
  /** Only the newest press may change what is on screen. */
  const generation = useRef(0)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      // Leaving this screen must not leave a voice talking over the next one.
      tts.stop()
    }
  }, [])

  const play = useCallback((text: string, style: 'feminine' | 'masculine') => {
    const line = text.trim()
    if (!line) return

    // Inside the gesture, before anything async. Safari counts the stack.
    tts.unlock()

    generation.current += 1
    const mine = generation.current
    setLoading(line)
    setSpeaking(null)

    void tts
      .speak(line, {
        voice: voiceForStyle(style),
        speed: AUDITION_SPEED,
        volume: AUDITION_VOLUME,
        onStart: () => {
          if (!mounted.current || generation.current !== mine) return
          setLoading(null)
          setSpeaking(line)
        },
      })
      .finally(() => {
        if (!mounted.current || generation.current !== mine) return
        setLoading(null)
        setSpeaking(null)
      })
  }, [])

  const stop = useCallback(() => {
    generation.current += 1
    tts.stop()
    setLoading(null)
    setSpeaking(null)
  }, [])

  const warm = useCallback((texts: string[], style: 'feminine' | 'masculine') => {
    for (const text of texts) {
      // Quiet on purpose: a preload that fails has cost nothing, because the
      // thing it was preparing for has not been asked for yet.
      void tts.preload(text, {
        voice: voiceForStyle(style),
        speed: AUDITION_SPEED,
      })
    }
  }, [])

  return { loading, speaking, play, stop, warm }
}
