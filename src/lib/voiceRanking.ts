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
 */
export function rankVoice(
  voice: SpeechSynthesisVoice,
  preferredLang: string,
): RankedVoice {
  const tier = classifyTier(voice)
  const lang = voice.lang.toLowerCase().replace('_', '-')
  const preferred = preferredLang.toLowerCase().replace('_', '-')

  let score = TIER_SCORE[tier]

  if (lang === preferred) score += 4000
  else if (lang.slice(0, 2) === preferred.slice(0, 2)) score += 3000

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

export function rankVoices(
  voices: SpeechSynthesisVoice[],
  preferredLang = typeof navigator !== 'undefined' ? navigator.language : 'en-US',
): RankedVoice[] {
  return voices
    .map((voice) => rankVoice(voice, preferredLang))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
}

/**
 * The best voice for a requested style.
 *
 * Falls back through: exact style match → unlabelled voices → anything at all,
 * so this never returns nothing when the device has any voice whatsoever.
 */
export function pickBestVoice(
  ranked: RankedVoice[],
  style: 'feminine' | 'masculine',
): RankedVoice | null {
  if (ranked.length === 0) return null
  return (
    ranked.find((voice) => voice.style === style) ??
    ranked.find((voice) => voice.style === 'unlabelled') ??
    ranked[0]
  )
}

/** True when the device has nothing better than a legacy formant synth. */
export function isDeviceVoicePoor(voice: RankedVoice | null): boolean {
  return voice != null && voice.tier === 'basic'
}
