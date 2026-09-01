/**
 * The words the website says, kept apart from the words the app says.
 *
 * Manifester is a hash-routed single-page app, which is the right shape for
 * something that has to work on a plane and wrong for something that has to be
 * found: every route lives under a `#` fragment, so a crawler sees one address
 * and one empty `<div id="root">` no matter how much is inside. These pages are
 * the other half — plain HTML at plain URLs, served alongside the app, saying
 * true things about it to somebody who has not opened it yet.
 *
 * They are content, not marketing. Every claim below is one the app keeps:
 * the counts are counted from the source (`FOCUS_AREAS`, `BREATH_PRESETS`,
 * `BREATH_STYLES`, `VOICES`), the prices are zero because there is no payment
 * code anywhere in the repository, and "nothing leaves the device" is the same
 * sentence the About screen says, for the same reason.
 *
 * One promise runs through all of them, and it is the product's: the words are
 * yours. Not a library you subscribe to — the ones you write, in a voice you
 * pick, at a pace you set, for as long as you want them.
 */

/** A paragraph, or a list of short things. Nothing else has been needed. */
export type Block =
  | { kind: 'prose'; text: string }
  | { kind: 'list'; items: string[] }

export type Section = {
  /** Used as the heading's `id`, so any section can be linked to directly. */
  id: string
  heading: string
  blocks: Block[]
}

export type SitePage = {
  /** The path under the site's base. `affirmations` → `/Manifester/affirmations/`. */
  slug: string
  /** The `<title>`. Kept under ~60 characters so search results do not clip it. */
  title: string
  /** The meta description. 110–160 characters is the readable range. */
  description: string
  heading: string
  lede: string
  sections: Section[]
  /** Slugs of the pages worth reading next, in order. */
  next: string[]
}

/** What the app is called, everywhere the site says it out loud. */
export const SITE_NAME = 'Manifester'

/** The one sentence. Everything else on the site is this sentence, expanded. */
export const TAGLINE = 'Affirmations in your own words, in a voice you choose.'

/** Where the source lives, for the people who will want to check the claims. */
export const REPOSITORY = 'https://github.com/cvree/Manifester'

export const PAGES: SitePage[] = [
  {
    slug: 'affirmations',
    title: 'Affirmations in your own words — Manifester',
    description:
      'Write your own affirmations, pick a voice, and loop them over ambient sound. Free, no account, no subscription, works offline.',
    heading: 'Affirmations in your own words',
    lede: 'Most affirmation apps hand you a library and charge you for it. This one is a blank page, a voice, and a loop that runs as long as you want it to.',
    sections: [
      {
        id: 'yours',
        heading: 'The words are yours',
        blocks: [
          {
            kind: 'prose',
            text: 'You write them, or paste them. One line, a handful, or a passage that takes twenty minutes to read through once — the loop treats one written line as one spoken line and keeps going. Nothing is drawn from a catalogue unless you ask it to be.',
          },
          {
            kind: 'prose',
            text: 'If a blank page is the hard part, there are 17 focus areas — confidence, calm, sleep, money, healing, and the rest — each with lines already written and already spoken, there to be taken as they are or edited into something that sounds like you. There is also a writing helper that reads what you have drafted and adds lines in the same direction, or rewrites what you have into the present tense and the first person. Both are one tap, and both undo.',
          },
        ],
      },
      {
        id: 'customizable',
        heading: 'Every part of it moves',
        blocks: [
          {
            kind: 'prose',
            text: 'A ritual is not one setting. It is the voice, the sound underneath it, the silence between the lines, the breathing you do while it plays, and how long the whole thing lasts — and all of those are yours to set, saved with the loop, so the one you built in December still sounds like December in March.',
          },
          {
            kind: 'list',
            items: [
              'Voice — two studio voices, every voice already on your device, or your own, recorded once and used from then on.',
              'Sound — five generated ambiences and five original tracks, mixed to any level or turned off entirely.',
              'Pace — a delay of your choosing between lines, so a phrase has room to land before the next one arrives.',
              'Breath — a breathing guide underneath the words, or on its own, in whichever rhythm suits the hour.',
              'Length — five, ten, twenty, thirty minutes, or until you stop it.',
            ],
          },
        ],
      },
      {
        id: 'free',
        heading: 'Free, and not the kind of free that expires',
        blocks: [
          {
            kind: 'prose',
            text: 'There is no account, no trial, no paid tier, no advertising, and no payment code in the app at all — the source is public and MIT licensed, so that is checkable rather than promised. The common complaint about this category is an app that is advertised as free and paywalled by the second day. There is nothing here to unlock.',
          },
          {
            kind: 'prose',
            text: 'It installs to a home screen from the browser, opens like any other app, and plays the loops you have already heard without a network at all.',
          },
        ],
      },
    ],
    next: ['voices', 'scripts', 'private'],
  },

  {
    slug: 'voices',
    title: 'Choose the voice that reads your words — Manifester',
    description:
      'Two studio voices, every voice already on your phone, or your own recording. Pick who says your affirmations, and how quickly.',
    heading: 'Choose the voice',
    lede: 'The same sentence lands differently depending on who says it. So the voice is a setting, not a fixture — including the option of your own.',
    sections: [
      {
        id: 'studio',
        heading: 'Two studio voices',
        blocks: [
          {
            kind: 'prose',
            text: 'Ivy and Fen are the app’s own voices, and they sound the same on every device — the same reading on a five-year-old Android as on a new iPhone, which is not true of anything that borrows the system voice. Every line the app ships with is already spoken in both, so the first loop plays instantly and offline.',
          },
          {
            kind: 'prose',
            text: 'For your own words, the studio voice can be installed to run on the device itself. It is a large download and it is offered as a choice rather than slipped in — until then, your words are read by the device’s own voice.',
          },
        ],
      },
      {
        id: 'device',
        heading: 'Or the voices you already have',
        blocks: [
          {
            kind: 'prose',
            text: 'Every voice installed on your phone or computer is in the list, ranked so the good ones are near the top, in whichever languages your device supports. They cost nothing, need no download, and on iOS the high-quality voices Apple ships are genuinely good.',
          },
        ],
      },
      {
        id: 'your-own',
        heading: 'Or your own',
        blocks: [
          {
            kind: 'prose',
            text: 'Record the lines yourself and the loop plays them back in your voice. For some people this is the only version of the practice that works at all — the difference between hearing a claim about you and hearing yourself make it.',
          },
          {
            kind: 'prose',
            text: 'The recording stays on the device with everything else. It is not uploaded, not processed anywhere, and not used to build anything.',
          },
        ],
      },
    ],
    next: ['affirmations', 'private', 'scripts'],
  },

  {
    slug: 'scripts',
    title: 'Loop a long script on repeat — Manifester',
    description:
      'Paste a hypnosis script, a subliminal, or a personal statement and hear it read line by line on repeat for as long as you want.',
    heading: 'Loop a script, not a slogan',
    lede: 'Affirmation apps are built around short lines from a curated list. If what you actually have is a page of your own writing, most of them have nowhere to put it.',
    sections: [
      {
        id: 'long-form',
        heading: 'Paste the whole thing',
        blocks: [
          {
            kind: 'prose',
            text: 'The text box takes anything from one sentence to a passage that runs twenty minutes end to end. Each written line becomes one spoken line, so the shape you gave it on the page is the shape you hear — a paragraph break is a pause, and the order is the order you wrote.',
          },
          {
            kind: 'prose',
            text: 'Set a delay between lines if the reading feels crowded, then set the session to run until you stop it. It will read the passage, reach the end, and begin again for as long as you leave it playing.',
          },
        ],
      },
      {
        id: 'what-people-use-it-for',
        heading: 'What that turns out to be for',
        blocks: [
          {
            kind: 'list',
            items: [
              'A self-hypnosis or meditation script written by you or by someone you work with.',
              'A subliminal or affirmation script you would otherwise be re-recording by hand every time it changes.',
              'A personal statement, a set of values, or a passage from a book that you want to hear rather than re-read.',
              'Lines in a language you are learning, in a device voice that speaks it.',
            ],
          },
        ],
      },
      {
        id: 'keeping-it',
        heading: 'Saved, exported, carried',
        blocks: [
          {
            kind: 'prose',
            text: 'A loop keeps its own settings — voice, sound, delay, breathing, length — so reopening it is one tap rather than a rebuild. The library exports to a file you can keep or merge back in later, a loop can be shared as a link that carries the words rather than uploading them anywhere, and a session can be exported as an audio file to play elsewhere.',
          },
        ],
      },
    ],
    next: ['affirmations', 'voices', 'private'],
  },

  {
    slug: 'private',
    title: 'Private affirmations that stay on your device — Manifester',
    description:
      'No account, no server, no analytics. Your affirmations are stored on your device, play offline, and are never uploaded anywhere.',
    heading: 'It stays on your device',
    lede: 'Affirmations are, functionally, a written record of what you are worried about. That is not a thing to hand to a company in exchange for a login.',
    sections: [
      {
        id: 'no-account',
        heading: 'Nothing to sign in to',
        blocks: [
          {
            kind: 'prose',
            text: 'There is no account, because there is no server holding anything to log in to. Your loops, your settings, your recordings and your listening totals live in your browser’s own storage on the device you wrote them on. Clearing that storage deletes them, and there is a button in the app that does exactly that in one press.',
          },
          {
            kind: 'prose',
            text: 'No analytics, no crash reporting, no advertising identifiers, no third-party scripts. The app cannot tell how many people use it, which is a real cost and an accepted one.',
          },
        ],
      },
      {
        id: 'offline',
        heading: 'It works with the network off',
        blocks: [
          {
            kind: 'prose',
            text: 'Installed to the home screen, the app opens and plays without a connection. Every line it has spoken is kept, so a loop you have heard before runs offline in full — on a plane, in a basement, in airplane mode at 2am.',
          },
        ],
      },
      {
        id: 'exceptions',
        heading: 'The two exceptions, stated plainly',
        blocks: [
          {
            kind: 'list',
            items: [
              'The optional writing helper can be connected to Google’s Gemini with a free key you bring yourself. When it is connected, and only then, the draft you press the button on is sent to Google. It is off until you set it up, and the app says so at the moment you do.',
              'When the app is served from a host with a speech backend, unfamiliar words may be sent there to be spoken. On the public site there is no such backend, so nothing is sent — your words are read by the device or by the on-device studio voice.',
            ],
          },
          {
            kind: 'prose',
            text: 'The source is public and MIT licensed. None of this has to be taken on faith.',
          },
        ],
      },
    ],
    next: ['affirmations', 'voices', 'breathing'],
  },

  {
    slug: 'breathing',
    title: 'A breathing guide with or without words — Manifester',
    description:
      'Ten breathing patterns, eight visual forms, timing you set per phase — under your affirmations, or on its own with no words at all.',
    heading: 'Breathe, with or without words',
    lede: 'Manifester with nothing written in it is a breathing app. That was not the plan, and it is one of the better things about it.',
    sections: [
      {
        id: 'patterns',
        heading: 'Ten patterns, and your own',
        blocks: [
          {
            kind: 'prose',
            text: 'Box breathing, 4-7-8, coherent breathing at about six breaths a minute, a very slow six-in ten-out for lying down, and six more, each with its own timing — or set every phase yourself, in half-second steps, until the rhythm matches the one you actually breathe. The guide keeps its own clock in the audio engine, so a backgrounded tab does not drift away from the count.',
          },
        ],
      },
      {
        id: 'forms',
        heading: 'Eight ways to watch it',
        blocks: [
          {
            kind: 'prose',
            text: 'The visual is a setting too: eight forms, from a plain expanding bloom to a full-screen scene, in a colour taken from the ambience you chose. Some people want a shape to follow. Some want the screen nearly dark. Both are two taps away.',
          },
          {
            kind: 'prose',
            text: 'A spoken breath cue can count you through it, in one of several voices, or stay silent while the shape does the work.',
          },
        ],
      },
      {
        id: 'alone',
        heading: 'On its own',
        blocks: [
          {
            kind: 'prose',
            text: 'Leave the words empty and press play: you get the pattern, the ambience, the optional rhythm underneath, and a session that runs for as long as you set. No affirmation required, and nothing nagging you to write one.',
          },
        ],
      },
    ],
    next: ['affirmations', 'private', 'voices'],
  },
]

/** A page by slug, or `null`. Used by the renderer to resolve `next` links. */
export function pageFor(slug: string): SitePage | null {
  return PAGES.find((page) => page.slug === slug) ?? null
}
