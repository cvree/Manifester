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
import { CustomizePanel } from '../components/CustomizePanel'
import { CheckIcon, CloseIcon, PlayIcon, SeedIcon } from '../components/Icons'
import { RitualPreview } from '../components/RitualPreview'
import { TextArea, TextField } from '../components/TextArea'
import { TimerSettings } from '../components/TimerSettings'
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
import { useBreathing } from '../lib/useBreathing'
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
  const { preferences } = usePreferences()
  const reducedMotion = useReducedMotion()

  const [saved, setSaved] = useState(false)
  const [starting, setStarting] = useState(false)
  const [showQuickStart, setShowQuickStart] = useState(false)
  const actionsRef = useRef<HTMLDivElement>(null)

  const words = countWords(draft.text)
  const canStart = words > 0

  // The guide breathes in the preview exactly as it will in the player, so
  // what you set up is what you get. No cues fire here — this is a picture.
  const breathing = useBreathing({
    pattern: preferences.breathPattern,
    active: preferences.breathingEnabled,
    soundCues: false,
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
                  className="interactive surface-control min-h-11 px-4 text-left text-[0.88rem] text-ink-muted hover:text-ink"
                >
                  {phrase}
                </button>
              ))}
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
          />
        </div>

        <Card
          data-rise
          level="panel"
          title="Session length"
          description="How long the loop keeps going before it fades out."
          className="lg:col-start-1"
        >
          <TimerSettings
            minutes={draft.settings.timerMinutes}
            onChange={(timerMinutes) => updateSettings({ timerMinutes })}
          />
        </Card>

        <div ref={actionsRef} data-rise className="lg:col-start-1">
          {actions}
          {!canStart && (
            <p className="type-meta mt-3 text-center lg:text-left">
              Write at least one line to begin.
            </p>
          )}
        </div>

        <div data-rise className="lg:col-start-1">
          <CustomizePanel />
        </div>

        <p className="type-meta px-1 text-center lg:col-start-1 lg:text-left">
          Your saved loops stay on this device. Manifester does not require an
          account and does not send your text to a server.
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
