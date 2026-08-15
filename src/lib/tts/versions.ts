/**
 * The numbers that decide when previously generated speech stops counting.
 *
 * Every cached clip is addressed by a hash of what it *is* — the words, the
 * voice, the speed, the language — and of the versions below, which stand for
 * everything about how it was made that the words themselves do not say. Bump
 * one of these and every clip made under the old value simply stops being
 * looked up: the new key is a different key, the old file is still valid for
 * anyone still on the old build, and nothing has to be deleted or invalidated
 * anywhere. That is the whole point of addressing audio by content.
 *
 * So the rule is: change a version whenever the *sound* would change.
 *
 *  - `VOICE_VERSION` — the logical → engine voice mapping in `voices.ts`.
 *    Pointing `female_1` at a different Kokoro voice is a new voice, even
 *    though every caller still asks for `female_1`.
 *  - `PRONUNCIATION_VERSION` — the dictionary and the normaliser. A new rule
 *    for one word changes the text sent for every phrase containing it.
 *  - `AUDIO_VERSION` — the encode settings (sample rate, channels, bitrate).
 *    The container is *not* part of this: `.opus` and `.mp3` are two encodings
 *    of the same clip and share a key, so a browser that cannot play one can
 *    ask for the other without a second synthesis.
 *
 * The model version is deliberately not here. It belongs to whichever engine
 * is installed and travels on its descriptor, so swapping Kokoro for something
 * else re-keys the cache without anybody having to remember to edit this file.
 */

/** The logical → engine voice mapping. See `voices.ts`. */
export const VOICE_VERSION = 1

/** The pronunciation dictionary and the normaliser that applies it. */
export const PRONUNCIATION_VERSION = 1

/** The encode settings: mono, 24 kHz, ~44 kbps Opus / ~64 kbps MP3. */
export const AUDIO_VERSION = 1

/**
 * The language every request carries unless it says otherwise.
 *
 * Kokoro's American English voices are the ones this app ships with, so the
 * default is the one they were trained for. It is part of the cache key rather
 * than an implicit constant so that adding a second language later is new
 * clips rather than wrong ones.
 */
export const DEFAULT_LANGUAGE = 'en-us'
