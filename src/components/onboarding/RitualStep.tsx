import { useState } from 'react'
import { cx } from '../../lib/cx'
import { cue } from '../../lib/feedback'
import { estimateSpokenSeconds, formatApproxDuration } from '../../lib/format'
import { VOICE_PROFILES, voiceForStyle } from '../../lib/tts'
import { useTTSStatus } from '../../lib/tts/useTTSStatus'
import type { LoopSettings } from '../../lib/types'
import { Button } from '../Button'
import { BreathIcon, ClockIcon, VoiceIcon, WaveIcon } from '../Icons'
import { StudioVoicePanel } from '../StudioVoicePanel'
import { Reveal, RevealText } from './Reveal'
import type { Audition } from './useAudition'

/**
 * What is about to happen, in four facts and one sentence.
 *
 * Not a settings screen. Every one of these is already decided — a voice they
 * chose, a breath pattern, an ambience and a length that are the app's own
 * defaults and are good — and the only reason they are on screen is that
 * somebody about to close their eyes for ten minutes should know what they are
 * agreeing to. `Customize` is a quiet link for the person who wants to argue
 * with one of them, and it goes to the real editor rather than reimplementing
 * a worse one here.
 *
 * The living part of this preview is the field behind the page, which is
 * breathing on exactly the pattern named in the second chip. A second orb here
 * would be two things breathing slightly out of step, which is worse than one.
 *
 * Studio Voice is offered *here*, at the end, and never earlier: by now they
 * have heard Ivy and Fen say their own words, so "generated privately on this
 * device" is an offer about something they have experienced rather than a
 * ninety-megabyte question about a voice they have not.
 */

interface RitualStepProps {
  text: string
  settings: LoopSettings
  /** The breath pattern's name. It is a preference, not a loop setting. */
  breathLabel: string
  soundName: string
  audition: Audition
  onBegin: () => void
  onCustomize: () => void
  beginning: boolean
}

export function RitualStep({
  text,
  settings,
  breathLabel,
  soundName,
  audition,
  onBegin,
  onCustomize,
  beginning,
}: RitualStepProps) {
  const status = useTTSStatus()
  const [declined, setDeclined] = useState(false)

  const line = text.trim()
  const spoken = estimateSpokenSeconds(line, settings.rate)

  const facts = [
    {
      icon: VoiceIcon,
      label: 'Voice',
      value: VOICE_PROFILES[voiceForStyle(settings.voiceStyle)].label,
    },
    {
      icon: BreathIcon,
      label: 'Breath',
      value: breathLabel,
    },
    { icon: WaveIcon, label: 'Sound', value: soundName },
    {
      icon: ClockIcon,
      label: 'Length',
      value:
        settings.timerMinutes == null
          ? 'Open'
          : `${settings.timerMinutes} min`,
    },
  ]

  return (
    <div className="text-center">
      <RevealText
        as="p"
        className="type-label text-ink-faint"
        text="Your first loop"
      />

      {/*
        Their words, at the size the whole minute was building towards, and
        tappable — because the last thing before pressing Start is wanting to
        hear it once more.
      */}
      <Reveal delay={0.2}>
        <button
          type="button"
          onClick={() => {
            cue('tap')
            if (audition.speaking === line) audition.stop()
            else audition.play(line, settings.voiceStyle)
          }}
          className="interactive mt-3 block w-full rounded-[1.25rem] px-2 py-2 text-center"
          aria-label={`Hear your affirmation: ${line}`}
        >
          <span className="type-title mx-auto block max-w-[22ch] text-balance">
            “{line}”
          </span>
          <span className="type-meta mt-2 inline-flex items-center gap-1.5">
            {audition.speaking === line
              ? 'Playing'
              : audition.loading === line
                ? 'Preparing…'
                : 'Tap to hear it again'}
          </span>
        </button>
      </Reveal>

      <Reveal delay={0.4}>
        <dl className="mt-1 grid grid-cols-2 gap-1.5 sm:grid-cols-4 sm:gap-2">
          {facts.map(({ icon: Icon, label, value }) => (
            <div
              key={label}
              className="rounded-[1rem] border border-[var(--border)] bg-[var(--surface-sunken)] px-3 py-2 text-left"
            >
              <dt className="flex items-center gap-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.09em] text-ink-faint">
                <Icon aria-hidden="true" className="text-[0.85rem]" />
                {label}
              </dt>
              <dd className="mt-0.5 truncate text-[0.94rem] text-ink">{value}</dd>
            </div>
          ))}
        </dl>

        <p className="type-meta mt-2.5">
          {formatApproxDuration(spoken)} a pass · {settings.repeatPauseSeconds}s
          between ·{' '}
          <button
            type="button"
            onClick={() => {
              cue('tap')
              onCustomize()
            }}
            className="interactive rounded-pill px-1 underline decoration-[var(--border-strong)] underline-offset-4 hover:text-ink"
          >
            Customize
          </button>
        </p>
      </Reveal>

      <Reveal delay={0.55} distance={10}>
        {declined || status.unlimited ? (
          <p className="type-meta mt-5">
            {status.unlimited
              ? 'Studio Voice is installed — every line is generated on this device.'
              : 'Studio Voice is under Voice in settings whenever you want it.'}
          </p>
        ) : (
          <StudioVoicePanel
            variant="compact"
            className="mt-4 text-left"
            onDismiss={() => setDeclined(true)}
          />
        )}

        <Button
          variant="primary"
          size="xl"
          block
          className="mt-4"
          loading={beginning}
          onClick={() => {
            cue('start')
            audition.stop()
            onBegin()
          }}
        >
          {beginning ? 'Beginning…' : 'Begin my first loop'}
        </Button>

        <p className={cx('type-meta mt-2.5')}>Stop whenever you like.</p>
      </Reveal>
    </div>
  )
}
