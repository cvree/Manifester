import { useId } from 'react'
import {
  BRAINWAVE_DEPTH_LIMITS,
  BRAINWAVE_DISCLOSURE,
  BRAINWAVE_LIST,
  CARRIER_HZ,
  GAMMA_BINAURAL_NOTE,
  describeMode,
  formatHz,
  getBandLabel,
  getBinauralPair,
  isBinauralSubstituted,
  resolveMode,
  type BrainwavePresetId,
  type BrainwaveSettings,
} from '../lib/brainwaveAudio'
import { cx } from '../lib/cx'
import { Button } from './Button'
import { CheckIcon, InfoIcon, PauseIcon, PlayIcon } from './Icons'
import { Slider } from './Slider'
import { Toggle } from './Toggle'

interface BrainwavePanelProps {
  settings: BrainwaveSettings
  onChange: (patch: Partial<BrainwaveSettings>) => void
  /** Omitted where auditioning does not apply, e.g. mid-session. */
  previewing?: boolean
  onTogglePreview?: () => void
}

/**
 * The Brainwave Rhythm section.
 *
 * Every option states its exact generated rate, both on screen and in its
 * accessible name, so the choice never depends on reading a colour. The copy
 * describes what the sound does and nothing more — these are frequency band
 * names, not promises.
 */
export function BrainwavePanel({
  settings,
  onChange,
  previewing = false,
  onTogglePreview,
}: BrainwavePanelProps) {
  const groupId = useId()
  const selected = settings.enabled ? settings.preset : null
  const meta = BRAINWAVE_LIST.find((item) => item.id === settings.preset)
  const mode = resolveMode(settings.preset, settings.mode)
  const substituted = isBinauralSubstituted(settings.preset, settings.mode)
  const binaural = mode === 'binaural'
  const pair = binaural ? getBinauralPair(settings.targetHz) : null

  const choose = (preset: BrainwavePresetId | null) => {
    if (preset === null) onChange({ enabled: false })
    else onChange({ enabled: true, preset })
  }

  return (
    <div className="space-y-5">
      <div role="radiogroup" aria-labelledby={groupId} className="space-y-2">
        <p id={groupId} className="type-label">
          Brainwave rhythm
        </p>

        <RhythmOption
          selected={selected === null}
          label="Off"
          accessibleName="No brainwave rhythm"
          onSelect={() => choose(null)}
        />

        {BRAINWAVE_LIST.map((item) => (
          <RhythmOption
            key={item.id}
            selected={selected === item.id}
            label={`${item.label} · ${formatHz(item.targetHz)}`}
            detail={`${item.character} · ${getBandLabel(item.id)}`}
            accessibleName={`${item.label}, exactly ${formatHz(item.targetHz)}, conventional band ${getBandLabel(item.id)}`}
            onSelect={() => choose(item.id)}
          />
        ))}
      </div>

      {settings.enabled && meta && (
        <>
          <dl className="surface-control grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 px-4 py-3.5 text-[0.875rem]">
            <dt className="text-ink-muted">Exact target</dt>
            <dd className="type-numeral text-ink">{formatHz(meta.targetHz)}</dd>

            <dt className="text-ink-muted">EEG band</dt>
            <dd className="text-ink">{getBandLabel(meta.id)}</dd>

            <dt className="text-ink-muted">Method</dt>
            <dd className="text-ink">{describeMode(mode)}</dd>

            <dt className="text-ink-muted">Carrier</dt>
            <dd className="text-ink">
              {pair
                ? `${formatHz(pair.leftHz)} left · ${formatHz(pair.rightHz)} right`
                : `${formatHz(CARRIER_HZ)}, modulated`}
            </dd>
          </dl>

          {onTogglePreview && (
            <Button
              variant="secondary"
              block
              onClick={onTogglePreview}
              leading={
                previewing ? (
                  <PauseIcon className="text-[0.9rem]" />
                ) : (
                  <PlayIcon className="text-[0.9rem]" />
                )
              }
            >
              {previewing
                ? `Stop preview of ${meta.label}`
                : `Preview ${meta.label} at ${formatHz(meta.targetHz)}`}
            </Button>
          )}

          <Slider
            label="Rhythm volume"
            min={0}
            max={1}
            step={0.05}
            value={settings.volume}
            display={`${Math.round(settings.volume * 100)}%`}
            hint="Sits under your master sound volume. Start low."
            onChange={(volume) => onChange({ volume })}
          />

          <Slider
            label="Rhythm intensity"
            min={BRAINWAVE_DEPTH_LIMITS.min}
            max={BRAINWAVE_DEPTH_LIMITS.max}
            step={0.05}
            value={settings.depth}
            display={`${Math.round(settings.depth * 100)}%`}
            disabled={binaural}
            hint={
              binaural
                ? 'Intensity applies to rhythmic modulation. Binaural mode uses two steady tones instead.'
                : 'How deeply the tone rises and falls each cycle. The rate never changes.'
            }
            onChange={(depth) => onChange({ depth })}
          />

          <div className="space-y-3">
            <Toggle
              label="Headphone binaural mode"
              description={
                <>
                  Headphones required — each ear has to receive a different
                  frequency, so this does nothing through a speaker. A binaural
                  beat is the rhythm you perceive when two tones are delivered
                  separately to the ears, matching their difference. Evidence
                  that this reliably changes brain activity remains inconsistent.
                </>
              }
              checked={settings.mode === 'binaural'}
              onChange={(on) =>
                onChange({ mode: on ? 'binaural' : 'amplitude-modulation' })
              }
            />

            {settings.mode === 'binaural' && (
              <p
                role="status"
                className="flex items-start gap-2.5 rounded-2xl border border-[var(--gold)] bg-[var(--gold-soft)] px-4 py-3 text-[0.85rem] leading-relaxed text-ink"
              >
                <InfoIcon
                  aria-hidden="true"
                  className="mt-0.5 shrink-0 text-[0.95rem] text-[var(--gold)]"
                />
                <span>
                  {substituted
                    ? GAMMA_BINAURAL_NOTE
                    : 'Headphones required for this mode.'}
                </span>
              </p>
            )}
          </div>
        </>
      )}

      <p className="type-meta leading-relaxed">{BRAINWAVE_DISCLOSURE}</p>
      <p className="type-meta leading-relaxed">
        Please pick a level that feels comfortable, and turn it down rather than
        up if you are unsure.
      </p>
    </div>
  )
}

interface RhythmOptionProps {
  selected: boolean
  label: string
  detail?: string
  accessibleName: string
  onSelect: () => void
}

/**
 * One choice in the list. Selection is carried by the word "Selected" and by
 * `aria-checked`, not by the border colour alone.
 */
function RhythmOption({
  selected,
  label,
  detail,
  accessibleName,
  onSelect,
}: RhythmOptionProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={`${accessibleName}${selected ? ' — selected' : ''}`}
      onClick={onSelect}
      className={cx(
        'interactive flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left',
        'transition-[background-color,border-color] duration-200',
        selected
          ? 'border-[var(--rose)] bg-[var(--rose-soft)]'
          : 'border-[var(--border)] bg-[var(--surface-sunken)] hover:border-[var(--border-strong)]',
      )}
    >
      <span
        aria-hidden="true"
        className={cx(
          'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 text-[0.55rem]',
          selected
            ? 'border-[var(--rose-deep)] bg-[var(--rose-deep)] text-[var(--bg-0)]'
            : 'border-[var(--border-strong)]',
        )}
      >
        {selected && <CheckIcon />}
      </span>
      <span className="min-w-0 grow">
        <span className="block text-[0.98rem] font-medium text-ink">{label}</span>
        {detail && (
          <span className="mt-0.5 block text-[0.82rem] leading-snug text-ink-muted">
            {detail}
          </span>
        )}
      </span>
      {selected && (
        <span className="shrink-0 text-[0.78rem] font-medium tracking-[0.06em] text-[var(--rose-deep)] uppercase">
          Selected
        </span>
      )}
    </button>
  )
}
