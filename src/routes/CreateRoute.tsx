import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '../components/Button'
import { Card, FieldLabel } from '../components/Card'
import { Disclosure } from '../components/Disclosure'
import { CheckIcon, PlayIcon, SeedIcon } from '../components/Icons'
import { SoundSettings } from '../components/SoundSettings'
import { TextArea, TextField } from '../components/TextArea'
import { TimerSettings } from '../components/TimerSettings'
import { VoiceSettings } from '../components/VoiceSettings'
import {
  countWords,
  estimateSpokenSeconds,
  formatApproxDuration,
} from '../lib/format'
import { draftToLoop } from '../lib/loops'
import { isSpeechSupported } from '../lib/speech'
import { useLibrary } from '../state/LibraryProvider'
import { useSession } from '../state/SessionProvider'

/** Gentle starting points — supportive phrasing, no promises attached. */
const STARTERS = [
  'I am allowed to move at my own pace.',
  'I meet today with a steady, open heart.',
  'I trust myself to handle what this day brings.',
  'I am becoming someone I am proud of.',
  'Rest is part of the work, not a break from it.',
]

export function CreateRoute() {
  const navigate = useNavigate()
  const {
    draft,
    updateDraft,
    updateSettings,
    voices,
    voicesReady,
    speechSupported,
    start,
  } = useSession()
  const { allTracks, loops, saveLoop, storageError } = useLibrary()
  const [saved, setSaved] = useState(false)
  const [previewing, setPreviewing] = useState(false)

  const words = countWords(draft.text)
  const perPass = formatApproxDuration(
    estimateSpokenSeconds(draft.text, draft.settings.rate),
  )
  const canStart = words > 0

  const voiceSummary = useMemo(() => {
    const name = draft.settings.voiceName ?? 'System default voice'
    return `${name} · ${draft.settings.rate.toFixed(2)}× speed`
  }, [draft.settings.voiceName, draft.settings.rate])

  const soundSummary = useMemo(() => {
    const { sound } = draft.settings
    if (sound.mode === 'off') return 'No background sound'
    if (sound.mode === 'playlist') {
      return `Playlist · ${sound.playlist.length} sound${
        sound.playlist.length === 1 ? '' : 's'
      }`
    }
    const track = allTracks.find((item) => item.id === sound.trackId)
    return track?.name ?? 'Pick a sound'
  }, [draft.settings, allTracks])

  const handleStart = useCallback(() => {
    start()
    navigate('/player')
  }, [navigate, start])

  const handleSave = useCallback(async () => {
    const existing = draft.id ? loops.find((loop) => loop.id === draft.id) : null
    const loop = draftToLoop(draft, existing)
    await saveLoop(loop)
    updateDraft({ id: loop.id, title: loop.title })
    setSaved(true)
    window.setTimeout(() => setSaved(false), 2200)
  }, [draft, loops, saveLoop, updateDraft])

  const handlePreview = useCallback(() => {
    if (!isSpeechSupported()) return
    const synth = window.speechSynthesis
    synth.cancel()
    const utterance = new SpeechSynthesisUtterance(
      'This is how your words will sound.',
    )
    const voice = synth
      .getVoices()
      .find((item) => item.voiceURI === draft.settings.voiceURI)
    if (voice) {
      utterance.voice = voice
      utterance.lang = voice.lang
    }
    utterance.rate = draft.settings.rate
    utterance.pitch = draft.settings.pitch
    utterance.volume = draft.settings.voiceVolume
    utterance.onend = () => setPreviewing(false)
    utterance.onerror = () => setPreviewing(false)
    setPreviewing(true)
    synth.speak(utterance)
  }, [draft.settings])

  const appendStarter = (phrase: string) => {
    const separator = draft.text.trim() ? '\n\n' : ''
    updateDraft({ text: `${draft.text}${separator}${phrase}` })
  }

  return (
    <div className="space-y-5">
      <section data-rise className="pt-2 pb-1">
        <h1 className="font-display text-[2rem] leading-tight text-ink">
          Create a calming loop
        </h1>
        <p className="mt-2 max-w-[42ch] text-[1rem] leading-relaxed text-ink-muted">
          Write or paste the words you want to hear. Manifester reads them aloud
          and gently begins again.
        </p>
      </section>

      {!speechSupported && (
        <div
          role="alert"
          data-rise
          className="rounded-2xl border border-[var(--border-strong)] bg-[var(--gold-soft)] px-4 py-3.5 text-[0.92rem] leading-relaxed text-ink"
        >
          This browser cannot read text aloud. Try Safari on iPhone, or Chrome on
          Android and desktop. Everything else in the app still works.
        </div>
      )}

      {storageError && (
        <div
          role="alert"
          data-rise
          className="rounded-2xl border border-[var(--border-strong)] bg-[var(--gold-soft)] px-4 py-3.5 text-[0.92rem] leading-relaxed text-ink"
        >
          {storageError}
        </div>
      )}

      <Card data-rise>
        <FieldLabel htmlFor="loop-title">Title</FieldLabel>
        <TextField
          id="loop-title"
          value={draft.title}
          placeholder="Morning steadiness"
          maxLength={80}
          onChange={(event) => updateDraft({ title: event.target.value })}
        />

        <div className="mt-5">
          <FieldLabel
            htmlFor="loop-text"
            hint={words > 0 ? `${words} words · ${perPass} per pass` : undefined}
          >
            Your words
          </FieldLabel>
          <TextArea
            id="loop-text"
            value={draft.text}
            placeholder={
              'I am steady.\nI am allowed to take up space.\nWhat I am building matters.'
            }
            onChange={(event) => updateDraft({ text: event.target.value })}
          />
        </div>

        <div className="mt-4">
          <p className="mb-2 text-[0.82rem] font-medium uppercase tracking-[0.09em] text-ink-faint">
            Need a starting point?
          </p>
          <div className="flex flex-wrap gap-2">
            {STARTERS.map((phrase) => (
              <button
                key={phrase}
                type="button"
                onClick={() => appendStarter(phrase)}
                className="min-h-11 rounded-pill border border-[var(--border)] bg-[var(--surface-sunken)] px-4 text-left text-[0.88rem] text-ink-muted transition-colors hover:border-[var(--border-strong)] hover:text-ink"
              >
                {phrase}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card
        data-rise
        title="Session length"
        description="How long the loop keeps going."
      >
        <TimerSettings
          minutes={draft.settings.timerMinutes}
          onChange={(timerMinutes) => updateSettings({ timerMinutes })}
        />
      </Card>

      <div className="space-y-3" data-rise>
        <Disclosure title="Voice and speech" summary={voiceSummary}>
          <VoiceSettings
            voices={voices}
            voicesReady={voicesReady}
            settings={draft.settings}
            onChange={updateSettings}
            onPreview={handlePreview}
            previewing={previewing}
          />
        </Disclosure>

        <Disclosure title="Background sound" summary={soundSummary}>
          <SoundSettings
            settings={draft.settings}
            tracks={allTracks}
            onChange={updateSettings}
          />
        </Disclosure>
      </div>

      <div
        data-rise
        className="sticky bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-10 flex gap-3"
      >
        <Button
          variant="primary"
          size="lg"
          className="grow"
          disabled={!canStart}
          onClick={handleStart}
          leading={<PlayIcon className="text-[0.9rem]" />}
        >
          Start loop
        </Button>
        <Button
          variant="secondary"
          size="lg"
          disabled={!canStart}
          onClick={() => void handleSave()}
          leading={
            saved ? <CheckIcon className="text-[0.95rem]" /> : <SeedIcon className="text-[0.95rem]" />
          }
        >
          {saved ? 'Saved' : 'Save'}
        </Button>
      </div>

      <p className="px-1 pt-2 text-center text-[0.82rem] leading-relaxed text-ink-faint">
        Your saved loops stay on this device. Manifester does not require an
        account and does not send your text to a server.
      </p>
    </div>
  )
}
