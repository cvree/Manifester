/**
 * The playback session: what is being spoken, over what, and for how long.
 *
 * This provider owns the three engines (voice, music, timer), the draft the
 * Create tab edits, and the live state the Player tab renders.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { MusicEngine, type TrackSource } from '../lib/audio'
import { loopToDraft, type Draft } from '../lib/loops'
import {
  SpeechLooper,
  isSpeechSupported,
  loadVoices,
  toVoiceOption,
  type VoiceOption,
} from '../lib/speech'
import * as storage from '../lib/storage'
import { SessionTimer } from '../lib/timer'
import {
  DEFAULT_SETTINGS,
  type LoopSettings,
  type SavedLoop,
  type SessionStatus,
} from '../lib/types'

interface SessionSnapshot {
  status: SessionStatus
  title: string
  /** `null` while the session runs without a timer. */
  remainingSeconds: number | null
  elapsedSeconds: number
  cycles: number
  chunkIndex: number
  chunkTotal: number
  trackName: string | null
  notice: string | null
}

interface SessionContextValue {
  draft: Draft
  updateDraft: (patch: Partial<Omit<Draft, 'settings'>>) => void
  updateSettings: (patch: Partial<LoopSettings>) => void
  loadIntoDraft: (loop: SavedLoop) => void
  resetDraft: () => void

  voices: VoiceOption[]
  voicesReady: boolean
  speechSupported: boolean

  session: SessionSnapshot
  start: (source?: SavedLoop) => void
  pause: () => void
  resume: () => void
  stop: () => void
  dismissNotice: () => void

  /** Live volume/rate changes that apply without restarting the session. */
  setLiveVoiceVolume: (value: number) => void
  setLiveMusicVolume: (value: number) => void
  setLiveRate: (value: number) => void
}

const SessionContext = createContext<SessionContextValue | null>(null)

const EMPTY_SESSION: SessionSnapshot = {
  status: 'idle',
  title: '',
  remainingSeconds: null,
  elapsedSeconds: 0,
  cycles: 0,
  chunkIndex: 0,
  chunkTotal: 0,
  trackName: null,
  notice: null,
}

function newDraft(): Draft {
  return {
    id: null,
    title: '',
    text: '',
    settings: { ...DEFAULT_SETTINGS, sound: { ...DEFAULT_SETTINGS.sound } },
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<Draft>(newDraft)
  const [voices, setVoices] = useState<VoiceOption[]>([])
  const [voicesReady, setVoicesReady] = useState(false)
  const [session, setSession] = useState<SessionSnapshot>(EMPTY_SESSION)

  const speechRef = useRef<SpeechLooper | null>(null)
  const musicRef = useRef<MusicEngine | null>(null)
  const timerRef = useRef<SessionTimer | null>(null)
  const elapsedRef = useRef<{ startedAt: number; interval: number | null }>({
    startedAt: 0,
    interval: null,
  })
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)
  const speechSupported = useMemo(isSpeechSupported, [])

  if (!speechRef.current) speechRef.current = new SpeechLooper()
  if (!musicRef.current) musicRef.current = new MusicEngine()
  if (!timerRef.current) timerRef.current = new SessionTimer()

  /* ── Voices ── */

  useEffect(() => {
    let cancelled = false

    async function pull() {
      const list = await loadVoices()
      if (cancelled) return
      speechRef.current?.setVoices(list)
      setVoices(list.map(toVoiceOption))
      setVoicesReady(true)
    }

    void pull()

    // Some platforms populate the list well after first paint.
    const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined
    const onChange = () => void pull()
    synth?.addEventListener?.('voiceschanged', onChange)

    return () => {
      cancelled = true
      synth?.removeEventListener?.('voiceschanged', onChange)
    }
  }, [])

  /* ── Restore last-used settings ── */

  useEffect(() => {
    let cancelled = false
    void storage.loadLastSettings().then((saved) => {
      if (cancelled || !saved) return
      setDraft((current) => ({
        ...current,
        settings: {
          ...current.settings,
          ...saved,
          sound: { ...current.settings.sound, ...saved.sound },
        },
      }))
    })
    return () => {
      cancelled = true
    }
  }, [])

  /* ── Draft editing ── */

  const updateDraft = useCallback<SessionContextValue['updateDraft']>((patch) => {
    setDraft((current) => ({ ...current, ...patch }))
  }, [])

  const updateSettings = useCallback<SessionContextValue['updateSettings']>(
    (patch) => {
      setDraft((current) => {
        const settings: LoopSettings = {
          ...current.settings,
          ...patch,
          sound: patch.sound
            ? { ...current.settings.sound, ...patch.sound }
            : current.settings.sound,
        }
        void storage.saveLastSettings(settings)
        return { ...current, settings }
      })
    },
    [],
  )

  const loadIntoDraft = useCallback(
    (loop: SavedLoop) => setDraft(loopToDraft(loop)),
    [],
  )

  const resetDraft = useCallback(() => setDraft(newDraft()), [])

  /* ── Screen wake lock: speech stops when a phone sleeps ── */

  const requestWakeLock = useCallback(async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request('screen')
      }
    } catch {
      /* Denied or unsupported — the session still runs, the screen may dim. */
    }
  }, [])

  const releaseWakeLock = useCallback(() => {
    void wakeLockRef.current?.release().catch(() => undefined)
    wakeLockRef.current = null
  }, [])

  /* ── Elapsed clock ── */

  const startElapsed = useCallback(() => {
    const state = elapsedRef.current
    state.startedAt = Date.now()
    if (state.interval != null) clearInterval(state.interval)
    state.interval = window.setInterval(() => {
      setSession((current) =>
        current.status === 'playing'
          ? {
              ...current,
              elapsedSeconds: Math.floor((Date.now() - state.startedAt) / 1000),
            }
          : current,
      )
    }, 1000)
  }, [])

  const stopElapsed = useCallback(() => {
    const state = elapsedRef.current
    if (state.interval != null) {
      clearInterval(state.interval)
      state.interval = null
    }
  }, [])

  /* ── Stop ── */

  const finish = useCallback(
    (status: SessionStatus, notice: string | null) => {
      speechRef.current?.stop()
      musicRef.current?.stop()
      timerRef.current?.stop()
      stopElapsed()
      releaseWakeLock()
      setSession((current) => ({
        ...current,
        status,
        remainingSeconds: status === 'complete' ? 0 : null,
        trackName: null,
        notice,
      }))
    },
    [releaseWakeLock, stopElapsed],
  )

  const stop = useCallback(() => finish('idle', null), [finish])

  /* ── Start ── */

  const start = useCallback(
    (source?: SavedLoop) => {
      const music = musicRef.current
      const speech = speechRef.current
      const timer = timerRef.current
      if (!music || !speech || !timer) return

      const settings: LoopSettings = source
        ? { ...source, sound: { ...source.sound } }
        : draft.settings
      const text = source ? source.text : draft.text
      const title = (source ? source.title : draft.title).trim() || 'Untitled loop'

      // Reach for audio permission while we are still inside the tap.
      music.unlock()

      const started = speech.start(
        {
          text,
          voiceURI: settings.voiceURI,
          rate: settings.rate,
          pitch: settings.pitch,
          volume: settings.voiceVolume,
          repeatPauseMs: settings.repeatPauseSeconds * 1000,
          loop: true,
        },
        {
          onChunk: (chunkIndex, chunkTotal) =>
            setSession((current) => ({ ...current, chunkIndex, chunkTotal })),
          onCycle: (cycles) => setSession((current) => ({ ...current, cycles })),
          onError: (message) =>
            setSession((current) => ({ ...current, notice: message })),
          onFinish: () => finish('idle', null),
        },
      )

      if (!started) return

      setSession({
        ...EMPTY_SESSION,
        status: 'playing',
        title,
        chunkTotal: speech.chunkCount,
        remainingSeconds:
          settings.timerMinutes != null ? settings.timerMinutes * 60 : null,
      })

      startElapsed()
      void requestWakeLock()

      music.setHandlers({
        onTrackChange: (track) =>
          setSession((current) => ({ ...current, trackName: track?.name ?? null })),
        onError: (message) =>
          setSession((current) => ({ ...current, notice: message })),
      })
      music.setVolume(settings.musicVolume)
      void resolveTrackSources(settings).then((sources) => {
        if (sources.length > 0) void music.play(sources, settings.sound.repeat)
      })

      if (settings.timerMinutes != null) {
        timer.start(settings.timerMinutes * 60_000, {
          onTick: (remainingSeconds) =>
            setSession((current) =>
              current.status === 'playing'
                ? { ...current, remainingSeconds }
                : current,
            ),
          onComplete: () => finish('complete', null),
        })
      }
    },
    [draft, finish, requestWakeLock, startElapsed],
  )

  const pause = useCallback(() => {
    speechRef.current?.pause()
    musicRef.current?.suspend()
    timerRef.current?.pause()
    stopElapsed()
    releaseWakeLock()
    setSession((current) => ({ ...current, status: 'paused' }))
  }, [releaseWakeLock, stopElapsed])

  const resume = useCallback(() => {
    const music = musicRef.current
    music?.unlock()
    music?.resumePlayback()
    speechRef.current?.resume()
    timerRef.current?.resume()
    setSession((current) => ({ ...current, status: 'playing' }))
    startElapsed()
    void requestWakeLock()
  }, [requestWakeLock, startElapsed])

  const dismissNotice = useCallback(
    () => setSession((current) => ({ ...current, notice: null })),
    [],
  )

  /* ── Live adjustments ── */

  const setLiveVoiceVolume = useCallback(
    (value: number) => {
      updateSettings({ voiceVolume: value })
      speechRef.current?.updateOptions({ volume: value })
    },
    [updateSettings],
  )

  const setLiveMusicVolume = useCallback(
    (value: number) => {
      updateSettings({ musicVolume: value })
      musicRef.current?.setVolume(value)
    },
    [updateSettings],
  )

  const setLiveRate = useCallback(
    (value: number) => {
      updateSettings({ rate: value })
      speechRef.current?.updateOptions({ rate: value })
    },
    [updateSettings],
  )

  /* ── Lifecycle ── */

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        musicRef.current?.resumeIfSuspended()
        if (wakeLockRef.current === null && session.status === 'playing') {
          void requestWakeLock()
        }
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [requestWakeLock, session.status])

  useEffect(() => {
    const speech = speechRef.current
    const music = musicRef.current
    const timer = timerRef.current
    return () => {
      speech?.stop()
      music?.dispose()
      timer?.stop()
      stopElapsed()
    }
  }, [stopElapsed])

  const value = useMemo<SessionContextValue>(
    () => ({
      draft,
      updateDraft,
      updateSettings,
      loadIntoDraft,
      resetDraft,
      voices,
      voicesReady,
      speechSupported,
      session,
      start,
      pause,
      resume,
      stop,
      dismissNotice,
      setLiveVoiceVolume,
      setLiveMusicVolume,
      setLiveRate,
    }),
    [
      draft,
      updateDraft,
      updateSettings,
      loadIntoDraft,
      resetDraft,
      voices,
      voicesReady,
      speechSupported,
      session,
      start,
      pause,
      resume,
      stop,
      dismissNotice,
      setLiveVoiceVolume,
      setLiveMusicVolume,
      setLiveRate,
    ],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext)
  if (!context) throw new Error('useSession must be used inside <SessionProvider>')
  return context
}

/** Turn a saved sound configuration into playable sources. */
async function resolveTrackSources(settings: LoopSettings): Promise<TrackSource[]> {
  const { sound } = settings
  if (sound.mode === 'off') return []

  const ids =
    sound.mode === 'playlist'
      ? sound.playlist
      : sound.trackId
        ? [sound.trackId]
        : []

  const sources: TrackSource[] = []

  for (const id of ids) {
    if (id === 'moon-garden' || id === 'soft-horizon') {
      sources.push({
        id,
        name: id === 'moon-garden' ? 'Moon Garden' : 'Soft Horizon',
        kind: 'builtin',
        presetId: id,
      })
      continue
    }

    try {
      const stored = await storage.getCustomTrack(id)
      if (stored) {
        sources.push({
          id: stored.id,
          name: stored.name,
          kind: 'custom',
          blob: stored.blob,
        })
      }
    } catch {
      /* A missing track is skipped rather than breaking the session. */
    }
  }

  return sources
}
