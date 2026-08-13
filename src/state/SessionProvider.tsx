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
import { configureBreath, setBreathActive } from '../lib/breathEngine'
import { beat } from '../lib/heartbeat'
import { useLibrary } from './LibraryProvider'
import { usePreferences } from './PreferencesProvider'
import {
  BrainwaveVoice,
  normaliseBrainwave,
  type BrainwaveSettings,
} from '../lib/brainwaveAudio'
import { loopToDraft, normaliseSettings, pickLaunchLoop, type Draft } from '../lib/loops'
import { ActiveTimeClock } from '../lib/sessionClock'
import { soundPlaybackChanged } from '../lib/soundChoice'
import {
  LIVE_VOICE_VOLUME_CAP,
  SpeechLooper,
  clampVoiceVolume,
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
  type SoundConfig,
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
  /**
   * The exact words being spoken right now, straight from the voice engine.
   *
   * The player shows this rather than looking a line up by index. An index has
   * to be interpreted, and interpreting it wrongly is how the screen ended up
   * showing one thing while the voice said another.
   */
  chunkText: string
  trackName: string | null
  notice: string | null
  /** Seconds left in the delay between loops, or `null` while speaking. */
  delayRemaining: number | null
}

interface SessionContextValue {
  ready: boolean
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
  setLivePitch: (value: number) => void
  /**
   * Change who is reading, mid-session, without restarting it.
   *
   * `voiceURI` of `null` means "the best voice of this style on this device",
   * which is the same question `start` asks — so it is resolved here rather
   * than handed to the speech loop unanswered.
   */
  setLiveVoice: (patch: {
    voiceURI: string | null
    voiceName: string | null
    voiceStyle?: LoopSettings['voiceStyle']
  }) => void
  /** Change the brainwave rhythm, taking effect at once during a session. */
  setBrainwave: (patch: Partial<BrainwaveSettings>) => void
  /**
   * Change the background sound mid-session.
   *
   * The whole point of this one is that it does not restart anything: a
   * different soundscape crossfades in under the words, and the voice, the
   * clock, the breath and the pass counter carry straight on. Off is a fade
   * out, not a stop.
   */
  setLiveSound: (patch: Partial<SoundConfig>) => void
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
  chunkText: '',
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
  const { preferences } = usePreferences()
  const {
    loops,
    ready: libraryReady,
    touchLoop,
    recordListening,
  } = useLibrary()
  const [draft, setDraft] = useState<Draft>(newDraft)
  const [ready, setReady] = useState(false)
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
  const elapsedRef = useRef<{ clock: ActiveTimeClock; interval: number | null }>({
    clock: new ActiveTimeClock(),
    interval: null,
  })
  const listeningRef = useRef({
    recordedSeconds: 0,
    counted: false,
    startedAt: 0,
  })
  const statusRef = useRef<SessionStatus>('idle')
  const draftTouchedRef = useRef(false)
  /**
   * True between `start()` and `finish()`. Generated sound is only ever touched
   * while this holds, which is what guarantees nothing reaches for the audio
   * hardware outside a real tap — including on first load.
   */
  const liveRef = useRef(false)
  /**
   * Bumped on every live sound change, so a slow one cannot land after a
   * later, faster one. An imported track is fetched from IndexedDB; a
   * generated ambience is not.
   */
  const soundGenerationRef = useRef(0)
  /**
   * A sound chosen while the session was paused, waiting for the resume that
   * is allowed to make a noise.
   */
  const pendingSoundRef = useRef(false)
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

  /* ── Restore the returning user's last loop ── */

  useEffect(() => {
    if (!libraryReady || ready) return
    let cancelled = false
    void storage.loadLastSettings().then((saved) => {
      if (cancelled) return
      const last = pickLaunchLoop(loops)
      setDraft((current) => {
        if (draftTouchedRef.current) return current
        if (last) return loopToDraft(last)
        return saved
          ? {
              ...current,
              settings: normaliseSettings({ ...current.settings, ...saved }),
            }
          : current
      })
      setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [libraryReady, loops, ready])

  /* ── Draft editing ── */

  const updateDraft = useCallback<SessionContextValue['updateDraft']>((patch) => {
    draftTouchedRef.current = true
    setDraft((current) => ({ ...current, ...patch }))
  }, [])

  const updateSettings = useCallback<SessionContextValue['updateSettings']>(
    (patch) => {
      draftTouchedRef.current = true
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

  const loadIntoDraft = useCallback((loop: SavedLoop) => {
    draftTouchedRef.current = true
    setDraft(loopToDraft(loop))
  }, [])

  const resetDraft = useCallback(() => {
    draftTouchedRef.current = true
    setDraft(newDraft())
  }, [])

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
      // Belt and braces: the setting cannot exceed this any more, but the
      // engine's own ceiling is the thing that must never be exceeded.
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

  /* ── Active listening clock and persistent total ── */

  const flushListening = useCallback(
    (now = Date.now()) => {
      const total = Math.floor(elapsedRef.current.clock.elapsedSeconds(now))
      const state = listeningRef.current
      const delta = Math.max(0, total - state.recordedSeconds)
      if (delta <= 0) return
      const countSession = !state.counted && total >= 1
      recordListening(delta, countSession, state.startedAt || now)
      state.recordedSeconds = total
      if (countSession) state.counted = true
    },
    [recordListening],
  )

  const clearElapsedInterval = useCallback(() => {
    const state = elapsedRef.current
    if (state.interval != null) {
      clearInterval(state.interval)
      state.interval = null
    }
  }, [])

  const startElapsed = useCallback(
    (reset = false) => {
      const now = Date.now()
      const state = elapsedRef.current
      if (reset) state.clock.start(now)
      else state.clock.resume(now)
      clearElapsedInterval()
      state.interval = window.setInterval(() => {
        const tickAt = Date.now()
        const elapsedSeconds = Math.floor(state.clock.elapsedSeconds(tickAt))
        const remaining = speechRef.current?.delayRemainingSeconds ?? null
        setSession((current) =>
          current.status === 'playing'
            ? {
                ...current,
                elapsedSeconds,
                delayRemaining: remaining == null ? null : Math.ceil(remaining),
              }
            : current,
        )
        if (elapsedSeconds - listeningRef.current.recordedSeconds >= 5) {
          flushListening(tickAt)
        }
      }, 250)
    },
    [clearElapsedInterval, flushListening],
  )

  const pauseElapsed = useCallback(() => {
    const now = Date.now()
    const state = elapsedRef.current
    state.clock.pause(now)
    clearElapsedInterval()
    const elapsedSeconds = Math.floor(state.clock.elapsedSeconds(now))
    setSession((current) => ({ ...current, elapsedSeconds }))
    flushListening(now)
  }, [clearElapsedInterval, flushListening])

  const stopElapsed = useCallback(() => {
    pauseElapsed()
    elapsedRef.current.clock.reset()
  }, [pauseElapsed])

  /* ── The background sound, while a session is running ── */

  /**
   * Put a sound configuration through the engine without disturbing anything
   * else.
   *
   * `play` fades the outgoing ambience out as the incoming one rises, so this
   * is heard as a change of weather rather than as a restart: the voice, the
   * clock, the breath and the timer never learn that it happened.
   */
  const applyLiveSound = useCallback((settings: LoopSettings) => {
    const music = musicRef.current
    if (!music) return

    // Synchronously, while the tap that got us here is still a tap: iOS will
    // not open a media element outside one.
    music.unlock()

    if (settings.sound.mode === 'off') {
      music.stop()
      return
    }

    const generation = soundGenerationRef.current + 1
    soundGenerationRef.current = generation

    void resolveTrackSources(settings).then((sources) => {
      // A third choice made while the second was still being read out of
      // IndexedDB must not arrive after it.
      if (!liveRef.current || generation !== soundGenerationRef.current) return
      if (sources.length > 0) void music.play(sources, settings.sound.repeat)
      else music.stop()
    })
  }, [])

  /* ── Stop ── */

  const finish = useCallback(
    (status: SessionStatus, notice: string | null) => {
      statusRef.current = status
      speechRef.current?.stop()
      musicRef.current?.stop()
      brainwaveRef.current?.stop()
      timerRef.current?.stop()
      liveRef.current = false
      pendingSoundRef.current = false
      stopElapsed()
      listeningRef.current = {
        recordedSeconds: 0,
        counted: false,
        startedAt: 0,
      }
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

      if (liveRef.current) finish('idle', null)

      const settings: LoopSettings = source
        ? normaliseSettings(source)
        : draft.settings
      const text = source ? source.text : draft.text
      const title = (source ? source.title : draft.title).trim() || 'Untitled loop'

      // Reach for audio permission while we are still inside the tap.
      bus.ensure()
      bus.beginGentleStart()
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
          initialDelayMs: 420,
          loop: true,
        },
        {
          onChunk: (chunkIndex, chunkTotal, chunkText) =>
            setSession((current) => ({ ...current, chunkIndex, chunkTotal, chunkText })),
          onCycle: (cycles) => setSession((current) => ({ ...current, cycles })),
          onError: (message) =>
            setSession((current) => ({ ...current, notice: message })),
          onFinish: () => finish('idle', null),
        },
      )

      if (!started) return

      liveRef.current = true
      statusRef.current = 'playing'
      const startedAt = Date.now()
      listeningRef.current = {
        recordedSeconds: 0,
        counted: false,
        startedAt,
      }
      const loopId = source?.id ?? draft.id
      if (loopId) void touchLoop(loopId)
      setSession({
        ...EMPTY_SESSION,
        status: 'playing',
        title,
        chunkTotal: speech.chunkCount,
        remainingSeconds:
          settings.timerMinutes != null ? settings.timerMinutes * 60 : null,
      })
      startElapsed(true)
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
    [draft, finish, requestWakeLock, startElapsed, touchLoop, voices],
  )

  const pause = useCallback(() => {
    if (statusRef.current !== 'playing') return
    statusRef.current = 'paused'
    speechRef.current?.pause()
    musicRef.current?.suspend()
    busRef.current?.suspend()
    timerRef.current?.pause()
    pauseElapsed()
    releaseWakeLock()
    const remaining = speechRef.current?.delayRemainingSeconds ?? null
    setSession((current) => ({
      ...current,
      status: 'paused',
      delayRemaining: remaining == null ? null : Math.ceil(remaining),
    }))
  }, [pauseElapsed, releaseWakeLock])

  const resume = useCallback(() => {
    if (statusRef.current !== 'paused') return
    statusRef.current = 'playing'
    busRef.current?.ensure()
    musicRef.current?.unlock()

    if (pendingSoundRef.current) {
      pendingSoundRef.current = false
      applyLiveSound(draft.settings)
    } else {
      musicRef.current?.resumePlayback()
    }

    speechRef.current?.resume()
    timerRef.current?.resume()
    setSession((current) => ({ ...current, status: 'playing' }))
    startElapsed(false)
    void requestWakeLock()
  }, [applyLiveSound, draft.settings, requestWakeLock, startElapsed])

  const dismissNotice = useCallback(
    () => setSession((current) => ({ ...current, notice: null })),
    [],
  )

  /* ── Live adjustments ── */

  const setLiveVoiceVolume = useCallback(
    (value: number) => {
      const level = clampVoiceVolume(value)
      updateSettings({ voiceVolume: level })
      speechRef.current?.updateOptions({ volume: level })
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

  const setLivePitch = useCallback(
    (value: number) => {
      updateSettings({ pitch: value })
      speechRef.current?.updateOptions({ pitch: value })
    },
    [updateSettings],
  )

  const setLiveVoice = useCallback<SessionContextValue['setLiveVoice']>(
    ({ voiceURI, voiceName, voiceStyle }) => {
      updateSettings({
        voiceURI,
        voiceName,
        ...(voiceStyle ? { voiceStyle } : {}),
      })
      speechRef.current?.updateOptions({
        voiceURI:
          voiceURI ??
          pickBestVoice(voices, voiceStyle ?? draft.settings.voiceStyle)
            ?.voiceURI ??
          null,
      })
    },
    [updateSettings, voices, draft.settings.voiceStyle],
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
   * Change the background sound while the words keep going.
   *
   * Choosing a sound used to mean leaving the player, and coming back to a
   * session that had been stopped to get there. Nothing is torn down here: the
   * engine's own `play` fades the outgoing ambience out as the incoming one
   * rises, so a swap is heard as a change of weather rather than as a restart.
   *
   * Two things are deliberately *not* done. A change the engine is already
   * following — rain's character, or repeat while a single sound plays — is
   * left to it, because rebuilding the queue would restart an ambience that
   * only needed adjusting. And nothing touches the audio graph unless a
   * session is actually live, so editing a draft stays editing.
   */
  const setLiveSound = useCallback<SessionContextValue['setLiveSound']>(
    (patch) => {
      const previous = draft.settings.sound
      const sound: SoundConfig = { ...previous, ...patch }
      updateSettings({ sound })

      if (!liveRef.current) return
      if (!soundPlaybackChanged(previous, sound)) return

      /*
       * Paused is not a quiet kind of playing. A generated ambience would be
       * silent either way — the whole context is suspended — but an imported
       * file plays through a media element that the suspension never reaches,
       * so starting one here would be sound coming out of a paused session.
       * It waits for the resume instead, which is the moment sound is wanted
       * and the moment a browser will allow it.
       */
      if (session.status === 'paused') {
        pendingSoundRef.current = true
        return
      }

      applyLiveSound({ ...draft.settings, sound })
    },
    [applyLiveSound, draft.settings, session.status, updateSettings],
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

  /* ── The breathing guide ── */

  /*
   * The guide is driven from here, and that is the whole point of it being
   * here.
   *
   * It used to be driven from inside the player's own animation loop, which
   * meant it stopped when the player was not on screen and stopped again when
   * the tab was not on screen — so leaving the player for the library silenced
   * the breath cues under a session that was otherwise still running, and
   * switching tabs silenced them and then made them lurch on the way back. The
   * session provider is the one thing in this app that is mounted for as long
   * as there is a session, so this is where the guide belongs; the player draws
   * a picture of it and nothing more. See `breathEngine`.
   */
  useEffect(() => {
    configureBreath({
      pattern: preferences.breathPattern,
      sound: preferences.breathSound,
      volume: preferences.breathSoundVolume,
      haptics: preferences.breathHapticCues,
    })
  }, [
    preferences.breathPattern,
    preferences.breathSound,
    preferences.breathSoundVolume,
    preferences.breathHapticCues,
  ])

  useEffect(() => {
    setBreathActive(preferences.breathingEnabled && session.status === 'playing')
  }, [preferences.breathingEnabled, session.status])

  /* ── Lifecycle ── */

  useEffect(() => {
    const recover = () => {
      if (document.visibilityState !== 'visible') return
      /*
       * The media element was the only thing being recovered here, which
       * left the whole generated mix behind: every ambience and the
       * brainwave rhythm live on the bus's `AudioContext`, and a phone that
       * has been locked, taken a call, or simply let another app have the
       * audio route hands that context back suspended — or, on iOS,
       * interrupted. The session would come back with a running clock, a
       * moving orb and a spoken voice, and no sound underneath any of it.
       */
      if (session.status === 'playing') busRef.current?.resume()
      musicRef.current?.resumeIfSuspended()
      if (wakeLockRef.current === null && session.status === 'playing') {
        void requestWakeLock()
      }
      /*
       * And a catch-up on everything that schedules ahead — the breath, the
       * ambience's transients, the gap between repetitions — so anything a
       * throttled timer left undone is done on this turn rather than up to
       * half a second later, which is long enough to hear.
       */
      beat()
      if (session.status === 'playing') speechRef.current?.recover()
    }
    const persist = () => flushListening()
    document.addEventListener('visibilitychange', recover)
    window.addEventListener('pageshow', recover)
    window.addEventListener('pagehide', persist)
    return () => {
      document.removeEventListener('visibilitychange', recover)
      window.removeEventListener('pageshow', recover)
      window.removeEventListener('pagehide', persist)
    }
  }, [flushListening, requestWakeLock, session.status])

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
      setBreathActive(false)
      stopElapsed()
    }
  }, [stopElapsed])

  const value = useMemo<SessionContextValue>(
    () => ({
      ready,
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
      setLivePitch,
      setLiveVoice,
      setBrainwave,
      setLiveSound,
    }),
    [
      ready,
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
      setLivePitch,
      setLiveVoice,
      setBrainwave,
      setLiveSound,
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
