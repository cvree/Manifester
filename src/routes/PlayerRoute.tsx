import { useNavigate } from 'react-router'
import { BreathingCaption, BreathingOrb } from '../components/BreathingOrb'
import { BreathingSettings } from '../components/BreathingSettings'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { Disclosure } from '../components/Disclosure'
import { EmptyState } from '../components/EmptyState'
import { CloseIcon, SeedIcon, SparkIcon } from '../components/Icons'
import { PlayerControls } from '../components/PlayerControls'
import { Slider } from '../components/Slider'
import { Toggle } from '../components/Toggle'
import { cue, hapticsSupported, primeFeedback } from '../lib/feedback'
import { countWords, formatClock } from '../lib/format'
import { useBreathing } from '../lib/useBreathing'
import { usePreferences } from '../state/PreferencesProvider'
import { useSession } from '../state/SessionProvider'

export function PlayerRoute() {
  const navigate = useNavigate()
  const {
    draft,
    session,
    start,
    pause,
    resume,
    stop,
    dismissNotice,
    setLiveVoiceVolume,
    setLiveMusicVolume,
    setLiveRate,
  } = useSession()
  const { preferences, update: updatePreferences } = usePreferences()

  const hasText = countWords(draft.text) > 0
  const idle = session.status === 'idle'
  const complete = session.status === 'complete'

  // The guide follows the session: it breathes while you listen and holds
  // still the moment you pause.
  const breathing = useBreathing({
    pattern: preferences.breathPattern,
    active: preferences.breathingEnabled && session.status === 'playing',
    soundCues: preferences.breathSoundCues,
    hapticCues: preferences.breathHapticCues,
  })

  if (idle && !hasText) {
    return (
      <Card data-rise className="mt-6">
        <EmptyState
          icon={<SeedIcon />}
          title="Nothing to play yet"
          description="Write or paste the words you would like to hear, then come back here and press play."
          action={
            <Button variant="primary" size="lg" onClick={() => navigate('/create')}>
              Write your words
            </Button>
          }
        />
      </Card>
    )
  }

  const caption = complete
    ? 'Session finished'
    : session.status === 'paused'
      ? session.delayRemaining != null
        ? `Paused · ${session.delayRemaining}s of delay left`
        : 'Paused'
      : idle
        ? 'Ready when you are'
        : session.delayRemaining != null
          ? `Next loop in ${session.delayRemaining}s`
          : session.remainingSeconds != null
            ? `${formatClock(session.remainingSeconds)} left`
            : `Looping · ${formatClock(session.elapsedSeconds)}`

  const passProgress =
    session.chunkTotal > 0
      ? ((session.chunkIndex + 1) / session.chunkTotal) * 100
      : 0

  return (
    <div className="space-y-5">
      {session.notice && (
        <div
          role="alert"
          data-rise
          className="flex items-start gap-3 rounded-2xl border border-[var(--border-strong)] bg-[var(--gold-soft)] px-4 py-3.5"
        >
          <p className="grow text-[0.92rem] leading-relaxed text-ink">
            {session.notice}
          </p>
          <button
            type="button"
            onClick={dismissNotice}
            aria-label="Dismiss this message"
            className="mt-0.5 shrink-0 text-ink-muted"
          >
            <CloseIcon />
          </button>
        </div>
      )}

      <section data-rise className="pt-4 text-center">
        <p className="text-[0.8rem] font-medium uppercase tracking-[0.14em] text-ink-faint">
          {complete ? 'Complete' : idle ? 'Ready' : 'Now looping'}
        </p>
        <h1 className="mt-1.5 font-display text-[1.9rem] leading-tight text-ink">
          {session.title || draft.title.trim() || 'Untitled loop'}
        </h1>
      </section>

      {complete ? (
        <Card data-rise className="text-center">
          <div className="flex flex-col items-center px-2 py-6">
            <span
              aria-hidden="true"
              className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--gold-soft)] text-[1.7rem] text-[var(--gold)]"
            >
              <SparkIcon />
            </span>
            <h2 className="font-display text-[1.5rem] text-ink">
              Your loop is complete.
            </h2>
            <p className="mt-2 max-w-[32ch] text-[0.95rem] leading-relaxed text-ink-muted">
              You listened for{' '}
              {formatClock(session.elapsedSeconds)} across {session.cycles}{' '}
              {session.cycles === 1 ? 'pass' : 'passes'}. Take a breath before you
              move on.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button variant="primary" size="lg" onClick={() => start()}>
                Listen again
              </Button>
              <Button variant="secondary" size="lg" onClick={() => stop()}>
                Done for now
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <>
          <div data-rise className="pt-2">
            <PlayerControls
              status={session.status}
              caption={caption}
              onStart={() => {
                primeFeedback()
                cue('start')
                start()
              }}
              onPause={() => {
                cue('stop')
                pause()
              }}
              onResume={() => {
                cue('start')
                resume()
              }}
              onStop={() => {
                cue('stop')
                stop()
              }}
              disabled={!hasText}
              visualizer={
                preferences.breathingEnabled ? (
                  <BreathingOrb runtime={breathing} />
                ) : undefined
              }
              visualizerCaption={<BreathingCaption runtime={breathing} />}
            />
          </div>

          {!idle && (
            <Card data-rise className="!py-4">
              <div className="flex items-center justify-between gap-3 text-[0.88rem] text-ink-muted">
                <span>
                  Pass {session.cycles + 1}
                  {session.chunkTotal > 0 &&
                    ` · part ${session.chunkIndex + 1} of ${session.chunkTotal}`}
                </span>
                {session.trackName && (
                  <span className="truncate text-ink-faint">
                    {session.trackName}
                  </span>
                )}
              </div>
              <div
                className="mt-2.5 h-1.5 w-full overflow-hidden rounded-pill bg-[var(--surface-sunken)]"
                role="progressbar"
                aria-label="Progress through this pass"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(passProgress)}
              >
                <div
                  className="h-full rounded-pill bg-[var(--rose)] transition-[width] duration-500 ease-[var(--ease-calm)]"
                  style={{ width: `${passProgress}%` }}
                />
              </div>
            </Card>
          )}
        </>
      )}

      <Card
        data-rise
        title="Mix"
        description={
          idle || complete
            ? 'Levels for this loop, ready for the next session.'
            : 'Adjust while it plays. Speed and voice volume take effect on the next line.'
        }
      >
        <div className="space-y-6">
          <Slider
            label="Voice volume"
            min={0}
            max={1}
            step={0.05}
            value={draft.settings.voiceVolume}
            display={`${Math.round(draft.settings.voiceVolume * 100)}%`}
            onChange={setLiveVoiceVolume}
          />
          <Slider
            label="Sound volume"
            min={0}
            max={1}
            step={0.05}
            value={draft.settings.musicVolume}
            display={`${Math.round(draft.settings.musicVolume * 100)}%`}
            onChange={setLiveMusicVolume}
          />
          <Slider
            label="Speed"
            min={0.5}
            max={1.6}
            step={0.05}
            value={draft.settings.rate}
            display={`${draft.settings.rate.toFixed(2)}×`}
            onChange={setLiveRate}
          />
        </div>
      </Card>

      <div className="space-y-3" data-rise>
        <Disclosure
          title="Breathing guide"
          summary={
            preferences.breathingEnabled
              ? `On · in ${preferences.breathPattern.inhale}s, out ${preferences.breathPattern.exhale}s`
              : 'Off'
          }
        >
          <BreathingSettings
            preferences={preferences}
            onChange={updatePreferences}
          />
        </Disclosure>

        <Disclosure
          title="Sound and feel"
          summary={
            [
              preferences.uiSounds ? 'Taps make a sound' : null,
              preferences.uiHaptics && hapticsSupported() ? 'Vibration on' : null,
            ]
              .filter(Boolean)
              .join(' · ') || 'Quiet'
          }
        >
          <div className="space-y-4">
            <Toggle
              label="Interface sounds"
              description="A soft tone when you start, pause, or finish something."
              checked={preferences.uiSounds}
              onChange={(uiSounds) => {
                updatePreferences({ uiSounds })
                if (uiSounds) cue('tap')
              }}
            />
            <Toggle
              label="Vibration"
              description={
                hapticsSupported()
                  ? 'A brief buzz on the main controls.'
                  : 'Not available in this browser. iPhone does not let web apps vibrate.'
              }
              checked={preferences.uiHaptics && hapticsSupported()}
              disabled={!hapticsSupported()}
              onChange={(uiHaptics) => {
                updatePreferences({ uiHaptics })
                if (uiHaptics) cue('tap')
              }}
            />
          </div>
        </Disclosure>
      </div>

      <div data-rise className="flex justify-center pb-2">
        <Button variant="ghost" onClick={() => navigate('/create')}>
          Edit these words
        </Button>
      </div>
    </div>
  )
}
