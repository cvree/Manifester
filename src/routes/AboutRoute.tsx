import { ReactLenis, useLenis } from 'lenis/react'
import {
  useCallback,
  useEffect,
  useState,
  type ComponentType,
  type ReactNode,
  type SVGProps,
} from 'react'
import { AiSetupPanel } from '../components/AiSetupPanel'
import { AppearanceSettings } from '../components/AppearanceSettings'
import { Card } from '../components/Card'
import {
  ArrowUpIcon,
  BreathIcon,
  ClockIcon,
  DownloadIcon,
  HeadphonesIcon,
  MicIcon,
  PaletteIcon,
  PauseIcon,
  PulseIcon,
  SparkIcon,
  TuneIcon,
  VoiceIcon,
  WaveIcon,
} from '../components/Icons'
import { InstallInstructions } from '../components/InstallPrompt'
import { setStoredCredentials, useCredentials } from '../lib/ai/useCredentials'
import { cx } from '../lib/cx'
import { cue } from '../lib/feedback'
import { BRAINWAVE_LIST, formatHz, supportsBinaural } from '../lib/brainwaveAudio'
import { prefersReducedMotion, useReducedMotion } from '../lib/motion'
import { usePreferences } from '../state/PreferencesProvider'

/** Air between the top of the window and the section it just landed on. */
const JUMP_GAP = 16

/**
 * How far down the window a section has to reach before the rail calls it the
 * one you are reading. A little below the top edge, so the highlight changes
 * as a heading settles into view rather than the instant it appears.
 */
const READING_LINE = 140

/**
 * Move the page to a section.
 *
 * Not a plain `#id` link, however much it wants to be one: the app is on a
 * hash router, so a second fragment in the URL is read as a route and takes
 * you to the Create screen instead. So the rail asks the scroller directly —
 * Lenis when it is running the page, and the window itself when reduced
 * motion has left Lenis unmounted.
 *
 * Focus follows the scroll, because a control that moves the viewport and
 * leaves the keyboard behind has only moved the picture. The section is made
 * focusable for exactly as long as it takes to receive focus, so nothing in
 * the page grows a permanent tab stop.
 */
function useJumpToSection() {
  const lenis = useLenis()

  return useCallback(
    (id: string) => {
      const target = document.getElementById(id)
      if (!target) return

      if (lenis) {
        lenis.scrollTo(target, { offset: -JUMP_GAP })
      } else {
        window.scrollTo({
          top: Math.max(0, target.getBoundingClientRect().top + window.scrollY - JUMP_GAP),
          behavior: prefersReducedMotion() ? 'auto' : 'smooth',
        })
      }

      target.setAttribute('tabindex', '-1')
      target.focus({ preventScroll: true })
      target.addEventListener('blur', () => target.removeAttribute('tabindex'), {
        once: true,
      })
    },
    [lenis],
  )
}

/**
 * The contents rail.
 *
 * Every entry here must match a card's `id` below — the rail is the only
 * navigation this page has, and a link that scrolls nowhere is worse than no
 * link at all. Kept in reading order rather than importance order, so the
 * numbers beside them mean something.
 */
const SECTIONS: Array<{ id: string; label: string }> = [
  { id: 'how-it-works', label: 'How it works' },
  { id: 'appearance', label: 'Colour' },
  { id: 'install', label: 'Install it' },
  { id: 'privacy', label: 'Privacy' },
  { id: 'ai', label: 'AI writing help' },
  { id: 'settings', label: 'Every setting' },
  { id: 'rhythms', label: 'Rhythms' },
  { id: 'voices', label: 'Better voices' },
  { id: 'help', label: 'Troubleshooting' },
]

/**
 * Which section the page is currently showing.
 *
 * A long page with a fixed contents rail and no sense of where you are is a
 * map with no "you are here" on it. This is deliberately not an
 * IntersectionObserver: the question is not "which sections are visible" —
 * three usually are — but "which one has most recently passed the reading
 * line", and that is one comparison per section on a rAF-throttled scroll.
 */
function useActiveSection(): string {
  const [active, setActive] = useState(SECTIONS[0].id)

  useEffect(() => {
    let frame = 0

    const measure = () => {
      frame = 0

      let current = SECTIONS[0].id
      for (const { id } of SECTIONS) {
        const element = document.getElementById(id)
        if (element && element.getBoundingClientRect().top <= READING_LINE) {
          current = id
        }
      }

      /*
       * The last card is shorter than the window, so it can never reach the
       * line on its own. Anyone who has scrolled to the bottom is reading it.
       */
      const atBottom =
        window.scrollY + window.innerHeight >=
        document.documentElement.scrollHeight - 4
      if (atBottom) current = SECTIONS[SECTIONS.length - 1].id

      setActive(current)
    }

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure)
    }

    measure()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  return active
}

/**
 * Every setting in the app, where it lives, and what it changes.
 *
 * The point of this table is the middle column. Manifester keeps its settings
 * behind one collapsed list precisely so the Create screen stays calm, and the
 * cost of that is people not knowing a thing exists — so here, once, is the
 * whole surface area with directions to each control.
 */
const SETTINGS: Array<{
  icon: ComponentType<SVGProps<SVGSVGElement>>
  name: string
  where: string
  what: string
}> = [
  {
    icon: VoiceIcon,
    name: 'Voice',
    where: 'Create → Customize',
    what: 'Which of your device’s voices reads the words, how fast, and how high.',
  },
  {
    icon: WaveIcon,
    name: 'Background sound',
    where: 'Create → Customize',
    what: 'One of five generated ambiences, a sound you imported, or a playlist of them.',
  },
  {
    icon: PulseIcon,
    name: 'Brainwave rhythm',
    where: 'Create → Customize',
    what: 'A generated pulse under everything else. On its own, or beneath an ambience.',
  },
  {
    icon: BreathIcon,
    name: 'Breathing',
    where: 'Create → Customize',
    what: 'The pattern you follow, the shape it is drawn as, and the sound it breathes with.',
  },
  {
    icon: ClockIcon,
    name: 'Session length',
    where: 'Create, its own card',
    what: 'From five minutes to eight hours, or until you stop it yourself.',
  },
  {
    icon: PauseIcon,
    name: 'Delay between loops',
    where: 'Create → Customize',
    what: 'The silence before your words begin again — up to a minute of it.',
  },
  {
    icon: MicIcon,
    name: 'Record your own voice',
    where: 'Create → Customize',
    what: 'Optional. It is what makes a downloadable file possible.',
  },
  {
    icon: DownloadIcon,
    name: 'Download audio',
    where: 'Create → Customize',
    what: 'Renders your recording and background sound to a file, here on your device.',
  },
  {
    icon: TuneIcon,
    name: 'Haptics and interface sounds',
    where: 'Create or Player → Customize',
    what: 'How the app answers a tap. Both can be switched off entirely.',
  },
  {
    icon: SparkIcon,
    name: 'AI writing help',
    where: 'Customize, or the card above',
    what: 'Off unless you turn it on, and it is the only thing that ever leaves this device.',
  },
]

/** The things that actually go wrong, and the shortest true answer to each. */
const TROUBLE: Array<{ question: string; answer: ReactNode }> = [
  {
    question: 'Nothing speaks at all.',
    answer: (
      <>
        Tap play once more. Browsers will not let a page make sound until you
        have touched it, and the first tap is sometimes spent on that alone. On
        an iPhone, check the silent switch and the volume rocker too — speech
        follows your media volume there rather than the app’s slider.
      </>
    ),
  },
  {
    question: 'The voice sounds flat and robotic.',
    answer: (
      <>
        Your device is falling back to an old synthesiser. The Voice panel
        labels it <em className="not-italic text-ink">Basic</em> when that
        happens, and <SectionLink id="voices">Getting the best voice</SectionLink>{' '}
        below has the free fix for each platform.
      </>
    ),
  },
  {
    question: 'It stops when the screen locks.',
    answer: (
      <>
        Manifester asks your device to keep the screen awake while a session
        runs, but a low-power mode or an auto-lock setting can overrule that.
        Leaving the tab in front and the screen on is the only reliable answer
        on iOS.
      </>
    ),
  },
  {
    question: 'The rhythm sounds like one flat tone.',
    answer: (
      <>
        That is headphone mode playing through a speaker, which mixes both
        tones into both ears and cancels the effect. Either put headphones on,
        or switch that rhythm to rhythmic modulation, which works on anything.
      </>
    ),
  },
  {
    question: 'Everything is too quiet.',
    answer: (
      <>
        The Levels card on the Player pushes background sound to twice its
        normal loudness. The spoken voice is capped at 100% by your device
        rather than by Manifester, so past that point turn up the device itself.
      </>
    ),
  },
  {
    question: 'My saved loops have disappeared.',
    answer: (
      <>
        Clearing your browser data for this site removes everything, and a
        private window keeps nothing after you close it. There is no account to
        restore from, by design — so keep a copy of anything you would hate to
        lose.
      </>
    ),
  },
]

/**
 * The one long-scrolling screen in the app, so it is the only place Lenis is
 * mounted. The player and its controls are never wrapped by it.
 */
export function AboutRoute() {
  const reducedMotion = useReducedMotion()
  const credentials = useCredentials()
  const { preferences, update: updatePreferences } = usePreferences()

  const content = (
    <div className="mx-auto max-w-2xl lg:max-w-5xl">
      <header data-rise className="pt-2">
        <h1 className="type-display">About Manifester</h1>
        <p className="type-body mt-3">
          A small, quiet place to hear your own words back. Write an intention,
          choose a voice, and let it loop for as long as you like.
        </p>
      </header>

      {/*
        The rail sits in the right-hand column on a wide screen and above
        everything on a narrow one — but it comes first in the source either
        way, because "what is on this page" is the question a long page has to
        answer before anything else.
      */}
      <div className="mt-6 lg:grid lg:grid-cols-[minmax(0,1fr)_15rem] lg:items-start lg:gap-10">
        <Contents />

        <div className="space-y-6 lg:col-start-1 lg:row-start-1">
          <Card data-rise id="how-it-works" className="scroll-mt-6" title="How a loop works">
            <p className="type-body">
              Four steps, and only the first one is required. Everything else
              has a sensible default already chosen for you.
            </p>
            <ol className="mt-6 space-y-6">
              <Step index={1} title="Write your words">
                Type or paste them on the Create screen — one line each. Short,
                present-tense sentences read best aloud. There are starter
                phrases under the box if the page is intimidating.
              </Step>
              <Step index={2} title="Shape the ritual">
                Open Customize to change the voice, the background sound, the
                breathing pattern and the rest. The panel beside your words
                always shows what you have chosen.
              </Step>
              <Step index={3} title="Press start">
                Your words are spoken a line at a time, the guide breathes with
                you, and the whole thing begins again after the delay you set —
                until the timer runs out or you stop it.
              </Step>
              <Step index={4} title="Keep it, if you want it">
                Save turns the loop and every setting around it into a card in
                your Library, ready to start again in one tap.
              </Step>
            </ol>
          </Card>

          {/*
            Sits this high on purpose. It is the one card on the page you can
            *do* something with, and the something it does is visible on every
            other screen in the app the moment you tap it.
          */}
          <Card
            data-rise
            id="appearance"
            className="scroll-mt-6"
            title={
              <span className="flex items-center gap-2.5">
                <PaletteIcon className="text-[1.2rem] text-[var(--rose-deep)]" />
                Make it yours
              </span>
            }
            description="Turn the whole garden to a colour you like. It is remembered on this device."
          >
            <AppearanceSettings />
          </Card>

          <Card
            data-rise
            id="install"
            className="scroll-mt-6"
            level="stage"
            title="Add it to your phone"
          >
            <InstallInstructions />
          </Card>

          <Card data-rise id="privacy" className="scroll-mt-6" title="Your privacy">
            <p className="type-body">
              Your saved loops stay on this device. Manifester does not require
              an account and has no server of its own.
            </p>
            <ul className="type-body mt-4 space-y-2.5">
              <Bullet>
                Text, settings and imported audio are stored in your browser's own
                storage.
              </Bullet>
              <Bullet>
                <em className="not-italic text-ink">
                  The one exception is AI writing help
                </em>
                , which is off unless you turn it on. While it is on, pressing one
                of the two helper buttons sends that loop to the company whose key
                you set up — and nothing else does, at any other time.
              </Bullet>
              <Bullet>
                Speech is generated by your device or browser, not by an online
                service.
              </Bullet>
              <Bullet>There is no analytics, no tracking and no advertising.</Bullet>
              <Bullet>
                Clearing your browser data for this site removes everything, so keep a
                copy of anything you would hate to lose.
              </Bullet>
            </ul>
          </Card>

          {/*
            The same panel as the one under Customize, deliberately duplicated
            here rather than linked to. This is the page people open when they
            want to know what the app is doing and how to stop it, so "turn it
            off" and "here is exactly how to connect your own key" belong on it
            — not one navigation hop away behind a settings list.
          */}
          <Card
            data-rise
            id="ai"
            className="scroll-mt-6"
            title="AI writing help — set up or switch off"
            description="Off until you turn it on. The switch and the full step-by-step are both here."
          >
            <AiSetupPanel
              credentials={credentials}
              onChange={setStoredCredentials}
              enabled={preferences.aiEnabled}
              onEnabledChange={(aiEnabled) => updatePreferences({ aiEnabled })}
            />
          </Card>

          <Card
            data-rise
            id="settings"
            className="scroll-mt-6"
            title="Every setting, and where it lives"
            description="Customize sits collapsed so the Create screen stays quiet. This is what is inside it."
          >
            <ul className="mt-1">
              {SETTINGS.map(({ icon: Icon, name, where, what }) => (
                <li
                  key={name}
                  className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-4 gap-y-1 border-t border-[var(--quiet-border)] py-4 first:border-t-0 first:pt-0"
                >
                  <span
                    aria-hidden="true"
                    className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-[0.85rem] bg-[var(--sage-soft)] text-[1.05rem] text-[var(--sage)]"
                  >
                    <Icon />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <h3 className="type-subheading">{name}</h3>
                      <span className="type-meta text-ink-faint">{where}</span>
                    </div>
                    <p className="type-meta mt-1">{what}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card
            data-rise
            id="rhythms"
            className="scroll-mt-6"
            title="About the brainwave rhythms"
          >
            <p className="type-body">
              The five rhythms are named after conventional EEG frequency bands.
              Band edges vary a little between references, so the ranges below are
              described as conventional rather than definitive. The target rates
              themselves are exact.
            </p>

            {/*
              Straight from `BRAINWAVE_LIST`, so this table cannot fall out of
              step with what the audio engine actually generates — the rates are
              the one thing on this page that must never be approximately right.
            */}
            <ul className="mt-5">
              {BRAINWAVE_LIST.map((wave) => (
                <SpecRow
                  key={wave.id}
                  name={wave.label}
                  value={formatHz(wave.targetHz)}
                  note={wave.character}
                  meta={
                    <>
                      {`≈ ${formatHz(wave.minHz, false)}–${formatHz(wave.maxHz)}`}
                      {supportsBinaural(wave.targetHz) && (
                        <>
                          {' '}
                          <HeadphonesIcon
                            className="ml-1 inline-block align-[-0.1em] text-[0.95rem] text-[var(--sage)]"
                          />
                          <span className="sr-only">
                            Binaural headphone mode available
                          </span>
                        </>
                      )}
                    </>
                  }
                />
              ))}
            </ul>

            <p className="type-meta mt-3 flex items-center gap-2 text-ink-faint">
              <HeadphonesIcon className="shrink-0 text-[1rem] text-[var(--sage)]" />
              Marks the rates that can also be generated as a binaural beat.
            </p>

            <p className="type-body mt-6">
              Those rates are far below hearing, so they are never played as pitches.
              Instead an audible 200 Hz tone rises and falls at exactly the chosen
              rate — or, in headphone mode, each ear receives a tone offset by half
              the rate, so the difference between them is the rate. The timing runs
              on the browser's audio thread rather than a JavaScript timer, which is
              why a backgrounded tab cannot shift it.
            </p>
            <ul className="type-body mt-4 space-y-2.5">
              <Bullet>
                A binaural beat is the rhythm you perceive when two different tones
                are delivered separately to the ears. Headphones are required,
                because a speaker mixes both tones into both ears.
              </Bullet>
              <Bullet>
                Binaural beating is generally discussed for differences of roughly
                1–30 Hz, so 40 Hz Gamma uses amplitude modulation even with headphone
                mode on.
              </Bullet>
              <Bullet>
                Scientific evidence that any of this reliably changes brain activity,
                or produces a particular psychological outcome, remains inconsistent.
                Experiences vary. This is not a medical treatment or a diagnostic
                tool.
              </Bullet>
              <Bullet>
                Please choose a moderate listening level, and turn it down rather
                than up if you are unsure.
              </Bullet>
            </ul>
          </Card>

          <Card data-rise id="voices" className="scroll-mt-6" title="Getting the best voice">
            <p className="type-body">
              Manifester automatically picks the nicest voice your device has, and
              labels how good it is. If that label says <em className="not-italic text-ink">Basic</em>,
              your device is falling back to an old robotic synthesiser — and there is
              a free fix.
            </p>
            <p className="type-body mt-3">
              On iPhone: <strong className="text-ink">Settings → Accessibility → Spoken
              Content → Voices → English</strong>, then download one marked{' '}
              <strong className="text-ink">Premium</strong>. Ava, Zoe, Evan and Nathan
              are all excellent. They are Apple's neural voices, they run on the
              phone's own hardware, and they cost nothing. Open Manifester again
              afterwards and it will find them by itself.
            </p>
            <p className="type-body mt-3">
              The same instructions for Android, Windows and Mac are in the Voice
              panel, under <em className="not-italic text-ink">Customize your ritual</em>{' '}
              on the Create screen.
            </p>
          </Card>

          <Card
            data-rise
            id="help"
            className="scroll-mt-6"
            title="If something is not working"
            description="The six things that actually go wrong, and what to do about each."
          >
            <dl>
              {TROUBLE.map(({ question, answer }) => (
                <div
                  key={question}
                  className="border-t border-[var(--quiet-border)] py-4 first:border-t-0 first:pt-0 last:pb-0"
                >
                  <dt className="type-subheading">{question}</dt>
                  <dd className="type-body mt-1.5">{answer}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <div data-rise className="flex flex-col items-center gap-4 px-1 pb-2">
            <BackToTop />
            <p className="type-meta text-center">
              Made with care. No accounts, no servers, no subscriptions.
            </p>
          </div>
        </div>
      </div>
    </div>
  )

  if (reducedMotion) return content

  return (
    <ReactLenis root options={{ duration: 1.1, smoothWheel: true }}>
      {content}
    </ReactLenis>
  )
}

/**
 * The contents rail.
 *
 * One list, two lives: a quiet two-column card at the top of a phone screen,
 * and a sticky single column beside the page on a desktop.
 *
 * The labels are short to the point of terse on purpose. Nine full section
 * titles stacked down a phone is a screenful of contents before a word of the
 * page — two columns of two-word labels is a glance.
 *
 * The entry you are currently reading is marked, so the rail answers "where
 * am I" as well as "what is here".
 */
function Contents() {
  const jump = useJumpToSection()
  const active = useActiveSection()

  return (
    <nav
      aria-label="On this page"
      data-rise
      className="surface-quiet mb-6 p-3 sm:p-4 lg:sticky lg:top-6 lg:col-start-2 lg:row-start-1 lg:mb-0 lg:border-transparent lg:bg-transparent lg:p-0"
    >
      <p className="type-label mb-2 px-2">On this page</p>
      <ol className="grid grid-cols-2 gap-0.5 lg:grid-cols-1">
        {SECTIONS.map((section, index) => {
          const here = section.id === active
          return (
            <li key={section.id}>
              <button
                type="button"
                onClick={() => {
                  cue('tap')
                  jump(section.id)
                }}
                aria-current={here ? 'true' : undefined}
                className={cx(
                  'interactive flex min-h-11 w-full items-center gap-2.5 rounded-[0.9rem] px-2 text-left text-[0.9rem]',
                  here
                    ? 'bg-[var(--rose-soft)] text-[var(--rose-deep)]'
                    : 'text-ink-muted hover:bg-[var(--quiet)] hover:text-ink',
                )}
              >
                <span
                  aria-hidden="true"
                  className={cx(
                    'type-numeral w-5 shrink-0 text-[0.75rem]',
                    here ? 'text-[var(--rose-deep)]' : 'text-ink-faint',
                  )}
                >
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="min-w-0">{section.label}</span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

/**
 * The way back up.
 *
 * The rail is sticky on a desktop and scrolled far away on a phone, which is
 * exactly where this matters — reaching the end of a long page should not mean
 * a thumb-flick marathon to get anywhere else.
 */
function BackToTop() {
  const lenis = useLenis()

  return (
    <button
      type="button"
      onClick={() => {
        cue('tap')
        if (lenis) {
          lenis.scrollTo(0)
        } else {
          window.scrollTo({
            top: 0,
            behavior: prefersReducedMotion() ? 'auto' : 'smooth',
          })
        }
      }}
      className="interactive pressable flex min-h-11 items-center gap-2 rounded-pill border border-[var(--control-border)] bg-[var(--panel)] px-4 text-[0.9rem] text-ink-muted hover:text-ink"
    >
      <ArrowUpIcon className="text-[1rem]" />
      Back to top
    </button>
  )
}

/** A cross-reference from inside a sentence to another section of this page. */
function SectionLink({ id, children }: { id: string; children: ReactNode }) {
  const jump = useJumpToSection()

  return (
    <button
      type="button"
      onClick={() => {
        cue('tap')
        jump(id)
      }}
      className="interactive text-ink underline underline-offset-4"
    >
      {children}
    </button>
  )
}

/**
 * One numbered step, with the hairline that joins it to the next.
 *
 * The connector is a child of the step rather than a line behind the list, so
 * the last one can simply hide itself — a rail drawn behind the whole list
 * always overshoots the final numeral by exactly the wrong amount.
 */
function Step({
  index,
  title,
  children,
}: {
  index: number
  title: string
  children: ReactNode
}) {
  return (
    <li className="group relative grid grid-cols-[2.5rem_minmax(0,1fr)] gap-4">
      <span
        aria-hidden="true"
        className="absolute top-11 bottom-[-1.75rem] left-[1.25rem] w-px bg-[var(--quiet-border)] group-last:hidden"
      />
      <span
        aria-hidden="true"
        className="relative flex h-10 w-10 items-center justify-center rounded-full border border-[var(--panel-border)] bg-[var(--rose-soft)] font-display text-[1.05rem] text-[var(--rose-deep)]"
      >
        {index}
      </span>
      <div className="min-w-0 pb-1">
        <h3 className="type-subheading">{title}</h3>
        <p className="type-body mt-1.5">{children}</p>
      </div>
    </li>
  )
}

/**
 * A row in one of the two reference tables.
 *
 * Name and number on the first line, so a column of numerals lines up and can
 * be read on its own — that column is the whole reason this is a table rather
 * than a paragraph. The sentence and the technical detail follow underneath,
 * where they cost nothing to skip; on a phone they take a line each rather
 * than fighting the numerals for the same 320 pixels.
 */
function SpecRow({
  name,
  value,
  note,
  meta,
}: {
  name: string
  value: string
  note: ReactNode
  meta: ReactNode
}) {
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 border-t border-[var(--quiet-border)] py-3 first:border-t-0 first:pt-0">
      <h4 className="type-subheading">{name}</h4>
      <span className="type-numeral text-right text-[0.95rem] whitespace-nowrap text-ink">
        {value}
      </span>
      <p className="type-meta col-span-2 mt-0.5 sm:col-span-1">{note}</p>
      <p className="type-meta col-span-2 mt-0.5 text-ink-faint sm:col-span-1 sm:text-right sm:whitespace-nowrap">
        {meta}
      </p>
    </li>
  )
}

function Bullet({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden="true"
        className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--sage)]"
      />
      <span>{children}</span>
    </li>
  )
}
