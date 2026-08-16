import { useState } from 'react'
import { cue } from '../../lib/feedback'
import { STUDIO_DOWNLOAD_MB } from '../../lib/tts'
import { useStudioVoice } from '../../lib/tts/useTTSStatus'
import type { RankedVoice } from '../../lib/voiceRanking'
import { Button } from '../Button'
import { DeviceVoicePicker } from '../DeviceVoicePicker'
import { SparkIcon } from '../Icons'
import { StudioVoicePanel } from '../StudioVoicePanel'
import { Reveal, RevealText } from './Reveal'

/**
 * The question that has to be answered before somebody types their own line.
 *
 * ── The confusion this exists to end ────────────────────────────────────────
 *
 * The app ships with about a hundred affirmations already recorded in Ivy and
 * Fen. Anything *outside* that shelf has to be generated, and generating it
 * needs the on-device model. Without the model, a line somebody typed was
 * handed to `speechSynthesis` and read by whatever the operating system had
 * lying around — a completely different voice, often a poor one, arriving with
 * no explanation, on the screen where the person had just been comparing Ivy
 * and Fen.
 *
 * Every part of that was working as designed and all of it felt broken. The
 * mistake was not the fallback; it was letting somebody walk into it without
 * being asked. "Write my own" looked like a text field and was in fact a
 * decision about what the rest of the session would sound like.
 *
 * ── What it asks ────────────────────────────────────────────────────────────
 *
 * So the decision is made explicitly, once, before the textarea opens, and
 * both answers are real:
 *
 *  - **Install Studio Voice.** Ninety megabytes, once, and then their own
 *    words are read by the same Ivy and Fen they have just been listening to.
 *  - **Use this device's voice.** Instant, free, and now a *choice of voice*
 *    rather than a silent substitution — which on a device with a modern
 *    neural voice installed is genuinely good, and on a device without one is
 *    at least honestly labelled.
 *
 * There is no third option that lets somebody past this screen without knowing
 * which of the two they picked, and that is the entire point of it.
 */

interface OwnWordsGateProps {
  /** Which style card they are on, so the device list leads with it. */
  style: 'feminine' | 'masculine'
  voices: RankedVoice[]
  voicesReady: boolean
  /** The device voice currently chosen, if they have chosen one. */
  selectedVoiceURI: string | null
  onChooseDeviceVoice: (voice: RankedVoice) => void
  onPreviewDeviceVoice?: (voice: RankedVoice) => void
  /** Let them through: the question has an answer now. */
  onResolved: () => void
  /** Back to the suggestions, having decided not to decide. */
  onCancel: () => void
}

export function OwnWordsGate({
  style,
  voices,
  voicesReady,
  selectedVoiceURI,
  onChooseDeviceVoice,
  onPreviewDeviceVoice,
  onResolved,
  onCancel,
}: OwnWordsGateProps) {
  const studio = useStudioVoice()

  /**
   * Whether the device-voice half is on screen.
   *
   * Closed to begin with, because opening with a list of second-best options
   * would answer the question before it has been asked. It opens on request,
   * and it opens *by itself* when an install fails — at that moment the person
   * has no other way forward and being made to press one more button to find
   * that out would be unkind.
   */
  const [choosing, setChoosing] = useState(false)
  const failed = studio.state === 'failed'
  const showDevice = choosing || failed || studio.state === 'unsupported'

  return (
    <div>
      <RevealText
        as="h1"
        className="type-title text-center text-balance"
        text="Who should read your own words?"
      />

      <Reveal delay={0.28}>
        <p className="type-body mt-3 text-center text-balance">
          The suggested lines are already recorded in Ivy and Fen. Anything you
          write yourself has to be spoken fresh — so it is worth deciding now
          what that will sound like.
        </p>
      </Reveal>

      <Reveal delay={0.4}>
        {studio.installed ? (
          <div className="mt-5 rounded-[1.25rem] border border-[var(--sage)] bg-[var(--sage-soft)] p-4">
            <p className="text-[0.95rem] leading-relaxed text-ink">
              Studio Voice is installed, so your words are read by the same Ivy
              and Fen — generated on this device, and never sent anywhere.
            </p>
          </div>
        ) : (
          <StudioVoicePanel
            variant="card"
            className="mt-5 text-left"
            onInstalled={onResolved}
            onChooseAnother={() => setChoosing(true)}
            chooseAnotherLabel="Use this device instead"
          />
        )}
      </Reveal>

      {!studio.installed && !showDevice && (
        <Reveal delay={0.5}>
          <button
            type="button"
            onClick={() => {
              cue('tap')
              setChoosing(true)
            }}
            className="interactive mx-auto mt-3 block min-h-11 rounded-pill px-3 text-[0.88rem] text-ink-muted underline decoration-[var(--border-strong)] underline-offset-4 hover:text-ink"
          >
            I would rather not download {STUDIO_DOWNLOAD_MB} MB
          </button>
        </Reveal>
      )}

      {!studio.installed && showDevice && (
        <Reveal delay={0.15}>
          <div className="mt-4 rounded-[1.25rem] border border-[var(--border)] bg-[var(--surface-sunken)] p-4 text-left">
            <div className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--quiet)] text-[1.05rem] text-ink-faint"
              >
                <SparkIcon />
              </span>
              <div className="min-w-0 grow">
                <p className="text-[1rem] font-medium text-ink">
                  This device&rsquo;s own voice
                </p>
                <p className="mt-1 text-[0.88rem] leading-relaxed text-ink-muted">
                  Nothing to download, and nothing leaves this device either. It
                  will not be Ivy or Fen — it is whichever of these you choose,
                  and some of them are very good.
                </p>
              </div>
            </div>

            <DeviceVoicePicker
              className="mt-3.5"
              voices={voices}
              voicesReady={voicesReady}
              selected={selectedVoiceURI}
              onSelect={onChooseDeviceVoice}
              onPreview={onPreviewDeviceVoice}
              style={style}
            />

            <Button
              variant="primary"
              size="md"
              className="mt-3"
              onClick={() => {
                cue('tap')
                onResolved()
              }}
            >
              Use this voice and write my own
            </Button>
          </div>
        </Reveal>
      )}

      <Reveal delay={0.6} distance={10}>
        <button
          type="button"
          onClick={() => {
            cue('tap')
            onCancel()
          }}
          className="interactive mx-auto mt-4 block min-h-11 rounded-pill px-3 text-[0.9rem] text-ink-faint hover:text-ink"
        >
          Back to the suggested lines
        </button>
      </Reveal>
    </div>
  )
}
