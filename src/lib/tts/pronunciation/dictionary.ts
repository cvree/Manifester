/**
 * The pronunciation dictionary.
 *
 * This is the file to edit when a word comes out wrong. Nothing else in the
 * app needs changing to add a term: write the entry, bump
 * `PRONUNCIATION_VERSION` in `../versions.ts`, and every cached clip
 * containing that word re-keys itself and is made again on next use.
 *
 * Three kinds of rule live here.
 *
 *  - **Symbols and abbreviations** (`core`) are always on. They are the ones
 *    that are wrong in the same way in every subject: an ampersand read as
 *    "ampersand", a percent sign read as nothing at all.
 *  - **Subject dictionaries** (`medical`, `science`, `gaming`, `acronym`, …)
 *    are switched on by whoever builds the normaliser, because the same
 *    letters mean different things in different rooms.
 *  - **This app's own words** (`app`) — names a general model has no reason to
 *    have seen.
 *
 * Every entry may carry IPA, a plain respelling, or both. Kokoro is given the
 * IPA; anything that cannot take phonemes — including the browser's own voice,
 * which is the emergency fallback — is given the respelling. Writing both is
 * the normal case, and it is what keeps a term correct after the engine is
 * swapped for a different one.
 */

import type { PronunciationEntry } from './types.ts'

/**
 * Symbols, contractions and abbreviations.
 *
 * Order matters within this list only where one rule's output could be
 * another's input, which is why nothing here emits a symbol.
 */
const CORE: PronunciationEntry[] = [
  {
    term: '&',
    match: 'pattern',
    pattern: '&',
    say: ' and ',
    note: 'Read as "ampersand" by several engines, and skipped entirely by others.',
  },
  {
    term: '%',
    match: 'pattern',
    // Only after a digit: a bare percent sign is more likely to be decoration.
    pattern: '(\\d)\\s*%',
    say: '$1 percent',
  },
  {
    term: '+',
    match: 'pattern',
    // Between two things, rather than the trailing plus of "18+".
    pattern: '(\\w)\\s*\\+\\s*(\\w)',
    say: '$1 plus $2',
  },
  {
    term: '°',
    match: 'pattern',
    pattern: '(\\d)\\s*°',
    say: '$1 degrees',
  },
  {
    term: '×',
    match: 'pattern',
    pattern: '(\\d)\\s*×\\s*(\\d)',
    say: '$1 times $2',
  },
  {
    term: '…',
    match: 'pattern',
    pattern: '…',
    say: ', ',
    note: 'An ellipsis is a pause, and a comma is the pause every engine keeps.',
  },
  {
    term: '—',
    match: 'pattern',
    pattern: '\\s*[—–]\\s*',
    say: ', ',
    note: 'Em and en dashes are read aloud as silence by some engines and as "dash" by others.',
  },
  { term: 'w/', match: 'pattern', pattern: '\\bw/\\s', say: 'with ' },
  { term: 'e.g.', match: 'pattern', pattern: '\\be\\.g\\.', say: 'for example' },
  { term: 'i.e.', match: 'pattern', pattern: '\\bi\\.e\\.', say: 'that is' },
  { term: 'etc.', match: 'pattern', pattern: '\\betc\\.', say: 'et cetera' },
  { term: 'vs.', match: 'pattern', pattern: '\\bvs\\.?', say: 'versus' },
  { term: 'Dr.', match: 'pattern', pattern: '\\bDr\\.', say: 'Doctor' },
  { term: 'Mr.', match: 'pattern', pattern: '\\bMr\\.', say: 'Mister' },
  { term: 'Mrs.', match: 'pattern', pattern: '\\bMrs\\.', say: 'Missus' },
  { term: 'Ms.', match: 'pattern', pattern: '\\bMs\\.', say: 'Miz' },
]

/** Names and words belonging to this app. */
const APP: PronunciationEntry[] = [
  {
    term: 'Manifester',
    ipa: 'ˈmænɪˌfɛstɚ',
    say: 'MAN-ih-fes-ter',
    scope: 'app',
  },
]

/**
 * Initialisms that are letters, not words.
 *
 * Spelling them out in `say` is what stops an engine trying to pronounce
 * "CSUCI" as a syllable — and the spaced-out form is also what makes the
 * fallback voice read them one letter at a time.
 */
const ACRONYMS: PronunciationEntry[] = [
  {
    term: 'CSUCI',
    say: 'see ess you see eye',
    ipa: 'ˌsiː ˌɛs ˌjuː ˌsiː ˈaɪ',
    scope: 'acronym',
    caseSensitive: true,
    note: 'California State University Channel Islands. Always spelled out.',
  },
  {
    term: 'SpO2',
    say: 'ess pee oh two',
    ipa: 'ˌɛs ˌpiː ˌoʊ ˈtuː',
    scope: 'medical',
    caseSensitive: false,
    note: 'Peripheral oxygen saturation. Read letter by letter, then the number.',
  },
  {
    term: 'PWA',
    say: 'pee double you ay',
    scope: 'acronym',
    caseSensitive: true,
  },
  {
    term: 'IPA',
    say: 'eye pee ay',
    scope: 'acronym',
    caseSensitive: true,
    note: 'The alphabet, not the beer.',
  },
]

/** Clinical terms, off unless the medical scope is switched on. */
const MEDICAL: PronunciationEntry[] = [
  {
    term: 'acetaminophen',
    ipa: 'əˌsiːtəˈmɪnəfɪn',
    say: 'uh-see-tuh-MIN-oh-fen',
    scope: 'medical',
  },
  {
    term: 'gastroenterology',
    ipa: 'ˌɡæstroʊˌɛntɚˈɑlədʒi',
    say: 'gas-troh-en-ter-OL-uh-jee',
    scope: 'medical',
  },
  {
    term: 'Clostridioides difficile',
    match: 'phrase',
    ipa: 'klɒˌstrɪdiˈɔɪdiːz dɪfɪˈsiːl',
    say: 'kloss-trid-ee-OY-deez dif-uh-SEEL',
    scope: 'medical',
    note: 'The species was renamed from Clostridium in 2016; both are still written.',
  },
  {
    term: 'Clostridium difficile',
    match: 'phrase',
    ipa: 'klɒˈstrɪdiəm dɪfɪˈsiːl',
    say: 'kloss-TRID-ee-um dif-uh-SEEL',
    scope: 'medical',
  },
  {
    term: 'dupilumab',
    ipa: 'duːˈpɪljʊmæb',
    say: 'doo-PILL-yoo-mab',
    scope: 'medical',
  },
  {
    term: 'Na+',
    say: 'sodium',
    scope: 'medical',
    caseSensitive: true,
    note: 'Read as the element in clinical speech, not as "N A plus".',
  },
  {
    term: 'K+',
    say: 'potassium',
    scope: 'medical',
    caseSensitive: true,
  },
]

/** General scientific vocabulary. */
const SCIENCE: PronunciationEntry[] = [
  {
    term: 'photosynthesis',
    ipa: 'ˌfoʊtoʊˈsɪnθəsɪs',
    say: 'foh-toh-SIN-thuh-sis',
    scope: 'science',
  },
  {
    term: 'mitochondria',
    ipa: 'ˌmaɪtəˈkɑndriə',
    say: 'my-tuh-KON-dree-uh',
    scope: 'science',
  },
]

/** Proper nouns from games, which general models routinely mangle. */
const GAMING: PronunciationEntry[] = [
  {
    term: 'Overwatch',
    ipa: 'ˈoʊvɚwɑtʃ',
    say: 'OH-ver-watch',
    scope: 'gaming',
  },
  {
    term: 'Kiriko',
    ipa: 'kɪˈriːkoʊ',
    say: 'kee-REE-koh',
    scope: 'gaming',
  },
  {
    term: 'Reinhardt',
    ipa: 'ˈraɪnhɑrt',
    say: 'RINE-hart',
    scope: 'gaming',
    note: 'German name: the "ei" is an eye sound, and the "d" is a t.',
  },
]

/** Everything the app knows about, in one list. */
export const DICTIONARY: PronunciationEntry[] = [
  ...CORE,
  ...APP,
  ...ACRONYMS,
  ...MEDICAL,
  ...SCIENCE,
  ...GAMING,
]
