import { describe, expect, it } from 'vitest'
import { DEFAULT_BRAINWAVE, getTargetHz } from './brainwaveAudio'
import {
  absorbedBySave,
  autoTitle,
  draftToLoop,
  loopToDraft,
  MAX_PLAYED_LOOPS,
  normaliseLoop,
  normaliseSettings,
  pickLaunchLoop,
  planPlay,
  sortLibrary,
  splitLibrary,
  type Draft,
  type PlayRecord,
} from './loops'
import { DEFAULT_SETTINGS, type LoopSettings, type SavedLoop } from './types'

/** A loop exactly as the previous version of the app would have written it. */
const LEGACY_LOOP = {
  id: 'loop-legacy',
  title: 'Morning words',
  text: 'I am steady today.',
  createdAt: 1,
  updatedAt: 2,
  lastPlayedAt: null,
  voiceStyle: 'feminine',
  voiceURI: null,
  voiceName: null,
  recordingId: null,
  rate: 0.9,
  pitch: 1,
  voiceVolume: 1,
  musicVolume: 0.35,
  repeatPauseSeconds: 3,
  timerMinutes: 20,
  sound: {
    mode: 'single',
    trackId: 'soft-horizon',
    playlist: [],
    repeat: 'all',
  },
} as unknown as SavedLoop

describe('older saved rituals', () => {
  it('loads a loop that has never heard of the new settings', () => {
    const draft = loopToDraft(LEGACY_LOOP)

    // Everything the older version did save is untouched.
    expect(draft.title).toBe('Morning words')
    expect(draft.settings.sound.trackId).toBe('soft-horizon')
    expect(draft.settings.timerMinutes).toBe(20)
    expect(draft.settings.musicVolume).toBe(0.35)

    // Everything it did not save arrives at a safe default.
    expect(draft.settings.brainwave).toEqual(DEFAULT_BRAINWAVE)
    expect(draft.settings.brainwave.enabled).toBe(false)
    expect(draft.settings.sound.rainCharacter).toBe('steady')
  })

  it('does not turn a feature on during migration', () => {
    const settings = normaliseSettings({})
    expect(settings.brainwave.enabled).toBe(false)
  })

  /*
   * The voice slider used to run to 200%, on the theory that an exported
   * recording could use the headroom the spoken voice never could. It never
   * sounded louder than 100% either way, so a loop saved up there comes back
   * at the level it was actually playing at — and, crucially, at a value the
   * slider can now represent.
   */
  it('brings a voice level saved above the old ceiling back to 100%', () => {
    expect(normaliseSettings({ voiceVolume: 2 }).voiceVolume).toBe(1)
    expect(normaliseSettings({ voiceVolume: 1.4 }).voiceVolume).toBe(1)

    const draft = loopToDraft({ ...LEGACY_LOOP, voiceVolume: 1.8 })
    expect(draft.settings.voiceVolume).toBe(1)
  })

  it('leaves a voice level inside the ceiling exactly as it was', () => {
    expect(normaliseSettings({ voiceVolume: 0.55 }).voiceVolume).toBeCloseTo(0.55)
    expect(normaliseSettings({ voiceVolume: 0 }).voiceVolume).toBe(0)
  })

  it('survives a partially written record', () => {
    const settings = normaliseSettings({
      musicVolume: 0.2,
      sound: { mode: 'off' } as LoopSettings['sound'],
    })
    expect(settings.sound.mode).toBe('off')
    expect(settings.sound.playlist).toEqual([])
    expect(settings.sound.rainCharacter).toBe('steady')
    expect(settings.brainwave.enabled).toBe(false)
  })

  it('replaces an unrecognised rain character rather than indexing on it', () => {
    const settings = normaliseSettings({
      sound: { ...DEFAULT_SETTINGS.sound, rainCharacter: 'thunderstorm' as never },
    })
    expect(settings.sound.rainCharacter).toBe('steady')
  })

  it('rebuilds a rhythm frequency that disagrees with its preset', () => {
    const settings = normaliseSettings({
      brainwave: {
        ...DEFAULT_BRAINWAVE,
        enabled: true,
        preset: 'theta',
        targetHz: 432 as never,
      },
    })
    expect(settings.brainwave.targetHz).toBe(6)
    expect(settings.brainwave.targetHz).toBe(getTargetHz('theta'))
  })
})

describe('saving a ritual', () => {
  const draft: Draft = {
    id: 'loop-1',
    title: 'Evening',
    text: 'I rest easily.',
    settings: normaliseSettings({
      musicVolume: 0.3,
      sound: {
        mode: 'single',
        trackId: 'rain-window',
        playlist: [],
        repeat: 'one',
        rainCharacter: 'full',
      },
      brainwave: {
        enabled: true,
        preset: 'delta',
        targetHz: 2,
        mode: 'binaural',
        volume: 0.22,
        depth: 0.55,
      },
    }),
  }

  it('keeps the chosen rhythm, mode, level and intensity', () => {
    const saved = draftToLoop(draft)
    expect(saved.brainwave).toEqual({
      enabled: true,
      preset: 'delta',
      targetHz: 2,
      mode: 'binaural',
      volume: 0.22,
      depth: 0.55,
    })
    expect(saved.sound.rainCharacter).toBe('full')
  })

  it('round-trips through storage without drift', () => {
    const saved = draftToLoop(draft)
    const reloaded = loopToDraft(saved)
    expect(reloaded.settings.brainwave).toEqual(draft.settings.brainwave)
    expect(reloaded.settings.sound).toEqual(draft.settings.sound)
    expect(reloaded.title).toBe('Evening')
  })

  it('copies the rhythm rather than sharing it with the draft', () => {
    const saved = draftToLoop(draft)
    expect(saved.brainwave).not.toBe(draft.settings.brainwave)
    expect(saved.sound).not.toBe(draft.settings.sound)
  })
})

describe('defaults', () => {
  it('ships with the rhythm off and rain at its middle setting', () => {
    expect(DEFAULT_SETTINGS.brainwave.enabled).toBe(false)
    expect(DEFAULT_SETTINGS.sound.rainCharacter).toBe('steady')
    // The existing default sound is unchanged, so no-one's saved loop moves.
    expect(DEFAULT_SETTINGS.sound.trackId).toBe('moon-garden')
  })
})

describe('returning-user launch loop', () => {
  const make = (id: string, updatedAt: number, lastPlayedAt: number | null): SavedLoop => ({
    ...LEGACY_LOOP,
    id,
    text: `Words for ${id}`,
    updatedAt,
    lastPlayedAt,
  })

  it('restores the most recently played loop, not merely the most recently edited', () => {
    const last = pickLaunchLoop([
      make('edited', 900, 100),
      make('played', 500, 800),
    ])
    expect(last?.id).toBe('played')
  })

  it('uses the most recently updated loop before anything has been played', () => {
    expect(pickLaunchLoop([make('old', 1, null), make('new', 2, null)])?.id).toBe('new')
  })

  it('keeps the true empty state when there is no saved content', () => {
    expect(pickLaunchLoop([])).toBeNull()
    expect(
      pickLaunchLoop([
        { ...make('blank', 1, null), text: '   ' },
        { ...make('blank-2', 2, null), text: '   ' },
      ]),
    ).toBeNull()
  })
})

describe('capturing what was played', () => {
  const settings = normaliseSettings({ musicVolume: 0.3 })
  const play = (text: string, id: string | null = null, title = ''): PlayRecord => ({
    id,
    title,
    text,
    settings,
  })
  const stored = (
    id: string,
    text: string,
    origin: 'kept' | 'played',
    lastPlayedAt: number | null,
  ): SavedLoop => ({
    ...LEGACY_LOOP,
    ...normaliseSettings({}),
    id,
    title: id,
    text,
    createdAt: 1,
    updatedAt: lastPlayedAt ?? 1,
    lastPlayedAt,
    origin,
  })

  it('keeps words nobody saved, under Recent plays', () => {
    const plan = planPlay([], play('I am steady today.'), 100)
    expect(plan?.created).toBe(true)
    expect(plan?.save.origin).toBe('played')
    expect(plan?.save.text).toBe('I am steady today.')
    expect(plan?.save.lastPlayedAt).toBe(100)
    // Named from its own opening words rather than left as "Untitled loop".
    expect(plan?.save.title).toBe('I am steady today.')
  })

  it('has nothing to keep when there are no words', () => {
    expect(planPlay([], play('   '), 100)).toBeNull()
  })

  it('refreshes the same capture rather than laying down another', () => {
    const first = planPlay([], play('I rest easily.'), 100)
    const again = planPlay([first!.save], play('I rest easily.', first!.save.id), 200)
    expect(again?.created).toBe(false)
    expect(again?.save.id).toBe(first!.save.id)
    expect(again?.save.lastPlayedAt).toBe(200)
    expect(again?.save.createdAt).toBe(100)
  })

  it('recognises the same words typed again without an id', () => {
    const first = planPlay([], play('I rest easily.'), 100)
    const again = planPlay([first!.save], play('  I REST   easily. '), 200)
    expect(again?.created).toBe(false)
    expect(again?.save.id).toBe(first!.save.id)
  })

  /*
   * The one thing a play must never do is edit something the user saved.
   * Playing a kept loop marks it played; playing an unsaved variation of it
   * is captured separately, so both survive.
   */
  it('stamps a kept loop instead of rewriting it', () => {
    const keptLoop = stored('kept-1', 'I am safe.', 'kept', 5)
    const plan = planPlay([keptLoop], play('I am safe.', 'kept-1', 'Renamed'), 300)
    expect(plan?.origin).toBe('kept')
    expect(plan?.save.origin).toBe('kept')
    expect(plan?.save.title).toBe('kept-1')
    expect(plan?.save.musicVolume).toBe(keptLoop.musicVolume)
    expect(plan?.save.lastPlayedAt).toBe(300)
    expect(plan?.drop).toEqual([])
  })

  it('captures an unsaved edit of a kept loop without touching the original', () => {
    const keptLoop = stored('kept-1', 'I am safe.', 'kept', 5)
    const plan = planPlay([keptLoop], play('I am safe. I can rest.', 'kept-1'), 300)
    expect(plan?.created).toBe(true)
    expect(plan?.save.id).not.toBe('kept-1')
    expect(plan?.save.origin).toBe('played')
  })

  it('holds only the most recent plays, and never a saved loop', () => {
    const history = Array.from({ length: MAX_PLAYED_LOOPS }, (_, index) =>
      stored(`played-${index}`, `Words ${index}`, 'played', 100 + index),
    )
    const library = [stored('kept-1', 'Kept words', 'kept', 1), ...history]
    const plan = planPlay(library, play('Something new'), 999)
    expect(plan?.created).toBe(true)
    // Exactly one falls off: the oldest capture, and nothing that was saved.
    expect(plan?.drop).toEqual(['played-0'])
    const after = [
      plan!.save,
      ...library.filter((loop) => !plan!.drop.includes(loop.id)),
    ]
    expect(after.filter((loop) => loop.origin === 'played')).toHaveLength(
      MAX_PLAYED_LOOPS,
    )
    expect(after.some((loop) => loop.id === 'kept-1')).toBe(true)
  })

  it('drops nothing while replaying inside a full history', () => {
    const history = Array.from({ length: MAX_PLAYED_LOOPS }, (_, index) =>
      stored(`played-${index}`, `Words ${index}`, 'played', 100 + index),
    )
    const plan = planPlay(history, play('Words 0', 'played-0'), 999)
    expect(plan?.drop).toEqual([])
  })

  it('lets a save absorb the capture of the same words', () => {
    const capture = planPlay([], play('I am steady today.'), 100)!.save
    const other = stored('played-2', 'Different words.', 'played', 50)
    const kept = { ...capture, id: 'kept-1', origin: 'kept' as const }
    expect(absorbedBySave([capture, other], kept)).toEqual([capture.id])
    // Nothing is absorbed by saving the very record being saved.
    expect(absorbedBySave([capture, other], { ...capture, origin: 'kept' })).toEqual([])
  })

  it('graduates a capture when it is finally saved', () => {
    const capture = planPlay([], play('I am steady today.'), 100)!.save
    const saved = draftToLoop(loopToDraft(capture), capture)
    expect(saved.id).toBe(capture.id)
    expect(saved.origin).toBe('kept')
    expect(saved.createdAt).toBe(capture.createdAt)
  })
})

describe('library order', () => {
  const make = (
    id: string,
    origin: 'kept' | 'played',
    updatedAt: number,
    lastPlayedAt: number | null,
  ): SavedLoop => ({
    ...LEGACY_LOOP,
    id,
    title: id,
    updatedAt,
    lastPlayedAt,
    origin,
  })

  it('shows what was saved before what was merely played', () => {
    const order = sortLibrary([
      make('played-new', 'played', 900, 900),
      make('kept-old', 'kept', 10, 5),
      make('played-old', 'played', 100, 100),
      make('kept-new', 'kept', 50, null),
    ]).map((loop) => loop.id)
    expect(order).toEqual(['kept-new', 'kept-old', 'played-new', 'played-old'])
  })

  it('splits the two groups in that same order', () => {
    const { kept, played } = splitLibrary([
      make('played-1', 'played', 5, 5),
      make('kept-1', 'kept', 9, null),
    ])
    expect(kept.map((loop) => loop.id)).toEqual(['kept-1'])
    expect(played.map((loop) => loop.id)).toEqual(['played-1'])
  })

  it('treats a loop saved before plays were captured as kept', () => {
    expect(normaliseLoop(LEGACY_LOOP).origin).toBe('kept')
    // Even unmigrated, it sorts above a capture rather than among them.
    const order = sortLibrary([
      make('played-1', 'played', 900, 900),
      LEGACY_LOOP,
    ]).map((loop) => loop.id)
    expect(order).toEqual(['loop-legacy', 'played-1'])
  })
})

describe('naming words nobody named', () => {
  it('uses the opening line', () => {
    expect(autoTitle('I am calm.\nI am here.')).toBe('I am calm.')
  })

  it('shortens a long line rather than filling the card with it', () => {
    const title = autoTitle(
      'I am allowed to rest today and tomorrow and every day after that.',
    )
    expect(title.length).toBeLessThanOrEqual(49)
    expect(title.endsWith('…')).toBe(true)
  })

  it('falls back when there are no words at all', () => {
    expect(autoTitle('   \n  ')).toBe('Untitled loop')
  })
})
