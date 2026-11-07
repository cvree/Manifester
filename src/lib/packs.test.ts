import { describe, expect, it } from 'vitest'
import { allAffirmations, findFocus } from './affirmations'
import { AMBIENT_PRESETS } from './ambient'
import { BREATH_PRESETS } from './breathing'
import { normaliseSettings } from './loops'
import { PACKS, findPack, packLength, packLines, packToLoop } from './packs'
import { DEFAULT_SETTINGS } from './types'

describe('packs', () => {
  it('have unique ids', () => {
    expect(new Set(PACKS.map((pack) => pack.id)).size).toBe(PACKS.length)
  })

  it('point only at things that exist', () => {
    const sounds = new Set<string>(AMBIENT_PRESETS.map((preset) => preset.id))
    const breaths = new Set(BREATH_PRESETS.map((preset) => preset.id))
    for (const pack of PACKS) {
      for (const focus of pack.focuses) expect(findFocus(focus), focus).not.toBeNull()
      if (pack.sound) expect(sounds.has(pack.sound), pack.sound).toBe(true)
      expect(breaths.has(pack.breath), pack.breath).toBe(true)
    }
  })

  it('blend their themes, best lines first, with no repeats', () => {
    for (const pack of PACKS) {
      const lines = packLines(pack)
      expect(lines).toHaveLength(pack.lineCount)
      expect(new Set(lines).size).toBe(lines.length)
      expect(lines[0]).toBe(findFocus(pack.focuses[0])?.lines[0])
      expect(lines[1]).toBe(findFocus(pack.focuses[1])?.lines[0])
    }
  })

  it('only use lines the studio voice is pre-generated for', () => {
    const known = new Set(allAffirmations())
    for (const pack of PACKS) {
      for (const line of packLines(pack)) expect(known.has(line), line).toBe(true)
    }
  })

  it('keep the listener’s own voice and replace the rest', () => {
    const base = {
      ...DEFAULT_SETTINGS,
      voiceStyle: 'masculine' as const,
      rate: 1.1,
      voiceVolume: 0.5,
      recordingId: 'rec-1',
    }
    const pack = findPack('come-back-to-calm')!
    const loop = packToLoop(pack, base, 1000)
    expect(loop).toMatchObject({
      id: 'pack-come-back-to-calm',
      title: 'Come back to calm',
      voiceStyle: 'masculine',
      rate: 1.1,
      voiceVolume: 0.5,
      recordingId: null,
      timerMinutes: 10,
      origin: 'played',
    })
    expect(loop.sound).toMatchObject({ mode: 'single', trackId: 'ocean-tide', layers: [] })
    expect(loop.brainwave.enabled).toBe(false)
  })

  it('survive normalisation unchanged', () => {
    for (const pack of PACKS) {
      const loop = packToLoop(pack, DEFAULT_SETTINGS, 1000)
      const settings = normaliseSettings(loop)
      expect(settings.sound.trackId).toBe(loop.sound.trackId)
      expect(settings.brainwave).toEqual(loop.brainwave)
      expect(settings.timerMinutes).toBe(loop.timerMinutes)
    }
  })

  it('leave the sleep pack to the sleep timer', () => {
    const pack = findPack('drift-off')!
    expect(packToLoop(pack, DEFAULT_SETTINGS).timerMinutes).toBeNull()
    expect(packLength(pack)).toBe('30 min · fades out')
  })
})
