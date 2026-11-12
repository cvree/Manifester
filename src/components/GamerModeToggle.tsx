import { cue } from '../lib/feedback'
import { usePreferences } from '../state/PreferencesProvider'
import { Toggle } from './Toggle'

/**
 * Gamer mode, in the one sentence it needs and the list that keeps it honest.
 *
 * The same control wherever it appears — the settings list on Create and the
 * player, and Appearance on About — so there is one description of what the
 * mode does and it cannot drift from what `PreferencesProvider` actually
 * switches off.
 */
export function GamerModeToggle() {
  const { preferences, update } = usePreferences()

  return (
    <div className="space-y-4">
      <Toggle
        label="Gamer mode"
        description="Keep listening while a game has the machine. Manifester does as little as it can in the background."
        checked={preferences.gamerMode}
        onChange={(gamerMode) => {
          update({ gamerMode })
          cue('select')
        }}
      />
      <ul className="type-meta list-disc space-y-1.5 pl-5">
        <li>Nothing animates, and the background and glass effects are not drawn.</li>
        <li>
          The on-device voice model is put down. Lines you have heard before
          still play in the same voice; new lines use your device’s own voice.
        </li>
        <li>Nothing is prepared ahead of time, and the screen is not kept awake.</li>
        <li>Your words, voice volume and background sound stay exactly as they are.</li>
      </ul>
      <p className="type-meta text-ink-faint">
        Start playback first, then switch to your game. Desktop browsers keep a
        background tab’s audio going; phones usually pause a web page’s audio
        when it leaves the screen.
      </p>
    </div>
  )
}
