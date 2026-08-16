import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveDeviceVoice } from './deviceVoice'
import {
  DEFAULT_SPEECH_LOCALE,
  contentLanguage,
  englishLocale,
  isEnglishLang,
  looksEnglish,
  normaliseLang,
  primarySubtag,
  speechLocaleFor,
  voiceSpeaks,
} from './voiceLanguage'
import {
  isWrongLanguage,
  pickBestVoice,
  rankVoice,
  rankVoices,
  resolveVoiceChoice,
  voicesInLanguage,
} from './voiceRanking'

/*
 * ── The bug these tests exist for ──
 *
 * On a phone whose interface language is Chinese, an English affirmation was
 * read aloud by a Chinese voice, pronouncing the English words as though they
 * were pinyin. It was not one mistake but the same mistake in four places, all
 * of which reached for `navigator.language` — a fact about somebody's menus —
 * when the question was what language the *words* are in:
 *
 *   1. `rankVoices()` defaulted to it, so every Chinese voice scored 3000
 *      points above every English one and "the best voice on this device" was
 *      a Chinese voice.
 *   2. `pickBestVoice()` ranked by style with no language constraint at all,
 *      so it returned whatever that ranking put first.
 *   3. A saved premium voice that was no longer installed fell back to the
 *      same wrong answer.
 *   4. The utterance went out with no `lang` set, which every engine resolves
 *      against the platform locale — the mechanism that actually produced the
 *      Chinese pronunciation.
 *
 * Every test below pins one of those four, and each is written the way the bug
 * was reported: a device that has good English voices installed, and an
 * interface that is in another language.
 */

/** A device voice, as `speechSynthesis` would hand one over. */
function voice(
  name: string,
  lang: string,
  options: { localService?: boolean; default?: boolean } = {},
): SpeechSynthesisVoice {
  return {
    name,
    lang,
    voiceURI: `uri:${name}`,
    localService: options.localService ?? true,
    default: options.default ?? false,
  } as SpeechSynthesisVoice
}

/**
 * A phone bought in mainland China, with English voices installed by somebody
 * who writes their affirmations in English. The Chinese voices are the good
 * ones, which is exactly what makes this the hard case: every quality signal
 * points the wrong way.
 */
const CHINESE_PHONE = [
  voice('Ting-Ting (Premium)', 'zh-CN', { default: true }),
  voice('Sin-ji (Enhanced)', 'zh-HK'),
  voice('Mei-Jia', 'zh-TW'),
  voice('Samantha', 'en-US'),
  voice('Daniel', 'en-GB'),
  voice('Microsoft Aria Online (Natural)', 'en-US'),
]

function withNavigatorLanguage(language: string, languages: string[] = [language]) {
  vi.stubGlobal('navigator', {
    language,
    languages,
    vibrate: undefined,
  } as unknown as Navigator)
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('reading a language tag', () => {
  it('treats every spelling platforms use as the same answer', () => {
    for (const tag of ['en-US', 'en_US', 'EN-us', ' en-US ']) {
      expect(normaliseLang(tag)).toBe('en-us')
      expect(primarySubtag(tag)).toBe('en')
      expect(isEnglishLang(tag)).toBe(true)
    }
    expect(isEnglishLang('zh-CN')).toBe(false)
    expect(isEnglishLang(null)).toBe(false)
    expect(isEnglishLang('')).toBe(false)
  })

  it('matches on language, not on region', () => {
    expect(voiceSpeaks('en-GB', 'en-US')).toBe(true)
    expect(voiceSpeaks('en', 'en-AU')).toBe(true)
    expect(voiceSpeaks('zh-CN', 'en-US')).toBe(false)
    // The near-miss that a `startsWith` check gets wrong.
    expect(voiceSpeaks('enm', 'en')).toBe(false)
  })
})

describe('the locale English content is spoken in', () => {
  it('never returns the interface language when it is not English', () => {
    withNavigatorLanguage('zh-CN', ['zh-CN', 'zh'])
    expect(englishLocale()).toBe(DEFAULT_SPEECH_LOCALE)
    expect(isEnglishLang(contentLanguage())).toBe(true)
  })

  it('keeps an English speaker in their own region', () => {
    withNavigatorLanguage('en-GB')
    expect(englishLocale()).toBe('en-GB')

    withNavigatorLanguage('en-AU')
    expect(englishLocale()).toBe('en-AU')
  })

  it('takes English from further down the accepted-languages list', () => {
    // A common real arrangement: menus in Polish, second language English.
    withNavigatorLanguage('pl-PL', ['pl-PL', 'en-GB', 'de'])
    expect(englishLocale()).toBe('en-GB')
  })

  it('claims English for Latin text and stays silent about other scripts', () => {
    withNavigatorLanguage('zh-CN')
    expect(speechLocaleFor('I am steady before meetings.')).toBe('en-US')
    // Accented Latin is still Latin, and this app's content is English.
    expect(speechLocaleFor('I am café-calm.')).toBe('en-US')
    // Not English, and not something to guess about: the engine decides.
    expect(speechLocaleFor('我很平静')).toBeNull()
    expect(speechLocaleFor('私は落ち着いています')).toBeNull()
    expect(speechLocaleFor('Я спокоен')).toBeNull()
  })

  it('is not fooled by punctuation, numbers or emoji', () => {
    expect(looksEnglish('I rest — at 10pm, easily. ✨')).toBe(true)
    expect(looksEnglish('...')).toBe(false)
  })
})

describe('ranking voices for English words', () => {
  it('puts every English voice above every non-English one, whatever the tier', () => {
    // The worst English voice against the best Chinese one. Language has to
    // dominate quality, or a neural voice in the wrong language wins.
    const worstEnglish = rankVoice(voice('eSpeak English', 'en-US'), 'en-US')
    const bestChinese = rankVoice(
      voice('Ting-Ting (Premium)', 'zh-CN', { default: true }),
      'en-US',
    )
    expect(worstEnglish.tier).toBe('basic')
    expect(bestChinese.tier).toBe('neural')
    expect(worstEnglish.score).toBeGreaterThan(bestChinese.score)
  })

  it('ranks by the content language even on a Chinese phone', () => {
    withNavigatorLanguage('zh-CN', ['zh-CN'])
    const ranked = rankVoices(CHINESE_PHONE)
    expect(isEnglishLang(ranked[0].lang)).toBe(true)
    // And the whole English set comes before the whole Chinese set.
    const firstChinese = ranked.findIndex((item) => !isEnglishLang(item.lang))
    const lastEnglish = ranked.map((item) => isEnglishLang(item.lang)).lastIndexOf(true)
    expect(lastEnglish).toBeLessThan(firstChinese)
  })

  it('prefers the exact locale, then the language', () => {
    withNavigatorLanguage('en-GB')
    const ranked = rankVoices([voice('Samantha', 'en-US'), voice('Daniel', 'en-GB')])
    expect(ranked[0].name).toBe('Daniel')
  })
})

describe('picking a voice for English affirmations', () => {
  it('never returns a non-English voice when English ones exist', () => {
    withNavigatorLanguage('zh-CN', ['zh-CN'])
    const ranked = rankVoices(CHINESE_PHONE)

    for (const style of ['feminine', 'masculine'] as const) {
      const picked = pickBestVoice(ranked, style)
      expect(picked).not.toBeNull()
      expect(isEnglishLang(picked!.lang)).toBe(true)
      expect(isWrongLanguage(picked)).toBe(false)
    }
  })

  it('still honours the requested style inside the language', () => {
    withNavigatorLanguage('zh-CN')
    const ranked = rankVoices(CHINESE_PHONE)
    expect(pickBestVoice(ranked, 'masculine')?.name).toBe('Daniel')
    expect(isEnglishLang(pickBestVoice(ranked, 'feminine')!.lang)).toBe(true)
  })

  it('keeps a premium English voice somebody chose themselves', () => {
    withNavigatorLanguage('zh-CN')
    const ranked = rankVoices(CHINESE_PHONE)
    const chosen = resolveVoiceChoice(
      ranked,
      'uri:Microsoft Aria Online (Natural)',
      'feminine',
    )
    expect(chosen?.name).toBe('Microsoft Aria Online (Natural)')
    expect(chosen?.tier).toBe('neural')
  })

  it('falls back to the best English voice when a saved one is gone', () => {
    withNavigatorLanguage('zh-CN')
    const ranked = rankVoices(CHINESE_PHONE)
    // A voice from another phone, or one an OS update removed.
    const chosen = resolveVoiceChoice(ranked, 'uri:Voice That No Longer Exists', 'feminine')
    expect(chosen).not.toBeNull()
    expect(isEnglishLang(chosen!.lang)).toBe(true)
  })

  it('honours a non-English voice only when it was chosen on purpose', () => {
    withNavigatorLanguage('en-US')
    const ranked = rankVoices(CHINESE_PHONE)
    // Somebody writing Chinese affirmations picked this deliberately, so it is
    // kept — the rule is "never *silently*", not "never".
    expect(resolveVoiceChoice(ranked, 'uri:Mei-Jia', 'feminine')?.lang).toBe('zh-TW')
  })

  it('reports rather than hides a device with no English voice at all', () => {
    withNavigatorLanguage('zh-CN')
    const onlyChinese = rankVoices([voice('Ting-Ting', 'zh-CN'), voice('Mei-Jia', 'zh-TW')])
    expect(voicesInLanguage(onlyChinese, 'en-US')).toHaveLength(0)

    // Something is still spoken — silence would be worse — but the app can now
    // tell, and say so, rather than sounding broken for no visible reason.
    const picked = pickBestVoice(onlyChinese, 'feminine')
    expect(picked).not.toBeNull()
    expect(isWrongLanguage(picked)).toBe(true)
  })

  it('returns nothing at all only when the device has no voices', () => {
    expect(pickBestVoice([], 'feminine')).toBeNull()
    expect(resolveVoiceChoice([], 'uri:anything', 'feminine')).toBeNull()
  })
})

describe('configuring the utterance itself', () => {
  it('always sets a language, which is what was actually broken', () => {
    withNavigatorLanguage('zh-CN', ['zh-CN'])
    const { voice: chosen, lang } = resolveDeviceVoice(CHINESE_PHONE, [], {
      style: 'feminine',
      lang: 'en-US',
    })
    expect(chosen).not.toBeNull()
    expect(isEnglishLang(chosen!.lang)).toBe(true)
    // Never null and never the interface locale: an utterance with no `lang`
    // is resolved by the engine against the platform, which is the bug.
    expect(lang).not.toBeNull()
    expect(isEnglishLang(lang!)).toBe(true)
  })

  it('gives a language even when there is no voice to take one from', () => {
    withNavigatorLanguage('zh-CN')
    const { voice: chosen, lang } = resolveDeviceVoice([], [], { style: 'feminine' })
    expect(chosen).toBeNull()
    expect(lang).toBe(DEFAULT_SPEECH_LOCALE)
  })

  it('resolves an audition exactly as real playback does', () => {
    withNavigatorLanguage('zh-CN')
    const request = { voiceURI: null, style: 'feminine' as const, lang: 'en-US' }

    // The audition path passes an empty ranked list and lets the resolver rank
    // for itself; the session passes the list it already has. Both have to land
    // on the same voice, or the picker demonstrates a voice you will not get.
    const audition = resolveDeviceVoice(CHINESE_PHONE, [], request)
    const playback = resolveDeviceVoice(
      CHINESE_PHONE,
      rankVoices(CHINESE_PHONE),
      request,
    )
    expect(audition.voice?.voiceURI).toBe(playback.voice?.voiceURI)
    expect(audition.lang).toBe(playback.lang)
  })
})
