import { useMemo, useState } from 'react'
import { cx } from '../lib/cx'
import { cue } from '../lib/feedback'
import { draftToLoop } from '../lib/loops'
import {
  hasSeenFirstLoopNudge,
  markFirstLoopNudgeSeen,
} from '../lib/onboarding'
import { tts } from '../lib/tts'
import { useStudioVoice } from '../lib/tts/useTTSStatus'
import { useLibrary } from '../state/LibraryProvider'
import { useSession } from '../state/SessionProvider'
import { Button } from './Button'
import { CheckIcon, SeedIcon, SparkIcon, WaveIcon } from './Icons'

/**
 * One thing to learn, once, after the first loop has actually finished.
 *
 * Not a feature tour. The welcome experience deliberately taught nothing about
 * saving, sounds, timers, breathing patterns, exporting or the writing helper,
 * because none of that is worth knowing before you have heard your own words
 * read back to you. This is the other half of that decision: exactly one
 * suggestion, chosen by what this person has *not* done, offered at the one
 * moment they are sitting still and pleased.
 *
 * It appears once in the lifetime of the installation and never again — the
 * flag is written whether they take it or dismiss it, because a suggestion
 * that keeps coming back is not a suggestion.
 */

type Suggestion = 'save' | 'studio' | 'sound'

interface FirstLoopNudgeProps {
  /** Open the background sound sheet, for the third suggestion. */
  onChangeSound: () => void
  className?: string
}

export function FirstLoopNudge({ onChangeSound, className }: FirstLoopNudgeProps) {
  const { draft } = useSession()
  const { loops, saveLoop } = useLibrary()
  const studio = useStudioVoice()

  /*
   * Decided once, on mount, and then held.
   *
   * Recomputing would be worse than useless: saving the loop would flip the
   * suggestion to a different one mid-animation, so the card somebody just
   * acted on would rewrite itself into a new request. The answer to "what
   * should this person learn next" is a question about the moment they
   * arrived here.
   */
  const [suggestion] = useState<Suggestion | null>(() => {
    if (hasSeenFirstLoopNudge()) return null
    const saved = draft.id != null && loops.some((loop) => loop.id === draft.id)
    if (!saved) return 'save'
    if (studio.state === 'available' || studio.state === 'failed') return 'studio'
    return 'sound'
  })

  const [dismissed, setDismissed] = useState(false)
  const [done, setDone] = useState(false)

  const content = useMemo(() => {
    switch (suggestion) {
      case 'save':
        return {
          icon: SeedIcon,
          title: 'Keep this one?',
          body: 'Saved loops stay on this device and open again in one tap.',
          action: 'Save this loop',
          doneLabel: 'Saved to your library',
        }
      case 'studio':
        return {
          icon: SparkIcon,
          title: 'Have Ivy read anything you write',
          body: 'Studio Voice generates speech privately on this device. Free, offline, about 90 MB.',
          action: 'Install Studio Voice',
          doneLabel: 'Preparing Studio Voice…',
        }
      default:
        return {
          icon: WaveIcon,
          title: 'Try a different room',
          body: 'Rain, a moonlit garden, a soft horizon — the sound under your words changes the whole session.',
          action: 'Change the sound',
          doneLabel: null,
        }
    }
  }, [suggestion])

  if (!suggestion || dismissed) return null

  const settle = () => {
    markFirstLoopNudgeSeen()
  }

  const act = async () => {
    cue('tap')
    settle()
    if (suggestion === 'save') {
      const existing = draft.id ? loops.find((loop) => loop.id === draft.id) : null
      await saveLoop(draftToLoop(draft, existing ?? null))
      cue('save')
      setDone(true)
      return
    }
    if (suggestion === 'studio') {
      void tts.installStudioVoice()
      setDone(true)
      return
    }
    onChangeSound()
    setDismissed(true)
  }

  const Icon = done ? CheckIcon : content.icon

  return (
    <div
      className={cx(
        'rounded-[1.25rem] border border-[var(--border)] bg-[var(--surface-sunken)] p-4 text-left',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={cx(
            'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[1.05rem]',
            done
              ? 'bg-[var(--sage-soft)] text-[var(--sage)]'
              : 'bg-[var(--rose-soft)] text-[var(--rose-deep)]',
          )}
        >
          <Icon />
        </span>

        <div className="min-w-0 grow">
          {done ? (
            <p className="text-[0.95rem] text-ink" role="status">
              {content.doneLabel}
            </p>
          ) : (
            <>
              <p className="text-[1rem] font-medium text-ink">{content.title}</p>
              <p className="mt-1 text-[0.88rem] leading-relaxed text-ink-muted">
                {content.body}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="primary" onClick={() => void act()}>
                  {content.action}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    cue('tap')
                    settle()
                    setDismissed(true)
                  }}
                >
                  Not now
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
