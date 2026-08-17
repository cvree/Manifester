import { useState } from 'react'
import { cue } from '../lib/feedback'
import { deleteAllDataAndRestart } from '../lib/reset'
import { Button } from './Button'
import { TrashIcon } from './Icons'

/**
 * The way back to an empty app, without leaving the app.
 *
 * Two audiences, one button. Somebody who wants to be rid of Manifester should
 * not have to trust that four levels of browser settings did what they said;
 * and anybody testing a change to it needs a *reliable* first-run, because the
 * bugs that survive longest are the ones that only appear on a device carrying
 * something from a previous version — a cached clip, a stored preference, a
 * service worker still serving last week's code. `lib/reset.ts` is the list of
 * exactly what goes.
 *
 * ── Why it asks twice ───────────────────────────────────────────────────────
 *
 * Because it cannot be undone and one of the five things it removes is the only
 * one that was ever irreplaceable: somebody's loops. So the first press does
 * nothing but explain, in the sentences below, and the confirmation says
 * *Delete everything* rather than *OK* — a button somebody presses by accident
 * should not be able to be the last one. The backup panel is named in that
 * explanation rather than merely existing elsewhere on the page, because the
 * moment to be told about a backup is the moment before you no longer have one.
 */
export function DeleteAllDataPanel() {
  const [asked, setAsked] = useState(false)
  const [busy, setBusy] = useState(false)

  if (!asked) {
    return (
      <>
        <p className="type-body">
          Removes everything Manifester has put on this device: your saved
          loops, imported sounds and recordings, every setting, every clip of
          speech it has cached, and Studio Voice's ninety megabytes if you
          installed it. The app then starts again exactly as it does for
          somebody opening it for the first time.
        </p>
        <p className="type-meta mt-3">
          Nothing here is sent anywhere, so nothing is deleted anywhere else —
          there is nowhere else. If you want to keep your loops, use{' '}
          <em className="not-italic text-ink">Back up library</em> at the top of
          the Library screen first.
        </p>
        <Button
          className="mt-4"
          leading={<TrashIcon className="text-[0.95rem]" />}
          onClick={() => {
            cue('tap')
            setAsked(true)
          }}
        >
          Delete all data
        </Button>
      </>
    )
  }

  return (
    <div className="rounded-[1rem] border border-[var(--gold)] bg-[var(--gold-soft)] p-4">
      <p className="type-body text-ink">
        This cannot be undone, and there is no copy anywhere else.
      </p>
      <p className="type-meta mt-2">
        Everything below goes: your library, your settings, cached speech, and
        the on-device voice. Manifester will reload as a first visit.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          variant="primary"
          loading={busy}
          leading={<TrashIcon className="text-[0.95rem]" />}
          onClick={() => {
            if (busy) return
            cue('tap')
            setBusy(true)
            /*
             * No `finally` that clears `busy`, and no error branch: this
             * function ends in a reload, so there is no component left to put
             * back into a resting state. A failure inside it is already
             * swallowed per-store — see `deleteAllData` — precisely so that one
             * refused store cannot stop the other four.
             */
            void deleteAllDataAndRestart()
          }}
        >
          {busy ? 'Deleting…' : 'Delete everything'}
        </Button>
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() => {
            cue('tap')
            setAsked(false)
          }}
        >
          Keep my data
        </Button>
      </div>
    </div>
  )
}
