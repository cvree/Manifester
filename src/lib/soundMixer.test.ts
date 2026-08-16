import { describe, expect, it } from 'vitest'
import { findAmbientPreset } from './ambient'
import { buildBusGraph } from './audioBus'
import { normaliseSettings } from './loops'
import {
  DEFAULT_LAYER_LEVEL,
  MAX_ACTIVE_LAYERS,
  activeSourceIds,
  clampLevel,
  describeMix,
  effectiveLevel,
  isMuted,
  layersChanged,
  levelOf,
  mixerLayers,
  primarySourceId,
  toggleMuted,
  withLayer,
  withLevel,
  withMuted,
  withoutLayer,
} from './soundMixer'
import { render, rmsOf } from './testing/audioHarness'
import { DEFAULT_SOUND, type SoundConfig, type TrackMeta } from './types'

const base: SoundConfig = { ...DEFAULT_SOUND, trackId: 'moon-garden' }

const TRACKS: TrackMeta[] = [
  { id: 'moon-garden', name: 'Moon Garden', kind: 'builtin', createdAt: 0 },
  { id: 'rain-window', name: 'Rain on Window', kind: 'builtin', createdAt: 0 },
  { id: 'ocean-tide', name: 'Ocean Tide', kind: 'builtin', createdAt: 0 },
  { id: 'file-1', name: 'My recording', kind: 'custom', createdAt: 0 },
]

describe('a level nobody has set', () => {
  it('plays at full rather than at nothing', () => {
    // A layer that arrived silent is a layer somebody adds, does not hear, and
    // concludes is broken.
    expect(levelOf(base, 'rain-window')).toBe(DEFAULT_LAYER_LEVEL)
    expect(DEFAULT_LAYER_LEVEL).toBe(1)
    expect(effectiveLevel(base, 'rain-window')).toBe(1)
  })

  it('is bounded, whatever a hand-edited backup claims', () => {
    expect(clampLevel(4)).toBe(1)
    expect(clampLevel(-2)).toBe(0)
    expect(clampLevel(Number.NaN)).toBe(DEFAULT_LAYER_LEVEL)
    expect(clampLevel(0.42)).toBeCloseTo(0.42)
  })
})

describe('each layer keeps its own level', () => {
  it('does not disturb the others when one moves', () => {
    let sound = withLayer(base, 'rain-window')
    sound = withLayer(sound, 'fireplace-glow')

    sound = withLevel(sound, 'rain-window', 0.3)
    expect(levelOf(sound, 'rain-window')).toBeCloseTo(0.3)
    // The two that were not touched are exactly where they were.
    expect(levelOf(sound, 'moon-garden')).toBe(1)
    expect(levelOf(sound, 'fireplace-glow')).toBe(1)

    sound = withLevel(sound, 'moon-garden', 0.55)
    expect(levelOf(sound, 'rain-window')).toBeCloseTo(0.3)
    expect(levelOf(sound, 'moon-garden')).toBeCloseTo(0.55)
  })

  it('survives being saved and read back', () => {
    let sound = withLayer(base, 'rain-window')
    sound = withLevel(sound, 'rain-window', 0.24)
    sound = withMuted(sound, 'moon-garden', true)

    const restored = normaliseSettings({ sound }).sound
    expect(restored.layers).toEqual(['rain-window'])
    expect(levelOf(restored, 'rain-window')).toBeCloseTo(0.24)
    expect(isMuted(restored, 'moon-garden')).toBe(true)
  })
})

describe('muting', () => {
  it('silences a layer without forgetting where its fader was', () => {
    let sound = withLevel(base, 'moon-garden', 0.4)
    sound = toggleMuted(sound, 'moon-garden')

    expect(isMuted(sound, 'moon-garden')).toBe(true)
    expect(effectiveLevel(sound, 'moon-garden')).toBe(0)
    // The level is untouched, which is the entire reason mute is its own state
    // rather than a level of zero.
    expect(levelOf(sound, 'moon-garden')).toBeCloseTo(0.4)

    sound = toggleMuted(sound, 'moon-garden')
    expect(effectiveLevel(sound, 'moon-garden')).toBeCloseTo(0.4)
  })

  it('unmutes when the fader is moved, rather than doing nothing visible', () => {
    let sound = withMuted(base, 'moon-garden', true)
    sound = withLevel(sound, 'moon-garden', 0.7)
    expect(isMuted(sound, 'moon-garden')).toBe(false)
    expect(effectiveLevel(sound, 'moon-garden')).toBeCloseTo(0.7)
  })

  it('mutes one layer without touching another', () => {
    let sound = withLayer(base, 'rain-window')
    sound = withMuted(sound, 'rain-window', true)
    expect(effectiveLevel(sound, 'rain-window')).toBe(0)
    expect(effectiveLevel(sound, 'moon-garden')).toBe(1)
  })
})

describe('stacking layers', () => {
  it('adds and removes without losing a level', () => {
    let sound = withLayer(base, 'rain-window')
    sound = withLevel(sound, 'rain-window', 0.35)
    expect(activeSourceIds(sound)).toEqual(['moon-garden', 'rain-window'])

    sound = withoutLayer(sound, 'rain-window')
    expect(activeSourceIds(sound)).toEqual(['moon-garden'])
    // Put it back and it is the rain you had, not a fresh one at full volume.
    sound = withLayer(sound, 'rain-window')
    expect(levelOf(sound, 'rain-window')).toBeCloseTo(0.35)
  })

  it('refuses a duplicate of the sound already playing', () => {
    const sound = withLayer(base, 'moon-garden')
    expect(sound.layers).toEqual([])
    expect(activeSourceIds(sound)).toEqual(['moon-garden'])
  })

  it('refuses anything that is not a generated soundscape', () => {
    // Imported files share one media element and cannot be stacked.
    expect(withLayer(base, 'file-1').layers).toEqual([])
    expect(withLayer(base, 'nonsense').layers).toEqual([])
  })

  it('stops at the budget rather than melting a phone', () => {
    let sound = base
    for (const id of ['rain-window', 'ocean-tide', 'fireplace-glow', 'soft-horizon']) {
      sound = withLayer(sound, id)
    }
    expect(activeSourceIds(sound)).toHaveLength(MAX_ACTIVE_LAYERS)
  })

  it('tells a layer change apart from a level change', () => {
    const stacked = withLayer(base, 'rain-window')
    expect(layersChanged(base, stacked)).toBe(true)

    // The distinction the engine depends on: a level must never rebuild audio.
    const quieter = withLevel(stacked, 'rain-window', 0.2)
    const mutedOne = withMuted(stacked, 'rain-window', true)
    expect(layersChanged(stacked, quieter)).toBe(false)
    expect(layersChanged(stacked, mutedOne)).toBe(false)
  })
})

describe('what the mixer draws', () => {
  it('lists the main sound first, then what is stacked under it', () => {
    let sound = withLayer(base, 'rain-window')
    sound = withLevel(sound, 'rain-window', 0.5)

    const rows = mixerLayers(sound, TRACKS)
    expect(rows.map((row) => row.id)).toEqual(['moon-garden', 'rain-window'])
    expect(rows[0].kind).toBe('primary')
    expect(rows[1].kind).toBe('layer')
    expect(rows[0].name).toBe('Moon Garden')
    expect(rows[1].level).toBeCloseTo(0.5)
  })

  it('names the playlist track that is playing, not the one that was first', () => {
    const playlist: SoundConfig = {
      ...base,
      mode: 'playlist',
      playlist: ['moon-garden', 'ocean-tide'],
    }
    expect(primarySourceId(playlist)).toBe('moon-garden')

    const rows = mixerLayers(playlist, TRACKS, 'ocean-tide')
    expect(rows[0].id).toBe('ocean-tide')
    expect(rows[0].name).toBe('Ocean Tide')
  })

  it('leaves stacked layers playing when the main sound is silence', () => {
    const sound = withLayer({ ...base, mode: 'off' }, 'rain-window')
    expect(primarySourceId(sound)).toBeNull()
    expect(activeSourceIds(sound)).toEqual(['rain-window'])
    expect(mixerLayers(sound, TRACKS).map((row) => row.id)).toEqual(['rain-window'])
  })

  it('says what is audible rather than how many rows there are', () => {
    let sound = withLayer(base, 'rain-window')
    expect(describeMix(mixerLayers(sound, TRACKS))).toBe('Moon Garden · Rain on Window')

    sound = withMuted(sound, 'rain-window', true)
    expect(describeMix(mixerLayers(sound, TRACKS))).toBe('Moon Garden')

    sound = withMuted(sound, 'moon-garden', true)
    expect(describeMix(mixerLayers(sound, TRACKS))).toBe('Every layer muted')
    expect(describeMix([])).toBe('No background sound')
  })
})

/*
 * ── And now the audio itself ──
 *
 * The arithmetic above is only worth anything if the graph honours it, so
 * these render two real soundscapes through the real mix graph and measure
 * what comes out. This is the property the whole mixer rests on: two layers,
 * two gains, and moving one changes only one.
 */
describe('independent levels, measured', () => {
  it('scales one layer without touching the other', async () => {
    const seconds = 1.5

    /** Render one preset through its own gain into the shared music node. */
    const renderPair = (rainLevel: number, fireLevel: number) =>
      render(seconds, (ctx) => {
        const graph = buildBusGraph(ctx, ctx.destination, 0.4)
        for (const [id, level] of [
          ['rain-window', rainLevel],
          ['fireplace-glow', fireLevel],
        ] as const) {
          const gain = ctx.createGain()
          gain.gain.value = level
          gain.connect(graph.music)
          findAmbientPreset(id)!.build(ctx, gain, {
            offlineSeconds: seconds,
            seed: 7,
          })
        }
      })

    const both = await renderPair(1, 1)
    const quietRain = await renderPair(0.25, 1)
    const noRain = await renderPair(0, 1)
    const fireOnly = await render(seconds, (ctx) => {
      const graph = buildBusGraph(ctx, ctx.destination, 0.4)
      const gain = ctx.createGain()
      gain.gain.value = 1
      gain.connect(graph.music)
      findAmbientPreset('fireplace-glow')!.build(ctx, gain, {
        offlineSeconds: seconds,
        seed: 7,
      })
    })

    // Turning one layer down turns the mix down…
    expect(rmsOf(quietRain.channels[0])).toBeLessThan(rmsOf(both.channels[0]))
    // …and turning it off leaves exactly the other layer, untouched.
    expect(rmsOf(noRain.channels[0])).toBeCloseTo(rmsOf(fireOnly.channels[0]), 3)
  })

  it('mutes one layer to silence while the mix keeps playing', async () => {
    const seconds = 1
    const audio = await render(seconds, (ctx) => {
      const graph = buildBusGraph(ctx, ctx.destination, 0.4)

      const muted = ctx.createGain()
      // What `effectiveLevel` produces for a muted layer.
      muted.gain.value = 0
      muted.connect(graph.music)
      findAmbientPreset('rain-window')!.build(ctx, muted, {
        offlineSeconds: seconds,
        seed: 3,
      })

      const audible = ctx.createGain()
      audible.gain.value = 0.6
      audible.connect(graph.music)
      findAmbientPreset('soft-horizon')!.build(ctx, audible, {
        offlineSeconds: seconds,
        seed: 3,
      })
    })

    // Something is still playing: muting a layer is not muting the mix.
    expect(rmsOf(audio.channels[0])).toBeGreaterThan(0)
  })
})
