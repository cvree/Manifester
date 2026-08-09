import { useState, type CSSProperties } from 'react'
import { cx } from '../lib/cx'
import { cue } from '../lib/feedback'
import {
  HUE_PRESETS,
  hueName,
  huePreset,
  nightLightName,
  supportsHueShift,
} from '../lib/hue'
import { useTheme } from '../state/ThemeProvider'
import { FieldLabel } from './Card'
import { DragBar } from './DragBar'
import { MoonIcon, SunIcon } from './Icons'
import { SegmentedControl } from './SegmentedControl'

/**
 * The colour of the app, in three controls and no explanation.
 *
 * Two of them are bands you drag, and neither of them is a settings row that
 * happens to be draggable — they are pictures of their own range. The palette
 * band is the whole wheel drawn as the palette actually is at every rotation;
 * the night light band is the page's own paper, warmed by every strength along
 * the way. In both cases what you are dragging along is the answer, which is
 * what makes a continuous control here simpler rather than fussier: there is
 * nothing to interpret, so there is nothing to get wrong.
 *
 * Under the palette band are the named stops. They are not a second control —
 * the band is the control — they are the twelve places most people are
 * heading, one tap away, and the row is what makes the band's ticks mean
 * something.
 */
export function AppearanceSettings() {
  const { theme, setTheme, hue, setHue, nightLight, setNightLight } = useTheme()

  /*
   * Read once, on mount, rather than at module load: this is a browser
   * capability question, and asking it during render keeps the component
   * honest under tests that stub `CSS.supports`.
   */
  const [canShiftHue] = useState(supportsHueShift)
  const exact = huePreset(hue)

  /*
   * The palette sweeps over 700ms when it is *chosen* — a tap on a stop, and
   * every colour on screen travels to the new hue together, which is one of
   * the few moments in this app worth animating. While it is being *dragged*
   * that same sweep is 700ms of lag between the finger and the screen, so the
   * drag turns it off for the length of the drag and hands it straight back.
   */
  const tuning = (on: boolean) => {
    document.documentElement.classList.toggle('tuning', on)
  }

  return (
    <div className="space-y-8">
      {canShiftHue && (
        <div>
          <FieldLabel hint={`${hueName(hue)} · ${hue}°`}>Palette</FieldLabel>

          <DragBar
            label="Palette colour"
            value={hue}
            min={0}
            max={359}
            step={1}
            coarse={10}
            wrap
            valueText={`${hueName(hue)}, ${hue} degrees`}
            onChange={setHue}
            onDragStart={() => tuning(true)}
            onCommit={() => {
              tuning(false)
              cue('select')
            }}
            track={
              <>
                <span className="hue-band" />
                <span className="hue-band__support" />
                {HUE_PRESETS.map((preset) => (
                  <span
                    key={preset.id}
                    className="hue-band__tick"
                    style={{ '--tick-at': preset.shift / 359 } as CSSProperties}
                  />
                ))}
              </>
            }
            handle={
              <span
                className="hue-handle"
                style={{ '--h': hue } as CSSProperties}
              />
            }
          />

          <div
            role="radiogroup"
            aria-label="Named palette colours"
            className="mt-3.5 grid grid-cols-6 justify-items-center gap-1 sm:grid-cols-12"
          >
            {HUE_PRESETS.map((preset) => {
              const selected = exact?.id === preset.id
              return (
                <button
                  key={preset.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={preset.name}
                  title={preset.name}
                  onClick={() => {
                    cue('select')
                    setHue(preset.shift)
                  }}
                  className={cx(
                    'interactive pressable flex h-11 w-11 items-center justify-center rounded-full p-1.5',
                    'transition-[background-color,box-shadow] duration-200',
                    selected
                      ? 'bg-[var(--rose-soft)] shadow-[inset_0_0_0_1.5px_var(--rose)]'
                      : 'hover:bg-[var(--quiet)]',
                  )}
                >
                  {/*
                    The orb is drawn at the stop's own rotation, so this is a
                    real preview of twelve palettes rather than twelve labels.
                    `--h` is the only thing that differs between them.
                  */}
                  <span
                    aria-hidden="true"
                    className="hue-swatch"
                    style={{ '--h': preset.shift } as CSSProperties}
                  />
                  {selected && <span className="sr-only">(selected)</span>}
                </button>
              )
            })}
          </div>

          <p className="type-meta mt-3 text-ink-faint">
            Every colour in the app turns together — the words stay exactly as
            readable, because only the hue moves.
          </p>
        </div>
      )}

      <div>
        <FieldLabel
          hint={nightLight > 0 ? `${nightLightName(nightLight)} · ${nightLight}%` : 'Off'}
        >
          Night light
        </FieldLabel>

        <DragBar
          label="Night light strength"
          value={nightLight}
          min={0}
          max={100}
          step={1}
          coarse={10}
          valueText={
            nightLight > 0
              ? `${nightLightName(nightLight)}, ${nightLight} percent`
              : 'Off'
          }
          onChange={setNightLight}
          onCommit={() => cue('select')}
          track={<span className="night-band" />}
          handle={<span className="night-handle" />}
        />

        <p className="type-meta mt-3 text-ink-faint">
          Takes the blue out of the screen and leaves the warmth, the way a lamp
          does as the evening goes on. It warms the light rather than laying a
          colour over it, so every word on the page stays exactly as legible at
          a hundred as it is at nought.
        </p>
      </div>

      <div>
        <FieldLabel>Light</FieldLabel>
        <SegmentedControl
          label="Day or night colours"
          value={theme}
          onChange={(next) => {
            cue('select')
            setTheme(next)
          }}
          segments={[
            {
              value: 'day' as const,
              label: (
                <span className="flex items-center justify-center gap-2">
                  <SunIcon className="text-[1.05rem]" />
                  Day
                </span>
              ),
            },
            {
              value: 'night' as const,
              label: (
                <span className="flex items-center justify-center gap-2">
                  <MoonIcon className="text-[1.05rem]" />
                  Night
                </span>
              ),
            },
          ]}
        />
      </div>
    </div>
  )
}
