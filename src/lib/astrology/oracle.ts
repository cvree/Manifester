/**
 * The one part of this feature that is a shuffle, and says so.
 *
 * Everything else in the astrology section is arithmetic: real positions, real
 * angles, a real ranking. This is a deck of questions, drawn at random when
 * somebody presses the button, and the screen labels it honestly — because the
 * moment a feature blurs the line between *the Moon is at 14° Scorpio* and *the
 * cards say you should call your brother*, the trustworthy half stops being
 * trustworthy too.
 *
 * It is here because it is genuinely useful and genuinely fun. Being asked a
 * question you did not choose is one of the oldest working tools for getting
 * unstuck, and it works whether or not anything is listening: the value is in
 * the answering, and the deck is honest about being a deck.
 */

export interface Card {
  /** The planet this card belongs to, for the glyph. */
  glyph: string
  title: string
  /** Two sentences. */
  message: string
  /** The thing to actually sit with. */
  question: string
}

const DECK: Card[] = [
  {
    glyph: '☉',
    title: 'The centre',
    message:
      'Somewhere in the last month you did something that was entirely yours, and you have probably not counted it. The centre of a life is built out of things nobody asked you for.',
    question: 'What have I done lately that nobody required of me?',
  },
  {
    glyph: '☽',
    title: 'The tide',
    message:
      'Moods are weather. They arrive, they are completely convincing while they last, and they are not evidence about your life.',
    question: 'Is this a fact, or is it the time of day?',
  },
  {
    glyph: '☿',
    title: 'The unsent message',
    message:
      'There is a conversation you have already had four times in your head. Every one of those was a rehearsal for a thing that takes ninety seconds to actually say.',
    question: 'Who am I still drafting something to?',
  },
  {
    glyph: '♀',
    title: 'The unspent pleasure',
    message:
      'Something you love has been in the category of later for a while now. Pleasure is not a reward for finishing; it is one of the inputs.',
    question: 'What would I do this evening if it did not have to be useful?',
  },
  {
    glyph: '♂',
    title: 'The held charge',
    message:
      'Energy that does not get spent turns into irritation with something innocent. It is nearly always cheaper to spend it than to explain it.',
    question: 'What am I annoyed about that is really just unspent?',
  },
  {
    glyph: '♃',
    title: 'The wider door',
    message:
      'Most rooms are bigger than the part of them people use. The limit you are working inside may not be a limit; it may be a habit with a good reputation.',
    question: 'What would I ask for if it were normal to ask?',
  },
  {
    glyph: '♄',
    title: 'The load-bearing wall',
    message:
      'Some of what you are carrying is holding the building up and some of it is furniture nobody has moved in nine years. They feel identical from underneath.',
    question: 'What am I carrying that nothing depends on?',
  },
  {
    glyph: '♅',
    title: 'The other option',
    message:
      'There is a version of this you have not let yourself consider because it would be inconvenient for everybody. Considering is free.',
    question: 'What would I change if nobody would be disappointed?',
  },
  {
    glyph: '♆',
    title: 'The soft edge',
    message:
      'Not everything needs a decision today. Some things need a week of being left alone and then turn out to have decided themselves.',
    question: 'What am I forcing that could simply be left for now?',
  },
  {
    glyph: '♇',
    title: 'The finished thing',
    message:
      'Something in your life ended a while ago and is still being maintained. Ending it officially usually costs less than the maintenance does.',
    question: 'What is already over that I have not admitted is over?',
  },
  {
    glyph: '☊',
    title: 'The unfamiliar step',
    message:
      'The direction that is right is frequently the one that would make you a beginner again. That feeling is not a warning, it is the fee.',
    question: 'What would I try if being bad at it for a month were fine?',
  },
  {
    glyph: '✦',
    title: 'The witness',
    message:
      'You are the only person present for every single day of your life, and the least likely to give yourself credit for any of them.',
    question: 'What would somebody who loves me say I have handled well?',
  },
  {
    glyph: '◑',
    title: 'The half-done',
    message:
      'There is a thing at seventy per cent. Seventy is the hardest place to stand — it is too far in to abandon comfortably and too far out to feel finished.',
    question: 'What is one hour away from being done?',
  },
  {
    glyph: '❖',
    title: 'The small kindness',
    message:
      'The gestures that hold a life together are almost all trivially small and are almost never the ones that get planned.',
    question: 'Who would be glad to hear from me today?',
  },
  {
    glyph: '◯',
    title: 'The empty hour',
    message:
      'An hour with nothing in it is not wasted. It is where most of the good ideas people have ever had came from.',
    question: 'When did I last have an hour that nobody knew about?',
  },
  {
    glyph: '△',
    title: 'The easy thing',
    message:
      'Something is currently going well and getting no attention at all, because attention goes to what is broken. Noticing it is not complacency.',
    question: 'What is quietly working right now?',
  },
]

/**
 * A card, at random.
 *
 * Genuinely random rather than seeded by the day, and that is the point: this
 * is the one control in the section that answers differently when pressed
 * twice, which is what makes it a thing to play with rather than a thing to
 * read. `avoid` keeps a second press from returning the card already on screen.
 */
export function drawCard(avoid?: string): Card {
  const pool = avoid ? DECK.filter((card) => card.title !== avoid) : DECK
  return pool[Math.floor(Math.random() * pool.length)]
}

export const DECK_SIZE = DECK.length
