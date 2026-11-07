import { useCallback } from 'react'
import { useNavigate } from 'react-router'
import { primeBreathAudio } from './breathAudio'
import { recordEngagement } from './engagement'
import { cue } from './feedback'
import { packBreath, packToLoop, type Pack } from './packs'
import { usePreferences } from '../state/PreferencesProvider'
import { useSession } from '../state/SessionProvider'

/**
 * Play a pack: one press, from anywhere, straight into a running session.
 *
 * Everything that has to happen inside the tap happens here, in order: the
 * audio is opened while the gesture is still a gesture, the breath the pack
 * was built around becomes the guide, the loop goes into the editor (so
 * "edit these words" afterwards edits *these* words), and the session starts
 * — through the sleep timer, for a pack that ends by fading out.
 *
 * `start` is handed the loop itself rather than reading the draft, because the
 * draft update and the start happen in the same tick and the draft would still
 * be the old one. See the note on `draftRef` in `SessionProvider`.
 */
export function usePlayPack(): (pack: Pack) => void {
  const navigate = useNavigate()
  const { draft, prime, start, startSleep, loadIntoDraft } = useSession()
  const { preferences, update } = usePreferences()

  return useCallback(
    (pack: Pack) => {
      prime()
      primeBreathAudio()
      cue('start')

      const loop = packToLoop(pack, draft.settings)
      loadIntoDraft(loop)
      // The guide only changes shape if it is on; turning it on is theirs.
      if (preferences.breathingEnabled) {
        update({ breathPattern: packBreath(pack).pattern })
      }

      if (pack.sleepMinutes) startSleep(pack.sleepMinutes, loop)
      else start(loop)

      recordEngagement()
      navigate('/player')
    },
    [
      draft.settings,
      loadIntoDraft,
      navigate,
      preferences.breathingEnabled,
      prime,
      start,
      startSleep,
      update,
    ],
  )
}

/** Put a pack in the editor without playing it, to make it your own first. */
export function useEditPack(): (pack: Pack) => void {
  const navigate = useNavigate()
  const { draft, loadIntoDraft } = useSession()
  return useCallback(
    (pack: Pack) => {
      cue('tap')
      const loop = packToLoop(pack, draft.settings)
      // Not a play: editing a pack starts a loop of their own, not a record of one.
      loadIntoDraft({ ...loop, id: `${loop.id}-${Date.now().toString(36)}`, origin: 'kept' })
      navigate('/create')
    },
    [draft.settings, loadIntoDraft, navigate],
  )
}
