/**
 * Which language the words are actually in — and which voice may read them.
 *
 * ── The bug this file exists to end ──
 *
 * Every place in the app that had to name a language named `navigator.language`,
 * and `navigator.language` is not a fact about the affirmation somebody typed.
 * It is a fact about the phone's menus. On a device set to Chinese, or Polish,
 * or Portuguese:
 *
 *  - `rankVoices()` scored every Chinese voice thousands of points above every
 *    English one, so "the best voice on this device" was a Chinese voice;
 *  - the pickers filtered the list to voices in the *interface* language, so
 *    the English voices somebody had deliberately installed were not even shown;
 *  - and the fallback spoke English affirmations through a `SpeechSynthesisUtterance`
 *    with no `lang` set at all, which every engine resolves against the page or
 *    the platform — so "I am steady before meetings" came out of a Chinese
 *    voice, pronounced as though it were pinyin.
 *
 * None of those is a rare edge. Any bilingual person, anybody using a phone
 * they bought abroad, anybody who simply prefers their interface in another
 * language, hit all three at once — and the app had no way for them to say
 * "no, this is English".
 *
 * The rule here is short: **the language of the content decides the voice, and
 * the content this app speaks is English.** The affirmations, the ready-made
 * lines, the studio voices and every phrase shipped with the app are English.
 * So English is what the device voices are chosen and configured for, and a
 * non-English voice is never reached for silently — only when somebody has
 * picked one themselves, which is a choice rather than an accident.
 */

/** What English is called when nothing better is known. */
export const DEFAULT_SPEECH_LOCALE = 'en-US'

/** The subtag every English voice on every platform starts with. */
export const ENGLISH_PREFIX = 'en'

/**
 * Normalise the many spellings of a language tag.
 *
 * Platforms are not consistent: `en_US` on some Androids, `en-US` on the web,
 * `en-us` from a few older engines, and occasionally a bare `en`. All four are
 * the same answer.
 */
export function normaliseLang(lang: string | null | undefined): string {
  return (lang ?? '').trim().toLowerCase().replace(/_/g, '-')
}

/** The primary subtag: `en-GB` → `en`. */
export function primarySubtag(lang: string | null | undefined): string {
  return normaliseLang(lang).split('-')[0] ?? ''
}

export function isEnglishLang(lang: string | null | undefined): boolean {
  return primarySubtag(lang) === ENGLISH_PREFIX
}

/** True when a voice speaks the wanted language, whatever the region. */
export function voiceSpeaks(
  voiceLang: string | null | undefined,
  wanted: string,
): boolean {
  return primarySubtag(voiceLang) === primarySubtag(wanted)
}

/**
 * The English locale to use on this device.
 *
 * An English-speaking device keeps its own region, so somebody on `en-GB` is
 * read to in British English and somebody on `en-AU` in Australian — the
 * regional voice is genuinely nicer for them and it is still English, which is
 * the only thing that has to be true. Every other interface language falls to
 * `en-US`, which is what the pre-generated clips and the studio voices are.
 *
 * The one thing it will never do is return the interface language itself. That
 * was the bug.
 */
export function englishLocale(): string {
  const language = typeof navigator !== 'undefined' ? navigator.language : null
  if (isEnglishLang(language)) return language as string

  const list = typeof navigator !== 'undefined' ? navigator.languages : undefined
  const english = list?.find((tag) => isEnglishLang(tag))
  return english ?? DEFAULT_SPEECH_LOCALE
}

/**
 * A rough, deliberately conservative "is this English?" test.
 *
 * Not a language detector, and it does not try to be one — telling English
 * from Dutch by eye is a research problem and getting it wrong would be worse
 * than not asking. All this answers is the question that actually matters
 * here: *are these Latin letters, or is this another script entirely?* Text
 * written in Han, Cyrillic, Arabic, Devanagari, Hangul or Kana is certainly
 * not English, and anything predominantly Latin is treated as English because
 * that is what this app's content is.
 *
 * Used only to decide whether a line may keep the app's English default. When
 * it says no, the utterance is left to the platform rather than being forced
 * into English, so somebody who pastes in Spanish affirmations is not read to
 * in a American accent.
 */
export function looksEnglish(text: string): boolean {
  let latin = 0
  let foreign = 0

  for (const character of text) {
    const code = character.codePointAt(0) ?? 0
    // Basic Latin letters and the Latin-1/Extended-A accented range.
    if (
      (code >= 0x41 && code <= 0x5a) ||
      (code >= 0x61 && code <= 0x7a) ||
      (code >= 0xc0 && code <= 0x24f)
    ) {
      latin += 1
      continue
    }
    // Anything above the Latin ranges that is not punctuation, spacing or a
    // symbol: CJK, Cyrillic, Greek, Arabic, Hebrew, Indic, Kana, Hangul.
    if (code > 0x2c0 && !/[\s\p{P}\p{S}\p{N}]/u.test(character)) foreign += 1
  }

  if (latin === 0) return false
  return latin >= foreign
}

/**
 * The locale an utterance of this text should carry.
 *
 * English content gets an explicit English locale — never left unset, because
 * unset is exactly what let the platform answer with its own language. Text in
 * another script returns `null`, meaning "do not claim to know", and the caller
 * leaves the utterance's `lang` alone so the engine can do its own thing.
 */
export function speechLocaleFor(text?: string): string | null {
  if (text != null && !looksEnglish(text)) return null
  return englishLocale()
}

/** The language voices are ranked and filtered against, for this app's content. */
export function contentLanguage(): string {
  return englishLocale()
}
