import { cx } from '../lib/cx'
import { detectPlatform } from '../lib/motion'
import type { RankedVoice } from '../lib/voiceRanking'
import { Disclosure } from './Disclosure'
import { CheckIcon, SparkIcon } from './Icons'

interface BetterVoicesPanelProps {
  /** The voice the current settings resolve to. */
  current: RankedVoice | null
  voicesReady: boolean
}

/**
 * How to actually get a good voice.
 *
 * Every platform ships free neural voices that are not installed by default,
 * and they are dramatically better than the legacy synths most devices fall
 * back to. Pointing someone at the right settings screen does far more for
 * quality than anything the app could do in software — an on-device neural
 * model was tried and is roughly three times slower than real time in a
 * browser, while these run on dedicated hardware and keep speaking when the
 * screen locks.
 */
export function BetterVoicesPanel({ current, voicesReady }: BetterVoicesPanelProps) {
  const platform = detectPlatform()
  const alreadyGood = current?.tier === 'neural' || current?.tier === 'enhanced'

  if (!voicesReady) return null

  return (
    <div
      className={cx(
        'rounded-[1.25rem] border p-4',
        alreadyGood
          ? 'border-[var(--sage)] bg-[var(--sage-soft)]'
          : 'border-[var(--border)] bg-[var(--surface-sunken)]',
      )}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={cx(
            'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[1.05rem]',
            alreadyGood
              ? 'bg-[var(--sage-soft)] text-[var(--sage)]'
              : 'bg-[var(--gold-soft)] text-[var(--gold)]',
          )}
        >
          {alreadyGood ? <CheckIcon /> : <SparkIcon />}
        </span>

        <div className="min-w-0 grow">
          <p className="text-[1rem] font-medium text-ink">
            {alreadyGood
              ? 'You are using a high quality voice'
              : 'Get a much better voice, free'}
          </p>
          <p className="mt-1 text-[0.88rem] leading-relaxed text-ink-muted">
            {alreadyGood
              ? 'This device has a modern neural voice installed and Manifester is using it.'
              : 'Your device can download natural-sounding voices from its own settings. They are free, they work offline, and they sound far better than the default.'}
          </p>

          <Disclosure
            className="mt-3 border-[var(--border)] bg-transparent"
            title={alreadyGood ? 'Add more voices' : 'Show me how'}
            defaultOpen={!alreadyGood && platform === 'ios'}
          >
            <div className="space-y-4 text-[0.9rem] leading-relaxed text-ink-muted">
              <div>
                <h4 className="mb-1 font-medium text-ink">
                  iPhone and iPad{platform === 'ios' && ' — you are here'}
                </h4>
                <p>
                  Settings → Accessibility → Spoken Content → Voices → English.
                  Download a voice marked <strong className="text-ink">Premium</strong>{' '}
                  — these are Apple's neural voices and they sound close to a real
                  person.
                </p>
                <p className="mt-1.5">
                  Good ones to try: <strong className="text-ink">Ava</strong> or{' '}
                  <strong className="text-ink">Zoe</strong> for a feminine voice,{' '}
                  <strong className="text-ink">Evan</strong> or{' '}
                  <strong className="text-ink">Nathan</strong> for a masculine one.
                  Come back here afterwards and they will appear automatically.
                </p>
              </div>

              <div>
                <h4 className="mb-1 font-medium text-ink">
                  Android{platform === 'android' && ' — you are here'}
                </h4>
                <p>
                  Settings → Accessibility → Text-to-speech output. Choose{' '}
                  <strong className="text-ink">Google Speech Services</strong> and
                  install the English voice data.
                </p>
              </div>

              <div>
                <h4 className="mb-1 font-medium text-ink">
                  Windows{platform === 'desktop' && ' — you may be here'}
                </h4>
                <p>
                  Settings → Time &amp; language → Language &amp; region → English →
                  Language options → add <strong className="text-ink">Speech</strong>.
                  Windows 11's voices marked{' '}
                  <strong className="text-ink">Natural</strong> are excellent. Chrome
                  and Edge also offer Google and Microsoft online voices with no
                  install at all.
                </p>
              </div>

              <div>
                <h4 className="mb-1 font-medium text-ink">Mac</h4>
                <p>
                  System Settings → Accessibility → Spoken Content → System Voice →
                  Manage Voices. Look for{' '}
                  <strong className="text-ink">Premium</strong> or{' '}
                  <strong className="text-ink">Enhanced</strong>.
                </p>
              </div>
            </div>
          </Disclosure>
        </div>
      </div>
    </div>
  )
}
