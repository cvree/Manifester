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
import { setCueDucking } from '../lib/feedback'
import { beat } from '../lib/heartbeat'
import { useLibrary } from './LibraryProvider'
import { usePreferences } from './PreferencesProvider'
import {
  BrainwaveVoice,
  normaliseBrainwave,
  type BrainwaveSettings,
} from '../lib/brainwaveAudio'
import {
  autoTitle,
  loopToDraft,
  normaliseSettings,
  pickLaunchLoop,
  type Draft,
} from '../lib/loops'
import { ActiveTimeClock } from '../lib/sessionClock'
import { soundPlaybackChanged } from '../lib/soundChoice'
import { soundtrack } from '../lib/soundtrack'
import {
  effectiveLevel,
  layersChanged,
  primarySourceId,
  withLayer,
  withLevel,
  withMuted,
  withoutLayer,
} from '../lib/soundMixer'
import {
  chunkText as splitIntoLines,
  clampVoiceVolume,
  isSpeechSupported,
  loadVoices,
} from '../lib/speech'
import { tts } from '../lib/tts'
import { voiceForStyle } from '../lib/tts/voices'
import { VOICE_SAMPLE } from '../lib/tts/knownPhrases'
import { VoiceLooper } from '../lib/voiceLoop'
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
  rankVoices,
  resolveVoiceChoice,
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
  /**
   * True while a line is being fetched or synthesised.
   *
   * Nearly always false for long enough to be invisible — a cached line is
   * ready in a millisecond — and true for a second or two the first time
   * somebody plays words nobody has ever played before. Saying so is the
   * difference between a considered pause and an app that appears to have
   * ignored the button.
   */
  voicePreparing: boolean
  /**
   * True for a session with nothing to say.
   *
   * Manifester with no words in it is a breathwork app, and this is what says
   * so: the breath, the room, the ambience, the rhythm, the timer and the
   * clock all run exactly as they always do, and the voice loop is simply
   * never started. It is a fact about the *session* rather than about the
   * draft, because the player has to keep telling the truth after somebody
   * types their first word mid-practice — the session they are in is still the
   * one they started, and it still has no voice in it.
   */
  breathOnly: boolean
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
    voiceSource?: LoopSettings['voiceSource']
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

  /* ── The mixer ── */

  /**
   * One background source's own level, applied to the running graph now.
   *
   * Separate from `setLiveSound` on purpose. That one asks "has the *audio*
   * changed?" and rebuilds a queue when the answer is yes; a level is a ramp on
   * a gain node that already exists, and putting it through the same path would
   * mean a fader that restarts the rain it is adjusting.
   */
  setLayerLevel: (id: string, level: number) => void
  setLayerMuted: (id: string, muted: boolean) => void
  /** Stack a generated ambience under the main sound, or take it back out. */
  setLayerEnabled: (id: string, enabled: boolean) => void
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
  voicePreparing: false,
  breathOnly: false,
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
    recordPlay,
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
  const speechRef = useRef<VoiceLooper | null>(null)
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
  if (!speechRef.current) speechRef.current = new VoiceLooper()
  /*
   * The voice plays through the app's own audio graph now, so it needs the
   * app's own `AudioContext` — the same one the ambience and the breath cues
   * use. One context per page is not a tidiness preference: on iOS a second
   * one is a second thing that can be interrupted, suspended, and left quietly
   * not running, and `AudioBus` already carries every workaround for keeping
   * one alive. Attaching is idempotent.
   */
  tts.attach(busRef.current)
  // And so does the soundtrack, for the same reason and on the same terms: one
  // context, one set of interruption workarounds, one thing to keep alive.
  soundtrack.attach(busRef.current)
  if (!musicRef.current) musicRef.current = new MusicEngine(busRef.current)
  if (!brainwaveRef.current) brainwaveRef.current = new BrainwaveVoice(busRef.current)
  if (!timerRef.current) timerRef.current = new SessionTimer()

  /* ── Voices ── */

  /*
   * Bring the on-device studio voice back, if this device has one.
   *
   * Nothing is downloaded here — see `watchStudioVoice`, which only re-opens
   * files that are already on disk. Doing it from the provider rather than
   * from the voice module means exactly one worker exists no matter how many
   * screens ask about it, and none exists at all in a test that never mounts
   * the app.
   */
  useEffect(() => tts.watchStudioVoice(), [])

  useEffect(() => {
    let cancelled = false

    async function pull() {
      const list = await loadVoices()
      if (cancelled) return
      const ranked = rankVoices(list)
      // The device voices are now the emergency fallback rather than the main
      // event, so they are handed to the voice layer rather than to a speech
      // loop — but they are still loaded exactly as eagerly, because the one
      // moment they are needed is the moment something else has failed.
      tts.setDeviceVoices(list, ranked)
      setVoices(ranked)
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

  /**
   * The device voice this style setting actually lands on.
   *
   * `resolveVoiceChoice` rather than a hand-rolled lookup, because the two
   * halves of the answer are easy to get subtly wrong in different places: an
   * exact choice that is still installed always wins, and everything else —
   * including a saved voice that has since been uninstalled — falls to the
   * best voice *in the language of the words*, never to whatever ranks first
   * on a phone whose interface is in another language.
   */
  const resolvedDeviceVoice = useMemo(
    () =>
      resolveVoiceChoice(
        voices,
        draft.settings.voiceURI,
        draft.settings.voiceStyle,
      ),
    [voices, draft.settings.voiceURI, draft.settings.voiceStyle],
  )

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

  /**
   * Hear the voice, now.
   *
   * The one place in the app where somebody is waiting on a single line rather
   * than listening to a session, which is why it is also the one place with a
   * visible loading state: a studio line that has to be synthesised takes a
   * moment the first time, and a button that says nothing for a second reads
   * as a button that did not work.
   *
   * Reached from a tap, so the hardware is opened here rather than assumed.
   */
  const previewVoice = useCallback(
    (style?: 'feminine' | 'masculine', text?: string) => {
      const settings = draft.settings
      const wantedStyle = style ?? settings.voiceStyle
      const sample = text?.trim() || VOICE_SAMPLE

      busRef.current?.ensure()
      tts.unlock()

      setPreviewState('loading')
      void tts
        .speak(sample.length > 180 ? `${sample.slice(0, 180)}…` : sample, {
          voice: voiceForStyle(wantedStyle),
          speed: settings.rate,
          pitch: settings.pitch,
          volume: settings.voiceVolume,
          prefer: settings.voiceSource === 'device' ? 'device' : 'studio',
          // An explicitly chosen device voice is only honoured when the person
          // is auditioning that voice, not when they are comparing the two
          // studio ones from the style cards.
          deviceVoiceURI: style ? null : settings.voiceURI,
          onStart: () => setPreviewState('playing'),
        })
        .then(() => setPreviewState('idle'))
        .catch(() => setPreviewState('idle'))
    },
    [draft.settings],
  )

  const stopPreview = useCallback(() => {
    tts.stop()
    setPreviewState('idle')
  }, [])

  /* ── What the voice is doing, for the player's status line ── */

  useEffect(
    () =>
      tts.subscribe((status) => {
        setSession((current) =>
          current.voicePreparing === status.loading
            ? current
            : { ...current, voicePreparing: status.loading },
        )
        /*
         * And the music steps back under the words.
         *
         * Driven by the utterance rather than by the session — unlike the
         * interface cues two blocks down — because this one is loud enough for
         * the difference to matter: a bed of music at a steady level under a
         * spoken affirmation is exactly the thing that makes the affirmation
         * harder to hear. The soundtrack holds the duck through the gaps
         * between phrases so it cannot flutter; see `DUCK_HOLD_MS`.
         */
        soundtrack.setDucked(status.speaking)
      }),
    [],
  )

  /*
   * Step the interface cues back while a session is running.
   *
   * A cue is punctuation around the words, never over them. It is already an
   * order of magnitude below a spoken line — see `cueSounds.ts` — and while
   * somebody is actually listening it goes further down still, so adjusting a
   * fader mid-session is felt rather than heard. The signal is the session
   * rather than the utterance on purpose: it is stable across the gaps between
   * lines, and a cue that ducked and un-ducked every four seconds would be
   * more noticeable than one that simply stayed quiet.
   */
  useEffect(() => {
    setCueDucking(session.status === 'playing')
    return () => setCueDucking(false)
  }, [session.status])

  /*
   * A locked phone under a running session is somebody listening with their
   * eyes shut, and a hidden tab with nothing running is a tab they left. The
   * soundtrack treats the two completely differently, and this is how it knows
   * which one it is looking at.
   */
  useEffect(() => {
    soundtrack.setListening(session.status === 'playing')
  }, [session.status])

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

    // The stacked layers are independent of the main choice, so they are
    // brought into line whether or not the main choice is silence — turning
    // the primary sound off leaves rain under the words if that is what
    // somebody built.
    music.setLayers(settings.sound.layers, (id) =>
      effectiveLevel(settings.sound, id),
    )

    if (settings.sound.mode === 'off') {
      // Only the main sound. Anything stacked underneath keeps playing —
      // "no background sound" is a choice about one row of the mixer, not a
      // switch that silently empties the others.
      music.stopPrimary()
      return
    }

    const generation = soundGenerationRef.current + 1
    soundGenerationRef.current = generation

    void resolveTrackSources(settings).then((sources) => {
      // A third choice made while the second was still being read out of
      // IndexedDB must not arrive after it.
      if (!liveRef.current || generation !== soundGenerationRef.current) return
      if (sources.length > 0) {
        void music.play(sources, settings.sound.repeat)
        // The queue was just rebuilt, so the primary gain is new: put the
        // stored level back on it before the ambience finishes fading in.
        music.setPrimaryLevel(primaryLevelFor(settings.sound))
      } else music.stopPrimary()
    })
  }, [])

  /**
   * Put every level in the mix onto the engine, without touching what plays.
   *
   * Called after each fader move. Every one of them is a short ramp on a gain
   * that already exists, so this is safe to call as fast as a finger can
   * generate events — which is exactly the property a draggable mixer needs.
   */
  const applyMixLevels = useCallback((sound: SoundConfig) => {
    const music = musicRef.current
    if (!music) return
    music.setPrimaryLevel(primaryLevelFor(sound))
    for (const id of sound.layers) {
      music.setLayerLevel(id, effectiveLevel(sound, id))
    }
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
    // Opens the audio path for the voice and asks the speech service whether
    // it is there, so the first line does not spend a round trip finding out.
    tts.unlock()
    /*
     * And this is the press the soundtrack has been waiting for.
     *
     * Every route reaches `prime()` from a real gesture — Begin, play, a
     * previewed line — which is exactly the permission a browser requires and
     * exactly the moment somebody has asked the app to do something. Until one
     * of them happens the music does not exist, which is the whole of the "no
     * audio on page load" promise.
     */
    soundtrack.begin()
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
      /*
       * Nothing to say.
       *
       * The same question the voice loop asks itself — it is `chunkText` that
       * decides what counts as a line, so asking anything else here would let
       * the two disagree about a draft made entirely of whitespace and
       * punctuation. Everything below is then written so that a wordless
       * session is a real one: the breath, the room, the ambience, the rhythm,
       * the timer, the wake lock and the listening clock all run, and only the
       * voice is left out. That is Manifester as a breathwork practice, and it
       * is one branch rather than a second player.
       */
      const breathOnly = splitIntoLines(text).length === 0
      /*
       * The same name the library will file it under, rather than "Untitled
       * loop" on the player and something better on the card.
       */
      const title =
        (source ? source.title : draft.title).trim() ||
        (breathOnly ? 'Breathwork' : autoTitle(text))

      // Reach for audio permission while we are still inside the tap.
      bus.ensure()
      bus.beginGentleStart()
      music.unlock()
      tts.unlock()

      // A breath-only session has no voice to start and nothing for it to say;
      // `speech.start` would decline it and post "Add some words first", which
      // is exactly the wrong thing to tell somebody who came here to breathe.
      const started =
        breathOnly ||
        speech.start(
          {
            text,
            voice: voiceForStyle(settings.voiceStyle),
            preferDevice: settings.voiceSource === 'device',
            deviceVoiceURI:
              resolveVoiceChoice(voices, settings.voiceURI, settings.voiceStyle)
                ?.voiceURI ?? null,
            rate: settings.rate,
            pitch: settings.pitch,
            volume: settings.voiceVolume,
            repeatPauseMs: settings.repeatPauseSeconds * 1000,
            initialDelayMs: 420,
            loop: true,
          },
          {
            onChunk: (chunkIndex, chunkTotal, chunkText) =>
              setSession((current) => ({
                ...current,
                chunkIndex,
                chunkTotal,
                chunkText,
              })),
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
      /*
       * The library keeps whatever is played, whether or not anybody saved it.
       * A loop started from the Create tab is captured here on its way out, so
       * words somebody actually listened to are in Your library by the time
       * they get back to it — under Recent plays, behind everything they chose
       * to keep. The draft adopts the record it landed in, so tweaking and
       * playing again refreshes that one entry instead of laying down another,
       * and pressing Save later promotes it rather than copying it.
       *
       * A breath-only session is the one thing that is never captured. There
       * is nothing to file: a card in Your library with no words on it could
       * not be told from the one beside it, could not be given a name, and
       * would push the loops somebody actually wrote down the page. The
       * listening time is still counted — that happened.
       */
      if (!breathOnly) {
        void recordPlay({
          id: source?.id ?? draft.id,
          title: source ? source.title : draft.title,
          text,
          settings,
        }).then((loop) => {
          if (!loop) return
          draftTouchedRef.current = true
          setDraft((current) => {
            if (current.text !== text || current.id === loop.id) return current
            /*
             * The id, and only the id. A capture names itself from its own
             * opening words, but writing that name into the Title box would
             * leave it there — still attached when the words underneath it
             * have been replaced by something else entirely.
             */
            if (current.id == null) return { ...current, id: loop.id }
            /*
             * The draft has been rewritten past the capture it came from, so
             * it follows the capture its words are actually in. A loop
             * somebody kept is never re-pointed: editing it and pressing Save
             * has to keep meaning "update the loop I saved".
             */
            const bound = loops.find((item) => item.id === current.id)
            return bound?.origin === 'played'
              ? { ...current, id: loop.id }
              : current
          })
        })
      }
      setSession({
        ...EMPTY_SESSION,
        status: 'playing',
        title,
        breathOnly,
        chunkTotal: breathOnly ? 0 : speech.chunkCount,
        remainingSeconds:
          settings.timerMinutes != null ? settings.timerMinutes * 60 : null,
      })
      startElapsed(true)
      void requestWakeLock()

      music.setHandlers({
        onTrackChange: (track) => {
          setSession((current) => ({ ...current, trackName: track?.name ?? null }))
          // A playlist moving on lands on a track with its own stored level,
          // and the engine has one primary gain — so the level travels with
          // the track rather than staying on the one that has just left.
          if (track) music.setPrimaryLevel(primaryLevelFor(settings.sound, track.id))
        },
        onError: (message) =>
          setSession((current) => ({ ...current, notice: message })),
      })
      music.setVolume(settings.musicVolume)
      music.setAmbienceOptions({ rainCharacter: settings.sound.rainCharacter })
      // The stacked layers first: they are independent of the main choice and
      // of the file lookup below, so they can start fading up immediately.
      music.setLayers(settings.sound.layers, (id) =>
        effectiveLevel(settings.sound, id),
      )
      void resolveTrackSources(settings).then((sources) => {
        if (sources.length === 0) return
        void music.play(sources, settings.sound.repeat)
        music.setPrimaryLevel(primaryLevelFor(settings.sound))
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
    [draft, finish, loops, recordPlay, requestWakeLock, startElapsed, voices],
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
    ({ voiceURI, voiceName, voiceStyle, voiceSource }) => {
      const style = voiceStyle ?? draft.settings.voiceStyle
      const source = voiceSource ?? draft.settings.voiceSource
      updateSettings({
        voiceURI,
        voiceName,
        ...(voiceStyle ? { voiceStyle } : {}),
        ...(voiceSource ? { voiceSource } : {}),
      })
      /*
       * Changing who is reading takes the current line back to its first word
       * and reads it again in the new voice — but not until that reading has
       * been fetched, so the outgoing voice covers the wait rather than a
       * silence. See `VoiceLooper.swapCurrentLine`.
       */
      speechRef.current?.updateOptions({
        voice: voiceForStyle(style),
        preferDevice: source === 'device',
        deviceVoiceURI:
          resolveVoiceChoice(voices, voiceURI, style)?.voiceURI ?? null,
      })
    },
    [updateSettings, voices, draft.settings.voiceStyle, draft.settings.voiceSource],
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
   * Move one fader.
   *
   * The engine is told first and the settings second. That order is the reason
   * dragging feels attached to the sound: the ramp is scheduled on the audio
   * thread in the same tick as the input event, rather than a React render
   * later. The stored value follows for the next session to read.
   */
  const setLayerLevel = useCallback<SessionContextValue['setLayerLevel']>(
    (id, level) => {
      setDraft((current) => {
        const sound = withLevel(current.settings.sound, id, level)
        const settings = { ...current.settings, sound }
        if (liveRef.current) applyMixLevels(sound)
        void storage.saveLastSettings(settings)
        return { ...current, settings }
      })
      draftTouchedRef.current = true
    },
    [applyMixLevels],
  )

  const setLayerMuted = useCallback<SessionContextValue['setLayerMuted']>(
    (id, muted) => {
      setDraft((current) => {
        const sound = withMuted(current.settings.sound, id, muted)
        const settings = { ...current.settings, sound }
        // The level itself is untouched, so unmuting returns to the balance
        // somebody had rather than to full. See `soundMixer.effectiveLevel`.
        if (liveRef.current) applyMixLevels(sound)
        void storage.saveLastSettings(settings)
        return { ...current, settings }
      })
      draftTouchedRef.current = true
    },
    [applyMixLevels],
  )

  /**
   * Add or remove a stacked ambience.
   *
   * The only mixer control that builds or releases audio rather than ramping
   * it, which is why it goes through the engine's `setLayers` — that leaves
   * every layer already playing exactly as it was, so adding a third sound
   * cannot disturb the two underneath it.
   */
  const setLayerEnabled = useCallback<SessionContextValue['setLayerEnabled']>(
    (id, enabled) => {
      setDraft((current) => {
        const previous = current.settings.sound
        const sound = enabled ? withLayer(previous, id) : withoutLayer(previous, id)
        if (!layersChanged(previous, sound)) return current

        const settings = { ...current.settings, sound }
        if (liveRef.current) {
          musicRef.current?.unlock()
          musicRef.current?.setLayers(sound.layers, (layerId) =>
            effectiveLevel(sound, layerId),
          )
        }
        void storage.saveLastSettings(settings)
        return { ...current, settings }
      })
      draftTouchedRef.current = true
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
      // Everything in flight is abandoned rather than merely stopped: the app
      // is going away, so a synthesis that has not landed has nowhere to land.
      tts.cancelAll()
      music?.dispose()
      soundtrack.dispose()
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
      setLayerLevel,
      setLayerMuted,
      setLayerEnabled,
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
      setLayerLevel,
      setLayerMuted,
      setLayerEnabled,
    ],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext)
  if (!context) throw new Error('useSession must be used inside <SessionProvider>')
  return context
}

/**
 * The level for whichever source is in the main slot.
 *
 * A playlist's tracks each have their own stored level and the engine has one
 * primary gain, so the level that applies is the one belonging to the track
 * actually playing. `primarySourceId` names the first of a queue, which is
 * what a queue starts on; `onTrackChange` re-applies it as the queue advances.
 */
function primaryLevelFor(sound: SoundConfig, currentTrackId?: string | null): number {
  const id = currentTrackId ?? primarySourceId(sound)
  return id ? effectiveLevel(sound, id) : 1
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
