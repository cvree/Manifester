/**
 * What a pronunciation rule is, independently of who will speak it.
 *
 * A rule can carry three different answers to "how is this said?", and an
 * engine takes whichever of them it understands:
 *
 *  - `ipa` is the exact answer, and only engines that accept phonemes get it.
 *  - `say` is the portable one: a respelling that any text-to-speech system
 *    will read correctly, including the browser's own.
 *  - `audio` is the last resort, for a word no amount of respelling fixes —
 *    a file that replaces synthesis for that phrase entirely.
 *
 * Writing all three is normal and is not redundant. Kokoro gets the phonemes,
 * a future engine that does not take phonemes still gets the respelling, and
 * neither of them has to be told about the other.
 */

/**
 * Which body of terms a rule belongs to.
 *
 * Scopes exist so a rule can be *off* without being deleted. A medical
 * dictionary is precisely wrong in a game — "SpO2" is a blood oxygen reading
 * in one and a player's handle in another — and the honest way to say that is
 * to name the subject a rule belongs to and let the caller choose which
 * subjects are in play.
 */
export type PronunciationScope =
  /** Always on: symbols and abbreviations that mean the same thing anywhere. */
  | 'core'
  /** Names, places and terms belonging to this app. */
  | 'app'
  | 'medical'
  | 'science'
  | 'gaming'
  /** Initialisms that should be spelled out rather than read as words. */
  | 'acronym'

/** How the written form of a rule is found in a piece of text. */
export type PronunciationMatch =
  /** A single token, bounded by non-word characters. The default. */
  | 'word'
  /** Several words in sequence, bounded the same way. */
  | 'phrase'
  /** A regular expression, for families of terms rather than one term. */
  | 'pattern'

export interface PronunciationEntry {
  /**
   * The written form, as it appears in somebody's text.
   *
   * For `pattern` rules this is documentation only — `pattern` is what is
   * matched — but it is still what the entry is called in diagnostics.
   */
  term: string
  match?: PronunciationMatch
  /** Regular expression source. Required when `match` is `pattern`. */
  pattern?: string
  /** A respelling every engine can read. */
  say?: string
  /**
   * IPA, for engines that accept it. Written without slashes; the engine adds
   * whatever delimiters its own markup needs.
   */
  ipa?: string
  /**
   * A file under the speech asset root that replaces synthesis.
   *
   * Only consulted when the entry's term is the *whole* phrase being spoken.
   * Splicing a recording into the middle of a synthesised sentence sounds
   * exactly as bad as it sounds like it would.
   */
  audio?: string
  /** Off by default unless the scope is active. `core` is always active. */
  scope?: PronunciationScope
  /** Match the written form exactly, including capitals. */
  caseSensitive?: boolean
  /** Why this rule exists. Read by people, never by code. */
  note?: string
}

/** The result of putting a piece of text through the dictionary. */
export interface NormalizedSpeech {
  /** What should now be sent to the engine. */
  text: string
  /**
   * A file to play instead of synthesising, when one phrase is stubborn
   * enough to have earned its own recording.
   */
  audio?: string
  /** The terms that fired, for the diagnostics panel and for tests. */
  applied: string[]
}
