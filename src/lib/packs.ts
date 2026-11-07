/**
 * Ready-made sessions: one tap from opening the app to hearing something good.
 *
 * ── Why these exist ──
 *
 * Everything else in Manifester starts from a blank editor, and a blank editor
 * is a question — *what do you want to hear?* — that a person who has opened
 * the app at eleven at night, or two minutes before a meeting, has no capacity
 * to answer. A pack answers it. Each one is a whole session somebody has
 * already put together: the words, the room they are said in, the breath
 * under them, how long it lasts, and — for sleep — that it ends by fading out.
 *
 * ── What a pack is made of ──
 *
 * The words come from the app's own affirmation library (`affirmations.ts`),
 * blended round-robin from two themes so a pack is never just one note. That
 * is not only reuse: those exact lines are pre-generated in the studio voice
 * at build time, so a pack plays instantly in the good voice on a brand new
 * device with nothing downloaded. See `tts/knownPhrases.ts`.
 *
 * Everything a pack sets is the person's to change afterwards. Playing one
 * loads it into the editor like any loop; the voice they chose is kept.
 */

import { findFocus, type Focus, type FocusId } from './affirmations'
import {
  BRAINWAVE_PRESETS,
  DEFAULT_BRAINWAVE,
  type BrainwavePresetId,
} from './brainwaveAudio'
import { BREATH_PRESETS, type BreathPattern } from './breathing'
import {
  DEFAULT_SOUND,
  type LoopSettings,
  type SavedLoop,
} from './types'

export interface Pack {
  id: string
  title: string
  /** When you would reach for it, as the card's eyebrow: "Before bed". */
  when: string
  /** One line saying what it does for you. */
  promise: string
  glyph: Focus['glyph']
  tone: Focus['tone']
  /** Themes the words are drawn from, first leads. */
  focuses: FocusId[]
  /** How many lines. Six is a pass of about a minute at the default pace. */
  lineCount: number
  /** Minutes, or `null` for open-ended. Ignored when `sleepMinutes` is set. */
  timerMinutes: number | null
  /** Set for a pack that ends by fading out. See `lib/sleep`. */
  sleepMinutes?: number
  /** A built-in soundscape id, or `null` for words and breath alone. */
  sound: string | null
  /** Background level, 0–2. */
  musicVolume: number
  /** A `BREATH_PRESETS` id. */
  breath: string
  /** A brainwave rhythm under it all, at a low level, or `null`. */
  rhythm: { preset: BrainwavePresetId; volume: number } | null
  /** Seconds of quiet between passes. */
  repeatPauseSeconds: number
}

export const PACKS: Pack[] = [
  {
    id: 'drift-off',
    title: 'Drift off',
    when: 'Before bed',
    promise: 'Rain, a slow breath, and words that let the day go. Fades out by itself.',
    glyph: 'moon',
    tone: 'twilight',
    focuses: ['sleep', 'night'],
    lineCount: 8,
    timerMinutes: null,
    sleepMinutes: 30,
    sound: 'rain-window',
    musicVolume: 0.45,
    breath: 'deep-rest',
    rhythm: { preset: 'delta', volume: 0.3 },
    repeatPauseSeconds: 6,
  },
  {
    id: 'come-back-to-calm',
    title: 'Come back to calm',
    when: 'When it is all a bit much',
    promise: 'A long out-breath and the tide. Ten minutes to let the noise settle.',
    glyph: 'breath',
    tone: 'twilight',
    focuses: ['calm', 'resilience'],
    lineCount: 6,
    timerMinutes: 10,
    sound: 'ocean-tide',
    musicVolume: 0.4,
    breath: 'sigh',
    rhythm: null,
    repeatPauseSeconds: 4,
  },
  {
    id: 'before-something-big',
    title: 'Before something big',
    when: 'Five minutes before',
    promise: 'Steady words and a steadying breath, for walking in like you belong.',
    glyph: 'spark',
    tone: 'rose',
    focuses: ['confidence', 'career'],
    lineCount: 6,
    timerMinutes: 5,
    sound: 'soft-horizon',
    musicVolume: 0.35,
    breath: 'triangle',
    rhythm: null,
    repeatPauseSeconds: 2,
  },
  {
    id: 'start-the-day',
    title: 'Start the day',
    when: 'First thing',
    promise: 'A brightening breath and a few honest reasons to begin.',
    glyph: 'sun',
    tone: 'gold',
    focuses: ['morning', 'motivation'],
    lineCount: 6,
    timerMinutes: 5,
    sound: 'soft-horizon',
    musicVolume: 0.35,
    breath: 'awaken',
    rhythm: null,
    repeatPauseSeconds: 2,
  },
  {
    id: 'settle-into-work',
    title: 'Settle into work',
    when: 'Before you focus',
    promise: 'Rain on the window, box breathing, and one thing at a time.',
    glyph: 'book',
    tone: 'sage',
    focuses: ['discipline', 'school'],
    lineCount: 6,
    timerMinutes: 20,
    sound: 'rain-window',
    musicVolume: 0.35,
    breath: 'box',
    rhythm: { preset: 'beta', volume: 0.25 },
    repeatPauseSeconds: 8,
  },
  {
    id: 'kinder-to-yourself',
    title: 'Kinder to yourself',
    when: 'On a hard day',
    promise: 'Words that are true even today, by the fire.',
    glyph: 'heart',
    tone: 'rose',
    focuses: ['self-worth', 'resilience'],
    lineCount: 6,
    timerMinutes: 10,
    sound: 'fireplace-glow',
    musicVolume: 0.4,
    breath: 'calm',
    rhythm: null,
    repeatPauseSeconds: 4,
  },
  {
    id: 'evening-gratitude',
    title: 'Evening gratitude',
    when: 'At the end of the day',
    promise: 'Notice what went right, slowly, in the garden at night.',
    glyph: 'leaf',
    tone: 'sage',
    focuses: ['gratitude', 'night'],
    lineCount: 6,
    timerMinutes: 10,
    sound: 'moon-garden',
    musicVolume: 0.4,
    breath: 'even',
    rhythm: { preset: 'alpha', volume: 0.25 },
    repeatPauseSeconds: 4,
  },
]

export function findPack(id: string | null | undefined): Pack | null {
  if (!id) return null
  return PACKS.find((pack) => pack.id === id) ?? null
}

/** The words, blended round-robin from the pack's themes, best lines first. */
export function packLines(pack: Pack): string[] {
  const focuses = pack.focuses
    .map((id) => findFocus(id))
    .filter((focus): focus is Focus => focus != null)
  const lines: string[] = []
  const seen = new Set<string>()
  const depth = Math.max(0, ...focuses.map((focus) => focus.lines.length))
  for (let rank = 0; rank < depth && lines.length < pack.lineCount; rank += 1) {
    for (const focus of focuses) {
      if (lines.length >= pack.lineCount) break
      const line = focus.lines[rank]?.trim()
      if (!line || seen.has(line)) continue
      seen.add(line)
      lines.push(line)
    }
  }
  return lines
}

export function packBreath(pack: Pack): { name: string; pattern: BreathPattern } {
  const preset = BREATH_PRESETS.find((item) => item.id === pack.breath) ?? BREATH_PRESETS[0]
  return { name: preset.name, pattern: preset.pattern }
}

/** "30 min · fades out", "10 min", "Until you stop". */
export function packLength(pack: Pack): string {
  if (pack.sleepMinutes) return `${pack.sleepMinutes} min · fades out`
  if (pack.timerMinutes == null) return 'Until you stop'
  return `${pack.timerMinutes} min`
}

/**
 * A pack as a loop, on top of somebody's own settings.
 *
 * What is *theirs* survives — who reads it, how fast, how loud the voice is —
 * and what makes the pack itself replaces the rest. The id is stable per pack,
 * so playing the same pack twice files it once in the library, not twice.
 */
export function packToLoop(
  pack: Pack,
  base: LoopSettings,
  now: number = Date.now(),
): SavedLoop {
  const settings: LoopSettings = {
    ...base,
    timerMinutes: pack.sleepMinutes ? null : pack.timerMinutes,
    repeatPauseSeconds: pack.repeatPauseSeconds,
    musicVolume: pack.musicVolume,
    // A recording of somebody's own voice belongs to *their* words.
    recordingId: null,
    sound: pack.sound
      ? {
          ...DEFAULT_SOUND,
          mode: 'single',
          trackId: pack.sound,
          layers: [],
          levels: {},
          muted: [],
        }
      : { ...DEFAULT_SOUND, mode: 'off', layers: [], levels: {}, muted: [] },
    brainwave: pack.rhythm
      ? {
          ...DEFAULT_BRAINWAVE,
          enabled: true,
          preset: pack.rhythm.preset,
          targetHz: BRAINWAVE_PRESETS[pack.rhythm.preset].targetHz,
          volume: pack.rhythm.volume,
        }
      : { ...base.brainwave, enabled: false },
  }
  return {
    ...settings,
    id: `pack-${pack.id}`,
    title: pack.title,
    text: packLines(pack).join('\n'),
    createdAt: now,
    updatedAt: now,
    lastPlayedAt: null,
    origin: 'played',
  }
}
