import { AMBIENT_PRESETS } from '../../lib/ambient'
import { BREATH_PRESETS, type BreathPattern } from '../../lib/breathing'
import { cx } from '../../lib/cx'
import { cue } from '../../lib/feedback'
import { HUE_PRESETS } from '../../lib/hue'
import { Button } from '../Button'
import { BreathIcon, CheckIcon, WaveIcon } from '../Icons'
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
 * picked the colour of the room, the rhythm of the breath and the sound under
 * it has *made three things*. Nothing about the session is objectively better
 * for it. Every one of these has a default that is good. But the loop is now
 * theirs in a way that a loop assembled entirely by the app is not, and that
 * difference is what somebody comes back to.
 *
 * ── Why these three ─────────────────────────────────────────────────────────
 *
 * They are the three choices you can *feel the consequence of on this screen*.
 * The palette rotates live behind the page as a swatch is pressed, the field
 * changes rhythm as a pattern is chosen, and the ambience names itself. A
 * fourth control — the timer, the visualizer style, the voice speed — would be
 * a promise about a screen nobody has seen yet, which is a form question, and
 * this is deliberately not a form.
 *
 * Everything on this step is applied immediately and none of it is a commit:
 * these are preferences, they live where every other preference lives, and
 * Settings is exactly the same set of controls for the rest of time.
 */

/**
 * The palette stops offered here.
 *
 * Six of the twelve. The dial in Settings is a continuous band with every one
 * of its 360 positions available; a first visit wants a handful of clearly
 * different rooms, not a colour picker.
 */
const HUE_CHOICES = ['rose', 'amber', 'fern', 'teal', 'indigo', 'orchid']

/**
 * The breath patterns offered here, one per mood.
 *
 * Chosen so that the four cards are four genuinely different experiences
 * rather than four numbers — settle, focus, sleep, lift. The full ten are in
 * Breathing, along with the sliders that make any pattern at all.
 */
const BREATH_CHOICES = ['calm', 'box', 'deep-rest', 'awaken']

interface AttuneStepProps {
  hue: number
  onHueChange: (hue: number) => void

  breathingEnabled: boolean
  breathPattern: BreathPattern
  onBreathChange: (pattern: BreathPattern, enabled: boolean) => void

  /** The built-in ambience id currently chosen, or `null` for silence. */
  soundId: string | null
  onSoundChange: (id: string | null) => void

  onContinue: () => void
}

export function AttuneStep({
  hue,
  onHueChange,
  breathingEnabled,
  breathPattern,
  onBreathChange,
  soundId,
  onSoundChange,
  onContinue,
}: AttuneStepProps) {
  const hues = HUE_PRESETS.filter((preset) => HUE_CHOICES.includes(preset.id))
  const patterns = BREATH_PRESETS.filter((preset) =>
    BREATH_CHOICES.includes(preset.id),
  )

  const patternMatches = (pattern: BreathPattern) =>
    breathingEnabled &&
    pattern.inhale === breathPattern.inhale &&
    pattern.holdIn === breathPattern.holdIn &&
    pattern.exhale === breathPattern.exhale &&
    pattern.holdOut === breathPattern.holdOut

  return (
    <div>
      <RevealText
        as="h1"
        className="type-title text-center text-balance"
        text="Now make it yours"
      />

      <Reveal delay={0.26}>
        <p className="type-meta mt-2 text-center text-balance">
          Every one of these changes the room as you press it. All three live in
          Settings afterwards.
        </p>
      </Reveal>

      {/* ── Colour ─────────────────────────────────────────────── */}

      <Reveal delay={0.34}>
        <section className="mt-5">
          <h2 className="type-label">Colour</h2>
          <div
            role="group"
            aria-label="Palette colour"
            className="mt-2 flex flex-wrap gap-2"
          >
            {hues.map((preset) => {
              const active = preset.shift === hue
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    cue('select')
                    onHueChange(preset.shift)
                  }}
                  aria-pressed={active}
                  className={cx(
                    'interactive pressable flex min-h-11 items-center gap-2 rounded-pill border px-3 py-2 text-[0.86rem] transition-colors duration-300',
                    active
                      ? 'border-[var(--rose)] bg-[var(--rose-soft)] text-ink'
                      : 'border-[var(--border)] bg-[var(--surface-sunken)] text-ink-muted hover:text-ink',
                  )}
                >
                  {/*
                    The swatch is painted from the palette rotated by this
                    preset's own shift, so each dot is literally the colour the
                    whole app becomes — not an approximation of it kept in step
                    by hand. See `lib/hue.ts`.
                  */}
                  <span
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0 rounded-full border border-[var(--quiet-border)]"
                    style={{
                      background: `oklch(from var(--rose-deep-base) l c calc(h + ${preset.shift}))`,
                    }}
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
              const active = patternMatches(preset.pattern)
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    cue('select')
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

            <button
              type="button"
              onClick={() => {
                cue('tap')
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
        </section>
      </Reveal>

      {/* ── Sound ──────────────────────────────────────────────── */}

      <Reveal delay={0.5}>
        <section className="mt-5">
          <h2 className="type-label flex items-center gap-1.5">
            <WaveIcon aria-hidden="true" className="text-[0.9rem]" />
            Underneath it all
          </h2>
          <div
            role="group"
            aria-label="Background sound"
            className="mt-2 flex flex-wrap gap-2"
          >
            {AMBIENT_PRESETS.map((preset) => {
              const active = soundId === preset.id
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    cue('select')
                    onSoundChange(preset.id)
                  }}
                  aria-pressed={active}
                  className={cx(
                    'interactive pressable min-h-11 rounded-pill border px-3.5 py-2 text-[0.86rem] transition-colors duration-300',
                    active
                      ? 'border-[var(--rose)] bg-[var(--rose-soft)] text-ink'
                      : 'border-[var(--border)] bg-[var(--surface-sunken)] text-ink-muted hover:text-ink',
                  )}
                >
                  {preset.name}
                </button>
              )
            })}
            <button
              type="button"
              onClick={() => {
                cue('tap')
                onSoundChange(null)
              }}
              aria-pressed={soundId == null}
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
        </section>
      </Reveal>

      <Reveal delay={0.6} distance={10}>
        <Button
          variant="primary"
          size="xl"
          block
          className="mt-6"
          onClick={() => {
            cue('tap')
            onContinue()
          }}
        >
          Continue
        </Button>
      </Reveal>
    </div>
  )
}
