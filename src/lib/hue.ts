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
 * the control can be a band you drag with nothing on it to get wrong.
 *
 * The rotation itself is done in CSS (see `theme.css`); this module only names
 * the stops and remembers which one you chose.
 *
 * ── Night light ──
 *
 * The second half of this file is the other kind of colour change: not which
 * hue the palette is, but how much blue is left in the light coming off the
 * screen. It is a different mechanism for a different reason — the palette
 * dial is taste, and this is a screen you are looking at last thing at night.
 */

export interface HuePreset {
  id: string
  /** Named for the lead colour at that rotation, not for a mood. */
  name: string
  /** Degrees added to every hue in the palette. */
  shift: number
}

/**
 * Twelve named stops around the wheel.
 *
 * These are no longer the whole of the control — the dial is a continuous
 * band now, and every one of its 360 positions is as considered as the one
 * the app shipped with, because the rotation preserves the palette rather
 * than replacing it. What the stops are for is the other half of the job: a
 * name for wherever the band has landed, and a single tap for the colours
 * most people are actually reaching for.
 *
 * Spaced by *what they look like* rather than evenly. OKLCH hue is not
 * perceptually uniform in its spacing — there is a wide plateau of greens and
 * a narrow, fast-moving stretch through the blues — so an even twelve would
 * have named four greens and skipped teal entirely.
 */
export const HUE_PRESETS: HuePreset[] = [
  { id: 'rose', name: 'Rose', shift: 0 },
  { id: 'ember', name: 'Ember', shift: 40 },
  { id: 'amber', name: 'Amber', shift: 80 },
  { id: 'meadow', name: 'Meadow', shift: 130 },
  { id: 'fern', name: 'Fern', shift: 152 },
  { id: 'lagoon', name: 'Lagoon', shift: 175 },
  { id: 'teal', name: 'Teal', shift: 197 },
  { id: 'cobalt', name: 'Cobalt', shift: 220 },
  { id: 'indigo', name: 'Indigo', shift: 242 },
  { id: 'iris', name: 'Iris', shift: 265 },
  { id: 'orchid', name: 'Orchid', shift: 310 },
  { id: 'fuchsia', name: 'Fuchsia', shift: 337 },
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

/** The stop this rotation is exactly on, if it is on one. */
export function huePreset(shift: number): HuePreset | null {
  return HUE_PRESETS.find((preset) => preset.shift === shift) ?? null
}

/**
 * The shortest distance between two hues, in degrees. 350 and 10 are twenty
 * degrees apart, not three hundred and forty — the wheel has no ends, and a
 * naming function that forgets that calls every deep pink "Rose".
 */
export function hueDistance(a: number, b: number): number {
  const gap = Math.abs(((a - b) % 360) + 360) % 360
  return Math.min(gap, 360 - gap)
}

/**
 * What to call a rotation that is not on a stop.
 *
 * The nearest named colour, which for twelve stops is never more than about
 * twenty degrees away — close enough that the name is a true description of
 * what is on screen rather than a label the control is stuck with.
 */
export function hueName(shift: number): string {
  let closest = HUE_PRESETS[0]
  let best = Number.POSITIVE_INFINITY
  for (const preset of HUE_PRESETS) {
    const distance = hueDistance(preset.shift, shift)
    if (distance < best) {
      best = distance
      closest = preset
    }
  }
  return closest.name
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

/* ── Night light ────────────────────────────────────────────── */

/**
 * How much blue is taken out of the screen, 0–100.
 *
 * The mechanism is the one every night-shift feature uses and the only one
 * that is honest: a warm tint multiplied over the finished page. Multiplying
 * can only ever take light away, so red is left untouched and green and blue
 * are pulled down — which is a screen getting warmer, not a screen getting an
 * orange sheet laid over it. An overlay drawn with plain alpha would wash the
 * blacks out to brown and lift the whole page's contrast, which is exactly the
 * thing you would be turning this on to avoid.
 *
 * At 100 the tint is `rgb(255 181 107)`: green to about seven tenths and blue
 * to about four, which lands in the neighbourhood of a warm 2700K bulb. Warm
 * enough to feel like lamplight, not so warm that the rose in the palette
 * stops being rose.
 *
 * Two things follow from multiplying rather than covering, and both are the
 * point: the type keeps every bit of its contrast, because both the ink and
 * the paper are tinted by the same factor; and at 0 the tint is pure white,
 * which is arithmetically a no-op — so "off" is genuinely off rather than a
 * layer that is merely invisible.
 */
export const DEFAULT_NIGHT_LIGHT = 0

/** How far green and blue can be pulled down, out of 255, at full strength. */
export const NIGHT_LIGHT_FALLOFF = { green: 74, blue: 148 } as const

/** Clamp anything read back from storage into 0–100. */
export function normaliseNightLight(value: unknown): number {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return DEFAULT_NIGHT_LIGHT
  return Math.min(100, Math.max(0, Math.round(amount)))
}

/**
 * What the warmth is called, so the control can say something more useful
 * than a number. The bands are where the change becomes describable, not
 * even quarters.
 */
export function nightLightName(amount: number): string {
  if (amount <= 0) return 'Off'
  if (amount < 20) return 'Barely there'
  if (amount < 45) return 'Soft'
  if (amount < 70) return 'Warm'
  if (amount < 90) return 'Amber'
  return 'Candlelight'
}

/**
 * The multiply factor for one channel at this strength, 0–1.
 *
 * Shared by the stylesheet's tint and by the browser chrome's `theme-color`,
 * so the status bar warms with the page rather than staying stubbornly blue
 * above a page that no longer is.
 */
export function nightLightFactor(
  amount: number,
  channel: 'red' | 'green' | 'blue',
): number {
  if (channel === 'red') return 1
  const strength = normaliseNightLight(amount) / 100
  return (255 - NIGHT_LIGHT_FALLOFF[channel] * strength) / 255
}
