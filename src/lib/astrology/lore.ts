/**
 * The deep vocabulary: what the twelve signs are like to live inside, what the
 * twelve houses are about, what each planet needs in order to be well, and
 * what the Moon's eight faces are for.
 *
 * ── Why this is a separate file from `signs.ts` ─────────────────────────────
 *
 * `signs.ts` holds the fragments a *daily* reading is assembled from: one
 * clause per sign, one per body, one per aspect, all of them short because a
 * day has to be legible in a screen. This file holds the fragments a *portrait*
 * is assembled from — the paragraph-length material behind the chart, the care
 * plan, the cycles and the bonds — and it is deliberately kept apart so that
 * somebody who only opens the daily reading is never made to download it.
 *
 * ── The rules the writing here is held to ──────────────────────────────────
 *
 * The same three as everywhere else in this feature, and one more that only
 * matters once the text gets this long:
 *
 *  1. **Describe, never predict.** Nothing here says what will happen. It says
 *     what a thing is like, which is checkable against a life and therefore
 *     worth reading twice.
 *  2. **Never a bad placement.** Saturn on the Moon is not a curse and the
 *     twelfth house is not a punishment. Every entry names what a placement
 *     *is for* and what it costs, in that order, because that is the honest
 *     shape of all of them.
 *  3. **No claims about the body that a doctor would have to correct.** The
 *     traditional sign–body correspondences are here because they are two
 *     thousand years old and because they make excellent *attention* prompts —
 *     "your shoulders have been up by your ears for a week" is a useful thing
 *     to be asked. They are not diagnoses, nothing here treats anything, and
 *     the care screen says so in plain words where anybody can see it.
 *  4. **It has to be worth reading when it is not flattering.** The growth
 *     edges are real edges. A portrait made only of compliments is a horoscope
 *     nobody believes by the second week, and the whole value of this thing is
 *     that a person recognises themselves in it.
 */

import type { FocusId } from '../affirmations'
import type { Body } from './ephemeris'
import type { Element, Modality, AspectId } from './signs'

/* ── The signs, at length ────────────────────────────────────── */

export interface SignLore {
  /** Two or three words for the top of a card. */
  keyword: string
  /** Completes "…in Taurus, it ___" for any planet passing through. */
  through: string
  /**
   * The same idea in the second person, completing "at the centre you ___".
   *
   * Kept separate from `through` rather than derived from it, because English
   * will not let a third-person clause be reused as a second-person one — "you
   * is felt before it is understood" is how every generated horoscope on the
   * internet gives itself away.
   */
  you: string
  /** What this sign is good at. A list, in prose. */
  gifts: string
  /** The honest cost of the same trait. Never a scolding. */
  edge: string
  /** What somebody with this sign strong needs in order to feel like themselves. */
  needs: string
  /** The traditional body correspondence — an attention prompt, not a diagnosis. */
  body: string
  /** One concrete, small, physical thing that helps. */
  care: string
  /** A practice worth five minutes. */
  ritual: string
  /** One question, for the journal. */
  question: string
  /** The colour the app tints this sign with, for the chips and the wheel. */
  tone: 'rose' | 'sage' | 'gold' | 'twilight'
}

export const SIGN_LORE: Record<string, SignLore> = {
  Aries: {
    keyword: 'The first move',
    through: 'stops deliberating and simply goes',
    you: 'start moving before you have finished deciding',
    gifts:
      'starting from nothing, saying the true thing before it has been made polite, and being brave in the ordinary daily way that nobody claps for',
    edge:
      'the second half. Beginnings are cheap for you and finishing is the expensive part, and the fix is never more willpower — it is smaller commitments',
    needs:
      'something to push against, and permission to be direct without having to apologise for it afterwards',
    body: 'the head, the jaw and the eyes — where a fast week tends to collect',
    care: 'Unclench your jaw, and let your tongue come off the roof of your mouth.',
    ritual:
      'Two minutes of something physical and slightly too fast, then sit down. Aries settles by spending, not by holding.',
    question: 'What have I been waiting for permission to begin?',
    tone: 'rose',
  },
  Taurus: {
    keyword: 'The steady hand',
    through: 'slows down and refuses to be hurried',
    you: 'move at the speed of comfort and will not be hurried',
    gifts:
      'staying, finishing, and making a room somebody else can rest in — the least dramatic and most rare of the talents',
    edge:
      'the dug-in heel. You will stay in something long after it has stopped being good, because leaving costs more than enduring does',
    needs:
      'enough time, something good to eat, and to not be rushed through a decision by somebody else’s urgency',
    body: 'the throat and neck — and the voice, which goes first when you are swallowing something you have not said',
    care: 'Something warm to drink, slowly, without a screen in front of it.',
    ritual:
      'Put your hands on something with a real texture — wood, stone, bread, a dog — for a full minute. Taurus comes back through the skin.',
    question: 'What am I staying in out of comfort rather than choice?',
    tone: 'sage',
  },
  Gemini: {
    keyword: 'The open channel',
    through: 'gets curious, and wants to talk it over',
    you: 'get curious about six things at once',
    gifts:
      'seeing the connection nobody else spotted, explaining a hard thing simply, and staying interested in the world on days when that is the only thing holding you up',
    edge:
      'the six open tabs. Depth is not your enemy, but it is never the path of least resistance either, and something has to be chosen',
    needs:
      'new input, someone to think out loud at, and to not be made to sit still with one idea for a whole day',
    body: 'the lungs, the hands and the nervous system — the parts that get shallow and quick when the input does',
    care: 'Three breaths where the out-breath is longer than the in. That is the whole prescription.',
    ritual:
      'Write down the four things circling, on paper, and pick one. Gemini calms by emptying, not by concentrating.',
    question: 'Which of the things I am carrying is actually mine to think about?',
    tone: 'gold',
  },
  Cancer: {
    keyword: 'The held thing',
    through: 'feels it first and understands it afterwards',
    you: 'feel a thing before you understand it',
    gifts:
      'remembering what matters to people, making somewhere safe out of very little, and knowing what the room needs before anybody has said it',
    edge:
      'the shell. You will take care of everyone in the room and go home without having said the thing you needed, and then be quietly hurt that nobody asked',
    needs:
      'somewhere to come back to, and one person who does not need managing',
    body: 'the stomach and the chest — where feelings you have not admitted to go to be stored',
    care: 'A hand flat on your own chest for thirty seconds. It works, and it is free.',
    ritual:
      'Say the thing out loud to yourself, in the kitchen, before you say it to anyone. Cancer needs to hear it once in safety first.',
    question: 'What do I need today that I am waiting to be offered?',
    tone: 'twilight',
  },
  Leo: {
    keyword: 'The warm centre',
    through: 'wants to be seen doing it, and does it wholeheartedly',
    you: 'are at your best when you are warm, generous and a little theatrical',
    gifts:
      'generosity, warmth that other people can actually feel, and the nerve to be the first one visibly enthusiastic about something',
    edge:
      'the moment nobody notices. Your energy is genuinely tied to being met, and the work of a lifetime is learning to warm yourself on a day when the room is cold',
    needs:
      'to be seen, and to make something with your own name on it',
    body: 'the heart and the upper back — the parts that ache when you have been carrying the mood of a room',
    care: 'Stand up. Roll your shoulders back and down, and let your chest be open for one whole minute.',
    ritual:
      'Say one thing you did well today out loud, as a fact and not a boast. Leo runs on being witnessed, and you are allowed to be the witness.',
    question: 'Where am I dimming myself to keep a room comfortable?',
    tone: 'gold',
  },
  Virgo: {
    keyword: 'The fine attention',
    through: 'notices the details and wants to improve them',
    you: 'improve things by paying attention to the small ones',
    gifts:
      'making things actually work, catching the error at the point it is still cheap, and a form of care that shows up as usefulness rather than as words',
    edge:
      'the internal editor that never goes off shift. The standard you hold yourself to is one you would think cruel if a friend held it',
    needs:
      'order in one visible place, and something to be genuinely useful at',
    body: 'the gut — which is where an unfinished worry ends up when it is not written down',
    care: 'Eat something real, sitting down, without solving anything at the same time.',
    ritual:
      'Tidy one small surface completely. Virgo does not calm down by thinking; it calms down by finishing something small and true.',
    question: 'What would good enough actually look like here?',
    tone: 'sage',
  },
  Libra: {
    keyword: 'The even hand',
    through: 'weighs it, and wants it to be fair',
    you: 'look for the fair version of the answer',
    gifts:
      'seeing the other side honestly, defusing a room without lying to it, and making things beautiful because beauty is a real human need and not a decoration',
    edge:
      'the answer you gave to keep the peace. Deciding is the work, and the price of avoiding it is that other people end up deciding for you',
    needs:
      'beauty, company, and to not be forced into a decision before you have felt out both sides',
    body: 'the lower back and the kidneys — the middle of you, which is what takes the strain of being pulled two ways',
    care: 'Lie on the floor with your knees up for two minutes and let your lower back put itself down.',
    ritual:
      'Write the decision as a single sentence and answer it with one word. Libra gets free by narrowing, not by weighing more.',
    question: 'What do I want, before I consider what would be fair?',
    tone: 'rose',
  },
  Scorpio: {
    keyword: 'The deep water',
    through: 'goes all the way in, or not at all',
    you: 'go all the way in or not at all',
    gifts:
      'staying in the room for the hard conversation, seeing what is actually going on under what is being said, and loyalty of a kind most people only claim',
    edge:
      'the closed door. You will decide alone that someone has failed you and never tell them, and the certainty will feel exactly like evidence',
    needs:
      'the truth, privacy, and something to be intense about that is worthy of it',
    body: 'the pelvis and the deep core — where held tension lives longest and quietest',
    care: 'Let your belly be soft for one full out-breath. That is harder than it sounds and it is the whole exercise.',
    ritual:
      'Name the feeling in one plain word — not the story around it, the word. Scorpio drains by being named.',
    question: 'What am I holding on to that has already finished?',
    tone: 'twilight',
  },
  Sagittarius: {
    keyword: 'The far look',
    through: 'zooms out and wants the bigger version',
    you: 'want the bigger version of whatever this is',
    gifts:
      'hope that survives contact with facts, honesty delivered without cruelty, and the ability to make a bad month funny for everybody in it',
    edge:
      'the exit. When a thing gets small and detailed you leave, and some of what you have left was three boring weeks from being good',
    needs:
      'a horizon, movement, and something to believe is worth it',
    body: 'the hips and the thighs — the parts that stiffen when a life gets too small for them',
    care: 'Go outside and look at something further away than a screen. Ten minutes counts.',
    ritual:
      'Ask what this will matter to in a year, then do the next small thing anyway. Sagittarius needs the long view to tolerate the short one.',
    question: 'What am I calling freedom that is actually avoidance?',
    tone: 'gold',
  },
  Capricorn: {
    keyword: 'The long build',
    through: 'gets serious, and does the boring part properly',
    you: 'are willing to do the boring part because it works',
    gifts:
      'endurance, competence, and the rare ability to keep going at something for the years it takes rather than the weeks it is exciting',
    edge:
      'the goalposts. You move them the moment you arrive, and a life of that is a life in which nothing ever counts as enough',
    needs:
      'progress you can point at, and to be trusted with something real',
    body: 'the knees, the bones and the teeth — the structural parts, which is what a Capricorn overworks',
    care: 'Stop before you are finished, once, on purpose. Notice that nothing collapses.',
    ritual:
      'Write down what you actually completed this week. Capricorn keeps no record of its own progress and then wonders why it feels behind.',
    question: 'What would I do if I had already proved it?',
    tone: 'sage',
  },
  Aquarius: {
    keyword: 'The clear eye',
    through: 'steps back, and looks at it from outside',
    you: 'would rather be honest than agreeable',
    gifts:
      'seeing the system rather than the incident, refusing a consensus you do not believe, and caring about people in general in a way that actually changes things',
    edge:
      'the balcony. Watching your own life from a height is a wonderful analytic instrument and a poor way to be in it',
    needs:
      'room to be odd, and people who do not require you to be normal to be included',
    body: 'the ankles and the circulation — the parts that go cold when you have been up in your head for days',
    care: 'Warm your hands and feet. Detachment is a temperature as much as a mood.',
    ritual:
      'Tell one person one true thing about how you actually are. Aquarius comes down by being specific.',
    question: 'What am I explaining instead of feeling?',
    tone: 'twilight',
  },
  Pisces: {
    keyword: 'The open field',
    through: 'softens the edges and lets it in',
    you: 'dissolve the edges between things',
    gifts:
      'compassion that costs you something, imagination that arrives whole, and the ability to be with somebody in a bad hour without trying to fix it',
    edge:
      'the porous border. Other people’s weather comes in as though it were yours, and you will be halfway through a bad day that belongs to somebody else',
    needs:
      'rest that is not earned, water, music, and hours that nobody has claimed',
    body: 'the feet, and the lymph — the parts that ask for movement when everything has gone still',
    care: 'Feet in warm water, or bare on the floor. Pisces lands through the soles.',
    ritual:
      'Ask, once: is this mine? Pisces does not need to be harder, it needs a border it can find.',
    question: 'Which of these feelings did I walk into rather than have?',
    tone: 'twilight',
  },
}

/* ── The houses ──────────────────────────────────────────────── */

export interface House {
  /** 1–12. */
  number: number
  /** "First house". */
  name: string
  /** Two or three words. */
  keyword: string
  /** Completes "…in your fourth house, the part of life about ___". */
  domain: string
  /** A fuller sentence, for the portrait. */
  about: string
  /** What tending this area actually looks like. */
  care: string
}

export const HOUSES: House[] = [
  {
    number: 1,
    name: 'First house',
    keyword: 'The door',
    domain: 'how you arrive, and what people meet first',
    about:
      'The first house is the doorway: your body, your manner, the version of you that walks into a room before you have said anything. It is not a mask — it is the part of you that is closest to the surface.',
    care: 'Change something small and physical: how you stand, what you wear, how fast you walk in.',
  },
  {
    number: 2,
    name: 'Second house',
    keyword: 'What holds you',
    domain: 'what you own, what you value and what you are worth to yourself',
    about:
      'The second house is steadiness: money, possessions, resources, and underneath all of them the quieter question of what you believe you are worth without having to earn it again this week.',
    care: 'Name one thing you have that is enough. Self-worth is built out of noticing, not out of achieving.',
  },
  {
    number: 3,
    name: 'Third house',
    keyword: 'The near world',
    domain: 'talking, learning, siblings and the streets you know by heart',
    about:
      'The third house is the everyday mind: how you talk, how you learn, the messages and short journeys and neighbours and near-family that make up the texture of an ordinary week.',
    care: 'Say the thing to the person, in a sentence, today. Third-house tension is almost always an unsent message.',
  },
  {
    number: 4,
    name: 'Fourth house',
    keyword: 'The root',
    domain: 'home, family, and where you come from',
    about:
      'The fourth house is the foundation: home, family, ancestry, and the private inner room nobody else gets to inspect. What happens here is felt everywhere else and explained nowhere.',
    care: 'Make one corner of where you live actually yours. The roots need somewhere to be.',
  },
  {
    number: 5,
    name: 'Fifth house',
    keyword: 'The play',
    domain: 'joy, making things, romance and children',
    about:
      'The fifth house is what you do for no reason except that it is yours: creating, playing, flirting, performing, delighting. It is the least practical house and the one whose absence shows up fastest as a flat life.',
    care: 'Make something badly on purpose. The fifth house needs output, not quality.',
  },
  {
    number: 6,
    name: 'Sixth house',
    keyword: 'The daily work',
    domain: 'work, routine, health and the small repeated things',
    about:
      'The sixth house is the ordinary machinery: the job rather than the career, the routine, the body as a thing that has to be maintained. It is where a life is actually lived, one unremarkable day at a time.',
    care: 'Fix the smallest broken thing in your routine. This house rewards maintenance, not overhaul.',
  },
  {
    number: 7,
    name: 'Seventh house',
    keyword: 'The other',
    domain: 'partnership, close others and the people who meet you head-on',
    about:
      'The seventh house is one-to-one: partners, close collaborators, and the honest opponents who show you your own shape. Whatever you cannot see in yourself tends to arrive here wearing somebody else’s face.',
    care: 'Ask one person what they actually need from you, and listen to the whole answer.',
  },
  {
    number: 8,
    name: 'Eighth house',
    keyword: 'The deep end',
    domain: 'intimacy, what you share, and what changes you',
    about:
      'The eighth house is what happens when a boundary comes down: real intimacy, shared money, grief, and the transformations that were not chosen. It asks for trust and it does not accept the performance of it.',
    care: 'Let one person know one true thing you would ordinarily manage alone.',
  },
  {
    number: 9,
    name: 'Ninth house',
    keyword: 'The wider view',
    domain: 'meaning, travel, study and belief',
    about:
      'The ninth house is the search for a bigger frame: study, philosophy, faith, foreign places, and anything that returns you home with a different sense of proportion.',
    care: 'Learn something with no use whatsoever. Meaning is a nutrient, not a luxury.',
  },
  {
    number: 10,
    name: 'Tenth house',
    keyword: 'The visible life',
    domain: 'work in the world, reputation and what you are building',
    about:
      'The tenth house is the top of the chart: your public shape, your vocation, what strangers know you for. It is about contribution and it is also, unavoidably, about ambition.',
    care: 'Take one step that is visible to somebody else. This house does not count private effort.',
  },
  {
    number: 11,
    name: 'Eleventh house',
    keyword: 'The wider circle',
    domain: 'friends, communities and what you hope for',
    about:
      'The eleventh house is belonging on purpose: friendships, groups, movements, and the hopes that only stay alive because other people share them.',
    care: 'Message the friend you have been meaning to message for a month. That is the whole practice.',
  },
  {
    number: 12,
    name: 'Twelfth house',
    keyword: 'The quiet room',
    domain: 'rest, solitude, dreams and what runs underneath',
    about:
      'The twelfth house is behind the scenes: sleep, retreat, imagination, and the patterns that run without your consent until they are looked at. It is the least visible house and the one most people are most tired from ignoring.',
    care: 'Take an hour that nobody knows about and do nothing productive in it.',
  },
]

export function houseOf(number: number): House {
  return HOUSES[(((number - 1) % 12) + 12) % 12]
}

/** "fourth", for a sentence. */
export const ORDINALS = [
  'first',
  'second',
  'third',
  'fourth',
  'fifth',
  'sixth',
  'seventh',
  'eighth',
  'ninth',
  'tenth',
  'eleventh',
  'twelfth',
] as const

/* ── The planets, at length ──────────────────────────────────── */

export interface BodyLore {
  /** What this part of somebody is, in a full sentence. */
  about: string
  /** What it needs to be well. */
  needs: string
  /** What it looks like when it is running low. */
  low: string
  /** How it heals — used by the care screen. */
  heals: string
  /** What this body asks for while it is retrograde. Null for the lights. */
  retrograde: string | null
  /** A journal question about this part of a life. */
  question: string
  /**
   * One concrete thing to do on a day when this body is contacting the chart.
   *
   * Short enough to actually be done between reading it and lunch. The whole
   * reading is only worth anything if it ends in a verb somewhere.
   */
  today: string
  /** Which of the app's intents this body leans towards. */
  focus: FocusId
}

export const BODY_LORE: Record<Body, BodyLore> = {
  sun: {
    about:
      'Your Sun is the thing you are when nobody is managing you — the centre a life is organised around, and the part that has to be spent to be felt.',
    needs: 'something of your own, being seen doing it, and enough light to grow towards',
    low: 'going through the days competently with the lights off, and calling it fine',
    heals: 'by being expressed. The Sun does not recover through rest alone; it recovers through being used for something that matters to you.',
    retrograde: null,
    question: 'What did I do this week that was actually mine?',
    today: 'Do the visible version of it. Today pays for being seen doing the thing rather than preparing for it.',
    focus: 'confidence',
  },
  moon: {
    about:
      'Your Moon is what you need in order to feel safe — the private weather, the thing that soothes you, the part of you that was formed before you had words for any of it.',
    needs: 'rest, familiarity, and somebody who does not ask you to be impressive',
    low: 'a short fuse over nothing, and being hungry, tired or lonely three hours before noticing',
    heals: 'by being tended in small physical ways — food, warmth, water, sleep, and being allowed to feel the thing without having to justify it.',
    retrograde: null,
    question: 'What would actually comfort me right now, rather than distract me?',
    today: 'Ask what you need before you ask what needs doing. Then get one of the two.',
    focus: 'calm',
  },
  mercury: {
    about:
      'Your Mercury is how you think and how it comes out: the speed of it, the shape of it, whether you find the words at the time or an hour later on the stairs.',
    needs: 'input, a way to get thoughts out of your head, and someone to say them to',
    low: 'the same four thoughts on a loop, and every conversation happening twice — once out loud and once afterwards',
    heals: 'by getting it out of your head — written down, said aloud, or told to one person. It is a plumbing problem rather than a character problem.',
    retrograde:
      'a second look at something already begun. Not a warning about your emails — a stretch of weeks when going back over old ground is genuinely more productive than breaking new.',
    question: 'What have I been going over that would be finished if I said it out loud?',
    today: 'Send the message you have been drafting in your head for a week.',
    focus: 'school',
  },
  venus: {
    about:
      'Your Venus is what you love and how you want to be treated — taste, affection, pleasure, and the standard you hold for how it feels to be close to somebody.',
    needs: 'beauty, affection, and things that are pleasant for no productive reason',
    low: 'everything being useful and nothing being lovely, and a slow suspicion that you are hard to like',
    heals: 'through the senses and through being received: good food, music you love, a room you like being in, and one person who is glad you turned up.',
    retrograde:
      'a reconsideration of what you actually value, and of one relationship you have been describing rather than examining. Old faces tend to come back around; it is a review, not a verdict.',
    question: 'What do I love that I have not made any room for lately?',
    today: 'Make one thing nicer than it strictly needs to be — and let somebody be kind to you without deflecting it.',
    focus: 'self-worth',
  },
  mars: {
    about:
      'Your Mars is what you do about it: drive, appetite, temper, and the way you go after a thing once you have decided you want it.',
    needs: 'a target, something physical, and a legitimate outlet for anger',
    low: 'irritability with no object, and a tiredness that sleep does not touch',
    heals: 'by being spent. Mars is the one part of a person that gets better from effort — a walk taken hard, a job finished, an honest argument.',
    retrograde:
      'strategy over force. Pushing produces less than usual for a few weeks, and going back to finish something you abandoned produces more.',
    question: 'What am I angry about that I have not admitted is anger?',
    today: 'Spend the energy early and physically. Mars left unspent turns into an argument about something else.',
    focus: 'motivation',
  },
  jupiter: {
    about:
      'Your Jupiter is where you are allowed to want more — faith, generosity, appetite, and the parts of life that get bigger when you trust them.',
    needs: 'a horizon, room to grow, and something to believe is worth it',
    low: 'a life that has quietly narrowed to a corridor, and cynicism worn as realism',
    heals: 'by widening. More sky, more meaning, more people, more of whatever you have been rationing.',
    retrograde:
      'growth turned inward for a season. The expansion is real and it is happening privately — in what you believe rather than in what you are visibly building.',
    question: 'Where have I stopped expecting anything good, and is that actually accurate?',
    today: 'Say yes to the bigger version of one thing, before you have worked out how.',
    focus: 'growth',
  },
  saturn: {
    about:
      'Your Saturn is what you are building and what it costs — structure, discipline, limits, and the place where you are quietly certain you are not enough yet.',
    needs: 'time, realistic limits, and evidence that the effort is accumulating',
    low: 'the goalposts moving every time you reach them, and a tiredness that feels like a moral failure',
    heals: 'slowly, and by keeping small promises to yourself. Saturn does not respond to a good week; it responds to a hundred ordinary ones.',
    retrograde:
      'an audit rather than a punishment: which of your structures are load-bearing, and which are just old.',
    question: 'What am I still trying to prove, and to whom?',
    today: 'Do the boring, load-bearing task. It counts double on a day like this and nothing else will feel finished until it is done.',
    focus: 'discipline',
  },
  uranus: {
    about:
      'Your Uranus is the part of you that will not be managed — the sudden knowing, the refusal, the thing that breaks a routine before the routine breaks you.',
    needs: 'room, novelty, and the right to change your mind in public',
    low: 'restlessness that comes out sideways, and blowing up something small because something large cannot be said',
    heals: 'through deliberate change, chosen early. Uranus arrives anyway; the only question is whether you moved first.',
    retrograde:
      'the disruption happening on the inside for a while. What is loosening is a belief, not usually a circumstance.',
    question: 'What would I change today if nobody would be disappointed?',
    today: 'Change one thing on purpose, while it is still your choice which one.',
    focus: 'growth',
  },
  neptune: {
    about:
      'Your Neptune is what you imagine and what you would rather not see — longing, art, compassion, escape, and the fine border between the three.',
    needs: 'music, water, sleep, and hours that are not accounted for',
    low: 'fog, drift, and a slow leak of energy into things you would not choose if you were awake',
    heals: 'through beauty and rest, and through one clear-eyed question asked kindly: what am I not looking at?',
    retrograde:
      'the fog thinning. A season where something you have been idealising is seen at actual size — usually a relief, sometimes a grief, rarely a disaster.',
    question: 'Where am I hoping instead of deciding?',
    today: 'Make something or rest. Avoid decisions that need hard edges today; they will look different on Thursday.',
    focus: 'sleep',
  },
  pluto: {
    about:
      'Your Pluto is what changes whether you agree to it or not — depth, power, obsession, and the capacity to survive something and be different afterwards.',
    needs: 'the truth, and somewhere private to fall apart in',
    low: 'control where connection was wanted, and a grip so tight the thing cannot breathe',
    heals: 'by letting something end properly. Pluto’s medicine is always subtraction first.',
    retrograde:
      'the pressure turning inward. The thing being transformed for these months is your own relationship to control, not the situation.',
    question: 'What is already over that I have not agreed to yet?',
    today: 'Let one thing end properly instead of managing it for another month.',
    focus: 'resilience',
  },
  node: {
    about:
      'Your North Node is the direction that feels unfamiliar and is correct — not a talent, a heading. It is what you are here to get worse at before you get better at it.',
    needs: 'a first attempt, and tolerance for being a beginner in public',
    low: 'doing the easy competent thing for years and wondering why it feels like standing still',
    heals: 'by being walked towards. This one does not resolve through insight; it resolves through the slightly wrong-feeling next step.',
    retrograde: null,
    question: 'What is the version of this that I would find slightly embarrassing to try?',
    today: 'Take the step that feels slightly wrong because it is unfamiliar rather than because it is a mistake.',
    focus: 'growth',
  },
}

/* ── The elements, as care ───────────────────────────────────── */

export interface ElementCare {
  /** What this element is like when it is running high in the sky or a chart. */
  weather: string
  /** Which of the app's breath presets suits it. See `lib/breathing`. */
  breath: string
  /** Why that one. */
  breathWhy: string
  movement: string
  nourish: string
  sensory: string
  /** Too much of this element, in a person's day. */
  excess: string
  /** Not enough of it. */
  lack: string
}

export const ELEMENT_CARE: Record<Element, ElementCare> = {
  fire: {
    weather:
      'Fire days run hot and fast. There is more available than usual and it does not keep — spent, it is energy; hoarded, it is agitation.',
    breath: 'clear',
    breathWhy: 'quick and even, to meet the energy rather than fight it',
    movement: 'Something brisk and short. Ten minutes hard beats an hour half-hearted today.',
    nourish: 'Cooling and watery — fruit, cucumber, plenty of actual water. Fire dries you out.',
    sensory: 'Sunlight on your face for five minutes, deliberately.',
    excess: 'burning through the day and arriving at the evening unable to sit down',
    lack: 'flatness, and everything needing more push than it should',
  },
  earth: {
    weather:
      'Earth days are slow and solid. Nothing wants to be rushed and nearly everything wants to be finished.',
    breath: 'coherent',
    breathWhy: 'even in and out, at the pace the body settles into on its own',
    movement: 'A walk, unhurried, ideally where there are trees. Earth wants duration, not intensity.',
    nourish: 'Something cooked, warm and eaten sitting down. Earth days punish a snatched lunch.',
    sensory: 'Bare feet on the floor, or hands in soil, for one minute.',
    excess: 'stuckness dressed up as patience',
    lack: 'floating through the day and landing nowhere',
  },
  air: {
    weather:
      'Air days are quick and talkative. The thinking is fast and the body is easily forgotten underneath it.',
    breath: 'sigh',
    breathWhy: 'a long out-breath, because air days speed the nervous system up before you notice',
    movement: 'Anything that gets you breathing deeper — stairs, a hill, a brisk twenty minutes.',
    nourish: 'Warm and grounding. Air days want soup rather than salad.',
    sensory: 'Take your hands off the keyboard and warm them. Air runs cold at the edges.',
    excess: 'six conversations and no rest, and a mind still going at midnight',
    lack: 'a stuffiness in the thinking, where nothing new is getting in',
  },
  water: {
    weather:
      'Water days are deep and permeable. Feeling arrives at full volume and other people’s moods come in as if they were yours.',
    breath: 'unwind',
    breathWhy: 'a held breath and a long release, which is what a flooded system asks for',
    movement: 'Slow and fluid — stretching, swimming, or simply lying down and letting the day drain.',
    nourish: 'Warm, salty, simple. And more water than you think, which is not a metaphor.',
    sensory: 'Warm water on your hands or feet. Water days land through water.',
    excess: 'carrying a mood that was never yours to begin with',
    lack: 'competence with the feeling switched off, which is fine for a day and expensive for a week',
  },
}

export const MODALITY_NOTE: Record<Modality, string> = {
  cardinal:
    'Cardinal: you start things. Beginnings come easily and the work is in the middle of them.',
  fixed:
    'Fixed: you hold. Once you are in, you stay — which is loyalty when it is chosen and a rut when it is not.',
  mutable:
    'Mutable: you adapt. You will bend around what a situation needs, and the practice is noticing when you have bent past your own shape.',
}

/* ── The Moon's eight faces ──────────────────────────────────── */

export interface PhaseLore {
  /** What this stretch of the month is for. */
  is: string
  /** One thing that goes well now. */
  doThis: string
  /** What rest looks like here. */
  rest: string
  /** A journal prompt for the phase. */
  question: string
  /** How much of the month has passed, roughly, for the ring. */
  share: number
}

export const PHASE_LORE: Record<string, PhaseLore> = {
  'New Moon': {
    is: 'The dark of the month: nothing is visible yet, which is exactly why it is the easiest point to start something without an audience.',
    doThis: 'Name one thing you want out of the next four weeks. One, written down, small enough to be true.',
    rest: 'Sleep early if you can. Energy is genuinely at its lowest here and pushing through it costs more than it wins.',
    question: 'If this month went well, what would be different by the full moon?',
    share: 0,
  },
  'Waxing Crescent': {
    is: 'The first light: the intention exists and is still fragile. This is where things get abandoned, and where keeping going is the entire skill.',
    doThis: 'Do the smallest possible version of the thing today, so it survives to next week.',
    rest: 'Short and often. The energy is returning but it is not back yet.',
    question: 'What is the smallest step that would still count?',
    share: 0.125,
  },
  'First Quarter': {
    is: 'The half-lit push: the first real resistance shows up here, and it is not a sign you were wrong. It is the shape of the work.',
    doThis: 'Push once, properly, at the thing that has stalled.',
    rest: 'Earn it after the effort rather than before. This is the phase that responds to being spent.',
    question: 'What is actually in the way — and is it an obstacle or a decision I have not made?',
    share: 0.25,
  },
  'Waxing Gibbous': {
    is: 'Nearly full: the refining stretch, where a thing is close enough to see and not finished. Impatience peaks here.',
    doThis: 'Adjust rather than restart. Everything is closer than it feels.',
    rest: 'Guard your sleep — this is where a good month gets spent on a bad night.',
    question: 'What needs adjusting, and what needs leaving alone?',
    share: 0.375,
  },
  'Full Moon': {
    is: 'Everything lit at once: the most visible, most feeling-heavy point in the month. Things come to a head here, and that is the function rather than a fault.',
    doThis: 'Let yourself see it clearly and say it out loud. Full moons reward honesty and punish pretending.',
    rest: 'Wind down earlier and darker than usual. Sleep is famously thin here, and it is worth planning around.',
    question: 'What has come to the surface that I already knew?',
    share: 0.5,
  },
  'Waning Gibbous': {
    is: 'The first letting-out breath of the month: what was learned at the full moon becomes something you can say.',
    doThis: 'Tell somebody. Share the thing, teach the thing, or write it down properly.',
    rest: 'Easier now. Take the softer evening — the month is on its way down.',
    question: 'What did that show me, and who is it worth telling?',
    share: 0.625,
  },
  'Last Quarter': {
    is: 'The turn towards clearing: the half-light on the other side, where the honest question is what to stop.',
    doThis: 'End one thing. Cancel it, finish it, or admit it is over.',
    rest: 'Long and unstructured. This is a good week for a genuinely empty evening.',
    question: 'What am I carrying into the next month that does not need to come?',
    share: 0.75,
  },
  'Waning Crescent': {
    is: 'The last thin light before the dark: the lowest and quietest stretch, and the one most people try to work straight through.',
    doThis: 'As little as you can arrange. Tidy, close tabs, sleep.',
    rest: 'This is the rest phase of the month. Take it and the next new moon starts from a different place.',
    question: 'What would I like to have put down before this starts again?',
    share: 0.875,
  },
}

export function phaseLore(name: string): PhaseLore {
  return PHASE_LORE[name] ?? PHASE_LORE['New Moon']
}

/* ── Aspects, as instructions ────────────────────────────────── */

export interface AspectLore {
  /** How to actually use this contact. */
  use: string
  /** What it costs if it is ignored — never a warning, always a cost. */
  cost: string
}

export const ASPECT_LORE: Record<AspectId, AspectLore> = {
  conjunction: {
    use: 'Put the two together deliberately rather than letting them merge on their own. Whatever this is, today it is loud, and loud things are easiest to aim.',
    cost: 'Being inside it without noticing, and mistaking the intensity for a fact about the world.',
  },
  opposition: {
    use: 'Let both sides be true and look for the version that includes them. Oppositions resolve by widening, never by winning.',
    cost: 'Picking a side too early and spending the week arguing with the half of yourself you left behind.',
  },
  trine: {
    use: 'Spend it. This is the one kind of contact that asks nothing of you and is therefore the easiest to waste entirely.',
    cost: 'A pleasant day that leaves nothing behind.',
  },
  square: {
    use: 'Do the thing that the friction is pointing at. Squares are the engine of a chart: they are where something actually has to move.',
    cost: 'Grinding against it and calling that effort.',
  },
  sextile: {
    use: 'Take it up. A sextile is an open door that does not knock — nothing happens unless you walk through it.',
    cost: 'Nothing at all, which is exactly the problem with it.',
  },
  quincunx: {
    use: 'Adjust. Two parts of life that do not naturally fit are asking for a small ongoing accommodation rather than a grand solution.',
    cost: 'Forcing a fit and being tired for reasons that never quite get named.',
  },
}
