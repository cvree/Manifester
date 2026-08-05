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
import { findAmbientPreset } from '../lib/ambient'
import { MusicEngine, type TrackSource } from '../lib/audio'
import { AudioBus } from '../lib/audioBus'
import {
  BrainwaveVoice,
  normaliseBrainwave,
  type BrainwaveSettings,
} from '../lib/brainwaveAudio'
import { loopToDraft, normaliseSettings, type Draft } from '../lib/loops'
import {
  LIVE_VOICE_VOLUME_CAP,
  SpeechLooper,
  isSpeechSupported,
  loadVoices,
} from '../lib/speech'
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
  /** Seconds left in the delay between loops, or `null` while speaking. */
  delayRemaining: number | null
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
  previewVoice: (style?: 'feminine' | 'masculine', text?: string) => void
  stopPreview: () => void
  previewState: 'idle' | 'loading' | 'playing'

  session: SessionSnapshot
  /**
   * Opens the audio hardware from inside a user gesture. The Start button
   * animates for a beat before it navigates, and by then the tap is over as
   * far as Safari is concerned — so the unlock has to happen first.
   */
  prime: () => void
  start: (source?: SavedLoop) => void
  pause: () => void
  resume: () => void
  stop: () => void
  dismissNotice: () => void

  /** Live volume/rate changes that apply without restarting the session. */
  setLiveVoiceVolume: (value: number) => void
  setLiveMusicVolume: (value: number) => void
  setLiveRate: (value: number) => void
  /** Change the brainwave rhythm, taking effect at once during a session. */
  setBrainwave: (patch: Partial<BrainwaveSettings>) => void
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
  delayRemaining: null,
}

function newDraft(): Draft {
  return {
    id: null,
    title: '',
    text: '',
    settings: {
      ...DEFAULT_SETTINGS,
      sound: { ...DEFAULT_SETTINGS.sound },
      brainwave: { ...DEFAULT_SETTINGS.brainwave },
    },
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
  const brainwaveRef = useRef<BrainwaveVoice | null>(null)
  const timerRef = useRef<SessionTimer | null>(null)
  const elapsedRef = useRef<{ startedAt: number; interval: number | null }>({
    startedAt: 0,
    interval: null,
  })
  /**
   * True between `start()` and `finish()`. Generated sound is only ever touched
   * while this holds, which is what guarantees nothing reaches for the audio
   * hardware outside a real tap — including on first load.
   */
  const liveRef = useRef(false)
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)

  const speechSupported = useMemo(isSpeechSupported, [])

  if (!busRef.current) busRef.current = new AudioBus()
  if (!speechRef.current) speechRef.current = new SpeechLooper()
  if (!musicRef.current) musicRef.current = new MusicEngine(busRef.current)
  if (!brainwaveRef.current) brainwaveRef.current = new BrainwaveVoice(busRef.current)
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
    (style?: 'feminine' | 'masculine', text?: string) => {
      const settings = draft.settings
      const wantedStyle = style ?? settings.voiceStyle

      if (!isSpeechSupported()) return
      window.speechSynthesis.cancel()

      const synth = window.speechSynthesis
      const sample = text?.trim() || 'This is how your words will sound.'
      // Long drafts would tie up the preview for a minute; one line is enough
      // to hear the voice.
      const utterance = new SpeechSynthesisUtterance(
        sample.length > 180 ? `${sample.slice(0, 180)}…` : sample,
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
      // The setting can go above 1 for exported recordings; the live preview
      // still speaks at the browser's own hard ceiling.
      utterance.volume = Math.min(LIVE_VOICE_VOLUME_CAP, settings.voiceVolume)
      utterance.onend = () => setPreviewState('idle')
      utterance.onerror = () => setPreviewState('idle')

      setPreviewState('playing')
      synth.speak(utterance)
    },
    [draft.settings, voices],
  )

  const stopPreview = useCallback(() => {
    if (isSpeechSupported()) window.speechSynthesis.cancel()
    setPreviewState('idle')
  }, [])

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
      const remaining = speechRef.current?.delayRemainingSeconds ?? null
      setSession((current) =>
        current.status === 'playing'
          ? {
              ...current,
              elapsedSeconds: Math.floor((Date.now() - state.startedAt) / 1000),
              delayRemaining: remaining == null ? null : Math.ceil(remaining),
            }
          : current,
      )
    }, 250)
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
      brainwaveRef.current?.stop()
      timerRef.current?.stop()
      liveRef.current = false
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

  const prime = useCallback(() => {
    busRef.current?.ensure()
    musicRef.current?.unlock()
  }, [])

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

      liveRef.current = true
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
      music.setAmbienceOptions({ rainCharacter: settings.sound.rainCharacter })
      void resolveTrackSources(settings).then((sources) => {
        if (sources.length > 0) void music.play(sources, settings.sound.repeat)
      })

      // The rhythm is a sibling of the ambience, not part of it: it plays on
      // its own whether or not a soundscape was chosen.
      brainwaveRef.current?.apply(settings.brainwave)

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
    // Freeze the countdown where it stopped rather than letting it drift.
    const remaining = speechRef.current?.delayRemainingSeconds ?? null
    setSession((current) => ({
      ...current,
      status: 'paused',
      delayRemaining: remaining == null ? null : Math.ceil(remaining),
    }))
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

  const setBrainwave = useCallback<SessionContextValue['setBrainwave']>(
    (patch) => {
      setDraft((current) => {
        const brainwave = normaliseBrainwave({
          ...current.settings.brainwave,
          ...patch,
        })
        const settings = { ...current.settings, brainwave }
        void storage.saveLastSettings(settings)
        // Only a running session touches the audio graph; editing while idle is
        // just editing.
        if (liveRef.current) brainwaveRef.current?.apply(brainwave)
        return { ...current, settings }
      })
    },
    [],
  )

  /**
   * Rain's character can change mid-session. The engine ignores this unless an
   * ambience is already playing, so it can never start one.
   */
  useEffect(() => {
    musicRef.current?.setAmbienceOptions({
      rainCharacter: draft.settings.sound.rainCharacter,
    })
  }, [draft.settings.sound.rainCharacter])

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
    const brainwave = brainwaveRef.current
    const timer = timerRef.current
    const bus = busRef.current
    return () => {
      speech?.stop()
      music?.dispose()
      brainwave?.dispose()
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
      stopPreview,
      previewState,
      session,
      prime,
      start,
      pause,
      resume,
      stop,
      dismissNotice,
      setLiveVoiceVolume,
      setLiveMusicVolume,
      setLiveRate,
      setBrainwave,
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
      stopPreview,
      previewState,
      session,
      prime,
      start,
      pause,
      resume,
      stop,
      dismissNotice,
      setLiveVoiceVolume,
      setLiveMusicVolume,
      setLiveRate,
      setBrainwave,
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
    const preset = findAmbientPreset(id)
    if (preset) {
      sources.push({
        id,
        name: preset.name,
        kind: 'builtin',
        presetId: preset.id,
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
