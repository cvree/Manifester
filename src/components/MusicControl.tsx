import { useEffect, useState } from 'react'
import { cx } from '../lib/cx'
import { cue } from '../lib/feedback'
import { soundtrack, type SoundtrackStatus } from '../lib/soundtrack'
import { usePreferences } from '../state/PreferencesProvider'
import { NoteIcon, NoteOffIcon } from './Icons'
import { Sheet } from './Sheet'
import { Slider } from './Slider'
import { Toggle } from './Toggle'

/**
 * What is sounding, for the one place allowed to say so.
 *
 * A hook rather than a prop, because the answer is owned by the audio layer
 * and nothing on the page should be re-rendering to keep up with it — only the
 * panel subscribes, and only while it is open.
 */
export function useSoundtrackStatus(): SoundtrackStatus {
  // Seeded from what is already playing, so the panel never opens on a stale
  // "nothing is playing" and correct itself a frame later.
  const [status, setStatus] = useState<SoundtrackStatus>(() => soundtrack.getStatus())
  useEffect(() => soundtrack.subscribe(setStatus), [])
  return status
}

/**
 * The whole of the music's controls: whether there is any, and how loud.
 *
 * Two rows, and there is not going to be a third. A skip button implies a
 * playlist, a progress bar implies a duration worth watching, and a waveform
 * implies that the point of this is to be looked at — none of which is true of
 * a layer whose success condition is that nobody notices it. What is here is
 * what somebody actually reaches for: make it stop, or make it quieter.
 */
export function MusicSettings() {
  const { preferences, update } = usePreferences()
  const status = useSoundtrackStatus()

  return (
    <div className="space-y-5">
      <Toggle
        label="Music"
        description="A quiet piece under the app that changes with where you are. It sits far below your words, and steps back while they are spoken."
        checked={preferences.music}
        onChange={(music) => {
          /*
           * Told to the audio layer here, synchronously, and only then stored.
           *
           * Both halves matter. A browser will not open audio a beat after the
           * press — a React effect reacting to the stored preference is a beat
           * later — so switching the music on has to reach `begin()` from
           * inside this handler or the first time somebody turns it on
           * nothing happens. And saying it twice is free: the effect in
           * `PreferencesProvider` finds the value already set and does
           * nothing, which is what keeps a preference restored from storage
           * and one just chosen on the same path.
           */
          soundtrack.setEnabled(music, true)
          if (music) soundtrack.begin()
          update({ music })
          // Answered by hearing it, the way the interface cues are.
          cue(music ? 'select' : 'tap')
        }}
      />

      <Slider
        label="Music level"
        min={0}
        max={1}
        step={0.05}
        value={preferences.musicVolume}
        display={`${Math.round(preferences.musicVolume * 100)}%`}
        disabled={!preferences.music}
        hint="Its own level, separate from the background sound and from the voice."
        onChange={(musicVolume) => update({ musicVolume })}
      />

      {/*
        The title, and only here. It appears once something is actually
        playing, which on a first visit is after the first press — saying the
        name of a piece that is not sounding would be a claim rather than a
        label.
      */}
      <p className="type-meta" role="status">
        {preferences.music && status.playing && status.title
          ? `Playing now: ${status.title}.`
          : preferences.music
            ? 'Nothing plays until you press something.'
            : 'The music is off. Your voice, the background sound and the breath are unaffected.'}
      </p>
    </div>
  )
}

/**
 * The soundtrack's one piece of chrome: a button beside the day/night toggle.
 *
 * It sits in the header rather than inside a settings screen because it is the
 * control somebody reaches for at the moment they want it — usually because
 * they have just walked into a room with other people in it — and a mute that
 * takes four taps to find is a mute that does not work. Everything past on and
 * off is behind it, in the app's ordinary settings sheet.
 */
export function MusicControl({ className }: { className?: string }) {
  const { preferences } = usePreferences()
  const [open, setOpen] = useState(false)
  const on = preferences.music

  return (
    <>
      <button
        type="button"
        onClick={() => {
          cue('tap')
          setOpen(true)
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={on ? 'Music settings. Music is on.' : 'Music settings. Music is off.'}
        title="Music"
        className={cx(
          'interactive flex h-11 w-11 items-center justify-center rounded-full border text-[1.05rem]',
          'border-[var(--panel-border)] bg-[var(--panel)]',
          // Muted is a state you should be able to read at a glance, so it is
          // carried by the icon as well as by the colour.
          on
            ? 'text-ink-muted hover:text-ink'
            : 'text-ink-faint opacity-70 hover:opacity-100',
          className,
        )}
      >
        {on ? <NoteIcon /> : <NoteOffIcon />}
      </button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Music"
        description="The soundtrack under the app."
      >
        <MusicSettings />
      </Sheet>
    </>
  )
}
