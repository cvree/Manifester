import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useNavigate } from 'react-router'
import { Button } from '../components/Button'
import { Card, FieldLabel } from '../components/Card'
import { CustomizePanel, type PanelKey } from '../components/CustomizePanel'
import {
  CheckIcon,
  CloseIcon,
  PlayIcon,
  PlusIcon,
  SeedIcon,
  SparkIcon,
} from '../components/Icons'
import { RitualPreview, type RitualSetting } from '../components/RitualPreview'
import { TextArea, TextField } from '../components/TextArea'
import { TimerSettings } from '../components/TimerSettings'
import { primeBreathAudio } from '../lib/breathAudio'
import { recordEngagement } from '../lib/engagement'
import { cue, primeFeedback } from '../lib/feedback'
import { countWords } from '../lib/format'
import { draftToLoop } from '../lib/loops'
import { useReducedMotion } from '../lib/motion'
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

/** Gentle starting points — supportive phrasing, no promises attached. */
const STARTERS = [
  'I am allowed to move at my own pace.',
  'I meet today with a steady, open heart.',
  'I trust myself to handle what this day brings.',
  'I am becoming someone I am proud of.',
  'Rest is part of the work, not a break from it.',
]

/** Long enough for the button to settle before the route changes. */
const START_TRANSITION_MS = 620

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

  const [saved, setSaved] = useState(false)
  const [starting, setStarting] = useState(false)
  const [showQuickStart, setShowQuickStart] = useState(false)
  const [helper, setHelper] = useState<HelperState | null>(null)
  const [busy, setBusy] = useState<'add' | 'improve' | null>(null)
  const [panel, setPanel] = useState<PanelKey | null>(null)
  const timerRef = useRef<HTMLDivElement>(null)
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

  const words = countWords(draft.text)
  const canStart = words > 0

  // The guide breathes in the preview exactly as it will in the player, so
  // what you set up is what you get. No cues fire here — this is a picture.
  const breathing = useBreathing({
    pattern: preferences.breathPattern,
    active: preferences.breathingEnabled,
    sound: 'off',
    soundVolume: 0,
    hapticCues: false,
  })

  /*
   * The quick-start bar only appears once the real Start button has scrolled
   * away. That is what keeps a fixed control from ever covering content: at
   * rest there is nothing floating over the page at all.
   */
  useEffect(() => {
    const node = actionsRef.current
    if (!node || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      ([entry]) => setShowQuickStart(!entry.isIntersecting),
      { rootMargin: '-96px 0px -96px 0px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  /*
   * What a summary tile in the ritual preview does when tapped. Four of the
   * five open the sheet that owns the setting; session length has no sheet —
   * it is a card on this page — so that one scrolls to it instead. Either
   * way the tile keeps its promise: it takes you to the control.
   */
  const openSetting = useCallback((setting: RitualSetting) => {
    if (setting === 'timer') {
      timerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    setPanel(setting === 'rhythm' ? 'brainwave' : setting)
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
    primeFeedback()
    primeBreathAudio()
    cue('start')
    setStarting(true)

    const delay = reducedMotion ? 0 : START_TRANSITION_MS
    window.setTimeout(() => {
      start()
      recordEngagement()
      navigate('/player')
    }, delay)
  }, [canStart, navigate, prime, reducedMotion, start, starting])

  const handleSave = useCallback(async () => {
    const existing = draft.id ? loops.find((loop) => loop.id === draft.id) : null
    const loop = draftToLoop(draft, existing)
    await saveLoop(loop)
    updateDraft({ id: loop.id, title: loop.title })
    cue('save')
    recordEngagement()
    setSaved(true)
    window.setTimeout(() => setSaved(false), 2200)
  }, [draft, loops, saveLoop, updateDraft])

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

  const actions = (
    <div className="flex gap-3">
      <Button
        variant="primary"
        size="xl"
        className="grow"
        disabled={!canStart}
        loading={starting}
        onClick={handleStart}
        leading={!starting && <PlayIcon className="text-[0.9rem]" />}
      >
        {starting ? 'Beginning…' : 'Start loop'}
      </Button>
      <Button
        variant="secondary"
        size="xl"
        disabled={!canStart}
        onClick={() => void handleSave()}
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
    </div>
  )

  return (
    <>
      {/*
        One column until there is genuinely room for two. Between a phone and
        a laptop the column is capped and centred rather than stretched — a
        700px-wide affirmation editor on a tablet reads worse, not better.
      */}
      <div className="mx-auto grid max-w-2xl grid-cols-[minmax(0,1fr)] gap-6 lg:max-w-none lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start lg:gap-8 xl:grid-cols-[minmax(0,1fr)_28rem] xl:gap-10">
        <header data-rise className="pt-2 lg:col-start-1">
          <h1 className="type-display">Create a calming loop</h1>
          <p className="type-body mt-3 max-w-[46ch]">
            Write or paste the words you want to hear. Manifester reads them
            aloud, breathes with you, and gently begins again.
          </p>
        </header>

        {(!speechSupported || storageError || session.notice) && (
          <div data-rise className="space-y-3 lg:col-start-1">
            {!speechSupported && (
              <Notice>
                This browser cannot read text aloud. Try Safari on iPhone, or
                Chrome on Android and desktop. Everything else in the app still
                works.
              </Notice>
            )}
            {storageError && <Notice>{storageError}</Notice>}
            {session.notice && (
              <Notice onDismiss={dismissNotice}>{session.notice}</Notice>
            )}
          </div>
        )}

        {/*
          The editor is a level-2 panel; the ritual preview beside it is the
          one stage on this route. Two stages on one screen would flatten the
          hierarchy straight back out.
        */}
        <Card level="panel" data-rise className="lg:col-start-1">
          <FieldLabel htmlFor="loop-title">Title</FieldLabel>
          <TextField
            id="loop-title"
            value={draft.title}
            placeholder="Morning steadiness"
            maxLength={80}
            onChange={(event) => updateDraft({ title: event.target.value })}
          />

          <div className="mt-6">
            <FieldLabel
              htmlFor="loop-text"
              hint={
                words > 0
                  ? `${words} words · ${lines.length} ${
                      lines.length === 1 ? 'line' : 'lines'
                    }`
                  : undefined
              }
            >
              Your words
            </FieldLabel>
            <TextArea
              id="loop-text"
              minRows={5}
              value={draft.text}
              placeholder={
                'I am steady.\nI am allowed to take up space.\nWhat I am building matters.'
              }
              onChange={(event) => updateDraft({ text: event.target.value })}
            />
          </div>

          <div className="mt-5">
            <p className="type-label mb-3">Need a starting point?</p>
            <div className="flex flex-wrap gap-2">
              {STARTERS.map((phrase) => (
                <button
                  key={phrase}
                  type="button"
                  onClick={() => appendStarter(phrase)}
                  className="interactive pressable surface-control min-h-11 px-4 text-left text-[0.88rem] text-ink-muted hover:bg-[var(--surface-strong)] hover:text-ink"
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
                  {busy === 'add' ? 'Writing…' : 'Add to my words'}
                </Button>
                <Button
                  size="sm"
                  className="w-full sm:w-auto"
                  loading={busy === 'improve'}
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
                  {busy === 'improve' ? 'Reshaping…' : 'Improve my words'}
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
        </Card>

        {/*
          On a phone the preview sits here, right under the words it shows;
          on a desktop it moves to the second column.

          Explicit row placement rather than `row-span-full`: with no explicit
          rows on the grid, `-1` resolves back to line 1, the preview ends up
          sizing the first row on its own, and a hole opens under the heading.
          Spanning a fixed count keeps the row heights coming from the left
          column, where they belong.
        */}
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
            voice={voiceSummary(draft.settings, resolvedDeviceVoice)}
            sound={soundSummary(draft.settings, allTracks)}
            rhythm={
              draft.settings.brainwave.enabled
                ? brainwaveSummary(draft.settings.brainwave)
                : null
            }
            timer={timerSummary(draft.settings.timerMinutes)}
            delay={delaySummary(draft.settings.repeatPauseSeconds)}
            sceneKey={sceneKey}
            previewing={previewState === 'playing'}
            canPreview={speechSupported}
            onPreview={() => previewVoice(undefined, lines[0])}
            onStopPreview={stopPreview}
            onOpenSetting={openSetting}
          />
        </div>

        {/* Wrapped so the Length tile in the preview has something to scroll to. */}
        <div ref={timerRef} data-rise className="lg:col-start-1">
          <Card
            level="panel"
            title="Session length"
            description="How long the loop keeps going before it fades out."
          >
            <TimerSettings
              minutes={draft.settings.timerMinutes}
              onChange={(timerMinutes) => updateSettings({ timerMinutes })}
            />
          </Card>
        </div>

        <div ref={actionsRef} data-rise className="lg:col-start-1">
          {actions}
          {!canStart && (
            <p className="type-meta mt-3 text-center lg:text-left">
              Write at least one line to begin.
            </p>
          )}
        </div>

        <div data-rise className="lg:col-start-1">
          <CustomizePanel open={panel} onOpenChange={setPanel} />
        </div>

        <p className="type-meta px-1 text-center lg:col-start-1 lg:text-left">
          Your saved loops stay on this device. Manifester does not require an
          account and has no server of its own.
          {credentials
            ? ` The two helper buttons above send that loop to ${findProvider(credentials.provider).name}; nothing else leaves this device.`
            : ' Nothing you write leaves this device.'}
        </p>
      </div>

      {/*
        The quick-start bar. Phone only, and only while the real buttons are
        off screen — so at rest nothing floats over the page at all. It is
        mounted and unmounted rather than faded, so the duplicate Start button
        never sits invisibly in the tab order. It also stays away while a
        session is running, where the mini-player already owns that space.
      */}
      {showQuickStart && canStart && session.status === 'idle' && (
        <div
          className="animate-sheet-in pointer-events-none fixed inset-x-0 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-20 px-4 lg:hidden"
          style={{ paddingBottom: 'max(0.25rem, env(safe-area-inset-bottom))' }}
        >
          <div className="surface-sheet pointer-events-auto mx-auto w-full max-w-md rounded-[1.5rem] p-2">
            {actions}
          </div>
        </div>
      )}
    </>
  )
}

function Notice({
  children,
  onDismiss,
}: {
  children: ReactNode
  onDismiss?: () => void
}) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-[1.25rem] border border-[var(--gold)] bg-[var(--gold-soft)] px-4 py-3.5"
    >
      <p className="grow text-[0.92rem] leading-relaxed text-ink">{children}</p>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss this message"
          className="interactive -mt-1 -mr-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-muted hover:text-ink"
        >
          <CloseIcon />
        </button>
      )}
    </div>
  )
}
