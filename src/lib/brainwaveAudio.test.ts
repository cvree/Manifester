import { describe, expect, it } from 'vitest'
import {
  BINAURAL_MAX_HZ,
  BRAINWAVE_LIST,
  BRAINWAVE_ORDER,
  BRAINWAVE_PRESETS,
  CARRIER_HZ,
  DEFAULT_BRAINWAVE,
  createBrainwaveGraph,
  createModulationEnvelope,
  getBandLabel,
  getBeatHz,
  getBinauralPair,
  getTargetHz,
  isBinauralSubstituted,
  isBrainwavePreset,
  normaliseBrainwave,
  resolveMode,
  supportsBinaural,
  withPreset,
  type BrainwavePresetId,
} from './brainwaveAudio'
import {
  constantOne,
  envelopeOf,
  measureRateHz,
  peakOf,
  render,
} from './testing/audioHarness'

const PRESETS = BRAINWAVE_ORDER

describe('exact target frequencies', () => {
  it('gives each preset its documented rate', () => {
    expect(getTargetHz('gamma')).toBe(40)
    expect(getTargetHz('beta')).toBe(20)
    expect(getTargetHz('alpha')).toBe(10)
    expect(getTargetHz('theta')).toBe(6)
    expect(getTargetHz('delta')).toBe(2)
  })

  it('orders the list from the fastest rhythm to the slowest', () => {
    expect(BRAINWAVE_ORDER).toEqual(['gamma', 'beta', 'alpha', 'theta', 'delta'])
    const rates = BRAINWAVE_LIST.map((item) => item.targetHz)
    expect(rates).toEqual([40, 20, 10, 6, 2])
  })

  it('describes each conventional band as a range, not a boundary', () => {
    expect(getBandLabel('gamma')).toBe('approximately 30–80 Hz')
    expect(getBandLabel('beta')).toBe('approximately 13–30 Hz')
    expect(getBandLabel('alpha')).toBe('approximately 8–13 Hz')
    expect(getBandLabel('theta')).toBe('approximately 4–8 Hz')
    expect(getBandLabel('delta')).toBe('approximately 0.5–4 Hz')
  })

  it('keeps every target inside its own band', () => {
    for (const id of PRESETS) {
      const { targetHz, minHz, maxHz } = BRAINWAVE_PRESETS[id]
      expect(targetHz).toBeGreaterThanOrEqual(minHz)
      expect(targetHz).toBeLessThanOrEqual(maxHz)
    }
  })

  it('recognises only the five preset ids', () => {
    for (const id of PRESETS) expect(isBrainwavePreset(id)).toBe(true)
    for (const other of ['', 'GAMMA', 'mu', '432', null, 40, undefined]) {
      expect(isBrainwavePreset(other)).toBe(false)
    }
  })
})

describe('binaural channel pairs', () => {
  it('produces the documented pairs', () => {
    expect(getBinauralPair(2)).toEqual({ leftHz: 199, rightHz: 201 })
    expect(getBinauralPair(6)).toEqual({ leftHz: 197, rightHz: 203 })
    expect(getBinauralPair(10)).toEqual({ leftHz: 195, rightHz: 205 })
    expect(getBinauralPair(20)).toEqual({ leftHz: 190, rightHz: 210 })
  })

  it('differs by exactly the target and centres exactly on the carrier', () => {
    for (const id of PRESETS) {
      const targetHz = getTargetHz(id)
      const { leftHz, rightHz } = getBinauralPair(targetHz)
      expect(Math.abs(rightHz - leftHz)).toBe(targetHz)
      expect((leftHz + rightHz) / 2).toBe(CARRIER_HZ)
      expect(getBeatHz(leftHz, rightHz)).toBe(targetHz)
    }
  })

  it('treats 40 Hz as outside the range binaural beating is discussed for', () => {
    expect(supportsBinaural(2)).toBe(true)
    expect(supportsBinaural(20)).toBe(true)
    expect(supportsBinaural(BINAURAL_MAX_HZ)).toBe(true)
    expect(supportsBinaural(40)).toBe(false)
  })

  it('substitutes modulation for Gamma in headphone mode, and only Gamma', () => {
    expect(resolveMode('gamma', 'binaural')).toBe('amplitude-modulation')
    expect(isBinauralSubstituted('gamma', 'binaural')).toBe(true)

    for (const id of ['beta', 'alpha', 'theta', 'delta'] as BrainwavePresetId[]) {
      expect(resolveMode(id, 'binaural')).toBe('binaural')
      expect(isBinauralSubstituted(id, 'binaural')).toBe(false)
    }
  })

  it('never claims binaural when the user did not ask for it', () => {
    for (const id of PRESETS) {
      expect(resolveMode(id, 'amplitude-modulation')).toBe('amplitude-modulation')
    }
  })
})

describe('persisted settings', () => {
  it('loads an older loop with no rhythm at all, turned off', () => {
    for (const missing of [undefined, null]) {
      const settings = normaliseBrainwave(missing)
      expect(settings.enabled).toBe(false)
      expect(settings).toEqual(DEFAULT_BRAINWAVE)
    }
  })

  it('derives the rate from the preset rather than trusting what was saved', () => {
    const tampered = normaliseBrainwave({
      enabled: true,
      preset: 'delta',
      // A value from an older build, a hand edit, or plain corruption.
      targetHz: 528 as never,
      mode: 'binaural',
      volume: 0.4,
      depth: 0.6,
    })
    expect(tampered.targetHz).toBe(2)
    expect(tampered.preset).toBe('delta')
  })

  it('falls back to a known preset when the saved one is unrecognised', () => {
    const settings = normaliseBrainwave({
      enabled: true,
      preset: 'schumann' as never,
      targetHz: 7.83 as never,
    })
    expect(settings.preset).toBe(DEFAULT_BRAINWAVE.preset)
    expect(settings.targetHz).toBe(getTargetHz(DEFAULT_BRAINWAVE.preset))
  })

  it('clamps level and intensity, and refuses anything that is not a number', () => {
    const high = normaliseBrainwave({ volume: 9, depth: 4 })
    expect(high.volume).toBe(1)
    expect(high.depth).toBe(1)

    const low = normaliseBrainwave({ volume: -3, depth: 0 })
    expect(low.volume).toBe(0)
    expect(low.depth).toBe(0.2)

    const junk = normaliseBrainwave({
      volume: Number.NaN,
      depth: 'loud' as never,
    })
    expect(junk.volume).toBe(DEFAULT_BRAINWAVE.volume)
    expect(junk.depth).toBe(DEFAULT_BRAINWAVE.depth)
  })

  it('only enables on an explicit true', () => {
    expect(normaliseBrainwave({ enabled: 1 as never }).enabled).toBe(false)
    expect(normaliseBrainwave({ enabled: true }).enabled).toBe(true)
  })

  it('keeps level and intensity when switching preset', () => {
    const from = normaliseBrainwave({ enabled: true, preset: 'theta', volume: 0.2, depth: 0.45 })
    const to = withPreset(from, 'gamma')
    expect(to.targetHz).toBe(40)
    expect(to.volume).toBe(0.2)
    expect(to.depth).toBe(0.45)
  })

  it('starts turned off, so nothing plays until it is chosen', () => {
    expect(DEFAULT_BRAINWAVE.enabled).toBe(false)
  })
})

describe('measured modulation rate', () => {
  /*
   * The point of these: the numbers above are what we asked for. These render
   * the graph through a real Web Audio implementation and measure what actually
   * came out. Delta gets the longest render — at 2 Hz there is the least to
   * measure, and it is the case most likely to be wrong.
   */
  const RENDER_SECONDS: Record<BrainwavePresetId, number> = {
    gamma: 8,
    beta: 8,
    alpha: 10,
    theta: 15,
    delta: 30,
  }

  for (const id of PRESETS) {
    const targetHz = getTargetHz(id)

    it(`renders ${id} at ${targetHz} Hz, within 0.05 Hz`, async () => {
      const seconds = RENDER_SECONDS[id]
      const { channels, sampleRate } = await render(seconds, (ctx) => {
        const envelope = createModulationEnvelope(ctx, targetHz, 1)
        constantOne(ctx).connect(envelope.node)
        envelope.node.connect(ctx.destination)
      })

      const measured = measureRateHz(channels[0], sampleRate, 0.5)
      expect(measured).toBeCloseTo(targetHz, 2)
      expect(Math.abs(measured - targetHz)).toBeLessThan(0.05)
    })
  }

  it('produces the textbook envelope at full depth', async () => {
    const { channels } = await render(4, (ctx) => {
      const envelope = createModulationEnvelope(ctx, 10, 1)
      constantOne(ctx).connect(envelope.node)
      envelope.node.connect(ctx.destination)
    })

    // 0.5 · [1 + sin(…)] swings between 0 and 1 with a mean of 0.5.
    const samples = channels[0]
    let min = Infinity
    let max = -Infinity
    let sum = 0
    for (let i = 0; i < samples.length; i += 1) {
      min = Math.min(min, samples[i])
      max = Math.max(max, samples[i])
      sum += samples[i]
    }
    expect(min).toBeLessThan(0.01)
    expect(max).toBeGreaterThan(0.99)
    expect(sum / samples.length).toBeCloseTo(0.5, 2)
  })

  it('keeps the rate when the depth changes', async () => {
    for (const depth of [0.2, 0.5, 1]) {
      const { channels, sampleRate } = await render(10, (ctx) => {
        const envelope = createModulationEnvelope(ctx, 10, depth)
        constantOne(ctx).connect(envelope.node)
        envelope.node.connect(ctx.destination)
      })
      expect(Math.abs(measureRateHz(channels[0], sampleRate, 0.5) - 10)).toBeLessThan(
        0.05,
      )
    }
  })

  it('carries the rate through the whole modulation graph', async () => {
    for (const id of ['beta', 'alpha', 'theta'] as BrainwavePresetId[]) {
      const targetHz = getTargetHz(id)
      const { channels, sampleRate } = await render(
        12,
        (ctx) => {
          const graph = createBrainwaveGraph(ctx, {
            targetHz,
            mode: 'amplitude-modulation',
            depth: 1,
          })
          graph.out.connect(ctx.destination)
          graph.setLevel(1, 0)
        },
        1,
        44_100,
      )

      // The audible output's amplitude envelope should ride at the target rate.
      const envelope = envelopeOf(channels[0], sampleRate, targetHz)
      const measured = measureRateHz(envelope, sampleRate, 2)
      expect(Math.abs(measured - targetHz)).toBeLessThan(0.05)
    }
  })
})

describe('binaural graph', () => {
  it('puts a different frequency in each ear, and only one per ear', async () => {
    for (const id of ['beta', 'alpha', 'theta', 'delta'] as BrainwavePresetId[]) {
      const targetHz = getTargetHz(id)
      const { leftHz, rightHz } = getBinauralPair(targetHz)

      const { channels, sampleRate } = await render(
        4,
        (ctx) => {
          const graph = createBrainwaveGraph(ctx, {
            targetHz,
            mode: 'binaural',
            depth: 1,
          })
          graph.out.connect(ctx.destination)
          graph.setLevel(1, 0)
        },
        2,
        44_100,
      )

      expect(channels).toHaveLength(2)
      // A pure tone per channel: the measured rate is the channel frequency,
      // which only holds if the channels really are separate.
      expect(measureRateHz(channels[0], sampleRate, 0.5)).toBeCloseTo(leftHz, 1)
      expect(measureRateHz(channels[1], sampleRate, 0.5)).toBeCloseTo(rightHz, 1)
    }
  })

  it('leaves headroom rather than running at full scale', async () => {
    const { channels } = await render(
      2,
      (ctx) => {
        const graph = createBrainwaveGraph(ctx, {
          targetHz: 10,
          mode: 'binaural',
          depth: 1,
        })
        graph.out.connect(ctx.destination)
        graph.setLevel(1, 0)
      },
      2,
      44_100,
    )
    for (const channel of channels) {
      expect(peakOf(channel)).toBeGreaterThan(0.05)
      // Below 1: a single channel never reaches full scale on its own, even at
      // full rhythm volume, leaving room for the mix ceiling to do its job
      // rather than needing to bite on the rhythm alone.
      expect(peakOf(channel)).toBeLessThan(0.85)
    }
  })
})

describe('graph lifecycle', () => {
  it('arrives from silence rather than snapping on', async () => {
    const { channels, sampleRate } = await render(
      3,
      (ctx) => {
        const graph = createBrainwaveGraph(ctx, {
          targetHz: 10,
          mode: 'amplitude-modulation',
          depth: 1,
        })
        graph.out.connect(ctx.destination)
        // The real fade, not the instant one.
        graph.setLevel(1)
      },
      1,
      44_100,
    )

    const firstTenth = peakOf(channels[0].subarray(0, Math.floor(sampleRate * 0.1)))
    const settled = peakOf(channels[0].subarray(Math.floor(sampleRate * 2.2)))
    expect(firstTenth).toBeLessThan(settled * 0.2)
  })

  it('leaves in silence rather than cutting off', async () => {
    const { channels, sampleRate } = await render(
      4,
      (ctx) => {
        const graph = createBrainwaveGraph(ctx, {
          targetHz: 10,
          mode: 'amplitude-modulation',
          depth: 1,
        })
        graph.out.connect(ctx.destination)
        graph.setLevel(1, 0)
        graph.fadeOut(2)
      },
      1,
      44_100,
    )

    const tail = peakOf(channels[0].subarray(Math.floor(sampleRate * 2.1)))
    expect(tail).toBeLessThan(0.02)
  })

  it('is safe to dispose twice, and goes quiet when it does', async () => {
    const { channels } = await render(1, (ctx) => {
      const graph = createBrainwaveGraph(ctx, {
        targetHz: 10,
        mode: 'amplitude-modulation',
        depth: 1,
      })
      graph.out.connect(ctx.destination)
      graph.setLevel(1, 0)
      graph.dispose()
      graph.dispose()
      // Calls after disposal must not throw or resurrect anything.
      graph.setLevel(1, 0)
      graph.fadeOut()
    })
    expect(peakOf(channels[0])).toBe(0)
  })
})
