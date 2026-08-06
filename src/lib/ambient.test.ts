import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  AMBIENCE_FADE_SECONDS,
  AMBIENT_PRESETS,
  BUILTIN_AMBIENT_IDS,
  RAIN_CHARACTERS,
  TRANSIENT_CEILINGS,
  findAmbientPreset,
  isBuiltInAmbientId,
  isRainCharacter,
  makeRng,
  randomCrackle,
  randomDroplet,
  randomPop,
  type BuiltInAmbientId,
} from './ambient'
import { peakOf, render, rmsOf } from './testing/audioHarness'

const IDS: BuiltInAmbientId[] = [
  'moon-garden',
  'soft-horizon',
  'rain-window',
  'ocean-tide',
  'fireplace-glow',
]

describe('the library', () => {
  it('presents the five sounds in the documented order', () => {
    expect(BUILTIN_AMBIENT_IDS).toEqual(IDS)
  })

  it('resolves every id to its own generator', () => {
    for (const id of IDS) {
      const preset = findAmbientPreset(id)
      expect(preset, id).toBeDefined()
      expect(preset?.id).toBe(id)
      expect(typeof preset?.build).toBe('function')
    }
  })

  it('gives every sound a name and a one-sentence description', () => {
    for (const preset of AMBIENT_PRESETS) {
      expect(preset.name.length).toBeGreaterThan(2)
      expect(preset.description).toMatch(/\.$/)
    }
  })

  it('does not resolve ids it does not own', () => {
    for (const id of ['', 'rain', 'moon_garden', 'track-1']) {
      expect(findAmbientPreset(id)).toBeUndefined()
      expect(isBuiltInAmbientId(id)).toBe(false)
    }
  })

  it('recognises only the three rain characters', () => {
    for (const value of RAIN_CHARACTERS) expect(isRainCharacter(value)).toBe(true)
    for (const other of ['stormy', '', null, 2, undefined]) {
      expect(isRainCharacter(other)).toBe(false)
    }
  })

  it('fades over at least a second and a half', () => {
    expect(AMBIENCE_FADE_SECONDS).toBeGreaterThanOrEqual(1.5)
  })
})

describe('bounded randomness', () => {
  /**
   * Adversarial draws: the extremes of the unit interval, a fine sweep across
   * it, and a long seeded run. A ceiling that only holds for typical values is
   * not a ceiling.
   */
  function* draws(): Generator<() => number> {
    yield () => 0
    yield () => 1
    yield () => 0.9999999
    for (let step = 0; step <= 20; step += 1) {
      const value = step / 20
      yield () => value
    }
    yield makeRng(1)
    yield makeRng(0xbeef)
  }

  /*
   * Every draw is still checked; what changed is the bookkeeping.
   *
   * Calling `expect` inside the hot loop meant ~430,000 matcher invocations,
   * and the matcher overhead — not the arithmetic — pushed this test to
   * 28–58s against a 30s limit. It failed roughly half the time, on machine
   * load rather than on anything about the code, which makes a green suite
   * meaningless. Collecting violations and asserting once keeps identical
   * coverage, runs in a moment, and reports the first offending draw with the
   * values that broke it instead of a bare matcher diff.
   */
  function firstViolation(
    label: string,
    value: number,
    min: number,
    max: number,
  ): string | null {
    if (Number.isFinite(value) && value >= min && value <= max) return null
    return `${label} was ${value}, outside [${min}, ${max}]`
  }

  it('never lets a rain droplet exceed its ceiling', () => {
    const violations: string[] = []

    for (const rng of draws()) {
      for (let i = 0; i < 2000; i += 1) {
        for (const intensity of [0, 0.62, 0.8, 1, 5, -1]) {
          const drop = randomDroplet(rng, intensity)
          const checks = [
            firstViolation('peak', drop.peak, 0, TRANSIENT_CEILINGS.droplet),
            firstViolation('frequency', drop.frequency, 1200, 4500),
            firstViolation('attack', drop.attack, 0.001, 0.005),
            firstViolation('decay', drop.decay, 0.03, 0.16),
            firstViolation('pan', Math.abs(drop.pan), 0, 0.72),
            drop.rate > 0 ? null : `rate was ${drop.rate}, expected above 0`,
          ].filter(Boolean)

          if (checks.length > 0) {
            violations.push(`intensity ${intensity}: ${checks.join('; ')}`)
            // One bad draw is the whole answer; no need for the other 71,999.
            break
          }
        }
        if (violations.length > 0) break
      }
      if (violations.length > 0) break
    }

    expect(violations).toEqual([])
  })

  it('never lets a fire crackle exceed its ceiling', () => {
    for (const rng of draws()) {
      for (let i = 0; i < 2000; i += 1) {
        const crackle = randomCrackle(rng)
        expect(crackle.peak).toBeLessThanOrEqual(TRANSIENT_CEILINGS.crackle)
        expect(crackle.frequency).toBeGreaterThanOrEqual(700)
        expect(crackle.frequency).toBeLessThanOrEqual(5000)
        // Never an instant attack: that is what would click.
        expect(crackle.attack).toBeGreaterThanOrEqual(0.0015)
        expect(crackle.attack).toBeLessThanOrEqual(0.004)
        expect(crackle.decay).toBeGreaterThanOrEqual(0.015)
        expect(crackle.decay).toBeLessThanOrEqual(0.1)
        expect(Math.abs(crackle.pan)).toBeLessThanOrEqual(0.8)
      }
    }
  })

  it('never lets a wood pop exceed its ceiling, or repeat on a fixed interval', () => {
    const gaps = new Set<number>()
    const rng = makeRng(7)

    for (let i = 0; i < 4000; i += 1) {
      const pop = randomPop(rng)
      expect(pop.peak).toBeLessThanOrEqual(TRANSIENT_CEILINGS.pop)
      expect(pop.gap).toBeGreaterThanOrEqual(4)
      expect(pop.gap).toBeLessThanOrEqual(15)
      expect(pop.thumpHz).toBeGreaterThanOrEqual(90)
      expect(pop.thumpHz).toBeLessThanOrEqual(190)
      gaps.add(Math.round(pop.gap * 100))
    }

    // Wide spread rather than a metronome.
    expect(gaps.size).toBeGreaterThan(500)

    for (const extreme of [() => 0, () => 1]) {
      expect(randomPop(extreme).peak).toBeLessThanOrEqual(TRANSIENT_CEILINGS.pop)
    }
  })

  it('keeps the loudest pop below the ceilings that sit under the voice', () => {
    // A pop is the loudest generated transient, and still well under 0.1.
    expect(TRANSIENT_CEILINGS.pop).toBeLessThan(0.1)
    expect(TRANSIENT_CEILINGS.droplet).toBeLessThan(TRANSIENT_CEILINGS.pop)
    expect(TRANSIENT_CEILINGS.crackle).toBeLessThan(TRANSIENT_CEILINGS.pop)
  })

  it('is deterministic when seeded, and different between seeds', () => {
    const a = Array.from({ length: 8 }, makeRng(42))
    const b = Array.from({ length: 8 }, makeRng(42))
    const c = Array.from({ length: 8 }, makeRng(43))
    expect(a).toEqual(b)
    expect(a).not.toEqual(c)
    for (const value of a) {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })
})

describe('lifecycle', () => {
  it('holds sources open while playing and releases every one on stop', async () => {
    for (const preset of AMBIENT_PRESETS) {
      await render(0.5, (ctx) => {
        const handle = preset.build(ctx, ctx.destination, { seed: 3 })

        const running = handle.inspect()
        expect(running.sources, preset.id).toBeGreaterThan(0)
        expect(running.stopped).toBe(false)

        handle.stop(0)

        const stopped = handle.inspect()
        expect(stopped.sources, preset.id).toBe(0)
        expect(stopped.scheduling).toBe(false)
        expect(stopped.stopped).toBe(true)
      })
    }
  })

  it('ignores a second stop', async () => {
    await render(0.5, (ctx) => {
      const handle = AMBIENT_PRESETS[2].build(ctx, ctx.destination, { seed: 1 })
      handle.stop(0)
      handle.stop(0)
      handle.stop()
      expect(handle.inspect().sources).toBe(0)
    })
  })

  it('does not leak a second graph when the same sound starts twice', async () => {
    await render(0.5, (ctx) => {
      const preset = AMBIENT_PRESETS[4]
      const first = preset.build(ctx, ctx.destination, { seed: 11 })
      const second = preset.build(ctx, ctx.destination, { seed: 12 })

      const firstCount = first.inspect().sources
      expect(second.inspect().sources).toBeGreaterThan(0)

      // Stopping one must leave the other completely intact.
      first.stop(0)
      expect(first.inspect().sources).toBe(0)
      expect(second.inspect().sources).toBeGreaterThan(0)
      expect(second.inspect().stopped).toBe(false)

      second.stop(0)
      expect(second.inspect().sources).toBe(0)
      // Each handle owned its own graph, so the counts were independent.
      expect(firstCount).toBeGreaterThan(0)
    })
  })

  it('goes silent after it stops', async () => {
    const { channels, sampleRate } = await render(
      4,
      (ctx) => {
        const handle = AMBIENT_PRESETS[3].build(ctx, ctx.destination, {
          offlineSeconds: 4,
          seed: 5,
        })
        handle.stop(1.5)
      },
      1,
      22_050,
    )
    // The 1.5 s fade is scheduled from time zero, so the tail must be silent.
    const tail = channels[0].subarray(Math.floor(sampleRate * 2))
    expect(peakOf(tail)).toBeLessThan(0.001)
  })
})

describe('rendered sound', () => {
  const RENDER_SECONDS = 8

  it('makes audible sound that never approaches full scale', async () => {
    for (const preset of AMBIENT_PRESETS) {
      const { channels } = await render(
        RENDER_SECONDS,
        (ctx) => {
          preset.build(ctx, ctx.destination, {
            offlineSeconds: RENDER_SECONDS,
            seed: 21,
          })
        },
        2,
        22_050,
      )

      for (const channel of channels) {
        const peak = peakOf(channel)
        expect(peak, `${preset.id} should be audible`).toBeGreaterThan(0.005)
        // Conservative source levels: plenty of room for voice on top.
        expect(peak, `${preset.id} should leave headroom`).toBeLessThan(0.75)
      }
      expect(rmsOf(channels[0]), preset.id).toBeGreaterThan(0.001)
    }
  })

  it('fades in when played live and does not when rendered for export', async () => {
    const preset = findAmbientPreset('ocean-tide')!

    const live = await render(
      4,
      (ctx) => {
        preset.build(ctx, ctx.destination, { seed: 9 })
      },
      1,
      22_050,
    )
    const opening = rmsOf(live.channels[0].subarray(0, Math.floor(22_050 * 0.2)))
    const later = rmsOf(live.channels[0].subarray(Math.floor(22_050 * 2)))
    expect(opening).toBeLessThan(later * 0.5)

    const offline = await render(
      4,
      (ctx) => {
        preset.build(ctx, ctx.destination, { offlineSeconds: 4, seed: 9 })
      },
      1,
      22_050,
    )
    // No fade to put a dip at every loop point in an exported file.
    expect(rmsOf(offline.channels[0].subarray(0, 2000))).toBeGreaterThan(0)
  })

  it('gives the same result twice for the same seed', async () => {
    const build = (ctx: BaseAudioContext) => {
      findAmbientPreset('fireplace-glow')!.build(ctx, ctx.destination, {
        offlineSeconds: 3,
        seed: 1234,
      })
    }
    const a = await render(3, build, 1, 22_050)
    const b = await render(3, build, 1, 22_050)
    expect(Array.from(a.channels[0].subarray(0, 4000))).toEqual(
      Array.from(b.channels[0].subarray(0, 4000)),
    )
  })

  it('makes rain denser and brighter as the character opens up', async () => {
    const levels = await Promise.all(
      RAIN_CHARACTERS.map(async (rainCharacter) => {
        const { channels } = await render(
          6,
          (ctx) => {
            findAmbientPreset('rain-window')!.build(ctx, ctx.destination, {
              offlineSeconds: 6,
              seed: 77,
              rainCharacter,
            })
          },
          1,
          22_050,
        )
        return rmsOf(channels[0])
      }),
    )

    expect(levels[0]).toBeLessThan(levels[1])
    expect(levels[1]).toBeLessThan(levels[2])
  })

  it('drops the optional layers on modest hardware without going silent', async () => {
    for (const preset of AMBIENT_PRESETS) {
      const { channels } = await render(
        4,
        (ctx) => {
          preset.build(ctx, ctx.destination, {
            offlineSeconds: 4,
            seed: 4,
            lowPower: true,
          })
        },
        1,
        22_050,
      )
      expect(rmsOf(channels[0]), preset.id).toBeGreaterThan(0.001)
    }
  })

  it('never produces a startling transient at the default level', async () => {
    // Fireplace is the one with pops in it; render long enough to catch several.
    const { channels } = await render(
      30,
      (ctx) => {
        findAmbientPreset('fireplace-glow')!.build(ctx, ctx.destination, {
          offlineSeconds: 30,
          seed: 99,
        })
      },
      1,
      22_050,
    )

    const samples = channels[0]
    const peak = peakOf(samples)
    const rms = rmsOf(samples)
    // A pop should read as part of the fire, not as an event on its own: a few
    // times the steady level, not dozens.
    expect(peak / rms).toBeLessThan(8)
    expect(peak).toBeLessThan(0.5)
  })
})

describe('offline and self-contained', () => {
  it('never reaches the network for a sound', () => {
    for (const file of ['src/lib/ambient.ts', 'src/lib/brainwaveAudio.ts']) {
      const source = readFileSync(file, 'utf8')
      expect(source, file).not.toMatch(/\bfetch\s*\(/)
      expect(source, file).not.toMatch(/XMLHttpRequest/)
      expect(source, file).not.toMatch(/https?:\/\//)
      expect(source, file).not.toMatch(/\bimport\s*\(/)
    }
  })

  it('never lets a visual preference reach the audio', () => {
    // Reduced motion changes what `SoundScene` renders and nothing else. If a
    // motion query ever appears in an audio module, this is where it is caught.
    for (const file of ['src/lib/ambient.ts', 'src/lib/brainwaveAudio.ts']) {
      const source = readFileSync(file, 'utf8')
      expect(source, file).not.toMatch(/prefers-reduced-motion/)
      expect(source, file).not.toMatch(/useReducedMotion|prefersReducedMotion/)
      expect(source, file).not.toMatch(/matchMedia/)
    }
  })

  it('never drives the rhythm from a timer or a frame callback', () => {
    const source = readFileSync('src/lib/brainwaveAudio.ts', 'utf8')
    expect(source).not.toMatch(/setInterval/)
    expect(source).not.toMatch(/requestAnimationFrame/)
    // The only timer is the one that disposes a graph after its fade.
    const timers = source.match(/setTimeout/g) ?? []
    expect(timers.length).toBeLessThanOrEqual(1)
  })
})
