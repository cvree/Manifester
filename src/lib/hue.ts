/**
 * The hue dial.
 *
 * Manifester's palette is one carefully balanced set of lightnesses and
 * chromas — rose leading, sage supporting, gold accenting, over a warm canvas.
 * Re-colouring an app usually means throwing that balance away and hand-picking
 * a second palette that is never quite as good as the first.
 *
 * So nothing is re-picked here. A single number of degrees is added to every
 * colour's hue in OKLCH, where lightness is perceptual and independent of hue.
 * Every contrast ratio, every relationship between the three accents, and every
 * separation between the surface levels survives untouched — which is why every
 * position on this dial looks as considered as the one it shipped with, and why
 * the control can be eight taps with nothing to get wrong.
 *
 * The rotation itself is done in CSS (see `theme.css`); this module only names
 * the stops and remembers which one you chose.
 */

export interface HuePreset {
  id: string
  /** Named for the lead colour at that rotation, not for a mood. */
  name: string
  /** Degrees added to every hue in the palette. */
  shift: number
}

/**
 * Eight stops around the wheel.
 *
 * Deliberately not a continuous slider: a slider invites fiddling and offers
 * 360 answers to a question with no wrong one. Eight named colours is a choice
 * you make once, in a second, from across the room.
 */
export const HUE_PRESETS: HuePreset[] = [
  { id: 'rose', name: 'Rose', shift: 0 },
  { id: 'ember', name: 'Ember', shift: 40 },
  { id: 'amber', name: 'Amber', shift: 80 },
  { id: 'meadow', name: 'Meadow', shift: 130 },
  { id: 'lagoon', name: 'Lagoon', shift: 175 },
  { id: 'cobalt', name: 'Cobalt', shift: 220 },
  { id: 'iris', name: 'Iris', shift: 265 },
  { id: 'orchid', name: 'Orchid', shift: 310 },
]

/** The palette as designed — rose leading, nothing rotated. */
export const DEFAULT_HUE = 0

/** How long the palette takes to sweep from one hue to the next, in ms. */
export const HUE_SWEEP_MS = 700

/** Clamp anything read back from storage into a usable rotation. */
export function normaliseHue(value: unknown): number {
  const shift = Number(value)
  if (!Number.isFinite(shift)) return DEFAULT_HUE
  return ((Math.round(shift) % 360) + 360) % 360
}

/** The stop this rotation belongs to, for labelling the control. */
export function huePreset(shift: number): HuePreset {
  return HUE_PRESETS.find((preset) => preset.shift === shift) ?? HUE_PRESETS[0]
}

/**
 * Whether this browser can rotate a colour it was given.
 *
 * Relative colour syntax is the whole mechanism, and there is no reasonable
 * polyfill for it — so where it is missing the dial is simply not offered and
 * the palette stays as designed. Everything else on the page is unaffected.
 */
export function supportsHueShift(): boolean {
  if (typeof CSS === 'undefined' || !CSS.supports) return false
  return CSS.supports('color', 'oklch(from white l c calc(h + 30))')
}
