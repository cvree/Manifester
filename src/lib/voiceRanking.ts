/**
 * Picking a *good* device voice, not just any device voice.
 *
 * `speechSynthesis.getVoices()` returns everything the platform has, in no
 * useful order, mixing 2010-era formant synths with modern neural ones. The
 * quality gap is enormous — "Microsoft Zira" and "Microsoft Aria Online
 * (Natural)" are both en-US female voices, and only one of them is pleasant to
 * listen to for twenty minutes.
 *
 * This module scores each voice from what the platform tells us (name, lang,
 * localService) and picks the best feminine and masculine option available.
 */

import { contentLanguage, normaliseLang, voiceSpeaks } from './voiceLanguage'

export type VoiceStyle = 'feminine' | 'masculine' | 'unlabelled'

/** How good the voice is likely to sound, in plain language. */
export type VoiceTier = 'neural' | 'enhanced' | 'standard' | 'basic'

export interface RankedVoice {
  voiceURI: string
  name: string
  lang: string
  localService: boolean
  style: VoiceStyle
  tier: VoiceTier
  /** Higher is better. Only meaningful for comparison within one device. */
  score: number
  /** Short, honest description shown where there is room to explain. */
  tierLabel: string
  /**
   * One word, for a list somebody is choosing from by ear.
   *
   * "Basic — robotic, worth avoiding" is a true sentence and the wrong one to
   * put beside a voice somebody is about to press. Once the list *speaks* when
   * you touch it, the judgement is theirs to make in a second and the label's
   * only job is to say which shelf a voice came off. Editorialising over the
   * top of something the person can hear is noise, and on a device where
   * everything is Basic it is three rows of discouragement.
   */
  tierShort: string
}

const TIER_LABEL: Record<VoiceTier, string> = {
  neural: 'Neural — the best this device has',
  enhanced: 'Enhanced quality',
  standard: 'Standard quality',
  basic: 'Basic — an older synthesiser',
}

const TIER_SHORT: Record<VoiceTier, string> = {
  neural: 'Neural',
  enhanced: 'Enhanced',
  standard: 'Standard',
  basic: 'Basic',
}

/* ── Name tables ─────────────────────────────────────────────────────────── */

/**
 * Modern neural voices. Windows ships the "Natural"/"Online" Azure voices,
 * Chrome ships Google's, Apple marks its best ones Premium or Siri.
 */
const NEURAL_PATTERNS: RegExp[] = [
  /\bnatural\b/i, // Microsoft ... Online (Natural)
  /\bonline\b/i, // Microsoft ... Online
  /\bneural\b/i,
  /\bpremium\b/i, // Apple Premium
  /\bsiri\b/i, // Apple Siri voices, where exposed
  /^google\s/i, // Google US English etc. — network neural voices
  /-x-[a-z]{3}-(network|local)$/i, // Android en-us-x-tpc-network
]

/** A clear step above the legacy synths, below the neural ones. */
const ENHANCED_PATTERNS: RegExp[] = [
  /\benhanced\b/i, // Apple Enhanced
  /\beloquence\b/i,
]

/** Old formant synths. Present everywhere, pleasant nowhere. */
const BASIC_PATTERNS: RegExp[] = [
  /^e-?speak/i,
  /\bcompact\b/i,
  /\bpico\b/i,
  /^(microsoft )?(david|zira|mark|hazel|susan|george)\b(?!.*natural)/i,
]

/**
 * Apple's better built-in voices, which carry no quality marker in the name.
 * These are the ones worth reaching for on iPhone.
 */
const APPLE_GOOD = [
  'ava', 'allison', 'samantha', 'susan', 'nicky', 'zoe', 'joelle', 'nathan',
  'evan', 'tom', 'aaron', 'noelle',
]

const FEMININE_HINTS = [
  'female', 'woman', 'samantha', 'karen', 'moira', 'tessa', 'fiona', 'victoria',
  'serena', 'allison', 'ava', 'susan', 'zira', 'hazel', 'catherine', 'nicky',
  'kate', 'sara', 'anna', 'amelie', 'amélie', 'joana', 'luciana', 'paulina',
  'monica', 'mónica', 'yuna', 'kyoko', 'ting-ting', 'sin-ji', 'mei-jia',
  'nora', 'satu', 'ioana', 'laura', 'alice', 'milena', 'zosia', 'linh', 'lekha',
  'zuzana', 'aria', 'jenny', 'michelle', 'sonia', 'libby', 'natasha', 'clara',
  'emma', 'olivia', 'ivy', 'joanna', 'kendra', 'kimberly', 'salli', 'amy',
  'zoe', 'joelle', 'noelle', 'ana', 'jane', 'nancy', 'amber', 'ashley',
  'cora', 'elizabeth', 'monica', 'sara', 'lily', 'isabella', 'maisie',
]

const MASCULINE_HINTS = [
  'male', 'alex', 'daniel', 'fred', 'tom', 'aaron', 'oliver', 'rishi',
  'david', 'mark', 'nathan', 'arthur', 'george', 'james', 'ryan', 'guy',
  'thomas', 'jorge', 'diego', 'juan', 'carlos', 'xander', 'rocko', 'reed',
  'eddy', 'grandpa', 'yuri', 'otoya', 'hattori', 'lee', 'gordon', 'matthew',
  'brian', 'joey', 'justin', 'russell', 'liam', 'christopher', 'eric',
  'evan', 'davis', 'andrew', 'roger', 'steffan', 'brandon', 'jason', 'tony',
  'ethan', 'jacob', 'adam', 'william', 'noah', 'connor',
]

/** Check the masculine table first: "female" contains "male". */
export function guessStyle(name: string): VoiceStyle {
  const lower = ` ${name.toLowerCase()} `
  if (/\bfemale\b|\bwoman\b/.test(lower)) return 'feminine'
  if (/\bmale\b|\bman\b/.test(lower)) return 'masculine'

  const word = (hint: string) =>
    new RegExp(`(^|[^a-z])${hint}([^a-z]|$)`, 'i').test(lower)

  if (MASCULINE_HINTS.some(word)) return 'masculine'
  if (FEMININE_HINTS.some(word)) return 'feminine'
  return 'unlabelled'
}

export function classifyTier(voice: SpeechSynthesisVoice): VoiceTier {
  const { name } = voice
  if (BASIC_PATTERNS.some((pattern) => pattern.test(name))) return 'basic'
  if (NEURAL_PATTERNS.some((pattern) => pattern.test(name))) return 'neural'
  if (ENHANCED_PATTERNS.some((pattern) => pattern.test(name))) return 'enhanced'

  const lower = name.toLowerCase()
  if (APPLE_GOOD.some((good) => lower.startsWith(good))) return 'enhanced'
  return 'standard'
}

const TIER_SCORE: Record<VoiceTier, number> = {
  neural: 1000,
  enhanced: 600,
  standard: 300,
  basic: 0,
}

/**
 * Score a voice for this device. Language match dominates — a superb Italian
 * voice reading English affirmations is worse than a plain English one.
 *
 * The language bonuses are larger than the entire tier range on purpose, and
 * that ordering is a correctness property rather than a preference: the very
 * best neural voice in the wrong language scores 1000, and the very worst
 * formant synth in the right one scores 3000, so no combination of quality
 * signals can ever lift a wrong-language voice above a right-language one.
 * `voiceRanking.test.ts` pins it.
 */
export function rankVoice(
  voice: SpeechSynthesisVoice,
  preferredLang: string,
): RankedVoice {
  const tier = classifyTier(voice)
  const lang = normaliseLang(voice.lang)
  const preferred = normaliseLang(preferredLang)

  let score = TIER_SCORE[tier]

  if (lang === preferred) score += 4000
  else if (voiceSpeaks(lang, preferred)) score += 3000

  // Among equals, prefer a named voice over a generic locale-coded one.
  if (/^[a-z]{2}[-_][a-z]{2}$/i.test(voice.name)) score -= 120

  // A voice marked default by the platform is usually a sensible pick.
  if (voice.default) score += 40

  return {
    voiceURI: voice.voiceURI,
    name: voice.name,
    lang: voice.lang,
    localService: voice.localService,
    style: guessStyle(voice.name),
    tier,
    score,
    tierLabel: TIER_LABEL[tier],
    tierShort: TIER_SHORT[tier],
  }
}

/**
 * Rank every voice on the device for this app's content.
 *
 * The default is `contentLanguage()` — English — and emphatically *not*
 * `navigator.language`, which is what it used to be. That default was the
 * source of the worst voice bug this app has had: on a phone whose interface
 * is Chinese, every Chinese voice scored 3000 points above every English one,
 * so "the best voice on this device" for an English affirmation was a Chinese
 * voice, and English words came out of it as though they were pinyin.
 *
 * The interface language is a fact about somebody's menus. It says nothing
 * about the words they wrote. See `voiceLanguage.ts`.
 */
export function rankVoices(
  voices: SpeechSynthesisVoice[],
  preferredLang = contentLanguage(),
): RankedVoice[] {
  return voices
    .map((voice) => rankVoice(voice, preferredLang))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
}

/** Only the voices that speak a given language, in ranked order. */
export function voicesInLanguage(
  ranked: RankedVoice[],
  language: string,
): RankedVoice[] {
  return ranked.filter((voice) => voiceSpeaks(voice.lang, language))
}

/**
 * The best voice for a requested style, in the language of the words.
 *
 * Two rules, in this order, and the first one is the important one:
 *
 *  1. **Language before everything.** Only voices that speak `language` are
 *     considered. A device with one mediocre English voice and twelve superb
 *     Chinese ones has exactly one candidate here, because the alternative —
 *     the behaviour this replaced — is English affirmations read aloud in
 *     Chinese, which is not a lesser version of the feature but a broken one.
 *  2. **Then style, then anything.** Within the language: the requested style,
 *     an unlabelled voice, or the best-ranked one of any style.
 *
 * The cross-language fallback at the end fires only when the device has no
 * voice in the wanted language at all. That is a real situation — a stripped
 * Android build with one locale installed — and silence would be worse; it is
 * also the one case the interface is told about, through `isWrongLanguage`,
 * so it can say so rather than quietly sounding wrong.
 */
export function pickBestVoice(
  ranked: RankedVoice[],
  style: 'feminine' | 'masculine',
  language: string = contentLanguage(),
): RankedVoice | null {
  if (ranked.length === 0) return null

  const speaking = voicesInLanguage(ranked, language)
  const pool = speaking.length > 0 ? speaking : ranked

  return (
    pool.find((voice) => voice.style === style) ??
    pool.find((voice) => voice.style === 'unlabelled') ??
    pool[0]
  )
}

/**
 * Resolve a saved choice: the exact voice if it is still installed, otherwise
 * the best voice in the right language.
 *
 * The second half is the requirement that a saved premium voice which has been
 * uninstalled, renamed by an OS update, or is simply absent on a second device
 * degrades to *the best English voice*, never to whatever happens to sort
 * first on a phone with a different interface language.
 */
export function resolveVoiceChoice(
  ranked: RankedVoice[],
  voiceURI: string | null,
  style: 'feminine' | 'masculine',
  language: string = contentLanguage(),
): RankedVoice | null {
  if (voiceURI) {
    const chosen = ranked.find((voice) => voice.voiceURI === voiceURI)
    // An explicit choice is honoured whatever language it is in: somebody who
    // picked a Spanish voice for Spanish affirmations meant it. What is never
    // honoured is a *stale* choice, which is what falls through to below.
    if (chosen) return chosen
  }
  return pickBestVoice(ranked, style, language)
}

/** True when the only voice available cannot speak the words' language. */
export function isWrongLanguage(
  voice: RankedVoice | null,
  language: string = contentLanguage(),
): boolean {
  return voice != null && !voiceSpeaks(voice.lang, language)
}

/** True when the device has nothing better than a legacy formant synth. */
export function isDeviceVoicePoor(voice: RankedVoice | null): boolean {
  return voice != null && voice.tier === 'basic'
}
