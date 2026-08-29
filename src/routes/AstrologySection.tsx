import { Suspense, lazy, useState } from 'react'
import { BirthDetailsForm } from '../components/astrology/BirthDetailsForm'
import { TodayPanel } from '../components/astrology/TodayPanel'
import { Button } from '../components/Button'
import { Card, SectionHeading } from '../components/Card'
import { Disclosure } from '../components/Disclosure'
import { SegmentedControl } from '../components/SegmentedControl'
import {
  declineAstrology,
  forgetAstrology,
  writeAstrology,
} from '../lib/astrology/profile'
import { useAstrology } from '../lib/astrology/useAstrology'
import { forgetEveryone } from '../lib/astrology/people'
import { cue } from '../lib/feedback'

/**
 * Astrology, in the library, after the sounds.
 *
 * ── Why it lives here and not on the front page ─────────────────────────────
 *
 * Because Manifester is not an astrology app and must not start behaving like
 * one. The Create screen is for writing a line, the Player is for listening to
 * it, and putting a horoscope on either would be a different product wearing
 * this one's clothes. The library is where the app keeps the things that are
 * *yours* — your loops, your sounds — and a birth chart is exactly that.
 *
 * ── Why anybody would come back for it ──────────────────────────────────────
 *
 * A daily practice needs a reason to be opened on the days you do not feel
 * like practising, and "there is something new here that is about me" is the
 * oldest working answer there is. Every one of the five panels below ends in
 * something this app can do — a line to loop, a breath to follow, a session
 * with a length — so a visit that started as curiosity finishes as a practice.
 *
 * ── Why five panels rather than one long page ───────────────────────────────
 *
 * Because they are read at completely different rates. **Today** is opened
 * every morning and has to load fast and read in a minute. **Chart** is read
 * once, slowly, in the first week. **Cycles** is checked when something feels
 * like it is taking a long time. **Care** is where somebody goes on a bad
 * evening. **Bonds** is opened for fun, usually with somebody else looking
 * over a shoulder. One page containing all five would serve none of them, and
 * the two heavy ones — cycles and bonds — would be computed for everybody who
 * only ever wanted the horoscope.
 */

/*
 * Today is bundled with the section; the other four arrive when they are
 * opened.
 *
 * Almost every visit here is somebody checking the horoscope, and the four
 * panels behind it — a portrait, twenty years of Saturn, a care plan and
 * synastry — are most of the weight. Splitting them keeps the morning visit as
 * light as it was before any of them existed, and the wait when somebody does
 * open one is a few hundred milliseconds on a cold cache and nothing on a warm
 * one.
 */
const ChartPanel = lazy(() =>
  import('../components/astrology/ChartPanel').then((module) => ({
    default: module.ChartPanel,
  })),
)

const CyclesPanel = lazy(() =>
  import('../components/astrology/CyclesPanel').then((module) => ({
    default: module.CyclesPanel,
  })),
)

const CarePanel = lazy(() =>
  import('../components/astrology/CarePanel').then((module) => ({
    default: module.CarePanel,
  })),
)

const BondsPanel = lazy(() =>
  import('../components/astrology/BondsPanel').then((module) => ({
    default: module.BondsPanel,
  })),
)

type Panel = 'today' | 'chart' | 'cycles' | 'care' | 'bonds'

export function AstrologySection() {
  const sky = useAstrology()
  const [panel, setPanel] = useState<Panel>('today')
  const [editing, setEditing] = useState(false)

  /* ── Nobody has given their details yet ── */

  if (sky.state.status !== 'ready' || editing) {
    return (
      <div data-rise className="space-y-4">
        <SectionHeading>Astrology</SectionHeading>

        <Card level="stage" className="astro-sky">
          <span aria-hidden="true" className="astro-sky__stars" />
          <span aria-hidden="true" className="astro-sky__aurora" />

          <div className="astro-sky__content">
            {!editing && (
              <>
                <h3 className="type-title">A chart of your own</h3>
                <p className="type-body mt-3 max-w-[54ch]">
                  Give a birth date, a time and a city, and Manifester works out
                  where every planet actually was — then, every morning, where
                  they are now and what has moved since.
                </p>
                <ul className="mt-4 grid gap-2 text-[0.92rem] leading-relaxed text-ink-muted sm:grid-cols-2">
                  <li>
                    <span className="text-ink">A daily horoscope</span> that is
                    genuinely different tomorrow — the shape of the day, four
                    areas of a life, and which hours are the open ones.
                  </li>
                  <li>
                    <span className="text-ink">A portrait</span> of your whole
                    chart: the big three, every placement, and the conversations
                    your planets have with each other.
                  </li>
                  <li>
                    <span className="text-ink">The longer cycles</span> — the
                    week ahead, the next new and full moon, and which of the
                    once-in-a-life chapters you are inside.
                  </li>
                  <li>
                    <span className="text-ink">A care plan</span> for the body,
                    the evening and the breath, wired to the player so it ends
                    in a practice rather than a paragraph.
                  </li>
                </ul>
                <p className="type-meta mt-4">
                  Worked out on this device from real orbital mechanics. Nothing
                  is sent anywhere, and there is no account attached to it.
                </p>
              </>
            )}

            <div className="mt-5">
              <BirthDetailsForm
                initial={
                  sky.state.status === 'ready' ? sky.state.profile.birth : null
                }
                saveLabel={editing ? 'Save changes' : 'Show me my chart'}
                onSave={(birth) => {
                  writeAstrology(birth)
                  setEditing(false)
                  sky.refresh()
                }}
                secondary={
                  editing ? (
                    <Button
                      variant="ghost"
                      size="md"
                      onClick={() => {
                        cue('tap')
                        setEditing(false)
                      }}
                    >
                      Cancel
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="md"
                      onClick={() => {
                        cue('tap')
                        declineAstrology()
                        sky.refresh()
                      }}
                    >
                      Not for me
                    </Button>
                  )
                }
              />
            </div>
          </div>
        </Card>
      </div>
    )
  }

  if (sky.loading || !sky.horoscope || !sky.portrait || !sky.natal) {
    return (
      <div data-rise>
        <SectionHeading>Astrology</SectionHeading>
        <p className="type-meta" role="status">
          Working out where everything is…
        </p>
      </div>
    )
  }

  const place = sky.state.profile.birth.place
  const birth = sky.state.profile.birth

  return (
    <div className="space-y-6">
      <div data-rise>
        <SectionHeading
          hint={new Date().toLocaleDateString(undefined, {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })}
        >
          Astrology
        </SectionHeading>

        <SegmentedControl
          label="Astrology section"
          value={panel}
          onChange={(next) => {
            cue('select')
            setPanel(next)
          }}
          segments={[
            { value: 'today', label: 'Today' },
            { value: 'chart', label: 'Chart' },
            { value: 'cycles', label: 'Cycles' },
            { value: 'care', label: 'Care' },
            { value: 'bonds', label: 'Bonds' },
          ]}
        />
      </div>

      {panel === 'today' && <TodayPanel horoscope={sky.horoscope} />}

      <Suspense
        fallback={
          panel === 'today' ? null : (
            <p className="type-meta" role="status">
              Working it out…
            </p>
          )
        }
      >
        {panel === 'chart' && (
          <ChartPanel
            chart={sky.natal}
            overlay={sky.now}
            portrait={sky.portrait}
            vitals={sky.vitals}
            place={place.name}
          />
        )}

        {panel === 'cycles' && (
          <CyclesPanel natal={sky.natal} where={sky.where} day={sky.day} />
        )}

        {panel === 'care' && <CarePanel natal={sky.natal} horoscope={sky.horoscope} />}

        {panel === 'bonds' && <BondsPanel natal={sky.natal} />}
      </Suspense>

      {/* ── Housekeeping, at the bottom of every panel ── */}

      <div data-rise>
        <Disclosure title="Your birth details">
          <p className="type-body">
            {new Date(`${birth.date}T12:00:00`).toLocaleDateString(undefined, {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
            {birth.time ? ` at ${birth.time}` : ' · time unknown'}
            {' · '}
            {place.name}, {place.country}
          </p>
          {!birth.time && (
            <p className="type-meta mt-2">
              Adding a birth time would give you a rising sign, all twelve
              houses, and a Moon that is exact rather than approximate. It is
              the single biggest improvement available to this chart.
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => {
                cue('tap')
                setEditing(true)
              }}
            >
              Change them
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                cue('tap')
                // Everything, including anybody else's details that were added
                // in Bonds. Removing your own chart and leaving your sister's
                // birthday behind would be a strange definition of "remove".
                forgetAstrology()
                forgetEveryone()
                sky.refresh()
              }}
            >
              Remove all of it from this device
            </Button>
          </div>
        </Disclosure>
      </div>
    </div>
  )
}
