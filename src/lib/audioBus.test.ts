import { describe, expect, it } from 'vitest'
import { AMBIENT_PRESETS, findAmbientPreset } from './ambient'
import { MAX_MUSIC_VOLUME, MUSIC_MAKEUP_GAIN, buildBusGraph } from './audioBus'
import { createBrainwaveGraph } from './brainwaveAudio'
import { peakOf, render, rmsOf } from './testing/audioHarness'

describe('the generated-sound mix', () => {
  it('wires ambience and rhythm as siblings under one volume', async () => {
    await render(0.2, (ctx) => {
      const graph = buildBusGraph(ctx, ctx.destination, 0.4)

      // The node carries the setting times the fixed makeup boost, not the
      // raw setting — the slider still reads 40%.
      expect(graph.generated.gain.value).toBeCloseTo(0.4 * MUSIC_MAKEUP_GAIN)
      // Neither layer carries the user's volume itself, so turning one off
      // cannot change the other's level.
      expect(graph.music.gain.value).toBe(1)
      expect(graph.rhythm.gain.value).toBe(1)
      expect(graph.master.gain.value).toBe(1)
    })
  })

  it('uses a fixed curve for the ceiling, not an engine-dependent compressor', async () => {
    await render(0.2, (ctx) => {
      const graph = buildBusGraph(ctx, ctx.destination, 1)
      const curve = graph.ceiling.curve
      expect(curve).not.toBeNull()

      // Identity across the whole range real listening occupies…
      const at = (x: number) => curve![Math.round(((x + 1) / 2) * (curve!.length - 1))]
      for (const x of [-0.6, -0.3, 0, 0.3, 0.6, 0.69]) {
        expect(at(x)).toBeCloseTo(x, 3)
      }
      // …and a hard stop below full scale at the extremes.
      expect(Math.abs(curve![0])).toBeLessThan(1)
      expect(Math.abs(curve![curve!.length - 1])).toBeLessThan(1)
      for (const value of curve!) expect(Math.abs(value)).toBeLessThan(1)
    })
  })

  it('passes ordinary levels through the safety curve untouched', async () => {
    // The curve has to be the identity in the range real listening occupies,
    // or it would be shaping the sound rather than protecting it.
    const plain = await render(
      2,
      (ctx) => {
        const osc = ctx.createOscillator()
        osc.frequency.value = 220
        const trim = ctx.createGain()
        trim.gain.value = 0.45
        osc.connect(trim)
        trim.connect(ctx.destination)
        osc.start()
      },
      1,
      22_050,
    )

    const shaped = await render(
      2,
      (ctx) => {
        const graph = buildBusGraph(ctx, ctx.destination, 1)
        const osc = ctx.createOscillator()
        osc.frequency.value = 220
        const trim = ctx.createGain()
        trim.gain.value = 0.45
        osc.connect(trim)
        trim.connect(graph.music)
        osc.start()
      },
      1,
      22_050,
    )

    /*
     * The ceiling itself is still the identity here: the only difference
     * between the two paths is the deliberate makeup boost. Asserting the
     * exact ratio is what keeps this a transparency test — if the boost ever
     * grows enough to push this 0.45 probe past the linear region, the shaped
     * peak stops being 1.5x the plain one and this fails, which is precisely
     * the warning we want.
     */
    expect(peakOf(shaped.channels[0])).toBeCloseTo(
      peakOf(plain.channels[0]) * MUSIC_MAKEUP_GAIN,
      3,
    )
  })

  it('cannot emit above full scale however much is thrown at it', async () => {
    // Deliberately absurd: far more level than the app can ever produce.
    const { channels } = await render(
      1,
      (ctx) => {
        const graph = buildBusGraph(ctx, ctx.destination, 1)
        for (let i = 0; i < 12; i += 1) {
          const osc = ctx.createOscillator()
          osc.frequency.value = 90 + i * 37
          const trim = ctx.createGain()
          trim.gain.value = 0.9
          osc.connect(trim)
          trim.connect(graph.music)
          osc.start()
        }
      },
      1,
      22_050,
    )
    expect(peakOf(channels[0])).toBeLessThan(1)
  })

  it('scales the whole mix by the sound volume', async () => {
    const levels: number[] = []

    for (const volume of [0.25, 0.5, 1]) {
      const { channels } = await render(
        4,
        (ctx) => {
          const graph = buildBusGraph(ctx, ctx.destination, volume)
          findAmbientPreset('rain-window')!.build(ctx, graph.music, {
            offlineSeconds: 4,
            seed: 31,
          })
        },
        1,
        22_050,
      )
      levels.push(rmsOf(channels[0]))
    }

    expect(levels[0]).toBeLessThan(levels[1])
    expect(levels[1]).toBeLessThan(levels[2])
    // Halving the volume should roughly halve the level, since the ceiling is
    // not engaging.
    expect(levels[1] / levels[0]).toBeGreaterThan(1.6)
    expect(levels[1] / levels[0]).toBeLessThan(2.4)
  })

  it('keeps a rhythm playing when the ambience is silent, and the reverse', async () => {
    const rhythmOnly = await render(
      3,
      (ctx) => {
        const graph = buildBusGraph(ctx, ctx.destination, 0.6)
        const rhythm = createBrainwaveGraph(ctx, {
          targetHz: 10,
          mode: 'amplitude-modulation',
          depth: 0.7,
        })
        rhythm.out.connect(graph.rhythm)
        rhythm.setLevel(0.5, 0)
      },
      1,
      22_050,
    )
    expect(rmsOf(rhythmOnly.channels[0])).toBeGreaterThan(0.001)

    const ambienceOnly = await render(
      3,
      (ctx) => {
        const graph = buildBusGraph(ctx, ctx.destination, 0.6)
        findAmbientPreset('ocean-tide')!.build(ctx, graph.music, {
          offlineSeconds: 3,
          seed: 8,
        })
      },
      1,
      22_050,
    )
    expect(rmsOf(ambienceOnly.channels[0])).toBeGreaterThan(0.001)
  })

  it('does not clip when every generated layer stacks up at full volume', async () => {
    const { channels } = await render(
      10,
      (ctx) => {
        // The worst level the app can actually ask for: Sound volume maxed,
        // every ambience playing at once, and the rhythm at full level too.
        const graph = buildBusGraph(ctx, ctx.destination, MAX_MUSIC_VOLUME)

        for (const preset of AMBIENT_PRESETS) {
          preset.build(ctx, graph.music, { offlineSeconds: 10, seed: 55 })
        }
        const rhythm = createBrainwaveGraph(ctx, {
          targetHz: 2,
          mode: 'amplitude-modulation',
          depth: 1,
        })
        rhythm.out.connect(graph.rhythm)
        rhythm.setLevel(1, 0)
      },
      2,
      22_050,
    )

    for (const channel of channels) {
      expect(peakOf(channel)).toBeLessThanOrEqual(1)
    }
  })

  it('lets Sound volume go to twice its old ceiling, clamped beyond that', async () => {
    await render(0.2, (ctx) => {
      const doubled = buildBusGraph(ctx, ctx.destination, MAX_MUSIC_VOLUME)
      expect(doubled.generated.gain.value).toBeCloseTo(
        MAX_MUSIC_VOLUME * MUSIC_MAKEUP_GAIN,
      )
      expect(MAX_MUSIC_VOLUME).toBeCloseTo(2)

      // A value past the ceiling is clamped there, not passed through raw —
      // otherwise a corrupt or hand-edited setting could drive the mix as hard
      // as it liked.
      const overdriven = buildBusGraph(ctx, ctx.destination, 50)
      expect(overdriven.generated.gain.value).toBeCloseTo(
        MAX_MUSIC_VOLUME * MUSIC_MAKEUP_GAIN,
      )
    })
  })

  it('cannot emit above full scale even at the new, higher Sound ceiling', async () => {
    const { channels } = await render(
      1,
      (ctx) => {
        const graph = buildBusGraph(ctx, ctx.destination, MAX_MUSIC_VOLUME)
        for (let i = 0; i < 12; i += 1) {
          const osc = ctx.createOscillator()
          osc.frequency.value = 90 + i * 37
          const trim = ctx.createGain()
          trim.gain.value = 0.9
          osc.connect(trim)
          trim.connect(graph.music)
          osc.start()
        }
      },
      1,
      22_050,
    )
    expect(peakOf(channels[0])).toBeLessThan(1)
  })

  it('holds the master volume steady while two ambiences crossfade', async () => {
    let observed = -1

    const { channels } = await render(
      6,
      (ctx) => {
        const graph = buildBusGraph(ctx, ctx.destination, 0.5)

        const outgoing = findAmbientPreset('moon-garden')!.build(ctx, graph.music, {
          seed: 2,
        })
        findAmbientPreset('fireplace-glow')!.build(ctx, graph.music, {
          offlineSeconds: 6,
          seed: 3,
        })
        // The switch: one fades out while the other fades in. Nothing touches
        // the node carrying the user's volume.
        outgoing.stop(1.5)
        observed = graph.generated.gain.value
      },
      1,
      22_050,
    )

    expect(observed).toBeCloseTo(0.5 * MUSIC_MAKEUP_GAIN)
    // And the crossfade never sums into distortion.
    expect(peakOf(channels[0])).toBeLessThanOrEqual(1)
    expect(rmsOf(channels[0])).toBeGreaterThan(0.001)
  })
})
