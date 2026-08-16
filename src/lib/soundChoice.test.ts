import { describe, expect, it } from 'vitest'
import {
  chooseSound,
  currentSoundChoice,
  isSoundChoiceActive,
  soundPlaybackChanged,
} from './soundChoice'
import type { SoundConfig } from './types'

const base: SoundConfig = {
  mode: 'single',
  trackId: 'moon-garden',
  playlist: ['moon-garden', 'ocean-tide'],
  repeat: 'one',
  rainCharacter: 'steady',
  layers: [],
  levels: {},
  muted: [],
}

describe('choosing a sound', () => {
  it('names the choice a configuration already represents', () => {
    expect(currentSoundChoice(base)).toEqual({ kind: 'track', id: 'moon-garden' })
    expect(currentSoundChoice({ ...base, mode: 'off' })).toEqual({ kind: 'off' })
    expect(currentSoundChoice({ ...base, mode: 'playlist' })).toEqual({
      kind: 'playlist',
    })
    // Single mode with nothing chosen is silence, whatever the mode says.
    expect(currentSoundChoice({ ...base, trackId: null })).toEqual({ kind: 'off' })
  })

  it('marks only the active choice as active', () => {
    expect(isSoundChoiceActive(base, { kind: 'track', id: 'moon-garden' })).toBe(true)
    expect(isSoundChoiceActive(base, { kind: 'track', id: 'ocean-tide' })).toBe(false)
    expect(isSoundChoiceActive(base, { kind: 'playlist' })).toBe(false)
    expect(isSoundChoiceActive({ ...base, mode: 'off' }, { kind: 'off' })).toBe(true)
  })

  it('sets the mode and the track together, in one tap', () => {
    const next = chooseSound({ ...base, mode: 'off' }, {
      kind: 'track',
      id: 'rain-window',
    })
    expect(next.mode).toBe('single')
    expect(next.trackId).toBe('rain-window')
  })

  it('keeps the playlist while a single sound is chosen', () => {
    const single = chooseSound(base, { kind: 'track', id: 'rain-window' })
    expect(single.playlist).toEqual(base.playlist)
    // …so going back to the queue is one tap, not a rebuild.
    expect(chooseSound(single, { kind: 'playlist' })).toMatchObject({
      mode: 'playlist',
      playlist: base.playlist,
    })
  })

  it('keeps the chosen sound when it is switched off', () => {
    expect(chooseSound(base, { kind: 'off' })).toMatchObject({
      mode: 'off',
      trackId: 'moon-garden',
    })
  })
})

describe('what counts as different audio', () => {
  it('sees a different sound, mode or queue', () => {
    expect(soundPlaybackChanged(base, chooseSound(base, { kind: 'off' }))).toBe(true)
    expect(
      soundPlaybackChanged(base, chooseSound(base, { kind: 'track', id: 'ocean-tide' })),
    ).toBe(true)
    expect(soundPlaybackChanged(base, chooseSound(base, { kind: 'playlist' }))).toBe(true)

    const queued: SoundConfig = { ...base, mode: 'playlist' }
    expect(soundPlaybackChanged(queued, { ...queued, playlist: ['ocean-tide'] })).toBe(
      true,
    )
    expect(soundPlaybackChanged(queued, { ...queued, repeat: 'all' })).toBe(true)
  })

  it('leaves a running ambience alone for its own settings', () => {
    // Rain's character crossfades inside the engine; rebuilding the queue for
    // it would restart the ambience audibly.
    expect(soundPlaybackChanged(base, { ...base, rainCharacter: 'full' })).toBe(false)
    // Repeat has nothing to repeat while one sound is playing.
    expect(soundPlaybackChanged(base, { ...base, repeat: 'all' })).toBe(false)
    // And a queue that is merely re-listed in the same order is the same queue.
    const queued: SoundConfig = { ...base, mode: 'playlist' }
    expect(soundPlaybackChanged(queued, { ...queued, playlist: [...queued.playlist] })).toBe(
      false,
    )
  })

  it('says nothing changed when nothing changed', () => {
    expect(soundPlaybackChanged(base, { ...base })).toBe(false)
    expect(
      soundPlaybackChanged({ ...base, mode: 'off' }, { ...base, mode: 'off' }),
    ).toBe(false)
  })
})
