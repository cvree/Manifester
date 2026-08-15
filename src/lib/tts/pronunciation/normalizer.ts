/**
 * Turning what somebody wrote into what the engine should be asked to say.
 *
 * The normaliser is deliberately provider-neutral. It is handed a set of rules
 * and one fact about the engine — whether it accepts phonemes — and it decides
 * on that basis whether a term becomes IPA markup or a plain respelling. An
 * engine that takes phonemes gets the exact answer; one that does not still
 * gets a correct one; and neither of them appears anywhere in this file.
 *
 * Two things it is careful about:
 *
 *  - **It never rewrites the same span twice.** Rules claim ranges of the
 *    text, longest first, so `Clostridioides difficile` is one claim rather
 *    than two overlapping ones, and a respelling can never be re-read by a
 *    later rule as if the person had typed it.
 *  - **It does not use lookbehind.** Word boundaries are checked by looking at
 *    the neighbouring characters directly. `(?<!\w)` would be the obvious
 *    spelling and it throws a `SyntaxError` at parse time on Safari before
 *    16.4 — which does not break a pronunciation, it breaks the entire bundle
 *    on somebody's iPad.
 */

import { DICTIONARY } from './dictionary.ts'
import type {
  NormalizedSpeech,
  PronunciationEntry,
  PronunciationScope,
} from './types.ts'

/**
 * How a phoneme override is written for the engine.
 *
 * Kokoro (through Misaki) takes `[word](/ˈwɜrd/)`, which is also the syntax
 * the FastAPI server documents, so it is the default. An engine with different
 * markup passes its own renderer and nothing else changes.
 */
export type PhonemeRenderer = (term: string, ipa: string) => string

export const kokoroPhonemeMarkup: PhonemeRenderer = (term, ipa) =>
  `[${term}](/${ipa}/)`

export interface NormalizerOptions {
  /** Defaults to the shipped dictionary. */
  entries?: PronunciationEntry[]
  /** Subjects to switch on. `core` is always on and need not be listed. */
  scopes?: PronunciationScope[]
  /** Whether the engine understands IPA overrides. */
  supportsPhonemes?: boolean
  renderPhoneme?: PhonemeRenderer
}

/** Scopes the app runs with unless a caller says otherwise. */
export const DEFAULT_SCOPES: PronunciationScope[] = [
  'app',
  'acronym',
  'medical',
  'science',
  'gaming',
]

const isWordChar = (character: string | undefined): boolean =>
  character != null && /[A-Za-z0-9]/.test(character)

/** A rule that rewrites text, ready to be applied. */
interface CompiledEntry {
  entry: PronunciationEntry
  /** Lower-cased term, for case-insensitive scanning. */
  needle: string
  regex?: RegExp
}

export class PronunciationNormalizer {
  private entries: PronunciationEntry[]
  private scopes: Set<PronunciationScope>
  private supportsPhonemes: boolean
  private renderPhoneme: PhonemeRenderer
  /** Rebuilt whenever the rules or the scopes change. */
  private compiled: { patterns: CompiledEntry[]; terms: CompiledEntry[] } | null =
    null

  constructor(options: NormalizerOptions = {}) {
    this.entries = [...(options.entries ?? DICTIONARY)]
    this.scopes = new Set(options.scopes ?? DEFAULT_SCOPES)
    this.supportsPhonemes = options.supportsPhonemes ?? false
    this.renderPhoneme = options.renderPhoneme ?? kokoroPhonemeMarkup
  }

  /**
   * Add rules at runtime.
   *
   * The shipped dictionary is a file in the repository, which is the right
   * place for terms the app always knows. This is for the ones it learns —
   * a term added from a settings screen, or a set of rules fetched with a
   * piece of content.
   */
  add(entries: PronunciationEntry[]): void {
    this.entries.push(...entries)
    this.compiled = null
  }

  /** Replace the whole rule set. Used by tests and by the build script. */
  setEntries(entries: PronunciationEntry[]): void {
    this.entries = [...entries]
    this.compiled = null
  }

  setScopes(scopes: PronunciationScope[]): void {
    this.scopes = new Set(scopes)
    this.compiled = null
  }

  /** Tell the normaliser what the engine can take. */
  setPhonemeSupport(supported: boolean, render?: PhonemeRenderer): void {
    this.supportsPhonemes = supported
    if (render) this.renderPhoneme = render
  }

  /** Every rule currently in force, for a diagnostics view. */
  activeEntries(): PronunciationEntry[] {
    return this.entries.filter((entry) => this.inScope(entry))
  }

  normalize(input: string): NormalizedSpeech {
    const applied: string[] = []
    const cleaned = tidy(input)
    if (!cleaned) return { text: '', applied }

    // A whole phrase with a recording of its own never reaches the engine.
    const override = this.findAudioOverride(cleaned)
    if (override) {
      return { text: cleaned, audio: override.audio, applied: [override.term] }
    }

    const { patterns, terms } = this.compile()

    /*
     * Named terms first, symbol rules second, and that order is load-bearing.
     *
     * `Na+` is a term whose written form ends in a symbol, and the general
     * rule for a plus sign between two things would happily turn it into "Na
     * plus is 140" before the sodium rule ever got a look. A specific term
     * always beats a generic rule about punctuation, so the specific ones
     * claim their text first and the symbol rules only ever see what is left.
     */
    let text = this.applyTerms(cleaned, terms, applied)

    for (const rule of patterns) {
      if (!rule.regex || rule.entry.say == null) continue
      const before = text
      text = text.replace(rule.regex, rule.entry.say)
      if (text !== before) applied.push(rule.entry.term)
    }

    return { text: tidy(text), applied }
  }

  /* ── internals ── */

  private inScope(entry: PronunciationEntry): boolean {
    const scope = entry.scope ?? 'core'
    return scope === 'core' || this.scopes.has(scope)
  }

  private compile(): { patterns: CompiledEntry[]; terms: CompiledEntry[] } {
    if (this.compiled) return this.compiled

    const patterns: CompiledEntry[] = []
    const terms: CompiledEntry[] = []

    for (const entry of this.entries) {
      if (!this.inScope(entry)) continue

      if (entry.match === 'pattern') {
        if (!entry.pattern) continue
        try {
          patterns.push({
            entry,
            needle: entry.term.toLowerCase(),
            regex: new RegExp(entry.pattern, entry.caseSensitive ? 'g' : 'gi'),
          })
        } catch {
          /* A malformed rule is skipped rather than allowed to break speech. */
        }
        continue
      }

      terms.push({ entry, needle: entry.term.toLowerCase() })
    }

    // Longest first, so a phrase always beats the words inside it.
    terms.sort((a, b) => b.entry.term.length - a.entry.term.length)

    this.compiled = { patterns, terms }
    return this.compiled
  }

  /** The phrase-level recording for this text, if it has one. */
  private findAudioOverride(text: string): { audio: string; term: string } | null {
    const stripped = text.replace(/[.!?,;:]+$/, '').trim().toLowerCase()
    for (const entry of this.entries) {
      if (!entry.audio || !this.inScope(entry)) continue
      const term = entry.caseSensitive ? entry.term : entry.term.toLowerCase()
      const candidate = entry.caseSensitive
        ? text.replace(/[.!?,;:]+$/, '').trim()
        : stripped
      if (candidate === term) return { audio: entry.audio, term: entry.term }
    }
    return null
  }

  /**
   * Rewrite whole words and phrases.
   *
   * Every match is recorded as a claim on a range of the *input*, and the
   * output is assembled once at the end. Doing it as a series of string
   * replacements instead is the version that quietly re-reads its own output:
   * a respelling containing the word "and" is not an ampersand somebody typed.
   */
  private applyTerms(
    text: string,
    terms: CompiledEntry[],
    applied: string[],
  ): string {
    if (terms.length === 0) return text

    const haystack = text.toLowerCase()
    const claims: Array<{ start: number; end: number; replacement: string }> = []
    const claimed = (start: number, end: number): boolean =>
      claims.some((claim) => start < claim.end && end > claim.start)

    for (const { entry, needle } of terms) {
      const source = entry.caseSensitive ? text : haystack
      const target = entry.caseSensitive ? entry.term : needle
      if (!target) continue

      let from = 0
      for (;;) {
        const index = source.indexOf(target, from)
        if (index === -1) break
        const end = index + target.length
        from = index + Math.max(1, target.length)

        // Boundaries are only required on the sides where the term itself
        // ends in something a word can run into. `Na+` needs one on the left
        // and must not require one on the right.
        const needsLeft = isWordChar(target[0])
        const needsRight = isWordChar(target[target.length - 1])
        if (needsLeft && isWordChar(text[index - 1])) continue
        if (needsRight && isWordChar(text[end])) continue
        if (claimed(index, end)) continue

        const matched = text.slice(index, end)
        const replacement = this.replacementFor(entry, matched)
        if (replacement == null) continue

        claims.push({ start: index, end, replacement })
        applied.push(entry.term)
      }
    }

    if (claims.length === 0) return text

    claims.sort((a, b) => a.start - b.start)
    let out = ''
    let cursor = 0
    for (const claim of claims) {
      out += text.slice(cursor, claim.start) + claim.replacement
      cursor = claim.end
    }
    return out + text.slice(cursor)
  }

  /** What this term becomes, given what the engine can understand. */
  private replacementFor(
    entry: PronunciationEntry,
    matched: string,
  ): string | null {
    if (this.supportsPhonemes && entry.ipa) {
      return this.renderPhoneme(matched, entry.ipa)
    }
    if (entry.say != null) return entry.say
    return null
  }
}

/**
 * Whitespace, quotes and dashes as the engine should see them.
 *
 * Smart quotes are not a pronunciation problem, they are a tokenisation one:
 * several engines treat `’` as a word boundary and read "I’m" as two words.
 */
function tidy(text: string): string {
  return text
    .normalize('NFC')
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[   ]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .trim()
}

/** The normaliser the app uses when nobody has asked for anything special. */
export function createNormalizer(
  options: NormalizerOptions = {},
): PronunciationNormalizer {
  return new PronunciationNormalizer(options)
}
