import { useSession } from '../state/SessionProvider'
import type { PanelKey } from './CustomizePanel'
import { PlayerControls } from './PlayerControls'
import { Sheet } from './Sheet'

interface PlayerAdjustProps {
  open: boolean
  onClose: () => void
  onOpenPanel: (key: PanelKey) => void
  onEditWords: () => void
  onOpenMixer: () => void
}

/**
 * The phone's way into the player's controls: one tap from the stage.
 *
 * The player used to carry a column beside the stage on every size of screen —
 * a Levels card, a panel of setting rows and a button back to the editor, all
 * permanently on show beside the one thing the screen is for. On a phone that
 * column stacked *below* a full-height stage, so the controls were both
 * cluttering the page and out of reach. Here they are behind one button, and
 * the sheet is the same `PlayerControls` the desktop column shows inline.
 */
export function PlayerAdjust({
  open,
  onClose,
  onOpenPanel,
  onEditWords,
  onOpenMixer,
}: PlayerAdjustProps) {
  const { session } = useSession()

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Adjust"
      description={
        session.status === 'idle'
          ? 'Everything here is optional. The defaults already work.'
          : 'Every one of these takes effect without stopping the loop.'
      }
    >
      <PlayerControls
        onOpenPanel={onOpenPanel}
        onEditWords={onEditWords}
        onOpenMixer={onOpenMixer}
      />
    </Sheet>
  )
}
