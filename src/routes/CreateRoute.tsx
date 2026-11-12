import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '../components/Button'
import { FieldLabel } from '../components/Card'
import { CustomizePanel, type PanelKey } from '../components/CustomizePanel'
import {
  CheckIcon,
  ClockIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  PulseIcon,
  SeedIcon,
  SparkIcon,
  VoiceIcon,
  WaveIcon,
} from '../components/Icons'
import { Notice } from '../components/Notice'
import { RitualPreview } from '../components/RitualPreview'
import { SettingRow } from '../components/SettingRow'
import { Disclosure } from '../components/Disclosure'
import { TextArea, TextField } from '../components/TextArea'
import { primeBreathAudio } from '../lib/breathAudio'
import { recordEngagement } from '../lib/engagement'
import { cue } from '../lib/feedback'
import { cx } from '../lib/cx'
import { draftState } from '../lib/draftStore'
import { countWords, estimateSpokenSeconds, formatApproxDuration } from '../lib/format'
import { autoTitle, draftToLoop } from '../lib/loops'
import { useIsCompact, useReducedMotion } from '../lib/motion'
import { SmoothScroll } from '../lib/smoothScroll'
import { PackGallery } from '../components/PackGallery'
import { STARTER_LINES } from '../lib/tts/knownPhrases'
import { useStudioAvailable } from '../lib/tts/useTTSStatus'
import {
  affirmationLines,
  brainwaveSummary,
  delaySummary,
  soundSummary,
  timerSummary,
  voiceSummary,
} from '../lib/summaries'
import { aiAddToWords, aiImproveWords, helpWithFallback } from '../lib/ai/enhance'
import { withTimeout } from '../lib/ai/errors'
import type { Credentials } from '../lib/ai/credentials'
import { findProvider } from '../lib/ai/providers'
import { useCredentials } from '../lib/ai/useCredentials'
import { useBreathing } from '../lib/useBreathing'
import { addToWords, improveWords, type WordcraftResult } from '../lib/wordcraft'
import { useLibrary } from '../state/LibraryProvider'
import { usePreferences } from '../state/PreferencesProvider'
import { useSession } from '../state/SessionProvider'

/**
 * Gentle starting points — supportive phrasing, no promises attached.
 *
 * They live beside the speech layer rather than here because they are also
 * one of the few things this app knows it might say before anybody says it:
 * the pre-generation script speaks all of them at build time, so tapping one
 * and pressing play is instant even on a device that has never been here.
 */
const STARTERS = STARTER_LINES

/** Long enough for the button to settle before the route changes. */
const START_TRANSITION_MS = 320

/** What the writing helper last did, and the text it did it to. */
interface HelperState {
  note: string
  /** The draft as it was, for Undo. Null when nothing was replaced. */
  before: string | null
  /** What was written. Undo is only offered while the draft still matches. */
  after: string
  /**
   * Show the "connect an AI / no thanks" pair under the note.
   *
   * Only set after someone has actually pressed a helper button without a key
   * — the offer arrives when they have just seen what the offline version
   * does, which is the one moment it is useful rather than an advert.
   */
  offerAi?: boolean
}

/**
 * Shown until the helper has been used, and after an Undo.
 *
 * It has to change with the connection, because the sentence that matters —
 * where the words go — is the one that stops being true the moment a key is
 * set up. A resting hint claiming "on your device" beside a button that posts
 * to Google would be the app's only lie.
 */
function helperHint(credentials: Credentials | null, aiEnabled: boolean): string {
  const shared =
    'Add builds on what you have written. Improve keeps your meaning and makes the wording present and positive.'
  if (credentials) {
    return `${shared} Both send your loop to ${findProvider(credentials.provider).name} when you press them.`
  }
  // Only invite someone to connect an AI if they have not already said no.
  return aiEnabled
    ? `${shared} Both run here on your device. For stronger suggestions, connect an AI under Customize.`
    : `${shared} Both run here on your device.`
}

export function CreateRoute() {
  const navigate = useNavigate()
  const {
    draft,
    updateDraft,
    updateSettings,
    resolvedDeviceVoice,
    previewVoice,
    stopPreview,
    previewState,
    speechSupported,
    session,
    dismissNotice,
    prime,
    start,
  } = useSession()
  const { allTracks, loops, saveLoop, storageError } = useLibrary()
  const { preferences, update: updatePreferences } = usePreferences()
  const reducedMotion = useReducedMotion()
  // The preview names the voice that will actually read the words. See
  // `useStudioAvailable`.
  const studioAvailable = useStudioAvailable()

  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [starting, setStarting] = useState(false)
  const [showQuickStart, setShowQuickStart] = useState(false)
  const [helper, setHelper] = useState<HelperState | null>(null)
  const [busy, setBusy] = useState<'add' | 'improve' | null>(null)
  const [panel, setPanel] = useState<PanelKey | null>(null)
  const storedCredentials = useCredentials()

  /*
   * The draft as it is *now*, readable from inside a request that started up
   * to thirty seconds ago. Without this the helper would finish, apply a
   * result computed from an older draft, and silently throw away everything
   * typed while it was thinking — the one outcome this feature must never
   * produce.
   */
  const draftTextRef = useRef(draft.text)
  draftTextRef.current = draft.text

  /** Cancels the request in flight, for the Stop button and for unmount. */
  const abortHelper = useRef<(() => void) | null>(null)
  /** A second guard behind the disabled button, for a double tap on a slow phone. */
  const helperInFlight = useRef(false)

  useEffect(() => () => abortHelper.current?.(), [])

  /*
   * The master switch outranks a stored key. Everything downstream — which
   * engine runs, what the hint says, what the footer promises — keys off this
   * one value being null, so turning AI off genuinely turns it off rather
   * than merely hiding the entrance.
   */
  const credentials = preferences.aiEnabled ? storedCredentials : null
  const actionsRef = useRef<HTMLDivElement>(null)
  const compact = useIsCompact()

  const words = countWords(draft.text)
  const canStart = words > 0

  // The guide breathes in the preview exactly as it will in the player, so
  // what you set up is what you get. No cues fire here — this is a picture.
  const breathing = useBreathing({
    pattern: preferences.breathPattern,
    active: preferences.breathingEnabled,
  })

  /*
   * The quick-start bar only appears once the ritual preview — and with it the
   * one Start button on this screen — has scrolled away. That is what keeps a
   * fixed control from ever covering content: at rest there is nothing
   * floating over the page at all.
   */
  useEffect(() => {
    const node = actionsRef.current
    if (!node || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      ([entry]) => setShowQuickStart(!entry.isIntersecting),
      { rootMargin: '-72px 0px -160px 0px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  /*
   * What a summary tile in the ritual preview does when tapped: it opens the
   * sheet that owns the setting. All five behave the same way now — session
   * length used to be the exception, a card further down the page that the
   * tile scrolled to, which made one tile in five feel broken and gave the
   * screen a second home for a setting that already had one.
   */
  const openPanel = useCallback((key: PanelKey) => {
    cue('tap')
    setPanel(key)
  }, [])

  const lines = useMemo(() => affirmationLines(draft.text), [draft.text])

  const sceneKey = useMemo(() => {
    const { sound } = draft.settings
    if (sound.mode === 'off') return 'off'
    if (sound.mode === 'playlist') return 'custom'
    return sound.trackId ?? 'custom'
  }, [draft.settings])

  const handleStart = useCallback(() => {
    if (!canStart || starting) return

    // Reach for the audio hardware while we are still inside the tap, then
    // let the button animate. Safari will not unlock it a beat later.
    prime()
    primeBreathAudio()
    setStarting(true)

    const delay = reducedMotion ? 0 : START_TRANSITION_MS
    window.setTimeout(() => {
      start()
      recordEngagement()
      navigate('/player')
    }, delay)
  }, [canStart, navigate, prime, reducedMotion, start, starting])

  /*
   * Writing to the device is usually instant and occasionally is not — a long
   * loop, a busy phone, a browser that has decided to think about its storage
   * quota. `saving` covers the difference so the button is never silent, and
   * it guards a second press from writing the same loop twice.
   */
  const handleSave = useCallback(async () => {
    if (saving) return
    setSaving(true)
    try {
      const existing = draft.id ? loops.find((loop) => loop.id === draft.id) : null
      const loop = draftToLoop(draft, existing)
      await saveLoop(loop)
      updateDraft({ id: loop.id, title: loop.title })
      cue('save')
      recordEngagement()
      setSaved(true)
      window.setTimeout(() => setSaved(false), 2200)
    } finally {
      setSaving(false)
    }
  }, [draft, loops, saveLoop, saving, updateDraft])

  const appendStarter = (phrase: string) => {
    cue('select')
    const separator = draft.text.trim() ? '\n\n' : ''
    updateDraft({ text: `${draft.text}${separator}${phrase}` })
  }

  /*
   * Both helpers are the same gesture: one tap, the words change, and the
   * previous version is held on to until the draft moves again. Rewriting
   * somebody's own words is only reasonable if putting them back is as easy
   * as it was to change them.
   */
  const applyResult = useCallback(
    (before: string, result: WordcraftResult, offerAi = false) => {
      if (!result.changed) {
        cue('tap')
        setHelper({ note: result.note, before: null, after: before, offerAi })
        return
      }
      cue('save')
      updateDraft({ text: result.text })
      setHelper({ note: result.note, before, after: result.text, offerAi })
    },
    [updateDraft],
  )

  /*
   * Two engines, one button. With a key set up the provider writes; without
   * one — or when the provider is unreachable, out of credit, or simply
   * having a bad morning — the offline rule engine does. It is never a dead
   * end: the worst case is a plainer suggestion and a sentence saying why.
   */
  const runHelper = useCallback(
    async (
      kind: 'add' | 'improve',
      online: (credentials: Credentials, signal: AbortSignal) => Promise<WordcraftResult>,
      offline: (text: string) => WordcraftResult,
    ) => {
      if (busy || helperInFlight.current) return
      const before = draftTextRef.current

      if (!credentials) {
        const result = offline(before)
        // Say what just happened and what the alternative is — but only to
        // someone who has not already switched AI off.
        applyResult(
          before,
          preferences.aiEnabled
            ? {
                ...result,
                note: `${result.note} That was the built-in helper — an AI writes around your own words instead.`,
              }
            : result,
          preferences.aiEnabled,
        )
        return
      }

      helperInFlight.current = true
      setBusy(kind)
      const { signal, cancel, done } = withTimeout()
      abortHelper.current = cancel

      try {
        const outcome = await helpWithFallback(
          () => online(credentials, signal),
          () => offline(before),
          credentials.provider,
        )

        // Somebody pressed Stop. The only correct thing to do is nothing.
        if (!outcome.result) {
          setHelper({ note: outcome.failure?.message ?? 'Stopped.', before: null, after: before })
          return
        }

        /*
         * They kept typing while this was being written. The suggestion was
         * built from words that are no longer on screen, so applying it would
         * overwrite live text with a stale rewrite. Say so, and leave the
         * newer words alone — the whole result is still one press away.
         */
        if (draftTextRef.current !== before) {
          setHelper({
            note: 'You carried on writing while that came back, so nothing was replaced. Press again to work from what is there now.',
            before: null,
            after: draftTextRef.current,
          })
          cue('tap')
          return
        }

        applyResult(before, outcome.result)
      } finally {
        done()
        abortHelper.current = null
        helperInFlight.current = false
        setBusy(null)
      }
    },
    [applyResult, busy, credentials, preferences.aiEnabled],
  )

  // Only while the draft is still exactly what the helper left behind —
  // otherwise Undo would throw away whatever was typed since.
  const canUndo = helper?.before != null && draft.text === helper.after

  const handleUndo = useCallback(() => {
    if (helper?.before == null) return
    cue('tap')
    updateDraft({ text: helper.before })
    setHelper(null)
  }, [helper, updateDraft])

  const state = draftState(draft, loops)
  const perPass = formatApproxDuration(
    estimateSpokenSeconds(draft.text, draft.settings.rate),
  )
  const repeat = draft.settings.repeat

  /*
   * One line that says where the words stand. It is the whole of the save
   * feedback: quiet when there is nothing to say, and never a dialog.
   */
  const status = saving
    ? 'Saving…'
    : saved || state === 'saved'
      ? 'Saved to your library.'
      : state === 'empty'
        ? 'Nothing leaves this device.'
        : draft.id && state === 'unsaved'
          ? 'Edited since you saved — kept on this device until you save again.'
          : 'Kept on this device as you type. Save to add it to your library.'

  const readAloud = (
    <Button
      variant="primary"
      size="xl"
      className="w-full sm:w-auto sm:min-w-56"
      disabled={!canStart}
      loading={starting}
      loadingLabel="Beginning…"
      onClick={handleStart}
      leading={<PlayIcon className="text-[0.9rem]" />}
    >
      Read aloud
    </Button>
  )

  const saveButton = (
    <Button
      variant="secondary"
      size="xl"
      disabled={!canStart}
      loading={saving}
      loadingLabel="Saving…"
      onClick={() => void handleSave()}
      aria-label={
        saving ? 'Saving your words' : saved ? 'Saved to your library' : 'Save to your library'
      }
      leading={
        saved ? (
          <CheckIcon className="text-[0.95rem]" />
        ) : (
          <SeedIcon className="text-[0.95rem]" />
        )
      }
    >
      {saved ? 'Saved' : 'Save'}
    </Button>
  )

  return (
    /*
      The other screen long enough to be worth gliding down. The editor and
      the sheets keep their own scrollers — see `data-lenis-prevent` on both —
      so smoothing the page never reaches inside a control.
    */
    <SmoothScroll>
      {/*
        Words first. The page opens on the one thing somebody came to do —
        put their words down — with the one button that reads them directly
        underneath. Everything else is below it or behind a labelled row.

        One column until there is genuinely room for two; between a phone and
        a laptop the column is capped and centred rather than stretched.
      */}
      <div className="mx-auto grid max-w-2xl grid-cols-[minmax(0,1fr)] gap-6 lg:max-w-none lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-10 xl:grid-cols-[minmax(0,1fr)_25rem] xl:gap-14">
        <header data-rise className="pt-2 lg:col-start-1">
          <h1 className="type-display">Your words</h1>
          <p className="type-body mt-3 max-w-[44ch]">
            Write or paste what you want to hear, then press Read aloud.
          </p>
        </header>

        {(!speechSupported || storageError || session.notice) && (
          <div data-rise className="space-y-3 lg:col-start-1">
            {!speechSupported && (
              <Notice>
                This browser cannot read text aloud. Try Safari on iPhone, or
                Chrome on Android and desktop. Your words are still kept here.
              </Notice>
            )}
            {storageError && <Notice>{storageError}</Notice>}
            {session.notice && (
              <Notice onDismiss={dismissNotice}>{session.notice}</Notice>
            )}
          </div>
        )}

        <section data-rise aria-label="Your words" className="lg:col-start-1">
          {/*
            The page itself, not a form inside a card: no label shouting above
            it, a serif at reading size, and a measure that stays comfortable
            on a monitor. The visible heading above is its name.
          */}
          <label htmlFor="loop-text" className="sr-only">
            Your words
          </label>
          <TextArea
            id="loop-text"
            minRows={6}
            maxHeight={560}
            value={draft.text}
            className="writing-page"
            placeholder={
              'I am steady.\nI am allowed to take up space.\nWhat I am building matters.'
            }
            onChange={(event) => updateDraft({ text: event.target.value })}
          />

          <p className="type-meta mt-2.5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-1">
            <span role="status" aria-live="polite">
              {status}
            </span>
            {words > 0 && (
              <span className="text-ink-faint">
                {words} {words === 1 ? 'word' : 'words'} · {perPass} to read
              </span>
            )}
          </p>

          {/*
            The only filled button on the screen. Save sits beside it at the
            same height so the pair reads as one decision, and Repeat is the
            one setting close enough to the press to belong next to it.
          */}
          <div
            ref={actionsRef}
            className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center"
          >
            {readAloud}
            {saveButton}
            <button
              type="button"
              role="switch"
              aria-checked={repeat}
              onClick={() => {
                cue('select')
                updateSettings({ repeat: !repeat })
              }}
              className="interactive group inline-flex min-h-12 items-center gap-3 self-start rounded-pill px-2 text-[0.95rem] font-medium text-ink-muted hover:text-ink sm:ml-auto sm:self-auto"
            >
              <span
                aria-hidden="true"
                className={cx(
                  'relative h-7 w-12 shrink-0 rounded-pill border transition-[background-color,border-color] duration-150 ease-out',
                  repeat
                    ? 'border-[var(--rose-deep)] bg-[var(--rose-deep)]'
                    : 'border-[var(--border-strong)] bg-[var(--surface-sunken)]',
                )}
              >
                <span
                  className={cx(
                    'absolute top-[3px] h-[1.125rem] w-[1.125rem] rounded-full bg-[var(--bg-0)] shadow-sm transition-[left] duration-150 ease-out',
                    repeat ? 'left-[1.5rem]' : 'left-[3px]',
                  )}
                />
              </span>
              Repeat
            </button>
          </div>

          <p className="type-meta mt-2 px-1 text-ink-faint">
            {repeat ? (
              <>
                Begins again after each pass —{' '}
                <button
                  type="button"
                  className="interactive rounded underline decoration-[var(--control-border)] underline-offset-4 hover:text-ink"
                  onClick={() => {
                    cue('tap')
                    setPanel('timer')
                  }}
                >
                  {timerSummary(draft.settings.timerMinutes).toLowerCase()}
                </button>
                .
              </>
            ) : (
              'Reads through once, then stops.'
            )}
          </p>

          <div className="mt-7 max-w-md">
            <FieldLabel htmlFor="loop-title">Name (optional)</FieldLabel>
            <TextField
              id="loop-title"
              className="type-spoken text-[1.06rem]"
              value={draft.title}
              placeholder={canStart ? autoTitle(draft.text) : 'Morning steadiness'}
              maxLength={80}
              onChange={(event) => updateDraft({ title: event.target.value })}
            />
          </div>
        </section>

        {/*
          Help with the words, folded away. It is for a blank page or a stuck
          one, and somebody who arrived with their words already written should
          not have to scroll past it to reach their settings.
        */}
        <div data-rise className="lg:col-start-1">
          <Disclosure
            title="Help me write"
            summary="Starter lines, and two buttons that build on your words"
          >
            <div>
            <p className="type-label mb-3">Starter lines</p>
            <div className="flex flex-wrap gap-2">
              {STARTERS.map((phrase) => (
                <button
                  key={phrase}
                  type="button"
                  onClick={() => appendStarter(phrase)}
                  /*
                    A starter is an affirmation somebody may be about to hear,
                    so it is set like one — the same face it will wear in the
                    box above the moment it is tapped, and on the stage after
                    that. What it is *wrapped in* is still a control.
                  */
                  className="interactive pressable surface-control type-spoken min-h-11 px-4 text-left text-[0.95rem] text-ink-muted hover:bg-[var(--surface-strong)] hover:text-ink"
                >
                  {phrase}
                </button>
              ))}
            </div>

            {/*
              The two helpers sit under the starter phrases because they
              answer the same question one step later: a chip is for a blank
              page, these are for a page with something already on it.
            */}
            <div className="mt-5 border-t border-[var(--quiet-border)] pt-5">
              <p className="type-label mb-3">Let Manifester help</p>
              {/*
                Full width and stacked on a phone, where the two labels are
                together wider than the column and would otherwise wrap into
                two ragged rows of different lengths.
              */}
              <div className="grid gap-2 sm:flex sm:flex-wrap">
                <Button
                  size="sm"
                  className="w-full sm:w-auto"
                  loading={busy === 'add'}
                  loadingLabel="Writing…"
                  disabled={busy != null}
                  onClick={() =>
                    void runHelper(
                      'add',
                      (creds, signal) =>
                        aiAddToWords(draftTextRef.current, draft.title, creds, signal),
                      (text) => addToWords(text, draft.title),
                    )
                  }
                  leading={<PlusIcon className="text-[0.95rem]" />}
                >
                  Add to my words
                </Button>
                <Button
                  size="sm"
                  className="w-full sm:w-auto"
                  loading={busy === 'improve'}
                  loadingLabel="Reshaping…"
                  disabled={!canStart || busy != null}
                  onClick={() =>
                    void runHelper(
                      'improve',
                      (creds, signal) => aiImproveWords(draftTextRef.current, creds, signal),
                      (text) => improveWords(text),
                    )
                  }
                  leading={<SparkIcon className="text-[0.95rem]" />}
                >
                  Improve my words
                </Button>
              </div>
              {/* Undo belongs beside the sentence describing what to undo. */}
              <div className="mt-2.5 flex items-start justify-between gap-3">
                <p className="type-meta" aria-live="polite">
                  {busy && credentials
                    ? `Asking ${findProvider(credentials.provider).name}… your words stay exactly as they are until it answers.`
                    : (helper?.note ?? helperHint(credentials, preferences.aiEnabled))}
                </p>
                {/*
                  Stop is offered the whole time a provider is being waited on.
                  A thirty-second deadline stops the interface hanging for
                  ever, but thirty seconds is still a long time to sit in front
                  of a button that will not answer, so there is a way out of it.
                */}
                {busy && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="-mt-1.5 shrink-0"
                    onClick={() => {
                      cue('tap')
                      abortHelper.current?.()
                    }}
                  >
                    Stop
                  </Button>
                )}
                {canUndo && !busy && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="-mt-1.5 shrink-0"
                    onClick={handleUndo}
                  >
                    Undo
                  </Button>
                )}
              </div>

              {/*
                Offered once they have pressed a button and seen the offline
                result — with the decline sitting right beside it, because an
                invitation you cannot refuse is just nagging.
              */}
              {helper?.offerAi && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      cue('tap')
                      setPanel('ai')
                    }}
                    leading={<SparkIcon className="text-[0.95rem]" />}
                  >
                    Set up an AI
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      cue('tap')
                      updatePreferences({ aiEnabled: false })
                      setHelper((current) =>
                        current ? { ...current, offerAi: false } : current,
                      )
                    }}
                  >
                    No thanks, hide this
                  </Button>
                </div>
              )}
            </div>
            </div>
          </Disclosure>
        </div>

        {/*
          The settings a reading is made of — voice first — each stating its
          own value and opening in a sheet.
        */}
        <div data-rise className="lg:col-start-1">
          <div className="surface-panel overflow-hidden">
            <div className="border-b border-[var(--quiet-border)] px-4 py-4 sm:px-5">
              <h2 className="type-subheading">Voice &amp; sound</h2>
              <p className="type-meta mt-0.5">
                Who reads, how fast, and what plays underneath.
              </p>
            </div>
            <SettingRow
              icon={<VoiceIcon />}
              title="Voice and speed"
              summary={voiceSummary(draft.settings, resolvedDeviceVoice, studioAvailable)}
              onClick={() => openPanel('voice')}
              accent
            />
            <SettingRow
              icon={<WaveIcon />}
              title="Background sound"
              summary={soundSummary(draft.settings, allTracks)}
              onClick={() => openPanel('sound')}
              accent={draft.settings.sound.mode !== 'off'}
            />
            {repeat && (
              <>
                <SettingRow
                  icon={<ClockIcon />}
                  title="Session length"
                  summary={timerSummary(draft.settings.timerMinutes)}
                  onClick={() => openPanel('timer')}
                />
                <SettingRow
                  icon={<PauseIcon />}
                  title="Pause between passes"
                  summary={delaySummary(draft.settings.repeatPauseSeconds)}
                  onClick={() => openPanel('delay')}
                />
              </>
            )}
            <SettingRow
              icon={<PulseIcon />}
              title="Brainwave rhythm"
              summary={brainwaveSummary(draft.settings.brainwave)}
              onClick={() => openPanel('brainwave')}
              accent={draft.settings.brainwave.enabled}
            />
          </div>
        </div>

        {/*
          Desktop only: a quiet picture of the reading in the second column.
          On a phone it was a second stage with a second Start button, a full
          screen below the words it was about; there the page is the preview.
        */}
        {!compact && (
          <div
            data-rise
            className="lg:sticky lg:top-6 lg:col-start-2 lg:self-start lg:[grid-row:1/span_8]"
          >
            <RitualPreview
              title={draft.title}
              text={draft.text}
              settings={draft.settings}
              breathing={breathing}
              breathStyle={preferences.breathStyle}
              sceneKey={sceneKey}
              previewState={previewState}
              canPreview={speechSupported && canStart}
              onPreview={() => previewVoice(undefined, lines[0])}
              onStopPreview={stopPreview}
            />
          </div>
        )}

        <div data-rise className="lg:col-start-1">
          <CustomizePanel open={panel} onOpenChange={setPanel} />
        </div>

        <div data-rise className="lg:col-start-1">
          <PackGallery
            description={
              canStart
                ? undefined
                : 'Or let someone else write it tonight. Each one is a whole session: words, sound, breath and length.'
            }
          />
        </div>

        {/*
          One sentence. The full account of what is stored and what is sent is
          on About, and repeating it here in four lines under every screen only
          taught people to stop reading it.
        */}
        <p className="type-meta px-1 text-center lg:col-start-1 lg:text-left">
          {credentials
            ? `Everything stays on this device — except the two helper buttons, which send your words to ${findProvider(credentials.provider).name} when you press them.`
            : 'Everything stays on this device. No account, no server.'}
        </p>
      </div>

      {/*
        Read aloud, following you down the page once the button it copies has
        scrolled off. Phone only, mounted rather than faded so it never sits
        invisibly in the tab order, and absent while a session is running,
        where the mini-player already owns that space.
      */}
      {showQuickStart && canStart && session.status === 'idle' && (
        <div
          className="animate-sheet-in pointer-events-none fixed inset-x-0 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-20 px-4 lg:hidden"
          style={{ paddingBottom: 'max(0.25rem, env(safe-area-inset-bottom))' }}
        >
          <div aria-hidden="true" className="dock-veil" />
          <div className="surface-sheet pointer-events-auto mx-auto flex w-full max-w-md items-center gap-2 rounded-[1.5rem] p-2">
            <Button
              variant="primary"
              size="xl"
              className="grow whitespace-nowrap"
              loading={starting}
              loadingLabel="Beginning…"
              onClick={handleStart}
              leading={<PlayIcon className="text-[0.9rem]" />}
            >
              Read aloud
            </Button>
            {/* The narrowest phones have room for one label, and it is this bar's reason to exist. */}
            <span className="hidden min-[360px]:contents">{saveButton}</span>
          </div>
        </div>
      )}
    </SmoothScroll>
  )
}
