/**
 * The playback session: what is being spoken, over what, and for how long.
 *
 * This provider owns the engines (voice, music, timer), the draft the Create
 * tab edits, and the live state the Player tab renders.
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
import { AudioBus } from '../lib/audioBus'
import { loopToDraft, normaliseSettings, type Draft } from '../lib/loops'
import { SpeechLooper, isSpeechSupported, loadVoices } from '../lib/speech'
import * as storage from '../lib/storage'
import { SessionTimer } from '../lib/timer'
import {
  DEFAULT_SETTINGS,
  type LoopSettings,
  type SavedLoop,
  type SessionStatus,
} from '../lib/types'
import {
  pickBestVoice,
  rankVoices,
  type RankedVoice,
} from '../lib/voiceRanking'

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

  /** Every device voice, best first. */
  voices: RankedVoice[]
  voicesReady: boolean
  speechSupported: boolean
  /** The voice that the current style setting resolves to. */
  resolvedDeviceVoice: RankedVoice | null

  /** Speak a short sample with whatever voice the settings resolve to. */
  previewVoice: (style?: 'feminine' | 'masculine') => void
  previewState: 'idle' | 'loading' | 'playing'

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
  const [voices, setVoices] = useState<RankedVoice[]>([])
  const [voicesReady, setVoicesReady] = useState(false)
  const [session, setSession] = useState<SessionSnapshot>(EMPTY_SESSION)
  const [previewState, setPreviewState] =
    useState<SessionContextValue['previewState']>('idle')

  const busRef = useRef<AudioBus | null>(null)
  const speechRef = useRef<SpeechLooper | null>(null)
  const musicRef = useRef<MusicEngine | null>(null)
  const timerRef = useRef<SessionTimer | null>(null)
  const elapsedRef = useRef<{ startedAt: number; interval: number | null }>({
    startedAt: 0,
    interval: null,
  })
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)

  const speechSupported = useMemo(isSpeechSupported, [])

  if (!busRef.current) busRef.current = new AudioBus()
  if (!speechRef.current) speechRef.current = new SpeechLooper()
  if (!musicRef.current) musicRef.current = new MusicEngine(busRef.current)
  if (!timerRef.current) timerRef.current = new SessionTimer()

  /* ── Voices ── */

  useEffect(() => {
    let cancelled = false

    async function pull() {
      const list = await loadVoices()
      if (cancelled) return
      speechRef.current?.setVoices(list)
      setVoices(rankVoices(list))
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

  /** The device voice this style setting actually lands on. */
  const resolvedDeviceVoice = useMemo(() => {
    if (draft.settings.voiceURI) {
      const chosen = voices.find(
        (voice) => voice.voiceURI === draft.settings.voiceURI,
      )
      if (chosen) return chosen
    }
    return pickBestVoice(voices, draft.settings.voiceStyle)
  }, [voices, draft.settings.voiceURI, draft.settings.voiceStyle])

  /* ── Restore last-used settings ── */

  useEffect(() => {
    let cancelled = false
    void storage.loadLastSettings().then((saved) => {
      if (cancelled || !saved) return
      setDraft((current) => ({
        ...current,
        settings: normaliseSettings({ ...current.settings, ...saved }),
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

  /* ── Voice preview ── */

  const previewVoice = useCallback(
    (style?: 'feminine' | 'masculine') => {
      const settings = draft.settings
      const wantedStyle = style ?? settings.voiceStyle

      if (!isSpeechSupported()) return
      window.speechSynthesis.cancel()

      const synth = window.speechSynthesis
      const utterance = new SpeechSynthesisUtterance(
        'This is how your words will sound.',
      )
      const target =
        (settings.voiceURI && !style
          ? voices.find((item) => item.voiceURI === settings.voiceURI)
          : null) ?? pickBestVoice(voices, wantedStyle)

      const match = target
        ? synth.getVoices().find((item) => item.voiceURI === target.voiceURI)
        : undefined
      if (match) {
        utterance.voice = match
        utterance.lang = match.lang
      }
      utterance.rate = settings.rate
      utterance.pitch = settings.pitch
      utterance.volume = settings.voiceVolume
      utterance.onend = () => setPreviewState('idle')
      utterance.onerror = () => setPreviewState('idle')

      setPreviewState('playing')
      synth.speak(utterance)
    },
    [draft.settings, voices],
  )

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
      const bus = busRef.current
      const music = musicRef.current
      const speech = speechRef.current
      const timer = timerRef.current
      if (!bus || !music || !speech || !timer) return

      const settings: LoopSettings = source
        ? normaliseSettings(source)
        : draft.settings
      const text = source ? source.text : draft.text
      const title = (source ? source.title : draft.title).trim() || 'Untitled loop'

      // Reach for audio permission while we are still inside the tap.
      bus.ensure()
      music.unlock()

      const started = speech.start(
        {
          text,
          voiceURI:
            settings.voiceURI ??
            pickBestVoice(voices, settings.voiceStyle)?.voiceURI ??
            null,
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
    [draft, finish, requestWakeLock, startElapsed, voices],
  )

  const pause = useCallback(() => {
    speechRef.current?.pause()
    musicRef.current?.suspend()
    busRef.current?.suspend()
    timerRef.current?.pause()
    stopElapsed()
    releaseWakeLock()
    setSession((current) => ({ ...current, status: 'paused' }))
  }, [releaseWakeLock, stopElapsed])

  const resume = useCallback(() => {
    busRef.current?.ensure()
    musicRef.current?.unlock()
    musicRef.current?.resumePlayback()
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
    const bus = busRef.current
    return () => {
      speech?.stop()
      music?.dispose()
      timer?.stop()
      bus?.close()
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
      resolvedDeviceVoice,
      previewVoice,
      previewState,
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
      resolvedDeviceVoice,
      previewVoice,
      previewState,
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
