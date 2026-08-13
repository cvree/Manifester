import { describe, expect, it } from 'vitest'
import { DEFAULT_BRAINWAVE, getTargetHz } from './brainwaveAudio'
import { draftToLoop, loopToDraft, normaliseSettings, pickLaunchLoop, type Draft } from './loops'
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
