import type { PanelKey } from './CustomizePanel'
import { PlayerControls } from './PlayerControls'

interface DesktopPlayerPanelProps {
  onOpenPanel: (key: PanelKey) => void
  onEditWords: () => void
  onOpenMixer: () => void
}

/**
 * The desktop half of the Player.
 *
 * Phones keep the stage as a single focused column and reach these controls
 * through Adjust; wide screens have room to leave them open beside it. Same
 * controls, same order, one component — see `PlayerControls`.
 */
export function DesktopPlayerPanel({
  onOpenPanel,
  onEditWords,
  onOpenMixer,
}: DesktopPlayerPanelProps) {
  return (
    <aside
      aria-label="Player controls"
      className="surface-panel sticky top-24 hidden overflow-hidden p-5 xl:block"
    >
      <h2 className="type-subheading">Adjust while listening</h2>
      <p className="type-meta mt-1 mb-5">
        Nothing here stops the loop.
      </p>
      <PlayerControls
        onOpenPanel={onOpenPanel}
        onEditWords={onEditWords}
        onOpenMixer={onOpenMixer}
      />
    </aside>
  )
}
