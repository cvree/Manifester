import { describe, expect, it } from 'vitest'
import {
  CUE_DESIGNS,
  CUE_PEAK_CEILING,
  GLOBAL_MIN_GAP_MS,
  MAX_CONCURRENT_VOICES,
  cueAllowed,
  cueDurationSeconds,
  cueIsAudible,
  renderCue,
  type Cue,
} from './cueSounds'
import { peakOf, render, rmsOf } from './testing/audioHarness'

/*
 * These are rendered rather than asserted on as data.
 *
 * The whole risk in a feedback vocabulary is that it *sounds* wrong — too
 * loud, too bright, too sharp at the edges — and none of those are properties
 * of the table in `cueSounds.ts`. They are properties of the samples the table
 * produces once the envelopes, the octave partials and the lowpass have all
 * had their say. `node-web-audio-api` renders the same graph a browser will,
 * so every number below is measured off the audio somebody would actually
 * hear.
 */

const AUDIBLE = (Object.keys(CUE_DESIGNS) as Cue[]).filter(cueIsAudible)
const SILENT = (Object.keys(CUE_DESIGNS) as Cue[]).filter((name) => !cueIsAudible(name))

/** Render one cue on its own, from silence, with room for its whole tail. */
async function renderOne(name: Cue) {
  const design = CUE_DESIGNS[name]
  const seconds = cueDurationSeconds(design) + 0.3
  const audio = await render(seconds, (ctx) => {
    renderCue(ctx, ctx.destination, design, 0.02)
  })
  return audio.channels[0]
}

/**
 * A crude brightness measure: how far the waveform travels per unit of the
 * amplitude it travels through.
 *
 * For a sine at frequency `f` sampled at `fs`, the mean absolute difference
 * between neighbouring samples is proportional to `f/fs` times the mean
 * absolute amplitude — so this ratio rises with pitch and is indifferent to
 * both loudness and duration, which a per-sample average is not. Enough to
 * tell a low muted tone from a bright one without a Fourier transform. Used
 * only to compare cues against each other, never as an absolute.
 */
function brightness(samples: Float32Array): number {
  let motion = 0
  let level = 0
  for (let i = 1; i < samples.length; i += 1) {
    motion += Math.abs(samples[i] - samples[i - 1])
    level += Math.abs(samples[i])
  }
  return level === 0 ? 0 : motion / level
}

describe('every cue stays under the ceiling', () => {
  it.each(AUDIBLE)('%s never peaks above the bound', async (name) => {
    const samples = await renderOne(name)
    const peak = peakOf(samples)
    expect(peak).toBeGreaterThan(0)
    expect(peak).toBeLessThanOrEqual(CUE_PEAK_CEILING)
  })

  it('is quiet enough to sit under a spoken line', async () => {
    /*
     * The number that matters in practice. A spoken affirmation leaves the
     * voice path at up to 1.0, so a cue at the ceiling is roughly 22 dB below
     * it — and the loudest cue in the vocabulary is well inside that. A cue
     * you notice over the words has failed at its job, whatever else it does.
     */
    const loudest = Math.max(
      ...(await Promise.all(AUDIBLE.map(async (name) => peakOf(await renderOne(name))))),
    )
    expect(loudest).toBeLessThan(0.12)
  })
})

describe('the hierarchy is audible, not just declared', () => {
  it('makes a tap the smallest thing in the vocabulary', async () => {
    const tap = await renderOne('tap')
    const save = await renderOne('save')
    const complete = await renderOne('complete')

    // Brief: over well inside a tenth of a second.
    expect(cueDurationSeconds(CUE_DESIGNS.tap)).toBeLessThan(0.1)
    expect(cueDurationSeconds(CUE_DESIGNS.tap)).toBeLessThan(
      cueDurationSeconds(CUE_DESIGNS.save),
    )
    // And carries far less energy than the cues that mean something.
    expect(rmsOf(tap)).toBeLessThan(rmsOf(save))
    expect(rmsOf(tap)).toBeLessThan(rmsOf(complete))
  })

  it('keeps taps and selects under a tenth of a second', () => {
    expect(cueDurationSeconds(CUE_DESIGNS.tap)).toBeLessThan(0.1)
    expect(cueDurationSeconds(CUE_DESIGNS.select)).toBeLessThan(0.15)
  })

  it('gives completion the longest, most layered bloom', async () => {
    const complete = CUE_DESIGNS.complete

    // Layered: four notes and more, each arriving after the last.
    expect(complete.tones.length).toBeGreaterThanOrEqual(4)
    const delays = complete.tones.map((tone) => tone.delay)
    expect(delays).toEqual([...delays].sort((a, b) => a - b))
    expect(new Set(delays).size).toBe(delays.length)

    // With a soft tail measured in seconds, and air underneath it.
    expect(cueDurationSeconds(complete)).toBeGreaterThan(2.5)
    expect(complete.air).toBeDefined()
    for (const name of AUDIBLE) {
      if (name === 'complete') continue
      expect(cueDurationSeconds(CUE_DESIGNS[name])).toBeLessThan(
        cueDurationSeconds(complete),
      )
    }

    // And it really does still be ringing a second and a half in, rather than
    // simply having a long number written next to it.
    const samples = await renderOne('complete')
    const lateFrom = Math.floor(1.5 * 16_000)
    expect(rmsOf(samples, lateFrom)).toBeGreaterThan(0)
  })

  it('answers a start and a stop with opposite shapes', () => {
    const start = CUE_DESIGNS.start.tones.map((tone) => tone.frequency)
    const stop = CUE_DESIGNS.stop.tones.map((tone) => tone.frequency)
    // Rising to begin, falling to end — legible without being told.
    expect(start[1]).toBeGreaterThan(start[0])
    expect(stop[1]).toBeLessThan(stop[0])
  })
})

describe('nothing is sharp, and the error cue least of all', () => {
  it('keeps every cue out of the sharp high register', () => {
    for (const name of AUDIBLE) {
      const design = CUE_DESIGNS[name]
      // Nothing rings above 700 Hz, and the lowpass over it is what stops the
      // octave partials from turning a chime into a ping.
      for (const tone of design.tones) expect(tone.frequency).toBeLessThanOrEqual(700)
      expect(design.cutoffHz).toBeLessThanOrEqual(2200)
    }
  })

  it('never starts a tone with a step, which is what a click is', () => {
    for (const name of AUDIBLE) {
      for (const tone of CUE_DESIGNS[name].tones) {
        expect(tone.attack).toBeGreaterThan(0)
      }
    }
  })

  it('makes the error cue the calmest and darkest of them all', async () => {
    const error = CUE_DESIGNS.error
    // Low, muted, and slower to arrive than anything else.
    expect(error.cutoffHz).toBeLessThan(700)
    for (const tone of error.tones) {
      expect(tone.frequency).toBeLessThanOrEqual(220)
      expect(tone.attack).toBeGreaterThanOrEqual(0.03)
    }

    // Measurably darker than the cues it must not sound like an alarm beside.
    const errorSamples = await renderOne('error')
    const selectSamples = await renderOne('select')
    expect(brightness(errorSamples)).toBeLessThan(brightness(selectSamples))
  })
})

describe('the cues that are deliberately silent', () => {
  it('leaves the breath to its own voice', async () => {
    expect(SILENT).toEqual(expect.arrayContaining(['inhale', 'exhale', 'hold']))

    for (const name of SILENT) {
      const audio = await render(0.3, (ctx) => {
        // Returns zero voices started, and puts nothing into the graph.
        expect(renderCue(ctx, ctx.destination, CUE_DESIGNS[name], 0.02)).toBe(0)
      })
      expect(peakOf(audio.channels[0])).toBe(0)
    }
  })
})

describe('the anti-spam budget', () => {
  it('holds the quiet cues apart by less than the meaningful ones', () => {
    expect(CUE_DESIGNS.tap.minGapMs).toBeLessThan(CUE_DESIGNS.save.minGapMs)
    expect(CUE_DESIGNS.save.minGapMs).toBeLessThan(CUE_DESIGNS.complete.minGapMs)
    // Every cue has one: without it, a dragged slider is a rattle.
    for (const name of Object.keys(CUE_DESIGNS) as Cue[]) {
      expect(CUE_DESIGNS[name].minGapMs).toBeGreaterThan(0)
    }
  })

  it('never lets a cue outlast its own repeat gap by more than its tail', () => {
    // A cue whose gap is far shorter than its tail stacks into a smear when
    // pressed repeatedly. Taps and selects are short enough to overlap
    // harmlessly; anything with a real tail is held apart.
    for (const name of AUDIBLE) {
      const design = CUE_DESIGNS[name]
      if (cueDurationSeconds(design) < 0.2) continue
      expect(design.minGapMs).toBeGreaterThanOrEqual(200)
    }
  })
})

/*
 * ── Rapid input ──
 *
 * The failure this prevents is the one that would make the whole vocabulary a
 * mistake: a finger dragging a fader, or running down a list of voices,
 * producing a cue per frame. A cue you notice has failed; sixty of them a
 * second is a rattle.
 */
describe('a fast hand cannot turn the vocabulary into a rattle', () => {
  const quiet = { lastSameAt: null, lastAnyAt: null, ringing: 0 }

  it('lets the first cue through', () => {
    expect(cueAllowed('tap', 1000, quiet)).toBe(true)
  })

  it('drops a repeat that arrives faster than the gesture reads as one', () => {
    // A dragged slider fires roughly every 16 ms.
    expect(cueAllowed('tap', 1016, { ...quiet, lastSameAt: 1000 })).toBe(false)
    expect(cueAllowed('tap', 1032, { ...quiet, lastSameAt: 1000 })).toBe(false)
    // And lets one through once the hand has actually moved on.
    expect(cueAllowed('tap', 1100, { ...quiet, lastSameAt: 1000 })).toBe(true)
  })

  it('counts a whole drag as a handful of cues rather than a stream', () => {
    // Sixty events over a second of dragging, played through the real guard.
    let lastSameAt: number | null = null
    let lastAnyAt: number | null = null
    let played = 0

    for (let frame = 0; frame < 60; frame += 1) {
      const at = 1000 + frame * 16
      if (!cueAllowed('tap', at, { lastSameAt, lastAnyAt, ringing: 0 })) continue
      played += 1
      lastSameAt = at
      lastAnyAt = at
    }

    expect(played).toBeGreaterThan(0)
    expect(played).toBeLessThanOrEqual(25)
  })

  it('holds any two cues apart, even different ones', () => {
    // A press on a list row that fires both a select and a tap.
    expect(cueAllowed('select', 1005, { ...quiet, lastAnyAt: 1000 })).toBe(false)
    expect(cueAllowed('select', 1000 + GLOBAL_MIN_GAP_MS, { ...quiet, lastAnyAt: 1000 }))
      .toBe(true)
  })

  it('drops a cue rather than stacking one more tail onto a wash', () => {
    expect(cueAllowed('tap', 5000, { ...quiet, ringing: MAX_CONCURRENT_VOICES })).toBe(
      false,
    )
    expect(cueAllowed('tap', 5000, { ...quiet, ringing: MAX_CONCURRENT_VOICES - 1 }))
      .toBe(true)
  })

  it('never lets a silent cue reach the audio graph at all', () => {
    for (const name of SILENT) expect(cueAllowed(name, 5000, quiet)).toBe(false)
  })

  it('holds completion apart for longer than a tap, because it lasts longer', () => {
    expect(cueAllowed('complete', 1300, { ...quiet, lastSameAt: 1000 })).toBe(false)
    expect(cueAllowed('tap', 1300, { ...quiet, lastSameAt: 1000 })).toBe(true)
  })
})
