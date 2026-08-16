import { useState } from 'react'
import { AiSetupPanel } from '../AiSetupPanel'
import { PROVIDER } from '../../lib/ai/providers'
import { setStoredCredentials, useCredentials } from '../../lib/ai/useCredentials'
import { cue } from '../../lib/feedback'
import { readLocal, writeLocal } from '../../lib/storage'
import { usePreferences } from '../../state/PreferencesProvider'
import { Button } from '../Button'
import { SparkIcon } from '../Icons'
import { Sheet } from '../Sheet'

/**
 * The one time the app offers to connect an AI, and it asks properly.
 *
 * ── Why it is a sheet and not another step ──────────────────────────────────
 *
 * Because it is genuinely optional in a way none of the other choices are, and
 * because it is the only thing in the entire first minute that involves
 * anything leaving the device. A step implies "answer this to continue"; a
 * sheet that opens on request and closes on Escape implies "here is a thing,
 * look if you like" — which is the truthful shape of this particular offer.
 *
 * ── Why it is offered at all, given the app is offline-first ────────────────
 *
 * The writing helper already works with nothing connected: `improveWords` runs
 * on the device and rewrites a sentence into the present tense without asking
 * anybody's permission. What a real model adds is the harder half — turning a
 * paragraph somebody typed at midnight into a line worth hearing forty times —
 * and that is worth having *if* the person wants it enough to paste a key in.
 *
 * So the offer is honest about the trade in the first sentence: their words
 * leave the device when they press the button, and never at any other time.
 * The panel behind it is the same one Settings uses, which means the whole
 * step-by-step and the master switch are here rather than one hop away.
 *
 * ── Asked once ──────────────────────────────────────────────────────────────
 *
 * The card is shown to somebody who has not connected anything and has not
 * already waved it away. Both outcomes are remembered, so this is a thing that
 * happens on a first visit and then never again.
 */

const SEEN_KEY = 'ai.offered'

export function hasSeenAiOffer(): boolean {
  return readLocal(SEEN_KEY) === 'yes'
}

function markSeen(): void {
  writeLocal(SEEN_KEY, 'yes')
}

interface AiOfferProps {
  className?: string
}

export function AiOffer({ className }: AiOfferProps) {
  const credentials = useCredentials()
  const { preferences, update } = usePreferences()
  const [open, setOpen] = useState(false)
  const [dismissed, setDismissed] = useState(() => hasSeenAiOffer())

  // Nothing to offer somebody who has already connected one, or already said no.
  if (credentials || dismissed) return null

  return (
    <>
      <div
        className={className}
        // A quiet surface, deliberately below the Studio Voice card in weight.
        // Studio Voice is the offer that makes the app better for everybody;
        // this one is for the small number of people who will actually want it.
      >
        <div className="rounded-[1.15rem] border border-dashed border-[var(--border-strong)] px-4 py-3 text-left">
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--quiet)] text-[0.85rem] text-ink-faint"
            >
              <SparkIcon />
            </span>
            <p className="min-w-0 grow text-[0.92rem] text-ink">
              Want AI help writing your lines?
            </p>
          </div>
          <p className="mt-1.5 text-[0.82rem] leading-snug text-ink-muted">
            Optional. Manifester already rewrites lines on this device — a
            connected model is better at it, and is the one thing here that
            sends your words anywhere.
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => {
                cue('tap')
                setOpen(true)
              }}
            >
              Show me
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                cue('tap')
                markSeen()
                setDismissed(true)
              }}
            >
              No thanks
            </Button>
          </div>
        </div>
      </div>

      <Sheet
        open={open}
        onClose={() => {
          markSeen()
          setDismissed(true)
          setOpen(false)
        }}
        title="AI writing help"
        description={`Off until you connect a key. ${PROVIDER.name} is the one provider this app supports.`}
      >
        <AiSetupPanel
          credentials={credentials}
          onChange={(next) => {
            setStoredCredentials(next)
            if (next) {
              markSeen()
              setDismissed(true)
              setOpen(false)
            }
          }}
          enabled={preferences.aiEnabled}
          onEnabledChange={(aiEnabled) => update({ aiEnabled })}
        />
      </Sheet>
    </>
  )
}
