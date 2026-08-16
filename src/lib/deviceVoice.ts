/**
 * Turning a saved choice into an actual `SpeechSynthesisUtterance`.
 *
 * One function, used by both paths that speak through the platform: the
 * emergency fallback in `tts/fallback.ts`, and the audition in the voice
 * picker. They used to resolve a voice separately and configure an utterance
 * separately, which is why auditioning a voice and then listening to a session
 * could give you two different voices reading in two different accents — the
 * picker set `lang` from the matched voice and the session set it from nothing
 * at all.
 *
 * Sharing this is what makes "press it, hear it, that is what you get" true.
 */

import {
  pickBestVoice,
  rankVoices,
  resolveVoiceChoice,
  type RankedVoice,
} from './voiceRanking'
import { contentLanguage, speechLocaleFor } from './voiceLanguage'

export interface DeviceVoiceRequest {
  /** An exact voice somebody chose, if they did. */
  voiceURI?: string | null
  style: 'feminine' | 'masculine'
  /**
   * The language of the words. Omitted means "this app's content language",
   * which is English — never the interface locale.
   */
  lang?: string | null
}

/**
 * Which installed voice should read this, and in which language.
 *
 * Three rules, and the order is the whole design:
 *
 *  1. An exact `voiceURI` that is still installed wins. Somebody who went and
 *     found a premium English voice keeps it, in the language that voice
 *     itself declares.
 *  2. Otherwise — including when a saved voice has been uninstalled or is
 *     simply absent on this device — the best voice *in the wanted language*.
 *     Never the highest-ranked voice overall, which on a non-English phone is
 *     a non-English voice.
 *  3. The utterance always carries an explicit `lang`, taken from the chosen
 *     voice or, when nothing could be chosen, from the wanted language. A
 *     `lang` left unset is resolved by the engine against the platform locale,
 *     which is the precise mechanism that made English affirmations sound
 *     Chinese.
 */
export function resolveDeviceVoice(
  voices: SpeechSynthesisVoice[],
  ranked: RankedVoice[],
  request: DeviceVoiceRequest,
): { voice: SpeechSynthesisVoice | null; lang: string | null } {
  const language = request.lang ?? contentLanguage()
  const list = ranked.length > 0 ? ranked : rankVoices(voices, language ?? undefined)

  const wanted = language
    ? resolveVoiceChoice(list, request.voiceURI ?? null, request.style, language)
    : (request.voiceURI
        ? (list.find((voice) => voice.voiceURI === request.voiceURI) ?? null)
        : null) ?? pickBestVoice(list, request.style)

  const voice =
    wanted != null
      ? (voices.find((item) => item.voiceURI === wanted.voiceURI) ?? null)
      : null

  return { voice, lang: voice?.lang ?? language }
}

/**
 * Configure an utterance's voice and language together.
 *
 * Together, because they are one decision. Setting a voice without a language
 * leaves a gap the platform fills in, and setting a language without a voice
 * leaves the engine to pick — either half on its own is how this went wrong.
 */
export function applyDeviceVoice(
  utterance: SpeechSynthesisUtterance,
  voices: SpeechSynthesisVoice[],
  ranked: RankedVoice[],
  request: DeviceVoiceRequest,
): SpeechSynthesisVoice | null {
  const { voice, lang } = resolveDeviceVoice(voices, ranked, request)
  if (voice) utterance.voice = voice
  if (lang) utterance.lang = lang
  return voice
}

/**
 * The language tag a line of text should be spoken in.
 *
 * Re-exported here so callers only have to know about one module when they are
 * about to speak. See `voiceLanguage.speechLocaleFor`.
 */
export function langForText(text: string): string | null {
  return speechLocaleFor(text)
}
