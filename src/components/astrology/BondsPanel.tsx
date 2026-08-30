import { useEffect, useId, useState } from 'react'
import { useNavigate } from 'react-router'
import { bondBetween, type Bond } from '../../lib/astrology/bonds'
import { buildChart, type Chart } from '../../lib/astrology/chart'
import {
  addPerson,
  MAX_PEOPLE,
  readPeople,
  removePerson,
  type Person,
} from '../../lib/astrology/people'
import { resolveBirth } from '../../lib/astrology/profile'
import { recordEngagement } from '../../lib/engagement'
import { cue } from '../../lib/feedback'
import { useSession } from '../../state/SessionProvider'
import { Button } from '../Button'
import { Card, FieldLabel, SectionHeading } from '../Card'
import { Disclosure } from '../Disclosure'
import { HeartIcon, PlayIcon, PlusIcon, TrashIcon } from '../Icons'
import { TextField } from '../TextArea'
import { BirthDetailsForm } from './BirthDetailsForm'
import { cx } from '../../lib/cx'

/**
 * Two charts, side by side.
 *
 * ── Why the most frivolous panel is worth building properly ─────────────────
 *
 * Because comparing your chart with your sister's is the single most
 * delightful thing this feature can do, and delight is what gets an app opened
 * on the good days. It is also more useful than it looks: the honest version
 * of synastry is a description of *where two people's needs differ*, and the
 * paragraph comparing two Moons is worth more than most communication advice.
 *
 * ── The two rules on this screen ────────────────────────────────────────────
 *
 * It describes charts, never people — it will not tell anybody whether to stay
 * or go, and it never says what somebody else feels or intends, because that
 * would be a claim about a person who never agreed to be read.
 *
 * And the details of somebody else's birth are a trust rather than a
 * preference: they stay on this device, there is a cap on how many can be
 * held, and removing one is one press with no question attached.
 */

interface BondsPanelProps {
  natal: Chart
}

interface Resolved {
  person: Person
  chart: Chart
  bond: Bond
}

function Score({ label, value, caption }: { label: string; value: number; caption: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="type-label text-ink">{label}</span>
        <span className="type-numeral text-[0.95rem] text-ink-muted">{value}</span>
      </div>
      <span className="mt-1.5 block h-2 overflow-hidden rounded-pill bg-[var(--control-sunken)]">
        <span
          className="block h-full rounded-pill bg-[var(--rose)] transition-[width] duration-700 ease-[var(--ease-calm)]"
          style={{ width: `${value}%` }}
        />
      </span>
      <p className="type-meta mt-1">{caption}</p>
    </div>
  )
}

export function BondsPanel({ natal }: BondsPanelProps) {
  const navigate = useNavigate()
  const ids = useId()
  const { updateDraft, prime, start } = useSession()

  const [people, setPeople] = useState<Person[]>(() => readPeople())
  const [selected, setSelected] = useState<string | null>(null)
  const [resolved, setResolved] = useState<Resolved | null>(null)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')

  const person = people.find((entry) => entry.id === selected) ?? null

  /*
   * Their chart is built the same way the user's own is — the birthplace has
   * to be re-resolved against the bundled city list, and that pulls in the
   * time zone code, so it is asynchronous.
   */
  useEffect(() => {
    if (!person) {
      setResolved(null)
      return
    }

    let live = true
    void resolveBirth(person.birth).then((birth) => {
      if (!live) return
      const chart = buildChart(
        birth.at,
        { latitude: birth.latitude, longitude: birth.longitude },
        birth.precise,
      )
      setResolved({ person, chart, bond: bondBetween(natal, chart, person.name) })
    })

    return () => {
      live = false
    }
  }, [person, natal])

  const loopShared = (line: string) => {
    cue('start')
    prime()
    updateDraft({ text: line, title: person ? `With ${person.name}` : 'Together' })
    window.setTimeout(() => {
      start()
      recordEngagement()
      navigate('/player')
    }, 20)
  }

  return (
    <div className="space-y-6">
      <Card data-rise level="stage" className="astro-sky">
        <span aria-hidden="true" className="astro-sky__stars" />
        <div className="astro-sky__content">
          <p className="type-label flex items-center gap-1.5 text-[var(--rose-deep)]">
            <HeartIcon aria-hidden="true" className="text-[0.9rem]" />
            Two charts, side by side
          </p>
          <h2 className="type-title mt-1">Who else is in your sky?</h2>
          <p className="type-body mt-2 max-w-[54ch]">
            Add somebody&rsquo;s birthday and Manifester will lay their chart
            over yours: where the warmth is, where the friction is, and — the
            useful one — what each of you needs that the other would never think
            to offer.
          </p>
          <p className="type-meta mt-2 max-w-[54ch]">
            This describes two charts, not two people. It will not tell you
            whether a relationship is good, and it has nothing to say about what
            anybody else is thinking.
          </p>
        </div>
      </Card>

      {/* ── The people ── */}

      <div data-rise className="flex flex-wrap gap-2">
        {people.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => {
              cue('select')
              setSelected((current) => (current === entry.id ? null : entry.id))
              setAdding(false)
            }}
            className={cx(
              'interactive pressable min-h-11 rounded-pill border px-4 text-[0.95rem]',
              entry.id === selected
                ? 'border-[var(--rose)] bg-[var(--rose-soft)] text-[var(--rose-deep)]'
                : 'border-[var(--control-border)] bg-[var(--control)] text-ink',
            )}
          >
            {entry.name}
          </button>
        ))}

        {people.length < MAX_PEOPLE && (
          <Button
            size="md"
            leading={<PlusIcon className="text-[0.8rem]" />}
            onClick={() => {
              cue('tap')
              setAdding((current) => !current)
              setSelected(null)
            }}
          >
            {adding ? 'Cancel' : people.length === 0 ? 'Add someone' : 'Add another'}
          </Button>
        )}
      </div>

      {/* ── Adding ── */}

      {adding && (
        <Card data-rise title="Add someone">
          <BirthDetailsForm
            saveLabel="Compare our charts"
            disabled={name.trim().length === 0}
            lead={
              <div>
                <FieldLabel htmlFor={`${ids}-name`}>Their name</FieldLabel>
                <TextField
                  id={`${ids}-name`}
                  value={name}
                  autoComplete="off"
                  placeholder="A name you will recognise"
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
            }
            note={
              <p className="type-meta">
                Their details stay on this device exactly as yours do — never
                uploaded, attached to no account, and removable in one press.
                Only add somebody who would be happy for you to.
              </p>
            }
            onSave={(birth) => {
              const added = addPerson(name, birth)
              setPeople(readPeople())
              setSelected(added.id)
              setName('')
              setAdding(false)
            }}
          />
        </Card>
      )}

      {/* ── The reading ── */}

      {person && !resolved && (
        <p className="type-meta" role="status">
          Working out where everything was…
        </p>
      )}

      {resolved && (
        <div className="space-y-6">
          <Card data-rise level="stage">
            <p className="type-label">
              You and {resolved.person.name} · {resolved.bond.elements}
            </p>
            <h3 className="type-title mt-1 text-balance">{resolved.bond.headline}</h3>
            <p className="type-body mt-3 max-w-[58ch]">{resolved.bond.summary}</p>
          </Card>

          <Card data-rise title="Between the two charts">
            <div className="grid gap-5 sm:grid-cols-2">
              {resolved.bond.scores.map((score) => (
                <Score
                  key={score.key}
                  label={score.label}
                  value={score.value}
                  caption={score.caption}
                />
              ))}
            </div>
            <p className="type-meta mt-5">
              Bars, not verdicts. A low one is not a warning about a
              relationship — it means those two parts of your charts are not
              speaking to each other, which people manage perfectly well every
              day.
            </p>
          </Card>

          <div data-rise className="grid gap-3 md:grid-cols-2">
            <div className="astro-tint astro-tint--body p-5">
              <p className="type-label text-ink">What runs easily</p>
              <ul className="mt-2 space-y-2 text-[0.92rem] leading-relaxed text-ink-muted">
                {resolved.bond.works.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
            <div className="astro-tint astro-tint--heart p-5">
              <p className="type-label text-ink">Where you are built differently</p>
              <ul className="mt-2 space-y-2 text-[0.92rem] leading-relaxed text-ink-muted">
                {resolved.bond.watch.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          </div>

          <Card data-rise title="The two Moons">
            <p className="type-body max-w-[60ch]">{resolved.bond.moons}</p>
          </Card>

          {/*
            Folded away, because the two cards above are made of these same
            contacts. Somebody who wants the working shown can open it; nobody
            has to scroll past the summary twice to reach the next thing.
          */}
          <div data-rise>
            <Disclosure
              title="Every contact between the two charts"
              summary={`${resolved.bond.contacts.length} of them, strongest first`}
            >
            <ul className="astro-rows space-y-3">
              {resolved.bond.contacts.map((contact) => (
                <li key={contact.title} className="pt-3 first:pt-0">
                  <p className="flex items-baseline justify-between gap-3">
                    <span className="font-display text-[1.02rem] text-ink">
                      {contact.title}
                    </span>
                    <span className="type-meta shrink-0 tabular-nums">
                      {contact.orb.toFixed(1)}°
                    </span>
                  </p>
                  <p className="mt-1 text-[0.9rem] leading-relaxed text-ink-muted">
                    {contact.text}
                  </p>
                </li>
              ))}
            </ul>
            </Disclosure>
          </div>

          <Card data-rise className="border-[var(--rose)] bg-[var(--rose-soft)]">
            <p className="type-label text-[var(--rose-deep)]">A line for the two of you</p>
            <p className="font-display mt-2 text-[1.35rem] leading-snug text-ink">
              &ldquo;{resolved.bond.sharedLine}&rdquo;
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                variant="primary"
                size="md"
                leading={<PlayIcon className="text-[0.85rem]" />}
                onClick={() => loopShared(resolved.bond.sharedLine)}
              >
                Loop it
              </Button>
              <Button
                variant="ghost"
                size="md"
                leading={<TrashIcon className="text-[0.85rem]" />}
                onClick={() => {
                  cue('tap')
                  removePerson(resolved.person.id)
                  setPeople(readPeople())
                  setSelected(null)
                }}
              >
                Remove {resolved.person.name}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {people.length === 0 && !adding && (
        <div data-rise>
          <SectionHeading>Nobody yet</SectionHeading>
          <p className="type-body max-w-[54ch]">
            Up to {MAX_PEOPLE} people can live here. A birthday is enough — a
            time and a city make it sharper, and if you do not have those, the
            Sun, Mercury, Venus and Mars comparisons still hold.
          </p>
        </div>
      )}
    </div>
  )
}
