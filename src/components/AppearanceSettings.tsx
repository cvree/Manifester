import { useState, type CSSProperties } from 'react'
import { cx } from '../lib/cx'
import { cue } from '../lib/feedback'
import { HUE_PRESETS, huePreset, supportsHueShift } from '../lib/hue'
import { useTheme } from '../state/ThemeProvider'
import { FieldLabel } from './Card'
import { MoonIcon, SunIcon } from './Icons'
import { SegmentedControl } from './SegmentedControl'

/**
 * The colour of the app, in two controls and no explanation.
 *
 * Both of these already existed as decisions — one behind an icon in the
 * header, one not at all. Putting them together on the page people open to
 * ask "what can this thing do" is the point: appearance is the first thing
 * anyone wants to change and the last thing most apps let them.
 */
export function AppearanceSettings() {
  const { theme, setTheme, hue, setHue } = useTheme()

  /*
   * Read once, on mount, rather than at module load: this is a browser
   * capability question, and asking it during render keeps the component
   * honest under tests that stub `CSS.supports`.
   */
  const [canShiftHue] = useState(supportsHueShift)
  const current = huePreset(hue)

  return (
    <div className="space-y-7">
      {canShiftHue && (
        <div>
          <FieldLabel hint={current.name}>Palette</FieldLabel>
          <div
            role="radiogroup"
            aria-label="Palette colour"
            className="grid grid-cols-4 gap-2 sm:grid-cols-8"
          >
            {HUE_PRESETS.map((preset) => {
              const selected = preset.shift === hue
              return (
                <button
                  key={preset.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => {
                    cue('select')
                    setHue(preset.shift)
                  }}
                  className={cx(
                    'interactive pressable group flex flex-col items-center gap-2 rounded-[1.15rem] border p-2',
                    selected
                      ? 'border-[var(--rose)] bg-[var(--rose-soft)]'
                      : 'border-transparent hover:bg-[var(--quiet)]',
                  )}
                >
                  {/*
                    The orb is drawn at the preset's own rotation, so the row
                    is a real preview of eight palettes rather than eight
                    labels. `--h` is the only thing that differs between them.
                  */}
                  <span
                    aria-hidden="true"
                    className="hue-swatch"
                    style={{ '--h': preset.shift } as CSSProperties}
                  />
                  <span
                    className={cx(
                      'text-[0.78rem] leading-none',
                      selected ? 'text-[var(--rose-deep)]' : 'text-ink-muted',
                    )}
                  >
                    {preset.name}
                  </span>
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
