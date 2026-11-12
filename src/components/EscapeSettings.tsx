import { useEffect, useState } from 'react'
import { useLocation } from 'react-router'
import { cue } from '../lib/feedback'
import {
  breathingSummary,
  feelSummary,
  musicSummary,
  soundSummary,
  timerSummary,
} from '../lib/summaries'
import { useLibrary } from '../state/LibraryProvider'
import { usePreferences } from '../state/PreferencesProvider'
import { useSession } from '../state/SessionProvider'
import { SettingsSheets, type PanelKey } from './CustomizePanel'
import { GamerModeToggle } from './GamerModeToggle'
import {
  BreathIcon,
  ClockIcon,
  MicIcon,
  MuteIcon,
  NoteIcon,
  TuneIcon,
  WaveIcon,
} from './Icons'
import { SettingRow } from './SettingRow'
import { Sheet } from './Sheet'

/**
 * Escape opens the settings, the way a game's pause menu does.
 *
 * Mounted once, in the shell, so it works on every screen. Escape still does
 * its ordinary job first: a sheet, a menu or the expanded player that answers
 * it calls `preventDefault`, and this listener — on `window`, so it runs after
 * every `document` listener — leaves a handled key alone. It also stays out of
 * text fields, where Escape belongs to the field, and out of the introduction.
 *
 * Gamer mode is the first thing in it, switchable in place: the moment somebody
 * reaches for Escape is very often the moment a game is about to have the
 * screen. Everything else is a row that opens its own sheet, and closing that
 * sheet comes back here — one level of "back", as a pause menu has.
 */
export function EscapeSettings() {
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [panel, setPanel] = useState<PanelKey | null>(null)
  const { draft } = useSession()
  const { preferences } = usePreferences()
  const { allTracks } = useLibrary()

  const onboarding = location.pathname === '/welcome'

  useEffect(() => {
    if (onboarding) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      if (event.isComposing || event.repeat) return
      const target = event.target as HTMLElement | null
      if (
        target?.closest?.(
          'input, textarea, select, [contenteditable=""], [contenteditable="true"]',
        )
      ) {
        return
      }
      // Any dialog already on screen owns the key.
      if (document.querySelector('[aria-modal="true"]')) return
      event.preventDefault()
      cue('tap')
      setPanel(null)
      setMenuOpen(true)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onboarding])

  // Leaving for the introduction closes everything.
  useEffect(() => {
    if (!onboarding) return
    setMenuOpen(false)
    setPanel(null)
  }, [onboarding])

  const { settings } = draft
  const soundOn = settings.sound.mode !== 'off'

  const openPanel = (key: PanelKey) => {
    cue('tap')
    setMenuOpen(false)
    setPanel(key)
  }

  return (
    <>
      <Sheet
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        title="Settings"
        description="Escape opens this from anywhere, and closes it again."
      >
        <div className="space-y-6">
          <section aria-labelledby="escape-gamer-heading">
            <h3 id="escape-gamer-heading" className="type-label mb-2.5">
              Performance
            </h3>
            <div className="surface-quiet px-4 py-4 sm:px-5">
              <GamerModeToggle />
            </div>
          </section>

          <section aria-labelledby="escape-more-heading">
            <h3 id="escape-more-heading" className="type-label mb-2.5">
              Everything else
            </h3>
            <div className="surface-panel overflow-hidden shadow-none">
              <SettingRow
                icon={<MicIcon />}
                title="Voice"
                summary="Who reads your words, and how quickly"
                onClick={() => openPanel('voice')}
              />
              <SettingRow
                icon={soundOn ? <WaveIcon /> : <MuteIcon />}
                title="Background sound"
                summary={soundSummary(settings, allTracks)}
                onClick={() => openPanel('sound')}
                accent={soundOn}
              />
              <SettingRow
                icon={<BreathIcon />}
                title="Breathing"
                summary={breathingSummary(
                  preferences.breathingEnabled,
                  preferences.breathPattern,
                  preferences.breathStyle,
                  preferences.breathSound,
                  preferences.backgroundVisualizer,
                  preferences.backgroundMode,
                  preferences.cinematicTypography,
                )}
                onClick={() => openPanel('breathing')}
                accent={preferences.breathingEnabled}
              />
              <SettingRow
                icon={<NoteIcon />}
                title="Music"
                summary={musicSummary(preferences.music, preferences.musicVolume)}
                onClick={() => openPanel('music')}
                accent={preferences.music}
              />
              <SettingRow
                icon={<ClockIcon />}
                title="Repeat and length"
                summary={timerSummary(settings.timerMinutes, settings.repeat)}
                onClick={() => openPanel('timer')}
                accent={settings.repeat}
              />
              <SettingRow
                icon={<TuneIcon />}
                title="Feedback"
                summary={feelSummary(preferences.uiSounds, preferences.uiHaptics)}
                onClick={() => openPanel('feel')}
              />
            </div>
          </section>
        </div>
      </Sheet>

      <SettingsSheets
        open={panel}
        onOpenChange={(key) => {
          setPanel(key)
          // Closing a sheet opened from here comes back to the menu.
          if (key == null) setMenuOpen(true)
        }}
      />
    </>
  )
}
