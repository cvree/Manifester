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
  /** Named for what it looks like, not for a mood. */
  name: string
  /** Degrees added to every hue in the palette. */
  shift: number
  /**
   * Multiplied into every chroma. 1 is the palette as shipped.
   *
   * This is the axis that was missing, and its absence was the whole reason
   * the colour choices felt like one colour. See `--chroma-scale`.
   */
  chroma: number
}

/**
 * Fourteen palettes, spread across *both* axes.
 *
 * The old list was twelve hue rotations at a single chroma, which is to say
 * twelve versions of the same amount of colour. They were tastefully
 * different and they were not *interestingly* different — the honest
 * description of that control was "which pastel", and nobody picks a pastel
 * twice.
 *
 * These move through saturation as deliberately as they move through hue.
 * Slate is almost monochrome and reads as a graphite instrument; Neon is over
 * three times the shipped chroma and reads as something lit from inside.
 * Between them there is real range, and every one of them is still the same
 * palette underneath — the same lightness relationships, the same spacing
 * between the three accents, the same contrast on every piece of text.
 *
 * Ordered so that scanning the row is a journey rather than a wheel: the
 * muted ones bookend, the vivid ones sit in the middle where they are seen.
 */
export const HUE_PRESETS: HuePreset[] = [
  { id: 'rose', name: 'Rose', shift: 0, chroma: 1 },
  { id: 'clay', name: 'Clay', shift: 28, chroma: 0.72 },
  { id: 'ember', name: 'Ember', shift: 40, chroma: 1.7 },
  { id: 'marigold', name: 'Marigold', shift: 78, chroma: 1.75 },
  { id: 'moss', name: 'Moss', shift: 138, chroma: 0.78 },
  { id: 'jade', name: 'Jade', shift: 158, chroma: 1.65 },
  { id: 'lagoon', name: 'Lagoon', shift: 186, chroma: 1.4 },
  { id: 'neon', name: 'Neon', shift: 202, chroma: 2.4 },
  { id: 'cobalt', name: 'Cobalt', shift: 238, chroma: 1.8 },
  { id: 'slate', name: 'Slate', shift: 252, chroma: 0.22 },
  { id: 'iris', name: 'Iris', shift: 272, chroma: 1.5 },
  { id: 'ultraviolet', name: 'Ultraviolet', shift: 292, chroma: 2.2 },
  { id: 'orchid', name: 'Orchid', shift: 316, chroma: 1.15 },
  { id: 'magenta', name: 'Magenta', shift: 340, chroma: 2.1 },
]

/** The palette as designed — rose leading, nothing rotated. */
export const DEFAULT_HUE = 0

/** The palette at its designed saturation. */
export const DEFAULT_CHROMA = 1

/**
 * How far the saturation dial may travel.
 *
 * The floor is not zero: a chroma of nothing is grey, and grey is a different
 * product rather than a quieter version of this one — the canvas would stop
 * being warm and the three accents would stop being distinguishable from each
 * other. The ceiling is where the accents begin to clip out of sRGB on a
 * normal display, which shows up as a colour that stops getting more vivid and
 * starts getting lighter.
 */
export const CHROMA_RANGE = { min: 0.15, max: 2.6 } as const

/** Clamp anything read back from storage into a usable saturation. */
export function normaliseChroma(value: unknown): number {
  const scale = Number(value)
  if (!Number.isFinite(scale)) return DEFAULT_CHROMA
  return Math.min(
    CHROMA_RANGE.max,
    Math.max(CHROMA_RANGE.min, Math.round(scale * 100) / 100),
  )
}

/** What to call a saturation, so the control can say something. */
export function chromaName(scale: number): string {
  if (scale < 0.4) return 'Hushed'
  if (scale < 0.85) return 'Muted'
  if (scale < 1.25) return 'As designed'
  if (scale < 1.8) return 'Rich'
  if (scale < 2.3) return 'Vivid'
  return 'Electric'
}

/** How long the palette takes to sweep from one hue to the next, in ms. */
export const HUE_SWEEP_MS = 700

/** Clamp anything read back from storage into a usable rotation. */
export function normaliseHue(value: unknown): number {
  const shift = Number(value)
  if (!Number.isFinite(shift)) return DEFAULT_HUE
  return ((Math.round(shift) % 360) + 360) % 360
}

/** The stop this palette is exactly on, if it is on one. */
export function huePreset(shift: number, chroma = DEFAULT_CHROMA): HuePreset | null {
  return (
    HUE_PRESETS.find(
      (preset) =>
        preset.shift === shift && Math.abs(preset.chroma - chroma) < 0.005,
    ) ?? null
  )
}

/**
 * The colour a swatch should be painted, as a CSS value.
 *
 * Derived from the same base literal and the same arithmetic the whole app
 * uses, so a swatch is *the* colour rather than a hand-picked approximation of
 * it that drifts the first time the palette is touched.
 */
export function swatchFor(preset: HuePreset): string {
  return `oklch(from var(--rose-deep-base) l calc(c * ${preset.chroma}) calc(h + ${preset.shift}))`
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
