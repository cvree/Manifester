/**
 * The writing help behind "Add to my words" and "Improve my words".
 *
 * Both run here, in the page, on plain string rules. There is no model and no
 * request, which is what makes this the default rather than the fallback: it
 * works in flight mode, costs nothing, needs no account, and sends nothing
 * anywhere.
 *
 * An AI can be connected instead — see `./ai/` — and it is genuinely better at
 * this. But it needs somebody's API key and it posts the draft to a company,
 * so it is opt-in, and this engine stays the floor underneath it: whenever the
 * network, the key, or the provider gives out, the buttons still work.
 *
 * What it does carry is the shape the affirmation literature keeps arriving at:
 * present tense, first person, the thing you want rather than the thing you are
 * avoiding, and a felt sense attached to it. Wanting language ("I want to be
 * calm") states the gap; the present tense states the self. Negations are worse
 * than useless out loud, because the mind has to picture the thing before it
 * can picture its absence.
 *
 * The rules are deliberately timid. Anything the tables below do not recognise
 * is left exactly as it was written — mangling somebody's words is far worse
 * than leaving them plain — and every result is one tap from Undo either way.
 */

export interface WordcraftResult {
  text: string
  /** One sentence describing what happened, shown under the buttons. */
  note: string
  /** False when the text came back untouched, so the UI can say so kindly. */
  changed: boolean
}

/* ────────────────────────────── Improve ────────────────────────────── */

/**
 * Why a line moved. Only used to write the note, but keeping it on every rule
 * is what stops the note from claiming work the rules did not actually do.
 */
type Reason = 'present' | 'positive' | 'certainty' | 'person' | 'felt' | 'speech'

/** Read out in this order, so the note leads with the biggest change. */
const REASON_ORDER: Reason[] = [
  'present',
  'positive',
  'certainty',
  'person',
  'felt',
  'speech',
]

const REASON_TEXT: Record<Reason, string> = {
  present: 'in the present tense',
  positive: 'about what you want rather than what you are avoiding',
  certainty: 'certain instead of hoping',
  person: 'in your own voice',
  felt: 'something you can feel',
  speech: 'easier for a voice to say',
}

interface Rule {
  reason: Reason
  /** Global, except for the `^`-anchored ones, where a single hit is the point. */
  pattern: RegExp
  replace: string | ((match: string, ...groups: string[]) => string)
}

/**
 * Spoken affirmations read better expanded — "I am enough" lands where "I'm
 * enough" skips past — and every later rule can then match one spelling
 * instead of two.
 */
const SPEECH_RULES: Rule[] = [
  { reason: 'speech', pattern: /\bgonna\b/gi, replace: 'going to' },
  { reason: 'speech', pattern: /\bwanna\b/gi, replace: 'want to' },
  { reason: 'speech', pattern: /\bI'm\b/gi, replace: 'I am' },
  // Lowercase only: "im" is a typed "I'm" far more often than it is a word.
  { reason: 'speech', pattern: /\bim\b/g, replace: 'I am' },
  { reason: 'speech', pattern: /\bI've\b/gi, replace: 'I have' },
  { reason: 'speech', pattern: /\bI'll\b/gi, replace: 'I will' },
  { reason: 'speech', pattern: /\byou're\b/gi, replace: 'you are' },
  { reason: 'speech', pattern: /\bdon't\b/gi, replace: 'do not' },
  { reason: 'speech', pattern: /\bdoesn't\b/gi, replace: 'does not' },
  { reason: 'speech', pattern: /\bdidn't\b/gi, replace: 'did not' },
  { reason: 'speech', pattern: /\bcan't\b/gi, replace: 'cannot' },
  { reason: 'speech', pattern: /\bwon't\b/gi, replace: 'will not' },
  { reason: 'speech', pattern: /\bisn't\b/gi, replace: 'is not' },
  { reason: 'speech', pattern: /\baren't\b/gi, replace: 'are not' },
  { reason: 'speech', pattern: /\bwasn't\b/gi, replace: 'was not' },
  { reason: 'speech', pattern: /\bshouldn't\b/gi, replace: 'should not' },
  // A lone lowercase "i" is a typo everywhere in English, and the speech
  // engine pronounces it as a letter if it is left alone.
  { reason: 'speech', pattern: /\bi\b/g, replace: 'I' },
]

/**
 * An affirmation is a sentence about yourself, so it is spoken by you and
 * about you. Second person and bare imperatives both get turned around.
 */
const PERSON_RULES: Rule[] = [
  { reason: 'person', pattern: /\byou are\b/gi, replace: 'I am' },
  { reason: 'person', pattern: /\byou will be\b/gi, replace: 'I am' },
  { reason: 'person', pattern: /\byou will\b/gi, replace: 'I' },
  { reason: 'person', pattern: /\byou can\b/gi, replace: 'I can' },
  { reason: 'person', pattern: /\byou have\b/gi, replace: 'I have' },
  { reason: 'person', pattern: /\byou deserve\b/gi, replace: 'I deserve' },
  { reason: 'person', pattern: /\bthan you\b/gi, replace: 'than I' },
  { reason: 'person', pattern: /\byourself\b/gi, replace: 'myself' },
  { reason: 'person', pattern: /\byour\b/gi, replace: 'my' },
  // "Be kind to myself" → "I am kind to myself". Only at the start of a line,
  // where the imperative is unambiguous.
  { reason: 'person', pattern: /^be\b/i, replace: 'I am' },
  { reason: 'person', pattern: /^stay\b/i, replace: 'I stay' },
  { reason: 'person', pattern: /^feel\b/i, replace: 'I feel' },
  { reason: 'person', pattern: /^become\b/i, replace: 'I am becoming' },
  { reason: 'person', pattern: /^remember that\b/i, replace: 'I remember that' },
  { reason: 'person', pattern: /^trust\b/i, replace: 'I trust' },
]

/**
 * What each avoided word becomes when it is turned the right way round.
 *
 * Keys are only ever things people say about themselves, and every value has
 * to be something that is true the moment it is said — "I am healing at my own
 * pace", never "I am healed". Nothing here makes a claim about the future or
 * about anybody's health.
 *
 * Two shapes are load-bearing. Every value has to read after "I am", because
 * that is the only frame the rules emit; and no value may contain a comma,
 * because a match is often followed by the rest of the sentence and
 * "I am enough, exactly as I am for anyone" is worse than what it replaced.
 */
const OPPOSITES: Record<string, string> = {
  'good enough': 'enough',
  'too much': 'exactly enough',
  'a failure': 'learning and growing',
  'a burden': 'welcome exactly as I am',
  'a mess': 'a work in progress',
  afraid: 'brave',
  alone: 'held',
  angry: 'at peace',
  anxious: 'calm',
  ashamed: 'kind to myself',
  awkward: 'at ease around people',
  behind: 'right on time',
  broke: 'open to receiving more',
  broken: 'whole',
  confused: 'clear',
  damaged: 'whole',
  doubtful: 'sure of myself',
  dumb: 'capable',
  enough: 'enough',
  exhausted: 'allowed to rest',
  failing: 'learning and growing',
  fearful: 'brave',
  guilty: 'kind to myself',
  helpless: 'resourceful',
  hopeless: 'hopeful',
  ignored: 'heard',
  insecure: 'sure of myself',
  invisible: 'seen',
  jealous: 'glad for what is mine',
  late: 'right on time',
  lazy: 'allowed to move at my own pace',
  lonely: 'connected',
  lost: 'finding my way',
  needy: 'secure in myself',
  nervous: 'steady',
  overwhelmed: 'steady',
  powerless: 'capable',
  sad: 'gentle with myself',
  scared: 'safe',
  shy: 'comfortable speaking up',
  stressed: 'at ease',
  stuck: 'moving forward',
  stupid: 'capable',
  tired: 'allowed to rest',
  trapped: 'free',
  ugly: 'beautiful',
  unlovable: 'deeply lovable',
  unwanted: 'wanted',
  unworthy: 'worthy',
  useless: 'useful',
  weak: 'strong',
  worried: 'at ease',
  worthless: 'worthy',
}

/**
 * Longest first, so "good enough" is matched before the "enough" inside it.
 * Every key is plain letters and spaces, so none of them needs escaping.
 */
const OPPOSITE_PATTERN = Object.keys(OPPOSITES)
  .sort((a, b) => b.length - a.length)
  .join('|')

/**
 * Whatever a person piles up in front of the feeling itself. Repeated, so
 * "always so nervous" is reached; and the regex backtracks out of it whenever
 * the feeling turns out to start with one of these words, which is how
 * "I am not too much" still finds "too much" rather than stopping at "much".
 */
const HEDGE = String.raw`(?:a |an |so |too |that |very |really |always |often |just |quite |such a |like a |like an |like )*`

/**
 * The ways people write about a feeling they do not want.
 *
 * Every frame resolves to "I am …", never "I feel …": the table's values are
 * written to follow "I am", and a single frame means one thing to keep
 * grammatical instead of two. Whatever came after the feeling is kept, so
 * "I am not anxious about Monday" becomes "I am calm about Monday" rather
 * than losing its subject.
 */
const NEGATION_FRAMES: string[] = [
  String.raw`I am not`,
  String.raw`I am no longer`,
  String.raw`I will not be`,
  String.raw`I refuse to be`,
  String.raw`I am done (?:being|feeling)`,
  String.raw`I am tired of (?:being|feeling)`,
  String.raw`I hate (?:being|feeling)`,
  // The auxiliary is optional because the tense pass may already have removed
  // it ("I will stop being") or swapped it ("I need to" → "I choose to").
  String.raw`I (?:choose to |get to |can |could |will |am going to )?stop (?:being|feeling)`,
  String.raw`I do not have to (?:be|feel)`,
  String.raw`I do not want to (?:be|feel)`,
  String.raw`I do not (?:feel|get)`,
]

/**
 * The plainer failure: a line that simply asserts the unwanted state. "I am
 * always so nervous before meetings" is not an affirmation of anything you
 * want, and it is the single most common thing people type into a box like
 * this one.
 *
 * The trailing lookahead is a guard, not a nicety — without it "I am tired of
 * my job" turns into "I am allowed to rest of my job".
 */
const PLAIN_NEGATIVE = new RegExp(
  `\\bI (?:always |often |sometimes |usually |constantly )?(?:am|feel|get) ${HEDGE}(${OPPOSITE_PATTERN})\\b(?! of\\b)`,
  'gi',
)

const POSITIVE_RULES: Rule[] = [
  ...NEGATION_FRAMES.map((frame) => ({
    reason: 'positive' as const,
    pattern: new RegExp(`\\b${frame} ${HEDGE}(${OPPOSITE_PATTERN})\\b`, 'gi'),
    replace: (_match: string, word: string) => `I am ${OPPOSITES[word.toLowerCase()]}`,
  })),
  {
    reason: 'positive' as const,
    pattern: PLAIN_NEGATIVE,
    replace: (_match: string, word: string) => `I am ${OPPOSITES[word.toLowerCase()]}`,
  },
]

/**
 * Wanting, hoping and trying all describe the distance to a thing. These trade
 * that distance for a decision, which is the one edit that changes how a line
 * feels to say out loud.
 *
 * Order matters: the longer frame has to run before the shorter one it
 * contains, or "I want to be calm" loses its "to be".
 */
const CERTAINTY_RULES: Rule[] = [
  // Fillers go first, so the anchored rule below still sees the line it was
  // written for: "maybe someday I …" has to lose the "maybe" before "someday"
  // is at the start of anything.
  { reason: 'certainty', pattern: /\b(?:maybe|perhaps|hopefully),?\s+/gi, replace: '' },
  { reason: 'certainty', pattern: /^(?:someday|one day|eventually|soon),?\s+/i, replace: '' },
  { reason: 'certainty', pattern: /\b(?:kind of|sort of|a little bit)\s+/gi, replace: '' },
  // "I really want" is still wanting. Drop the intensifier so the frames
  // below match the sentence people actually typed.
  {
    reason: 'certainty',
    pattern: /\bI (?:really|just|so|truly|desperately) (want|hope|need|wish)\b/gi,
    replace: 'I $1',
  },
  { reason: 'certainty', pattern: /\bI wish (?:that )?I (?:was|were)\b/gi, replace: 'I am' },
  { reason: 'certainty', pattern: /\bI wish (?:that )?I could\b/gi, replace: 'I can' },
  { reason: 'certainty', pattern: /\bI wish (?:that )?I had\b/gi, replace: 'I have' },
  { reason: 'certainty', pattern: /\bI want to be\b/gi, replace: 'I am' },
  { reason: 'certainty', pattern: /\bI want to feel\b/gi, replace: 'I feel' },
  { reason: 'certainty', pattern: /\bI want to have\b/gi, replace: 'I have' },
  { reason: 'certainty', pattern: /\bI want to\b/gi, replace: 'I' },
  { reason: 'certainty', pattern: /\bI want\b/gi, replace: 'I welcome' },
  { reason: 'certainty', pattern: /\bI hope to be\b/gi, replace: 'I am' },
  { reason: 'certainty', pattern: /\bI hope to\b/gi, replace: 'I' },
  { reason: 'certainty', pattern: /\bI hope (?:that )?I am\b/gi, replace: 'I am' },
  { reason: 'certainty', pattern: /\bI hope (?:that )?I\b/gi, replace: 'I' },
  { reason: 'certainty', pattern: /\bI am trying to be\b/gi, replace: 'I am' },
  // Not "I do it" — learning is the honest present tense of trying, and it is
  // still a statement about who you are now.
  { reason: 'certainty', pattern: /\bI am trying to\b/gi, replace: 'I am learning to' },
  { reason: 'certainty', pattern: /\bI need to be\b/gi, replace: 'I am' },
  { reason: 'certainty', pattern: /\bI need to\b/gi, replace: 'I choose to' },
  { reason: 'certainty', pattern: /\bI should be\b/gi, replace: 'I am' },
  { reason: 'certainty', pattern: /\bI should\b/gi, replace: 'I choose to' },
  { reason: 'certainty', pattern: /\bI have to\b/gi, replace: 'I get to' },
  { reason: 'certainty', pattern: /\bI think (?:that )?I am\b/gi, replace: 'I am' },
  { reason: 'certainty', pattern: /\bI think (?:that )?I\b/gi, replace: 'I' },
  { reason: 'certainty', pattern: /\bI guess (?:that )?I am\b/gi, replace: 'I am' },
  { reason: 'certainty', pattern: /\bI guess (?:that )?I\b/gi, replace: 'I' },
  { reason: 'certainty', pattern: /\bI feel like I am\b/gi, replace: 'I am' },
  { reason: 'certainty', pattern: /\bI feel like I\b/gi, replace: 'I' },
  // A leftover "just" shrinks whatever follows it.
  { reason: 'certainty', pattern: /\bI just\b/gi, replace: 'I' },
  { reason: 'certainty', pattern: /\b(can|choose to|get to) just\b/gi, replace: '$1' },
]

/**
 * The future tense keeps the sentence permanently ahead of you. Each of these
 * declines to be, and every one carries a lookahead so a negation that the
 * positive pass could not resolve is left whole rather than beheaded — without
 * it, "I will not be defeated" would come out as "I not be defeated".
 */
const PRESENT_RULES: Rule[] = [
  { reason: 'present', pattern: /\bI am going to be\b/gi, replace: 'I am' },
  { reason: 'present', pattern: /\bI am going to have\b/gi, replace: 'I have' },
  { reason: 'present', pattern: /\bI am going to\b(?! not\b)/gi, replace: 'I' },
  { reason: 'present', pattern: /\bI will be\b/gi, replace: 'I am' },
  { reason: 'present', pattern: /\bI will have\b/gi, replace: 'I have' },
  { reason: 'present', pattern: /\bI will feel\b/gi, replace: 'I feel' },
  { reason: 'present', pattern: /\bI will\b(?! not\b)/gi, replace: 'I' },
  { reason: 'present', pattern: /\bI can be\b/gi, replace: 'I am' },
  { reason: 'present', pattern: /\bI am starting to be\b/gi, replace: 'I am' },
]

/**
 * Applied top to bottom; every stage sees what the one above it produced.
 *
 * The positive pass runs twice on purpose. Before the tense rules it catches
 * lines as they were typed; after them it catches what those rules uncovered,
 * because "I will stop being awkward" only reveals a frame the table knows
 * once the "will" has gone.
 */
const RULES: Rule[] = [
  ...SPEECH_RULES,
  ...PERSON_RULES,
  ...POSITIVE_RULES,
  ...CERTAINTY_RULES,
  ...PRESENT_RULES,
  ...POSITIVE_RULES,
]

/**
 * A felt sense, tacked on. An affirmation you can locate in your body outlasts
 * one you only read, which is why this exists — but it is also the single most
 * annoying thing the helper can do, so it is strictly rationed below.
 */
const FELT_CLAUSES = [
  'and I feel it settle in my body',
  'and it feels steady and true',
  'and my body already knows it',
  'and I let that be enough',
  'and I feel a little lighter saying it',
]

const FELT_PATTERN = new RegExp(`,\\s*(?:${FELT_CLAUSES.join('|')})[.!?]?$`, 'i')

/**
 * At most two per pass, and never more than one line in three — which means a
 * draft of one or two lines gets none at all. On a short draft the clause is
 * not a flourish, it is most of what you wrote.
 */
function feltBudget(lineCount: number): number {
  return Math.min(2, Math.floor(lineCount / 3))
}

/** Stable across runs, so the same line always picks the same clause. */
function hash(value: string): number {
  let total = 0
  for (let index = 0; index < value.length; index += 1) {
    total = (total * 31 + value.charCodeAt(index)) >>> 0
  }
  return total
}

function polish(line: string): string {
  const tidied = line
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim()
  if (!tidied) return ''
  const capitalised = tidied.charAt(0).toUpperCase() + tidied.slice(1)
  return /[.!?…]$/.test(capitalised) ? capitalised : `${capitalised}.`
}

/**
 * Words that mean the line is already a sentence, so it must not be wrapped as
 * a fragment. A jotted "inner peace" becomes an affirmation; "the sun is out"
 * is left alone.
 */
const SENTENCE_WORDS = new Set([
  'a', 'am', 'an', 'and', 'are', 'be', 'but', 'did', 'do', 'does', 'has',
  'have', 'i', 'is', 'it', 'my', 'no', 'not', 'or', 'the', 'to', 'was', 'were',
  'yes',
])

function isFragment(line: string): boolean {
  const words = line.replace(/[.!?]+$/, '').split(/\s+/)
  if (words.length === 0 || words.length > 3) return false
  return words.every(
    (word) => /^[a-z-]+$/i.test(word) && !SENTENCE_WORDS.has(word.toLowerCase()),
  )
}

function improveLine(line: string, reasons: Set<Reason>): string {
  let out = line
  let turned = false

  for (const rule of RULES) {
    const before = out
    out =
      typeof rule.replace === 'string'
        ? out.replace(rule.pattern, rule.replace)
        : out.replace(rule.pattern, rule.replace)
    if (out !== before) {
      reasons.add(rule.reason)
      if (rule.reason === 'positive') turned = true
    }
  }

  // "Anymore" is the tail of a negation. Once the negation it belonged to has
  // been turned around, the word is left dangling on the end of a sentence
  // that no longer denies anything — "I am learning and growing anymore".
  if (turned && !/\b(?:not|never|cannot|no longer)\b/i.test(out)) {
    out = out.replace(/,?\s+any\s?more\b/gi, '')
  }

  // A bare noun — "confidence", "calm mornings" — is a note to self rather
  // than an affirmation. Give it a subject and it becomes one.
  if (isFragment(out)) {
    out = `I welcome more ${out.replace(/[.!?]+$/, '').toLowerCase()}`
    reasons.add('person')
  }

  return polish(out)
}

/**
 * Rewrite a draft in place: present tense, first person, no avoided things,
 * and a felt sense on a line or two.
 *
 * Blank lines survive, because they are how people separate verses, and the
 * whole thing is idempotent — running it twice returns the same text, so
 * tapping the button again out of curiosity costs nothing.
 */
export function improveWords(text: string): WordcraftResult {
  const source = text.replace(/\r\n/g, '\n')
  const rows = source.split('\n')
  const reasons = new Set<Reason>()

  const improved = rows.map((row) => {
    const trimmed = row.trim()
    return trimmed ? improveLine(trimmed, reasons) : ''
  })

  // The felt-sense pass runs after the rewrite, over the finished lines, so it
  // can count what is already there and stay inside its budget on every press.
  const filled = improved.filter(Boolean)
  const alreadyFelt = filled.filter((line) => FELT_PATTERN.test(line)).length
  let remaining = Math.max(0, feltBudget(filled.length) - alreadyFelt)

  const final = improved.map((line) => {
    if (remaining === 0 || !line) return line
    const words = line.split(/\s+/).length
    const eligible =
      words <= 8 && !line.includes(',') && /\b(?:I|my)\b/.test(line) && line.endsWith('.')
    if (!eligible) return line
    remaining -= 1
    reasons.add('felt')
    const clause = FELT_CLAUSES[hash(line) % FELT_CLAUSES.length]
    return `${line.slice(0, -1)}, ${clause}.`
  })

  const result = final.join('\n').replace(/\n{3,}/g, '\n\n').trim()
  // Counted once per line, however many rules landed on it — the note reports
  // lines the reader will see move, not edits the engine made.
  const touched = final.filter((line, index) => line && line !== rows[index].trim())
    .length

  if (result === source.trim() || touched === 0) {
    return {
      text: source,
      note: 'These already read as present, positive and yours.',
      changed: false,
    }
  }

  const lineWord = touched === 1 ? 'line' : 'lines'
  const said = REASON_ORDER.filter((reason) => reasons.has(reason)).slice(0, 2)
  const note = said.length
    ? `Reshaped ${touched} ${lineWord} — ${said.map((reason) => REASON_TEXT[reason]).join(', and ')}.`
    : `Tidied ${touched} ${lineWord}.`

  return { text: result, note, changed: true }
}

/* ──────────────────────────────── Add ──────────────────────────────── */

interface Theme {
  id: string
  /** Reads inside "Added three lines about …". */
  label: string
  keywords: string[]
  lines: string[]
}

/**
 * What the draft is reaching for, and what else belongs beside it.
 *
 * Every line is present tense and first person already, so a draft built
 * entirely out of these needs no improving; and none of them promises an
 * outcome, because that is not what this app is for.
 */
const THEMES: Theme[] = [
  {
    id: 'calm',
    label: 'steadiness',
    keywords: [
      'anxious', 'anxiety', 'calm', 'panic', 'worry', 'worried', 'stress',
      'stressed', 'overwhelm', 'overwhelmed', 'nervous', 'breathe', 'breath',
      'peace', 'peaceful', 'quiet', 'still', 'ease', 'tense', 'racing',
    ],
    lines: [
      'My breath is slow, and my body is following it.',
      'I am safe in this moment, and this moment is enough.',
      'I let my shoulders drop and my jaw soften.',
      'I can feel calm and still have things to do.',
      'I return to my breath as many times as I need to.',
      'I am steady, even when the day around me is not.',
      'This moment asks nothing of me but breathing.',
    ],
  },
  {
    id: 'confidence',
    label: 'self-trust',
    keywords: [
      'confident', 'confidence', 'worth', 'worthy', 'deserve', 'enough',
      'proud', 'doubt', 'insecure', 'believe', 'capable', 'strong', 'brave',
      'courage', 'esteem', 'myself',
    ],
    lines: [
      'I am enough, exactly as I am today.',
      'I trust the way I see things.',
      'I take up my full space, and I have every right to it.',
      'I speak clearly and kindly, and my voice carries.',
      'I am proud of how far I have already come.',
      'I am allowed to want what I want.',
      'My worth was never something I had to earn.',
    ],
  },
  {
    id: 'body',
    label: 'your body',
    keywords: [
      'body', 'health', 'healthy', 'energy', 'strength', 'skin', 'weight',
      'food', 'eat', 'eating', 'exercise', 'run', 'running', 'gym', 'movement',
      'walk', 'stretch',
    ],
    lines: [
      'I treat my body like someone I love.',
      'I move today in a way that feels good.',
      'I give my body rest, water and kindness.',
      'I am at home in my body.',
      'I listen to what my body is telling me.',
      'My body carries me through every day, and I thank it.',
    ],
  },
  {
    id: 'love',
    label: 'the people you love',
    keywords: [
      'love', 'loved', 'partner', 'relationship', 'heart', 'connection',
      'lonely', 'alone', 'friend', 'friends', 'family', 'dating', 'marriage',
      'husband', 'wife', 'girlfriend', 'boyfriend', 'together',
    ],
    lines: [
      'I am easy to love, and I let myself be loved.',
      'I give the kind of love I would like to receive.',
      'I let people see the real version of me.',
      'I am surrounded by people who are glad I exist.',
      'I choose people who are gentle with me.',
      'My heart is open, and it is also looked after.',
    ],
  },
  {
    id: 'abundance',
    label: 'openness to good things',
    keywords: [
      'money', 'abundance', 'abundant', 'wealth', 'rich', 'income', 'bills',
      'savings', 'prosperity', 'receive', 'opportunity', 'opportunities',
      'financial', 'afford', 'enough money',
    ],
    lines: [
      'I am open to receiving good things.',
      'I handle money with calm attention.',
      'There is room in my life for more than I have now.',
      'I notice opportunities, and I am willing to take them.',
      'I give and I receive, and both feel natural.',
      'I am building something steady, one ordinary day at a time.',
    ],
  },
  {
    id: 'work',
    label: 'your work',
    keywords: [
      'work', 'job', 'career', 'business', 'study', 'studying', 'exam',
      'exams', 'school', 'college', 'university', 'focus', 'project', 'goal',
      'goals', 'purpose', 'create', 'creating', 'writing', 'deadline',
      'interview', 'promotion',
    ],
    lines: [
      'I begin, and beginning is the hard part.',
      'I do good work at a pace I can keep.',
      'I finish what matters and let the rest go.',
      'My attention comes back to one thing at a time.',
      'I am becoming the person this work needs me to be.',
      'I am allowed to be a beginner at this.',
    ],
  },
  {
    id: 'sleep',
    label: 'rest',
    keywords: [
      'sleep', 'sleeping', 'asleep', 'night', 'bed', 'tired', 'insomnia',
      'dream', 'unwind', 'rest', 'restless', 'evening', 'exhausted',
    ],
    lines: [
      'The day is finished, and I am allowed to put it down.',
      'My body knows how to sleep, and I let it.',
      'I release today, breath by breath.',
      'Everything left over will still be there tomorrow.',
      'I am warm, I am safe, and I am sinking into rest.',
      'I let my thoughts drift past without following them.',
    ],
  },
  {
    id: 'healing',
    label: 'healing',
    keywords: [
      'grief', 'grieve', 'loss', 'heal', 'healing', 'forgive', 'forgiveness',
      'past', 'hurt', 'hurting', 'trauma', 'angry', 'anger', 'sorry',
      'regret', 'mistake', 'mistakes', 'broken', 'sad',
    ],
    lines: [
      'I am allowed to feel this, and I am allowed to set it down.',
      'I forgive myself for what I did not know then.',
      'What happened to me is not who I am.',
      'I am healing at the speed healing takes.',
      'I can hold sadness and still have a good day.',
      'I am gentle with the part of me that is still sore.',
    ],
  },
  {
    id: 'morning',
    label: 'the day ahead',
    keywords: [
      'morning', 'today', 'day', 'wake', 'waking', 'start', 'begin',
      'beginning', 'fresh', 'new',
    ],
    lines: [
      'I meet today as it is, not as I feared it would be.',
      'Today has room in it for something good.',
      'I set the tone for this day, and I choose a kind one.',
      'I start where I am, with what I have.',
      'Whatever this day holds, I am still here at the end of it.',
    ],
  },
  {
    id: 'gratitude',
    label: 'gratitude',
    keywords: [
      'grateful', 'gratitude', 'thankful', 'thanks', 'appreciate', 'blessed',
      'lucky',
    ],
    lines: [
      'I notice the ordinary things that are going right.',
      'I have enough for today, and today is what I am living.',
      'I am thankful for the people who make my life softer.',
      'Small good things count, and I let them count.',
    ],
  },
]

/** Used when nothing in the draft points anywhere in particular. */
const UNIVERSAL: string[] = [
  'I am allowed to take up space.',
  'I am doing better than I give myself credit for.',
  'I am becoming someone I would be glad to know.',
  'I choose how I speak to myself.',
  'I am on my own timeline, and it is the right one.',
  'What I practise, I become.',
  'I return to these words whenever I need them.',
]

const MAX_ADDED = 3

/**
 * Every line this helper is capable of offering, in one flat list.
 *
 * Nothing in the app reads it — the helper picks from the themes directly —
 * but the speech pre-generation script does. These are, by definition, the
 * words most likely to be spoken by somebody who has just arrived, so they are
 * exactly the ones worth having already made, already encoded, and already
 * sitting next to the JavaScript on the CDN. See `scripts/generate-speech.mjs`.
 */
export const SUGGESTION_LINES: string[] = [
  ...THEMES.flatMap((theme) => theme.lines),
  ...UNIVERSAL,
]

function normalise(line: string): string {
  return line
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Close enough that offering it would look like the helper was not reading.
 * Exact matches are the common case, but "My breath is slow." must also rule
 * out "My breath is slow, and my body is following it." — one of which the
 * improver may well have written itself.
 */
function tooClose(candidate: string, existing: Set<string>): boolean {
  const key = normalise(candidate)
  if (existing.has(key)) return true
  for (const line of existing) {
    if (line.length < 12) continue
    if (key.includes(line) || line.includes(key)) return true
  }
  return false
}

/** Themes the draft touches, strongest first. */
function rankThemes(haystack: string): Theme[] {
  return THEMES.map((theme) => ({
    theme,
    score: theme.keywords.reduce(
      (total, keyword) =>
        total + (new RegExp(`\\b${keyword}\\b`).test(haystack) ? 1 : 0),
      0,
    ),
  }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.theme)
}

/**
 * Extend a draft with lines that follow where it is already going.
 *
 * The title counts as part of the draft — "Before the interview" says as much
 * about what this loop is for as the body does. Anything already written is
 * skipped, so pressing the button repeatedly keeps finding new lines instead
 * of stacking up the same ones, and eventually says so rather than repeating
 * itself.
 */
export function addToWords(text: string, title = ''): WordcraftResult {
  const source = text.replace(/\r\n/g, '\n')
  // The felt-sense clauses the improver appends are the app's words, not the
  // writer's. Left in, "and I feel it settle in my body" votes for the body
  // theme on a draft that was never about bodies.
  const haystack = `${title}\n${source}`
    .toLowerCase()
    .replace(new RegExp(FELT_CLAUSES.join('|'), 'gi'), ' ')
  const existing = new Set(source.split('\n').map(normalise).filter(Boolean))

  const ranked = rankThemes(haystack)
  // Two themes at most. A draft about a job interview is usually also about
  // nerves, and mixing those two reads as understanding; mixing five reads as
  // a machine emptying its pockets.
  const pool = [
    ...interleave(ranked.slice(0, 2).map((theme) => theme.lines)),
    ...UNIVERSAL,
  ]

  const picked: string[] = []
  for (const line of pool) {
    if (picked.length === MAX_ADDED) break
    if (tooClose(line, existing)) continue
    existing.add(normalise(line))
    picked.push(line)
  }

  if (picked.length === 0) {
    return {
      text: source,
      note: 'Manifester is out of suggestions for this one. The next words are yours.',
      changed: false,
    }
  }

  const body = picked.join('\n')
  const next = source.trim() ? `${source.trimEnd()}\n${body}` : body
  const count = picked.length === 1 ? 'a line' : `${picked.length} lines`

  const note = !source.trim()
    ? `Added ${count} to start from — change any of them to sound like you.`
    : ranked.length > 0
      ? `Added ${count} about ${ranked[0].label}.`
      : `Added ${count} that sit alongside what you wrote.`

  return { text: next, note, changed: true }
}

/** `[[a1, a2], [b1, b2]]` → `[a1, b1, a2, b2]`. */
function interleave(groups: string[][]): string[] {
  const out: string[] = []
  const longest = Math.max(0, ...groups.map((group) => group.length))
  for (let index = 0; index < longest; index += 1) {
    for (const group of groups) {
      if (index < group.length) out.push(group[index])
    }
  }
  return out
}
