import { useCallback, useEffect, useRef, useState } from 'react'
import { AMBIENT_PRESETS } from '../../lib/ambient'
import { AudioBus } from '../../lib/audioBus'
import {
  BREATH_PRESETS,
  BREATH_STYLES,
  breathsPerMinute,
  findPreset,
  formatSeconds,
  isPatternValid,
  PHASE_LIMITS,
  type BreathPattern,
  type BreathStyleId,
} from '../../lib/breathing'
import { cx } from '../../lib/cx'
import { cue } from '../../lib/feedback'
import { HUE_PRESETS, swatchFor } from '../../lib/hue'
import { MusicEngine } from '../../lib/audio'
import { Button } from '../Button'
import { BreathStyleThumbnail } from '../BreathingVisualizer'
import { BreathIcon, CheckIcon, PaletteIcon, WaveIcon } from '../Icons'
import { Slider } from '../Slider'
import { Reveal, RevealText } from './Reveal'

/**
 * Making the room theirs, before they sit down in it.
 *
 * ── Why this step exists ────────────────────────────────────────────────────
 *
 * Everything here was already in the app, three taps deep in Settings, and
 * almost nobody found it. That is not a discovery problem to be solved with a
 * better menu — it is a *timing* problem. The one moment somebody is willing
 * to spend fifteen seconds on how an app looks and feels is the moment they
 * are deciding whether it is theirs, and that moment is now, before the first
 * session, not three weeks later when they have already formed a habit of not
 * looking.
 *
 * And there is a second thing, which is the real reason: a person who has
 * picked the colour of the room, the rhythm and the shape of the breath and
 * the sound under it has *made four things*. Nothing about the session is
 * objectively better for it. Every one of these has a default that is good.
 * But the loop is now theirs in a way that a loop assembled entirely by the
 * app is not, and that difference is what somebody comes back to.
 *
 * ── Everything here answers back ────────────────────────────────────────────
 *
 * A choice that changes nothing you can perceive is a form field. So the
 * palette rotates the whole page under your finger, the breath cards change
 * the rhythm of the light behind them, the visual is drawn as itself rather
 * than named, and — the one that was missing and mattered most — **pressing a
 * sound plays it**. Choosing what you will listen to for ten minutes from a
 * row of silent word-buttons was asking somebody to guess.
 */

interface AttuneStepProps {
  hue: number
  chroma: number
  onPaletteChange: (palette: { hue: number; chroma: number }) => void

  breathingEnabled: boolean
  breathPattern: BreathPattern
  onBreathChange: (pattern: BreathPattern, enabled: boolean) => void

  breathStyle: BreathStyleId
  onBreathStyleChange: (style: BreathStyleId) => void

  /** The built-in ambience id currently chosen, or `null` for silence. */
  soundId: string | null
  onSoundChange: (id: string | null) => void

  onContinue: () => void
}

/**
 * The palettes offered here.
 *
 * Eight of the fourteen, chosen to span the *saturation* axis as much as the
 * wheel — Slate and Moss are hushed, Neon and Magenta are not — because a row
 * of eight equally-coloured pastels is the thing this control was accused of
 * being, and rightly.
 */
const HUE_CHOICES = [
  'rose',
  'ember',
  'marigold',
  'moss',
  'jade',
  'neon',
  'iris',
  'magenta',
  'slate',
]

/** One per mood, plus the escape hatch. See `BREATH_CHOICES`. */
const BREATH_CHOICES = ['calm', 'box', 'deep-rest', 'awaken']

const PHASES: { key: keyof BreathPattern; label: string }[] = [
  { key: 'inhale', label: 'Breathe in' },
  { key: 'holdIn', label: 'Hold' },
  { key: 'exhale', label: 'Breathe out' },
  { key: 'holdOut', label: 'Rest' },
]

export function AttuneStep({
  hue,
  chroma,
  onPaletteChange,
  breathingEnabled,
  breathPattern,
  onBreathChange,
  breathStyle,
  onBreathStyleChange,
  soundId,
  onSoundChange,
  onContinue,
}: AttuneStepProps) {
  const hues = HUE_PRESETS.filter((preset) => HUE_CHOICES.includes(preset.id))
  const patterns = BREATH_PRESETS.filter((preset) =>
    BREATH_CHOICES.includes(preset.id),
  )

  /*
   * Custom is a mode rather than a preset, so it stays open once opened even
   * while the sliders happen to be sitting on a named pattern's numbers.
   */
  const [custom, setCustom] = useState(
    () => breathingEnabled && findPreset(breathPattern) == null,
  )

  const matches = (pattern: BreathPattern) =>
    breathingEnabled &&
    !custom &&
    pattern.inhale === breathPattern.inhale &&
    pattern.holdIn === breathPattern.holdIn &&
    pattern.exhale === breathPattern.exhale &&
    pattern.holdOut === breathPattern.holdOut

  /* ── Hearing the ambience ── */

  /*
   * Its own bus and its own engine, exactly as the Sounds tab does it, so an
   * audition here can never disturb a session running behind this screen —
   * and so leaving the step takes the sound with it.
   */
  const busRef = useRef<AudioBus | null>(null)
  const engineRef = useRef<MusicEngine | null>(null)
  const [playing, setPlaying] = useState<string | null>(null)

  if (!busRef.current) busRef.current = new AudioBus()
  if (!engineRef.current) engineRef.current = new MusicEngine(busRef.current)

  useEffect(() => {
    const engine = engineRef.current
    const bus = busRef.current
    return () => {
      engine?.dispose()
      bus?.close()
    }
  }, [])

  const audition = useCallback(async (id: string | null) => {
    const engine = engineRef.current
    if (!engine) return

    if (id == null) {
      engine.stop(320)
      setPlaying(null)
      return
    }

    // Inside the gesture: Safari will not open the audio a beat later.
    engine.unlock()
    engine.setVolume(0.5)
    setPlaying(id)
    await engine.play(
      [{ id, name: id, kind: 'builtin', presetId: id }],
      'one',
    )
  }, [])

  const chooseSound = (id: string | null) => {
    cue('select')
    onSoundChange(id)
    void audition(id)
  }

  const valid = isPatternValid(breathPattern)

  return (
    <div>
      <RevealText
        as="h1"
        className="type-title text-center text-balance"
        text="Now make it yours"
      />

      <Reveal delay={0.26}>
        <p className="type-meta mt-2 text-center text-balance">
          Every one of these changes the room as you press it. All of them live
          in Settings afterwards.
        </p>
      </Reveal>

      {/* ── Colour ─────────────────────────────────────────────── */}

      <Reveal delay={0.34}>
        <section className="mt-5">
          <h2 className="type-label flex items-center gap-1.5">
            <PaletteIcon aria-hidden="true" className="text-[0.9rem]" />
            Colour
          </h2>
          <div
            role="radiogroup"
            aria-label="Palette colour"
            className="mt-2 flex flex-wrap gap-2"
          >
            {hues.map((preset) => {
              const active =
                preset.shift === hue && Math.abs(preset.chroma - chroma) < 0.005
              return (
                <button
                  key={preset.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => {
                    cue('select')
                    onPaletteChange({ hue: preset.shift, chroma: preset.chroma })
                  }}
                  className={cx(
                    'interactive pressable flex min-h-11 items-center gap-2 rounded-pill border px-3 py-2 text-[0.86rem] transition-colors duration-300',
                    active
                      ? 'border-[var(--rose)] bg-[var(--rose-soft)] text-ink'
                      : 'border-[var(--border)] bg-[var(--surface-sunken)] text-ink-muted hover:text-ink',
                  )}
                >
                  {/*
                    Painted from the palette's own base colour at this stop's
                    hue *and* saturation, so the dot is literally what the app
                    becomes — including how much colour is in it, which is the
                    half these swatches used to leave out.
                  */}
                  <span
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0 rounded-full border border-[var(--quiet-border)]"
                    style={{ background: swatchFor(preset) }}
                  />
                  {preset.name}
                </button>
              )
            })}
          </div>
        </section>
      </Reveal>

      {/* ── Breath ─────────────────────────────────────────────── */}

      <Reveal delay={0.42}>
        <section className="mt-5">
          <h2 className="type-label flex items-center gap-1.5">
            <BreathIcon aria-hidden="true" className="text-[0.9rem]" />
            Breathing
          </h2>
          <div
            role="group"
            aria-label="Breathing pattern"
            className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3"
          >
            {patterns.map((preset) => {
              const active = matches(preset.pattern)
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    cue('select')
                    setCustom(false)
                    onBreathChange(preset.pattern, true)
                  }}
                  aria-pressed={active}
                  className={cx(
                    'interactive pressable rounded-[1.05rem] border px-3 py-2.5 text-left transition-colors duration-300',
                    active
                      ? 'border-[var(--rose)] bg-[var(--rose-soft)]'
                      : 'border-[var(--border)] bg-[var(--surface-sunken)] hover:border-[var(--border-strong)]',
                  )}
                >
                  <span className="flex items-center gap-1.5">
                    <span className="font-display text-[1rem] text-ink">
                      {preset.name}
                    </span>
                    {active && (
                      <CheckIcon
                        aria-hidden="true"
                        className="text-[0.75rem] text-[var(--rose-deep)]"
                      />
                    )}
                  </span>
                  <span className="mt-0.5 block text-[0.76rem] leading-snug text-ink-faint">
                    {preset.description}
                  </span>
                </button>
              )
            })}

            {/*
              Custom, because four presets is a menu and a breath is personal.
              Somebody who counts four in and seven out should not have to
              accept the nearest thing on offer, and the sliders behind this
              are the same ones Settings has always had.
            */}
            <button
              type="button"
              onClick={() => {
                cue('tap')
                setCustom(true)
                onBreathChange(breathPattern, true)
              }}
              aria-pressed={custom && breathingEnabled}
              className={cx(
                'interactive pressable rounded-[1.05rem] border px-3 py-2.5 text-left transition-colors duration-300',
                custom && breathingEnabled
                  ? 'border-[var(--rose)] bg-[var(--rose-soft)]'
                  : 'border-[var(--border)] bg-[var(--surface-sunken)] hover:border-[var(--border-strong)]',
              )}
            >
              <span className="font-display text-[1rem] text-ink">Custom</span>
              <span className="mt-0.5 block text-[0.76rem] leading-snug text-ink-faint">
                Set the counts yourself.
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                cue('tap')
                setCustom(false)
                onBreathChange(breathPattern, false)
              }}
              aria-pressed={!breathingEnabled}
              className={cx(
                'interactive pressable rounded-[1.05rem] border px-3 py-2.5 text-left transition-colors duration-300',
                !breathingEnabled
                  ? 'border-[var(--rose)] bg-[var(--rose-soft)]'
                  : 'border-dashed border-[var(--border-strong)] text-ink-muted hover:text-ink',
              )}
            >
              <span className="font-display text-[1rem] text-ink">No guide</span>
              <span className="mt-0.5 block text-[0.76rem] leading-snug text-ink-faint">
                Just the words and the sound.
              </span>
            </button>
          </div>

          {custom && breathingEnabled && (
            <div className="mt-2.5 rounded-[1.05rem] border border-[var(--border)] bg-[var(--surface-sunken)] p-4">
              {PHASES.map(({ key, label }) => (
                <Slider
                  key={key}
                  label={label}
                  value={breathPattern[key]}
                  min={PHASE_LIMITS.min}
                  max={PHASE_LIMITS.max}
                  step={PHASE_LIMITS.step}
                  hint={formatSeconds(breathPattern[key])}
                  onChange={(value) =>
                    onBreathChange({ ...breathPattern, [key]: value }, true)
                  }
                />
              ))}
              <p className="type-meta mt-1" aria-live="polite">
                {valid
                  ? `${breathsPerMinute(breathPattern).toFixed(1)} breaths a minute. The light behind this page is already following it.`
                  : 'A breath needs some in and some out — nudge one of these above zero.'}
              </p>
            </div>
          )}
        </section>
      </Reveal>

      {/* ── The shape of the guide ─────────────────────────────── */}

      {breathingEnabled && (
        <Reveal delay={0.48}>
          <section className="mt-5">
            <h2 className="type-label">And what it looks like</h2>
            <div
              role="radiogroup"
              aria-label="Breathing guide shape"
              className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6"
            >
              {BREATH_STYLES.filter(
                (style) => style.id !== 'cathedral' && style.id !== 'moonpool',
              ).map((style) => {
                const active = breathStyle === style.id
                return (
                  <button
                    key={style.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    title={style.description}
                    onClick={() => {
                      cue('select')
                      onBreathStyleChange(style.id)
                    }}
                    className={cx(
                      'interactive pressable flex flex-col items-center gap-1.5 rounded-[1.05rem] border px-2 py-3 transition-colors duration-300',
                      active
                        ? 'border-[var(--rose)] bg-[var(--rose-soft)]'
                        : 'border-[var(--border)] bg-[var(--surface-sunken)] hover:border-[var(--border-strong)]',
                    )}
                  >
                    {/*
                      Drawn rather than named. "Ripple" and "Constellation" are
                      words; the thumbnails are the shapes, held at two thirds
                      of an in-breath, and choosing between them by eye takes
                      about a second.
                    */}
                    <BreathStyleThumbnail
                      style={style.id}
                      className="pointer-events-none"
                    />
                    <span className="text-[0.78rem] leading-none text-ink">
                      {style.name}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>
        </Reveal>
      )}

      {/* ── Sound ──────────────────────────────────────────────── */}

      <Reveal delay={0.54}>
        <section className="mt-5">
          <h2 className="type-label flex items-center gap-1.5">
            <WaveIcon aria-hidden="true" className="text-[0.9rem]" />
            Underneath it all
          </h2>
          <div
            role="radiogroup"
            aria-label="Background sound"
            className="mt-2 flex flex-wrap gap-2"
          >
            {AMBIENT_PRESETS.map((preset) => {
              const active = soundId === preset.id
              return (
                <button
                  key={preset.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => chooseSound(preset.id)}
                  className={cx(
                    'interactive pressable relative min-h-11 rounded-pill border px-3.5 py-2 text-[0.86rem] transition-colors duration-300',
                    active
                      ? 'border-[var(--rose)] bg-[var(--rose-soft)] text-ink'
                      : 'border-[var(--border)] bg-[var(--surface-sunken)] text-ink-muted hover:text-ink',
                  )}
                >
                  {preset.name}
                  {playing === preset.id && (
                    <span
                      aria-hidden="true"
                      className="ml-1.5 inline-block align-middle text-[var(--rose-deep)]"
                    >
                      <WaveIcon className="text-[0.8rem]" />
                    </span>
                  )}
                </button>
              )
            })}
            <button
              type="button"
              role="radio"
              aria-checked={soundId == null}
              onClick={() => chooseSound(null)}
              className={cx(
                'interactive pressable min-h-11 rounded-pill border px-3.5 py-2 text-[0.86rem] transition-colors duration-300',
                soundId == null
                  ? 'border-[var(--rose)] bg-[var(--rose-soft)] text-ink'
                  : 'border-dashed border-[var(--border-strong)] text-ink-muted hover:text-ink',
              )}
            >
              Silence
            </button>
          </div>
          <p className="type-meta mt-2">
            {playing
              ? 'Playing. Tap another to compare them.'
              : 'Tap one to hear it.'}
          </p>
        </section>
      </Reveal>

      <Reveal delay={0.62} distance={10}>
        <Button
          variant="primary"
          size="xl"
          block
          className="mt-6"
          onClick={() => {
            cue('tap')
            // Nothing may still be playing over the next screen.
            void audition(null)
            onContinue()
          }}
        >
          Continue
        </Button>
      </Reveal>
    </div>
  )
}
